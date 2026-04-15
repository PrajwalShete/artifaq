import { errors } from '@artifaq/shared';
import type { MiddlewareHandler } from 'hono';
import type { AppEnv } from '../types.js';

const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

interface TurnstileResponse {
  success: boolean;
  'error-codes'?: string[];
  hostname?: string;
  action?: string;
}

export function turnstile(): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const secret = c.env.TURNSTILE_SECRET;

    // Turnstile is optional in development. In production, missing secret is a build error.
    if (!secret) {
      if (c.env.ENVIRONMENT === 'production') {
        throw errors.internal('Turnstile not configured');
      }
      await next();
      return;
    }

    const token = c.req.header('cf-turnstile-token');
    if (!token) {
      throw errors.turnstileFailed();
    }

    const idempotencyKey = crypto.randomUUID();
    const form = new FormData();
    form.append('secret', secret);
    form.append('response', token);
    form.append('remoteip', c.var.clientIp);
    form.append('idempotency_key', idempotencyKey);

    const res = await fetch(VERIFY_URL, { method: 'POST', body: form });
    const data = (await res.json()) as TurnstileResponse;

    if (!data.success) {
      throw errors.turnstileFailed();
    }

    await next();
  };
}
