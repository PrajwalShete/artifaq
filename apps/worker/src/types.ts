export interface Bindings {
  ARTIFACTS: R2Bucket;
  RATE_LIMIT: KVNamespace;
  ENVIRONMENT: 'development' | 'production';
  APP_ORIGIN: string;
  ARTIFACT_HOST: string;
  MAX_BYTES: string;
  RATE_LIMIT_MAX: string;
  RATE_LIMIT_WINDOW_SECONDS: string;
  TURNSTILE_SECRET?: string;
}

export interface Variables {
  requestId: string;
  clientIp: string;
}

export type AppEnv = { Bindings: Bindings; Variables: Variables };
