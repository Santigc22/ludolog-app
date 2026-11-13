import { z } from "zod";

export const MediaIdParamsSchema = z.object({ mediaId: z.uuid() });
export const MediaVariantQuerySchema = z
  .object({ variant: z.enum(["primary", "thumbnail"]).default("primary") })
  .strict();
export const GameCoverUploadResponseSchema = z.object({
  coverMediaId: z.uuid(),
});

export type MediaIdParams = z.infer<typeof MediaIdParamsSchema>;
export type MediaVariantQuery = z.output<typeof MediaVariantQuerySchema>;
export type GameCoverUploadResponse = z.infer<
  typeof GameCoverUploadResponseSchema
>;
