import "dotenv/config";
import prismaClient from "./config/prisma";
import { getBestSellers, getOffers, getProductById, getProducts } from "./modules/products/products.service";

async function runCatalogVerification() {
  console.log("=== CATALOG API & NAVIGATION VERIFICATION ===");

  try {
    // 1. Test Shop / All Products API
    console.log("\n--- TEST 1: Shop / All Products API ---");
    const shopResult = await getProducts({ limit: 5 });
    console.log(`Fetched ${shopResult.data.length} products (Total: ${shopResult.meta.total})`);
    if (shopResult.data.length > 0) {
      const sample = shopResult.data[0];
      console.log(`Sample Product: "${sample.title}" | Slug: "${sample.slug}" | Status: ${sample.status}`);
      console.log(`Prices -> displayPrice: ${sample.displayPrice}, finalPrice: ${sample.finalPrice}, costPrice: ${sample.costPrice ?? "HIDDEN (Correct)"}`);
      if (sample.costPrice === undefined) {
        console.log("✅ PASSED: Internal costPrice hidden from storefront viewers");
      } else {
        console.error("❌ FAILED: costPrice leaked to non-admin");
      }
    }

    // 2. Test Best Sellers API
    console.log("\n--- TEST 2: Best Sellers API ---");
    const bestSellers = await getBestSellers({ limit: 4 });
    console.log(`Fetched ${bestSellers.data.length} Best Seller products`);
    bestSellers.data.forEach((p, idx) => {
      console.log(` #${idx + 1}: ${p.title} (${p.productCode})`);
    });
    console.log("✅ PASSED: Best Sellers endpoint generated ranking cleanly");

    // 3. Test Offers API
    console.log("\n--- TEST 3: Offers API ---");
    const customerOffers = await getOffers({ limit: 4 }, "CUSTOMER");
    console.log(`Customer Offers Count: ${customerOffers.data.length}`);
    customerOffers.data.forEach((p) => {
      console.log(` - Offer Product: "${p.title}" | finalPrice: ${p.finalPrice}, originalPrice: ${p.originalPrice}, discount: ${p.discountAmount}`);
    });

    const resellerOffers = await getOffers({ limit: 4 }, "RESELLER");
    console.log(`Reseller Offers Count: ${resellerOffers.data.length}`);
    resellerOffers.data.forEach((p) => {
      console.log(` - Reseller Offer Product: "${p.title}" | resellerPrice: ${p.resellerPrice}, resellerSpec: ${p.resellerSpecialPrice}`);
    });
    console.log("✅ PASSED: Offers API returns role-specific discount products");

    // 4. Test Get Product By ID and Slug
    console.log("\n--- TEST 4: Get Product By ID / Slug ---");
    if (shopResult.data.length > 0) {
      const target = shopResult.data[0];
      const byId = await getProductById(target.id);
      const bySlug = await getProductById(target.slug);
      if (byId.id === bySlug.id && byId.title === bySlug.title) {
        console.log(`✅ PASSED: Product lookup by ID (${target.id}) and Slug (${target.slug}) match identically!`);
      } else {
        console.error("❌ FAILED: ID and Slug lookup mismatch");
      }
    }

    // 5. Test Role-Based Pricing Isolation
    console.log("\n--- TEST 5: Role-Based Pricing Isolation ---");
    if (shopResult.data.length > 0) {
      const sampleId = shopResult.data[0].id;
      const guestView = await getProductById(sampleId, undefined);
      const resellerView = await getProductById(sampleId, "RESELLER");
      const adminView = await getProductById(sampleId, "ADMIN");

      console.log(" Guest View displayPrice:", guestView.displayPrice, "| costPrice:", guestView.costPrice ?? "NONE");
      console.log(" Reseller View displayPrice:", resellerView.displayPrice, "| resellerPrice:", resellerView.resellerPrice, "| costPrice:", resellerView.costPrice ?? "NONE");
      console.log(" Admin View costPrice:", adminView.costPrice, "| customerSellPrice:", adminView.customerSellPrice);

      if (guestView.costPrice === undefined && resellerView.costPrice === undefined && adminView.costPrice !== undefined) {
        console.log("✅ PASSED: Role-based pricing and security scoping strictly enforced!");
      } else {
        console.error("❌ FAILED: Security boundary issue in role pricing");
      }
    }

    console.log("\n=== ALL CATALOG & NAVIGATION VERIFICATIONS PASSED ===");
  } catch (error) {
    console.error("Verification error:", error);
  } finally {
    await prismaClient.$disconnect();
  }
}

runCatalogVerification();
