import { type ArtifactMeta, artifactMetaSchema, errors } from '@artifaq/shared';
import { metaKeyFor, r2KeyFor } from './slot.js';

export interface StorageContext {
  bucket: R2Bucket;
}

export async function putArtifact(
  ctx: StorageContext,
  slotId: string,
  body: ArrayBuffer,
  meta: ArtifactMeta,
): Promise<void> {
  await Promise.all([
    ctx.bucket.put(r2KeyFor(slotId), body, {
      httpMetadata: {
        contentType: 'text/html; charset=utf-8',
        cacheControl: 'public, max-age=60, s-maxage=300',
      },
      customMetadata: {
        slot: slotId,
        filename: meta.filename.slice(0, 200),
        contentHash: meta.contentHash,
        createdAt: meta.createdAt,
        updatedAt: meta.updatedAt,
      },
    }),
    ctx.bucket.put(metaKeyFor(slotId), JSON.stringify(meta), {
      httpMetadata: { contentType: 'application/json; charset=utf-8' },
    }),
  ]);
}

export async function getArtifactBody(
  ctx: StorageContext,
  slotId: string,
): Promise<R2ObjectBody | null> {
  const obj = await ctx.bucket.get(r2KeyFor(slotId));
  return obj;
}

export async function getArtifactMeta(
  ctx: StorageContext,
  slotId: string,
): Promise<ArtifactMeta | null> {
  const obj = await ctx.bucket.get(metaKeyFor(slotId));
  if (!obj) return null;
  try {
    const text = await obj.text();
    return artifactMetaSchema.parse(JSON.parse(text));
  } catch {
    throw errors.storage('Corrupted artifact metadata');
  }
}

export async function deleteArtifact(ctx: StorageContext, slotId: string): Promise<void> {
  await Promise.all([ctx.bucket.delete(r2KeyFor(slotId)), ctx.bucket.delete(metaKeyFor(slotId))]);
}
