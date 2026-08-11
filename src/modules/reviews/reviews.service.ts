import type { ReviewSource, ReviewStatus, Prisma } from "@prisma/client";
import prismaClient from "../../config/prisma";
import AppError from "../../utils/AppError";
import { formatPublicUrl, formatPublicUrlArray } from "../../utils/imageUrl";
import type {
  CreateReviewInput,
  CreatePublicReviewInput,
  SubmitVerifiedReviewInput,
  VerifyTokenResponse,
  ProductReviewStats,
  PublicReviewView,
  AdminReviewView,
  AdminReviewFilterQuery,
  AdminUpdateReviewInput,
  ReviewProductView,
} from "./reviews.interface";
import { validateReviewToken } from "./reviews.token";

const mapReviewProducts = (r: any): ReviewProductView[] => {
  if (Array.isArray(r.products) && r.products.length > 0) {
    return r.products
      .filter((p: any) => p && p.product)
      .map((p: any) => ({
        id: p.product.id,
        name: p.product.title,
        title: p.product.title,
        sku: p.product.productCode,
        productCode: p.product.productCode,
        slug: p.product.slug,
        image: formatPublicUrl(p.product.thumbnailImage),
        thumbnailImage: formatPublicUrl(p.product.thumbnailImage),
        status: p.product.status,
      }));
  }
  if (r.product) {
    return [
      {
        id: r.product.id,
        name: r.product.title,
        title: r.product.title,
        sku: r.product.productCode,
        productCode: r.product.productCode,
        slug: r.product.slug,
        image: formatPublicUrl(r.product.thumbnailImage),
        thumbnailImage: formatPublicUrl(r.product.thumbnailImage),
        status: r.product.status,
      },
    ];
  }
  return [];
};

export const createReview = async (userId: string, payload: CreateReviewInput) => {
  const { orderItemId, rating, title, comment, images } = payload;

  const orderItem = await prismaClient.orderItem.findUnique({
    where: { id: orderItemId },
    include: {
      order: true,
      product: true,
      review: true,
    },
  });

  if (!orderItem) {
    throw new AppError(404, "Order item not found");
  }

  const order = orderItem.order;

  if (!order) {
    throw new AppError(404, "Order not found for this item");
  }

  if (order.userId !== userId) {
    throw new AppError(403, "You can only review products you purchased");
  }

  if (order.status !== "DELIVERED") {
    throw new AppError(400, "Order is not delivered yet");
  }

  if (orderItem.review) {
    throw new AppError(400, "This order item already has a review");
  }

  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw new AppError(400, "Rating must be an integer between 1 and 5");
  }

  const user = await prismaClient.user.findUnique({ where: { id: userId } });

  const targetProductIds = Array.from(
    new Set(
      Array.isArray(payload.productIds) && payload.productIds.length > 0
        ? payload.productIds
        : [orderItem.productId]
    )
  );

  const next = await prismaClient.review.create({
    data: {
      productId: targetProductIds[0] ?? orderItem.productId,
      orderId: order.id,
      orderItemId: orderItem.id,
      userId,
      reviewerName: user?.name || order.customerName || "Customer",
      reviewerEmail: user?.email || order.customerEmail || order.userEmail || null,
      rating,
      title: title ?? null,
      comment: comment ?? null,
      images: images ?? [],
      source: "VERIFIED_PURCHASE",
      isVerifiedPurchase: true,
      status: "PUBLISHED",
      products: {
        create: targetProductIds.map((pId) => ({
          productId: pId,
        })),
      },
    },
    include: {
      products: { include: { product: true } },
    },
  });

  return next;
};

