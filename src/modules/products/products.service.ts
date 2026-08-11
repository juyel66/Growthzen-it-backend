import fs from "fs/promises";
import path from "path";
import type { Prisma, Role } from "@prisma/client";
import prismaClient from "../../config/prisma";
import AppError from "../../utils/AppError";
import {
  BASE_URL,
  formatPublicUrl,
  formatPublicUrlArray,
  logImageFlow,
  toRelativePath,
} from "../../utils/imageUrl";
import { deleteFileFromStorage } from "../../services/storage.service";
import type { CategorySuggestionItem, GetProductsQueryParams, PaginatedProductsResponse, ProductAttribute, ProductCreateInput, ProductSearchQueryParams, ProductSearchResponse, ProductSuggestionItem, ProductUpdateInput, ProductView, SearchSuggestionsResponse } from "./products.interface";
import { normalizeProductCategory } from "./products.category";
import { calculateFinalPrice, getDisplayPrice } from "../pricing/pricing.service";

const productInclude = {
  createdBy: { select: { name: true, email: true } },
  categoryRel: { select: { id: true, name: true, slug: true, discountPercentage: true, discountEnabled: true } },
  reviews: {
    where: { review: { status: { in: ["PUBLISHED", "APPROVED"] as const } } },
    orderBy: { createdAt: "desc" as const },
    select: {
      review: {
        select: {
          id: true,
          reviewerName: true,
          rating: true,
          comment: true,
          images: true,
          createdAt: true,
          user: { select: { name: true } },
        },
      },
    },
  },
} satisfies Prisma.ProductInclude;

type ProductRecord = Prisma.ProductGetPayload<{ include: typeof productInclude }>;

const parseAttributes = (value: Prisma.JsonValue): ProductAttribute[] => {
  if (!Array.isArray(value)) return [];

  return value.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const name = item.name;
    const values = item.values;
    if (typeof name !== "string" || !Array.isArray(values) || !values.every((entry) => typeof entry === "string")) return [];
    return [{ name, values }];
  });
};

const isSizeAttribute = (attribute: ProductAttribute): boolean => attribute.name.trim().toLowerCase() === "size";

const configureSizeAttribute = (
  attributes: ProductAttribute[],
  enableSize: boolean | undefined,
  availableSizes: readonly string[] | undefined,
): ProductAttribute[] => {
  if (enableSize === undefined) return attributes;
  const withoutSize = attributes.filter((attribute) => !isSizeAttribute(attribute));
  if (!enableSize) return withoutSize;
  return [...withoutSize, { name: "Size", values: [...(availableSizes ?? [])] }];
};

const createSlugBase = (title: string): string => title
  .toLowerCase()
  .trim()
  .replace(/[^a-z0-9]+/g, "-")
  .replace(/^-+|-+$/g, "") || "product";

const buildUniqueSlug = async (title: string, excludeProductId?: string): Promise<string> => {
  const baseSlug = createSlugBase(title);
  for (let suffix = 0; ; suffix += 1) {
    const slug = suffix === 0 ? baseSlug : `${baseSlug}-${suffix + 1}`;
    const existing = await prismaClient.product.findFirst({
      where: { slug, ...(excludeProductId ? { id: { not: excludeProductId } } : {}) },
      select: { id: true },
    });
    if (!existing) return slug;
  }
};

