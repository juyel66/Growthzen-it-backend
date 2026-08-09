import crypto from "crypto";
import type { Prisma } from "@prisma/client";
import prismaClient from "../../config/prisma";
import AppError from "../../utils/AppError";
import type {
  AdminInvoiceListItem,
  FullInvoiceView,
  GetAllInvoicesParams,
  InvoiceProductSnapshot,
  InvoiceSummaryStats,
  PaginatedInvoiceResponse,
  PublicInvoiceProductItem,
  PublicInvoiceVerificationView,
} from "./invoices.interface";

const roundToTwo = (num: number): number => Number((Math.round(num * 100) / 100).toFixed(2));

const getFrontendBaseUrl = (): string => {
  return process.env.CLIENT_URL || process.env.FRONTEND_URL || "https://growthzen.com";
};

const resolveCustomerRole = (
  order?: {
    orderedByRole?: string;
    user?: { role?: string } | null;
  } | null,
  invoiceCustomerRole?: string | null,
  fallbackRole?: string | null
): string => {
  const userRole = order?.user?.role ? String(order.user.role).toUpperCase() : "";
  const orderedBy = order?.orderedByRole ? String(order.orderedByRole).toUpperCase() : "";

  if (userRole === "RESELLER" || orderedBy === "RESELLER") {
    return "RESELLER";
  }

  if (userRole === "CUSTOMER" || orderedBy === "CUSTOMER") {
    return "CUSTOMER";
  }

  if (invoiceCustomerRole) {
    const invRole = String(invoiceCustomerRole).toUpperCase();
    if (invRole === "RESELLER" || invRole === "CUSTOMER") {
      return invRole;
    }
  }

  if (userRole && userRole !== "ADMIN" && userRole !== "SUPER_ADMIN") {
    return userRole;
  }

  if (fallbackRole) {
    const fb = String(fallbackRole).toUpperCase();
    if (fb === "RESELLER" || fb === "CUSTOMER") {
      return fb;
    }
  }

  return "CUSTOMER";
};

const mapFullInvoice = (
  invoice: Prisma.InvoiceGetPayload<object>,
  order?: {
    status?: string;
    paymentMethod?: string;
    payment?: { status?: string; method?: string } | null;
    payableAmount?: number;
    deliveryCharge?: number;
    discountAmount?: number;
    subtotal?: number;
    orderedByRole?: string;
    user?: { role?: string } | null;
  } | null,
  viewerRole?: string
): FullInvoiceView => {
  const rawProducts = (invoice.productsJson as unknown as InvoiceProductSnapshot[]) || [];
  const verificationUrl = `${getFrontendBaseUrl()}/invoice/verify/${invoice.verificationToken}`;

  const mappedProducts = rawProducts.map((p) => {
    const title = p.productName || p.title || "Product";
    const img = p.productImage || (p as unknown as { image?: string }).image || null;
    const sku = p.sku || "";
    const qty = p.quantity || 1;
    const price = p.unitPrice || 0;
    const subtotal = p.subtotal || roundToTwo(qty * price);

    return {
      productId: p.productId || "",
      productTitle: title,
      productName: title,
      title,
      productCode: sku,
      sku,
      image: img,
      productImage: img,
      quantity: qty,
      qty,
      unitPrice: price,
      price,
      subtotal,
      total: subtotal,
      size: p.size || null,
      product: {
        id: p.productId || "",
        title,
        productCode: sku,
        thumbnailImage: img,
      },
    };
  });

  const customerName = invoice.customerName || "Customer";
  const customerPhone = invoice.customerPhone || "";
  const customerEmail = invoice.customerEmail || "";
  const customerRole = resolveCustomerRole(order, (invoice as any).customerRole);
  const shippingAddress = invoice.shippingAddress || "";
  const district = invoice.shippingDistrict || "";
  const division = invoice.shippingDivision || "";

  // Live values from Order (never return stale invoice fields)
  const paymentStatus = order?.payment?.status || (order?.status === "DELIVERED" ? "PAID" : invoice.paymentStatus);
  const orderStatus = order?.status || invoice.orderStatus;
  const paymentMethod = order?.paymentMethod || order?.payment?.method || invoice.paymentMethod;
  const grandTotal = order?.payableAmount ?? invoice.grandTotal;
  const deliveryCharge = order?.deliveryCharge ?? invoice.deliveryCharge;
  const discount = order?.discountAmount ?? invoice.discount;
  const subtotal = order?.subtotal ?? invoice.subtotal;

  const isAdminViewer = viewerRole === "ADMIN" || viewerRole === "SUPER_ADMIN";

  return {
    invoiceNo: invoice.invoiceNumber,
    invoiceNumber: invoice.invoiceNumber,
    invoiceDate: invoice.invoiceDate.toISOString(),
    orderNumber: invoice.orderNumber,
    orderCode: invoice.orderNumber,
    orderDate: invoice.orderDate.toISOString().split("T")[0],
    paymentMethod,
    paymentStatus,
    orderStatus,
    deliveryStatus: orderStatus,
    verificationToken: invoice.verificationToken,
    verificationUrl,

    customerName,
    customerPhone,
    customerEmail,
    customerRole,
    role: customerRole,
    phone: customerPhone,
    email: customerEmail,

    shippingAddress,
    address: shippingAddress,
    district,
    division,
    shippingType: invoice.shippingType || "Standard Delivery",
    shippingArea: invoice.shippingArea || "INSIDE_DHAKA",

    customer: {
      name: customerName,
      fullName: customerName,
      phone: customerPhone,
      email: customerEmail,
      role: customerRole,
      customerRole,
      customerName,
      customerPhone,
      customerEmail,
      shippingAddress,
      district,
      division,
      areaType: (invoice.shippingArea === "INSIDE_DHAKA" ? "Inside Dhaka" : invoice.shippingArea || "Inside Dhaka"),
    },
    shipping: {
      address: shippingAddress,
      fullAddress: shippingAddress,
      district,
      division,
      areaType: (invoice.shippingArea === "INSIDE_DHAKA" ? "Inside Dhaka" : invoice.shippingArea || "Inside Dhaka"),
      shippingType: invoice.shippingType || "Standard Delivery",
      shippingArea: invoice.shippingArea || "INSIDE_DHAKA",
    },
    items: mappedProducts,
    products: mappedProducts,
    productsJson: mappedProducts,

    subtotal,
    discount,
    deliveryCharge,
    grandTotal,
    ...(isAdminViewer ? {
      productCost: invoice.productCost,
      courierCost: invoice.courierCost,
      courierProfit: invoice.courierProfit,
      netProfit: invoice.netProfit,
    } : {
      productCost: null,
      courierCost: null,
      courierProfit: null,
      netProfit: null,
    }),
  };
};

