import { Router } from "express";
import { authenticate, authorizeRoles, optionalAuthenticate } from "../../middlewares/auth";
import validateRequest from "../../middlewares/validateRequest";
import {
  createOrderHandler,
  getMyOrdersHandler,
  getOrderByIdHandler,
  getOrdersHandler,
  updateOrderStatusHandler,
  trackOrderHandler,
} from "./orders.controller";
import { createOrderValidationSchema, orderStatusUpdateValidationSchema } from "./orders.validation";

const router = Router();

/**
 * @swagger
 * /orders:
 *   post:
 *     summary: Create an order
 *     tags:
 *       - Orders
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           example:
 *             products:
 *               - productId: "product-id-123"
 *                 quantity: 2
 *                 size: "XL"
 *             customerName: "Md Juyel Rana"
 *             customerPhone: "01700000000"
 *             deliveryArea: "INSIDE_DHAKA"
 *             address: "Dhaka, Bangladesh"
 *             couponCode: "WINTER25"
 *     responses:
 *       201:
 *         description: Order created successfully
 */
router.post("/", optionalAuthenticate, validateRequest(createOrderValidationSchema), createOrderHandler);
router.get("/my-orders", authenticate, authorizeRoles("CUSTOMER", "RESELLER", "ADMIN", "SUPER_ADMIN"), getMyOrdersHandler);
router.get("/", authenticate, authorizeRoles("ADMIN", "SUPER_ADMIN"), getOrdersHandler);
router.get("/track/:orderCode", trackOrderHandler);
router.get("/:id", authenticate, getOrderByIdHandler);

/**
 * @swagger
 * /orders/{id}/status:
 *   patch:
 *     summary: Update order status
 *     tags:
 *       - Orders
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Order ID or Order Code
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           example:
 *             status: "CONFIRMED"
 *             adminNote: "Customer confirmed via phone call."
 *     responses:
 *       200:
 *         description: Order status updated successfully
 */
router.patch("/:id/status", authenticate, authorizeRoles("ADMIN", "SUPER_ADMIN"), validateRequest(orderStatusUpdateValidationSchema), updateOrderStatusHandler);

export default router;