const mapProduct = (product: ProductRecord, viewerRole?: Role): ProductView => {
  const breakdown: Record<1 | 2 | 3 | 4 | 5, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let ratingTotal = 0;
  product.reviews.forEach((assoc) => {
    const review = assoc.review;
    if (review && review.rating >= 1 && review.rating <= 5) {
      const rating = review.rating as 1 | 2 | 3 | 4 | 5;
      breakdown[rating] += 1;
      ratingTotal += rating;
    }
  });

  const isAdmin = viewerRole === "ADMIN" || viewerRole === "SUPER_ADMIN";
  const isReseller = viewerRole === "RESELLER";
  const attributes = parseAttributes(product.attributes);
  const sizeAttribute = attributes.find(isSizeAttribute);

  // Centralized Pricing Calculation
  const price = calculateFinalPrice(product, viewerRole);

  const rawThumbnail = toRelativePath(product.thumbnailImage) || (Array.isArray(product.productImages) && product.productImages[0] ? toRelativePath(product.productImages[0]) : "");
  const thumbnailImage = formatPublicUrl(rawThumbnail);

  const productImages = formatPublicUrlArray(
    (product.productImages ?? []).map(toRelativePath)
  );

  const productVideos = formatPublicUrlArray(
    (product.productVideos ?? []).map(toRelativePath)
  );

  logImageFlow("mapProduct Output", {
    dbThumbnail: product.thumbnailImage,
    dbProductImages: product.productImages,
    dbProductVideos: product.productVideos,
  }, {
    responseThumbnail: thumbnailImage,
    responseProductImages: productImages,
    responseProductVideos: productVideos,
  });

  const resellerPriceVal = product.resellerSellPrice ?? product.resellerPrice;
  const resellerSpecVal = product.resellerSpecialPrice ?? null;
  const custSpecVal = product.customerSpecialPrice ?? (product.salePrice && product.specialSaleEnabled ? product.salePrice : null);

  const displayPrice = getDisplayPrice(product, viewerRole);

  const rolePricing = isReseller
    ? {
      displayPrice,
      specialPrice: resellerSpecVal,
      hasSpecialPrice: Boolean(resellerSpecVal && resellerSpecVal > 0),
      resellerPrice: resellerPriceVal,
      resellerSellPrice: resellerPriceVal,
      resellerSpecialPrice: resellerSpecVal,
    }
    : isAdmin
      ? {
        costPrice: product.costPrice,
        customerSellPrice: product.customerSellPrice,
        customerSpecialPrice: custSpecVal,
        displayPrice,
        specialPrice: custSpecVal,
        hasSpecialPrice: Boolean(custSpecVal && custSpecVal > 0),
        resellerPrice: resellerPriceVal,
        resellerSellPrice: resellerPriceVal,
        resellerSpecialPrice: resellerSpecVal,
        salePrice: custSpecVal,
      }
      : {
        customerSellPrice: product.customerSellPrice,
        customerSpecialPrice: custSpecVal,
        displayPrice,
        specialPrice: custSpecVal,
        hasSpecialPrice: Boolean(custSpecVal && custSpecVal > 0),
        salePrice: custSpecVal,
      };

  return {
    id: product.id,
    title: product.title,
    shortDescription: product.shortDescription,
    description: product.description,
    slug: product.slug,
    productCode: product.productCode,
    barcode: product.barcode,
    categoryId: product.categoryId,
    category: product.categoryRel?.name ?? product.category ?? "",
    categoryDetails: product.categoryRel
      ? {
        id: product.categoryRel.id,
        name: product.categoryRel.name,
        slug: product.categoryRel.slug,
        discountPercentage: product.categoryRel.discountPercentage,
        discountEnabled: product.categoryRel.discountEnabled,
      }
      : null,
    ...rolePricing,
    originalPrice: price.originalPrice,
    categoryDiscount: price.categoryDiscount,
    discountAmount: price.discountAmount,
    finalPrice: price.finalPrice,
    discountType: product.discountType,
    discountValue: product.discountValue,
    taxRate: product.taxRate,
    couponCode: product.couponCode,
    attributes,
    enableSize: Boolean(sizeAttribute?.values.length),
    availableSizes: sizeAttribute?.values ?? [],
    thumbnailImage,
    productImages,
    productVideos,
    status: product.status,
    stock: product.status === "ACTIVE" ? 100 : 0,
    isFeatured: product.isFeatured,
    specialSaleEnabled: product.specialSaleEnabled ?? false,
    discountEnabled: product.discountEnabled ?? false,
    averageRating: product.reviews.length ? Number((ratingTotal / product.reviews.length).toFixed(2)) : 0,
    reviewCount: product.reviews.length,
    ratingBreakdown: breakdown,
    latestReviews: product.reviews
      .map((assoc) => assoc.review)
      .filter(Boolean)
      .slice(0, 5)
      .map((review) => ({
        id: review.id,
        reviewerName: review.reviewerName || review.user?.name || "Customer",
        rating: review.rating,
        comment: review.comment,
        images: formatPublicUrlArray(review.images ?? []),
        createdAt: review.createdAt,
      })),
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
    ...(isAdmin ? {
      createdById: product.createdById,
      createdByName: product.createdBy?.name ?? null,
      createdByEmail: product.createdBy?.email ?? null,
    } : {}),
  };
};

const assertUniqueIdentifiers = async (productCode: string | undefined, barcode: string | null | undefined, excludeId?: string): Promise<void> => {
  if (!productCode && !barcode) return;
  const duplicate = await prismaClient.product.findFirst({
    where: {
      ...(excludeId ? { id: { not: excludeId } } : {}),
      OR: [
        ...(productCode ? [{ productCode }] : []),
        ...(barcode ? [{ barcode }] : []),
      ],
    },
    select: { productCode: true, barcode: true },
  });
  if (!duplicate) return;
  if (productCode && duplicate.productCode === productCode) throw new AppError(409, "Product code already exists");
  throw new AppError(409, "Barcode already exists");
};

const resolveAndValidateCategory = async (
  categoryId?: string,
  categoryText?: string
): Promise<{ categoryId: string; categoryName: string }> => {
  if (categoryId) {
    const cat = await prismaClient.category.findFirst({
      where: { id: categoryId, status: "ACTIVE", deletedAt: null },
    });
    if (!cat) {
      throw new AppError(400, "Invalid or inactive category selected");
    }
    return { categoryId: cat.id, categoryName: cat.name };
  }

  if (categoryText && categoryText.trim()) {
    const name = normalizeProductCategory(categoryText);
    let cat = await prismaClient.category.findFirst({
      where: { name: { equals: name, mode: "insensitive" }, deletedAt: null },
    });

    if (!cat) {
      const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "category";
      cat = await prismaClient.category.create({
        data: { name, slug: `${slug}-${Date.now().toString(36)}`, status: "ACTIVE" },
      });
    } else if (cat.status !== "ACTIVE") {
      throw new AppError(400, `Category "${cat.name}" is inactive`);
    }

    return { categoryId: cat.id, categoryName: cat.name };
  }

  throw new AppError(400, "Category is required");
};