export const createOrGetInvoice = async (
  orderIdOrCode: string,
  currentUser?: { id: string; role: string }
): Promise<FullInvoiceView> => {
  const viewerRole = currentUser?.role;

  // 1. Return existing invoice if already generated (repairing productsJson if empty)
  let existingInvoice = await prismaClient.invoice.findFirst({
    where: {
      OR: [
        { id: orderIdOrCode },
        { orderId: orderIdOrCode },
        { orderNumber: orderIdOrCode },
        { invoiceNumber: orderIdOrCode },
      ],
    },
  });

  if (existingInvoice) {
    const liveOrder = await prismaClient.order.findUnique({
      where: { id: existingInvoice.orderId },
      include: {
        payment: { select: { method: true, status: true } },
        items: { include: { product: true } },
        user: { select: { role: true } },
      },
    });

    if (currentUser && viewerRole !== "ADMIN" && viewerRole !== "SUPER_ADMIN") {
      if (!liveOrder || liveOrder.userId !== currentUser.id) {
        throw new AppError(403, "You do not have permission to view this invoice");
      }
    }

    const jsonItems = (existingInvoice.productsJson as unknown as InvoiceProductSnapshot[]) || [];
    let repairedJson: InvoiceProductSnapshot[] | undefined = undefined;

    if ((!jsonItems || jsonItems.length === 0) && liveOrder && liveOrder.items && liveOrder.items.length > 0) {
      repairedJson = liveOrder.items.map((item) => {
        const img = item.product?.thumbnailImage || (item.product?.productImages && item.product.productImages[0]) || null;
        return {
          productId: item.productId,
          productName: item.product?.title || "Product",
          productImage: img,
          image: img,
          sku: item.productCode || item.product?.productCode || "",
          size: item.size || null,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          subtotal: roundToTwo(item.quantity * item.unitPrice),
          title: item.product?.title || "Product",
        };
      });
    }

    if (liveOrder) {
      const livePaymentStatus = liveOrder.payment?.status || (liveOrder.status === "DELIVERED" ? "PAID" : existingInvoice.paymentStatus);
      const resolvedCustomerRole = resolveCustomerRole(liveOrder, (existingInvoice as any).customerRole);
      existingInvoice = await prismaClient.invoice.update({
        where: { id: existingInvoice.id },
        data: {
          paymentStatus: livePaymentStatus,
          orderStatus: liveOrder.status,
          grandTotal: liveOrder.payableAmount,
          deliveryCharge: liveOrder.deliveryCharge,
          discount: liveOrder.discountAmount,
          subtotal: liveOrder.subtotal,
          customerRole: resolvedCustomerRole,
          ...(repairedJson ? { productsJson: repairedJson as unknown as Prisma.InputJsonValue } : {}),
        },
      });
    }

    return mapFullInvoice(existingInvoice, liveOrder, viewerRole);
  }

  // 2. Fetch order to create invoice
  const order = await prismaClient.order.findFirst({
    where: {
      OR: [
        { id: orderIdOrCode },
        { orderCode: orderIdOrCode },
      ],
    },
    include: {
      items: {
        select: {
          id: true,
          productId: true,
          productCode: true,
          quantity: true,
          size: true,
          unitPrice: true,
          purchaseCost: true,
          totalPrice: true,
          product: {
            select: {
              id: true,
              title: true,
              costPrice: true,
              productCode: true,
              thumbnailImage: true,
              productImages: true,
            },
          },
        },
      },
      payment: { select: { method: true, status: true } },
      user: { select: { role: true } },
    },
  });

  if (!order) {
    throw new AppError(404, "Order not found");
  }

  if (currentUser && viewerRole !== "ADMIN" && viewerRole !== "SUPER_ADMIN") {
    if (order.userId !== currentUser.id) {
      throw new AppError(403, "You do not have permission to view this invoice");
    }
  }

  if (order.status !== "DELIVERED") {
    throw new AppError(400, "Order is not eligible for invoice. Only DELIVERED orders can generate invoices.");
  }

  // 3. Generate deterministic unique invoice number and secure token
  const invoiceNumber = order.orderCode.startsWith("ORD-")
    ? order.orderCode.replace(/^ORD-/, "INV-")
    : `INV-${order.orderCode}`;

  const verificationToken = crypto.randomBytes(24).toString("hex");

  // 4. Accounting field snapshot calculations
  let productCost = order.productCost;
  if (productCost === null || productCost === undefined) {
    productCost = roundToTwo(
      order.items.reduce((sum, item) => {
        const itemCost = (item.purchaseCost && item.purchaseCost > 0)
          ? item.purchaseCost
          : (item.product?.costPrice ?? 0);
        return sum + (itemCost * item.quantity);
      }, 0)
    );
  }

  const courierCost = order.courierServiceCost ?? 0;
  const courierProfit = order.deliveryProfit ?? roundToTwo((order.deliveryCharge ?? 0) - courierCost);
  const netProfit = order.netProfit ?? roundToTwo(order.payableAmount - productCost - courierCost);

  const customerName = order.customerName || order.guestName || "Customer";
  const customerPhone = order.customerPhone || order.guestPhone || "";
  const customerEmail = order.customerEmail || order.guestEmail || order.userEmail || "";

  const shippingAddress = order.address || order.guestAddress || "";
  const shippingDistrict = order.guestDistrict || "";
  const shippingDivision = order.guestDivision || "";
  const shippingType = order.shippingType || "";
  const shippingArea = order.deliveryArea || "";

  const productsJson: InvoiceProductSnapshot[] = order.items.map((item) => {
    const img = item.product?.thumbnailImage || (item.product?.productImages && item.product.productImages[0]) || null;
    return {
      productId: item.productId,
      productName: item.product?.title || "Product",
      productImage: img,
      image: img,
      sku: item.productCode || item.product?.productCode || "",
      size: item.size || null,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      subtotal: roundToTwo(item.quantity * item.unitPrice),
      title: item.product?.title || "Product",
    };
  });

  const resolvedCustomerRole = resolveCustomerRole(order);

  // 5. Persist permanent invoice in DB with populated productsJson
  const createdInvoice = await prismaClient.invoice.create({
    data: {
      invoiceNumber,
      orderId: order.id,
      verificationToken,
      invoiceDate: order.deliveredAt ?? new Date(),
      orderNumber: order.orderCode,
      orderDate: order.createdAt,
      paymentMethod: order.paymentMethod ?? order.payment?.method ?? "COD",
      paymentStatus: order.payment?.status ?? "PAID",
      orderStatus: order.status,
      customerName,
      customerPhone,
      customerEmail,
      customerRole: resolvedCustomerRole,
      shippingAddress,
      shippingDistrict,
      shippingDivision,
      shippingType,
      shippingArea,
      productsJson: productsJson as unknown as Prisma.InputJsonValue,
      subtotal: order.subtotal,
      discount: order.discountAmount,
      deliveryCharge: order.deliveryCharge,
      grandTotal: order.payableAmount,
      productCost,
      courierCost,
      courierProfit,
      netProfit,
    },
  });

  return mapFullInvoice(createdInvoice, order, viewerRole);
};

