import { z } from "zod";

export const PublicEnvironmentSchema = z.object({
  NEXT_PUBLIC_API_URL: z
    .url()
    .refine(
      (value) => value.startsWith("http://") || value.startsWith("https://"),
      "NEXT_PUBLIC_API_URL must use HTTP or HTTPS",
    ),
});

export function parsePublicEnvironment(
  environment: Readonly<Record<string, string | undefined>>,
) {
  const result = PublicEnvironmentSchema.safeParse({
    NEXT_PUBLIC_API_URL: environment.NEXT_PUBLIC_API_URL,
  });

  if (!result.success) {
    const message = result.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");

    throw new Error(`Invalid public web environment variables: ${message}`);
  }

  return Object.freeze(result.data);
}
