import type { NextFunction, Request, Response } from "express";
import type { Role } from "@prisma/client";
import AppError from "../utils/AppError";
import { verifyAccessToken } from "../utils/jwt";

const getTokenFromHeader = (authorizationHeader: string | undefined): string => {
  if (!authorizationHeader) {
    throw new AppError(401, "You are not authenticated");
  }

  const [scheme, token] = authorizationHeader.split(" ");

  if (scheme !== "Bearer" || !token) {
    throw new AppError(401, "Invalid authorization token");
  }

  return token;
};

export const authenticate = (req: Request, _res: Response, next: NextFunction): void => {
  try {
    const token = getTokenFromHeader(req.headers.authorization);
    const decoded = verifyAccessToken(token);

    req.user = {
      id: decoded.id,
      name: decoded.name,
      email: decoded.email,
      role: decoded.role,
    };

    next();
  } catch (error) {
    next(error);
  }
};

export const authorizeRoles = (...args: (Role | string)[]) => {
  const knownRoles = new Set(["SUPER_ADMIN", "ADMIN", "RESELLER", "CUSTOMER"]);
  let customErrorMessage = "You do not have permission to access this resource";
  const allowed: string[] = [];

  for (const arg of args) {
    const str = String(arg).toUpperCase().trim();
    if (knownRoles.has(str)) {
      allowed.push(str);
    } else if (typeof arg === "string" && arg.trim().length > 0) {
      customErrorMessage = arg;
    }
  }

  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      const userRole = req.user?.role;

      if (!userRole || !allowed.includes(String(userRole).toUpperCase().trim())) {
        throw new AppError(403, customErrorMessage);
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

export const optionalAuthenticate = (req: Request, _res: Response, next: NextFunction): void => {
  const authorizationHeader = req.headers.authorization;

  if (!authorizationHeader) {
    next();
    return;
  }

  try {
    const token = getTokenFromHeader(authorizationHeader);
    const decoded = verifyAccessToken(token);

    req.user = {
      id: decoded.id,
      name: decoded.name,
      email: decoded.email,
      role: decoded.role,
    };

    next();
  } catch (error) {
    // Public routes should still work when an access token is missing, invalid, or expired.
    next();
  }
};