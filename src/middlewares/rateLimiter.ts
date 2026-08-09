import type { Request, Response, NextFunction } from "express";
import AppError from "../utils/AppError";

interface RateLimiterOptions {
  windowMs: number;
  max: number;
  message?: string;
}

interface RequestLog {
  count: number;
  resetTime: number;
}

export const createSimpleRateLimiter = (options: RateLimiterOptions) => {
  const { windowMs, max, message = "Too many requests. Please try again later." } = options;
  const ipMap = new Map<string, RequestLog>();

  // Periodically clean up expired IP entries every 10 minutes
  setInterval(() => {
    const now = Date.now();
    for (const [ip, log] of ipMap.entries()) {
      if (now > log.resetTime) {
        ipMap.delete(ip);
      }
    }
  }, 10 * 60 * 1000).unref?.();

  return (req: Request, _res: Response, next: NextFunction): void => {
    const ip = req.ip || req.socket.remoteAddress || "unknown-ip";
    const now = Date.now();

    let record = ipMap.get(ip);
    if (!record || now > record.resetTime) {
      record = {
        count: 1,
        resetTime: now + windowMs,
      };
      ipMap.set(ip, record);
      return next();
    }

    if (record.count >= max) {
      return next(new AppError(429, message));
    }

    record.count += 1;
    next();
  };
};
