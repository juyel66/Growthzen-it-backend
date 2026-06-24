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

/**
 * @swagger
 * /products:
 *   get:
 *     summary: Get all products
 *     tags:
 *       - Products
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Products retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Products retrieved successfully
 *                 data:
 *                   type: array
 *                   items:
 *                     oneOf:
 *                       - $ref: '#/components/schemas/PublicProductView'
 *                       - $ref: '#/components/schemas/ResellerProductView'
 *                       - $ref: '#/components/schemas/AdminProductView'
 */
router.get("/", optionalAuthenticate, getProductsHandler);

/**
 * @swagger
 * /products/{id}:
 *   get:
 *     summary: Get a product by ID
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
 *     responses:
 *       200:
 *         description: Product retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Product retrieved successfully
 *                 data:
 *                   oneOf:
 *                     - $ref: '#/components/schemas/PublicProductView'
 *                     - $ref: '#/components/schemas/ResellerProductView'
 *                     - $ref: '#/components/schemas/AdminProductView'
 *       404:
 *         description: Product not found
 */
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
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - description
 *               - category
 *               - originalPrice
 *               - customerSellPrice
 *               - resellerSellPrice
 *               - productCode
 *               - thumbnailImage
 *             properties:
 *               title:
 *                 type: string
 *                 example: "Wireless Mouse"
 *                 description: Product title
 *               description:
 *                 type: string
 *                 example: "High precision wireless mouse"
 *                 description: Product description
 *               hasSize:
 *                 type: boolean
 *                 example: false
 *                 description: Whether the product has sizes
 *               sizes:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: []
 *                 description: Available sizes (max 20)
 *               category:
 *                 type: string
 *                 example: "Electronics"
 *                 description: Product category
 *               originalPrice:
 *                 type: number
 *                 example: 1500
 *                 description: Original price
 *               customerSellPrice:
 *                 type: number
 *                 example: 1200
 *                 description: Customer selling price
 *               resellerSellPrice:
 *                 type: number
 *                 example: 1000
 *                 description: Reseller selling price
 *               couponCode:
 *                 type: string
 *                 example: "SUMMER20"
 *                 nullable: true
 *                 description: Coupon code (optional)
 *               couponDiscountPercentage:
 *                 type: number
 *                 example: 10
 *                 nullable: true
 *                 description: Coupon discount percentage (0-100)
 *               productCode:
 *                 type: string
 *                 example: "MOUSE-001"
 *                 description: Unique product code
 *               status:
 *                 type: string
 *                 enum: ["AVAILABLE", "COMING_SOON"]
 *                 example: "AVAILABLE"
 *                 description: Product status
 *               thumbnailImage:
 *                 type: string
 *                 example: "thumbnail.png"
 *                 description: Thumbnail image path
 *               productImages:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["image1.png", "image2.png"]
 *                 description: Product images (max 10)
 *               productVideos:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: []
 *                 description: Product videos (max 5)
 *               isFeatured:
 *                 type: boolean
 *                 example: true
 *                 description: Whether the product is featured
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
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Product created successfully
 *                 data:
 *                   $ref: '#/components/schemas/AdminProductView'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Only ADMIN and SUPER_ADMIN can access
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
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *                 example: "Updated Wireless Mouse"
 *                 description: Product title
 *               description:
 *                 type: string
 *                 example: "Updated high precision wireless mouse"
 *                 description: Product description
 *               hasSize:
 *                 type: boolean
 *                 example: false
 *                 description: Whether the product has sizes
 *               sizes:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: []
 *                 description: Available sizes (max 20)
 *               category:
 *                 type: string
 *                 example: "Electronics"
 *                 description: Product category
 *               originalPrice:
 *                 type: number
 *                 example: 1500
 *                 description: Original price
 *               customerSellPrice:
 *                 type: number
 *                 example: 1100
 *                 description: Customer selling price
 *               resellerSellPrice:
 *                 type: number
 *                 example: 900
 *                 description: Reseller selling price
 *               couponCode:
 *                 type: string
 *                 example: "SUMMER20"
 *                 nullable: true
 *                 description: Coupon code (optional)
 *               couponDiscountPercentage:
 *                 type: number
 *                 example: 10
 *                 nullable: true
 *                 description: Coupon discount percentage (0-100)
 *               productCode:
 *                 type: string
 *                 example: "MOUSE-001"
 *                 description: Unique product code
 *               status:
 *                 type: string
 *                 enum: ["AVAILABLE", "COMING_SOON"]
 *                 example: "AVAILABLE"
 *                 description: Product status
 *               thumbnailImage:
 *                 type: string
 *                 example: "updated_thumbnail.png"
 *                 description: Thumbnail image path
 *               productImages:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["image1.png", "image3.png"]
 *                 description: Product images (max 10)
 *               productVideos:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["video1.mp4"]
 *                 description: Product videos (max 5)
 *               isFeatured:
 *                 type: boolean
 *                 example: false
 *                 description: Whether the product is featured
 *           example:
 *             title: "Updated Wireless Mouse"
 *             customerSellPrice: 1100
 *     responses:
 *       200:
 *         description: Product updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Product updated successfully
 *                 data:
 *                   $ref: '#/components/schemas/AdminProductView'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Only ADMIN and SUPER_ADMIN can access
 *       404:
 *         description: Product not found
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
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - description
 *               - category
 *               - originalPrice
 *               - customerSellPrice
 *               - resellerSellPrice
 *               - productCode
 *               - thumbnailImage
 *             properties:
 *               title:
 *                 type: string
 *                 example: "Wireless Mouse Replacement"
 *                 description: Product title
 *               description:
 *                 type: string
 *                 example: "Replacement wireless mouse description"
 *                 description: Product description
 *               hasSize:
 *                 type: boolean
 *                 example: false
 *                 description: Whether the product has sizes
 *               sizes:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: []
 *                 description: Available sizes (max 20)
 *               category:
 *                 type: string
 *                 example: "Electronics"
 *                 description: Product category
 *               originalPrice:
 *                 type: number
 *                 example: 1500
 *                 description: Original price
 *               customerSellPrice:
 *                 type: number
 *                 example: 1200
 *                 description: Customer selling price
 *               resellerSellPrice:
 *                 type: number
 *                 example: 1000
 *                 description: Reseller selling price
 *               couponCode:
 *                 type: string
 *                 example: null
 *                 nullable: true
 *                 description: Coupon code (optional)
 *               couponDiscountPercentage:
 *                 type: number
 *                 example: 0
 *                 nullable: true
 *                 description: Coupon discount percentage (0-100)
 *               productCode:
 *                 type: string
 *                 example: "MOUSE-001"
 *                 description: Unique product code
 *               status:
 *                 type: string
 *                 enum: ["AVAILABLE", "COMING_SOON"]
 *                 example: "AVAILABLE"
 *                 description: Product status
 *               thumbnailImage:
 *                 type: string
 *                 example: "replacement_thumbnail.png"
 *                 description: Thumbnail image path
 *               productImages:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["replacement_image.png"]
 *                 description: Product images (max 10)
 *               productVideos:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: []
 *                 description: Product videos (max 5)
 *               isFeatured:
 *                 type: boolean
 *                 example: false
 *                 description: Whether the product is featured
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
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Product updated successfully
 *                 data:
 *                   $ref: '#/components/schemas/AdminProductView'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Only ADMIN and SUPER_ADMIN can access
 *       404:
 *         description: Product not found
 */
router.put("/:id", authenticate, authorizeRoles("ADMIN", "SUPER_ADMIN"), productUpload, mapProductUploadToBody, validateRequest(updateProductValidationSchema), updateProductHandler);

/**
 * @swagger
 * /products/{id}:
 *   delete:
 *     summary: Delete a product
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
 *     responses:
 *       200:
 *         description: Product deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Product deleted successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Only ADMIN and SUPER_ADMIN can access
 *       404:
 *         description: Product not found
 */
router.delete("/:id", authenticate, authorizeRoles("ADMIN", "SUPER_ADMIN"), deleteProductHandler);

export default router;