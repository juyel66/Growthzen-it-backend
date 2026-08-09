import { z } from "zod";

export const updateUserRoleValidationSchema = z.object({
  role: z.enum(["ADMIN", "RESELLER", "CUSTOMER"]),
});