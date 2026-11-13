import { z } from "zod";

import { PaginationMetaSchema } from "../common/pagination.contracts.js";
import {
  GameEditionSchema,
  GameSummarySchema,
} from "../game/game.contracts.js";

export const ModerationCaseStatusSchema = z.enum([
  "PENDING_REVIEW",
  "APPROVED",
  "REJECTED",
]);

export const SubmitGameForModerationRequestSchema = z
  .object({
    note: z.string().trim().min(1).max(2_000).nullable().optional(),
  })
  .strict();

export const RejectModerationCaseRequestSchema = z
  .object({
    reason: z.string().trim().min(3).max(2_000),
  })
  .strict();

export const ModerationCaseIdParamsSchema = z.object({ caseId: z.uuid() });

export const ModerationSubmitterSchema = z.object({
  id: z.uuid(),
  username: z.string().min(1),
  displayName: z.string().nullable(),
});

export const GameModerationCaseSchema = z.object({
  id: z.uuid(),
  status: ModerationCaseStatusSchema,
  submissionNote: z.string().nullable(),
  resolutionNote: z.string().nullable(),
  submittedBy: ModerationSubmitterSchema,
  assignedToUserId: z.uuid().nullable(),
  resolvedBy: ModerationSubmitterSchema.nullable(),
  game: GameSummarySchema,
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  closedAt: z.iso.datetime().nullable(),
});

export const GameModerationCaseResponseSchema = z.object({
  moderationCase: GameModerationCaseSchema,
});

export const GameModerationListQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).optional().default(1),
    pageSize: z.coerce.number().int().min(1).max(100).optional().default(20),
    status: ModerationCaseStatusSchema.optional().default("PENDING_REVIEW"),
    approvedByUserId: z.uuid().optional(),
  })
  .strict();

export const GameModerationListResponseSchema = z.object({
  moderationCases: z.array(GameModerationCaseSchema),
  reviewers: z.array(ModerationSubmitterSchema),
  pagination: PaginationMetaSchema,
});

export const EditionModerationCaseSchema = z.object({
  id: z.uuid(),
  status: ModerationCaseStatusSchema,
  submissionNote: z.string().nullable(),
  resolutionNote: z.string().nullable(),
  submittedBy: ModerationSubmitterSchema,
  assignedToUserId: z.uuid().nullable(),
  resolvedBy: ModerationSubmitterSchema.nullable(),
  game: z.object({ id: z.uuid(), name: z.string().min(1).max(220) }),
  edition: GameEditionSchema,
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  closedAt: z.iso.datetime().nullable(),
});

export const EditionModerationCaseResponseSchema = z.object({
  moderationCase: EditionModerationCaseSchema,
});

export const EditionModerationListQuerySchema = GameModerationListQuerySchema;

export const EditionModerationListResponseSchema = z.object({
  moderationCases: z.array(EditionModerationCaseSchema),
  reviewers: z.array(ModerationSubmitterSchema),
  pagination: PaginationMetaSchema,
});

export type SubmitGameForModerationRequest = z.input<
  typeof SubmitGameForModerationRequestSchema
>;
export type NormalizedSubmitGameForModerationRequest = z.output<
  typeof SubmitGameForModerationRequestSchema
>;
export type RejectModerationCaseRequest = z.input<
  typeof RejectModerationCaseRequestSchema
>;
export type NormalizedRejectModerationCaseRequest = z.output<
  typeof RejectModerationCaseRequestSchema
>;
export type ModerationCaseIdParams = z.infer<
  typeof ModerationCaseIdParamsSchema
>;
export type GameModerationCase = z.infer<typeof GameModerationCaseSchema>;
export type GameModerationCaseResponse = z.infer<
  typeof GameModerationCaseResponseSchema
>;
export type GameModerationListQuery = z.output<
  typeof GameModerationListQuerySchema
>;
export type GameModerationListResponse = z.infer<
  typeof GameModerationListResponseSchema
>;
export type EditionModerationCase = z.infer<typeof EditionModerationCaseSchema>;
export type EditionModerationCaseResponse = z.infer<
  typeof EditionModerationCaseResponseSchema
>;
export type EditionModerationListQuery = z.output<
  typeof EditionModerationListQuerySchema
>;
export type EditionModerationListResponse = z.infer<
  typeof EditionModerationListResponseSchema
>;
