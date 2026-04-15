import { errors, slotIdSchema } from '@artifaq/shared';
import { Hono } from 'hono';
import { getArtifactBody } from '../lib/storage.js';
import type { AppEnv } from '../types.js';

const app = new Hono<AppEnv>();

app.get('/:id', async (c) => {
  const parsed = slotIdSchema.safeParse(c.req.param('id'));
  if (!parsed.success) {
    throw errors.notFound('Artifact');
  }
  const slotId = parsed.data;

  const obj = await getArtifactBody({ bucket: c.env.ARTIFACTS }, slotId);
  if (!obj) {
    throw errors.notFound('Artifact');
  }

  // Strict sandboxing headers: the user-uploaded HTML runs with no relationship to our app.
  const headers = new Headers({
    'Content-Type': 'text/html; charset=utf-8',
    'Content-Security-Policy':
      'sandbox allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'Cache-Control': 'public, max-age=60, s-maxage=300',
    'X-Frame-Options': 'SAMEORIGIN',
    'Cross-Origin-Resource-Policy': 'cross-origin',
  });
  if (obj.httpEtag) headers.set('ETag', obj.httpEtag);

  return new Response(obj.body, { headers });
});

export default app;
