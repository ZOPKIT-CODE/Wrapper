import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

interface CacheMetricsData {
  hits: number;
  misses: number;
  errors: number;
  totalRequests: number;
  responseTimes: number[];
  cacheOperations: { read: number; write: number; invalidate: number };
  appBreakdown: Record<string, { hits: number; misses: number; errors: number }>;
  userBreakdown: Record<string, unknown>;
}

/**
 * Cache Performance Monitoring System
 * Tracks cache hit rates, response times, and system health
 */
class CacheMetrics {
  metrics!: CacheMetricsData;
  resetTime!: Date;

  constructor() {
    this.metrics = {
      hits: 0,
      misses: 0,
      errors: 0,
      totalRequests: 0,
      responseTimes: [],
      cacheOperations: {
        read: 0,
        write: 0,
        invalidate: 0
      },
      appBreakdown: {}, // Per-app metrics
      userBreakdown: {}  // Per-user metrics
    };
    
    this.resetTime = new Date();
  }
  
  /**
   * Record cache hit
   */
  recordHit(key: string, responseTime: number, appCode = 'unknown'): void {
    this.metrics.hits++;
    this.metrics.totalRequests++;
    this.metrics.cacheOperations.read++;
    this.metrics.responseTimes.push(responseTime);
    
    if (!this.metrics.appBreakdown[appCode]) {
      this.metrics.appBreakdown[appCode] = { hits: 0, misses: 0, errors: 0 };
    }
    this.metrics.appBreakdown[appCode].hits++;
    
    console.log(`🎯 CACHE HIT: ${key} (${responseTime}ms) [${appCode}]`);
  }
  
  /**
   * Record cache miss
   */
  recordMiss(key: string, responseTime: number, appCode = 'unknown'): void {
    this.metrics.misses++;
    this.metrics.totalRequests++;
    this.metrics.responseTimes.push(responseTime);
    
    if (!this.metrics.appBreakdown[appCode]) {
      this.metrics.appBreakdown[appCode] = { hits: 0, misses: 0, errors: 0 };
    }
    this.metrics.appBreakdown[appCode].misses++;
    
    console.log(`❌ CACHE MISS: ${key} (${responseTime}ms) [${appCode}]`);
  }
  
  /**
   * Record cache error
   */
  recordError(key: string, error: unknown, appCode = 'unknown'): void {
    this.metrics.errors++;
    this.metrics.totalRequests++;
    
    if (!this.metrics.appBreakdown[appCode]) {
      this.metrics.appBreakdown[appCode] = { hits: 0, misses: 0, errors: 0 };
    }
    this.metrics.appBreakdown[appCode].errors++;
    
    console.error(`💥 CACHE ERROR: ${key} [${appCode}]`, error);
  }
  
  /**
   * Record cache write operation
   */
  recordWrite(key: string, appCode = 'unknown'): void {
    this.metrics.cacheOperations.write++;
    console.log(`✍️ CACHE WRITE: ${key} [${appCode}]`);
  }
  
  /**
   * Record cache invalidation
   */
  recordInvalidation(pattern: string, appCode = 'unknown'): void {
    this.metrics.cacheOperations.invalidate++;
    console.log(`🗑️ CACHE INVALIDATE: ${pattern} [${appCode}]`);
  }
  
  /**
   * Get current metrics
   */
  getMetrics() {
    const hitRate = this.metrics.totalRequests > 0 
      ? (this.metrics.hits / this.metrics.totalRequests * 100).toFixed(2)
      : 0;
    
    const avgResponseTime = this.metrics.responseTimes.length > 0
      ? (this.metrics.responseTimes.reduce((a: number, b: number) => a + b, 0) / this.metrics.responseTimes.length).toFixed(2)
      : 0;
    
    const uptime = Date.now() - this.resetTime.getTime();
    
    return {
      summary: {
        hitRate: `${hitRate}%`,
        totalRequests: this.metrics.totalRequests,
        hits: this.metrics.hits,
        misses: this.metrics.misses,
        errors: this.metrics.errors,
        avgResponseTime: `${avgResponseTime}ms`,
        uptime: `${Math.floor(uptime / 1000)}s`
      },
      operations: this.metrics.cacheOperations,
      applications: this.metrics.appBreakdown,
      performance: {
        responseTimes: this.metrics.responseTimes.slice(-100), // Last 100 requests
        p95ResponseTime: this.calculatePercentile(this.metrics.responseTimes, 95),
        p99ResponseTime: this.calculatePercentile(this.metrics.responseTimes, 99)
      },
      timestamp: new Date().toISOString(),
      resetTime: this.resetTime.toISOString()
    };
  }
  
