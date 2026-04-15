import { ApiError, errors } from '@artifaq/shared';
import type { Context, ErrorHandler } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { ZodError } from 'zod';
import type { AppEnv } from '../types.js';

type StatusCode = 400 | 403 | 404 | 413 | 415 | 429 | 500 | 502;

export const onError: ErrorHandler<AppEnv> = (err, c) => renderError(c, err);

function renderError(c: Context<AppEnv>, err: unknown): Response {
  if (err instanceof ApiError) {
    return c.json(err.toJSON(), err.status as StatusCode);
  }
  if (err instanceof ZodError) {
    const e = errors.invalidRequest('Schema validation failed', {
      issues: err.issues.map((i) => ({ path: i.path, message: i.message })),
    });
    return c.json(e.toJSON(), 400);
  }
  if (err instanceof HTTPException) {
    return err.getResponse();
  }
  console.error('Unhandled error', err);
  const e = errors.internal(err instanceof Error ? err.message : 'Unknown error');
  return c.json(e.toJSON(), 500);
}
