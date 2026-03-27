/**
 * Application-Level Isolation Middleware
 * Enforces data isolation across different applications in the business suite
 */

import type { FastifyRequest, FastifyReply } from 'fastify';
import { ApplicationDataIsolationService } from '../../services/application-data-isolation-service.js';

type AppAccessResult = { hasAccess: boolean; entities: string[]; permissions: number; application?: string; scope?: { entityCount: number; orgCount: number; locationCount: number }; organizations?: string[]; locations?: string[] };

// Create service instance for instance methods
const applicationDataIsolationService = new ApplicationDataIsolationService();

// Public routes that bypass application isolation
const PUBLIC_APPLICATION_ROUTES = [
  'POST /api/locations',
  // New unified entities routes
  'GET /api/entities/hierarchy',
  'GET /api/entities/parent',
  'POST /api/entities/parent',
  'POST /api/entities/sub',
  'POST /api/entities/bulk',
  'GET /api/entities/tenant',
  'POST /api/entities'
];

export class ApplicationIsolationMiddleware {

  /**
   * Middleware to enforce application-level data isolation
   */
  static enforceApplicationAccess(requiredApps: string[] | null = null): (request: FastifyRequest, reply: FastifyReply) => Promise<void | ReturnType<FastifyReply['send']>> {
    return async (request: FastifyRequest, reply: FastifyReply): Promise<void | ReturnType<FastifyReply['send']>> => {
      try {
        // Check if this is a public route that bypasses application isolation
        const isPublicRoute = PUBLIC_APPLICATION_ROUTES.some(route => {
          const routeParts = route.split(' ');
          const method = routeParts[0];
          const path = routeParts[1];
          return request.method === method && request.url.includes(path);
        });

        if (isPublicRoute) {
          return; // Skip application isolation for public routes
        }

        const { userContext } = request;

        if (!userContext) {
          console.warn('🚨 Application isolation middleware: Missing userContext', {
            url: request.url,
            method: request.method,
            hasAuthHeader: !!request.headers?.authorization,
            hasCookies: !!request.headers?.cookie,
            cookies: Object.keys(request.cookies || {}),
            headers: {
              authorization: request.headers?.authorization ? 'present' : 'missing',
              cookie: request.headers?.cookie ? 'present' : 'missing'
            }
          });

          return reply.code(401).send({
            success: false,
            error: 'Unauthorized',
            message: 'User context not found. Please ensure authentication middleware runs before application isolation middleware.',
            debug: {
              hasAuthHeader: !!request.headers?.authorization,
              hasCookies: !!request.headers?.cookie
            }
          });
        }

        // Extract application from request headers, query params, or route
        const application = ApplicationIsolationMiddleware.extractApplicationFromRequest(request);

        if (!application) {
          return reply.code(400).send({
            success: false,
            error: 'Bad Request',
            message: 'Application context is required'
          });
        }

        // Check if specific applications are required
        if (requiredApps != null && requiredApps.length > 0 && !requiredApps.includes(application)) {
          return reply.code(403).send({
            success: false,
            error: 'Forbidden',
            message: `Access to application '${application}' is not allowed for this endpoint`
          });
        }

        // Check if user has access to this application
        const appAccess = await applicationDataIsolationService.getUserApplicationAccess(
          userContext,
          application
        );

        if (!appAccess.hasAccess) {
          return reply.code(403).send({
            success: false,
            error: 'Forbidden',
            message: `You do not have access to the ${application} application`
          });
        }

        const access = appAccess as AppAccessResult;
        const orgs = access.organizations ?? [];
        const locs = access.locations ?? [];

        const permissions = Number(appAccess.permissions) || 0;
        request.applicationContext = {
          application: application,
          permissions,
          accessibleOrganizations: orgs,
          accessibleLocations: locs,
          scope: appAccess.scope
        };

        request.isolationContext = {
          tenantId: userContext.tenantId ?? '',
          application: application,
          userId: userContext.userId ?? '',
          organizations: orgs,
          locations: locs,
          permissions
        };

      } catch (err: unknown) {
        const error = err as Error;
        console.error('❌ Application isolation middleware error:', error);
        return reply.code(500).send({
          success: false,
          error: 'Internal Server Error',
          message: 'Failed to verify application access permissions'
        });
      }
    };
  }