export const generateUniqueSku = async (categoryName?: string): Promise<string> => {
  let prefix = "";
  if (categoryName && categoryName.trim()) {
    const lettersOnly = categoryName.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
    prefix = lettersOnly.slice(0, 3);
  }
  if (!prefix) {
    prefix = "PRD";
  }
  while (prefix.length < 3) {
    prefix += "X";
  }

  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  for (let attempt = 0; attempt < 50; attempt++) {
    let randomStr = "";
    for (let i = 0; i < 8; i++) {
      randomStr += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    const sku = `${prefix}-${randomStr}`;
    const existing = await prismaClient.product.findFirst({
      where: { productCode: sku },
      select: { id: true },
    });
    if (!existing) {
      return sku;
    }
  }
  throw new AppError(500, "Failed to generate unique SKU after multiple attempts");
};

export const generateUniqueBarcode = async (): Promise<string> => {
  const digits = "0123456789";
  for (let attempt = 0; attempt < 50; attempt++) {
    let barcode = "";
    for (let i = 0; i < 13; i++) {
      if (i === 0) {
        barcode += digits.charAt(Math.floor(Math.random() * 9) + 1);
      } else {
        barcode += digits.charAt(Math.floor(Math.random() * 10));
      }
    }
    const existing = await prismaClient.product.findFirst({
      where: { barcode },
      select: { id: true },
    });
    if (!existing) {
      return barcode;
    }
  }
  throw new AppError(500, "Failed to generate unique barcode after multiple attempts");
};

export const generateIdentifiers = async (
  categoryId?: string,
  categoryText?: string
): Promise<{ sku: string; barcode: string }> => {
  let categoryName: string | undefined = undefined;
  if (categoryId || categoryText) {
    try {
      const resolved = await resolveAndValidateCategory(categoryId, categoryText);
      categoryName = resolved.categoryName;
    } catch {
      if (categoryText) categoryName = categoryText;
    }
  }
  const [sku, barcode] = await Promise.all([
    generateUniqueSku(categoryName),
    generateUniqueBarcode(),
  ]);
  return { sku, barcode };
};

const toCreateData = (
  payload: ProductCreateInput,
  slug: string,
  createdById: string,
  resolvedCategory: { categoryId: string; categoryName: string },
  finalProductCode: string,
  finalBarcode: string
): Prisma.ProductCreateInput => {
  const resellerSellPrice = payload.resellerSellPrice ?? payload.resellerPrice;
  const custSpecial = payload.customerSpecialPrice && payload.customerSpecialPrice > 0 ? payload.customerSpecialPrice : (payload.specialSaleEnabled && payload.salePrice ? payload.salePrice : null);
  const resSpecial = payload.resellerSpecialPrice && payload.resellerSpecialPrice > 0 ? payload.resellerSpecialPrice : null;

  return {
    title: payload.title,
    shortDescription: payload.shortDescription,
    description: payload.description,
    slug,
    productCode: finalProductCode,
    barcode: finalBarcode,
    category: resolvedCategory.categoryName,
    categoryRel: { connect: { id: resolvedCategory.categoryId } },
    costPrice: payload.costPrice,
    customerSellPrice: payload.customerSellPrice,
    customerSpecialPrice: custSpecial,
    resellerPrice: resellerSellPrice,
    resellerSellPrice: resellerSellPrice,
    resellerSpecialPrice: resSpecial,
    specialSaleEnabled: Boolean(custSpecial && custSpecial > 0),
    discountEnabled: payload.discountEnabled ?? false,
    salePrice: custSpecial,
    discountType: payload.discountType ?? null,
    discountValue: payload.discountValue ?? null,
    taxRate: payload.taxRate ?? null,
    couponCode: payload.couponCode ?? null,
    attributes: configureSizeAttribute(payload.attributes ?? [], payload.enableSize, payload.availableSizes) as unknown as Prisma.InputJsonValue,
    status: payload.status ?? "DRAFT",
    thumbnailImage: toRelativePath(payload.thumbnailImage),
    productImages: (payload.productImages ?? []).map(toRelativePath).filter(Boolean),
    productVideos: (payload.productVideos ?? []).map(toRelativePath).filter(Boolean),
    isFeatured: payload.isFeatured ?? false,
    createdBy: { connect: { id: createdById } },
  };
};

export const createProduct = async (payload: ProductCreateInput, createdById: string): Promise<ProductView> => {
  const resolvedCategory = await resolveAndValidateCategory(payload.categoryId, payload.category);

  // Auto SKU or manual validation
  let finalProductCode: string;
  if (payload.productCode && payload.productCode.trim().length > 0) {
    await assertUniqueIdentifiers(payload.productCode.trim(), undefined);
    finalProductCode = payload.productCode.trim();
  } else {
    finalProductCode = await generateUniqueSku(resolvedCategory.categoryName);
  }

  // Auto Barcode or manual validation
  let finalBarcode: string;
  if (payload.barcode && payload.barcode.trim().length > 0) {
    await assertUniqueIdentifiers(undefined, payload.barcode.trim());
    finalBarcode = payload.barcode.trim();
  } else {
    finalBarcode = await generateUniqueBarcode();
  }

  const product = await prismaClient.product.create({
    data: toCreateData(
      payload,
      await buildUniqueSlug(payload.title),
      createdById,
      resolvedCategory,
      finalProductCode,
      finalBarcode
    ),
    include: productInclude,
  });
  return mapProduct(product, "ADMIN");
};

export const getProducts = async (
  params?: GetProductsQueryParams,
  viewerRole?: Role
): Promise<PaginatedProductsResponse> => {
  const page = Math.max(1, Number(params?.page) || 1);
  const limit = Math.max(1, Math.min(100, Number(params?.limit) || 20));
  const skip = (page - 1) * limit;

  const isAdmin = viewerRole === "ADMIN" || viewerRole === "SUPER_ADMIN";
  const where: Prisma.ProductWhereInput = {};

  if (!isAdmin) {
    where.status = "ACTIVE";
  } else if (params?.status) {
    where.status = params.status;
  }

  if (params?.search && params.search.trim()) {
    const searchTerm = params.search.trim();
    where.OR = [
      { title: { contains: searchTerm, mode: "insensitive" } },
      { shortDescription: { contains: searchTerm, mode: "insensitive" } },
      { description: { contains: searchTerm, mode: "insensitive" } },
      { productCode: { contains: searchTerm, mode: "insensitive" } },
      { category: { contains: searchTerm, mode: "insensitive" } },
    ];
  }

  if (params?.categoryId && params.categoryId.trim()) {
    where.categoryId = params.categoryId.trim();
  } else if (params?.category && params.category.trim()) {
    const catTerm = params.category.trim();
    where.OR = [
      ...(where.OR || []),
      { category: { equals: catTerm, mode: "insensitive" } },
      { categoryRel: { is: { slug: { equals: catTerm, mode: "insensitive" } } } },
      { categoryRel: { is: { name: { equals: catTerm, mode: "insensitive" } } } },
    ];
  }

  if (params?.isFeatured !== undefined && params.isFeatured !== null && params.isFeatured !== "") {
    const isFeat = String(params.isFeatured).toLowerCase() === "true" || params.isFeatured === true;
    where.isFeatured = isFeat;
  }

  const minPrice = params?.minPrice ? Number(params.minPrice) : undefined;
  const maxPrice = params?.maxPrice ? Number(params.maxPrice) : undefined;

  if (minPrice !== undefined || maxPrice !== undefined) {
    const priceField = viewerRole === "RESELLER" ? "resellerPrice" : "customerSellPrice";
    where[priceField] = {
      ...(minPrice !== undefined ? { gte: minPrice } : {}),
      ...(maxPrice !== undefined ? { lte: maxPrice } : {}),
    };
  }

  let orderBy: Prisma.ProductOrderByWithRelationInput[] = [{ createdAt: "desc" }];
  const sortOrder: Prisma.SortOrder = params?.sortOrder === "asc" ? "asc" : "desc";
  const sortBy = params?.sortBy?.toLowerCase();

  if (sortBy === "price" || sortBy === "price_asc" || sortBy === "price_desc") {
    const priceField = viewerRole === "RESELLER" ? "resellerPrice" : "customerSellPrice";
    const dir = sortBy === "price_asc" ? "asc" : sortBy === "price_desc" ? "desc" : sortOrder;
    orderBy = [{ [priceField]: dir }];
  } else if (sortBy === "title" || sortBy === "name") {
    orderBy = [{ title: sortOrder }];
  } else if (sortBy === "featured" || sortBy === "isfeatured") {
    orderBy = [{ isFeatured: "desc" }, { createdAt: "desc" }];
  } else if (sortBy === "newest" || sortBy === "createdat" || params?.isNewest) {
    orderBy = [{ createdAt: sortOrder }];
  }

  const [products, total] = await Promise.all([
    prismaClient.product.findMany({
      where,
      orderBy,
      skip,
      take: limit,
      include: productInclude,
    }),
    prismaClient.product.count({ where }),
  ]);

  const mappedData = products.map((product) => mapProduct(product, viewerRole));

  return {
    data: mappedData,
    meta: {
      page,
      limit,
      total,
      totalPage: Math.ceil(total / limit) || 1,
    },
  };
};

export const getBestSellers = async (
  params?: GetProductsQueryParams,
  viewerRole?: Role
): Promise<PaginatedProductsResponse> => {
  const page = Math.max(1, Number(params?.page) || 1);
  const limit = Math.max(1, Math.min(100, Number(params?.limit) || 12));
  const skip = (page - 1) * limit;

  const productFilter: Prisma.ProductWhereInput = { status: "ACTIVE" };

  if (params?.categoryId && params.categoryId.trim()) {
    productFilter.categoryId = params.categoryId.trim();
  } else if (params?.category && params.category.trim()) {
    const catTerm = params.category.trim();
    productFilter.OR = [
      { category: { equals: catTerm, mode: "insensitive" } },
      { categoryRel: { is: { slug: { equals: catTerm, mode: "insensitive" } } } },
      { categoryRel: { is: { name: { equals: catTerm, mode: "insensitive" } } } },
    ];
  }

  if (params?.search && params.search.trim()) {
    const searchTerm = params.search.trim();
    productFilter.OR = [
      ...(productFilter.OR || []),
      { title: { contains: searchTerm, mode: "insensitive" } },
      { shortDescription: { contains: searchTerm, mode: "insensitive" } },
      { productCode: { contains: searchTerm, mode: "insensitive" } },
    ];
  }

  // Aggregate total quantity sold per product from DELIVERED orders
  const topSales = await prismaClient.orderItem.groupBy({
    by: ["productId"],
    where: {
      order: { status: "DELIVERED" },
      product: productFilter,
    },
    _sum: { quantity: true },
    orderBy: {
      _sum: { quantity: "desc" },
    },
  });

  const soldProductIds = topSales.map((item) => item.productId).filter(Boolean);
  let rankedProductIds: string[] = [...soldProductIds];

  // If fewer sold products exist than requested limit, append fallback unsold active products
  if (rankedProductIds.length < limit) {
    const existingIdsSet = new Set(rankedProductIds);
    const fallbackProducts = await prismaClient.product.findMany({
      where: {
        status: "ACTIVE",
        id: { notIn: Array.from(existingIdsSet) },
        ...productFilter,
      },
      select: { id: true },
      orderBy: [{ isFeatured: "desc" }, { createdAt: "desc" }],
      take: limit - rankedProductIds.length,
    });
    rankedProductIds = [...rankedProductIds, ...fallbackProducts.map((p) => p.id)];
  }

  const total = rankedProductIds.length;
  const pageProductIds = rankedProductIds.slice(skip, skip + limit);

  if (pageProductIds.length === 0) {
    return {
      data: [],
      meta: {
        page,
        limit,
        total,
        totalPage: Math.ceil(total / limit) || 1,
      },
    };
  }

  const products = await prismaClient.product.findMany({
    where: {
      id: { in: pageProductIds },
    },
    include: productInclude,
  });

  const productMap = new Map(products.map((p) => [p.id, p]));
  const orderedProducts = pageProductIds
    .map((id) => productMap.get(id))
    .filter((p): p is ProductRecord => p !== undefined);

  return {
    data: orderedProducts.map((p) => mapProduct(p, viewerRole)),
    meta: {
      page,
      limit,
      total,
      totalPage: Math.ceil(total / limit) || 1,
    },
  };
};

export const getOffers = async (
  params?: GetProductsQueryParams,
  viewerRole?: Role
): Promise<PaginatedProductsResponse> => {
  const page = Math.max(1, Number(params?.page) || 1);
  const limit = Math.max(1, Math.min(100, Number(params?.limit) || 12));
  const skip = (page - 1) * limit;

  const isReseller = viewerRole === "RESELLER";

  const offerCondition: Prisma.ProductWhereInput[] = isReseller
    ? [
        { resellerSpecialPrice: { gt: 0 } },
      ]
    : [
        { customerSpecialPrice: { gt: 0 } },
        { AND: [{ specialSaleEnabled: true }, { salePrice: { gt: 0 } }] },
        { AND: [{ discountEnabled: true }, { discountValue: { gt: 0 } }] },
        { categoryRel: { is: { discountEnabled: true, discountPercentage: { gt: 0 } } } },
      ];

  const where: Prisma.ProductWhereInput = {
    status: "ACTIVE",
    OR: offerCondition,
  };

  if (params?.categoryId && params.categoryId.trim()) {
    where.categoryId = params.categoryId.trim();
  } else if (params?.category && params.category.trim()) {
    const catTerm = params.category.trim();
    where.OR = [
      { category: { equals: catTerm, mode: "insensitive" } },
      { categoryRel: { is: { slug: { equals: catTerm, mode: "insensitive" } } } },
      { categoryRel: { is: { name: { equals: catTerm, mode: "insensitive" } } } },
    ];
  }

  if (params?.search && params.search.trim()) {
    const searchTerm = params.search.trim();
    where.OR = [
      ...(where.OR || []),
      { title: { contains: searchTerm, mode: "insensitive" } },
      { shortDescription: { contains: searchTerm, mode: "insensitive" } },
      { productCode: { contains: searchTerm, mode: "insensitive" } },
    ];
  }

  const [rawProducts, totalCount] = await Promise.all([
    prismaClient.product.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      include: productInclude,
    }),
    prismaClient.product.count({ where }),
  ]);

  const mappedList = rawProducts
    .map((p) => mapProduct(p, viewerRole))
    .filter((p) => Boolean(p.hasSpecialPrice || p.discountAmount > 0 || p.categoryDiscount > 0));

  return {
    data: mappedList,
    meta: {
      page,
      limit,
      total: totalCount,
      totalPage: Math.ceil(totalCount / limit) || 1,
    },
  };
};

