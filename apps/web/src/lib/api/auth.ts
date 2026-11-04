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

export async function registerAccount(input: RegisterRequest) {
  const body = RegisterRequestSchema.parse(input);

  return apiFetch("auth/register", RegisterResponseSchema, {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify(body),
  });
}

export async function login(input: LoginRequest) {
  const body = LoginRequestSchema.parse(input);

  return apiFetch("auth/login", RegisterResponseSchema, {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify(body),
  });
}

export function getCurrentSession() {
  return apiFetch("auth/me", CurrentSessionResponseSchema, {
    cache: "no-store",
  });
}

export function logout() {
  return apiFetch("auth/logout", LogoutResponseSchema, {
    method: "POST",
    headers: {
      "x-csrf-token": readBrowserCookie("XSRF-TOKEN") ?? "",
    },
  });
}
