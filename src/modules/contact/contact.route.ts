import { Router } from "express";
import { authenticate, authorizeRoles } from "../../middlewares/auth";
import { createSimpleRateLimiter } from "../../middlewares/rateLimiter";
import validateRequest from "../../middlewares/validateRequest";
import {
  createContactMessageHandler,
  deleteContactMessageHandler,
  getContactMessageByIdHandler,
  getContactMessagesHandler,
  getContactMessageStatsHandler,
  updateContactMessageStatusHandler,
} from "./contact.controller";
import {
  createContactMessageValidationSchema,
  updateContactMessageStatusValidationSchema,
} from "./contact.validation";

// Public submission rate limiter: max 5 contact submissions per 15 minutes per IP
const contactSubmissionLimiter = createSimpleRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: "Too many contact submissions from this IP. Please try again in 15 minutes.",
});

export const contactRoutes = Router();

/**
 * Public Contact Submission
 * POST /contact/messages
 */
contactRoutes.post(
  "/messages",
  contactSubmissionLimiter,
  validateRequest(createContactMessageValidationSchema),
  createContactMessageHandler
);

/**
 * Admin Contact Management Routes
 * Protected: ADMIN & SUPER_ADMIN only. CUSTOMER/RESELLER receive 403.
 */
export const adminContactRoutes = Router();

adminContactRoutes.use(authenticate, authorizeRoles("ADMIN", "SUPER_ADMIN"));

adminContactRoutes.get("/stats", getContactMessageStatsHandler);
adminContactRoutes.get("/", getContactMessagesHandler);
adminContactRoutes.get("/:id", getContactMessageByIdHandler);
adminContactRoutes.patch(
  "/:id/status",
  validateRequest(updateContactMessageStatusValidationSchema),
  updateContactMessageStatusHandler
);
adminContactRoutes.delete("/:id", deleteContactMessageHandler);

// Also attach admin handlers under contactRoutes for route convenience
contactRoutes.get("/messages/stats", authenticate, authorizeRoles("ADMIN", "SUPER_ADMIN"), getContactMessageStatsHandler);
contactRoutes.get("/messages", authenticate, authorizeRoles("ADMIN", "SUPER_ADMIN"), getContactMessagesHandler);
contactRoutes.get("/messages/:id", authenticate, authorizeRoles("ADMIN", "SUPER_ADMIN"), getContactMessageByIdHandler);
contactRoutes.patch(
  "/messages/:id/status",
  authenticate,
  authorizeRoles("ADMIN", "SUPER_ADMIN"),
  validateRequest(updateContactMessageStatusValidationSchema),
  updateContactMessageStatusHandler
);
contactRoutes.delete("/messages/:id", authenticate, authorizeRoles("ADMIN", "SUPER_ADMIN"), deleteContactMessageHandler);

export default contactRoutes;
