import postgres, { type Sql } from 'postgres';
import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import * as schema from './schema/index.js';
import dotenv from 'dotenv';
import type { HealthCheckResult } from '../types/common.js';

dotenv.config();

class DatabaseConnectionManager {
  appConnection: Sql | null = null;
  systemConnection: Sql | null = null;
  readConnection: Sql | null = null;
  appDb: PostgresJsDatabase<typeof schema> | null = null;
  systemDb: PostgresJsDatabase<typeof schema> | null = null;
  readDb: PostgresJsDatabase<typeof schema> | null = null;
  initialized = false;

  async initialize(): Promise<void> {
    try {
      if (this.initialized) {
        console.log('🔄 Database connections already initialized');
        return;
      }

      const databaseUrl = process.env.DATABASE_URL;
      if (!databaseUrl) {
        console.error('❌ DATABASE_URL is not set. Add it to backend/.env (e.g. DATABASE_URL=postgresql://user:pass@localhost:5432/dbname)');
        throw new Error('DATABASE_URL environment variable is required');
      }

      console.log('🔌 Connecting to database...');

      // Pool sizes are configurable via environment variables so they can be tuned
      // per deployment without a code change (e.g. smaller in dev, larger in prod).
      //
      // Defaults raised from 10/5 to 30/15:
      //   - A typical tenant bootstrap involves 8 parallel collection fetches.
      //   - With 10 connections and 4 concurrent tenants onboarding, every query
      //     queues behind the pool — turning 200ms operations into 2-3 seconds.
      //   - Postgres itself handles hundreds of connections; 30 is still conservative.
      const appPoolMax    = Number(process.env.DB_POOL_MAX         ?? 30);
      const systemPoolMax = Number(process.env.DB_SYSTEM_POOL_MAX  ?? 15);
      const dbStatementTimeoutMs = Number(process.env.DB_STATEMENT_TIMEOUT_MS ?? 30_000);
      const dbIdleTransactionTimeoutMs = Number(process.env.DB_IDLE_IN_TX_TIMEOUT_MS ?? 30_000);

      this.appConnection = postgres(databaseUrl, {
        max: appPoolMax,
        idle_timeout: 20,
        connect_timeout: 5,
        connection: {
          statement_timeout: dbStatementTimeoutMs,
          idle_in_transaction_session_timeout: dbIdleTransactionTimeoutMs,
        },
      });

      this.systemConnection = postgres(databaseUrl, {
        max: systemPoolMax,
        idle_timeout: 30,
        connect_timeout: 5,
        connection: {
          statement_timeout: dbStatementTimeoutMs,
          idle_in_transaction_session_timeout: dbIdleTransactionTimeoutMs,
        },
        transform: {
          value: (value: unknown) => value,
        },
      });

      this.appDb = drizzle(this.appConnection, { schema });
      this.systemDb = drizzle(this.systemConnection, { schema });

      // Read replica — uses DATABASE_URL_READ if set, otherwise aliases appConnection.
      // Route all SELECT-only queries here to offload the primary.
      const readUrl = process.env.DATABASE_URL_READ;
      if (readUrl) {
        this.readConnection = postgres(readUrl, {
          max: Number(process.env.DB_READ_POOL_MAX ?? 20),
          idle_timeout: 20,
          connect_timeout: 5,
          connection: {
            statement_timeout: dbStatementTimeoutMs,
            idle_in_transaction_session_timeout: dbIdleTransactionTimeoutMs,
          },
        });
        this.readDb = drizzle(this.readConnection, { schema });
        console.log('✅ Read-replica connection established (DATABASE_URL_READ)');
      } else {
        this.readConnection = this.appConnection;
        this.readDb = this.appDb;
        if (process.env.NODE_ENV === 'production') {
          console.warn('⚠️  DATABASE_URL_READ not set — read queries will hit the primary');
        }
      }

      this.initialized = true;
      console.log('✅ Database connections initialized successfully');

    } catch (error: unknown) {
      const err = error as Error & { code?: string };
      console.error('❌ Failed to initialize database connections:', err.message || error);
      if (err.code === 'ETIMEDOUT' || err.code === 'ECONNREFUSED') {
        console.error('   Make sure PostgreSQL is running and DATABASE_URL in .env is correct.');
        console.error('   Example: postgresql://user:password@localhost:5432/your_db');
      }
      throw error;
    }
  }