export const createPublicReview = async (payload: CreatePublicReviewInput) => {
  const { productId, productIds, reviewerName, reviewerEmail, rating, title, comment } = payload;

  const targetProductIds = Array.from(
    new Set(
      Array.isArray(productIds) && productIds.length > 0
        ? productIds
        : productId
        ? [productId]
        : []
    )
  );

  if (targetProductIds.length === 0) {
    throw new AppError(400, "At least one product must be specified for public review");
  }

  // Validate existence of all target products
  const products = await prismaClient.product.findMany({
    where: { id: { in: targetProductIds } },
  });

  if (products.length !== targetProductIds.length) {
    throw new AppError(404, "One or more target products were not found");
  }

  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw new AppError(400, "Rating must be an integer between 1 and 5");
  }

  // Basic abuse / duplicate spam check (within 5 minutes)
  const recentCutoff = new Date(Date.now() - 5 * 60 * 1000);
  const duplicate = await prismaClient.review.findFirst({
    where: {
      products: { some: { productId: targetProductIds[0] } },
      reviewerName,
      comment,
      createdAt: { gte: recentCutoff },
    },
  });

  if (duplicate) {
    throw new AppError(429, "Duplicate review submission detected. Please wait before submitting again.");
  }

  const newReview = await prismaClient.review.create({
    data: {
      productId: targetProductIds[0],
      reviewerName: reviewerName.trim(),
      reviewerEmail: reviewerEmail?.trim() || null,
      rating,
      title: title?.trim() || null,
      comment: comment.trim(),
      source: "PUBLIC",
      isVerifiedPurchase: false,
      status: "PENDING",
      products: {
        create: targetProductIds.map((pId) => ({
          productId: pId,
        })),
      },
    },
    include: {
      products: { include: { product: true } },
    },
  });

  return newReview;
};

export const getVerifyTokenInfo = async (rawToken: string): Promise<VerifyTokenResponse> => {
  const tokenRecord = await validateReviewToken(rawToken);

  return {
    valid: true,
    productId: tokenRecord.productId,
    productName: tokenRecord.product.title,
    productImage: formatPublicUrl(tokenRecord.product.thumbnailImage),
    reviewerName: tokenRecord.user?.name || tokenRecord.order.customerName || tokenRecord.order.guestName || null,
    tokenExpiry: tokenRecord.expiresAt,
    alreadyReviewed: tokenRecord.isUsed,
  };
};

export const submitVerifiedReview = async (rawToken: string, payload: SubmitVerifiedReviewInput) => {
  const tokenRecord = await validateReviewToken(rawToken);

  const { rating, title, comment, reviewerName, reviewerEmail } = payload;

  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw new AppError(400, "Rating must be an integer between 1 and 5");
  }

  // Check if review already exists for this orderItemId
  const existingReview = await prismaClient.review.findUnique({
    where: { orderItemId: tokenRecord.orderItemId },
  });

  if (existingReview) {
    throw new AppError(400, "This order item has already been reviewed");
  }

  const resolvedReviewerName = reviewerName?.trim() ||
    tokenRecord.user?.name ||
    tokenRecord.order.customerName ||
    tokenRecord.order.guestName ||
    "Verified Customer";

  const resolvedReviewerEmail = reviewerEmail?.trim() ||
    tokenRecord.user?.email ||
    tokenRecord.order.customerEmail ||
    tokenRecord.order.userEmail ||
    tokenRecord.order.guestEmail ||
    null;

  const review = await prismaClient.$transaction(async (tx) => {
    const created = await tx.review.create({
      data: {
        productId: tokenRecord.productId,
        orderId: tokenRecord.orderId,
        orderItemId: tokenRecord.orderItemId,
        userId: tokenRecord.userId ?? null,
        reviewerName: resolvedReviewerName,
        reviewerEmail: resolvedReviewerEmail,
        rating,
        title: title?.trim() || null,
        comment: comment.trim(),
        source: "VERIFIED_PURCHASE",
        isVerifiedPurchase: true,
        status: "PUBLISHED",
        products: {
          create: [{ productId: tokenRecord.productId }],
        },
      },
    });

    await tx.reviewToken.update({
      where: { id: tokenRecord.id },
      data: {
        isUsed: true,
        usedAt: new Date(),
      },
    });

    return created;
  });

  return review;
};

