import crypto from "crypto";
import prismaClient from "../../config/prisma";
import AppError from "../../utils/AppError";

const TOKEN_EXPIRY_DAYS = 30;

export const hashToken = (token: string): string => {
  return crypto.createHash("sha256").update(token).digest("hex");
};

export const generateRawToken = (): string => {
  return crypto.randomBytes(32).toString("hex");
};

/**
 * Creates or returns an existing valid ReviewToken for an order item.
 * Guarantees one token per order item.
 */
export const createOrGetReviewTokenForItem = async (data: {
  orderId: string;
  orderItemId: string;
  productId: string;
  userId?: string | null;
  customerEmail?: string | null;
}): Promise<{ rawToken: string; expiresAt: Date }> => {
  const existingToken = await prismaClient.reviewToken.findUnique({
    where: { orderItemId: data.orderItemId },
  });

  if (existingToken) {
    if (!existingToken.isUsed && existingToken.expiresAt > new Date()) {
      // Return existing valid token hash (Note: since original raw token isn't recoverable from hash, if existing hash token exists and valid, we re-issue token if needed, or if stored hash, we recreate token if expired or return new rawToken if re-generated)
      // To allow re-sending email with a valid token if requested, if existing is not used and not expired, we generate a fresh raw token and update tokenHash.
    }
  }

  const rawToken = generateRawToken();
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

  if (existingToken) {
    await prismaClient.reviewToken.update({
      where: { id: existingToken.id },
      data: {
        tokenHash,
        expiresAt,
        isUsed: false,
        usedAt: null,
      },
    });
  } else {
    await prismaClient.reviewToken.create({
      data: {
        tokenHash,
        orderId: data.orderId,
        orderItemId: data.orderItemId,
        productId: data.productId,
        userId: data.userId ?? null,
        customerEmail: data.customerEmail ?? null,
        expiresAt,
      },
    });
  }

  return { rawToken, expiresAt };
};

/**
 * Validates a raw token from email URL and returns token record with order/product info.
 */
export const validateReviewToken = async (rawToken: string) => {
  if (!rawToken || typeof rawToken !== "string") {
    throw new AppError(400, "Invalid review token format");
  }

  const tokenHash = hashToken(rawToken);

  const reviewToken = await prismaClient.reviewToken.findUnique({
    where: { tokenHash },
    include: {
      order: {
        select: {
          id: true,
          orderCode: true,
          status: true,
          customerName: true,
          customerEmail: true,
          userEmail: true,
          guestName: true,
          guestEmail: true,
        },
      },
      orderItem: {
        select: {
          id: true,
          productId: true,
          quantity: true,
          size: true,
        },
      },
      product: {
        select: {
          id: true,
          title: true,
          thumbnailImage: true,
          productCode: true,
        },
      },
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });

  if (!reviewToken) {
    throw new AppError(404, "Invalid or unrecognized review token");
  }

  if (reviewToken.isUsed) {
    throw new AppError(400, "This review link has already been used");
  }

  if (new Date() > reviewToken.expiresAt) {
    throw new AppError(400, "This review link has expired");
  }

  if (!reviewToken.order || reviewToken.order.status !== "DELIVERED") {
    throw new AppError(400, "Review is only allowed for delivered orders");
  }

  if (!reviewToken.orderItem || !reviewToken.product) {
    throw new AppError(404, "Associated product or order item no longer exists");
  }

  return reviewToken;
};
