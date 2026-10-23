import { defineConfig } from 'vitest/config';
import { cloudflareTest } from '@cloudflare/vitest-pool-workers';
import { pbkdf2Sync } from 'node:crypto';

// Clave y secreto de prueba: solo existen dentro de las pruebas.
const CLAVE = 'clave-de-prueba-123';
const sal = Buffer.from('sal-de-prueba-16');
const hash = pbkdf2Sync(CLAVE, sal, 100000, 32, 'sha256');

export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: { configPath: './wrangler.jsonc' },
      miniflare: {
        // El runtime local de esta sesión solo acepta hasta 2026-08-22; el Worker real usa wrangler.jsonc.
        compatibilityDate: '2026-08-22',
        bindings: {
          ADMIN_PASSWORD_HASH: `100000:${sal.toString('base64')}:${hash.toString('base64')}`,
          SESSION_SECRET: 'secreto-de-prueba-solo-para-tests',
        },
      },
    }),
  ],
  test: { include: ['test/**/*.test.ts'] },
});
