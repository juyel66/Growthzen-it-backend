import fs from "fs/promises";
import path from "path";
import type { Prisma, Role } from "../../../generated/prisma/client";
import prismaClient from "../../config/prisma";
import AppError from "../../utils/AppError";
import type {
  AdminProductView,
  ProductCreateInput,
  ProductUpdateInput,
  ProductViewerRole,
  PublicProductView,
  ResellerProductView,
} from "./products.interface";

const productInclude = {
  createdBy: {
    select: {
      name: true,
      email: true,
    },
  },
} satisfies Prisma.ProductInclude;



type ProductWithCreator = Prisma.ProductGetPayload<{
  include: typeof productInclude;
}>;







const calculateDiscountedCustomerPrice = (customerSellPrice: number, couponDiscountPercentage?: number | null): number => {
  if (!couponDiscountPercentage) {
    return customerSellPrice;
  }

  return Number((customerSellPrice - (customerSellPrice * couponDiscountPercentage) / 100).toFixed(2));
};

const createSlugBase = (title: string): string => {
  const slug = title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || "product";
};

const buildUniqueSlug = async (title: string, excludeProductId?: string): Promise<string> => {
  const baseSlug = createSlugBase(title);

  for (let suffix = 0; ; suffix += 1) {
    const candidateSlug = suffix === 0 ? baseSlug : `${baseSlug}-${suffix + 1}`;
    const existingProduct = await prismaClient.product.findFirst({
      where: {
        slug: candidateSlug,
        ...(excludeProductId ? { id: { not: excludeProductId } } : {}),
      },
      select: {
        id: true,
      },
    });

    if (!existingProduct) {
      return candidateSlug;
    }
  }
};

const mapPublicProduct = (product: ProductWithCreator): PublicProductView => ({
  id: product.id,
  title: product.title,

  hasSize: product.hasSize,
sizes: product.sizes,
  slug: product.slug,
  productCode: product.productCode,
  description: product.description,
  category: product.category,
  customerSellPrice: product.customerSellPrice,
  discountedCustomerPrice: calculateDiscountedCustomerPrice(product.customerSellPrice, product.couponDiscountPercentage),
  couponCode: product.couponCode,
  thumbnailImage: product.thumbnailImage,
  productImages: product.productImages,
  productVideos: product.productVideos,
  status: product.status,
  isFeatured: product.isFeatured,
  createdAt: product.createdAt,
  updatedAt: product.updatedAt,
});



const mapResellerProduct = (product: ProductWithCreator): ResellerProductView => ({
  id: product.id,
  title: product.title,

  hasSize: product.hasSize,
sizes: product.sizes,
  slug: product.slug,
  description: product.description,
  category: product.category,
  productCode: product.productCode,

  customerSellPrice: product.customerSellPrice,
  resellerSellPrice: product.resellerSellPrice,

  couponCode: product.couponCode,

  thumbnailImage: product.thumbnailImage,
  productImages: product.productImages,
  productVideos: product.productVideos,

  status: product.status,
  isFeatured: product.isFeatured,

  createdAt: product.createdAt,
  updatedAt: product.updatedAt,
});



const mapAdminProduct = (product: ProductWithCreator): AdminProductView => ({

  id: product.id,
  title: product.title,
  slug: product.slug,
  productCode: product.productCode,
  hasSize: product.hasSize,
sizes: product.sizes,

  description: product.description,
  category: product.category,
  originalPrice: product.originalPrice,
  customerSellPrice: product.customerSellPrice,
  resellerSellPrice: product.resellerSellPrice,
  couponCode: product.couponCode,
  couponDiscountPercentage: product.couponDiscountPercentage,
  status: product.status,
  thumbnailImage: product.thumbnailImage,
  productImages: product.productImages,
  productVideos: product.productVideos,
  isFeatured: product.isFeatured,
  createdById: product.createdById,
  createdByName: product.createdBy?.name ?? null,
  createdByEmail: product.createdBy?.email ?? null,
  createdAt: product.createdAt,
  updatedAt: product.updatedAt,
});

const mapProductByRole = (product: ProductWithCreator, viewerRole?: Role) => {
  if (!viewerRole) {
    return mapPublicProduct(product);
  }

  // Resellers get reseller-specific view
  if (viewerRole === "RESELLER") {
    return mapResellerProduct(product);
  }

  // Admin and Super Admin get full admin view
  if (viewerRole === "ADMIN" || viewerRole === "SUPER_ADMIN") {
    return mapAdminProduct(product);
  }

  // All other roles (including CUSTOMER) see public view
  return mapPublicProduct(product);
};

