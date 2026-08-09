import type { Role, User } from "@prisma/client";
import prismaClient from "../../config/prisma";
import AppError from "../../utils/AppError";
import { isProtectedSuperAdminEmail } from "../../constants/auth";
import type { UpdateUserRoleInput, UserListItem, UserStatsView } from "./users.interface";

const startOfDay = (d: Date): Date => {
  const res = new Date(d);
  res.setHours(0, 0, 0, 0);
  return res;
};

const endOfDay = (d: Date): Date => {
  const res = new Date(d);
  res.setHours(23, 59, 59, 999);
  return res;
};

export const getUserStats = async (currentUserRole: Role): Promise<UserStatsView> => {
  const now = new Date();
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);

  const isAdminOnly = currentUserRole === "ADMIN";

  const [totalUsers, totalCustomers, totalResellers, totalAdmins, totalSuperAdmins, newUsersToday] = await Promise.all([
    prismaClient.user.count({ where: isAdminOnly ? { role: { not: "SUPER_ADMIN" } } : {} }),
    prismaClient.user.count({ where: { role: "CUSTOMER" } }),
    prismaClient.user.count({ where: { role: "RESELLER" } }),
    prismaClient.user.count({ where: { role: "ADMIN" } }),
    isAdminOnly ? Promise.resolve(0) : prismaClient.user.count({ where: { role: "SUPER_ADMIN" } }),
    prismaClient.user.count({
      where: {
        ...(isAdminOnly ? { role: { not: "SUPER_ADMIN" } } : {}),
        createdAt: {
          gte: todayStart,
          lte: todayEnd,
        },
      },
    }),
  ]);

  return {
    totalUsers,
    totalCustomers,
    totalResellers,
    totalAdmins,
    totalSuperAdmins,
    newUsersToday,
  };
};

const listUserSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  isVerified: true,
  isActive: true,
  createdAt: true,
} as const;

export const getUsers = async (currentUserRole: Role): Promise<UserListItem[]> => {
  const where = currentUserRole === "ADMIN" ? { role: { not: ("SUPER_ADMIN" as Role) } } : {};

  return prismaClient.user.findMany({
    where,
    select: listUserSelect,
    orderBy: { createdAt: "desc" },
  });
};

export const getUserById = async (currentUserRole: Role, id: string): Promise<UserListItem> => {
  const user = await prismaClient.user.findUnique({
    where: { id },
    select: listUserSelect,
  });

  if (!user) {
    throw new AppError(404, "User not found");
  }

  if (currentUserRole === "ADMIN" && (user.role === "SUPER_ADMIN" || isProtectedSuperAdminEmail(user.email))) {
    throw new AppError(403, "You do not have permission to view protected Super Admin accounts");
  }

  return user;
};

export const updateUserRole = async (
  currentUserId: string,
  currentUserRole: Role,
  targetUserId: string,
  payload: UpdateUserRoleInput,
): Promise<UserListItem> => {
  if (currentUserId === targetUserId) {
    throw new AppError(403, "You cannot change your own role");
  }

  if (payload.role === ("SUPER_ADMIN" as Role)) {
    throw new AppError(400, "Cannot assign SUPER_ADMIN role");
  }

  const targetUser = await prismaClient.user.findUnique({
    where: { id: targetUserId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isVerified: true,
      isActive: true,
      createdAt: true,
    },
  });

  if (!targetUser) {
    throw new AppError(404, "User not found");
  }

  if (targetUser.role === "SUPER_ADMIN" || isProtectedSuperAdminEmail(targetUser.email)) {
    throw new AppError(403, "Protected Super Admin accounts cannot be demoted or role changed");
  }

  if (currentUserRole !== "ADMIN" && currentUserRole !== "SUPER_ADMIN") {
    throw new AppError(403, "You do not have permission to access User Management");
  }

  const updatedUser = await prismaClient.user.update({
    where: { id: targetUserId },
    data: { role: payload.role },
    select: listUserSelect,
  });

  return updatedUser;
};

export const deleteUser = async (currentUserId: string, currentUserRole: Role, targetUserId: string): Promise<void> => {
  if (currentUserId === targetUserId) {
    throw new AppError(403, "You cannot delete your own account");
  }

  if (currentUserRole !== "ADMIN" && currentUserRole !== "SUPER_ADMIN") {
    throw new AppError(403, "You do not have permission to access User Management");
  }

  const targetUser = await prismaClient.user.findUnique({
    where: { id: targetUserId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
    },
  });

  if (!targetUser) {
    throw new AppError(404, "User not found");
  }

  if (targetUser.role === "SUPER_ADMIN" || isProtectedSuperAdminEmail(targetUser.email)) {
    throw new AppError(403, "Protected Super Admin accounts cannot be deleted");
  }

  await prismaClient.user.delete({
    where: { id: targetUserId },
  });
};