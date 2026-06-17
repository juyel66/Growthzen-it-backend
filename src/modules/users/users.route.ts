import { Router } from "express";
import { authenticate, authorizeRoles } from "../../middlewares/auth";
import validateRequest from "../../middlewares/validateRequest";
import { changeUserRole, getUserDetails, listUsers, removeUser } from "./users.controller";
import { updateUserRoleValidationSchema } from "./users.validation";

const router = Router();

router.use(authenticate, authorizeRoles("ADMIN", "SUPER_ADMIN"));

router.get("/", listUsers);
router.get("/:id", getUserDetails);
router.patch("/:id/role", validateRequest(updateUserRoleValidationSchema), changeUserRole);
router.delete("/:id", removeUser);

export default router;