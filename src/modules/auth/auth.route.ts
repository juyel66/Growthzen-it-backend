import { Router } from "express";
import {
  changePasswordHandler,
  forgotPasswordHandler,
  getMe,
  loginUser,
  logoutUser,
  refreshTokenHandler,
  registerUser,
  resetPasswordHandler,
  verifyOtpHandler,
} from "./auth.controller";
import validateRequest from "../../middlewares/validateRequest";
import { authenticate } from "../../middlewares/auth";
import {
  changePasswordValidationSchema,
  emailOnlyValidationSchema,
  loginValidationSchema,
  refreshTokenValidationSchema,
  registerValidationSchema,
  resetPasswordValidationSchema,
  verifyOtpValidationSchema,
} from "./auth.validation";

const router = Router();

router.post("/register", validateRequest(registerValidationSchema), registerUser);
router.post("/login", validateRequest(loginValidationSchema), loginUser);
router.get("/me", authenticate, getMe);
router.post("/logout", authenticate, logoutUser);
router.post("/forgot-password", validateRequest(emailOnlyValidationSchema), forgotPasswordHandler);
router.post("/verify-otp", validateRequest(verifyOtpValidationSchema), verifyOtpHandler);
router.post("/reset-password", validateRequest(resetPasswordValidationSchema), resetPasswordHandler);
router.post("/refresh-token", validateRequest(refreshTokenValidationSchema), refreshTokenHandler);
router.patch("/change-password", authenticate, validateRequest(changePasswordValidationSchema), changePasswordHandler);

export default router; 