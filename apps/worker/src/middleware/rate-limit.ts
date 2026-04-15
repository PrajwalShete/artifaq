import { errors } from '@artifaq/shared';
import type { MiddlewareHandler } from 'hono';
import type { AppEnv } from '../types.js';

export function rateLimit(): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const ip = c.var.clientIp;
    const limit = Number(c.env.RATE_LIMIT_MAX);
    const windowSeconds = Number(c.env.RATE_LIMIT_WINDOW_SECONDS);

    const bucket = Math.floor(Date.now() / 1000 / windowSeconds);
    const key = `rl:${ip}:${bucket}`;

    const current = Number((await c.env.RATE_LIMIT.get(key)) ?? '0');

    if (current >= limit) {
      const retryAfter = windowSeconds - (Math.floor(Date.now() / 1000) % windowSeconds);
      c.header('Retry-After', String(retryAfter));
      c.header('X-RateLimit-Limit', String(limit));
      c.header('X-RateLimit-Remaining', '0');
      throw errors.rateLimited(retryAfter);
    }

    // Best-effort write (eventually consistent). TTL is 2× window so the bucket survives drift.
    c.executionCtx.waitUntil(
      c.env.RATE_LIMIT.put(key, String(current + 1), { expirationTtl: windowSeconds * 2 }),
    );

    c.header('X-RateLimit-Limit', String(limit));
    c.header('X-RateLimit-Remaining', String(Math.max(0, limit - current - 1)));

    await next();
  };
}