export const getProductReviews = async (productId: string): Promise<ProductReviewStats> => {
  const publishedStatuses: ReviewStatus[] = ["PUBLISHED", "APPROVED"];

  const whereCondition: Prisma.ReviewWhereInput = {
    status: { in: publishedStatuses },
    OR: [
      { products: { some: { productId } } },
      { productId },
    ],
  };

  const [avgResult, totalCount, five, four, three, two, one, reviews] = await Promise.all([
    prismaClient.review.aggregate({
      where: whereCondition,
      _avg: { rating: true },
    }),
    prismaClient.review.count({ where: whereCondition }),
    prismaClient.review.count({ where: { ...whereCondition, rating: 5 } }),
    prismaClient.review.count({ where: { ...whereCondition, rating: 4 } }),
    prismaClient.review.count({ where: { ...whereCondition, rating: 3 } }),
    prismaClient.review.count({ where: { ...whereCondition, rating: 2 } }),
    prismaClient.review.count({ where: { ...whereCondition, rating: 1 } }),
    prismaClient.review.findMany({
      where: whereCondition,
      orderBy: { createdAt: "desc" },
      include: {
        user: { select: { name: true } },
        products: { include: { product: true } },
        product: true,
      },
    }),
  ]);

  const averageRating = avgResult._avg.rating ? Number(avgResult._avg.rating.toFixed(2)) : 0;

  const mappedReviews: PublicReviewView[] = reviews.map((r) => ({
    id: r.id,
    reviewerName: r.reviewerName || r.user?.name || "Customer",
    rating: r.rating,
    title: r.title ?? null,
    comment: r.comment ?? null,
    isVerifiedPurchase: r.isVerifiedPurchase,
    images: formatPublicUrlArray(r.images ?? []),
    products: mapReviewProducts(r),
    createdAt: r.createdAt,
  }));

  return {
    averageRating,
    totalReviews: totalCount,
    ratingBreakdown: {
      5: five,
      4: four,
      3: three,
      2: two,
      1: one,
    },
    fiveStar: five,
    fourStar: four,
    threeStar: three,
    twoStar: two,
    oneStar: one,
    reviews: mappedReviews,
  };
};

export const getMyReviews = async (userId: string) => {
  const reviews = await prismaClient.review.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: {
      products: { include: { product: { select: { id: true, title: true, thumbnailImage: true, productCode: true, slug: true } } } },
      product: { select: { id: true, title: true, thumbnailImage: true, productCode: true, slug: true } },
    },
  });

  return reviews.map((r) => {
    const prods = mapReviewProducts(r);
    const primaryProd = prods[0] || null;
    return {
      id: r.id,
      productId: primaryProd?.id || r.productId || null,
      productCode: primaryProd?.sku || r.product?.productCode || null,
      productName: primaryProd?.name || r.product?.title || null,
      orderId: r.orderId,
      rating: r.rating,
      title: r.title ?? null,
      comment: r.comment ?? null,
      images: formatPublicUrlArray(r.images ?? []),
      source: r.source,
      status: r.status,
      isVerifiedPurchase: r.isVerifiedPurchase,
      products: prods,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    };
  });
};

