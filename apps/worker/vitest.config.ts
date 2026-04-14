import { defineWorkersConfig } from '@cloudflare/vitest-pool-workers/config';

export default defineWorkersConfig({
  test: {
    poolOptions: {
      workers: {
        wrangler: { configPath: './wrangler.jsonc' },
        miniflare: {
          compatibilityDate: '2024-12-30',
          compatibilityFlags: ['nodejs_compat'],
          bindings: {
            ENVIRONMENT: 'development',
            APP_ORIGIN: 'http://localhost:5173',
            ARTIFACT_HOST: 'art.localhost',
            MAX_BYTES: '5242880',
            RATE_LIMIT_MAX: '100',
            RATE_LIMIT_WINDOW_SECONDS: '60',
          },
          r2Buckets: ['ARTIFACTS'],
          kvNamespaces: ['RATE_LIMIT'],
        },
      },
    },
  },
});
