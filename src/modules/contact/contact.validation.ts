import { z } from "zod";

export const createContactMessageValidationSchema = z.object({
  name: z
    .string({ message: "Name is required" })
    .trim()
    .min(2, "Name must be at least 2 characters long")
    .max(100, "Name cannot exceed 100 characters")
    .refine((val) => val.trim().length > 0, { message: "Name cannot be empty or whitespace only" }),
  email: z
    .string({ message: "Email is required" })
    .trim()
    .email("Please enter a valid email address")
    .max(255, "Email cannot exceed 255 characters"),
  subject: z
    .string()
    .trim()
    .max(150, "Subject cannot exceed 150 characters")
    .optional()
    .nullable()
    .transform((val) => (val && val.trim().length > 0 ? val.trim() : null)),
  message: z
    .string({ message: "Message is required" })
    .trim()
    .min(5, "Message must be at least 5 characters long")
    .max(2000, "Message cannot exceed 2000 characters")
    .refine((val) => val.trim().length > 0, { message: "Message cannot be empty or whitespace only" }),
});

export const updateContactMessageStatusValidationSchema = z.object({
  status: z.enum(["UNREAD", "READ"], {
    message: "Status must be either UNREAD or READ",
  }),
});
