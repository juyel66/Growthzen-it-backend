import type { DeliveryArea, OrderStatus, Prisma, Role } from "../../../generated/prisma/client";
import prismaClient from "../../config/prisma";
import AppError from "../../utils/AppError";
import type { CreateOrderInput, CreateOrderRequestUser, OrderListQuery, OrderListResponse, OrderView, UpdateOrderStatusInput } from "./orders.interface";

const orderInclude = {
  items: {
    select: {
      id: true,
      productId: true,
      quantity: true,
      size: true,
      unitPrice: true,
      totalPrice: true,
    },
  },
} satisfies Prisma.OrderInclude;

type OrderRecord = Prisma.OrderGetPayload<{
  include: typeof orderInclude;
}>;

const monthLabels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const roundToTwo = (value: number): number => Number(value.toFixed(2));

const normalizeText = (value?: string | null): string => value?.trim().toUpperCase() ?? "";

const mapOrder = (order: OrderRecord): OrderView => ({
  id: order.id,
  userId: order.userId,
  customerName: order.customerName,
  customerPhone: order.customerPhone,
  address: order.address,
  deliveryArea: order.deliveryArea,
  subtotal: order.subtotal,
  discountAmount: order.discountAmount,
  deliveryCharge: order.deliveryCharge,
  payableAmount: order.payableAmount,
  couponCode: order.couponCode,
  status: order.status,
  items: order.items.map((item) => ({
    id: item.id,
    productId: item.productId,
    quantity: item.quantity,
    size: item.size,
    unitPrice: item.unitPrice,
    totalPrice: item.totalPrice,
  })),
  createdAt: order.createdAt,
  updatedAt: order.updatedAt,
});

const getAppliedDeliveryCharge = async (deliveryArea: DeliveryArea): Promise<number> => {
  const settings = await prismaClient.appSetting.findFirst({
    orderBy: { createdAt: "asc" },
    select: {
      insideDhakaDeliveryCharge: true,
      outsideDhakaDeliveryCharge: true,
    },
  });

  if (!settings) {
    return 0;
  }

  return deliveryArea === "INSIDE_DHAKA" ? settings.insideDhakaDeliveryCharge : settings.outsideDhakaDeliveryCharge;
};

const getCouponSettings = async (): Promise<{ couponCode: string | null; couponActive: boolean; customerDiscountPercentage: number }> => {
  const settings = await prismaClient.appSetting.findFirst({
    orderBy: { createdAt: "asc" },
    select: {
      couponCode: true,
      couponActive: true,
      customerDiscountPercentage: true,
    },
  });

  return {
    couponCode: settings?.couponCode ?? null,
    couponActive: settings?.couponActive ?? false,
    customerDiscountPercentage: settings?.customerDiscountPercentage ?? 0,
  };
};

const getSellingPrice = (role: Role, customerSellPrice: number, resellerSellPrice: number): number => {
  if (role === "RESELLER") {
    return resellerSellPrice;
  }

  return customerSellPrice;
};

const buildOrderSearchFilter = (search?: string): Prisma.OrderWhereInput => {
  const normalizedSearch = search?.trim();

  if (!normalizedSearch) {
    return {};
  }

  return {
    OR: [
      { customerName: { contains: normalizedSearch, mode: "insensitive" } },
      { customerPhone: { contains: normalizedSearch, mode: "insensitive" } },
      { address: { contains: normalizedSearch, mode: "insensitive" } },
      { couponCode: { contains: normalizedSearch, mode: "insensitive" } },
    ],
  };
};

const buildOrderWhere = (query: OrderListQuery): Prisma.OrderWhereInput => ({
  ...buildOrderSearchFilter(query.search),
  ...(query.status ? { status: query.status } : {}),
});

const parseOrderListPagination = (query: OrderListQuery) => {
  const page = Math.max(1, query.page ?? 1);
  const limit = Math.min(Math.max(query.limit ?? 10, 1), 100);

  return {
    page,
    limit,
    skip: (page - 1) * limit,
  };
};

const assertOrderOwnership = (order: { userId: string | null }, currentUser: CreateOrderRequestUser): void => {
  if (currentUser.role === "ADMIN" || currentUser.role === "SUPER_ADMIN") {
    return;
  }

  if (order.userId !== currentUser.id) {
    throw new AppError(403, "You do not have permission to access this order");
  }
};

