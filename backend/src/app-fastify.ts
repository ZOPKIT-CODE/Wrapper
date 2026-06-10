import './startup/run-first-heavy.js';
import Fastify from 'fastify';
import * as Sentry from '@sentry/node';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import jwt from '@fastify/jwt';
import cookie from '@fastify/cookie';
import multipart from '@fastify/multipart';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
import { swaggerOptions, swaggerUiOptions } from './config/swagger.js';
import 'dotenv/config';
import { getTraceFields } from './utils/trace-context.js';
import { validateEnv } from './config/env.js';
import { shouldLogVerbose } from './utils/verbose-log.js';
import './startup/run-after-core.js';

// DB loads at start() so app.js parses quickly; routes load from app-routes.js

// Check if logging should be disabled (set this to true or use DISABLE_LOGGING env var)
const DISABLE_ALL_LOGGING = process.env.DISABLE_LOGGING === 'true';

// Optionally suppress all console output (uncomment if you want to disable console.log too)
if (DISABLE_ALL_LOGGING && process.env.SUPPRESS_CONSOLE === 'true') {
  const noop = () => { };
  console.log = noop;
  console.info = noop;
  console.warn = noop;
  // Keep console.error for critical errors
  // console.error = noop;
}

// Routes and heavy plugins load on demand (app-routes.js, registerPlugins, start()) so app.js parses fast

import './startup/run-before-dbmanager.js';
import { dbManager } from './db/connection-manager.js';
import { logStartupHealth } from './startup-health.js';

// Validate required environment variables before any services are initialised.
// This runs after dotenv/config so .env values are already loaded.
if (process.env.NODE_ENV !== 'test') {
  validateEnv();
}

const fastify = Fastify({
  requestTimeout: Number(process.env.FASTIFY_REQUEST_TIMEOUT_MS ?? 30_000),
  logger: DISABLE_ALL_LOGGING ? false : {
    level: process.env.LOG_LEVEL || 'info',
    // Attach the active trace's trace_id/span_id to every request log line so
    // logs join to their distributed trace in Sentry/Tempo and CloudWatch.
    mixin: () => getTraceFields(),
  },
  // Allow union types in JSON schema (fixes strict mode warnings for isActive, limit, etc.)
  ajv: {
    customOptions: { allowUnionTypes: true },
  },
  // Enable raw body support for webhooks
  bodyLimit: 1048576, // 1MB limit
  requestIdHeader: 'x-request-id'
});
fastify.setValidatorCompiler(validatorCompiler);
fastify.setSerializerCompiler(serializerCompiler);
process.stdout.write('  ✓ Fastify & plugins loaded\n');

// Initialize Elasticsearch logger and hook into Fastify logs
type EnhancedLogger = { winstonLogger: { info: (msg: string, data?: object) => void; error: (msg: string, data?: object) => void; warn: (msg: string, data?: object) => void; debug: (msg: string, data?: object) => void } };
let enhancedLogger: EnhancedLogger | null = null;

