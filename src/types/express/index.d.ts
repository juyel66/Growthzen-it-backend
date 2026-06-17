import type { Role } from "../../../generated/prisma/client";

declare module "express-serve-static-core" {
  interface Request {
    user?: {
      id: string;
      name: string;
      email: string;
      role: Role;
    };
  }
}

export {};