  /**
   * Middleware for cross-application data sharing
   */
  static enforceCrossApplicationSharing(): (request: FastifyRequest, reply: FastifyReply) => Promise<void | ReturnType<FastifyReply['send']>> {
    return async (request: FastifyRequest, reply: FastifyReply): Promise<void | ReturnType<FastifyReply['send']>> => {
      try {
        const { userContext, applicationContext } = request;
        const bodyOrQuery = (request.body || request.query || {}) as { sourceApp?: string; targetApp?: string; dataType?: string; dataId?: string };
        const { sourceApp, targetApp, dataType, dataId } = bodyOrQuery;

        if (sourceApp && targetApp && sourceApp !== targetApp) {
          const canShare = await applicationDataIsolationService.canShareDataBetweenApplications(
            userContext,
            sourceApp,
            targetApp,
            dataType ?? '',
            dataId ?? ''
          );

          if (!canShare) {
            return reply.code(403).send({
              success: false,
              error: 'Forbidden',
              message: `You are not authorized to share ${dataType} data from ${sourceApp} to ${targetApp}`
            });
          }

          request.crossAppSharing = {
            sourceApp: sourceApp as string,
            targetApp: targetApp as string,
            dataType: dataType ?? '',
            dataId: dataId ?? '',
            approved: true
          };
        }

      } catch (err: unknown) {
        const error = err as Error;
        console.error('❌ Cross-application sharing middleware error:', error);
        return reply.code(500).send({
          success: false,
          error: 'Internal Server Error',
          message: 'Failed to verify cross-application sharing permissions'
        });
      }
    };
  }

