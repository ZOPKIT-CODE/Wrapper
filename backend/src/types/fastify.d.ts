import type { UserContext, LegacyUser, RequestAnalysis } from './common.js';
import type { Sql } from 'postgres';

declare module 'fastify' {
  interface FastifyInstance {
    db?: Sql | null;
  }
  interface FastifyRequest {
    userContext: UserContext;
    user: LegacyUser;
    rawBody?: Buffer | string;
    db: Sql | null;
    /**
     * Release callback for a per-request reserved DB connection.
     * Set by setupDatabaseConnection() when a tenant-scoped reservation is
     * taken (see backend/src/db/request-connection.ts). Fastify onResponse
     * AND onError hooks must invoke it to return the connection to the pool.
     * Undefined for public/unauthenticated routes and bypass requests.
     */
    _dbRelease?: () => Promise<void>;
    requestAnalysis?: RequestAnalysis;
    activityContext?: { startTime: number; method: string; url: string; userAgent?: string; ipAddress?: string; sessionId?: string };
    pendingActivity?: { userId: string; tenantId: string; action: string; appId: string | null; metadata: Record<string, unknown>; requestContext: unknown };
    auditContext?: { tenantId: string; userId: string; resourceType: string; resourceId?: string; requestContext: unknown; captureChanges?: boolean };
    cacheMetrics?: unknown;
    subscription?: { plan: string; [k: string]: unknown };
    entityScope?: { scope: string; entityIds: string[]; isUnrestricted?: boolean; [k: string]: unknown };
    usageStartTime?: number;
  }
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    user: LegacyUser;
  }
}

declare global {
  var rlsService: unknown;
  function logToES(level: string, message: string, data?: Record<string, unknown>): void;
}

export {};
