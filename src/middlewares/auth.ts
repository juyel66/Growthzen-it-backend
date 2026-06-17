import type { NextFunction, Request, Response } from "express";
import type { Role } from "../../generated/prisma/client";
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

export const authorizeRoles = (...allowedRoles: Role[]) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      const userRole = req.user?.role;

      if (!userRole || !allowedRoles.includes(userRole)) {
        throw new AppError(403, "You do not have permission to access this resource");
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};