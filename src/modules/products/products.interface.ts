import type { ProductStatus, Role } from "@prisma/client";

export interface ProductCreateInput {
  hasSize?: boolean;
sizes?: string[];
  productCode: string;
  title: string;
  description: string;
  category: string;
  originalPrice: number;
  customerSellPrice: number;
  resellerSellPrice: number;
  couponCode?: string | null;
  couponDiscountPercentage?: number | null;
  status?: ProductStatus;
  thumbnailImage: string;
  productImages: string[];
  productVideos: string[];
  isFeatured?: boolean;
}

export interface ProductUpdateInput extends Partial<ProductCreateInput> {}

export interface PublicProductView {
  id: string;
  title: string;
  slug: string;
  hasSize: boolean;
sizes: string[];
  description: string;
  category: string;
  customerSellPrice: number;
  discountedCustomerPrice: number;
  couponCode?: string | null;
  thumbnailImage: string;
  productCode: string; 
  productImages: string[];
  productVideos: string[];
  status: ProductStatus;
  isFeatured: boolean;
  createdAt: Date;
  updatedAt: Date;
}



export interface ResellerProductView {
  id: string;
  title: string;
  slug: string;
  description: string;
  category: string;
  productCode: string;
  hasSize: boolean;
sizes: string[];

  customerSellPrice: number;
  resellerSellPrice: number;

  couponCode?: string | null;

  thumbnailImage: string;
  productImages: string[];
  productVideos: string[];

  status: ProductStatus;
  isFeatured: boolean;

  createdAt: Date;
  updatedAt: Date;
}



export interface AdminProductView {
  id: string;
  title: string;
  slug: string;
  description: string;
  productCode: string;
  hasSize: boolean;
sizes: string[];

  createdByName: string | null;
createdByEmail: string | null;

  category: string;
  originalPrice: number;
  customerSellPrice: number;
  resellerSellPrice: number;
  couponCode?: string | null;
  couponDiscountPercentage?: number | null;
  status: ProductStatus;
  thumbnailImage: string;
  productImages: string[];
  productVideos: string[];
  isFeatured: boolean;
  createdById: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export type ProductViewerRole = Role | undefined;