import type { NextFunction, Request, Response } from "express";
import AppError from "../utils/AppError";

export const errorHandler = (error: unknown, _req: Request, res: Response, _next: NextFunction): Response => {
  if (error instanceof AppError) {
    return res.status(error.statusCode).json({
      success: false,
      message: error.message,
      error: null,
    });
  }

  const message = error instanceof Error ? error.message : "Something went wrong";

  return res.status(500).json({
    success: false,
    message,
    error: null,
  });
};