if (!DISABLE_ALL_LOGGING) {
  try {
    enhancedLogger = (await import('./utils/logger-enhanced.js')).default as EnhancedLogger;
    console.log('✅ Elasticsearch logger initialized');
  } catch (err: unknown) {
    console.warn('⚠️ Could not load Elasticsearch logger:', (err as Error).message);
  }

  // Hook into Fastify's logging to send logs to Elasticsearch
  if (enhancedLogger?.winstonLogger) {
    // Override Fastify's log methods to also send to Elasticsearch
    const originalLog = fastify.log;
    const logger = enhancedLogger;

    // Fire-and-forget ES logging — never block the request pipeline.
    // When ES is unreachable, Winston's ES transport can stall; wrapping
    // in try/catch prevents that from adding latency to every request.
    fastify.addHook('onRequest', async (request, reply) => {
      try {
        logger!.winstonLogger.info('Incoming request', {
          method: request.method,
          url: request.url,
          hostname: request.hostname,
          remoteAddress: request.ip,
          requestId: request.id,
          service: process.env.SERVICE_NAME || 'wrapper-backend',
          env: process.env.NODE_ENV || 'development'
        });
      } catch { /* ES logging must never block requests */ }
    });

    fastify.addHook('onResponse', async (request, reply) => {
      try {
        logger!.winstonLogger.info('Request completed', {
          method: request.method,
          url: request.url,
          statusCode: reply.statusCode,
          responseTime: reply.elapsedTime,
          requestId: request.id,
          service: process.env.SERVICE_NAME || 'wrapper-backend',
          env: process.env.NODE_ENV || 'development'
        });
      } catch { /* ES logging must never block requests */ }
    });

    fastify.addHook('onError', async (request, reply, err: unknown) => {
      try {
        const error = err as Error & { code?: string };
        enhancedLogger!.winstonLogger.error('Request error', {
          method: request.method,
          url: request.url,
          statusCode: reply.statusCode || 500,
          error: {
            message: error.message,
            stack: error.stack,
            code: error.code
          },
          requestId: request.id,
          service: process.env.SERVICE_NAME || 'wrapper-backend',
          env: process.env.NODE_ENV || 'development'
        });
      } catch { /* ES logging must never block requests */ }
    });

    console.log('✅ Fastify logs will be sent to Elasticsearch');
  }
} else {
  console.log('🔇 All logging disabled');
}

// Helper function to log important messages to both console and Elasticsearch
// Usage: logToES('info', 'Important message', { key: 'value' })
global.logToES = (level, message, data = {}) => {
  if (DISABLE_ALL_LOGGING) return; // Skip logging if disabled

  console.log(`[${level.toUpperCase()}] ${message}`, data);
  if (enhancedLogger && enhancedLogger.winstonLogger) {
    try {
      const logData = {
        message,
        ...data,
        service: process.env.SERVICE_NAME || 'wrapper-backend',
        env: process.env.NODE_ENV || 'development'
      };

      switch (level.toLowerCase()) {
        case 'error':
          enhancedLogger.winstonLogger.error(message, logData);
          break;
        case 'warn':
          enhancedLogger.winstonLogger.warn(message, logData);
          break;
        case 'debug':
          enhancedLogger.winstonLogger.debug(message, logData);
          break;
        default:
          enhancedLogger.winstonLogger.info(message, logData);
      }
    } catch { /* ES logging must never block callers */ }
  }
};

// Raw body parser for webhooks
fastify.addContentTypeParser(['application/json'], { parseAs: 'buffer' }, function (req: any, body: Buffer, done: (err: Error | null, body?: unknown) => void) {
  req.rawBody = body;

  if (req.url.includes('/webhook')) {
    done(null, body);
    return;
  }

  try {
    const bodyStr = body.toString('utf8');
    const json = JSON.parse(bodyStr);

    // Handle double-stringified restrictions field issue
    if (json.restrictions && typeof json.restrictions === 'string') {
      try {
        json.restrictions = JSON.parse(json.restrictions);
      } catch (e) {
        // Keep as string for validation to catch it
      }
    }

    done(null, json);
  } catch (err: unknown) {
    const e = err as Error & { statusCode?: number };
    e.statusCode = 400;
    done(e, undefined);
  }
});

