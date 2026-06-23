import type { DeliveryArea, OrderStatus, Role } from "../../../generated/prisma/client";

export interface OrderProductInput {
  productId: string;
  quantity: number;
  size?: string | null;
}

export interface CreateOrderInput {
  products: OrderProductInput[];
  customerName: string;
  customerPhone: string;
  deliveryArea: DeliveryArea;
  address: string;
  couponCode?: string | null;
}

export interface CreateOrderRequestUser {
  id: string;
  role: Role;
}

export interface UpdateOrderStatusInput {
  status: Exclude<OrderStatus, "PENDING">;
}

export interface OrderItemView {
  id: string;
  productId: string;
  quantity: number;
  size: string | null;
  unitPrice: number;
  totalPrice: number;
}

export interface OrderView {
  id: string;
  userId: string | null;
  customerName: string;
  customerPhone: string;
  address: string;
  deliveryArea: DeliveryArea;
  subtotal: number;
  discountAmount: number;
  deliveryCharge: number;
  payableAmount: number;
  couponCode: string | null;
  status: OrderStatus;
  items: OrderItemView[];
  createdAt: Date;
  updatedAt: Date;
}

export interface OrderListMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface OrderListResponse {
  items: OrderView[];
  meta: OrderListMeta;
}

export interface OrderListQuery {
  page?: number;
  limit?: number;
  search?: string;
  status?: OrderStatus;
}