export const createProduct = async (payload: ProductCreateInput, createdById: string): Promise<AdminProductView> => {
  const slug = await buildUniqueSlug(payload.title);

  const createdProduct = await prismaClient.product.create({
    data: {
      ...payload,
     
  hasSize: payload.hasSize ?? false,
  sizes: payload.sizes ?? [],
      slug,
      createdById,
      status: payload.status ?? "AVAILABLE",
      couponCode: payload.couponCode ?? null,
      couponDiscountPercentage: payload.couponDiscountPercentage ?? null,
      productVideos: payload.productVideos ?? [],
      isFeatured: payload.isFeatured ?? false,

    },
    include: productInclude,
  });

return mapAdminProduct(createdProduct);
};

export const getProducts = async (viewerRole?: Role) => {
  const products = await prismaClient.product.findMany({
    orderBy: { createdAt: "desc" },
    include: productInclude,
  });

  return products.map((product) => mapProductByRole(product, viewerRole));
};

export const getProductById = async (id: string, viewerRole?: Role) => {
  const product = await prismaClient.product.findUnique({
    where: { id },
    include: productInclude,
  });

  if (!product) {
    throw new AppError(404, "Product not found");
  }

  return mapProductByRole(product, viewerRole);
};

export const updateProduct = async (id: string, payload: ProductUpdateInput): Promise<AdminProductView> => {
  const existingProduct = await prismaClient.product.findUnique({
    where: { id },
    select: {
      id: true,
      thumbnailImage: true,
      hasSize: true,
      sizes: true,
      productImages: true,
      productVideos: true,
    },
  });

  

  if (!existingProduct) {
    throw new AppError(404, "Product not found");
  }

  const nextData: Prisma.ProductUpdateInput = {
    ...payload,
    ...(payload.title ? { slug: await buildUniqueSlug(payload.title, id) } : {}),
    couponCode: payload.couponCode ?? undefined,
    couponDiscountPercentage: payload.couponDiscountPercentage ?? undefined,
    productVideos: payload.productVideos ?? undefined,
    isFeatured: payload.isFeatured ?? undefined,
    status: payload.status ?? undefined,
  };

  const updatedProduct = await prismaClient.product.update({
    where: { id },
    data: nextData,
    include: productInclude,
  });

  const pathsToDelete: string[] = [];

  if (Object.prototype.hasOwnProperty.call(payload, "thumbnailImage") && payload.thumbnailImage && payload.thumbnailImage !== existingProduct.thumbnailImage) {
    pathsToDelete.push(existingProduct.thumbnailImage);
  }

  if (Object.prototype.hasOwnProperty.call(payload, "productImages")) {
    pathsToDelete.push(...existingProduct.productImages.filter((filePath) => !payload.productImages?.includes(filePath)));
  }

  if (Object.prototype.hasOwnProperty.call(payload, "productVideos")) {
    pathsToDelete.push(...existingProduct.productVideos.filter((filePath) => !payload.productVideos?.includes(filePath)));
  }

  await deleteLocalFiles(pathsToDelete);
return mapAdminProduct(updatedProduct);
};

export const deleteProduct = async (id: string): Promise<void> => {
  const existingProduct = await prismaClient.product.findUnique({
    where: { id },

    select: {
      id: true,
      thumbnailImage: true,
      productImages: true,
      productVideos: true,
      hasSize: true,
  sizes: true,
    },
  });

  if (!existingProduct) {
    throw new AppError(404, "Product not found");
  }

  await prismaClient.product.delete({
    where: { id },
  });

  await deleteLocalFiles([
    existingProduct.thumbnailImage,
    ...existingProduct.productImages,
    ...existingProduct.productVideos,
  ]);
};

const isLocalUploadPath = (filePath: string): boolean => {
  return filePath.startsWith("/uploads/") || filePath.startsWith("uploads/");
};

const toDiskPath = (filePath: string): string => {
  return path.resolve(process.cwd(), filePath.replace(/^\/+/, ""));
};

const deleteLocalFiles = async (filePaths: string[]): Promise<void> => {
  const uniquePaths = [...new Set(filePaths.filter((filePath) => filePath && isLocalUploadPath(filePath)).map(toDiskPath))];

  await Promise.all(
    uniquePaths.map(async (filePath) => {
      try {
        await fs.unlink(filePath);
      } catch (error) {
        const err = error as NodeJS.ErrnoException;

        if (err.code !== "ENOENT") {
          throw error;
        }
      }
    }),
  );
};