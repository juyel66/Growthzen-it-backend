import { Router } from "express";
import authRoutes from "../modules/auth/auth.route";
import dashboardRoutes from "../modules/dashboardManagement/dashboard.route";
import orderRoutes from "../modules/orders/orders.route";
import settingsRoutes from "../modules/settings/settings.route";
import userRoutes from "../modules/users/users.route";
import productRoutes from "../modules/products/products.route";

const router = Router();

router.use("/auth", authRoutes);
router.use("/users", userRoutes);
router.use("/products", productRoutes);
router.use("/settings", settingsRoutes);
router.use("/orders", orderRoutes);
router.use("/dashboard-management", dashboardRoutes);

export default router;