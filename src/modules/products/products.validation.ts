import { z } from "zod";

const productStatusSchema = z.enum(["AVAILABLE", "COMING_SOON"]);

const parseBoolean = z.preprocess((value) => {
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();

    if (["true", "1", "yes", "on"].includes(normalized)) {
      return true;
    }

    if (["false", "0", "no", "off"].includes(normalized)) {
      return false;
    }
  }

  return value;
}, z.boolean());

const parseNumber = (message: string) =>
  z.preprocess((value) => {
    if (typeof value === "string" && value.trim() !== "") {
      return Number(value);
    }

    return value;
  }, z.number().nonnegative(message));

const parseOptionalNumber = (schema: z.ZodType<number>) =>
  z.preprocess((value) => {
    if (value === "" || value === null || value === undefined) {
      return undefined;
    }

    if (typeof value === "string" && value.trim() !== "") {
      return Number(value);
    }

    return value;
  }, schema.optional().nullable());

const parseStringArray = (maxItems: number, message: string) =>
  z.preprocess((value) => {
    if (Array.isArray(value)) {
      return value
        .flatMap((item) => (typeof item === "string" ? item.split(",") : []))
        .map((item) => item.trim())
        .filter(Boolean);
    }

    if (typeof value === "string") {
      const trimmed = value.trim();

      if (!trimmed) {
        return [];
      }

      if (trimmed.startsWith("[")) {
        try {
          const parsed = JSON.parse(trimmed);

          if (Array.isArray(parsed)) {
            return parsed.map((item) => String(item).trim()).filter(Boolean);
          }
        } catch {
          // Fall back to comma splitting below.
        }
      }

      return trimmed.split(",").map((item) => item.trim()).filter(Boolean);
    }

    return value;
  }, z.array(z.string().min(1)).max(maxItems, message).default([]));

const productBaseSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().min(1, "Description is required"),
  category: z.string().min(1, "Category is required"),
  originalPrice: parseNumber("Original price must be greater than or equal to 0"),
  customerSellPrice: parseNumber("Customer sell price must be greater than or equal to 0"),
  resellerSellPrice: parseNumber("Reseller sell price must be greater than or equal to 0"),
  couponCode: z.string().trim().min(1).optional().nullable(),
  couponDiscountPercentage: parseOptionalNumber(z.number().int().min(0).max(100)),
  status: productStatusSchema.optional(),
  thumbnailImage: z.string().min(1, "Thumbnail image is required"),
  productImages: parseStringArray(10, "You can upload up to 10 product images"),
  productVideos: parseStringArray(5, "You can upload up to 5 product videos"),
  isFeatured: parseBoolean.optional(),
});

export const createProductValidationSchema = productBaseSchema;
export const updateProductValidationSchema = productBaseSchema.partial();