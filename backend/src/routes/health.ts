/**
 * Health Check Routes
 * Provides endpoints for monitoring application health and deployment verification
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import {
  RELIABILITY_CONTRACT_VERSION,
  RELIABILITY_SLOS,
  ERROR_BUDGETS,
  FAILURE_TAXONOMY,
} from '../config/reliability-slo.js';

// Read version from package.json at module load
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
let APP_VERSION = '1.0.0';

try {
  const packageJsonPath = join(__dirname, '../../package.json');
  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
  APP_VERSION = packageJson.version || '1.0.0';
} catch (err: unknown) {
  const error = err as Error;
  console.warn('⚠️ Could not read package.json version, using default:', error.message);
}

export default async function healthRoutes(fastify: FastifyInstance, _options?: Record<string, unknown>): Promise<void> {
  // Health check endpoint
  fastify.get('/health', async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      // Basic health check
      const health: Record<string, unknown> = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || 'development',
        version: APP_VERSION,
        memory: process.memoryUsage(),
        platform: process.platform,
        nodeVersion: process.version,
        reliabilityContract: {
          version: RELIABILITY_CONTRACT_VERSION,
          slos: RELIABILITY_SLOS,
          errorBudgets: ERROR_BUDGETS,
          failureTaxonomy: FAILURE_TAXONOMY
        }
      };

      // Check database connection if available
      if (fastify.db) {
        try {
          const dbConn = fastify.db as unknown as { execute: (sql: string) => Promise<unknown> };
          await dbConn.execute('SELECT 1');
          health.database = 'connected';
        } catch (err: unknown) {
          const error = err as Error;
          health.database = 'disconnected';
          health.databaseError = error.message;
        }
      }

      // Redis removed - no Redis check needed
      health.redis = 'removed'; // Redis has been removed, using AWS MQ instead

      // Check if all critical services are healthy
      const isHealthy = health.database !== 'disconnected';
      
      if (isHealthy) {
        reply.code(200).send(health);
      } else {
        reply.code(503).send({
          ...health,
          status: 'unhealthy',
          message: 'Some services are not responding'
        });
      }
    } catch (err: unknown) {
      const error = err as Error;
      reply.code(500).send({
        status: 'error',
        timestamp: new Date().toISOString(),
        error: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  });

  // Detailed health check endpoint
  fastify.get('/health/detailed', async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const detailedHealth: Record<string, unknown> = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || 'development',
        version: APP_VERSION,
        memory: process.memoryUsage(),
        platform: process.platform,
        nodeVersion: process.version,
        services: {} as Record<string, unknown>
      };

      // Database health check
      if (fastify.db) {
        try {
          const startTime = Date.now();
          const dbConn = fastify.db as unknown as { execute: (sql: string) => Promise<unknown> };
          await dbConn.execute('SELECT 1');
          const responseTime = Date.now() - startTime;
          
          (detailedHealth.services as Record<string, unknown>).database = {
            status: 'healthy',
            responseTime: `${responseTime}ms`,
            timestamp: new Date().toISOString()
          };
        } catch (err: unknown) {
          const error = err as Error;
          (detailedHealth.services as Record<string, unknown>).database = {
            status: 'unhealthy',
            error: error.message,
            timestamp: new Date().toISOString()
          };
        }
      }

      // Redis health check
      // Redis removed - no Redis check needed
      if (false) { // Redis removed
        try {
          // Redis removed
          const responseTime = 0;
          
          (detailedHealth.services as Record<string, unknown>).redis = {
            status: 'healthy',
            responseTime: `${responseTime}ms`,
            timestamp: new Date().toISOString()
          };
        } catch (err: unknown) {
          const error = err as Error;
          (detailedHealth.services as Record<string, unknown>).redis = {
            status: 'unhealthy',
            error: error.message,
            timestamp: new Date().toISOString()
          };
        }
      }

      // Amazon MQ health check
      try {
        const { snsSqsPublisher } = await import('../features/messaging/utils/sns-sqs-publisher.js');
        const status = snsSqsPublisher.getStatus();
        (detailedHealth.services as Record<string, unknown>).amazonMq = {
          status: status.isConnected ? 'healthy' : 'unhealthy',
          reconnectAttempts: status.reconnectAttempts,
          timestamp: new Date().toISOString()
        };
      } catch (err: unknown) {
        const error = err as Error;
        (detailedHealth.services as Record<string, unknown>).amazonMq = {
          status: 'unhealthy',
          error: error.message,
          timestamp: new Date().toISOString()
        };
      }

      // Outbox health check
      if (fastify.db) {
        try {
          const dbConn = fastify.db as unknown as { execute: (sql: string) => Promise<{ rows?: Array<Record<string, unknown>> }> };
          const pendingRes = await dbConn.execute("SELECT count(*)::int as pending_count FROM event_tracking WHERE status = 'pending'");
          const failedRes = await dbConn.execute("SELECT count(*)::int as failed_count FROM event_tracking WHERE status = 'failed'");
          const pending = Number((pendingRes.rows?.[0] as any)?.pending_count ?? 0);
          const failed = Number((failedRes.rows?.[0] as any)?.failed_count ?? 0);
          (detailedHealth.services as Record<string, unknown>).outbox = {
            status: failed > 0 ? 'degraded' : 'healthy',
            pendingCount: pending,
            failedCount: failed,
            timestamp: new Date().toISOString()
          };
        } catch (err: unknown) {
          const error = err as Error;
          (detailedHealth.services as Record<string, unknown>).outbox = {
            status: 'unhealthy',
            error: error.message,
            timestamp: new Date().toISOString()
          };
        }
      }

      // Credit expiry cron health check
      try {
        const { db: dbConn } = await import('../db/index.js');
        const { creditExpiryRuns } = await import('../db/schema/billing/credit-expiry-runs.js');
        const { desc } = await import('drizzle-orm');
        const recentRuns = await dbConn
          .select()
          .from(creditExpiryRuns)
          .orderBy(desc(creditExpiryRuns.ranAt))
          .limit(5);

        const lastRun = recentRuns[0];
        const consecutiveErrors = recentRuns.findIndex(r => r.status !== 'error');
        (detailedHealth.services as Record<string, unknown>).creditExpiryCron = {
          status: !lastRun ? 'unknown' : lastRun.status === 'error' ? 'degraded' : 'healthy',
          lastRanAt: lastRun?.ranAt ?? null,
          lastStatus: lastRun?.status ?? null,
          consecutiveErrors: consecutiveErrors === -1 ? recentRuns.length : consecutiveErrors,
          lastBatchesProcessed: lastRun?.batchesProcessed ?? null,
          lastDurationMs: lastRun?.durationMs ?? null,
          timestamp: new Date().toISOString()
        };
      } catch (err: unknown) {
        const error = err as Error;
        (detailedHealth.services as Record<string, unknown>).creditExpiryCron = {
          status: 'unknown',
          error: error.message,
          timestamp: new Date().toISOString()
        };
      }

      // Check overall health
      const unhealthyServices = Object.values(detailedHealth.services as Record<string, { status?: string }>)
        .filter((service: { status?: string }) => service.status === 'unhealthy');
      
      if (unhealthyServices.length > 0) {
        detailedHealth.status = 'degraded';
        detailedHealth.unhealthyServices = unhealthyServices.length;
      }

      reply.code(200).send(detailedHealth);
    } catch (err: unknown) {
      const error = err as Error;
      reply.code(500).send({
        status: 'error',
        timestamp: new Date().toISOString(),
        error: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  });

  // Readiness probe endpoint
  fastify.get('/health/ready', async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      // Check if application is ready to receive traffic
      const readiness: Record<string, unknown> = {
        ready: true,
        timestamp: new Date().toISOString(),
        checks: {} as Record<string, string>
      };

      // Database readiness check
      if (fastify.db) {
        try {
          const dbConn = fastify.db as unknown as { execute: (sql: string) => Promise<unknown> };
          await dbConn.execute('SELECT 1');
          (readiness.checks as Record<string, string>).database = 'ready';
        } catch (_err: unknown) {
          (readiness.checks as Record<string, string>).database = 'not_ready';
          readiness.ready = false;
        }
      }

      // Redis removed - no Redis readiness check needed
      (readiness.checks as Record<string, string>).redis = 'removed'; // Redis has been removed, using AWS MQ instead
      if (false) { // Redis removed
        try {
          // Redis removed
        } catch (_err: unknown) {
          (readiness.checks as Record<string, string>).redis = 'not_ready';
          readiness.ready = false;
        }
      }

      // MQ readiness check
      try {
        const { snsSqsPublisher } = await import('../features/messaging/utils/sns-sqs-publisher.js');
        const status = snsSqsPublisher.getStatus();
        (readiness.checks as Record<string, string>).amazonMq = status.isConnected ? 'ready' : 'not_ready';
        if (!status.isConnected) {
          readiness.ready = false;
        }
      } catch (_err: unknown) {
        (readiness.checks as Record<string, string>).amazonMq = 'not_ready';
        readiness.ready = false;
      }

      if (readiness.ready) {
        reply.code(200).send(readiness);
      } else {
        reply.code(503).send(readiness);
      }
    } catch (err: unknown) {
      const error = err as Error;
      reply.code(500).send({
        ready: false,
        timestamp: new Date().toISOString(),
        error: error.message
      });
    }
  });

  // Liveness probe endpoint
  fastify.get('/health/live', async (_request: FastifyRequest, reply: FastifyReply) => {
    // Simple liveness check - if this endpoint responds, the application is alive
    reply.code(200).send({
      alive: true,
      timestamp: new Date().toISOString(),
      pid: process.pid,
      uptime: process.uptime()
    });
  });

  // Deployment info endpoint
  fastify.get('/health/deployment', async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const deployment = {
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development',
        version: APP_VERSION,
        commit: process.env.GIT_COMMIT || 'unknown',
        branch: process.env.GIT_BRANCH || 'unknown',
        buildTime: process.env.BUILD_TIME || 'unknown',
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        memory: {
          used: process.memoryUsage().heapUsed,
          total: process.memoryUsage().heapTotal,
          external: process.memoryUsage().external,
          rss: process.memoryUsage().rss
        },
        uptime: process.uptime(),
        pid: process.pid
      };

      reply.code(200).send(deployment);
    } catch (err: unknown) {
      const error = err as Error;
      reply.code(500).send({
        timestamp: new Date().toISOString(),
        error: error.message
      });
    }
  });

  // RLS Health Check endpoint
  fastify.get('/health/rls', async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const rlsHealth: Record<string, unknown> = {
        timestamp: new Date().toISOString(),
        rls_enabled: false,
        tenant_context: null,
        policies_status: {} as Record<string, unknown>,
        session_status: 'unknown'
      };

      const rlsSvc = global.rlsService as { getTenantContext?: () => Promise<unknown>; getMultiLevelContext?: () => Promise<unknown> } | null | undefined;
      if (rlsSvc) {
        rlsHealth.rls_enabled = true;

        try {
          if (rlsSvc.getTenantContext) {
            rlsHealth.tenant_context = await rlsSvc.getTenantContext();
          }
          if (rlsSvc.getMultiLevelContext) {
            try {
              rlsHealth.multi_level_context = await rlsSvc.getMultiLevelContext();
            } catch (err: unknown) {
              const error = err as Error;
              rlsHealth.multi_level_context = { error: error.message };
            }
          }

          if (fastify.db) {
            const policiesCheck = await (fastify.db as unknown as { execute: (sql: string) => Promise<{ rows: Array<{ tablename: string; rls_enabled: boolean; policy_count: number }> }> }).execute(`
              SELECT
                schemaname,
                tablename,
                rowsecurity as rls_enabled,
                (SELECT COUNT(*) FROM pg_policies WHERE schemaname = t.schemaname AND tablename = t.tablename) as policy_count
              FROM pg_tables t
              WHERE t.schemaname = 'public'
                AND t.tablename IN (
                  'tenant_users', 'organizations', 'custom_roles',
                  'credits', 'audit_logs', 'usage_logs'
                )
              ORDER BY tablename;
            `);

            (policiesCheck.rows || []).forEach((row: { tablename: string; rls_enabled: boolean; policy_count: number }) => {
              (rlsHealth.policies_status as Record<string, unknown>)[row.tablename] = {
                rls_enabled: row.rls_enabled,
                policies: row.policy_count
              };
            });
          }

          rlsHealth.session_status = 'healthy';
          reply.code(200).send(rlsHealth);

        } catch (err: unknown) {
          const error = err as Error;
          rlsHealth.session_status = 'error';
          rlsHealth.error = error.message;
          reply.code(503).send(rlsHealth);
        }
      } else {
        rlsHealth.error = 'RLS service not initialized';
        reply.code(503).send(rlsHealth);
      }
    } catch (err: unknown) {
      const error = err as Error;
      reply.code(500).send({
        timestamp: new Date().toISOString(),
        rls_enabled: false,
        error: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  });

  // RLS Test endpoint (requires tenant headers)
  fastify.get('/health/rls/test', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const subdomain = (request.headers['x-subdomain'] || request.headers['x-tenant']) as string | undefined;

      if (!subdomain) {
        return reply.code(400).send({
          error: 'Tenant identification required',
          message: 'Include X-Subdomain or X-Tenant header'
        });
      }

      const rlsSvc = global.rlsService as { resolveTenant?: (s: string) => Promise<unknown>; setTenantContext?: (id: string) => Promise<void>; clearTenantContext?: () => Promise<void> } | null | undefined;
      if (!rlsSvc || !rlsSvc.resolveTenant) {
        return reply.code(503).send({
          error: 'RLS service not available',
          timestamp: new Date().toISOString()
        });
      }

      const tenant = await rlsSvc.resolveTenant(subdomain) as { id?: string; tenantId?: string; subdomain?: string; companyName?: string } | null;
      if (!tenant) {
        return reply.code(404).send({
          error: 'Tenant not found',
          subdomain
        });
      }

      const tenantId = tenant?.id || (tenant as { tenantId?: string })?.tenantId;
      if (tenantId && rlsSvc.setTenantContext) {
        await rlsSvc.setTenantContext(tenantId);
      }

      const testResult: Record<string, unknown> = {
        timestamp: new Date().toISOString(),
        tenant: {
          id: tenant?.id ?? (tenant as { tenantId?: string })?.tenantId,
          subdomain: tenant?.subdomain,
          companyName: tenant?.companyName
        },
        rls_test: {} as Record<string, unknown>
      };

      if (fastify.db) {
        try {
          const userCount = await (fastify.db as unknown as { execute: (sql: string) => Promise<{ rows: Array<{ count: number }> }> }).execute('SELECT COUNT(*) as count FROM tenant_users');
          (testResult.rls_test as Record<string, unknown>).tenant_users = {
            status: 'success',
            count: userCount.rows?.[0]?.count ?? 0
          };
        } catch (err: unknown) {
          const error = err as Error;
          (testResult.rls_test as Record<string, unknown>).tenant_users = {
            status: 'error',
            error: error.message
          };
        }
      }

      if (rlsSvc.clearTenantContext) {
        await rlsSvc.clearTenantContext();
      }

      reply.code(200).send(testResult);

    } catch (err: unknown) {
      const error = err as Error;
      reply.code(500).send({
        timestamp: new Date().toISOString(),
        error: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  });

  // Version endpoint - minimal endpoint for version checking
  fastify.get('/version', async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      reply.code(200).send({
        version: APP_VERSION
      });
    } catch (err: unknown) {
      const error = err as Error;
      reply.code(500).send({
        timestamp: new Date().toISOString(),
        error: error.message
      });
    }
  });

  // Hierarchical RLS Test endpoint
  fastify.get('/health/rls/hierarchical', async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const hierarchicalTest: Record<string, unknown> = {
        timestamp: new Date().toISOString(),
        hierarchical_rls_enabled: false,
        multi_level_context: null,
        hierarchical_policies: {} as Record<string, unknown>,
        test_results: {} as Record<string, unknown>
      };

      const rlsSvc = global.rlsService as { getMultiLevelContext?: () => Promise<unknown> } | null | undefined;
      if (rlsSvc?.getMultiLevelContext) {
        hierarchicalTest.hierarchical_rls_enabled = true;

        try {
          hierarchicalTest.multi_level_context = await rlsSvc.getMultiLevelContext();

          if (fastify.db) {
            const policiesCheck = await (fastify.db as unknown as { execute: (sql: string) => Promise<{ rows: Array<{ tablename: string; rls_enabled: boolean; hierarchical_policies: number }> }> }).execute(`
              SELECT
                schemaname,
                tablename,
                rowsecurity as rls_enabled,
                (SELECT COUNT(*) FROM pg_policies WHERE schemaname = t.schemaname AND tablename = t.tablename AND policyname LIKE '%hierarchical%') as hierarchical_policies
              FROM pg_tables t
              WHERE t.schemaname = 'public'
                AND t.tablename IN (
                  'tenant_users', 'organizations', 'custom_roles',
                  'credits', 'audit_logs', 'activity_logs'
                )
              ORDER BY tablename;
            `);

            (policiesCheck.rows || []).forEach((row: { tablename: string; rls_enabled: boolean; hierarchical_policies: number }) => {
              (hierarchicalTest.hierarchical_policies as Record<string, unknown>)[row.tablename] = {
                rls_enabled: row.rls_enabled,
                hierarchical_policies: row.hierarchical_policies
              };
            });

            try {
              const contextTest = await (fastify.db as unknown as { execute: (sql: string) => Promise<{ rows: Array<{ context?: unknown }> }> }).execute('SELECT get_hierarchical_context() as context');
              (hierarchicalTest.test_results as Record<string, unknown>).context_function = contextTest.rows?.[0]?.context ?? null;
            } catch (err: unknown) {
              const error = err as Error;
              (hierarchicalTest.test_results as Record<string, unknown>).context_function = { error: error.message };
            }
          }

        } catch (err: unknown) {
          const error = err as Error;
          hierarchicalTest.error = error.message;
        }
      }

      reply.code(200).send(hierarchicalTest);

    } catch (err: unknown) {
      const error = err as Error;
      reply.code(500).send({
        timestamp: new Date().toISOString(),
        error: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  });
}
