import type { ReviewSource, ReviewStatus } from "@prisma/client";

export interface ReviewProductView {
  id: string;
  name: string;
  title: string;
  sku: string | null;
  productCode: string | null;
  slug: string;
  image: string;
  thumbnailImage: string;
  status: string;
}

export interface CreateReviewInput {
  orderItemId: string;
  rating: number;
  title?: string | null;
  comment?: string | null;
  images?: string[];
  productIds?: string[];
}

export interface CreatePublicReviewInput {
  productId: string;
  productIds?: string[];
  reviewerName: string;
  reviewerEmail?: string | null;
  rating: number;
  title?: string | null;
  comment: string;
}

export interface SubmitVerifiedReviewInput {
  reviewerName?: string | null;
  reviewerEmail?: string | null;
  rating: number;
  title?: string | null;
  comment: string;
}

export interface VerifyTokenResponse {
  valid: boolean;
  productId: string;
  productName: string | null;
  productImage: string | null;
  reviewerName: string | null;
  tokenExpiry: Date;
  alreadyReviewed: boolean;
}

export interface PublicReviewView {
  id: string;
  reviewerName: string | null;
  rating: number;
  title: string | null;
  comment: string | null;
  isVerifiedPurchase: boolean;
  createdAt: Date;
  images?: string[];
  products?: ReviewProductView[];
}

export interface RatingBreakdown {
  5: number;
  4: number;
  3: number;
  2: number;
  1: number;
}

export interface ProductReviewStats {
  averageRating: number;
  totalReviews: number;
  ratingBreakdown: RatingBreakdown;
  fiveStar?: number;
  fourStar?: number;
  threeStar?: number;
  twoStar?: number;
  oneStar?: number;
  reviews: PublicReviewView[];
}

export interface AdminReviewFilterQuery {
  status?: ReviewStatus;
  source?: ReviewSource;
  search?: string;
  productId?: string;
  page?: number;
  limit?: number;
}

export interface AdminUpdateReviewInput {
  productId?: string | null;
  productIds?: string[];
  reviewerName?: string;
  title?: string | null;
  comment?: string | null;
  rating?: number;
  status?: ReviewStatus;
  images?: string[];
}

export interface AdminReviewView {
  id: string;
  productId: string | null;
  productCode: string | null;
  productName: string | null;
  orderCode: string | null;
  orderId: string | null;
  orderItemId: string | null;
  userId: string | null;
  reviewerName: string | null;
  reviewerEmail: string | null;
  customerName: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  rating: number;
  title: string | null;
  comment: string | null;
  images: string[];
  source: ReviewSource;
  status: ReviewStatus;
  showWithProduct: boolean;
  isVerifiedPurchase: boolean;
  products: ReviewProductView[];
  createdAt: Date;
  updatedAt: Date;
}
