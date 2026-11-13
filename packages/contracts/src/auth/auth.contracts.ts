import { z } from "zod";

export const RegisterRequestSchema = z.object({
  email: z
    .email()
    .max(320)
    .transform((value) => value.trim().toLowerCase()),
  username: z
    .string()
    .trim()
    .min(3)
    .max(80)
    .regex(/^[a-zA-Z0-9_-]+$/)
    .transform((value) => value.toLowerCase()),
  password: z.string().min(15).max(128),
  displayName: z.string().trim().min(1).max(120).optional(),
});

export const AuthenticatedUserSchema = z.object({
  id: z.uuid(),
  email: z.email(),
  username: z.string().min(1),
  status: z.literal("ACTIVE"),
  profile: z.object({
    displayName: z.string().nullable(),
    visibility: z.enum(["PRIVATE", "PUBLIC"]),
  }),
});

export const RegisterResponseSchema = z.object({
  user: AuthenticatedUserSchema,
  csrfToken: z.string().min(32),
});

export const LoginRequestSchema = z.object({
  email: z
    .email()
    .max(320)
    .transform((value) => value.trim().toLowerCase()),
  password: z.string().min(1).max(128),
});

export const SessionResponseSchema = RegisterResponseSchema;

export const GlobalRoleSchema = z.enum([
  "USER",
  "MODERATOR",
  "CONTENT_MANAGER",
  "ADMIN",
]);

export const CurrentSessionResponseSchema = z.object({
  user: AuthenticatedUserSchema.extend({
    roles: z.array(GlobalRoleSchema).min(1),
  }),
});

export const LogoutResponseSchema = z.object({
  loggedOut: z.literal(true),
});

export type RegisterRequest = z.input<typeof RegisterRequestSchema>;
export type NormalizedRegisterRequest = z.output<typeof RegisterRequestSchema>;
export type RegisterResponse = z.infer<typeof RegisterResponseSchema>;
export type LoginRequest = z.input<typeof LoginRequestSchema>;
export type NormalizedLoginRequest = z.output<typeof LoginRequestSchema>;
export type SessionResponse = z.infer<typeof SessionResponseSchema>;
export type GlobalRole = z.infer<typeof GlobalRoleSchema>;
export type CurrentSessionResponse = z.infer<
  typeof CurrentSessionResponseSchema
>;
export type LogoutResponse = z.infer<typeof LogoutResponseSchema>;
