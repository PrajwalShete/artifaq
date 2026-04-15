import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { secureHeaders } from 'hono/secure-headers';
import { onError } from './middleware/error-handler.js';
import artifact from './routes/artifact.js';
import publish from './routes/publish.js';
import raw from './routes/raw.js';
import type { AppEnv } from './types.js';

const app = new Hono<AppEnv>();

app.onError(onError);

// Request context — must run before everything else so `c.var.requestId` is always set.
app.use('*', async (c, next) => {
  c.set('requestId', crypto.randomUUID());
  const ip =
    c.req.header('cf-connecting-ip') ??
    c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ??
    '0.0.0.0';
  c.set('clientIp', ip);
  c.header('X-Request-Id', c.var.requestId);
  await next();
});

app.use('*', secureHeaders());

// Cross-origin: only the app domain may publish. Public viewer paths get full CORS.
app.use('/publish', (c, next) =>
  cors({
    origin: [c.env.APP_ORIGIN],
    allowMethods: ['POST', 'OPTIONS'],
    allowHeaders: [
      'Content-Type',
      'X-Original-Filename',
      'X-Content-Hash',
      'CF-Turnstile-Token',
      'Authorization',
    ],
    exposeHeaders: ['X-Request-Id', 'X-RateLimit-Limit', 'X-RateLimit-Remaining'],
    maxAge: 600,
    credentials: false,
  })(c, next),
);

app.get('/health', (c) => c.json({ ok: true, env: c.env.ENVIRONMENT, requestId: c.var.requestId }));

app.route('/publish', publish);
app.route('/a', artifact);
app.route('/raw', raw);

app.notFound((c) => c.json({ error: 'not_found', message: 'Route not found' }, 404));

export default app;
