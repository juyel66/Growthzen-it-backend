import type { Request, Response } from "express";
import catchAsync from "../../utils/catchAsync";
import sendResponse from "../../utils/sendResponse";
import * as reviewService from "./reviews.service";
import type {
  CreateReviewInput,
  CreatePublicReviewInput,
  SubmitVerifiedReviewInput,
  AdminReviewFilterQuery,
  AdminUpdateReviewInput,
} from "./reviews.interface";
import type { ReviewSource, ReviewStatus } from "@prisma/client";

export const createReviewHandler = catchAsync(async (req: Request, res: Response) => {
  const userId = String(req.user?.id);

  const payload: CreateReviewInput = {
    orderItemId: String(req.body.orderItemId),
    rating: Number(req.body.rating),
    title: req.body.title ?? null,
    comment: req.body.comment ?? null,
    images: (req.body.images as string[] | undefined) ?? [],
  };

  const review = await reviewService.createReview(userId, payload);

  void sendResponse(res, { message: "Review submitted successfully", data: review });
});

export const createPublicReviewHandler = catchAsync(async (req: Request, res: Response) => {
  const payload: CreatePublicReviewInput = {
    productId: String(req.body.productId),
    reviewerName: String(req.body.reviewerName),
    reviewerEmail: req.body.reviewerEmail ? String(req.body.reviewerEmail) : null,
    rating: Number(req.body.rating),
    title: req.body.title ? String(req.body.title) : null,
    comment: String(req.body.comment),
  };

  const review = await reviewService.createPublicReview(payload);

  void sendResponse(res, {
    message: "Thank you! Your review has been submitted for approval.",
    data: review,
  });
});

export const verifyReviewTokenHandler = catchAsync(async (req: Request, res: Response) => {
  const token = String(req.params.token);

  const info = await reviewService.getVerifyTokenInfo(token);

  void sendResponse(res, { message: "Review token verified", data: info });
});

export const submitVerifiedReviewHandler = catchAsync(async (req: Request, res: Response) => {
  const token = String(req.params.token);

  const payload: SubmitVerifiedReviewInput = {
    reviewerName: req.body.reviewerName ? String(req.body.reviewerName) : null,
    reviewerEmail: req.body.reviewerEmail ? String(req.body.reviewerEmail) : null,
    rating: Number(req.body.rating),
    title: req.body.title ? String(req.body.title) : null,
    comment: String(req.body.comment),
  };

  const review = await reviewService.submitVerifiedReview(token, payload);

  void sendResponse(res, { message: "Verified review submitted successfully", data: review });
});

export const getProductReviewsHandler = catchAsync(async (req: Request, res: Response) => {
  const productId = String(req.params.productId);

  const stats = await reviewService.getProductReviews(productId);

  void sendResponse(res, { message: "Product reviews", data: stats });
});

export const getMyReviewsHandler = catchAsync(async (req: Request, res: Response) => {
  const userId = String(req.user?.id);

  const items = await reviewService.getMyReviews(userId);

  void sendResponse(res, { message: "My reviews", data: items });
});

export const adminListReviewsHandler = catchAsync(async (req: Request, res: Response) => {
  const query: AdminReviewFilterQuery = {
    status: req.query.status ? (String(req.query.status) as ReviewStatus) : undefined,
    source: req.query.source ? (String(req.query.source) as ReviewSource) : undefined,
    search: req.query.search ? String(req.query.search) : undefined,
    productId: req.query.productId ? String(req.query.productId) : undefined,
    page: req.query.page ? Number(req.query.page) : undefined,
    limit: req.query.limit ? Number(req.query.limit) : undefined,
  };

  const items = await reviewService.adminListReviews(query);

  void sendResponse(res, { message: "All reviews", data: items });
});

export const adminGetReviewHandler = catchAsync(async (req: Request, res: Response) => {
  const id = String(req.params.id);

  const item = await reviewService.adminGetReviewById(id);

  void sendResponse(res, { message: "Review details", data: item });
});

export const updateReviewHandler = catchAsync(async (req: Request, res: Response) => {
  const id = String(req.params.id);

  const data: AdminUpdateReviewInput = {
    productId: req.body.productId !== undefined ? (req.body.productId ? String(req.body.productId) : null) : undefined,
    productIds: Array.isArray(req.body.productIds)
      ? req.body.productIds.map(String)
      : req.body.productId !== undefined
      ? (req.body.productId ? [String(req.body.productId)] : [])
      : undefined,
    reviewerName: req.body.reviewerName !== undefined ? String(req.body.reviewerName) : undefined,
    title: req.body.title !== undefined ? (req.body.title ? String(req.body.title) : null) : undefined,
    comment: req.body.comment !== undefined ? (req.body.comment ? String(req.body.comment) : null) : undefined,
    rating: req.body.rating !== undefined ? Number(req.body.rating) : undefined,
    images: (req.body.images as string[] | undefined) ?? undefined,
    status: req.body.status !== undefined ? (String(req.body.status) as ReviewStatus) : undefined,
  };

  const updated = await reviewService.updateReview(id, data);

  void sendResponse(res, { message: "Review updated", data: updated });
});

export const deleteReviewHandler = catchAsync(async (req: Request, res: Response) => {
  const id = String(req.params.id);

  await reviewService.deleteReview(id);

  void sendResponse(res, { message: "Review deleted", data: null });
});

export const getReviewFormHandler = catchAsync(async (req: Request, res: Response) => {
  const userId = String(req.user?.id);
  const orderItemId = String(req.params.orderItemId);

  const data = await reviewService.getReviewFormData(userId, orderItemId);

  void sendResponse(res, { message: "Review form data", data });
});