export const getProductById = async (idOrSlug: string, viewerRole?: Role): Promise<ProductView> => {
  const product = await prismaClient.product.findFirst({
    where: {
      OR: [
        { id: idOrSlug },
        { slug: idOrSlug },
      ],
    },
    include: productInclude,
  });

  if (!product) throw new AppError(404, "Product not found");

  const isAdmin = viewerRole === "ADMIN" || viewerRole === "SUPER_ADMIN";
  if (!isAdmin && product.status !== "ACTIVE") {
    throw new AppError(404, "Product is not available");
  }

  return mapProduct(product, viewerRole);
};

export const updateProduct = async (id: string, payload: ProductUpdateInput): Promise<ProductView> => {
  const existing = await prismaClient.product.findUnique({
    where: { id },
    select: { id: true, attributes: true, thumbnailImage: true, productImages: true, productVideos: true, categoryId: true, category: true },
  });
  if (!existing) throw new AppError(404, "Product not found");
  await assertUniqueIdentifiers(payload.productCode, payload.barcode ?? undefined, id);

  const { attributes, enableSize, availableSizes, title, categoryId, category, deletedProductImages, deleteThumbnail, ...fields } = payload;
  if (fields.specialSaleEnabled === false) {
    fields.salePrice = null;
  }
  const nextAttributes = attributes !== undefined || enableSize !== undefined
    ? configureSizeAttribute(attributes ?? parseAttributes(existing.attributes), enableSize, availableSizes)
    : undefined;

  let resolvedCategory: { categoryId: string; categoryName: string } | undefined;
  if (categoryId || category) {
    resolvedCategory = await resolveAndValidateCategory(categoryId, category);
  }

  let nextThumbnailImage: string | undefined;
  if (deleteThumbnail) {
    await deleteFileFromStorage(existing.thumbnailImage);
    nextThumbnailImage = "";
  } else if (payload.thumbnailImage !== undefined) {
    const rel = toRelativePath(payload.thumbnailImage);
    if (rel) {
      nextThumbnailImage = rel;
    }
  }

  // Handle explicit deletedProductImages
  let currentImages = existing.productImages.map(toRelativePath).filter(Boolean);
  if (deletedProductImages && Array.isArray(deletedProductImages) && deletedProductImages.length > 0) {
    const deletedRelSet = new Set(deletedProductImages.map(toRelativePath).filter(Boolean));
    for (const imgToDelete of deletedRelSet) {
      await deleteFileFromStorage(imgToDelete);
    }
    currentImages = currentImages.filter((img) => !deletedRelSet.has(img));
  }

  let nextProductImages: string[] | undefined;
  if (payload.productImages !== undefined) {
    const normalizedPayload = payload.productImages.map(toRelativePath).filter(Boolean);
    if (normalizedPayload.length > 0) {
      nextProductImages = Array.from(new Set([...currentImages, ...normalizedPayload]));
    } else if (payload.productImages.length === 0) {
      nextProductImages = [];
    }
  } else if (deletedProductImages && deletedProductImages.length > 0) {
    nextProductImages = currentImages;
  }

  let nextProductVideos: string[] | undefined;
  if (payload.productVideos !== undefined) {
    const normalizedPayload = payload.productVideos.map(toRelativePath).filter(Boolean);
    if (normalizedPayload.length > 0) {
      const existingRel = existing.productVideos.map(toRelativePath).filter(Boolean);
      nextProductVideos = Array.from(new Set([...existingRel, ...normalizedPayload]));
    } else if (payload.productVideos.length === 0) {
      nextProductVideos = [];
    }
  }

  const resellerVal = fields.resellerSellPrice ?? fields.resellerPrice;
  const custSpecVal = fields.customerSpecialPrice !== undefined ? fields.customerSpecialPrice : fields.salePrice;

  const data: Prisma.ProductUpdateInput = {
    ...fields,
    ...(resellerVal !== undefined ? { resellerPrice: resellerVal, resellerSellPrice: resellerVal } : {}),
    ...(custSpecVal !== undefined ? { customerSpecialPrice: custSpecVal, salePrice: custSpecVal, specialSaleEnabled: Boolean(custSpecVal && custSpecVal > 0) } : {}),
    ...(nextThumbnailImage !== undefined ? { thumbnailImage: nextThumbnailImage } : {}),
    ...(nextProductImages !== undefined ? { productImages: nextProductImages } : {}),
    ...(nextProductVideos !== undefined ? { productVideos: nextProductVideos } : {}),
    ...(nextAttributes !== undefined ? { attributes: nextAttributes as unknown as Prisma.InputJsonValue } : {}),
    ...(title ? { title, slug: await buildUniqueSlug(title, id) } : {}),
    ...(resolvedCategory ? {
      category: resolvedCategory.categoryName,
      categoryRel: { connect: { id: resolvedCategory.categoryId } },
    } : {}),
  };

  const product = await prismaClient.product.update({ where: { id }, data, include: productInclude });

  const existingThumbnailRel = toRelativePath(existing.thumbnailImage);
  const existingImagesRel = existing.productImages.map(toRelativePath).filter(Boolean);
  const existingVideosRel = existing.productVideos.map(toRelativePath).filter(Boolean);

  const obsoleteFiles = [
    ...(nextThumbnailImage && nextThumbnailImage !== existingThumbnailRel ? [existingThumbnailRel] : []),
    ...(nextProductImages ? existingImagesRel.filter((file) => !nextProductImages?.includes(file)) : []),
    ...(nextProductVideos ? existingVideosRel.filter((file) => !nextProductVideos?.includes(file)) : []),
  ];

  for (const obsolete of obsoleteFiles) {
    await deleteFileFromStorage(obsolete);
  }

  return mapProduct(product, "ADMIN");
};

