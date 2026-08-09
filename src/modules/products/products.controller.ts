import type { Request, Response } from "express";
import AppError from "../../utils/AppError";
import catchAsync from "../../utils/catchAsync";
import sendResponse from "../../utils/sendResponse";
import { createProduct, deleteProduct, generateIdentifiers, getBestSellers, getOffers, getProductById, getProducts, getSearchSuggestions, searchProducts, updateProduct } from "./products.service";

export const searchProductsHandler = catchAsync(async (req: Request, res: Response) => {
  const viewerRole = req.user?.role;

  const queryParams = {
    q: typeof req.query.q === "string" ? req.query.q : undefined,
    page: req.query.page !== undefined ? Number(req.query.page) || 1 : 1,
    limit: req.query.limit !== undefined ? Number(req.query.limit) || 10 : 10,
    category: typeof req.query.category === "string" ? req.query.category : undefined,
    minPrice: req.query.minPrice !== undefined ? String(req.query.minPrice) : undefined,
    maxPrice: req.query.maxPrice !== undefined ? String(req.query.maxPrice) : undefined,
    sort: typeof req.query.sort === "string" ? req.query.sort : undefined,
    availability: typeof req.query.availability === "string" ? req.query.availability : undefined,
  };

  const result = await searchProducts(queryParams, viewerRole);

  sendResponse(res, {
    message: "Search results retrieved successfully",
    meta: result.pagination,
    data: {
      products: result.products,
      pagination: result.pagination,
    },
  });
});

export const getSearchSuggestionsHandler = catchAsync(async (req: Request, res: Response) => {
  const viewerRole = req.user?.role;
  const q = typeof req.query.q === "string" ? req.query.q : undefined;

  const result = await getSearchSuggestions(q, viewerRole);

  sendResponse(res, {
    message: "Search suggestions retrieved successfully",
    data: result,
  });
});

export const generateProductIdentifiersHandler = catchAsync(async (req: Request, res: Response) => {
  const categoryId = typeof req.query.categoryId === "string" ? req.query.categoryId : undefined;
  const categoryText = typeof req.query.category === "string" ? req.query.category : undefined;

  const data = await generateIdentifiers(categoryId, categoryText);

  sendResponse(res, {
    message: "Identifiers generated successfully",
    data,
  });
});

const getParamId = (value: string | string[]): string => {
  return Array.isArray(value) ? value[0] : value;
};

export const createProductHandler = catchAsync(async (req: Request, res: Response) => {
  const viewerId = req.user?.id;

  if (!viewerId) {
    throw new AppError(401, "User is not authenticated");
  }

  const product = await createProduct(req.body, viewerId);

  sendResponse(res, {
    statusCode: 201,
    message: "Product created successfully",
    data: product,
  });
});

export const getProductsHandler = catchAsync(async (req: Request, res: Response) => {
  const viewerRole = req.user?.role;
  const result = await getProducts(req.query, viewerRole);

  sendResponse(res, {
    message: "Products retrieved successfully",
    meta: result.meta,
    data: result.data,
  });
});

export const getBestSellersHandler = catchAsync(async (req: Request, res: Response) => {
  const viewerRole = req.user?.role;
  const result = await getBestSellers(req.query, viewerRole);

  sendResponse(res, {
    message: "Best sellers retrieved successfully",
    meta: result.meta,
    data: result.data,
  });
});

export const getOffersHandler = catchAsync(async (req: Request, res: Response) => {
  const viewerRole = req.user?.role;
  const result = await getOffers(req.query, viewerRole);

  sendResponse(res, {
    message: "Offers retrieved successfully",
    meta: result.meta,
    data: result.data,
  });
});

export const getProductByIdHandler = catchAsync(async (req: Request, res: Response) => {
  const viewerRole = req.user?.role;
  const rawId = req.params.id || req.params.slug;
  const productId = getParamId(rawId);

  if (!productId) {
    throw new AppError(400, "Product id or slug is required");
  }

  const product = await getProductById(productId, viewerRole);

  sendResponse(res, {
    message: "Product retrieved successfully",
    data: product,
  });
});

export const updateProductHandler = catchAsync(async (req: Request, res: Response) => {
  const productId = getParamId(req.params.id);

  if (!productId) {
    throw new AppError(400, "Product id is required");
  }

  const product = await updateProduct(productId, req.body);

  sendResponse(res, {
    message: "Product updated successfully",
    data: product,
  });
});

export const deleteProductHandler = catchAsync(async (req: Request, res: Response) => {
  const productId = getParamId(req.params.id);

  if (!productId) {
    throw new AppError(400, "Product id is required");
  }

  await deleteProduct(productId);

  sendResponse(res, {
    message: "Product deleted successfully",
  });
});