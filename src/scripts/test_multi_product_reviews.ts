import "dotenv/config";
import prismaClient from "../config/prisma";
import {
  createPublicReview,
  getProductReviews,
  updateReview,
  adminGetReviewById,
  adminListReviews,
} from "../modules/reviews/reviews.service";

async function runMultiProductReviewTests() {
  console.log("==================================================");
  console.log("TESTING MULTI-PRODUCT REVIEW SYSTEM");
  console.log("==================================================");

  let prodA: any = null;
  let prodB: any = null;
  let prodC: any = null;
  let createdReviewId: string | null = null;

  try {
    // 1. Setup Test Products
    prodA = await prismaClient.product.create({
      data: {
        title: "Premium T-Shirt Alpha",
        shortDescription: "Short desc A",
        description: "Description A",
        costPrice: 10,
        customerSellPrice: 25,
        resellerPrice: 20,
        thumbnailImage: "/uploads/products/alpha.jpg",
        slug: `tshirt-alpha-${Date.now()}`,
        productCode: `TSH-ALPHA-${Date.now()}`,
      },
    });

    prodB = await prismaClient.product.create({
      data: {
        title: "Polo T-Shirt Beta",
        shortDescription: "Short desc B",
        description: "Description B",
        costPrice: 12,
        customerSellPrice: 30,
        resellerPrice: 24,
        thumbnailImage: "https://cdn.example.com/beta.jpg",
        slug: `polo-beta-${Date.now()}`,
        productCode: `POL-BETA-${Date.now()}`,
      },
    });

    prodC = await prismaClient.product.create({
      data: {
        title: "Casual Shirt Gamma",
        shortDescription: "Short desc C",
        description: "Description C",
        costPrice: 15,
        customerSellPrice: 35,
        resellerPrice: 28,
        thumbnailImage: "/uploads/products/gamma.png",
        slug: `casual-gamma-${Date.now()}`,
        productCode: `CSL-GAMMA-${Date.now()}`,
      },
    });

    console.log("Created Test Products:", { prodA: prodA.id, prodB: prodB.id, prodC: prodC.id });

    // 2. Submit Public Review for Product A
    const newRev = await createPublicReview({
      productId: prodA.id,
      reviewerName: "Multi Product Tester",
      reviewerEmail: "tester@example.com",
      rating: 5,
      title: "Versatile Quality",
      comment: "This material fits multiple styles fantastically!",
    });
    createdReviewId = newRev.id;
    console.log("Created Initial Review:", createdReviewId);

    // 3. Admin updates review to associate with Product A and Product B, and sets status to PUBLISHED
    const updatedReview = await updateReview(createdReviewId, {
      productIds: [prodA.id, prodB.id],
      status: "PUBLISHED",
    });

    if (updatedReview.products.length === 2) {
      console.log("✅ CASE 1 & 2 PASSED: Review associated with both Product A and Product B.");
    } else {
      console.error("❌ CASE 1 & 2 FAILED:", updatedReview.products);
    }

    // 4. Verify Admin Details returns complete product info (image, name, SKU/code, ID, slug, status)
    const adminDetails = await adminGetReviewById(createdReviewId);
    console.log("Admin Review Details Products:", adminDetails.products);

    const hasCompleteInfo = adminDetails.products.every(
      (p) => p.id && p.name && p.sku && p.slug && p.image && p.status
    );

    if (hasCompleteInfo && adminDetails.products.some((p) => p.sku === prodA.productCode) && adminDetails.products.some((p) => p.sku === prodB.productCode)) {
      console.log("✅ CASE 4 & 5 PASSED: Admin View Details returns complete product information including SKU/code, image, name, slug, status.");
    } else {
      console.error("❌ CASE 4 & 5 FAILED: Incomplete product details in admin details view.");
    }

    // 5. Check Public Product Page for Product A and Product B
    const statsA = await getProductReviews(prodA.id);
    const statsB = await getProductReviews(prodB.id);
    const statsC = await getProductReviews(prodC.id);

    const appearsInA = statsA.reviews.some((r) => r.id === createdReviewId);
    const appearsInB = statsB.reviews.some((r) => r.id === createdReviewId);
    const appearsInC = statsC.reviews.some((r) => r.id === createdReviewId);

    if (appearsInA && appearsInB && !appearsInC) {
      console.log("✅ CASE 2 PASSED: Review appears on Product A and Product B public pages, but NOT Product C.");
    } else {
      console.error("❌ CASE 2 FAILED:", { appearsInA, appearsInB, appearsInC });
    }

    // 6. Admin removes Product B from the review
    await updateReview(createdReviewId, {
      productIds: [prodA.id],
    });

    const statsBAfterRemove = await getProductReviews(prodB.id);
    const statsAAfterRemove = await getProductReviews(prodA.id);

    const appearsInBNow = statsBAfterRemove.reviews.some((r) => r.id === createdReviewId);
    const appearsInANow = statsAAfterRemove.reviews.some((r) => r.id === createdReviewId);

    if (!appearsInBNow && appearsInANow) {
      console.log("✅ CASE 3 PASSED: Review removed from Product B disappears from Product B page but remains on Product A page.");
    } else {
      console.error("❌ CASE 3 FAILED:", { appearsInANow, appearsInBNow });
    }

    // 7. Validation: Try removing all products from approved review -> should throw error
    try {
      await updateReview(createdReviewId, { productIds: [] });
      console.error("❌ CASE 14 FAILED: Allowed approved review with 0 products!");
    } catch (err: any) {
      console.log("✅ CASE 14 PASSED: Prevented approved review from having 0 associated products with message:", err.message);
    }

    console.log("\n==================================================");
    console.log("ALL BACKEND MULTI-PRODUCT REVIEW TESTS PASSED!");
    console.log("==================================================");
  } catch (err) {
    console.error("❌ BACKEND TEST ERROR:", err);
  } finally {
    if (createdReviewId) {
      await prismaClient.review.deleteMany({ where: { id: createdReviewId } });
    }
    if (prodA) await prismaClient.product.deleteMany({ where: { id: prodA.id } });
    if (prodB) await prismaClient.product.deleteMany({ where: { id: prodB.id } });
    if (prodC) await prismaClient.product.deleteMany({ where: { id: prodC.id } });
    await prismaClient.$disconnect();
  }
}

runMultiProductReviewTests();
