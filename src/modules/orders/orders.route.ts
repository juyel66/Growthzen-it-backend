import { Router } from "express";
import { authenticate, authorizeRoles } from "../../middlewares/auth";
import validateRequest from "../../middlewares/validateRequest";
import {
  createOrderHandler,
  getMyOrdersHandler,
  getOrderByIdHandler,
  getOrdersHandler,
  updateOrderStatusHandler,
} from "./orders.controller";
import { createOrderValidationSchema, orderStatusUpdateValidationSchema } from "./orders.validation";

const router = Router();

router.post("/", authenticate, authorizeRoles("CUSTOMER", "RESELLER"), validateRequest(createOrderValidationSchema), createOrderHandler);
router.get("/my-orders", authenticate, authorizeRoles("CUSTOMER", "RESELLER", "ADMIN", "SUPER_ADMIN"), getMyOrdersHandler);
router.get("/", authenticate, authorizeRoles("ADMIN", "SUPER_ADMIN"), getOrdersHandler);
router.get("/:id", authenticate, getOrderByIdHandler);
router.patch("/:id/status", authenticate, authorizeRoles("ADMIN", "SUPER_ADMIN"), validateRequest(orderStatusUpdateValidationSchema), updateOrderStatusHandler);

export default router;