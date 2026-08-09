import type { DiscountType, Role } from "@prisma/client";

export interface PricingProductInput {
  customerSellPrice: number;
  customerSpecialPrice?: number | null;
  resellerPrice?: number | null;
  resellerSellPrice?: number | null;
  resellerSpecialPrice?: number | null;
  salePrice?: number | null;
  discountEnabled?: boolean | null;
  discountType?: DiscountType | null;
  discountValue?: number | null;
  categoryRel?: {
    discountPercentage?: number | null;
    discountEnabled?: boolean | null;
  } | null;
  categoryDiscountPercentage?: number | null;
  categoryDiscountEnabled?: boolean | null;
}

export interface CalculatedPrice {
  basePrice: number;
  originalPrice: number;
  sellingPrice: number;
  finalPrice: number;
  discountAmount: number;
  discount: number;
  categoryDiscount: number;
  ruleApplied: "SALE_PRICE" | "PRODUCT_DISCOUNT" | "CATEGORY_DISCOUNT" | "REGULAR";
}

export interface DisplayPriceInput {
  customerSellPrice: number;
  customerSpecialPrice?: number | null;
  resellerPrice?: number | null;
  resellerSellPrice?: number | null;
  resellerSpecialPrice?: number | null;
  salePrice?: number | null;
}

const roundMoney = (value: number): number => Number(value.toFixed(2));

export const getDisplayPrice = (
  product: DisplayPriceInput,
  viewerRole?: Role
): number => {
  if (viewerRole === "RESELLER") {
    const resSpec = product.resellerSpecialPrice;
    if (typeof resSpec === "number" && resSpec > 0) {
      return resSpec;
    }
    return product.resellerSellPrice ?? product.resellerPrice ?? 0;
  }

  const custSpec = product.customerSpecialPrice ?? (typeof product.salePrice === "number" && product.salePrice > 0 ? product.salePrice : null);
  if (typeof custSpec === "number" && custSpec > 0) {
    return custSpec;
  }

  return product.customerSellPrice;
};

export const calculateFinalPrice = (
  product: PricingProductInput,
  viewerRole?: Role
): CalculatedPrice => {
  const isReseller = viewerRole === "RESELLER";
  if (isReseller) {
    const normalResellerPrice = product.resellerSellPrice ?? product.resellerPrice ?? 0;
    const resSpec = product.resellerSpecialPrice;
    const hasResSpec = typeof resSpec === "number" && resSpec > 0 && resSpec < normalResellerPrice;
    const finalResellerPrice = hasResSpec ? resSpec! : normalResellerPrice;
    const roundedOriginal = roundMoney(normalResellerPrice);
    const roundedFinal = roundMoney(finalResellerPrice);
    const discountAmt = roundMoney(Math.max(0, roundedOriginal - roundedFinal));
    return {
      basePrice: roundedOriginal,
      originalPrice: roundedOriginal,
      sellingPrice: roundedFinal,
      finalPrice: roundedFinal,
      discountAmount: discountAmt,
      discount: discountAmt,
      categoryDiscount: 0,
      ruleApplied: hasResSpec ? "SALE_PRICE" : "REGULAR",
    };
  }

  const basePrice = product.customerSellPrice;
  let sellingPrice = basePrice;
  let discountAmount = 0;
  let ruleApplied: CalculatedPrice["ruleApplied"] = "REGULAR";

  const custSpec = product.customerSpecialPrice ?? (typeof product.salePrice === "number" && product.salePrice > 0 ? product.salePrice : null);
  const specialSaleActive = typeof custSpec === "number" && custSpec > 0;
  const discountEnabled = product.discountEnabled ?? false;
  const discountType = product.discountType;
  const discountValue = product.discountValue;

  const productDiscountActive = discountEnabled && Boolean(discountType) && typeof discountValue === "number" && discountValue > 0;

  const catDiscountEnabled =
    product.categoryRel?.discountEnabled ?? product.categoryDiscountEnabled ?? false;
  const catDiscountPct =
    product.categoryRel?.discountPercentage ?? product.categoryDiscountPercentage ?? 0;

  const activeBasePrice = specialSaleActive ? custSpec! : product.customerSellPrice;

  let calcDiscount = 0;
  if (productDiscountActive) {
    if (discountType === "PERCENTAGE") {
      calcDiscount = (activeBasePrice * discountValue!) / 100;
    } else if (discountType === "FIXED") {
      calcDiscount = discountValue!;
    }
    calcDiscount = Math.min(activeBasePrice, calcDiscount);
    sellingPrice = Math.max(0, activeBasePrice - calcDiscount);
    discountAmount = Math.max(0, basePrice - sellingPrice);
    ruleApplied = specialSaleActive ? "SALE_PRICE" : "PRODUCT_DISCOUNT";
  } else if (catDiscountEnabled && catDiscountPct > 0) {
    calcDiscount = Math.min(activeBasePrice, (activeBasePrice * catDiscountPct) / 100);
    sellingPrice = Math.max(0, activeBasePrice - calcDiscount);
    discountAmount = Math.max(0, basePrice - sellingPrice);
    ruleApplied = specialSaleActive ? "SALE_PRICE" : "CATEGORY_DISCOUNT";
  } else {
    sellingPrice = activeBasePrice;
    discountAmount = Math.max(0, basePrice - sellingPrice);
    ruleApplied = specialSaleActive ? "SALE_PRICE" : "REGULAR";
  }

  const roundedBase = roundMoney(basePrice);
  const roundedSelling = roundMoney(sellingPrice);
  const roundedDiscount = roundMoney(discountAmount);
  const catDiscountAmount =
    catDiscountEnabled && catDiscountPct > 0 ? roundMoney((basePrice * catDiscountPct) / 100) : 0;

  return {
    basePrice: roundedBase,
    originalPrice: roundedBase,
    sellingPrice: roundedSelling,
    finalPrice: roundedSelling,
    discountAmount: roundedDiscount,
    discount: roundedDiscount,
    categoryDiscount: catDiscountAmount,
    ruleApplied,
  };
};
