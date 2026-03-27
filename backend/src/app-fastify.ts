import './startup/run-first-heavy.js';
import Fastify from 'fastify';
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

const fastify = Fastify({
  requestTimeout: Number(process.env.FASTIFY_REQUEST_TIMEOUT_MS ?? 30_000),
  logger: DISABLE_ALL_LOGGING ? false : {
    level: process.env.LOG_LEVEL || 'info',
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

    fastify.addHook('onRequest', async (request, reply) => {
      // Log incoming requests to Elasticsearch
      logger!.winstonLogger.info('Incoming request', {
        method: request.method,
        url: request.url,
        hostname: request.hostname,
        remoteAddress: request.ip,
        requestId: request.id,
        service: process.env.SERVICE_NAME || 'wrapper-backend',
        env: process.env.NODE_ENV || 'development'
      });
    });

    fastify.addHook('onResponse', async (request, reply) => {
      // Log completed requests to Elasticsearch
      logger!.winstonLogger.info('Request completed', {
        method: request.method,
        url: request.url,
        statusCode: reply.statusCode,
        responseTime: reply.getResponseTime(),
        requestId: request.id,
        service: process.env.SERVICE_NAME || 'wrapper-backend',
        env: process.env.NODE_ENV || 'development'
      });
    });

    // Hook into Fastify's error logging
    fastify.addHook('onError', async (request, reply, err: unknown) => {
      const error = err as Error & { code?: string };
      // Log errors to Elasticsearch
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
  const kindeDomain = process.env.KINDE_DOMAIN || 'https://auth.zopkit.com';
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';

  await fastify.register(helmet, {
    contentSecurityPolicy: isProductionEnv ? {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'", kindeDomain, frontendUrl, 'https://api.stripe.com', 'https://*.zopkit.com'],
        fontSrc: ["'self'", 'https:', 'data:'],
        frameSrc: [kindeDomain, 'https://js.stripe.com'],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'", kindeDomain],
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
      'User-Agent'            // Browser identification
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
      const userContext = request.userContext;
      if (userContext?.tenantId) {
        return `${userContext.tenantId}:${request.ip}`;
      }
      return request.ip;
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

    // Disconnect Amazon MQ publisher
    try {
      const { amazonMQPublisher } = await import('./features/messaging/utils/amazon-mq-publisher.js');
      await amazonMQPublisher.disconnect();
      console.log('✅ Amazon MQ disconnected.');
    } catch (mqError: unknown) {
      console.warn('⚠️ Error closing Amazon MQ:', (mqError as Error).message);
    }

    console.log('✅ Graceful shutdown completed.');
    process.exit(0);
  } catch (err: unknown) {
    console.error('❌ Error during shutdown:', err);
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

    // Initialize Amazon MQ publisher so connection issues surface immediately
    try {
      const { amazonMQPublisher } = await import('./features/messaging/utils/amazon-mq-publisher.js');
      await amazonMQPublisher.initializeAtStartup();
      const { startOutboxReplayWorker } = await import('./features/messaging/services/outbox-replay-worker.js');
      startOutboxReplayWorker();
    } catch (err: unknown) {
      console.warn('⚠️ Amazon MQ initialization skipped:', (err as Error).message);
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

    // Redis connection disabled - app will run without Redis
    // To re-enable Redis, uncomment the code below and ensure Redis is running
    /*
    try {
      const redisManager = (await import('./utils/redis.js')).default;
      
      // Set a timeout for Redis connection (5 seconds)
      const connectPromise = redisManager.connect();
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Redis connection timeout')), 5000)
      );
      
      await Promise.race([connectPromise, timeoutPromise]);
      console.log('✅ Redis sync services initialized');

      // Verify Redis connection
      if (!redisManager.isConnected) {
        console.warn('⚠️ Redis connected but isConnected flag is false');
      } else {
        console.log('✅ Redis connection verified');
      }
    } catch (error) {
      // Redis is optional - log warning but don't fail startup
      console.warn('⚠️ Redis not available - continuing without Redis');
      console.warn('   Redis is used for caching and sync services');
      console.warn('   To enable Redis:');
      console.warn('   1. Start Redis: redis-server');
      console.warn('   2. Or set REDIS_URL environment variable for cloud Redis');
      console.warn('   App will continue to run without Redis (some features may be limited)');
    }
    */
    console.log('ℹ️ Redis optional; app running without Redis. Uncomment Redis init in app.js to enable.');

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
  gracefulShutdown();
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
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

// Call credit expiry initialization after database connection is established
if (process.env.NODE_ENV !== 'test') {
  // Delay initialization to ensure database is ready
  setTimeout(() => {
    initializeCreditExpirySystem().catch(error => {
      console.error('Failed to initialize credit expiry system:', error);
    });
  }, 3000);
}

export default fastify;
