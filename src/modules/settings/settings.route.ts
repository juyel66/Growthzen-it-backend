import { Router } from "express";
import { authenticate, authorizeRoles } from "../../middlewares/auth";
import validateRequest from "../../middlewares/validateRequest";
import { getSettingsHandler, updateSettingsHandler } from "./settings.controller";
import { updateSettingsValidationSchema } from "./settings.validation";

const router = Router();

router.use(authenticate, authorizeRoles("ADMIN", "SUPER_ADMIN"));

router.get("/", getSettingsHandler);
router.patch("/", validateRequest(updateSettingsValidationSchema), updateSettingsHandler);

export default router;