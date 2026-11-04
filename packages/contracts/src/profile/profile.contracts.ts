import { z } from "zod";

const nullableTrimmedText = (maximum: number) =>
  z.string().trim().min(1).max(maximum).nullable();
const httpUrl = z
  .url()
  .max(2_048)
  .refine(
    (value) => value.startsWith("http://") || value.startsWith("https://"),
    "URL must use HTTP or HTTPS.",
  );

export const ProfileVisibilitySchema = z.enum(["PRIVATE", "PUBLIC"]);

export const OwnProfileSchema = z.object({
  userId: z.uuid(),
  username: z.string().min(1),
  displayName: z.string().nullable(),
  bio: z.string().nullable(),
  avatarUrl: httpUrl.nullable(),
  locationText: z.string().nullable(),
  visibility: ProfileVisibilitySchema,
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const OwnProfileResponseSchema = z.object({
  profile: OwnProfileSchema,
});

export const UpdateOwnProfileRequestSchema = z
  .object({
    displayName: nullableTrimmedText(120).optional(),
    bio: nullableTrimmedText(2_000).optional(),
    avatarUrl: httpUrl.nullable().optional(),
    locationText: nullableTrimmedText(160).optional(),
    visibility: ProfileVisibilitySchema.optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one profile field is required.",
  });

export type OwnProfile = z.infer<typeof OwnProfileSchema>;
export type OwnProfileResponse = z.infer<typeof OwnProfileResponseSchema>;
export type UpdateOwnProfileRequest = z.input<
  typeof UpdateOwnProfileRequestSchema
>;
export type NormalizedUpdateOwnProfileRequest = z.output<
  typeof UpdateOwnProfileRequestSchema
>;