export const adminListReviews = async (query: AdminReviewFilterQuery = {}): Promise<AdminReviewView[]> => {
  const { status, source, search, productId } = query;

  const where: Prisma.ReviewWhereInput = {};

  if (status) {
    where.status = status;
  }

  if (source) {
    where.source = source;
  }

  if (productId) {
    where.OR = [
      { products: { some: { productId } } },
      { productId },
    ];
  }

  if (search && search.trim()) {
    const term = search.trim();
    const searchConditions: Prisma.ReviewWhereInput[] = [
      { reviewerName: { contains: term, mode: "insensitive" } },
      { reviewerEmail: { contains: term, mode: "insensitive" } },
      { comment: { contains: term, mode: "insensitive" } },
      { title: { contains: term, mode: "insensitive" } },
      { product: { title: { contains: term, mode: "insensitive" } } },
      { products: { some: { product: { title: { contains: term, mode: "insensitive" } } } } },
      { products: { some: { product: { productCode: { contains: term, mode: "insensitive" } } } } },
      { order: { orderCode: { contains: term, mode: "insensitive" } } },
    ];

    if (where.OR) {
      where.AND = [{ OR: where.OR }, { OR: searchConditions }];
      delete where.OR;
    } else {
      where.OR = searchConditions;
    }
  }

  const reviews = await prismaClient.review.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      products: { include: { product: true } },
      product: true,
      order: { select: { id: true, orderCode: true, customerName: true, customerPhone: true, userEmail: true } },
      user: { select: { id: true, name: true, email: true } },
    },
  });

  return reviews.map((r) => {
    const prods = mapReviewProducts(r);
    const primary = prods[0] || null;
    const isApproved = r.status === "PUBLISHED" || r.status === "APPROVED";

    return {
      id: r.id,
      productId: primary?.id || r.productId || null,
      productCode: primary?.sku || r.product?.productCode || null,
      productName: primary?.name || r.product?.title || null,
      orderCode: r.order?.orderCode ?? null,
      orderId: r.orderId,
      orderItemId: r.orderItemId,
      userId: r.userId,
      reviewerName: r.reviewerName || r.order?.customerName || r.user?.name || null,
      reviewerEmail: r.reviewerEmail || r.order?.userEmail || r.user?.email || null,
      customerName: r.order?.customerName || r.user?.name || r.reviewerName || null,
      customerEmail: r.order?.userEmail || r.user?.email || r.reviewerEmail || null,
      customerPhone: r.order?.customerPhone ?? null,
      rating: r.rating,
      title: r.title ?? null,
      comment: r.comment ?? null,
      images: formatPublicUrlArray(r.images ?? []),
      source: r.source,
      status: r.status,
      showWithProduct: isApproved,
      isVerifiedPurchase: r.isVerifiedPurchase,
      products: prods,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    };
  });
};

