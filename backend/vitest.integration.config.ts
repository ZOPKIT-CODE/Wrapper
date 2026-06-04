/**
 * Vitest configuration for integration tests.
 *
 * Integration tests spin up a real PostgreSQL container via Testcontainers and
 * run against actual SQL — they verify DB constraints, idempotency
 * constraints, and tenant-scoping work end-to-end.
 *
 * Keep this config separate from vitest.config.ts so the unit-test run (pnpm test)
 * stays fast and the integration run (pnpm test:integration) is explicit.
 */
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    conditions: ['import', 'module', 'default'],
  },
  plugins: [
    {
      // Resolve .js imports to .ts source files (matches the main config).
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

    // Only run *.integration.test.ts files.
    include: ['src/**/*.integration.test.{ts,js}'],

    // Global setup: starts the PostgreSQL container and runs migrations ONCE
    // before any worker is spawned.  The container URL is written to
    // process.env.DATABASE_URL so every worker inherits it automatically.
    globalSetup: ['./src/db/test-helpers/global-setup.ts'],

    // Container startup + migration can take 20–40 s on a cold Docker pull.
    // Individual test timeouts are kept tight to catch slow queries early.
    testTimeout:  30_000,  // 30 s per test
    hookTimeout:  120_000, // 2 min for beforeAll / afterAll (container start)

    // Run files sequentially to avoid port collisions on repeated CI runs.
    // Within a file, tests run sequentially by default.
    pool: 'forks',
    poolOptions: {
      forks: {
        // One worker keeps resource usage low; increase if files are independent.
        singleFork: true,
      },
    },

    // Standard exclusions.  Do NOT add src/**/*.test.ts here — it would also
    // match *.integration.test.ts files.  The include pattern above is
    // already specific enough to limit scope to integration tests only.
    exclude: [
      'node_modules/**',
      'dist/**',
      // Valkey-only cache tests run via their own config (no DB global-setup).
      'src/**/cache-valkey.integration.test.{ts,js}',
    ],
  },
});
