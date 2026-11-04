import { z } from "zod";

import {
  PaginationMetaSchema,
  PaginationQuerySchema,
} from "../common/pagination.contracts.js";

export const CopyLifecycleSchema = z.enum(["ACTIVE", "EXITED"]);
export const CopyConditionSchema = z.enum([
  "NEW",
  "LIKE_NEW",
  "GOOD",
  "FAIR",
  "POOR",
  "DAMAGED",
]);
export const CopyExitReasonSchema = z.enum([
  "SOLD",
  "TRADED",
  "GIFTED",
  "DONATED",
  "LOST",
  "DISCARDED",
  "DAMAGED",
  "OTHER",
]);
export const AcquisitionTypeSchema = z.enum([
  "PURCHASE",
  "GIFT",
  "TRADE",
  "INHERITED",
  "WON",
  "OTHER",
]);

const nullableText = (maximum: number) =>
  z.string().trim().min(1).max(maximum).nullable();

export const CreateAcquisitionRequestSchema = z
  .object({
    type: AcquisitionTypeSchema,
    acquiredOn: z.iso.date().nullable().optional(),
    priceAmount: z
      .number()
      .nonnegative()
      .max(9_999_999_999.99)
      .nullable()
      .optional(),
    currencyCode: z
      .string()
      .trim()
      .length(3)
      .toUpperCase()
      .nullable()
      .optional(),
    sourceName: nullableText(180).optional(),
    notes: nullableText(2_000).optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if ((value.priceAmount == null) !== (value.currencyCode == null)) {
      context.addIssue({
        code: "custom",
        message: "Price amount and currency code must be provided together.",
        path: [value.priceAmount == null ? "priceAmount" : "currencyCode"],
      });
    }
  });

export const CreateCopyRequestSchema = z
  .object({
    gameId: z.uuid(),
    gameEditionId: z.uuid().nullable().optional(),
    condition: CopyConditionSchema.optional().default("GOOD"),
    alias: nullableText(140).optional(),
    notes: nullableText(2_000).optional(),
    acquisition: CreateAcquisitionRequestSchema.optional(),
  })
  .strict();

export const UpdateCopyRequestSchema = z
  .object({
    condition: CopyConditionSchema.optional(),
    alias: nullableText(140).optional(),
    notes: nullableText(2_000).optional(),
  })
  .strict()
  .refine(
    (value) =>
      value.condition !== undefined ||
      value.alias !== undefined ||
      value.notes !== undefined,
    { message: "At least one editable field is required." },
  );

export const MoveCopyRequestSchema = z
  .object({ destinationCollectionId: z.uuid() })
  .strict();

export const ExitCopyRequestSchema = z
  .object({ reason: CopyExitReasonSchema })
  .strict();

