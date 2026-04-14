export const ErrorCode = {
  INVALID_REQUEST: 'invalid_request',
  PAYLOAD_TOO_LARGE: 'payload_too_large',
  INVALID_CONTENT_TYPE: 'invalid_content_type',
  RATE_LIMITED: 'rate_limited',
  TURNSTILE_FAILED: 'turnstile_failed',
  NOT_FOUND: 'not_found',
  INTERNAL_ERROR: 'internal_error',
  STORAGE_ERROR: 'storage_error',
} as const;

export type ErrorCodeType = (typeof ErrorCode)[keyof typeof ErrorCode];

export class ApiError extends Error {
  public override readonly name = 'ApiError';

  constructor(
    public readonly code: ErrorCodeType,
    public readonly status: number,
    message: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
  }

  toJSON(): { error: ErrorCodeType; message: string; details?: Record<string, unknown> } {
    return {
      error: this.code,
      message: this.message,
      ...(this.details ? { details: this.details } : {}),
    };
  }
}

export const errors = {
  invalidRequest: (message: string, details?: Record<string, unknown>) =>
    new ApiError(ErrorCode.INVALID_REQUEST, 400, message, details),
  payloadTooLarge: (limit: number) =>
    new ApiError(ErrorCode.PAYLOAD_TOO_LARGE, 413, `Payload exceeds limit of ${limit} bytes`, {
      limit,
    }),
  invalidContentType: (received: string) =>
    new ApiError(ErrorCode.INVALID_CONTENT_TYPE, 415, 'Only text/html is accepted', { received }),
  rateLimited: (retryAfterSeconds: number) =>
    new ApiError(ErrorCode.RATE_LIMITED, 429, 'Too many requests', { retryAfterSeconds }),
  turnstileFailed: () => new ApiError(ErrorCode.TURNSTILE_FAILED, 403, 'Bot check failed'),
  notFound: (what: string) => new ApiError(ErrorCode.NOT_FOUND, 404, `${what} not found`),
  storage: (message: string) => new ApiError(ErrorCode.STORAGE_ERROR, 502, message),
  internal: (message: string) => new ApiError(ErrorCode.INTERNAL_ERROR, 500, message),
};