// Register plugins
async function registerPlugins() {
  const isProductionEnv = process.env.NODE_ENV === 'production';
  const cognitoDomain = process.env.COGNITO_DOMAIN || 'https://auth.zopkit.com';
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';

  await fastify.register(helmet, {
    contentSecurityPolicy: isProductionEnv ? {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'", cognitoDomain, frontendUrl, 'https://api.stripe.com', 'https://*.zopkit.com'],
        fontSrc: ["'self'", 'https:', 'data:'],
        frameSrc: [cognitoDomain, 'https://js.stripe.com'],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'", cognitoDomain],
        upgradeInsecureRequests: [],
      }
    } : false,
    hsts: isProductionEnv ? {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true
    } : false,
  });

  // CORS
  await fastify.register(cors, {
    // Allow localhost for dev and *.zopkit.com for production
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) {
        callback(null, true);
        return;
      }

      // Always allow localhost origins (for development)
      if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
        if (shouldLogVerbose()) console.log(`✅ CORS allowed origin: ${origin}`);
        callback(null, true);
        return;
      }

      // Check against allowed production origins
      const allowedOrigins = [
        process.env.FRONTEND_URL,
        'https://app.zopkit.com',
        'https://www.zopkit.com',
        'https://zopkit.com',
        /^https:\/\/[a-z0-9-]+\.zopkit\.com$/, // HTTPS only, no HTTP
      ].filter(Boolean);

      const isAllowed = allowedOrigins.some((allowed: string | RegExp | undefined) => {
        if (allowed === undefined) return false;
        if (typeof allowed === 'string') {
          return origin === allowed;
        }
        return allowed.test(origin);
      });

      if (isAllowed === true) {
        if (shouldLogVerbose()) console.log(`✅ CORS allowed origin: ${origin}`);
        callback(null, true);
      } else {
        console.warn(`⚠️ CORS blocked origin: ${origin}`);
        callback(new Error('Not allowed by CORS'), false);
      }
    },
    credentials: true, // Required so browser can send cookies
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'X-Application',
      'X-Kinde-User-ID',      // CRM sends this
      'X-Organization-ID',    // CRM sends this
      'X-Tenant-ID',          // Frontend sends this
      'x-tenant-id',          // Alternative casing
      'X-Idempotency-Key',    // Credit allocation idempotency
      'x-idempotency-key',    // Lowercase variant from browser/client
      'Origin',               // Browser sends this
      'Accept',               // Browser sends this
      'Accept-Language',      // Browser sends this
      'Accept-Encoding',      // Browser sends this
      'Cache-Control',        // Browser sends this
      'Pragma',               // Browser sends this
      'Sec-Fetch-Dest',       // Modern browser security
      'Sec-Fetch-Mode',       // Modern browser security
      'Sec-Fetch-Site',       // Modern browser security
      'User-Agent',           // Browser identification
      'sentry-trace',         // Sentry/OTel distributed tracing (frontend → backend)
      'baggage'               // W3C baggage — rides with sentry-trace for trace continuation
    ],
    exposedHeaders: [
      'X-Total-Count',
      'X-Page-Count',
      'X-Current-Page'
    ],
    // Let the plugin echo the specific Origin back (not *) so cookies are accepted
    strictPreflight: true,
    // Handle preflight requests properly
    preflightContinue: false,
    // Set max age for preflight cache
    maxAge: 86400 // 24 hours
  });

  // Defense-in-depth: make sure credentialed browser requests always receive
  // the required header from this backend, including preflight responses.
  fastify.addHook('onSend', async (request, reply, payload) => {
    const requestOrigin = request.headers.origin;
    if (!requestOrigin) {
      return payload;
    }

    const isLocalOrigin = requestOrigin.includes('localhost') || requestOrigin.includes('127.0.0.1');
    if (!isLocalOrigin) {
      return payload;
    }

    reply.header('Access-Control-Allow-Credentials', 'true');
    if (request.method === 'OPTIONS') {
      reply.header('Access-Control-Allow-Origin', requestOrigin);
      reply.header('Vary', 'Origin, Access-Control-Request-Headers');
    }

    return payload;
  });

  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret && process.env.NODE_ENV !== 'test') {
    throw new Error('JWT_SECRET environment variable is required');
  }
  await fastify.register(jwt, {
    secret: jwtSecret || 'test-only-secret',
    cookie: {
      cookieName: 'token',
      signed: false,
    },
  });

  const sessionSecret = process.env.SESSION_SECRET;
  if (!sessionSecret && process.env.NODE_ENV !== 'test') {
    throw new Error('SESSION_SECRET environment variable is required');
  }
  await fastify.register(cookie, {
    secret: sessionSecret || 'test-only-cookie-secret',
    parseOptions: {},
  });

  await fastify.register(rateLimit, {
    max: parseInt(process.env.RATE_LIMIT_MAX || '200'),
    timeWindow: parseInt(process.env.RATE_LIMIT_WINDOW || '900000'), // 15 minutes
    skipOnError: true,
    keyGenerator: (request: any) => {
      // Rate-limit by tenantId so one abusive tenant cannot starve others.
      // Auth middleware (preHandler) hasn't run yet at this stage (onRequest), so
      // we decode — but do NOT verify — the JWT to extract the tenantId claim.
      // The actual signature check still happens in preHandler as normal.
      const authHeader: string = request.headers.authorization ?? '';
      if (authHeader.startsWith('Bearer ')) {
        try {
          const payloadB64 = authHeader.slice(7).split('.')[1];
          if (payloadB64) {
            const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
            if (typeof payload?.tenantId === 'string') {
              return `tenant:${payload.tenantId}`;
            }
          }
        } catch { /* malformed token — fall through to IP-based limiting */ }
      }
      return `ip:${request.ip}`;
    },
    allowList: (request: any) => {
      // Don't rate-limit health checks
      return request.url === '/health';
    },
  });

  // Stricter rate limiting for auth endpoints (50 req/15min)
  fastify.addHook('onRoute', (routeOptions) => {
    if (routeOptions.url?.startsWith('/api/auth/')) {
      routeOptions.config = {
        ...(routeOptions.config as Record<string, unknown>),
        rateLimit: { max: 50, timeWindow: 900000 },
      };
    }
  });

  // File upload
  await fastify.register(multipart, {
    limits: {
      fieldNameSize: 100,
      fieldSize: 100,
      fields: 10,
      fileSize: parseInt(process.env.MAX_FILE_SIZE || '50000000'), // 50MB
      files: 5,
      headerPairs: 2000,
    },
  });

  // Swagger API documentation (disable with DISABLE_SWAGGER=true)
  if (process.env.DISABLE_SWAGGER !== 'true') {
    await fastify.register(swagger, swaggerOptions);
    await fastify.register(swaggerUi, swaggerUiOptions);
  }

  const { fastifyCacheMetrics } = await import('./middleware/cache/cache-metrics.js');
  await fastify.register(fastifyCacheMetrics);
}

