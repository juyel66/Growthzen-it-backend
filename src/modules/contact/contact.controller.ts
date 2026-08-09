import type { Request, Response } from "express";
import AppError from "../../utils/AppError";
import catchAsync from "../../utils/catchAsync";
import sendResponse from "../../utils/sendResponse";
import {
  createContactMessage,
  deleteContactMessage,
  getContactMessageById,
  getContactMessages,
  getContactMessageStats,
  updateContactMessageStatus,
} from "./contact.service";

const getParamId = (value: string | string[] | undefined): string => {
  if (Array.isArray(value)) return value[0];
  return value || "";
};

export const createContactMessageHandler = catchAsync(async (req: Request, res: Response) => {
  const result = await createContactMessage(req.body);

  sendResponse(res, {
    statusCode: 201,
    message: "Your message has been submitted successfully.",
    data: result,
  });
});

export const getContactMessagesHandler = catchAsync(async (req: Request, res: Response) => {
  const result = await getContactMessages(req.query);

  sendResponse(res, {
    message: "Contact messages retrieved successfully",
    meta: result.meta,
    data: result.data,
  });
});

export const getContactMessageStatsHandler = catchAsync(async (_req: Request, res: Response) => {
  const stats = await getContactMessageStats();

  sendResponse(res, {
    message: "Contact message statistics retrieved successfully",
    data: stats,
  });
});

export const getContactMessageByIdHandler = catchAsync(async (req: Request, res: Response) => {
  const messageId = getParamId(req.params.id);

  if (!messageId) {
    throw new AppError(400, "Message ID is required");
  }

  const message = await getContactMessageById(messageId);

  sendResponse(res, {
    message: "Contact message retrieved successfully",
    data: message,
  });
});

export const updateContactMessageStatusHandler = catchAsync(async (req: Request, res: Response) => {
  const messageId = getParamId(req.params.id);

  if (!messageId) {
    throw new AppError(400, "Message ID is required");
  }

  const message = await updateContactMessageStatus(messageId, req.body.status);

  sendResponse(res, {
    message: "Contact message status updated successfully",
    data: message,
  });
});

export const deleteContactMessageHandler = catchAsync(async (req: Request, res: Response) => {
  const messageId = getParamId(req.params.id);

  if (!messageId) {
    throw new AppError(400, "Message ID is required");
  }

  await deleteContactMessage(messageId);

  sendResponse(res, {
    message: "Contact message deleted successfully",
  });
});
