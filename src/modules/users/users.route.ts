import { Router } from "express";
import { authenticate, authorizeRoles } from "../../middlewares/auth";
import validateRequest from "../../middlewares/validateRequest";
import { changeUserRole, getUserDetails, listUsers, removeUser } from "./users.controller";
import { updateUserRoleValidationSchema } from "./users.validation";

const router = Router();

router.use(authenticate, authorizeRoles("ADMIN", "SUPER_ADMIN"));

router.get("/", listUsers);
router.get("/:id", getUserDetails);
/**
 * @swagger
 * /users/{id}/role:
 *   patch:
 *     summary: Change User Role
 *     tags:
 *       - Users
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           example:
 *             role: "ADMIN"
 *     responses:
 *       200:
 *         description: User role updated successfully
 */
router.patch("/:id/role", validateRequest(updateUserRoleValidationSchema), changeUserRole);
router.delete("/:id", removeUser);

export default router;