export const deleteProduct = async (id: string): Promise<void> => {
  const product = await prismaClient.product.findUnique({
    where: { id },
    select: { thumbnailImage: true, productImages: true, productVideos: true },
  });
  if (!product) throw new AppError(404, "Product not found");
  await prismaClient.product.delete({ where: { id } });

  const filesToDelete = [
    product.thumbnailImage,
    ...(Array.isArray(product.productImages) ? product.productImages : []),
    ...(Array.isArray(product.productVideos) ? product.productVideos : []),
  ].filter(Boolean);

  for (const fileUrl of filesToDelete) {
    await deleteFileFromStorage(fileUrl);
  }
};

export const searchProducts = async (
  params?: ProductSearchQueryParams,
  viewerRole?: Role
): Promise<ProductSearchResponse> => {
  const page = Math.max(1, Number(params?.page) || 1);
  const limit = Math.max(1, Math.min(100, Number(params?.limit) || 10));
  const skip = (page - 1) * limit;

  // Storefront search MUST return ACTIVE products only
  const where: Prisma.ProductWhereInput = {
    status: "ACTIVE",
  };

  // Search query term matching
  if (params?.q && params.q.trim()) {
    const q = params.q.trim();

    where.OR = [
      { title: { contains: q, mode: "insensitive" } },
      { productCode: { contains: q, mode: "insensitive" } },
      { barcode: { contains: q, mode: "insensitive" } },
      { category: { contains: q, mode: "insensitive" } },
      { categoryRel: { is: { name: { contains: q, mode: "insensitive" } } } },
      { categoryRel: { is: { slug: { contains: q, mode: "insensitive" } } } },
      { shortDescription: { contains: q, mode: "insensitive" } },
      { description: { contains: q, mode: "insensitive" } },
      {
        attributes: {
          path: [],
          string_contains: q,
        },
      },
    ];
  }

  // Category filter with subcategory inclusion
  if (params?.category && params.category.trim()) {
    const catTerm = params.category.trim();

    const matchingCategories = await prismaClient.category.findMany({
      where: {
        OR: [
          { id: catTerm },
          { slug: { equals: catTerm, mode: "insensitive" } },
          { name: { equals: catTerm, mode: "insensitive" } },
        ],
        deletedAt: null,
      },
      select: { id: true },
    });

    const categoryIds = matchingCategories.map((c) => c.id);

    let categoryFilter: Prisma.ProductWhereInput;

    if (categoryIds.length > 0) {
      const subCategories = await prismaClient.category.findMany({
        where: {
          parentCategoryId: { in: categoryIds },
          deletedAt: null,
        },
        select: { id: true },
      });
      const allCategoryIds = Array.from(new Set([...categoryIds, ...subCategories.map((sc) => sc.id)]));

      categoryFilter = {
        OR: [
          { categoryId: { in: allCategoryIds } },
          { category: { equals: catTerm, mode: "insensitive" } },
          { categoryRel: { is: { slug: { equals: catTerm, mode: "insensitive" } } } },
          { categoryRel: { is: { name: { equals: catTerm, mode: "insensitive" } } } },
        ],
      };
    } else {
      categoryFilter = {
        OR: [
          { category: { contains: catTerm, mode: "insensitive" } },
          { categoryRel: { is: { slug: { contains: catTerm, mode: "insensitive" } } } },
          { categoryRel: { is: { name: { contains: catTerm, mode: "insensitive" } } } },
        ],
      };
    }

    if (where.AND) {
      if (Array.isArray(where.AND)) {
        where.AND.push(categoryFilter);
      } else {
        where.AND = [where.AND, categoryFilter];
      }
    } else {
      where.AND = [categoryFilter];
    }
  }

  // Price Filter (minPrice & maxPrice) based on effective role price
  const minPrice = params?.minPrice !== undefined && params?.minPrice !== "" && !isNaN(Number(params.minPrice)) ? Number(params.minPrice) : undefined;
  const maxPrice = params?.maxPrice !== undefined && params?.maxPrice !== "" && !isNaN(Number(params.maxPrice)) ? Number(params.maxPrice) : undefined;

  if (minPrice !== undefined || maxPrice !== undefined) {
    const isReseller = viewerRole === "RESELLER";

    if (isReseller) {
      const specCond: Prisma.ProductWhereInput = {
        resellerSpecialPrice: {
          gt: 0,
          ...(minPrice !== undefined ? { gte: minPrice } : {}),
          ...(maxPrice !== undefined ? { lte: maxPrice } : {}),
        },
      };

      const regCond: Prisma.ProductWhereInput = {
        OR: [
          { resellerSpecialPrice: null },
          { resellerSpecialPrice: { lte: 0 } },
        ],
        AND: [
          {
            OR: [
              {
                resellerSellPrice: {
                  ...(minPrice !== undefined ? { gte: minPrice } : {}),
                  ...(maxPrice !== undefined ? { lte: maxPrice } : {}),
                },
              },
              {
                resellerSellPrice: null,
                resellerPrice: {
                  ...(minPrice !== undefined ? { gte: minPrice } : {}),
                  ...(maxPrice !== undefined ? { lte: maxPrice } : {}),
                },
              },
            ],
          },
        ],
      };

      const priceFilter: Prisma.ProductWhereInput = { OR: [specCond, regCond] };

      if (where.AND) {
        if (Array.isArray(where.AND)) {
          where.AND.push(priceFilter);
        } else {
          where.AND = [where.AND, priceFilter];
        }
      } else {
        where.AND = [priceFilter];
      }
    } else {
      const custSpecCond: Prisma.ProductWhereInput = {
        customerSpecialPrice: {
          gt: 0,
          ...(minPrice !== undefined ? { gte: minPrice } : {}),
          ...(maxPrice !== undefined ? { lte: maxPrice } : {}),
        },
      };

      const salePriceCond: Prisma.ProductWhereInput = {
        OR: [
          { customerSpecialPrice: null },
          { customerSpecialPrice: { lte: 0 } },
        ],
        specialSaleEnabled: true,
        salePrice: {
          gt: 0,
          ...(minPrice !== undefined ? { gte: minPrice } : {}),
          ...(maxPrice !== undefined ? { lte: maxPrice } : {}),
        },
      };

      const regCustCond: Prisma.ProductWhereInput = {
        AND: [
          {
            OR: [
              { customerSpecialPrice: null },
              { customerSpecialPrice: { lte: 0 } },
            ],
          },
          {
            OR: [
              { specialSaleEnabled: false },
              { salePrice: null },
              { salePrice: { lte: 0 } },
            ],
          },
          {
            customerSellPrice: {
              ...(minPrice !== undefined ? { gte: minPrice } : {}),
              ...(maxPrice !== undefined ? { lte: maxPrice } : {}),
            },
          },
        ],
      };

      const priceFilter: Prisma.ProductWhereInput = {
        OR: [custSpecCond, salePriceCond, regCustCond],
      };

      if (where.AND) {
        if (Array.isArray(where.AND)) {
          where.AND.push(priceFilter);
        } else {
          where.AND = [where.AND, priceFilter];
        }
      } else {
        where.AND = [priceFilter];
      }
    }
  }

  // Stock availability filter
  if (params?.availability && params.availability.trim()) {
    const avail = params.availability.toLowerCase().trim();
    if (avail === "out_of_stock") {
      // Out of stock returns empty list for active products as stock is 100 when active
      return {
        products: [],
        pagination: {
          page,
          limit,
          total: 0,
          totalPages: 1,
        },
      };
    }
  }

  // Sorting logic
  const sortParam = params?.sort?.toLowerCase().trim() || "newest";
  let orderBy: Prisma.ProductOrderByWithRelationInput[] = [{ createdAt: "desc" }];

  if (sortParam === "oldest") {
    orderBy = [{ createdAt: "asc" }];
  } else if (sortParam === "price_low" || sortParam === "price_asc") {
    const priceField = viewerRole === "RESELLER" ? "resellerPrice" : "customerSellPrice";
    orderBy = [{ [priceField]: "asc" }, { createdAt: "desc" }];
  } else if (sortParam === "price_high" || sortParam === "price_desc") {
    const priceField = viewerRole === "RESELLER" ? "resellerPrice" : "customerSellPrice";
    orderBy = [{ [priceField]: "desc" }, { createdAt: "desc" }];
  } else if (sortParam === "name_asc" || sortParam === "title_asc") {
    orderBy = [{ title: "asc" }];
  } else if (sortParam === "name_desc" || sortParam === "title_desc") {
    orderBy = [{ title: "desc" }];
  } else if (sortParam === "popular") {
    orderBy = [{ isFeatured: "desc" }, { createdAt: "desc" }];
  } else {
    orderBy = [{ createdAt: "desc" }];
  }

  const [products, total] = await Promise.all([
    prismaClient.product.findMany({
      where,
      orderBy,
      skip,
      take: limit,
      include: productInclude,
    }),
    prismaClient.product.count({ where }),
  ]);

  const mappedProducts = products.map((p) => mapProduct(p, viewerRole));
  const totalPages = Math.ceil(total / limit) || 1;

  return {
    products: mappedProducts,
    pagination: {
      page,
      limit,
      total,
      totalPages,
    },
  };
};

