import type { Prisma, ContactMessageStatus } from "@prisma/client";
import prismaClient from "../../config/prisma";
import AppError from "../../utils/AppError";
import type {
  ContactMessageCreateInput,
  ContactMessageStats,
  ContactMessageView,
  GetContactMessagesQueryParams,
  PaginatedContactMessagesResponse,
} from "./contact.interface";

const mapContactMessage = (msg: Prisma.ContactMessageGetPayload<Record<string, never>>): ContactMessageView => ({
  id: msg.id,
  name: msg.name,
  email: msg.email,
  subject: msg.subject,
  message: msg.message,
  status: msg.status,
  createdAt: msg.createdAt,
  updatedAt: msg.updatedAt,
});

export const createContactMessage = async (payload: ContactMessageCreateInput): Promise<ContactMessageView> => {
  const message = await prismaClient.contactMessage.create({
    data: {
      name: payload.name.trim(),
      email: payload.email.trim().toLowerCase(),
      subject: payload.subject ? payload.subject.trim() : null,
      message: payload.message.trim(),
      status: "UNREAD",
    },
  });

  return mapContactMessage(message);
};

export const getContactMessageStats = async (): Promise<ContactMessageStats> => {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const [totalMessages, unreadMessages, readMessages, todayMessages] = await Promise.all([
    prismaClient.contactMessage.count(),
    prismaClient.contactMessage.count({ where: { status: "UNREAD" } }),
    prismaClient.contactMessage.count({ where: { status: "READ" } }),
    prismaClient.contactMessage.count({ where: { createdAt: { gte: startOfToday } } }),
  ]);

  return {
    totalMessages,
    unreadMessages,
    readMessages,
    todayMessages,
  };
};

export const getContactMessages = async (
  params?: GetContactMessagesQueryParams
): Promise<PaginatedContactMessagesResponse> => {
  const page = Math.max(1, Number(params?.page) || 1);
  const limit = Math.max(1, Math.min(100, Number(params?.limit) || 20));
  const skip = (page - 1) * limit;

  const where: Prisma.ContactMessageWhereInput = {};

  if (params?.status) {
    where.status = params.status;
  }

  if (params?.search && params.search.trim()) {
    const term = params.search.trim();
    where.OR = [
      { name: { contains: term, mode: "insensitive" } },
      { email: { contains: term, mode: "insensitive" } },
      { subject: { contains: term, mode: "insensitive" } },
      { message: { contains: term, mode: "insensitive" } },
    ];
  }

  if (params?.startDate || params?.endDate) {
    where.createdAt = {
      ...(params.startDate ? { gte: new Date(params.startDate) } : {}),
      ...(params.endDate ? { lte: new Date(params.endDate) } : {}),
    };
  }

  const sortOrder: Prisma.SortOrder = params?.sortOrder === "asc" ? "asc" : "desc";
  const sortBy = params?.sortBy?.toLowerCase();

  let orderBy: Prisma.ContactMessageOrderByWithRelationInput[] = [{ createdAt: "desc" }];
  if (sortBy === "name") {
    orderBy = [{ name: sortOrder }];
  } else if (sortBy === "email") {
    orderBy = [{ email: sortOrder }];
  } else if (sortBy === "subject") {
    orderBy = [{ subject: sortOrder }];
  } else if (sortBy === "status") {
    orderBy = [{ status: sortOrder }];
  }

  const [messages, total, stats] = await Promise.all([
    prismaClient.contactMessage.findMany({
      where,
      orderBy,
      skip,
      take: limit,
    }),
    prismaClient.contactMessage.count({ where }),
    getContactMessageStats(),
  ]);

  return {
    data: messages.map(mapContactMessage),
    meta: {
      page,
      limit,
      total,
      totalPage: Math.ceil(total / limit) || 1,
      stats,
    },
  };
};

export const getContactMessageById = async (id: string): Promise<ContactMessageView> => {
  let message = await prismaClient.contactMessage.findUnique({
    where: { id },
  });

  if (!message) {
    throw new AppError(404, "Contact message not found");
  }

  if (message.status === "UNREAD") {
    message = await prismaClient.contactMessage.update({
      where: { id },
      data: { status: "READ" },
    });
  }

  return mapContactMessage(message);
};

export const updateContactMessageStatus = async (
  id: string,
  status: ContactMessageStatus
): Promise<ContactMessageView> => {
  const existing = await prismaClient.contactMessage.findUnique({
    where: { id },
    select: { id: true },
  });

  if (!existing) {
    throw new AppError(404, "Contact message not found");
  }

  const updated = await prismaClient.contactMessage.update({
    where: { id },
    data: { status },
  });

  return mapContactMessage(updated);
};

export const deleteContactMessage = async (id: string): Promise<void> => {
  const existing = await prismaClient.contactMessage.findUnique({
    where: { id },
    select: { id: true },
  });

  if (!existing) {
    throw new AppError(404, "Contact message not found");
  }

  await prismaClient.contactMessage.delete({
    where: { id },
  });
};