// Initialize RLS service (uses db from app-routes load or preload)
let rlsService = null;

async function initializeRLS() {
  try {
    console.log('🚀 Initializing RLS Tenant Isolation Service...');
    const { db, connectionString } = await import('./db/index.js');
    const { RLSTenantIsolationService } = await import('./middleware/security/rls-tenant-isolation.js');

    rlsService = new RLSTenantIsolationService(db as any, connectionString as string);

    // Import and set tenants table reference
    const { tenants } = await import('./db/schema/index.js');
    rlsService.setTenantsTable(tenants as any);

    // Make RLS service globally available for health checks
    global.rlsService = rlsService;

    console.log('✅ RLS Tenant Isolation Service initialized');
  } catch (err: unknown) {
    console.error('❌ Failed to initialize RLS service:', err);
    // Don't exit - continue without RLS for now
  }
}

// Graceful shutdown
async function gracefulShutdown() {
  console.log('🛑 Starting graceful shutdown...');

  try {
    // Close Fastify server first
    await fastify.close();
    console.log('✅ Fastify server closed.');

    // Stop the inter-app outbox poller cleanly before tearing the publisher down.
    try {
      const poller =
        (globalThis as { __interAppOutboxPoller?: { stop: () => void } }).__interAppOutboxPoller;
      if (poller) {
        poller.stop();
        console.log('✅ Inter-app outbox poller stopped.');
      }
    } catch (pollerErr: unknown) {
      console.warn('⚠️ Error stopping outbox poller:', (pollerErr as Error).message);
    }

    // Stop SQS consumer.
    try {
      const { sqsConsumer } = await import('./features/messaging/services/sqs-consumer.js');
      await sqsConsumer.stop();
      console.log('✅ SQS consumer stopped.');
    } catch (sqsErr: unknown) {
      console.warn('⚠️ Error stopping SQS consumer:', (sqsErr as Error).message);
    }

    // Close the shared Valkey connection.
    try {
      const { closeValkey } = await import('./utils/valkey-client.js');
      await closeValkey();
      console.log('✅ Valkey connection closed.');
    } catch (vkErr: unknown) {
      console.warn('⚠️ Error closing Valkey:', (vkErr as Error).message);
    }

    // Disconnect SNS/SQS publisher (no-op for stateless SDK, but kept for clean shutdown)
    try {
      const { snsSqsPublisher } = await import('./features/messaging/utils/sns-sqs-publisher.js');
      await snsSqsPublisher.disconnect();
      console.log('✅ SNS/SQS publisher disconnected.');
    } catch (mqError: unknown) {
      console.warn('⚠️ Error closing SNS/SQS publisher:', (mqError as Error).message);
    }

    // Flush telemetry LAST, once intake is stopped and in-flight work has drained.
    // Sentry.flush() also force-flushes the OTLP BatchSpanProcessor (it shares the
    // provider), so this single call drains both Sentry events and pending spans.
    try {
      await Sentry.flush(3000);
      console.log('✅ Telemetry flushed.');
    } catch (flushErr: unknown) {
      console.warn('⚠️ Error flushing telemetry:', (flushErr as Error).message);
    }

    console.log('✅ Graceful shutdown completed.');
    process.exit(0);
  } catch (err: unknown) {
    console.error('❌ Error during shutdown:', err);
    // Best-effort flush so the failure itself is not lost.
    await Sentry.flush(2000).catch(() => {});
    process.exit(1);
  }
}