  /**
   * Calculate response time percentile
   */
  calculatePercentile(array: number[], percentile: number): number {
    if (array.length === 0) return 0;
    
    const sortedArray = [...array].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sortedArray.length) - 1;
    return sortedArray[index];
  }
  
  /**
   * Reset metrics
   */
  reset() {
    this.metrics = {
      hits: 0,
      misses: 0,
      errors: 0,
      totalRequests: 0,
      responseTimes: [],
      cacheOperations: {
        read: 0,
        write: 0,
        invalidate: 0
      },
      appBreakdown: {},
      userBreakdown: {}
    };
    this.resetTime = new Date();
    console.log('📊 Cache metrics reset');
  }
  
  /**
   * Get health status
   */
  getHealthStatus() {
    const metrics = this.getMetrics();
    const hitRate = parseFloat(metrics.summary.hitRate);
    const errorRate = this.metrics.totalRequests > 0 
      ? (this.metrics.errors / this.metrics.totalRequests * 100) 
      : 0;
    
    let status = 'healthy';
    let issues = [];
    
    if (hitRate < 70) {
      status = 'degraded';
      issues.push(`Low hit rate: ${hitRate}%`);
    }
    
    if (errorRate > 5) {
      status = 'unhealthy';
      issues.push(`High error rate: ${errorRate.toFixed(2)}%`);
    }
    
    if (parseFloat(metrics.summary.avgResponseTime) > 100) {
      status = status === 'unhealthy' ? 'unhealthy' : 'degraded';
      issues.push(`High response time: ${metrics.summary.avgResponseTime}`);
    }
    
    return {
      status,
      issues,
      timestamp: new Date().toISOString()
    };
  }
}

// Global metrics instance
const cacheMetrics = new CacheMetrics();

/**
 * Middleware to track cache performance
 */
export function cacheMetricsMiddleware(appCode = 'wrapper') {
  return {
    // Wrapper for cache operations to add metrics
    async measureCacheOperation(
      operation: () => Promise<unknown>,
      key: string,
      fallbackFn: (() => Promise<unknown>) | null = null
    ): Promise<unknown> {
      const startTime = Date.now();
      
      try {
        const result = await operation();
        const responseTime = Date.now() - startTime;
        
        if (result !== null && result !== undefined) {
          cacheMetrics.recordHit(key, responseTime, appCode);
          return result;
        } else {
          cacheMetrics.recordMiss(key, responseTime, appCode);
          
          // Execute fallback if provided
          if (fallbackFn != null) {
            const fallbackResult = await fallbackFn();
            // Record cache write if we're caching the fallback result
            return fallbackResult;
          }
          
          return null;
        }
      } catch (error) {
        cacheMetrics.recordError(key, error, appCode);
        
        // Execute fallback on error if provided
        if (fallbackFn != null) {
          try {
            return await fallbackFn();
          } catch (fallbackError) {
            console.error('Fallback also failed:', fallbackError);
            throw error; // Throw original cache error
          }
        }
        
        throw error;
      }
    },
    
    // Track cache write operations
    recordWrite: (key: string) => cacheMetrics.recordWrite(key, appCode),
    
    // Track cache invalidations
    recordInvalidation: (pattern: string) => cacheMetrics.recordInvalidation(pattern, appCode)
  };
}

/**
 * Express middleware for automatic cache metrics tracking
 */
export function expressCacheMetrics(
  req: { originalUrl: string; headers: Record<string, string | undefined> },
  res: { json: (data: unknown) => unknown },
  next: () => void
): void {
  const startTime = Date.now();
  
  // Override res.json to capture cache headers
  const originalJson = res.json.bind(res);
  res.json = function(data: unknown) {
    const responseTime = Date.now() - startTime;
    const d = data as { source?: string } | null | undefined;
    if (d?.source === 'cache') {
      cacheMetrics.recordHit(req.originalUrl, responseTime, (req.headers['x-app-code'] as string) || 'unknown');
    } else if (d?.source === 'database') {
      cacheMetrics.recordMiss(req.originalUrl, responseTime, (req.headers['x-app-code'] as string) || 'unknown');
    }
    return originalJson.call(this, data);
  };
  
  next();
}

/**
 * Fastify plugin for cache metrics
 */
export function fastifyCacheMetrics(fastify: FastifyInstance, _options: unknown, done: () => void): void {
  // Add cache metrics to request context
  fastify.decorateRequest('cacheMetrics', null);
  
  fastify.addHook('onRequest', async (request: FastifyRequest, _reply: FastifyReply) => {
    request.cacheMetrics = cacheMetricsMiddleware((request.headers['x-app-code'] as string) || 'wrapper');
  });
  
  // Add metrics endpoints
  fastify.get('/metrics/cache', async (_request: FastifyRequest, _reply: FastifyReply) => {
    return {
      success: true,
      data: cacheMetrics.getMetrics()
    };
  });
  
  fastify.get('/health/cache', async (_request: FastifyRequest, reply: FastifyReply) => {
    const health = cacheMetrics.getHealthStatus();
    const statusCode = health.status === 'healthy' ? 200 : 
                      health.status === 'degraded' ? 206 : 503;
    
    return reply.code(statusCode).send({
      success: health.status !== 'unhealthy',
      data: health
    });
  });
  
  fastify.post('/metrics/cache/reset', async (_request: FastifyRequest, _reply: FastifyReply) => {
    cacheMetrics.reset();
    return {
      success: true,
      message: 'Cache metrics reset successfully'
    };
  });
  
  done();
}

export { cacheMetrics };
export default cacheMetricsMiddleware; 