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
import type { FastifyInstance } from 'fastify';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import type * as schema from './schema/index.js';

export type RequestScopedDb = PostgresJsDatabase<typeof schema>;

interface RequestDbStore {
  db: RequestScopedDb | undefined;
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
 * Opens an empty request-scoped store around EVERY request via
 * `AsyncLocalStorage.run(store, done)` in a callback-style onRequest hook.
 * Fastify continues the request lifecycle from `done()`, so the rest of the
 * hook chain (preHandler, handler, onResponse) runs INSIDE the context, and
 * the store dies with the request — it cannot leak into the caller's or the
 * socket's async context.
 *
 * The auth middleware fills the store later via `enterRequestDbScope` once it
 * has reserved + GUC-bound a connection (run() can't be used there directly:
 * the reservation is created asynchronously mid-hook).
 *
 * Register this before any hook that calls `enterRequestDbScope`.
 */
export function registerRequestDbScope(fastify: FastifyInstance): void {
  fastify.addHook('onRequest', (_request, _reply, done) => {
    requestDbStorage.run({ db: undefined }, done);
  });
}

/**
 * Publishes `db` into the current request's store (opened by
 * `registerRequestDbScope`) so the default `db` Proxy routes queries onto the
 * reserved connection for the remainder of the request.
 *
 * Fallback: if no store exists (scope hook not registered — e.g. a bare test
 * app), fall back to `enterWith`. NOTE: `enterWith` binds to the CURRENT async
 * context and on Node ≤22 can leak past the request boundary into sibling
 * contexts — which is exactly why production wiring must go through
 * `registerRequestDbScope` + store mutation instead.
 */
export function enterRequestDbScope(db: RequestScopedDb): void {
  const store = requestDbStorage.getStore();
  if (store) {
    store.db = db;
  } else {
    requestDbStorage.enterWith({ db });
  }
}
