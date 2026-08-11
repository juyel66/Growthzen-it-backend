import { z } from "zod";

const parseRating = z.preprocess((value) => {
  if (typeof value === "string" && value.trim() !== "") {
    return Number(value);
  }
  return value;
}, z.number().int({ message: "Rating must be an integer" }).min(1, "Rating must be between 1 and 5").max(5, "Rating must be between 1 and 5"));

export const createReviewSchema = z.object({
  orderItemId: z.string().min(1, "orderItemId is required"),
  rating: parseRating,
  title: z.string().max(200, "Title cannot exceed 200 characters").optional().nullable(),
  comment: z.string().optional().nullable(),
  images: z.array(z.string()).optional(),
});

export const createPublicReviewSchema = z.object({
  productId: z.string().min(1, "productId is required"),
  reviewerName: z.string().min(1, "Reviewer name is required").max(100, "Reviewer name cannot exceed 100 characters"),
  reviewerEmail: z.string().email("Invalid email format").optional().nullable().or(z.literal("")),
  rating: parseRating,
  title: z.string().max(200, "Title cannot exceed 200 characters").optional().nullable(),
  comment: z.string().min(1, "Comment is required").max(2000, "Comment cannot exceed 2000 characters"),
});

export const submitVerifiedReviewSchema = z.object({
  reviewerName: z.string().max(100, "Reviewer name cannot exceed 100 characters").optional().nullable(),
  reviewerEmail: z.string().email("Invalid email format").optional().nullable().or(z.literal("")),
  rating: parseRating,
  title: z.string().max(200, "Title cannot exceed 200 characters").optional().nullable(),
  comment: z.string().min(1, "Comment is required").max(2000, "Comment cannot exceed 2000 characters"),
});

export const adminUpdateReviewSchema = z.object({
  productId: z.string().optional().nullable(),
  productIds: z.array(z.string()).optional(),
  reviewerName: z.string().max(100, "Reviewer name cannot exceed 100 characters").optional().nullable(),
  title: z.string().max(200, "Title cannot exceed 200 characters").optional().nullable(),
  comment: z.string().max(2000, "Comment cannot exceed 2000 characters").optional().nullable(),
  rating: parseRating.optional(),
  status: z.enum(["PENDING", "PUBLISHED", "HIDDEN", "APPROVED"]).optional(),
  images: z.array(z.string()).optional(),
});

export type CreateReviewSchema = typeof createReviewSchema;
export type CreatePublicReviewSchema = typeof createPublicReviewSchema;
export type SubmitVerifiedReviewSchema = typeof submitVerifiedReviewSchema;
export type AdminUpdateReviewSchema = typeof adminUpdateReviewSchema;
