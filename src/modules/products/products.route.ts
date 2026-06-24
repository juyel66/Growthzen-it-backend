import { Router } from "express";
import { authenticate, authorizeRoles, optionalAuthenticate } from "../../middlewares/auth";
import { mapProductUploadToBody, productUpload } from "../../middlewares/upload";
import validateRequest from "../../middlewares/validateRequest";
import {
  createProductHandler,
  deleteProductHandler,
  getProductByIdHandler,
  getProductsHandler,
  updateProductHandler,
} from "./products.controller";
import { createProductValidationSchema, updateProductValidationSchema } from "./products.validation";

const router = Router();

router.get("/", optionalAuthenticate, getProductsHandler);
router.get("/:id", optionalAuthenticate, getProductByIdHandler);
/**
 * @swagger
 * /products:
 *   post:
 *     summary: Create a product
 *     tags:
 *       - Products
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           example:
 *             title: "Wireless Mouse"
 *             description: "High precision wireless mouse"
 *             hasSize: false
 *             sizes: []
 *             category: "Electronics"
 *             originalPrice: 1500
 *             customerSellPrice: 1200
 *             resellerSellPrice: 1000
 *             couponCode: "SUMMER20"
 *             couponDiscountPercentage: 10
 *             productCode: "MOUSE-001"
 *             status: "AVAILABLE"
 *             thumbnailImage: "thumbnail.png"
 *             productImages: ["image1.png", "image2.png"]
 *             productVideos: []
 *             isFeatured: true
 *     responses:
 *       201:
 *         description: Product created successfully
 */
router.post("/", authenticate, authorizeRoles("ADMIN", "SUPER_ADMIN"), productUpload, mapProductUploadToBody, validateRequest(createProductValidationSchema), createProductHandler);

/**
 * @swagger
 * /products/{id}:
 *   patch:
 *     summary: Update a product (partial update)
 *     tags:
 *       - Products
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Product ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           example:
 *             title: "Updated Wireless Mouse"
 *             customerSellPrice: 1100
 *     responses:
 *       200:
 *         description: Product updated successfully
 */
router.patch("/:id", authenticate, authorizeRoles("ADMIN", "SUPER_ADMIN"), productUpload, mapProductUploadToBody, validateRequest(updateProductValidationSchema), updateProductHandler);

/**
 * @swagger
 * /products/{id}:
 *   put:
 *     summary: Replace a product (full update)
 *     tags:
 *       - Products
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Product ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           example:
 *             title: "Wireless Mouse Replacement"
 *             description: "Replacement wireless mouse description"
 *             hasSize: false
 *             sizes: []
 *             category: "Electronics"
 *             originalPrice: 1500
 *             customerSellPrice: 1200
 *             resellerSellPrice: 1000
 *             couponCode: null
 *             couponDiscountPercentage: 0
 *             productCode: "MOUSE-001"
 *             status: "AVAILABLE"
 *             thumbnailImage: "replacement_thumbnail.png"
 *             productImages: ["replacement_image.png"]
 *             productVideos: []
 *             isFeatured: false
 *     responses:
 *       200:
 *         description: Product replaced successfully
 */
router.put("/:id", authenticate, authorizeRoles("ADMIN", "SUPER_ADMIN"), productUpload, mapProductUploadToBody, validateRequest(updateProductValidationSchema), updateProductHandler);

router.delete("/:id", authenticate, authorizeRoles("ADMIN", "SUPER_ADMIN"), deleteProductHandler);

export default router;