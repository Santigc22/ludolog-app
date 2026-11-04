import { z } from "zod";

export const UuidSchema = z.uuid();

export const ResourceIdParamsSchema = z.object({
  resourceId: UuidSchema,
});

export type ResourceIdParams = z.infer<typeof ResourceIdParamsSchema>;
