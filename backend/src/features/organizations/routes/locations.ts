/**
 * Location Routes - RESTful API endpoints for location management
 * Follows SOLID principles with clear separation of concerns
 */
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { EntityAdminService } from '../../../features/admin/index.js';
import LocationService from '../services/location-service.js';
import { authenticateToken } from '../../../middleware/auth/auth.js';
import {
  validateLocationCreation,
  sanitizeInput
} from '../../../middleware/validation/validation.js';
import Logger from '../../../utils/logger.js';

export default async function locationRoutes(
  fastify: FastifyInstance,
  _options?: Record<string, unknown>
): Promise<void> {

  // Apply authentication to all routes except public ones
  fastify.addHook('preHandler', async (request, reply) => {
    // Skip authentication for public routes that don't require it
    const publicRoutes = [
      'GET /api/locations/tenant/:tenantId', // Public tenant locations viewing
      'POST /api/locations/',                // Allow location creation with fallback auth
    ];

    const isPublic = publicRoutes.some(route => {
      const routeParts = route.split(' ');
      const method = routeParts[0];
      const path = routeParts[1];
      return request.method === method && request.url.includes(path);
    });

    if (!isPublic) {
      return authenticateToken(request, reply);
    }
  });

  // Create location for organization
  fastify.post('/', {
    preHandler: [validateLocationCreation],
    schema: {
      description: 'Create a new location and assign to organization'
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as Record<string, unknown>;
    try {
      let createdBy = (request as any).userContext?.internalUserId;
      let responsiblePersonId = (request as any).userContext?.internalUserId;

      if (!createdBy) {
        Logger.log('warning', 'general', 'create-location', 'No authentication context, using fallback user for testing');
        createdBy = (request as any).userContext?.userId || '3a9b3f2c-e335-4c3e-956f-be5341ef38eb';
        responsiblePersonId = null;
      }

      const sanitizedData = sanitizeInput(body) as any;
      if (responsiblePersonId) {
        sanitizedData.responsiblePersonId = responsiblePersonId;
      }

      const result = await LocationService.createLocation(sanitizedData, createdBy ?? '');

      return reply.send(result);
    } catch (err: unknown) {
      const error = err as Error;
      Logger.log('error', 'general', 'create-location', 'Create location failed', { error: error.message });

      if (error.message.includes('not found')) {
        return reply.code(404).send({
          success: false,
          error: 'Organization not found',
          message: error.message
        });
      }

      if (error.message.includes('Location name')) {
        return reply.code(400).send({
          success: false,
          error: 'Invalid data',
          message: error.message
        });
      }

      return reply.code(500).send({
        success: false,
        error: 'Creation failed',
        message: 'Failed to create location'
      });
    }
  });

  // REMOVED: Get organization locations - MOVED TO ORGANIZATIONS ROUTES

  // Get location details
  fastify.get('/:locationId', {
    schema: {
      description: 'Get detailed information about a location'
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as Record<string, string>;
    try {
      const locationId = (params as any).locationId ?? '';
      const result = await LocationService.getLocationById(locationId);

      return reply.send(result);
    } catch (err: unknown) {
      const error = err as Error;
      Logger.log('error', 'general', 'get-location-details', 'Get location details failed', { error: error.message });

      if (error.message.includes('not found')) {
        return reply.code(404).send({
          success: false,
          error: 'Location not found',
          message: error.message
        });
      }

      return reply.code(500).send({
        success: false,
        error: 'Retrieval failed',
        message: 'Failed to get location details'
      });
    }
  });

  // Update location
  fastify.put('/:locationId', {
    schema: {
      description: 'Update location information'
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as Record<string, unknown>;
    const params = request.params as Record<string, string>;
    try {
      const locationId = (params as any).locationId ?? '';
      const userId = (request as any).userContext?.userId ?? '';
      const result = await LocationService.updateLocation(locationId, body as any, userId);

      return reply.send(result);
    } catch (err: unknown) {
      const error = err as Error;
      Logger.log('error', 'general', 'update-location', 'Update location failed', { error: error.message });

      if (error.message.includes('not found')) {
        return reply.code(404).send({
          success: false,
          error: 'Location not found',
          message: error.message
        });
      }

      return reply.code(500).send({
        success: false,
        error: 'Update failed',
        message: 'Failed to update location'
      });
    }
  });

  // Assign location to organization
  fastify.post('/:locationId/assign/:organizationId', {
    schema: {
      description: 'Assign an existing location to an organization'
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as Record<string, string>;
    try {
      const locationId = (params as any).locationId ?? '';
      const organizationId = (params as any).organizationId ?? '';
      const userId = (request as any).userContext?.userId ?? '';
      const result = await (LocationService as any).assignLocationToOrganization(locationId, organizationId, userId);

      return reply.send(result);
    } catch (err: unknown) {
      const error = err as Error;
      Logger.log('error', 'general', 'assign-location', 'Assign location to organization failed', { error: error.message });

      if (error.message.includes('not found')) {
        return reply.code(404).send({
          success: false,
          error: 'Entity not found',
          message: error.message
        });
      }

      if (error.message.includes('already assigned')) {
        return reply.code(409).send({
          success: false,
          error: 'Already assigned',
          message: error.message
        });
      }

      return reply.code(500).send({
        success: false,
        error: 'Assignment failed',
        message: 'Failed to assign location to organization'
      });
    }
  });

  // Remove location from organization
  fastify.delete('/:locationId/organizations/:organizationId', {
    schema: {
      description: 'Remove location assignment from organization'
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as Record<string, string>;
    try {
      const locationId = (params as any).locationId ?? '';
      const organizationId = (params as any).organizationId ?? '';
      const userId = (request as any).userContext?.userId ?? '';
      const result = await (LocationService as any).removeLocationFromOrganization(locationId, organizationId, userId);

      return reply.send(result);
    } catch (err: unknown) {
      const error = err as Error;
      Logger.log('error', 'general', 'remove-location', 'Remove location from organization failed', { error: error.message });

      if (error.message.includes('last location')) {
        return reply.code(400).send({
          success: false,
          error: 'Cannot remove last location',
          message: error.message
        });
      }

      if (error.message.includes('not found')) {
        return reply.code(404).send({
          success: false,
          error: 'Assignment not found',
          message: error.message
        });
      }

      return reply.code(500).send({
        success: false,
        error: 'Removal failed',
        message: 'Failed to remove location from organization'
      });
    }
  });

  // Update location capacity
  fastify.put('/:locationId/capacity', {
    schema: {
      description: 'Update location capacity and usage'
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as Record<string, unknown>;
    const params = request.params as Record<string, string>;
    try {
      const locationId = (params as any).locationId ?? '';
      const capacityData = body;

      let userId = (request as any).userContext?.userId;
      if (!userId) {
        Logger.log('warning', 'general', 'update-location-capacity', 'No authentication context, using fallback user for testing');
        userId = '50d4f694-202f-4f27-943d-7aafeffee29c';
      }

      const result = await (LocationService as any).updateLocationCapacity(locationId, capacityData, userId ?? '');

      return reply.send(result);
    } catch (err: unknown) {
      const error = err as Error;
      Logger.log('error', 'general', 'update-location-capacity', 'Update location capacity failed', { error: error.message });

      if (error.message.includes('not found')) {
        return reply.code(404).send({
          success: false,
          error: 'Not found',
          message: error.message
        });
      }

      if (error.message.includes('cannot be negative') || error.message.includes('exceed')) {
        return reply.code(400).send({
          success: false,
          error: 'Invalid capacity data',
          message: error.message
        });
      }

      return reply.code(500).send({
        success: false,
        error: 'Capacity update failed',
        message: 'Failed to update location capacity'
      });
    }
  });

  // Get location analytics
  fastify.get('/:locationId/analytics', {
    schema: {
      description: 'Get location utilization analytics'
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as Record<string, string>;
    try {
      const locationId = (params as any).locationId ?? '';

      const result = await (LocationService as any).getLocationAnalytics(locationId);

      return reply.send(result);
    } catch (err: unknown) {
      const error = err as Error;
      Logger.log('error', 'general', 'get-location-analytics', 'Get location analytics failed', { error: error.message });

      if (error.message.includes('not found')) {
        return reply.code(404).send({
          success: false,
          error: 'Location not found',
          message: error.message
        });
      }

      return reply.code(500).send({
        success: false,
        error: 'Analytics retrieval failed',
        message: 'Failed to get location analytics'
      });
    }
  });

  // Get locations by utilization level
  fastify.get('/utilization/:tenantId/:utilizationLevel?', {
    schema: {
      description: 'Get locations filtered by utilization level'
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as Record<string, string>;
    try {
      const tenantId = (params as any).tenantId ?? '';
      const utilizationLevel = (params as any).utilizationLevel ?? 'all';

      const result = await (LocationService as any).getLocationsByUtilization(tenantId, utilizationLevel);

      return reply.send(result);
    } catch (err: unknown) {
      const error = err as Error;
      Logger.log('error', 'general', 'get-locations-by-utilization', 'Get locations by utilization failed', { error: error.message });
      return reply.code(500).send({
        success: false,
        error: 'Retrieval failed',
        message: 'Failed to get locations by utilization'
      });
    }
  });

  // Bulk update location capacities
  fastify.put('/bulk/capacity', {
    schema: {
      description: 'Bulk update location capacities'
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as Record<string, unknown>;
    try {
      const updates = (body as any).updates;

      let userId = (request as any).userContext?.userId;
      if (!userId) {
        Logger.log('warning', 'general', 'bulk-update-location-capacities', 'No authentication context, using fallback user for testing');
        userId = '50d4f694-202f-4f27-943d-7aafeffee29c';
      }

      const result = await (LocationService as any).bulkUpdateLocationCapacities(updates, userId ?? '');

      return reply.send(result);
    } catch (err: unknown) {
      const error = err as Error;
      Logger.log('error', 'general', 'bulk-update-location-capacities', 'Bulk update location capacities failed', { error: error.message });
      return reply.code(500).send({
        success: false,
        error: 'Bulk update failed',
        message: 'Failed to process bulk location capacity updates'
      });
    }
  });

  // Delete location
  fastify.delete('/:locationId', {
    schema: {
      description: 'Delete location (soft delete)'
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as Record<string, string>;
    try {
      const locationId = (params as any).locationId ?? '';
      const result = await LocationService.deleteLocation(locationId);

      return reply.send(result);
    } catch (err: unknown) {
      const error = err as Error;
      Logger.log('error', 'general', 'delete-location', 'Delete location failed', { error: error.message });

      if (error.message.includes('assigned to organizations')) {
        return reply.code(400).send({
          success: false,
          error: 'Cannot delete assigned location',
          message: error.message
        });
      }

      if (error.message.includes('not found')) {
        return reply.code(404).send({
          success: false,
          error: 'Location not found',
          message: error.message
        });
      }

      return reply.code(500).send({
        success: false,
        error: 'Deletion failed',
        message: 'Failed to delete location'
      });
    }
  });

  // Get all tenant locations
  fastify.get('/tenant/:tenantId', {
    schema: {
      description: 'Get all locations for a tenant'
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as Record<string, string>;
    try {
      const tenantId = (params as any).tenantId ?? '';
      const result = await EntityAdminService.getTenantEntities(tenantId, 'location');

      return reply.send(result);
    } catch (err: unknown) {
      const error = err as Error;
      Logger.log('error', 'general', 'get-tenant-locations', 'Get tenant locations failed', { error: error.message });
      return reply.code(500).send({
        success: false,
        error: 'Retrieval failed',
        message: 'Failed to get tenant locations'
      });
    }
  });
}
