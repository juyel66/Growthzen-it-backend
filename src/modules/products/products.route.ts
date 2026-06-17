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
router.post("/", authenticate, authorizeRoles("ADMIN", "SUPER_ADMIN"), productUpload, mapProductUploadToBody, validateRequest(createProductValidationSchema), createProductHandler);
router.patch("/:id", authenticate, authorizeRoles("ADMIN", "SUPER_ADMIN"), productUpload, mapProductUploadToBody, validateRequest(updateProductValidationSchema), updateProductHandler);
router.put("/:id", authenticate, authorizeRoles("ADMIN", "SUPER_ADMIN"), productUpload, mapProductUploadToBody, validateRequest(updateProductValidationSchema), updateProductHandler);
router.delete("/:id", authenticate, authorizeRoles("ADMIN", "SUPER_ADMIN"), deleteProductHandler);

export default router;