import { z } from "zod";

export const ApiEnvironmentSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]),
  API_PORT: z.coerce.number().int().min(1).max(65_535),
  WEB_ORIGIN: z
    .url()
    .refine(
      (value) => value.startsWith("http://") || value.startsWith("https://"),
      "WEB_ORIGIN must use HTTP or HTTPS",
    ),
  DATABASE_URL: z
    .url()
    .refine(
      (value) =>
        value.startsWith("postgresql://") || value.startsWith("postgres://"),
      "DATABASE_URL must use the PostgreSQL protocol",
    ),
  MEDIA_STORAGE_PATH: z.string().trim().min(1).default(".data/media"),
  MEDIA_MAX_UPLOAD_BYTES: z.coerce
    .number()
    .int()
    .min(1_024)
    .max(25 * 1_024 * 1_024)
    .default(8 * 1_024 * 1_024),
});

export type ApiEnvironment = z.infer<typeof ApiEnvironmentSchema>;
