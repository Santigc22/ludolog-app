import {
  CurrentSessionResponseSchema,
  LoginRequestSchema,
  LogoutResponseSchema,
  RegisterRequestSchema,
  RegisterResponseSchema,
  type LoginRequest,
  type RegisterRequest,
} from "@ludoteca/contracts";

import { apiFetch, readBrowserCookie } from "./client";

const jsonHeaders = { "content-type": "application/json" };
export const SESSION_CHANGED_EVENT = "ludolog:session-changed";

function notifySessionChanged() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(SESSION_CHANGED_EVENT));
  }
}

export async function registerAccount(input: RegisterRequest) {
  const body = RegisterRequestSchema.parse(input);

  const response = await apiFetch("auth/register", RegisterResponseSchema, {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify(body),
  });
  notifySessionChanged();
  return response;
}

export async function login(input: LoginRequest) {
  const body = LoginRequestSchema.parse(input);

  const response = await apiFetch("auth/login", RegisterResponseSchema, {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify(body),
  });
  notifySessionChanged();
  return response;
}

export function getCurrentSession() {
  return apiFetch("auth/me", CurrentSessionResponseSchema, {
    cache: "no-store",
  });
}

export async function logout() {
  const response = await apiFetch("auth/logout", LogoutResponseSchema, {
    method: "POST",
    headers: {
      "x-csrf-token": readBrowserCookie("XSRF-TOKEN") ?? "",
    },
  });
  notifySessionChanged();
  return response;
}