export const createOrder = async (payload: CreateOrderInput, currentUser: CreateOrderRequestUser): Promise<OrderView> => {
  const productIds = [...new Set(payload.products.map((item) => item.productId))];

  const products = await prismaClient.product.findMany({
    where: { id: { in: productIds } },
    select: {
      id: true,
      hasSize: true,
      sizes: true,
      customerSellPrice: true,
      resellerSellPrice: true,
    },
  });

  const productMap = new Map(products.map((product) => [product.id, product] as const));
  const settings = await getCouponSettings();

  const normalizedCouponCode = normalizeText(payload.couponCode);
  const normalizedSettingsCouponCode = normalizeText(settings.couponCode);
  const couponIsApplied = Boolean(normalizedCouponCode && settings.couponActive && normalizedCouponCode === normalizedSettingsCouponCode);

  const orderItems = payload.products.map((item) => {
    const product = productMap.get(item.productId);

    if (!product) {
      throw new AppError(404, `Product not found for id ${item.productId}`);
    }

    if (product.hasSize && !item.size) {
      throw new AppError(400, `Size is required for product ${item.productId}`);
    }

    if (item.size && product.hasSize && !product.sizes.includes(item.size)) {
      throw new AppError(400, `Invalid size selected for product ${item.productId}`);
    }

    const unitPrice = getSellingPrice(currentUser.role, product.customerSellPrice, product.resellerSellPrice);
    const totalPrice = roundToTwo(unitPrice * item.quantity);

    return {
      productId: product.id,
      quantity: item.quantity,
      size: item.size ?? null,
      unitPrice,
      totalPrice,
    };
  });

  const subtotal = roundToTwo(orderItems.reduce((sum, item) => sum + item.totalPrice, 0));
  const discountAmount = couponIsApplied ? roundToTwo((subtotal * settings.customerDiscountPercentage) / 100) : 0;
  const deliveryCharge = roundToTwo(await getAppliedDeliveryCharge(payload.deliveryArea));
  const payableAmount = roundToTwo(Math.max(0, subtotal - discountAmount + deliveryCharge));

  const createdOrder = await prismaClient.order.create({
    data: {
      userId: currentUser.id,
      customerName: payload.customerName,
      customerPhone: payload.customerPhone,
      address: payload.address,
      deliveryArea: payload.deliveryArea,
      subtotal,
      discountAmount,
      deliveryCharge,
      payableAmount,
      couponCode: couponIsApplied ? normalizedCouponCode : null,
      status: "PENDING",
      items: {
        create: orderItems,
      },
    },
    include: orderInclude,
  });

  return mapOrder(createdOrder);
};

export const getMyOrders = async (currentUser: CreateOrderRequestUser): Promise<OrderView[]> => {
  const orders = await prismaClient.order.findMany({
    where: { userId: currentUser.id },
    orderBy: { createdAt: "desc" },
    include: orderInclude,
  });

  return orders.map(mapOrder);
};

export const getOrderById = async (orderId: string, currentUser: CreateOrderRequestUser): Promise<OrderView> => {
  const order = await prismaClient.order.findUnique({
    where: { id: orderId },
    include: orderInclude,
  });

  if (!order) {
    throw new AppError(404, "Order not found");
  }

  assertOrderOwnership(order, currentUser);

  return mapOrder(order);
};

export const getOrders = async (query: OrderListQuery): Promise<OrderListResponse> => {
  const { page, limit, skip } = parseOrderListPagination(query);
  const where = buildOrderWhere(query);

  const [total, orders] = await Promise.all([
    prismaClient.order.count({ where }),
    prismaClient.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      include: orderInclude,
    }),
  ]);

  return {
    items: orders.map(mapOrder),
    meta: {
      page,
      limit,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / limit),
    },
  };
};

export const updateOrderStatus = async (orderId: string, payload: UpdateOrderStatusInput): Promise<OrderView> => {
  const existingOrder = await prismaClient.order.findUnique({
    where: { id: orderId },
    include: orderInclude,
  });

  if (!existingOrder) {
    throw new AppError(404, "Order not found");
  }

  const updatedOrder = await prismaClient.order.update({
    where: { id: orderId },
    data: { status: payload.status },
    include: orderInclude,
  });

  return mapOrder(updatedOrder);
};