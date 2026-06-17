import type { Role } from "../../../generated/prisma/client";

export interface UserListItem {
  id: string;
  name: string;
  email: string;
  role: Role;
  isVerified: boolean;
  isActive: boolean;
  createdAt: Date;
}

export interface UpdateUserRoleInput {
  role: Role;
}