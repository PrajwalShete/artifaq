export const MAX_ARTIFACT_BYTES = 5 * 1024 * 1024; // 5 MB

export const SLOT_ID_LENGTH = 12;

export const TTL_DAYS = 30;
export const TTL_MS = TTL_DAYS * 24 * 60 * 60 * 1000;

export const RATE_LIMIT_WINDOW_SECONDS = 60;
export const RATE_LIMIT_MAX_REQUESTS = 10;

export const ALLOWED_CONTENT_TYPES = ['text/html', 'text/html; charset=utf-8'] as const;

export const SKIP_DIRECTORIES = new Set([
  '.git',
  'node_modules',
  'dist',
  '.next',
  '.turbo',
  '.wrangler',
  '.vite',
  '.cache',
  'build',
  'out',
  'coverage',
]);

export const HEADERS = {
  PUBLISH_TOKEN: 'x-artifaq-token',
  TURNSTILE_TOKEN: 'cf-turnstile-token',
  CONTENT_HASH: 'x-content-hash',
  ORIGINAL_FILENAME: 'x-original-filename',
} as const;
