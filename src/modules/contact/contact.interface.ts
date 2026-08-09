import type { ContactMessageStatus } from "@prisma/client";

export interface ContactMessageCreateInput {
  name: string;
  email: string;
  subject?: string;
  message: string;
}

export interface ContactMessageUpdateStatusInput {
  status: ContactMessageStatus;
}

export interface GetContactMessagesQueryParams {
  page?: number | string;
  limit?: number | string;
  search?: string;
  status?: ContactMessageStatus;
  startDate?: string;
  endDate?: string;
  sortBy?: "createdAt" | "name" | "email" | "subject" | "status" | string;
  sortOrder?: "asc" | "desc";
}

export interface ContactMessageView {
  id: string;
  name: string;
  email: string;
  subject: string | null;
  message: string;
  status: ContactMessageStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface ContactMessageStats {
  totalMessages: number;
  unreadMessages: number;
  readMessages: number;
  todayMessages: number;
}

export interface PaginatedContactMessagesResponse {
  data: ContactMessageView[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPage: number;
    stats?: ContactMessageStats;
  };
}