// Start server
async function start() {
  try {
    console.log('🚀 Starting Wrapper API Server...');

    console.log('🔌 Initializing database...');
    await import('./db/index.js');
    await dbManager.initialize();
    console.log('✅ Database ready');

    await registerPlugins();

    process.stdout.write('  Loading routes & middleware (may take 1–2 min on first run)...\n');
    const { registerMiddleware, registerRoutes } = await import('./app-routes.js');
    await registerMiddleware(fastify);

    await initializeRLS();

    await registerRoutes(fastify);

    // Start the server
    const port = parseInt(process.env.PORT || '3000');
    const host = process.env.HOST || '0.0.0.0';

    const server = await fastify.listen({ port, host });

    // Initialize WebSocket server for real-time notifications
    try {
      const { initWebSocketServer } = await import('./utils/websocket-server.js');
      // Get the underlying HTTP server from Fastify
      initWebSocketServer(fastify.server);
      console.log('✅ WebSocket server initialized for real-time notifications');
    } catch (err: unknown) {
      console.warn('⚠️ Failed to initialize WebSocket server:', (err as Error).message);
      // Don't fail startup if WebSocket fails
    }

    console.log(`✅ Server listening on http://${host}:${port}`);
    console.log(`📚 API Documentation: http://${host}:${port}/docs`);
    console.log(`🏥 Health Check: http://${host}:${port}/health`);

    await logStartupHealth();

    // Initialize SNS/SQS messaging
    try {
      const { snsSqsPublisher } = await import('./features/messaging/utils/sns-sqs-publisher.js');
      await snsSqsPublisher.initializeAtStartup();
      const { startOutboxReplayWorker } = await import('./features/messaging/services/outbox-replay-worker.js');
      startOutboxReplayWorker();

      // Inter-app outbox poller — drains inter_app_outbox rows that the
      // fast-path publish couldn't ship (circuit-open, network errors).
      // Single-instance via pg_try_advisory_lock(8001) so it's safe to run
      // on every pod.
      const { OutboxPoller } = await import('./features/messaging/services/outbox-poller.js');
      const interAppOutboxPoller = new OutboxPoller();
      interAppOutboxPoller.start();
      // Stash on globalThis so gracefulShutdown can stop it cleanly.
      (globalThis as { __interAppOutboxPoller?: { stop: () => void } }).__interAppOutboxPoller =
        interAppOutboxPoller;

      // Start the SQS inbound consumer so the wrapper processes events sent back
      // from CRM / accounting / ops apps (acknowledgements, cross-app events).
      const { sqsConsumer } = await import('./features/messaging/services/sqs-consumer.js');
      await sqsConsumer.start();
      console.log('✅ SQS inbound consumer started');
    } catch (err: unknown) {
      console.warn('⚠️ SNS/SQS initialization skipped:', (err as Error).message);
    }

    // Schedule nightly cleanup of old event_tracking rows (default: older than 7 days).
    // Prevents the event_tracking (outbox) table from growing unboundedly.
    // Runs once at startup (to recover from long downtimes) and then every 24 hours.
    try {
      const { EventTrackingService } = await import('./features/messaging/services/event-tracking-service.js');
      const CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours
      const CLEANUP_DAYS_OLD = Number(process.env.EVENT_TRACKING_CLEANUP_DAYS ?? 7);

      const runCleanup = async () => {
        const cleanupLockKey = Number(process.env.EVENT_TRACKING_CLEANUP_LOCK_KEY ?? 719_001);
        const appSql = dbManager.getAppConnection();
        try {
          const lockResult = await appSql`SELECT pg_try_advisory_lock(${cleanupLockKey}) AS locked`;
          const lockAcquired = !!lockResult[0]?.locked;
          if (!lockAcquired) {
            if (shouldLogVerbose()) {
              console.log('⏭️ Skipping event_tracking cleanup: advisory lock held by another instance');
            }
            return;
          }

          const deleted = await EventTrackingService.cleanupOldEvents(CLEANUP_DAYS_OLD);
          if (deleted > 0) {
            console.log(`🧹 Nightly event_tracking cleanup: removed ${deleted} rows older than ${CLEANUP_DAYS_OLD} days`);
          }
        } catch (cleanupErr: unknown) {
          console.warn('⚠️ Nightly event_tracking cleanup failed (non-fatal):', (cleanupErr as Error).message);
        } finally {
          try {
            await appSql`SELECT pg_advisory_unlock(${cleanupLockKey})`;
          } catch {
            // No-op: lock might not have been acquired in this process.
          }
        }
      };

      // First run: delay by 30 seconds after startup to avoid contending with bootstrap
      setTimeout(() => {
        void runCleanup();
        setInterval(() => { void runCleanup(); }, CLEANUP_INTERVAL_MS);
      }, 30_000);

      console.log(`✅ Nightly event_tracking cleanup scheduled (every 24h, retains last ${CLEANUP_DAYS_OLD} days)`);
    } catch (err: unknown) {
      console.warn('⚠️ Failed to schedule event_tracking cleanup (non-fatal):', (err as Error).message);
    }

    // TEST: Force a log to Elasticsearch
    try {
      const enhancedLogger = (await import('./utils/logger-enhanced.js')).default;
      enhancedLogger.winstonLogger.info('Server started successfully', {
        port,
        host,
        environment: process.env.NODE_ENV || 'development',
        service: process.env.SERVICE_NAME || 'wrapper-backend',
        timestamp: new Date().toISOString()
      });
      console.log('📝 Test log sent to Elasticsearch');
    } catch (err: unknown) {
      const errObj = err as Error;
      console.error('❌ Failed to send test log:', errObj.message);
      // Check for Elasticsearch connection errors
      if (errObj.message.includes('Elasticsearch') || errObj.message.includes('ECONNREFUSED')) {
        console.warn('⚠️ Elasticsearch may not be running or accessible');
        console.warn('   Make sure Elasticsearch is running: docker compose ps');
        console.warn('   Check ELASTICSEARCH_URL environment variable');
      }
    }

    // // Initialize trial monitoring system after app setup
    // await initializeTrialSystem();

    // ── Shared cache (ElastiCache Valkey) ───────────────────────────────────
    // Single-tier shared cache: when REDIS_ENABLED=true and a target is set, all
    // SharedCache instances (auth user/role/tenant-lookup caches) read & write to
    // Valkey, so reads, writes, and invalidations are shared across instances —
    // required for correct permission propagation under horizontal scaling.
    // Falls back to an in-process Map (single instance) when disabled/unreachable.
    try {
      const { getValkey, isValkeyEnabled } = await import('./utils/valkey-client.js');
      if (isValkeyEnabled()) {
        getValkey(); // warm the connection at boot; readiness is logged via events
        console.log('🔌 Valkey shared cache enabled (REDIS_ENABLED=true)');
      } else {
        console.log('ℹ️ Valkey disabled (REDIS_ENABLED!=true) — using in-process cache (single instance only)');
      }
    } catch (error) {
      console.warn('⚠️ Valkey init skipped:', (error as Error).message);
    }

    // Setup graceful shutdown
    process.on('SIGTERM', gracefulShutdown);
    process.on('SIGINT', gracefulShutdown);

  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  Sentry.captureException(reason, { tags: { source: 'unhandledRejection' } });
  // gracefulShutdown() flushes telemetry before exiting, so the captured event ships.
  gracefulShutdown();
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  Sentry.captureException(error, { tags: { source: 'uncaughtException' } });
  gracefulShutdown();
});