export const adminGetReviewById = async (id: string): Promise<AdminReviewView> => {
  const r = await prismaClient.review.findUnique({
    where: { id },
    include: {
      products: { include: { product: true } },
      product: true,
      order: { select: { id: true, orderCode: true, customerName: true, customerPhone: true, userEmail: true } },
      user: { select: { id: true, name: true, email: true } },
    },
  });

  if (!r) {
    throw new AppError(404, "Review not found");
  }

  const prods = mapReviewProducts(r);
  const primary = prods[0] || null;
  const isApproved = r.status === "PUBLISHED" || r.status === "APPROVED";

  return {
    id: r.id,
    productId: primary?.id || r.productId || null,
    productCode: primary?.sku || r.product?.productCode || null,
    productName: primary?.name || r.product?.title || null,
    orderCode: r.order?.orderCode ?? null,
    orderId: r.orderId,
    orderItemId: r.orderItemId,
    userId: r.userId,
    reviewerName: r.reviewerName || r.order?.customerName || r.user?.name || null,
    reviewerEmail: r.reviewerEmail || r.order?.userEmail || r.user?.email || null,
    customerName: r.order?.customerName || r.user?.name || r.reviewerName || null,
    customerEmail: r.order?.userEmail || r.user?.email || r.reviewerEmail || null,
    customerPhone: r.order?.customerPhone ?? null,
    rating: r.rating,
    title: r.title ?? null,
    comment: r.comment ?? null,
    images: formatPublicUrlArray(r.images ?? []),
    source: r.source,
    status: r.status,
    showWithProduct: isApproved,
    isVerifiedPurchase: r.isVerifiedPurchase,
    products: prods,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
};

export const updateReview = async (id: string, data: AdminUpdateReviewInput) => {
  const existing = await prismaClient.review.findUnique({
    where: { id },
    include: { products: true },
  });

  if (!existing) {
    throw new AppError(404, "Review not found");
  }

  // Handle target product IDs
  let targetProductIds: string[] | undefined = undefined;

  if (data.productIds !== undefined) {
    targetProductIds = Array.from(new Set(data.productIds.filter(Boolean)));
  } else if (data.productId !== undefined) {
    targetProductIds = data.productId ? [data.productId] : [];
  }

  // Validate product existence if targetProductIds provided
  if (targetProductIds !== undefined && targetProductIds.length > 0) {
    const products = await prismaClient.product.findMany({
      where: { id: { in: targetProductIds } },
    });

    if (products.length !== targetProductIds.length) {
      throw new AppError(404, "One or more target products were not found for assignment");
    }
  }

  const nextStatus = data.status !== undefined ? data.status : existing.status;
  const isApprovedStatus = nextStatus === "PUBLISHED" || nextStatus === "APPROVED";

  // Requirement 14 Validation: Approved public review cannot have 0 associated products
  if (isApprovedStatus) {
    const finalProductCount =
      targetProductIds !== undefined
        ? targetProductIds.length
        : existing.products.length > 0
        ? existing.products.length
        : existing.productId
        ? 1
        : 0;

    if (finalProductCount === 0) {
      throw new AppError(
        400,
        "An approved public review must be associated with at least one product."
      );
    }
  }

  await prismaClient.$transaction(async (tx) => {
    // 1. Update Review scalar fields
    await tx.review.update({
      where: { id },
      data: {
        productId:
          targetProductIds !== undefined
            ? targetProductIds[0] ?? null
            : undefined,
        reviewerName: data.reviewerName !== undefined ? data.reviewerName : undefined,
        title: data.title !== undefined ? data.title : undefined,
        rating: data.rating !== undefined ? data.rating : undefined,
        comment: data.comment !== undefined ? data.comment : undefined,
        images:
          data.images !== undefined
            ? data.images.map((img) => formatPublicUrl(img)).filter(Boolean)
            : undefined,
        status: data.status !== undefined ? data.status : undefined,
      },
    });

    // 2. Update ProductReview join table if product associations were changed
    if (targetProductIds !== undefined) {
      await tx.productReview.deleteMany({
        where: { reviewId: id },
      });

      if (targetProductIds.length > 0) {
        await tx.productReview.createMany({
          data: targetProductIds.map((pId) => ({
            productId: pId,
            reviewId: id,
          })),
        });
      }
    }
  });

  return adminGetReviewById(id);
};

export const deleteReview = async (id: string) => {
  const existing = await prismaClient.review.findUnique({ where: { id } });

  if (!existing) {
    throw new AppError(404, "Review not found");
  }

  await prismaClient.review.delete({ where: { id } });
};

export const getReviewFormData = async (userId: string, orderItemId: string) => {
  const orderItem = await prismaClient.orderItem.findUnique({
    where: { id: orderItemId },
    include: { order: true, product: true, review: { include: { products: { include: { product: true } } } } },
  });

  if (!orderItem) {
    throw new AppError(404, "Order item not found");
  }

  const order = orderItem.order;

  if (!order) {
    throw new AppError(404, "Order not found");
  }

  if (order.userId !== userId) {
    throw new AppError(403, "You can only access reviews for your own orders");
  }

  const canReview = order.status === "DELIVERED";

  return {
    orderId: order.id,
    orderCode: order.orderCode,
    productId: orderItem.productId,
    productName: orderItem.product?.title ?? null,
    productImage: formatPublicUrl(orderItem.product?.thumbnailImage),
    userName: null,
    userEmail: order.userEmail ?? null,
    rating: orderItem.review?.rating ?? null,
    comment: orderItem.review?.comment ?? null,
    previousReview: orderItem.review ?? null,
    canReview,
    reviewed: Boolean(orderItem.review),
    reviewId: orderItem.review?.id ?? null,
  };
};