export const getSearchSuggestions = async (
  q?: string,
  viewerRole?: Role
): Promise<SearchSuggestionsResponse> => {
  const searchTerm = q?.trim() || "";

  if (!searchTerm) {
    const [topProducts, topCategories] = await Promise.all([
      prismaClient.product.findMany({
        where: { status: "ACTIVE" },
        orderBy: [{ isFeatured: "desc" }, { createdAt: "desc" }],
        take: 6,
        include: productInclude,
      }),
      prismaClient.category.findMany({
        where: { status: "ACTIVE", deletedAt: null },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
        take: 4,
        select: { id: true, name: true, slug: true, image: true },
      }),
    ]);

    const productSuggestions: ProductSuggestionItem[] = topProducts.map((p) => {
      const mapped = mapProduct(p, viewerRole);
      return {
        id: mapped.id,
        name: mapped.title,
        title: mapped.title,
        slug: mapped.slug,
        sku: mapped.productCode,
        image: mapped.thumbnailImage,
        price: mapped.displayPrice,
        originalPrice: mapped.originalPrice,
        category: mapped.category,
        stock: mapped.stock,
      };
    });

    const categorySuggestions: CategorySuggestionItem[] = topCategories.map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      image: c.image ? formatPublicUrl(toRelativePath(c.image)) : null,
    }));

    return {
      products: productSuggestions,
      categories: categorySuggestions,
    };
  }

  const productWhere: Prisma.ProductWhereInput = {
    status: "ACTIVE",
    OR: [
      { title: { contains: searchTerm, mode: "insensitive" } },
      { productCode: { contains: searchTerm, mode: "insensitive" } },
      { barcode: { contains: searchTerm, mode: "insensitive" } },
      { category: { contains: searchTerm, mode: "insensitive" } },
      { categoryRel: { is: { name: { contains: searchTerm, mode: "insensitive" } } } },
      { shortDescription: { contains: searchTerm, mode: "insensitive" } },
    ],
  };

  const categoryWhere: Prisma.CategoryWhereInput = {
    status: "ACTIVE",
    deletedAt: null,
    OR: [
      { name: { contains: searchTerm, mode: "insensitive" } },
      { slug: { contains: searchTerm, mode: "insensitive" } },
      { description: { contains: searchTerm, mode: "insensitive" } },
    ],
  };

  const [matchingProducts, matchingCategories] = await Promise.all([
    prismaClient.product.findMany({
      where: productWhere,
      orderBy: [{ isFeatured: "desc" }, { createdAt: "desc" }],
      take: 6,
      include: productInclude,
    }),
    prismaClient.category.findMany({
      where: categoryWhere,
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      take: 4,
      select: { id: true, name: true, slug: true, image: true },
    }),
  ]);

  const productSuggestions: ProductSuggestionItem[] = matchingProducts.map((p) => {
    const mapped = mapProduct(p, viewerRole);
    return {
      id: mapped.id,
      name: mapped.title,
      title: mapped.title,
      slug: mapped.slug,
      sku: mapped.productCode,
      image: mapped.thumbnailImage,
      price: mapped.displayPrice,
      originalPrice: mapped.originalPrice,
      category: mapped.category,
      stock: mapped.stock,
    };
  });

  const categorySuggestions: CategorySuggestionItem[] = matchingCategories.map((c) => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
    image: c.image ? formatPublicUrl(toRelativePath(c.image)) : null,
  }));

  return {
    products: productSuggestions,
    categories: categorySuggestions,
  };
};