export const CopySchema = z.object({
  id: z.uuid(),
  gameId: z.uuid(),
  gameEditionId: z.uuid().nullable(),
  currentCollectionId: z.uuid().nullable(),
  lifecycle: CopyLifecycleSchema,
  condition: CopyConditionSchema,
  alias: z.string().nullable(),
  notes: z.string().nullable(),
  exitReason: z.string().nullable(),
  exitedAt: z.iso.datetime().nullable(),
  createdByUserId: z.uuid(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const AcquisitionSchema = z.object({
  id: z.uuid(),
  copyId: z.uuid(),
  collectionId: z.uuid(),
  acquiredByUserId: z.uuid(),
  type: AcquisitionTypeSchema,
  acquiredOn: z.iso.date().nullable(),
  priceAmount: z.number().nullable(),
  currencyCode: z.string().nullable(),
  sourceName: z.string().nullable(),
  notes: z.string().nullable(),
  createdAt: z.iso.datetime(),
});

export const CreateCopyResponseSchema = z.object({
  copy: CopySchema,
  acquisition: AcquisitionSchema.nullable(),
});

export const CopyListLifecycleFilterSchema = z.enum([
  "ACTIVE",
  "EXITED",
  "ALL",
]);
export const CopyListQuerySchema = PaginationQuerySchema.extend({
  lifecycle: CopyListLifecycleFilterSchema.optional().default("ACTIVE"),
  q: z.string().trim().min(1).max(100).optional(),
  mechanic: z.string().trim().min(1).max(100).optional(),
  minPlayers: z.coerce.number().int().min(1).max(32_767).optional(),
  maxPlayers: z.coerce.number().int().min(1).max(32_767).optional(),
})
  .strict()
  .superRefine((value, context) => {
    if (
      value.minPlayers !== undefined &&
      value.maxPlayers !== undefined &&
      value.maxPlayers < value.minPlayers
    ) {
      context.addIssue({
        code: "custom",
        message:
          "Maximum players must be greater than or equal to minimum players.",
        path: ["maxPlayers"],
      });
    }
  });

export const CopyGameReferenceSchema = z.object({
  id: z.uuid(),
  name: z.string().min(1),
  minPlayers: z.number().int().min(1),
  maxPlayers: z.number().int().min(1),
  mechanics: z.array(z.string().min(1).max(120)),
});
export const CopyEditionReferenceSchema = z.object({
  id: z.uuid(),
  editionName: z.string().nullable(),
  editionNumber: z.string().nullable(),
  languageCode: z.string().nullable(),
  publicationYear: z.number().int().nullable(),
});
export const CopyListItemSchema = CopySchema.extend({
  game: CopyGameReferenceSchema,
  edition: CopyEditionReferenceSchema.nullable(),
});
export const CopyListResponseSchema = z.object({
  copies: z.array(CopyListItemSchema),
  pagination: PaginationMetaSchema,
});

export const CopyIdParamsSchema = z.object({ copyId: z.uuid() });
export const CopyCollectionHistorySchema = z.object({
  id: z.uuid(),
  collectionId: z.uuid(),
  collectionName: z.string(),
  startedAt: z.iso.datetime(),
  endedAt: z.iso.datetime().nullable(),
});
export const CopyDetailSchema = CopyListItemSchema.extend({
  collectionHistory: z.array(CopyCollectionHistorySchema),
  acquisitions: z.array(AcquisitionSchema),
});
export const CopyDetailResponseSchema = z.object({ copy: CopyDetailSchema });

export type Copy = z.infer<typeof CopySchema>;
export type Acquisition = z.infer<typeof AcquisitionSchema>;
export type CreateCopyRequest = z.input<typeof CreateCopyRequestSchema>;
export type NormalizedCreateCopyRequest = z.output<
  typeof CreateCopyRequestSchema
>;
export type NormalizedCreateAcquisitionRequest = z.output<
  typeof CreateAcquisitionRequestSchema
>;
export type CreateCopyResponse = z.infer<typeof CreateCopyResponseSchema>;
export type CopyListQuery = z.output<typeof CopyListQuerySchema>;
export type CopyListItem = z.infer<typeof CopyListItemSchema>;
export type CopyListResponse = z.infer<typeof CopyListResponseSchema>;
export type CopyIdParams = z.infer<typeof CopyIdParamsSchema>;
export type CopyDetail = z.infer<typeof CopyDetailSchema>;
export type CopyDetailResponse = z.infer<typeof CopyDetailResponseSchema>;
export type UpdateCopyRequest = z.input<typeof UpdateCopyRequestSchema>;
export type NormalizedUpdateCopyRequest = z.output<
  typeof UpdateCopyRequestSchema
>;
export type MoveCopyRequest = z.input<typeof MoveCopyRequestSchema>;
export type NormalizedMoveCopyRequest = z.output<typeof MoveCopyRequestSchema>;
export type ExitCopyRequest = z.input<typeof ExitCopyRequestSchema>;
export type NormalizedExitCopyRequest = z.output<typeof ExitCopyRequestSchema>;