  /**
   * Middleware to add application-specific data filtering
   */
  static addApplicationDataFiltering(): (request: FastifyRequest, reply: FastifyReply) => Promise<void> {
    return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
      try {
        const { userContext, applicationContext } = request;

        if (userContext && applicationContext) {
          // Add filtering functions to request with error handling
          request.filterByApplication = async (data: unknown, dataType: string = 'organization'): Promise<unknown> => {
            try {
              const app = (applicationContext as { application: string }).application;
              return await applicationDataIsolationService.filterDataByApplication(
                data as Record<string, unknown> | Record<string, unknown>[],
                userContext,
                app,
                dataType
              );
            } catch (err: unknown) {
              const error = err as Error;
              console.error('❌ Error in filterByApplication:', error);
              return Array.isArray(data) ? [] : null;
            }
          };

          request.canAccessInApplication = async (dataType: string, dataId: string): Promise<boolean> => {
            try {
              const app = (applicationContext as { application: string }).application;
              return await applicationDataIsolationService.canAccessDataInApplication(
                userContext,
                app,
                dataType,
                dataId
              );
            } catch (err: unknown) {
              const error = err as Error;
              console.error('❌ Error in canAccessInApplication:', error);
              return false;
            }
          };
        }

        // Always continue to next middleware
        return;
      } catch (err: unknown) {
        const error = err as Error;
        console.error('❌ Application data filtering middleware error:', error);
        // Don't fail the request for filtering errors, just log and continue
        return;
      }
    };
  }

  /**
   * Extract application context from request
   */
  static extractApplicationFromRequest(request: FastifyRequest): string | null {
    // Priority order: headers > query params > route params > inferred from path

    // Check headers
    const headerApp = request.headers['x-application'];
    if (headerApp) {
      return (Array.isArray(headerApp) ? headerApp[0] : headerApp) ?? null;
    }

    // Check query parameters
    const query = request.query as { application?: string | string[] } | undefined;
    const queryApp = query?.application;
    if (queryApp) {
      return Array.isArray(queryApp) ? queryApp[0] ?? null : queryApp;
    }

    // Check route parameters
    const params = request.params as Record<string, string | string[]> | undefined;
    const paramApp = params?.application;
    if (paramApp) {
      return Array.isArray(paramApp) ? paramApp[0] ?? null : paramApp;
    }

    // Infer from URL path
    const path = request.url;
    if (!path) {
      return null;
    }
    const appMatches = path.match(/^\/api\/([^\/]+)/);

    if (appMatches && appMatches[1]) {
      const inferredApp = appMatches[1];

      // Map common path segments to applications
      const pathToAppMap: Record<string, string> = {
        'crm': 'crm',
        'hr': 'hr',
        'finance': 'finance',
        'sales': 'sales',
        'marketing': 'marketing',
        'inventory': 'inventory',
        'projects': 'projects',
        'analytics': 'analytics',
        'employees': 'hr',
        'customers': 'crm',
        'financial': 'finance',
        'leads': 'sales'
      };

      return pathToAppMap[inferredApp] ?? inferredApp;
    }

    return null;
  }

  /**
   * Validate application exists
   */
  static validateApplicationExists(): (request: FastifyRequest, reply: FastifyReply) => Promise<void | ReturnType<FastifyReply['send']>> {
    return async (request: FastifyRequest, reply: FastifyReply): Promise<void | ReturnType<FastifyReply['send']>> => {
      try {
        // Check if this is a public route that bypasses application isolation
        const routeKey = `${request.method} ${request.url}`;
        const isPublicRoute = PUBLIC_APPLICATION_ROUTES.some(route => {
          const routeParts = route.split(' ');
          const method = routeParts[0];
          const path = routeParts[1];
          return request.method === method && request.url.includes(path);
        });

        if (isPublicRoute) {
          return; // Skip application validation for public routes
        }

        const application = ApplicationIsolationMiddleware.extractApplicationFromRequest(request);

        // If application is provided but not in the valid list, return error
        if (application && !Object.values(ApplicationDataIsolationService.APPLICATIONS).includes(application)) {
          return reply.code(400).send({
            success: false,
            error: 'Bad Request',
            message: `Invalid application: ${application}`,
            validApplications: Object.values(ApplicationDataIsolationService.APPLICATIONS)
          });
        }
        // If validation passes, continue to next middleware
        return;
      } catch (err: unknown) {
        const error = err as Error;
        console.error('❌ Application validation middleware error:', error);
        return reply.code(500).send({
          success: false,
          error: 'Internal Server Error',
          message: 'Failed to validate application'
        });
      }
    };
  }

  /**
   * Helper function to get user's application access summary
   */
  static async getUserApplicationSummary(userContext: { userId?: string; internalUserId?: string; tenantId?: string }): Promise<unknown> {
    const ctx = {
      userId: userContext.userId ?? '',
      internalUserId: userContext.internalUserId ?? null,
      tenantId: userContext.tenantId ?? null
    };
    return await applicationDataIsolationService.getUserCompleteAccessProfile(ctx as import('../../services/application-data-isolation-service.js').UserContext);
  }
}

// Export middleware functions
export const enforceApplicationAccess = ApplicationIsolationMiddleware.enforceApplicationAccess;
export const enforceCrossApplicationSharing = ApplicationIsolationMiddleware.enforceCrossApplicationSharing;
export const addApplicationDataFiltering = ApplicationIsolationMiddleware.addApplicationDataFiltering;
export const validateApplicationExists = ApplicationIsolationMiddleware.validateApplicationExists;
export const getUserApplicationSummary = ApplicationIsolationMiddleware.getUserApplicationSummary;

// Export utility functions
export const extractApplicationFromRequest = ApplicationIsolationMiddleware.extractApplicationFromRequest;