  getAppConnection(): Sql {
    if (!this.appConnection) {
      throw new Error('App database connection not initialized');
    }
    return this.appConnection;
  }

  getSystemConnection(): Sql {
    if (!this.systemConnection) {
      throw new Error('System database connection not initialized');
    }
    return this.systemConnection;
  }

  getAppDb(): PostgresJsDatabase<typeof schema> {
    if (!this.appDb) {
      throw new Error('App Drizzle instance not initialized');
    }
    return this.appDb;
  }

  getSystemDb(): PostgresJsDatabase<typeof schema> {
    if (!this.systemDb) {
      throw new Error('System Drizzle instance not initialized');
    }
    return this.systemDb;
  }

  getReadDb(): PostgresJsDatabase<typeof schema> {
    if (!this.readDb) {
      throw new Error('Read Drizzle instance not initialized');
    }
    return this.readDb;
  }

  async closeAll(): Promise<void> {
    try {
      console.log('🔌 Closing database connections...');

      if (this.appConnection) {
        await this.appConnection.end();
        this.appConnection = null;
      }

      if (this.systemConnection) {
        await this.systemConnection.end();
        this.systemConnection = null;
      }

      // Only close readConnection if it is a distinct pool (not aliased to appConnection)
      if (this.readConnection && this.readConnection !== this.appConnection) {
        await this.readConnection.end();
      }
      this.readConnection = null;

      this.appDb = null;
      this.systemDb = null;
      this.readDb = null;
      this.initialized = false;

      console.log('✅ Database connections closed successfully');

    } catch (error) {
      console.error('❌ Error closing database connections:', error);
      throw error;
    }
  }

  async healthCheck(): Promise<HealthCheckResult> {
    try {
      if (!this.initialized) {
        return { status: 'not_initialized', message: 'Database connections not initialized' };
      }

      const [appResult, systemResult, readResult] = await Promise.all([
        this.appConnection!`SELECT 1 as test`,
        this.systemConnection!`SELECT 1 as test`,
        this.readConnection!`SELECT 1 as test`,
      ]);

      const appHealthy    = appResult[0]?.test === 1;
      const systemHealthy = systemResult[0]?.test === 1;
      const readHealthy   = readResult[0]?.test === 1;
      const overallHealthy = appHealthy && systemHealthy && readHealthy;

      return {
        status: overallHealthy ? 'healthy' : 'unhealthy',
        app_connection: appHealthy ? 'healthy' : 'unhealthy',
        system_connection: systemHealthy ? 'healthy' : 'unhealthy',
        read_connection: readHealthy ? 'healthy' : 'unhealthy',
        read_replica: !!process.env.DATABASE_URL_READ,
        timestamp: new Date().toISOString()
      };

    } catch (error: unknown) {
      const err = error as Error;
      console.error('❌ Health check failed:', error);
      return {
        status: 'error',
        error: err.message,
        timestamp: new Date().toISOString()
      };
    }
  }
}

const dbManager = new DatabaseConnectionManager();

function getAppDb() {
  return dbManager.getAppDb();
}

function getSystemDb() {
  return dbManager.getSystemDb();
}

function getReadDb() {
  return dbManager.getReadDb();
}

function initializeDrizzleInstances() {
  return {
    appDb: dbManager.getAppDb(),
    systemDb: dbManager.getSystemDb()
  };
}

export { dbManager, getAppDb, getSystemDb, getReadDb, initializeDrizzleInstances };
export default dbManager;
