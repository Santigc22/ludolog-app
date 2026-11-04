import { parsePublicEnvironment } from "./public-env.schema";

export const publicEnvironment = parsePublicEnvironment({
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
});

export function getPublicApiBaseUrl(): string {
  return publicEnvironment.NEXT_PUBLIC_API_URL.replace(/\/$/, "");
}
