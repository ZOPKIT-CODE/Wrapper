import { dbManager, initializeDrizzleInstances, getReadDb } from './connection-manager.js';
import { getRequestDb, type RequestScopedDb } from './request-context.js';
import 'dotenv/config';

process.stdout.write('🔌 Connecting to PostgreSQL...\n');
await dbManager.initialize();
const { appDb, systemDb } = initializeDrizzleInstances();

/**
 * Process-global Drizzle pool. Use this directly when you explicitly need to
 * escape the request scope: background workers, pollers, SQS consumers,
 * audit-log writes that must survive a request rollback. Inside HTTP handlers,
 * prefer the default `db` export — it routes through the request-scoped
 * connection so RLS GUCs apply.
 */
export const globalDb = appDb;

/**
 * Default Drizzle handle. Inside an HTTP handler this resolves to the
 * request-scoped Drizzle (built on a postgres.js connection with
 * `app.tenant_id` / `app.user_id` GUCs set). Outside any request context
 * (workers, pollers, bootstrap), it falls through to `globalDb`.
 *
 * Implemented as a Proxy so existing call sites (`db.select(...)`,
 * `db.transaction(...)`, `db.query.tenants.findFirst(...)`) keep working
 * unchanged. Function properties are bound to their owning target so methods
 * that read `this` (notably `transaction`) work correctly.
 */
export const db: RequestScopedDb = new Proxy(appDb, {
  get(fallback, prop, receiver) {
    const target: RequestScopedDb = getRequestDb() ?? fallback;
    const value = Reflect.get(target, prop, target);
    if (typeof value === 'function') {
      return value.bind(target);
    }
    return value;
  },
}) as RequestScopedDb;

export const systemDbConnection = systemDb;
export const connectionString = process.env.DATABASE_URL || '';

export { dbManager, getReadDb };

export const sql = dbManager.getAppConnection();
export const systemSql = dbManager.getSystemConnection();

export { appDb as drizzle };

export const closeConnection = () => dbManager.closeAll();

export const healthCheck = () => dbManager.healthCheck();
