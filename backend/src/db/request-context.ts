/**
 * AsyncLocalStorage-backed ambient DB context.
 *
 * Purpose
 * -------
 * Routes set GUCs (`app.tenant_id`, `app.user_id`) on a pinned postgres.js
 * connection (see `request-connection.ts`). For RLS to actually enforce, the
 * Drizzle queries inside the handler must run on that pinned connection — not
 * an arbitrary one from the shared pool.
 *
 * Rather than thread `request.db` through every service signature (which would
 * touch 100+ files), we publish the reserved Drizzle instance in an
 * AsyncLocalStorage store and expose it via a Proxy on the default `db` import
 * (see `index.ts`). Code that imports `db` automatically picks up the
 * request-scoped instance when inside an HTTP handler, and falls back to the
 * global pool everywhere else (workers, pollers, bootstrap).
 *
 * Escape hatch
 * ------------
 * Code that must NOT participate in the request scope (e.g. an audit log that
 * should survive a rollback, fire-and-forget post-response work) should import
 * `globalDb` explicitly from `./index.js`. That import is grep-friendly and
 * unambiguous about intent.
 */

import { AsyncLocalStorage } from 'node:async_hooks';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import type * as schema from './schema/index.js';

export type RequestScopedDb = PostgresJsDatabase<typeof schema>;

interface RequestDbStore {
  db: RequestScopedDb;
}

export const requestDbStorage = new AsyncLocalStorage<RequestDbStore>();

/**
 * Returns the request-scoped Drizzle instance if inside an HTTP request
 * context that called `enterRequestDbScope`, otherwise undefined.
 */
export function getRequestDb(): RequestScopedDb | undefined {
  return requestDbStorage.getStore()?.db;
}

/**
 * Binds `db` to the current async context for the remainder of the request.
 * Uses `enterWith` so the binding persists across Fastify's hook chain
 * (subsequent preHandler/handler/onResponse hooks share the same async
 * context, so they all observe this store).
 */
export function enterRequestDbScope(db: RequestScopedDb): void {
  requestDbStorage.enterWith({ db });
}
