import "dotenv/config";
import prismaClient from "../config/prisma";

export async function migrateReviewsToManyToMany() {
  console.log("==================================================");
  console.log("STARTING REVIEW MANY-TO-MANY DATA MIGRATION");
  console.log("==================================================");

  try {
    const reviewsWithProduct = await prismaClient.review.findMany({
      where: {
        productId: {
          not: null,
        },
      },
    });

    console.log(`Found ${reviewsWithProduct.length} reviews with single productId.`);

    let migratedCount = 0;
    let skippedCount = 0;

    for (const review of reviewsWithProduct) {
      if (!review.productId) continue;

      // Check if Product exists
      const product = await prismaClient.product.findUnique({
        where: { id: review.productId },
      });

      if (!product) {
        console.warn(`Product ${review.productId} not found for review ${review.id}. Skipping.`);
        continue;
      }

      // Check if association already exists
      const existingAssoc = await prismaClient.productReview.findUnique({
        where: {
          productId_reviewId: {
            productId: review.productId,
            reviewId: review.id,
          },
        },
      });

      if (!existingAssoc) {
        await prismaClient.productReview.create({
          data: {
            productId: review.productId,
            reviewId: review.id,
            createdAt: review.createdAt,
          },
        });
        migratedCount++;
      } else {
        skippedCount++;
      }
    }

    console.log(`✅ Data Migration Complete: ${migratedCount} associations created, ${skippedCount} already existed.`);
  } catch (error) {
    console.error("❌ Data Migration Error:", error);
  } finally {
    await prismaClient.$disconnect();
  }
}

if (require.main === module) {
  migrateReviewsToManyToMany();
}
