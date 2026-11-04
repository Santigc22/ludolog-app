import { z } from "zod";

export const HealthResponseSchema = z.object({
  status: z.literal("ok"),
  service: z.string().trim().min(1),
});

export const DatabaseHealthResponseSchema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("ok"),
    service: z.literal("database"),
  }),
  z.object({
    status: z.literal("unavailable"),
    service: z.literal("database"),
  }),
]);

export type HealthResponse = z.infer<typeof HealthResponseSchema>;
export type DatabaseHealthResponse = z.infer<
  typeof DatabaseHealthResponseSchema
>;
