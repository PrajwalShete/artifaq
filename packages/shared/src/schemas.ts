import { z } from 'zod';
import { MAX_ARTIFACT_BYTES, SLOT_ID_LENGTH } from './constants.js';

export const slotIdSchema = z
  .string()
  .length(SLOT_ID_LENGTH)
  .regex(/^[a-zA-Z0-9_-]+$/, 'Invalid slot id');

export type SlotId = z.infer<typeof slotIdSchema>;

export const publishRequestSchema = z.object({
  filename: z.string().min(1).max(256),
  contentHash: z.string().min(8).max(128),
  slotId: slotIdSchema.optional(),
  bytes: z.number().int().positive().max(MAX_ARTIFACT_BYTES),
  turnstileToken: z.string().optional(),
});

export type PublishRequest = z.infer<typeof publishRequestSchema>;

export const publishResponseSchema = z.object({
  slotId: slotIdSchema,
  url: z.string().url(),
  rawUrl: z.string().url(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type PublishResponse = z.infer<typeof publishResponseSchema>;

export const errorResponseSchema = z.object({
  error: z.string(),
  message: z.string(),
  details: z.record(z.unknown()).optional(),
});

export type ErrorResponse = z.infer<typeof errorResponseSchema>;

export const artifactMetaSchema = z.object({
  slotId: slotIdSchema,
  filename: z.string(),
  contentHash: z.string(),
  bytes: z.number().int().positive(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  views: z.number().int().nonnegative().default(0),
});

export type ArtifactMeta = z.infer<typeof artifactMetaSchema>;