export const getPublicInvoiceByToken = async (rawToken: string): Promise<PublicInvoiceVerificationView> => {
  const token = decodeURIComponent(rawToken).trim();

  // 1. Lookup invoice or order by orderCode, verificationToken, orderId, or invoiceNumber
  let invoice = await prismaClient.invoice.findFirst({
    where: {
      OR: [
        { verificationToken: token },
        { orderNumber: token },
        { invoiceNumber: token },
        { orderId: token },
      ],
    },
  });

  // 2. Fallback: If not found in Invoice table, lookup in Order table
  if (!invoice) {
    const orderRef = await prismaClient.order.findFirst({
      where: {
        OR: [
          { orderCode: token },
          { id: token },
          { orderCode: token.replace(/^INV-/, "ORD-") },
        ],
      },
      select: { id: true, status: true, orderCode: true },
    });

    if (orderRef) {
      await createOrGetInvoice(orderRef.id);
      invoice = await prismaClient.invoice.findFirst({
        where: { orderId: orderRef.id },
      });
    }
  }

  if (!invoice) {
    throw new AppError(404, "Invoice or order not found");
  }

  // 3. Delegate to createOrGetInvoice to guarantee 100% identical invoice data as Admin Print Invoice
  const fullInvoice = await createOrGetInvoice(invoice.orderId);

  const settings = await prismaClient.appSetting.findFirst({
    orderBy: { createdAt: "asc" },
  });

  const companyName = settings?.companyName || settings?.storeName || "GrowthZen Store";
  const logo = settings?.storeLogo || settings?.favicon || null;
  const website = getFrontendBaseUrl();
  const supportPhone = settings?.supportPhone || "+8801700000000";
  const supportEmail = settings?.supportEmail || "support@growthzen.com";

  const orderCode = fullInvoice.orderNumber || fullInvoice.orderCode || invoice.orderNumber;
  const publicInvoiceUrl = `${website}/invoice/${orderCode}`;
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(publicInvoiceUrl)}`;

  const totals = {
    subtotal: fullInvoice.subtotal,
    discount: fullInvoice.discount,
    deliveryCharge: fullInvoice.deliveryCharge,
    grandTotal: fullInvoice.grandTotal,
  };

  const customerRole = fullInvoice.customerRole || "CUSTOMER";

  return {
    ...fullInvoice,
    customerRole,
    userRole: customerRole,
    role: customerRole,

    // Add company & qr metadata
    companyName,
    companyLogo: logo,
    companyWebsite: website,

    customer: {
      ...fullInvoice.customer,
      role: customerRole,
      customerRole,
      userRole: customerRole,
    },

    company: {
      companyName,
      companyLogo: logo,
      companyWebsite: website,
      logo,
      website,
      supportPhone,
      supportEmail,
      name: companyName,
      phone: supportPhone,
    },

    qr: {
      verificationUrl: publicInvoiceUrl,
      qrCodeUrl,
    },

    qrCodeUrl,
    verificationUrl: publicInvoiceUrl,
    orderCode,

    invoice: {
      invoiceNumber: fullInvoice.invoiceNo,
      invoiceDate: fullInvoice.invoiceDate,
      verificationToken: fullInvoice.verificationToken,
      qrCodeUrl,
      orderId: invoice.orderId,
      orderCode,
      createdAt: fullInvoice.invoiceDate,
    },

    payment: {
      paymentMethod: fullInvoice.paymentMethod,
      paymentStatus: fullInvoice.paymentStatus,
      orderStatus: fullInvoice.orderStatus,
      method: fullInvoice.paymentMethod,
      status: fullInvoice.paymentStatus,
    },

    totals,
    pricing: totals,
    summary: totals,
  };
};

export const getAllInvoicesService = async (params: GetAllInvoicesParams): Promise<PaginatedInvoiceResponse> => {
  const page = Number(params.page) > 0 ? Number(params.page) : 1;
  const limit = Number(params.limit) > 0 ? Number(params.limit) : 10;
  const skip = (page - 1) * limit;

  const where: Prisma.InvoiceWhereInput = {};

  // Search filter across multiple fields
  if (params.search && params.search.trim()) {
    const searchTerm = params.search.trim();
    where.OR = [
      { invoiceNumber: { contains: searchTerm, mode: "insensitive" } },
      { orderNumber: { contains: searchTerm, mode: "insensitive" } },
      { customerName: { contains: searchTerm, mode: "insensitive" } },
      { customerPhone: { contains: searchTerm, mode: "insensitive" } },
    ];
  }

  // Specific field filters
  if (params.invoiceNumber && params.invoiceNumber.trim()) {
    where.invoiceNumber = { contains: params.invoiceNumber.trim(), mode: "insensitive" };
  }
  if (params.orderNumber && params.orderNumber.trim()) {
    where.orderNumber = { contains: params.orderNumber.trim(), mode: "insensitive" };
  }
  if (params.customerName && params.customerName.trim()) {
    where.customerName = { contains: params.customerName.trim(), mode: "insensitive" };
  }
  if (params.customerPhone && params.customerPhone.trim()) {
    where.customerPhone = { contains: params.customerPhone.trim(), mode: "insensitive" };
  }
  if (params.paymentStatus && params.paymentStatus.trim() && params.paymentStatus !== "ALL") {
    const paymentStatusTerm = params.paymentStatus.trim();
    where.OR = [
      { paymentStatus: { equals: paymentStatusTerm, mode: "insensitive" } },
      { order: { is: { payment: { is: { status: { equals: paymentStatusTerm as any } } } } } },
    ];
  }
  if (params.orderStatus && params.orderStatus.trim() && params.orderStatus !== "ALL") {
    const orderStatusTerm = params.orderStatus.trim();
    where.OR = [
      { orderStatus: { equals: orderStatusTerm, mode: "insensitive" } },
      { order: { is: { status: { equals: orderStatusTerm as any } } } },
    ];
  }

  // Date Filter Logic
  const now = new Date();
  if (params.dateFilter) {
    let startDate: Date | undefined;
    let endDate: Date | undefined;

    if (params.dateFilter === "today") {
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    } else if (params.dateFilter === "yesterday") {
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      startDate = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 0, 0, 0, 0);
      endDate = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 23, 59, 59, 999);
    } else if (params.dateFilter === "last7days" || (params.dateFilter as string) === "last_7_days") {
      startDate = new Date(now);
      startDate.setDate(startDate.getDate() - 7);
      startDate.setHours(0, 0, 0, 0);
      endDate = now;
    } else if (params.dateFilter === "last30days" || (params.dateFilter as string) === "last_30_days") {
      startDate = new Date(now);
      startDate.setDate(startDate.getDate() - 30);
      startDate.setHours(0, 0, 0, 0);
      endDate = now;
    } else if (params.dateFilter === "thisMonth" || (params.dateFilter as string) === "this_month") {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      endDate = now;
    } else if (params.dateFilter === "custom" && (params.from || params.to)) {
      if (params.from) startDate = new Date(params.from);
      if (params.to) {
        endDate = new Date(params.to);
        endDate.setHours(23, 59, 59, 999);
      }
    }

    if (startDate || endDate) {
      where.createdAt = {
        ...(startDate ? { gte: startDate } : {}),
        ...(endDate ? { lte: endDate } : {}),
      };
    }
  }

  const sortBy = params.sortBy || "createdAt";
  const sortOrder = params.sortOrder || "desc";

  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  const todayWhere: Prisma.InvoiceWhereInput = {
    ...where,
    createdAt: {
      gte: todayStart,
      lte: todayEnd,
    },
  };

  // Query records with joined Order relation
  const [invoices, total, totalAgg, todayAgg] = await Promise.all([
    prismaClient.invoice.findMany({
      where,
      skip,
      take: limit,
      orderBy: { [sortBy]: sortOrder },
      include: {
        order: {
          include: {
            payment: { select: { method: true, status: true } },
            user: { select: { role: true } },
          },
        },
      },
    }),
    prismaClient.invoice.count({ where }),
    prismaClient.invoice.aggregate({
      where,
      _sum: { grandTotal: true },
      _count: { id: true },
    }),
    prismaClient.invoice.aggregate({
      where: todayWhere,
      _sum: { grandTotal: true },
      _count: { id: true },
    }),
  ]);

  const website = getFrontendBaseUrl();

  const formattedData: AdminInvoiceListItem[] = invoices.map((inv) => {
    const publicInvoiceUrl = `${website}/invoice/${inv.orderNumber}`;
    const printInvoiceUrl = `${website}/api/v1/invoices/${inv.orderId}`;

    const livePaymentStatus = inv.order?.payment?.status || (inv.order?.status === "DELIVERED" ? "PAID" : inv.paymentStatus);
    const liveOrderStatus = inv.order?.status || inv.orderStatus;
    const liveGrandTotal = inv.order?.payableAmount ?? inv.grandTotal;
    const customerRole = resolveCustomerRole(inv.order, (inv as any).customerRole);

    return {
      id: inv.id,
      invoiceNumber: inv.invoiceNumber,
      orderId: inv.orderId,
      orderNumber: inv.orderNumber,
      customerName: inv.customerName || "Customer",
      customerPhone: inv.customerPhone || "",
      customerRole,
      userRole: customerRole,
      role: customerRole,
      customer: {
        name: inv.customerName || "Customer",
        phone: inv.customerPhone || "",
        email: inv.customerEmail || "",
        role: customerRole,
        customerRole,
        userRole: customerRole,
      },
      grandTotal: liveGrandTotal,
      paymentStatus: livePaymentStatus,
      orderStatus: liveOrderStatus,
      invoiceDate: inv.invoiceDate.toISOString(),
      createdAt: inv.createdAt.toISOString(),
      publicInvoiceUrl,
      printInvoiceUrl,
      verificationToken: inv.verificationToken,
    };
  });

  const totalSales = roundToTwo(totalAgg._sum.grandTotal ?? 0);

  const summaryStats: InvoiceSummaryStats = {
    totalInvoices: totalAgg._count.id ?? 0,
    totalSales,
    totalGrandTotal: totalSales,
    todayInvoices: todayAgg._count.id ?? 0,
    todayGrandTotal: roundToTwo(todayAgg._sum.grandTotal ?? 0),
  };

  return {
    summaryStats,
    meta: {
      page,
      limit,
      total,
      totalPage: Math.ceil(total / limit) || 1,
    },
    data: formattedData,
  };
};

export const getMyInvoicesService = async (currentUser: { id: string; role: string; email?: string }) => {
  // Generate invoice records for any delivered orders that don't have one yet
  const deliveredOrdersWithoutInvoice = await prismaClient.order.findMany({
    where: {
      userId: currentUser.id,
      status: "DELIVERED",
      invoice: { is: null },
    },
    select: { id: true },
  });

  for (const ord of deliveredOrdersWithoutInvoice) {
    try {
      await createOrGetInvoice(ord.id, currentUser);
    } catch {
      // Ignore individual generation errors
    }
  }

  const invoices = await prismaClient.invoice.findMany({
    where: {
      order: {
        userId: currentUser.id,
      },
    },
    orderBy: { createdAt: "desc" },
    include: {
      order: {
        include: {
          payment: { select: { method: true, status: true } },
          user: { select: { role: true } },
        },
      },
    },
  });

  return invoices.map((inv) => {
    const orderCode = inv.orderNumber || inv.order?.orderCode || "";
    const publicInvoiceUrl = `${getFrontendBaseUrl()}/invoice/${orderCode}`;
    const printInvoiceUrl = `${getFrontendBaseUrl()}/user-dashboard/invoices/${inv.id}`;
    const customerRole = resolveCustomerRole(inv.order, (inv as any).customerRole, currentUser.role);

    return {
      id: inv.id,
      invoiceNumber: inv.invoiceNumber,
      orderId: inv.orderId,
      orderNumber: orderCode,
      customerName: inv.customerName || inv.order?.customerName || "Customer",
      customerPhone: inv.customerPhone || inv.order?.customerPhone || "",
      customerRole,
      userRole: customerRole,
      role: customerRole,
      customer: {
        name: inv.customerName || inv.order?.customerName || "Customer",
        phone: inv.customerPhone || inv.order?.customerPhone || "",
        email: inv.customerEmail || inv.order?.customerEmail || "",
        role: customerRole,
        customerRole,
        userRole: customerRole,
      },
      grandTotal: inv.grandTotal || inv.order?.payableAmount || 0,
      paymentStatus: inv.paymentStatus || inv.order?.payment?.status || "PAID",
      orderStatus: inv.orderStatus || inv.order?.status || "DELIVERED",
      invoiceDate: inv.invoiceDate.toISOString(),
      createdAt: inv.createdAt.toISOString(),
      publicInvoiceUrl,
      printInvoiceUrl,
      verificationToken: inv.verificationToken,
    };
  });
};


