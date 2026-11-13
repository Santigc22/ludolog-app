import { z } from "zod";

import {
  PaginationMetaSchema,
  PaginationQuerySchema,
} from "../common/pagination.contracts.js";

export const GameClassificationSchema = z.enum([
  "OFFICIAL",
  "COMMUNITY",
  "PRIVATE",
]);
export const GameVisibilitySchema = z.enum(["PRIVATE", "PUBLIC"]);
export const GameModerationStatusSchema = z.enum([
  "DRAFT",
  "PENDING_REVIEW",
  "APPROVED",
  "REJECTED",
  "REJECTED_DUPLICATE",
  "BLOCKED",
]);
export const GameListSortSchema = z.enum(["name", "newest", "publicationYear"]);
export const GameEditionModerationStatusSchema = z.enum([
  "PENDING_REVIEW",
  "APPROVED",
  "REJECTED",
]);

export const GameListQuerySchema = PaginationQuerySchema.extend({
  q: z.string().trim().min(1).max(100).optional(),
  mechanic: z.string().trim().min(1).max(100).optional(),
  category: z.string().trim().min(1).max(100).optional(),
  minPlayers: z.coerce.number().int().min(1).max(32_767).optional(),
  maxPlayers: z.coerce.number().int().min(1).max(32_767).optional(),
  sort: GameListSortSchema.optional().default("name"),
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

export const GameSummarySchema = z.object({
  id: z.uuid(),
  name: z.string().min(1).max(220),
  description: z.string().nullable(),
  publicationYear: z.number().int().min(0).nullable(),
  minPlayers: z.number().int().min(1),
  maxPlayers: z.number().int().min(1),
  mechanics: z.array(z.string().min(1).max(120)),
  categories: z.array(z.string().min(1).max(120)),
  coverMediaId: z.uuid().nullable(),
  minDurationMinutes: z.number().int().min(0).nullable(),
  maxDurationMinutes: z.number().int().min(0).nullable(),
  minAge: z.number().int().min(0).nullable(),
  maxAge: z.number().int().min(0).nullable(),
  complexity: z.number().min(0).max(5).nullable(),
  classification: GameClassificationSchema,
  visibility: GameVisibilitySchema,
  moderationStatus: GameModerationStatusSchema,
  isOwnedByViewer: z.boolean(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const GameListResponseSchema = z.object({
  games: z.array(GameSummarySchema),
  pagination: PaginationMetaSchema,
});

export const GameTaxonomyOptionsResponseSchema = z.object({
  mechanics: z.array(z.string().min(1).max(120)),
  categories: z.array(z.string().min(1).max(120)),
});

export const GameIdParamsSchema = z.object({
  gameId: z.uuid(),
});

export const GameEditionSchema = z.object({
  id: z.uuid(),
  editionName: z.string().max(180).nullable(),
  editionNumber: z.string().max(80).nullable(),
  languageCode: z.string().max(12).nullable(),
  publicationYear: z.number().int().min(0).nullable(),
  isbn: z.string().max(32).nullable(),
  sku: z.string().max(80).nullable(),
  upc: z.string().max(32).nullable(),
  notes: z.string().nullable(),
  moderationStatus: GameEditionModerationStatusSchema,
  isOwnedByViewer: z.boolean(),
  createdAt: z.iso.datetime(),
});

export const GameDetailSchema = GameSummarySchema.extend({
  editions: z.array(GameEditionSchema),
  canManageCatalog: z.boolean(),
});

export const GameDetailResponseSchema = z.object({
  game: GameDetailSchema,
});

const nullableText = (maximum: number) =>
  z.string().trim().min(1).max(maximum).nullable();

const normalizedTagList = z
  .array(z.string().trim().min(1).max(120))
  .max(50)
  .transform((values) => {
    const seen = new Set<string>();
    return values.filter((value) => {
      const normalized = value.toLocaleLowerCase();
      if (seen.has(normalized)) return false;
      seen.add(normalized);
      return true;
    });
  });

const createGameFields = {
  name: z.string().trim().min(1).max(220),
  description: nullableText(2_000).optional(),
  publicationYear: z.number().int().min(0).max(32_767).nullable().optional(),
  minPlayers: z.number().int().min(1).max(32_767),
  maxPlayers: z.number().int().min(1).max(32_767),
  minDurationMinutes: z.number().int().min(0).nullable().optional(),
  maxDurationMinutes: z.number().int().min(0).nullable().optional(),
  minAge: z.number().int().min(0).max(32_767).nullable().optional(),
  maxAge: z.number().int().min(0).max(32_767).nullable().optional(),
  complexity: z.number().min(0).max(5).nullable().optional(),
  mechanics: normalizedTagList.optional(),
  categories: normalizedTagList.optional(),
};

type GameRangeFields = Readonly<{
  minPlayers: number;
  maxPlayers: number;
  minDurationMinutes?: number | null | undefined;
  maxDurationMinutes?: number | null | undefined;
  minAge?: number | null | undefined;
  maxAge?: number | null | undefined;
}>;

function validateGameRanges(value: GameRangeFields, context: z.RefinementCtx) {
  if (value.maxPlayers < value.minPlayers) {
    context.addIssue({
      code: "custom",
      message:
        "Maximum players must be greater than or equal to minimum players.",
      path: ["maxPlayers"],
    });
  }
  if (
    value.minDurationMinutes != null &&
    value.maxDurationMinutes != null &&
    value.maxDurationMinutes < value.minDurationMinutes
  ) {
    context.addIssue({
      code: "custom",
      message:
        "Maximum duration must be greater than or equal to minimum duration.",
      path: ["maxDurationMinutes"],
    });
  }
  if (
    value.minAge != null &&
    value.maxAge != null &&
    value.maxAge < value.minAge
  ) {
    context.addIssue({
      code: "custom",
      message: "Maximum age must be greater than or equal to minimum age.",
      path: ["maxAge"],
    });
  }
}

export const CreatePrivateGameRequestSchema = z
  .object(createGameFields)
  .strict()
  .superRefine(validateGameRanges);

export const CreatePrivateGameResponseSchema = GameDetailResponseSchema;

export const CreatePublicGameRequestSchema = z
  .object({
    ...createGameFields,
    classification: z.enum(["OFFICIAL", "COMMUNITY"]).default("OFFICIAL"),
  })
  .strict()
  .superRefine(validateGameRanges);

export const CreatePublicGameResponseSchema = GameDetailResponseSchema;

export const BulkCreatePublicGamesRequestSchema = z
  .object({
    games: z.array(CreatePublicGameRequestSchema).min(1).max(500),
  })
  .strict()
  .superRefine((value, context) => {
    const seen = new Map<string, number>();
    value.games.forEach((game, index) => {
      const normalizedName = game.name.toLocaleLowerCase();
      const previousIndex = seen.get(normalizedName);
      if (previousIndex !== undefined) {
        context.addIssue({
          code: "custom",
          message: `Duplicate game name in rows ${previousIndex + 1} and ${index + 1}.`,
          path: ["games", index, "name"],
        });
      } else {
        seen.set(normalizedName, index);
      }
    });
  });

export const BulkCreatePublicGamesResponseSchema = z.object({
  games: z.array(GameDetailSchema),
  createdCount: z.number().int().min(1),
});

const editableGameFields = {
  name: z.string().trim().min(1).max(220),
  description: nullableText(2_000),
  publicationYear: z.number().int().min(0).max(32_767).nullable(),
  minPlayers: z.number().int().min(1).max(32_767),
  maxPlayers: z.number().int().min(1).max(32_767),
  minDurationMinutes: z.number().int().min(0).nullable(),
  maxDurationMinutes: z.number().int().min(0).nullable(),
  minAge: z.number().int().min(0).max(32_767).nullable(),
  maxAge: z.number().int().min(0).max(32_767).nullable(),
  complexity: z.number().min(0).max(5).nullable(),
  mechanics: normalizedTagList,
  categories: normalizedTagList,
};

export const UpdatePublicGameRequestSchema = z
  .object({
    name: editableGameFields.name.optional(),
    description: editableGameFields.description.optional(),
    publicationYear: editableGameFields.publicationYear.optional(),
    minPlayers: editableGameFields.minPlayers.optional(),
    maxPlayers: editableGameFields.maxPlayers.optional(),
    minDurationMinutes: editableGameFields.minDurationMinutes.optional(),
    maxDurationMinutes: editableGameFields.maxDurationMinutes.optional(),
    minAge: editableGameFields.minAge.optional(),
    maxAge: editableGameFields.maxAge.optional(),
    complexity: editableGameFields.complexity.optional(),
    mechanics: editableGameFields.mechanics.optional(),
    categories: editableGameFields.categories.optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field must be provided.",
  })
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
    if (
      value.minDurationMinutes != null &&
      value.maxDurationMinutes != null &&
      value.maxDurationMinutes < value.minDurationMinutes
    ) {
      context.addIssue({
        code: "custom",
        message:
          "Maximum duration must be greater than or equal to minimum duration.",
        path: ["maxDurationMinutes"],
      });
    }
    if (
      value.minAge != null &&
      value.maxAge != null &&
      value.maxAge < value.minAge
    ) {
      context.addIssue({
        code: "custom",
        message: "Maximum age must be greater than or equal to minimum age.",
        path: ["maxAge"],
      });
    }
  });

export const UpdatePublicGameResponseSchema = GameDetailResponseSchema;

export type GameListQuery = z.output<typeof GameListQuerySchema>;
export type GameListResponse = z.infer<typeof GameListResponseSchema>;
export type GameTaxonomyOptionsResponse = z.infer<
  typeof GameTaxonomyOptionsResponseSchema
>;
export type GameSummary = z.infer<typeof GameSummarySchema>;
export type GameIdParams = z.infer<typeof GameIdParamsSchema>;
export type GameEdition = z.infer<typeof GameEditionSchema>;
export type GameDetail = z.infer<typeof GameDetailSchema>;
export type GameDetailResponse = z.infer<typeof GameDetailResponseSchema>;
export type CreatePrivateGameRequest = z.input<
  typeof CreatePrivateGameRequestSchema
>;
export type NormalizedCreatePrivateGameRequest = z.output<
  typeof CreatePrivateGameRequestSchema
>;
export type CreatePrivateGameResponse = z.infer<
  typeof CreatePrivateGameResponseSchema
>;
export type CreatePublicGameRequest = z.input<
  typeof CreatePublicGameRequestSchema
>;
export type NormalizedCreatePublicGameRequest = z.output<
  typeof CreatePublicGameRequestSchema
>;
export type CreatePublicGameResponse = z.infer<
  typeof CreatePublicGameResponseSchema
>;
export type BulkCreatePublicGamesRequest = z.input<
  typeof BulkCreatePublicGamesRequestSchema
>;
export type NormalizedBulkCreatePublicGamesRequest = z.output<
  typeof BulkCreatePublicGamesRequestSchema
>;
export type BulkCreatePublicGamesResponse = z.infer<
  typeof BulkCreatePublicGamesResponseSchema
>;
export type UpdatePublicGameRequest = z.input<
  typeof UpdatePublicGameRequestSchema
>;
export type NormalizedUpdatePublicGameRequest = z.output<
  typeof UpdatePublicGameRequestSchema
>;
export type UpdatePublicGameResponse = z.infer<
  typeof UpdatePublicGameResponseSchema
>;
