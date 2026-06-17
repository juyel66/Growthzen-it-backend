import bcrypt from "bcryptjs";
import type { User } from "../../../generated/prisma/client";
import prismaClient from "../../config/prisma";
import { compareValue, hashValue } from "../../utils/password";
import AppError from "../../utils/AppError";
import { generateOtpCode, getOtpExpiryDate } from "../../utils/otp";
import sendEmail from "../../helpers/email";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "../../utils/jwt";
import type {
  AuthResult,
  ChangePasswordInput,
  EmailOnlyInput,
  JwtUserPayload,
  LoginInput,
  RegisterInput,
  ResetPasswordInput,
  SafeUser,
  VerifyOtpInput,
} from "./auth.interface";

const userSelect = {
  id: true,
  name: true,
  email: true,
  password: true,
  role: true,
  isVerified: true,
  isActive: true,
  refreshTokenHash: true,
  otpCodeHash: true,
  otpExpiresAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

const sanitizeUser = (user: User): SafeUser => ({
  id: user.id,
  name: user.name,
  email: user.email,
  role: user.role,
  isVerified: user.isVerified,
  isActive: user.isActive,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

const buildTokenPayload = (user: Pick<User, "id" | "name" | "email" | "role">): JwtUserPayload => ({
  id: user.id,
  name: user.name,
  email: user.email,
  role: user.role,
});

const createTokenPair = (user: Pick<User, "id" | "name" | "email" | "role">): AuthResult => {
  const payload = buildTokenPayload(user);

  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      isVerified: true,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    accessToken: signAccessToken(payload),
    refreshToken: signRefreshToken(payload),
  };
};

const ensureUserIsActive = (user: User): void => {
  if (!user.isActive) {
    throw new AppError(403, "Your account is inactive");
  }
};

export const register = async (payload: RegisterInput): Promise<AuthResult> => {
  const existingUser = await prismaClient.user.findUnique({
    where: { email: payload.email },
  });

  if (existingUser) {
    throw new AppError(409, "User already exists with this email");
  }

  const hashedPassword = await hashValue(payload.password);

  const createdUser = await prismaClient.user.create({
    data: {
      name: payload.name,
      email: payload.email,
      password: hashedPassword,
      role: "CUSTOMER",
      isVerified: false,
    },
    select: userSelect,
  });

  return {
    user: sanitizeUser(createdUser as User),
  };
};

export const login = async (payload: LoginInput): Promise<AuthResult> => {
  const user = await prismaClient.user.findUnique({
    where: { email: payload.email },
    select: userSelect,
  });

  if (!user) {
    throw new AppError(404, "User not found");
  }

  ensureUserIsActive(user as User);

  const isPasswordValid = await compareValue(payload.password, user.password);

  if (!isPasswordValid) {
    throw new AppError(401, "Invalid email or password");
  }

  const tokenPair = createTokenPair(user as Pick<User, "id" | "name" | "email" | "role">);
  const refreshTokenHash = await bcrypt.hash(tokenPair.refreshToken ?? "", 10);

  await prismaClient.user.update({
    where: { id: user.id },
    data: { refreshTokenHash },
  });

  return {
    user: sanitizeUser(user as User),
    accessToken: tokenPair.accessToken,
    refreshToken: tokenPair.refreshToken,
  };
};

export const getMyProfile = async (userId: string): Promise<SafeUser> => {
  const user = await prismaClient.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isVerified: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!user) {
    throw new AppError(404, "User not found");
  }

  return user;
};

export const logout = async (userId: string): Promise<void> => {
  await prismaClient.user.update({
    where: { id: userId },
    data: { refreshTokenHash: null },
  });
};

export const forgotPassword = async (payload: EmailOnlyInput): Promise<void> => {
  const user = await prismaClient.user.findUnique({
    where: { email: payload.email },
  });

  if (!user) {
    throw new AppError(404, "User not found");
  }

  const otpCode = generateOtpCode();
  const otpCodeHash = await hashValue(otpCode);
  const otpExpiresAt = getOtpExpiryDate();

  await prismaClient.user.update({
    where: { id: user.id },
    data: {
      otpCodeHash,
      otpExpiresAt,
    },
  });

  await sendEmail({
    to: user.email,
    subject: "Your password reset code",
    text: `Your password reset code is ${otpCode}. It will expire in 10 minutes.`,
  });
};

const verifyOtpForUser = async (payload: VerifyOtpInput): Promise<User> => {
  const user = await prismaClient.user.findUnique({
    where: { email: payload.email },
    select: userSelect,
  });

  if (!user) {
    throw new AppError(404, "User not found");
  }

  if (!user.otpCodeHash || !user.otpExpiresAt) {
    throw new AppError(400, "OTP has not been generated");
  }

  if (user.otpExpiresAt.getTime() < Date.now()) {
    throw new AppError(400, "OTP has expired");
  }

  const isOtpValid = await compareValue(payload.otp, user.otpCodeHash);

  if (!isOtpValid) {
    throw new AppError(400, "Invalid OTP");
  }

  return user as User;
};

export const verifyOtp = async (payload: VerifyOtpInput): Promise<void> => {
  await verifyOtpForUser(payload);
};

export const resetPassword = async (payload: ResetPasswordInput): Promise<void> => {
  const user = await verifyOtpForUser(payload);
  const hashedPassword = await hashValue(payload.newPassword);

  await prismaClient.user.update({
    where: { id: user.id },
    data: {
      password: hashedPassword,
      refreshTokenHash: null,
      otpCodeHash: null,
      otpExpiresAt: null,
    },
  });
};

export const refreshToken = async (token: string): Promise<AuthResult> => {
  const payload = verifyRefreshToken(token);

  const user = await prismaClient.user.findUnique({
    where: { id: payload.id },
    select: userSelect,
  });

  if (!user) {
    throw new AppError(404, "User not found");
  }

  ensureUserIsActive(user as User);

  if (!user.refreshTokenHash) {
    throw new AppError(401, "Refresh token is not valid");
  }

  const isRefreshTokenValid = await bcrypt.compare(token, user.refreshTokenHash);

  if (!isRefreshTokenValid) {
    throw new AppError(401, "Refresh token is not valid");
  }

  const tokenPair = createTokenPair(user as Pick<User, "id" | "name" | "email" | "role">);
  const refreshTokenHash = await bcrypt.hash(tokenPair.refreshToken ?? "", 10);

  await prismaClient.user.update({
    where: { id: user.id },
    data: { refreshTokenHash },
  });

  return {
    user: sanitizeUser(user as User),
    accessToken: tokenPair.accessToken,
    refreshToken: tokenPair.refreshToken,
  };
};

export const changePassword = async (userId: string, payload: ChangePasswordInput): Promise<void> => {
  const user = await prismaClient.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new AppError(404, "User not found");
  }

  const isCurrentPasswordValid = await compareValue(payload.currentPassword, user.password);

  if (!isCurrentPasswordValid) {
    throw new AppError(401, "Current password is incorrect");
  }

  const hashedPassword = await hashValue(payload.newPassword);

  await prismaClient.user.update({
    where: { id: user.id },
    data: {
      password: hashedPassword,
      refreshTokenHash: null,
    },
  });
};