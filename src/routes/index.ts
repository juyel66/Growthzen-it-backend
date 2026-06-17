import { Router } from "express";
import authRoutes from "../modules/auth/auth.route";
import userRoutes from "../modules/users/users.route";
import productRoutes from "../modules/products/products.route";

const router = Router();

router.use("/auth", authRoutes);
router.use("/users", userRoutes);
router.use("/products", productRoutes);

export default router;