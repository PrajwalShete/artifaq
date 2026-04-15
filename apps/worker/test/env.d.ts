import type { Bindings } from '../src/types.js';

declare module 'cloudflare:test' {
  interface ProvidedEnv extends Bindings {}
}
