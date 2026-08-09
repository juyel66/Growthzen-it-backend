export const ACCESS_TOKEN_EXPIRES_IN = "7d";
export const REFRESH_TOKEN_EXPIRES_IN = "30d";
export const OTP_EXPIRES_MINUTES = 10;
export const PASSWORD_SALT_ROUNDS = 10;
export const OTP_LENGTH = 6;
export const SUPER_ADMIN_EMAIL = "mdjuyelrana.com.bd1@gmail.com";

export const PROTECTED_SUPER_ADMIN_EMAILS: readonly string[] = [
  "mdjuyelrana.com.bd1@gmail.com",
  "mohammadjuyelranabd@gmail.com",
  "mdjuyelrana99730@gmail.com",
  "mdjuyelrana294922@gmail.com",
];

export const isProtectedSuperAdminEmail = (email: string | null | undefined): boolean => {
  if (!email) return false;
  const normalized = email.trim().toLowerCase();
  return PROTECTED_SUPER_ADMIN_EMAILS.some((e) => e.toLowerCase() === normalized);
};