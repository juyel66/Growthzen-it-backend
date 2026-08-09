import type { DiscountType, ProductStatus, Role } from "@prisma/client";

export interface ProductAttribute {
  name: string;
  values: string[];
}

export interface ProductCategoryDetails {
  id: string;
  name: string;
  slug: string;
  discountPercentage?: number;
  discountEnabled?: boolean;
}

export interface ProductCreateInput {
  title: string;
  shortDescription: string;
  description: string;
  categoryId?: string;
  category?: string;
  costPrice: number;
  customerSellPrice: number;
  customerSpecialPrice?: number | null;
  resellerPrice: number;
  resellerSellPrice?: number | null;
  resellerSpecialPrice?: number | null;
  salePrice?: number | null;
  discountType?: DiscountType | null;
  discountValue?: number | null;
  taxRate?: number | null;
  couponCode?: string | null;
  productCode?: string;
  barcode?: string | null;
  attributes?: ProductAttribute[];
  enableSize?: boolean;
  availableSizes?: ProductSize[];
  status?: ProductStatus;
  thumbnailImage: string;
  productImages?: string[];
  productVideos?: string[];
  isFeatured?: boolean;
  specialSaleEnabled?: boolean;
  discountEnabled?: boolean;
}

export type ProductUpdateInput = Partial<ProductCreateInput> & {
  deletedProductImages?: string[];
  deleteThumbnail?: boolean;
};

export interface LatestReviewView {
  id: string;
  reviewerName: string | null;
  rating: number;
  comment: string | null;
  images: string[];
  createdAt: Date;
}

export interface ProductView {
  id: string;
  title: string;
  shortDescription: string;
  description: string;
  slug: string;
  productCode: string;
  barcode: string | null;
  categoryId: string | null;
  category: string;
  categoryDetails?: ProductCategoryDetails | null;
  costPrice?: number;
  customerSellPrice?: number;
  customerSpecialPrice?: number | null;
  displayPrice: number;
  originalPrice: number;
  categoryDiscount: number;
  discountAmount: number;
  finalPrice: number;
  resellerPrice?: number;
  resellerSellPrice?: number;
  resellerSpecialPrice?: number | null;
  specialPrice?: number | null;
  hasSpecialPrice?: boolean;
  salePrice?: number | null;
  discountType: DiscountType | null;
  discountValue: number | null;
  taxRate: number | null;
  couponCode: string | null;
  attributes: ProductAttribute[];
  enableSize: boolean;
  availableSizes: string[];
  thumbnailImage: string;
  productImages: string[];
  productVideos: string[];
  status: ProductStatus;
  stock: number;
  isFeatured: boolean;
  specialSaleEnabled: boolean;
  discountEnabled: boolean;
  averageRating: number;
  reviewCount: number;
  ratingBreakdown: Record<1 | 2 | 3 | 4 | 5, number>;
  latestReviews: LatestReviewView[];
  createdAt: Date;
  updatedAt: Date;
  createdById?: string | null;
  createdByName?: string | null;
  createdByEmail?: string | null;
}

export type ProductViewerRole = Role | undefined;

export interface GetProductsQueryParams {
  page?: number | string;
  limit?: number | string;
  search?: string;
  category?: string;
  categoryId?: string;
  status?: ProductStatus;
  isFeatured?: boolean | string;
  isNewest?: boolean | string;
  minPrice?: number | string;
  maxPrice?: number | string;
  sortBy?: "createdAt" | "price" | "title" | "newest" | "featured" | string;
  sortOrder?: "asc" | "desc";
}

export interface PaginatedProductsResponse {
  data: ProductView[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPage: number;
  };
}

export const PRODUCT_SIZES = ["XS", "S", "M", "L", "XL", "XXL", "XXXL"] as const;
export type ProductSize = (typeof PRODUCT_SIZES)[number];

export interface ProductSearchQueryParams {
  q?: string;
  page?: number | string;
  limit?: number | string;
  category?: string;
  minPrice?: number | string;
  maxPrice?: number | string;
  sort?: "newest" | "oldest" | "price_low" | "price_high" | "name_asc" | "name_desc" | "popular" | string;
  availability?: "in_stock" | "out_of_stock" | "all" | string;
}

export interface ProductSearchResponse {
  products: ProductView[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ProductSuggestionItem {
  id: string;
  name: string;
  title: string;
  slug: string;
  sku: string;
  image: string;
  price: number;
  originalPrice?: number;
  category?: string;
  stock?: number;
}

export interface CategorySuggestionItem {
  id: string;
  name: string;
  slug: string;
  image?: string | null;
}

export interface SearchSuggestionsResponse {
  products: ProductSuggestionItem[];
  categories: CategorySuggestionItem[];
}

