import { z } from "zod";

export const ErrorDetailSchema = z.record(z.string(), z.unknown()).nullable();

export const PublicErrorSchema = z.object({
  code: z.string().trim().min(1),
  message: z.string().trim().min(1),
  details: ErrorDetailSchema,
  requestId: z.string().trim().min(1),
});

export const ErrorResponseSchema = z.object({
  error: PublicErrorSchema,
});

export type PublicError = z.infer<typeof PublicErrorSchema>;
export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;
