/**
 * Vitest config for the Valkey shared-cache integration tests.
 *
 * These spin up a Valkey container via Testcontainers but need NO PostgreSQL —
 * so they run with their own config (no DB global-setup), kept separate from the
 * DB integration run (vitest.integration.config.ts) and the fast unit run.
 *
 * Run: `npm run test:cache`. Requires Docker.
 */
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    conditions: ['import', 'module', 'default'],
  },
  plugins: [
    {
      // Resolve .js imports to .ts source files (matches the other configs).
      name: 'resolve-ts-from-js',
      resolveId(source, importer) {
        if (source.endsWith('.js') && importer) {
          return source.replace(/\.js$/, '.ts');
        }
        return null;
      },
    },
  ],
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/cache-valkey.integration.test.{ts,js}'],
    // Start the Valkey container in globalSetup (plain Node) — importing
    // testcontainers inside a vite-transformed test module breaks protobufjs/long.
    globalSetup: ['./src/utils/valkey-test-setup.ts'],
    testTimeout: 30_000,
    hookTimeout: 120_000, // Valkey container cold start
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
    exclude: ['node_modules/**', 'dist/**'],
  },
});
