import { type ArtifactMeta, errors, MAX_ARTIFACT_BYTES } from '@artifaq/shared';
import { Hono } from 'hono';
import { newSlotId } from '../lib/slot.js';
import { getArtifactMeta, putArtifact } from '../lib/storage.js';
import { rateLimit } from '../middleware/rate-limit.js';
import { turnstile } from '../middleware/turnstile.js';
import type { AppEnv } from '../types.js';

const app = new Hono<AppEnv>();

app.post('/', rateLimit(), turnstile(), async (c) => {
  const contentType = c.req.header('content-type') ?? '';
  if (!contentType.startsWith('text/html')) {
    throw errors.invalidContentType(contentType);
  }

  const contentLength = Number(c.req.header('content-length') ?? '0');
  const maxBytes = Number(c.env.MAX_BYTES) || MAX_ARTIFACT_BYTES;
  if (contentLength > maxBytes) {
    throw errors.payloadTooLarge(maxBytes);
  }

  const filename = (c.req.header('x-original-filename') ?? 'artifact.html').slice(0, 200);
  const incomingHash = c.req.header('x-content-hash') ?? '';
  const requestedSlot = c.req.query('slot');

  const body = await c.req.arrayBuffer();
  if (body.byteLength === 0) {
    throw errors.invalidRequest('Empty body');
  }
  if (body.byteLength > maxBytes) {
    throw errors.payloadTooLarge(maxBytes);
  }

  // Compute server-side hash. Trust-but-verify the client's hash.
  const digest = await crypto.subtle.digest('SHA-256', body);
  const contentHash = bufferToHex(digest);
  if (incomingHash && incomingHash !== contentHash) {
    throw errors.invalidRequest('Content hash mismatch', {
      client: incomingHash,
      server: contentHash,
    });
  }

  const now = new Date().toISOString();
  let slotId = requestedSlot;
  let createdAt = now;

  if (slotId) {
    const existing = await getArtifactMeta({ bucket: c.env.ARTIFACTS }, slotId);
    if (existing) {
      if (existing.contentHash === contentHash) {
        // No-op publish — return the existing record.
        return c.json(buildResponse(c.env.ARTIFACT_HOST, existing), 200);
      }
      createdAt = existing.createdAt;
    } else {
      // Client passed an unknown slot. Treat as fresh.
      slotId = newSlotId();
    }
  } else {
    slotId = newSlotId();
  }

  const meta: ArtifactMeta = {
    slotId,
    filename,
    contentHash,
    bytes: body.byteLength,
    createdAt,
    updatedAt: now,
    views: 0,
  };

  await putArtifact({ bucket: c.env.ARTIFACTS }, slotId, body, meta);

  return c.json(buildResponse(c.env.ARTIFACT_HOST, meta), 201);
});

function buildResponse(host: string, meta: ArtifactMeta) {
  const base = host.startsWith('http') ? host : `https://${host}`;
  return {
    slotId: meta.slotId,
    url: `${base}/a/${meta.slotId}`,
    rawUrl: `${base}/raw/${meta.slotId}`,
    createdAt: meta.createdAt,
    updatedAt: meta.updatedAt,
  };
}

function bufferToHex(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let out = '';
  for (const byte of bytes) {
    out += byte.toString(16).padStart(2, '0');
  }
  return out;
}

export default app;
