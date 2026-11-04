import { z } from "zod";

import {
  PaginationMetaSchema,
  PaginationQuerySchema,
} from "../common/pagination.contracts.js";

const nullableDescription = z.string().trim().min(1).max(2_000).nullable();

export const CollectionTypeSchema = z.literal("PERSONAL");
export const CollectionStatusSchema = z.enum(["ACTIVE", "ARCHIVED"]);
export const CollectionVisibilitySchema = z.enum(["PRIVATE", "PUBLIC"]);
export const CollectionRoleSchema = z.enum([
  "OWNER",
  "MANAGER",
  "MEMBER",
  "VIEWER",
]);

export const CreateCollectionRequestSchema = z
  .object({
    name: z.string().trim().min(1).max(140),
    description: nullableDescription.optional(),
    visibility: CollectionVisibilitySchema.optional().default("PRIVATE"),
  })
  .strict();

export const CollectionSchema = z.object({
  id: z.uuid(),
  type: CollectionTypeSchema,
  status: CollectionStatusSchema,
  name: z.string().min(1).max(140),
  description: z.string().nullable(),
  visibility: CollectionVisibilitySchema,
  isForSale: z.boolean(),
  gameCount: z.number().int().nonnegative(),
  createdByUserId: z.uuid(),
  effectiveRole: CollectionRoleSchema,
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  archivedAt: z.iso.datetime().nullable(),
});

export const CreateCollectionResponseSchema = z.object({
  collection: CollectionSchema,
});

export const CollectionListQuerySchema = PaginationQuerySchema.extend({
  includeArchived: z
    .enum(["true", "false"])
    .optional()
    .default("false")
    .transform((value) => value === "true"),
}).strict();

export const CollectionListResponseSchema = z.object({
  collections: z.array(CollectionSchema),
  pagination: PaginationMetaSchema,
});

export const CollectionIdParamsSchema = z.object({
  collectionId: z.uuid(),
});

export const CollectionDetailSchema = CollectionSchema.extend({
  effectiveRole: CollectionRoleSchema.nullable(),
  canEdit: z.boolean(),
});

export const CollectionDetailResponseSchema = z.object({
  collection: CollectionDetailSchema,
});

export const UpdateCollectionRequestSchema = z
  .object({
    name: z.string().trim().min(1).max(140).optional(),
    description: nullableDescription.optional(),
    visibility: CollectionVisibilitySchema.optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one collection field is required.",
  });

export type CreateCollectionRequest = z.input<
  typeof CreateCollectionRequestSchema
>;
export type NormalizedCreateCollectionRequest = z.output<
  typeof CreateCollectionRequestSchema
>;
export type Collection = z.infer<typeof CollectionSchema>;
export type CreateCollectionResponse = z.infer<
  typeof CreateCollectionResponseSchema
>;
export type CollectionListQuery = z.output<typeof CollectionListQuerySchema>;
export type CollectionListResponse = z.infer<
  typeof CollectionListResponseSchema
>;
export type CollectionIdParams = z.infer<typeof CollectionIdParamsSchema>;
export type CollectionDetail = z.infer<typeof CollectionDetailSchema>;
export type CollectionDetailResponse = z.infer<
  typeof CollectionDetailResponseSchema
>;
export type UpdateCollectionRequest = z.input<
  typeof UpdateCollectionRequestSchema
>;
export type NormalizedUpdateCollectionRequest = z.output<
  typeof UpdateCollectionRequestSchema
>;
