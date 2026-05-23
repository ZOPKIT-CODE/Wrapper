/**
 * Per-request reserved connection helper.
 *
 * Background
 * ----------
 * RLS relies on Postgres GUCs (`app.tenant_id`, `app.user_id`) being set on
 * the SAME connection that subsequently runs the query. postgres.js checks
 * out an arbitrary connection from the pool for each tagged-template call,
 * so `SELECT set_config(...)` and the next query routinely land on
 * different connections — the GUC silently leaks to whatever request
 * happened to share the connection next, and the actual query runs without
 * tenant context.
 *
 * Fix
 * ---
 * `sql.reserve()` pins one connection for the lifetime of the reservation.
 * We set the GUCs on that pinned connection, expose it to the request, and
 * release it on response/error. Because we own the connection exclusively
 * between reserve and release, the GUC and every query in between are
 * guaranteed to share the connection. Before release we RESET the GUCs so
 * the connection is clean when returned to the pool.
 */

import type { Sql, ReservedSql } from 'postgres';

export interface RequestConnection {
  /**
   * The reserved postgres.js connection. Tagged-template queries on this
   * value (e.g. `conn`SELECT ...``) are guaranteed to execute against the
   * connection whose GUCs were just set.
   */
  sql: ReservedSql;
  /**
   * Releases the reservation and returns the connection to the pool.
   * Must be called exactly once per reservation — in both onResponse and
   * onError fastify hooks. Idempotent: safe to call twice.
   */
  release: () => Promise<void>;
}

/**
 * Reserve a connection from the given pool, set the tenant/user GUCs on it,
 * and return the reserved Sql plus a release function.
 *
 * Why `set_config(..., false)` (session-local) is safe here:
 *   Even though `false` means "persist on this connection", we hold the
 *   connection exclusively until release(), and we explicitly RESET both
 *   GUCs immediately before releasing. No other request can observe the
 *   set values, and the connection returns to the pool clean.
 *
 * Why not a transaction (`set_config(..., true)`):
 *   A request-scoped transaction would also work and is arguably cleaner,
 *   but it holds locks for the full request duration (blocks VACUUM,
 *   extends lock waits) and forces every nested `db.transaction(...)` call
 *   to be a savepoint. The reserve+RESET approach gives the same GUC
 *   binding guarantee without those side effects.
 */
export async function reserveTenantConnection(
  pool: Sql,
  tenantId: string,
  userId: string | null,
): Promise<RequestConnection> {
  const reserved = await pool.reserve();
  try {
    // Single round-trip: set both GUCs on the just-reserved connection.
    // Because `reserved` is pinned, this set_config is guaranteed to land
    // on the same physical connection as every subsequent query made on
    // `reserved` until release().
    await reserved`
      SELECT
        set_config('app.tenant_id', ${tenantId}, false),
        set_config('app.user_id',   ${userId ?? ''}, false)
    `;
  } catch (err) {
    // If we failed to set the GUCs, do NOT return the connection in a
    // partial state — release immediately and rethrow. `release()` is
    // synchronous (postgres.js returns void) so no await is needed.
    try {
      reserved.release();
    } catch {
      /* swallow — original error is more important */
    }
    throw err;
  }

  let released = false;
  const release = async (): Promise<void> => {
    if (released) return;
    released = true;
    try {
      // RESET so the connection is GUC-clean when it returns to the pool.
      // If RESET fails (e.g. connection already broken), release anyway —
      // postgres.js will discard the broken connection from the pool.
      await reserved`RESET app.tenant_id`;
      await reserved`RESET app.user_id`;
    } catch {
      /* fall through to release */
    }
    try {
      reserved.release();
    } catch {
      /* connection-end errors are not actionable here */
    }
  };

  return { sql: reserved, release };
}
