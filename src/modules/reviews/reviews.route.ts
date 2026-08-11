import { Router } from "express";
import { authenticate, authorizeRoles, optionalAuthenticate } from "../../middlewares/auth";
import { reviewUpload, mapReviewUploadToBody } from "../../middlewares/upload";
import validateRequest from "../../middlewares/validateRequest";
import * as controller from "./reviews.controller";
import {
  createReviewSchema,
  createPublicReviewSchema,
  submitVerifiedReviewSchema,
  adminUpdateReviewSchema,
} from "./reviews.validation";
import type { Role } from "@prisma/client";

const router = Router();
export const adminReviewRouter = Router();

// ==================================================
// PUBLIC REVIEW ENDPOINTS (NO LOGIN REQUIRED)
// ==================================================

/**
 * @openapi
 * /reviews/public:
 *   post:
 *     tags:
 *       - review
 *     summary: Submit a public product review (no login required, pending admin approval)
 */
router.post(
  "/public",
  validateRequest(createPublicReviewSchema),
  controller.createPublicReviewHandler
);

/**
 * @openapi
 * /reviews/verify/{token}:
 *   get:
 *     tags:
 *       - review
 *     summary: Verify a delivery email review token (no login required)
 */
router.get(
  "/verify/:token",
  controller.verifyReviewTokenHandler
);

/**
 * @openapi
 * /reviews/verify/{token}:
 *   post:
 *     tags:
 *       - review
 *     summary: Submit a verified purchase review using delivery email token (no login required)
 */
router.post(
  "/verify/:token",
  validateRequest(submitVerifiedReviewSchema),
  controller.submitVerifiedReviewHandler
);

/**
 * @openapi
 * /reviews/product/{productId}:
 *   get:
 *     tags:
 *       - review
 *     summary: Get public published reviews and stats for a product
 */
router.get(
  "/product/:productId",
  optionalAuthenticate,
  controller.getProductReviewsHandler
);

// ==================================================
// AUTHENTICATED CUSTOMER REVIEW ENDPOINTS
// ==================================================

/**
 * Submit review for an order item (logged in customer)
 */
router.post(
  "/",
  authenticate,
  reviewUpload,
  mapReviewUploadToBody,
  validateRequest(createReviewSchema),
  controller.createReviewHandler
);

/**
 * Get reviews submitted by current user
 */
router.get(
  "/my",
  authenticate,
  controller.getMyReviewsHandler
);

/**
 * Get autofill review form data for an order item
 */
router.get(
  "/form/:orderItemId",
  authenticate,
  controller.getReviewFormHandler
);

// ==================================================
// ADMIN REVIEW ENDPOINTS
// ==================================================

// Setup routes on adminReviewRouter for /api/v1/admin/reviews
adminReviewRouter.use(authenticate, authorizeRoles("ADMIN" as Role, "SUPER_ADMIN" as Role));

adminReviewRouter.get("/", controller.adminListReviewsHandler);
adminReviewRouter.get("/:id", controller.adminGetReviewHandler);
adminReviewRouter.patch("/:id", validateRequest(adminUpdateReviewSchema), controller.updateReviewHandler);
adminReviewRouter.delete("/:id", controller.deleteReviewHandler);

// Also attach admin routes on main router /reviews for backward compatibility
router.get(
  "/",
  authenticate,
  authorizeRoles("ADMIN" as Role, "SUPER_ADMIN" as Role),
  controller.adminListReviewsHandler
);

router.get(
  "/:id",
  authenticate,
  authorizeRoles("ADMIN" as Role, "SUPER_ADMIN" as Role),
  controller.adminGetReviewHandler
);

router.patch(
  "/:id",
  authenticate,
  authorizeRoles("ADMIN" as Role, "SUPER_ADMIN" as Role),
  validateRequest(adminUpdateReviewSchema),
  controller.updateReviewHandler
);

router.delete(
  "/:id",
  authenticate,
  authorizeRoles("ADMIN" as Role, "SUPER_ADMIN" as Role),
  controller.deleteReviewHandler
);

export default router;