export async function run() { await start(); }


// // Initialize trial monitoring system after app setup
// export async function initializeTrialSystem() {
//   try {
//     console.log('🚀 Initializing trial monitoring system...');

//     // Start trial monitoring
//     trialManager.startTrialMonitoring();

//     // Verify it's running
//     const status = trialManager.getMonitoringStatus();
//     if (status.isRunning) {
//       console.log('✅ Trial monitoring system initialized successfully');
//       console.log(`📊 Active jobs: ${status.activeJobs}`);
//     } else {
//       console.error('❌ Failed to initialize trial monitoring system');
//     }

//   } catch (error) {
//     console.error('❌ Error initializing trial system:', error);
//   }
// }

// Initialize credit expiry monitoring system after app setup
export async function initializeCreditExpirySystem() {
  try {
    console.log('🚀 Initializing credit expiry monitoring system...');

    const { default: creditExpiryManager } = await import('./utils/credit-expiry-manager.js');
    creditExpiryManager.startExpiryMonitoring();

    const status = creditExpiryManager.getMonitoringStatus();
    if (status.isRunning) {
      console.log('✅ Credit expiry monitoring system initialized successfully');
      console.log(`📊 Active jobs: ${status.activeJobs}`);
    } else {
      console.error('❌ Failed to initialize credit expiry monitoring system');
    }

  } catch (error) {
    console.error('❌ Error initializing credit expiry system:', error);
  }
}

// // Call initialization after database connection is established
// if (process.env.NODE_ENV !== 'test') {
//   // Delay initialization to ensure database is ready
//   setTimeout(() => {
//     initializeTrialSystem().catch(error => {
//       console.error('Failed to initialize trial system:', error);
//     });
//   }, 2000);
// }

// Call credit expiry initialization well after database connection is established.
// Deferred to 30s (was 3s) so expiry cron queries don't compete with the DB pool
// during the critical first few seconds when onboarding/auth requests arrive.
if (process.env.NODE_ENV !== 'test') {
  setTimeout(() => {
    initializeCreditExpirySystem().catch(error => {
      console.error('Failed to initialize credit expiry system:', error);
    });
  }, 30_000);
}

export default fastify;
