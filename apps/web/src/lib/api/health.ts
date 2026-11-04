import { HealthResponseSchema } from "@ludoteca/contracts";

import { apiFetch } from "./client";

type ApiHealth =
  | { available: true; service: string }
  | { available: false; service: null };

export async function getApiHealth(): Promise<ApiHealth> {
  try {
    const health = await apiFetch("health", HealthResponseSchema, {
      cache: "no-store",
    });

    return { available: true, service: health.service };
  } catch {
    return { available: false, service: null };
  }
}
