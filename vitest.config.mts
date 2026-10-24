import { defineConfig } from 'vitest/config';
import { cloudflareTest } from '@cloudflare/vitest-pool-workers';

export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: { configPath: './wrangler.jsonc' },
      miniflare: {
        // El runtime local de esta sesión solo acepta hasta 2026-08-22; el Worker real usa wrangler.jsonc.
        compatibilityDate: '2026-08-22',
      },
    }),
  ],
  test: { include: ['test/**/*.test.ts'] },
});
