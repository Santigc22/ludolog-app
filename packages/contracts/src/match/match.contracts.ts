import { z } from "zod";

import {
  PaginationMetaSchema,
  PaginationQuerySchema,
} from "../common/pagination.contracts.js";

export const MatchStatusSchema = z.enum([
  "COMPLETED",
  "INCOMPLETE",
  "CANCELLED",
]);
export const MatchVisibilitySchema = z.enum(["PRIVATE", "PUBLIC"]);
export const MatchOutcomeSchema = z.enum(["WIN", "LOSS", "DRAW", "NO_RESULT"]);

const nullableText = (maximum: number) =>
  z.string().trim().min(1).max(maximum).nullable();

export const MatchParticipantInputSchema = z
  .object({
    userId: z.uuid().nullable().optional(),
    guestName: nullableText(160).optional(),
    outcome: MatchOutcomeSchema.optional().default("NO_RESULT"),
    score: z
      .number()
      .min(-9_999_999_999.9999)
      .max(9_999_999_999.9999)
      .nullable()
      .optional(),
  })
  .strict()
  .superRefine((value, context) => {
    const identities =
      Number(value.userId != null) + Number(value.guestName != null);
    if (identities !== 1) {
      context.addIssue({
        code: "custom",
        message: "Choose one registered user or one guest name.",
        path: [value.userId != null ? "guestName" : "userId"],
      });
    }
  });

const matchFields = {
  status: MatchStatusSchema.optional().default("COMPLETED"),
  visibility: MatchVisibilitySchema.optional().default("PRIVATE"),
  startedAt: z.iso.datetime({ offset: true }),
  durationMinutes: z.number().int().min(0).max(1_000_000).nullable().optional(),
  location: nullableText(220).optional(),
  notes: nullableText(2_000).optional(),
  participants: z.array(MatchParticipantInputSchema).min(1).max(100),
};

function validateParticipantResults(
  value: Readonly<{
    status?: z.infer<typeof MatchStatusSchema> | undefined;
    participants?:
      | Array<z.output<typeof MatchParticipantInputSchema>>
      | undefined;
  }>,
  context: z.RefinementCtx,
) {
  if (
    value.status === undefined ||
    value.status === "COMPLETED" ||
    value.participants === undefined
  ) {
    return;
  }
  value.participants.forEach((participant, index) => {
    if (participant.outcome !== "NO_RESULT") {
      context.addIssue({
        code: "custom",
        message: "Incomplete or cancelled matches cannot have final outcomes.",
        path: ["participants", index, "outcome"],
      });
    }
  });
}

function validateUniqueRegisteredParticipants(
  value: Readonly<{
    participants?:
      | Array<z.output<typeof MatchParticipantInputSchema>>
      | undefined;
  }>,
  context: z.RefinementCtx,
) {
  const seen = new Set<string>();
  value.participants?.forEach((participant, index) => {
    if (participant.userId == null) return;
    if (seen.has(participant.userId)) {
      context.addIssue({
        code: "custom",
        message: "A registered user can only appear once in a match.",
        path: ["participants", index, "userId"],
      });
    }
    seen.add(participant.userId);
  });
}

export const CreateMatchRequestSchema = z
  .object({
    gameId: z.uuid(),
    gameEditionId: z.uuid().nullable().optional(),
    copyId: z.uuid().nullable().optional(),
    ...matchFields,
  })
  .strict()
  .superRefine(validateParticipantResults)
  .superRefine(validateUniqueRegisteredParticipants);

export const UpdateMatchRequestSchema = z
  .object({
    status: MatchStatusSchema.optional(),
    visibility: MatchVisibilitySchema.optional(),
    startedAt: z.iso.datetime({ offset: true }).optional(),
    durationMinutes: z
      .number()
      .int()
      .min(0)
      .max(1_000_000)
      .nullable()
      .optional(),
    location: nullableText(220).optional(),
    notes: nullableText(2_000).optional(),
    participants: z
      .array(MatchParticipantInputSchema)
      .min(1)
      .max(100)
      .optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field must be provided.",
  })
  .superRefine(validateParticipantResults)
  .superRefine(validateUniqueRegisteredParticipants);

export const MatchParticipantSchema = z.object({
  id: z.uuid(),
  userId: z.uuid().nullable(),
  guestName: z.string().nullable(),
  displayName: z.string().min(1).max(160),
  seatOrder: z.number().int().min(1),
  outcome: MatchOutcomeSchema,
  score: z.number().nullable(),
});

export const MatchGameReferenceSchema = z.object({
  id: z.uuid(),
  name: z.string().min(1).max(220),
  coverMediaId: z.uuid().nullable(),
  minPlayers: z.number().int().min(1),
  maxPlayers: z.number().int().min(1),
});

export const MatchEditionReferenceSchema = z.object({
  id: z.uuid(),
  name: z.string().nullable(),
});

export const MatchCopyReferenceSchema = z.object({
  id: z.uuid(),
  alias: z.string().nullable(),
});

export const MatchCollectionReferenceSchema = z.object({
  id: z.uuid(),
  name: z.string().min(1),
});

export const MatchSchema = z.object({
  id: z.uuid(),
  game: MatchGameReferenceSchema,
  edition: MatchEditionReferenceSchema.nullable(),
  copy: MatchCopyReferenceSchema.nullable(),
  collection: MatchCollectionReferenceSchema.nullable(),
  createdByUserId: z.uuid(),
  status: MatchStatusSchema,
  visibility: MatchVisibilitySchema,
  startedAt: z.iso.datetime(),
  durationMinutes: z.number().int().min(0).nullable(),
  location: z.string().nullable(),
  notes: z.string().nullable(),
  participants: z.array(MatchParticipantSchema),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  canEdit: z.boolean(),
});

export const MatchListQuerySchema = PaginationQuerySchema.extend({
  gameId: z.uuid().optional(),
  status: MatchStatusSchema.optional(),
}).strict();
export const MatchIdParamsSchema = z.object({ matchId: z.uuid() });
export const MatchResponseSchema = z.object({ match: MatchSchema });
export const MatchListResponseSchema = z.object({
  matches: z.array(MatchSchema),
  pagination: PaginationMetaSchema,
});

export type MatchStatus = z.infer<typeof MatchStatusSchema>;
export type MatchOutcome = z.infer<typeof MatchOutcomeSchema>;
export type MatchParticipantInput = z.input<typeof MatchParticipantInputSchema>;
export type NormalizedMatchParticipantInput = z.output<
  typeof MatchParticipantInputSchema
>;
export type CreateMatchRequest = z.input<typeof CreateMatchRequestSchema>;
export type NormalizedCreateMatchRequest = z.output<
  typeof CreateMatchRequestSchema
>;
export type UpdateMatchRequest = z.input<typeof UpdateMatchRequestSchema>;
export type NormalizedUpdateMatchRequest = z.output<
  typeof UpdateMatchRequestSchema
>;
export type Match = z.infer<typeof MatchSchema>;
export type MatchListQuery = z.output<typeof MatchListQuerySchema>;
export type MatchIdParams = z.infer<typeof MatchIdParamsSchema>;
export type MatchResponse = z.infer<typeof MatchResponseSchema>;
export type MatchListResponse = z.infer<typeof MatchListResponseSchema>;
