import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import Logger from '../../../utils/logger.js';
import { authenticateToken } from '../../../middleware/auth/auth.js';
import DNSManagementService from '../services/dns-management-service.js';
import { db } from '../../../db/index.js';
import { tenants } from '../../../db/schema/index.js';
import { eq } from 'drizzle-orm';

export default async function dnsManagementRoutes(fastify: FastifyInstance, _options?: Record<string, unknown>): Promise<void> {
  // Create subdomain for tenant
  fastify.post('/api/dns/subdomains', {
    schema: {}
  }, async (request: FastifyRequest<{ Body: Record<string, unknown> }>, reply: FastifyReply) => {
    try {
      const { tenantId, customTarget } = request.body as Record<string, unknown>;

      Logger.log('info', 'general', 'create-subdomain', 'Creating subdomain for tenant', { tenantId });

      const result = await DNSManagementService.createTenantSubdomain(tenantId as string, customTarget as string | null);

      Logger.log('info', 'general', 'create-subdomain', 'Subdomain created successfully', { fullDomain: result.fullDomain });

      return reply.send({
        success: true,
        message: 'Subdomain created successfully',
        data: result
      });

    } catch (err: unknown) {
      const error = err as Error;
      Logger.log('error', 'general', 'create-subdomain', 'Subdomain creation failed', { error: error.message });

      if (error.message.includes('already has a subdomain')) {
        return reply.code(409).send({
          success: false,
          error: 'Subdomain exists',
          message: error.message
        });
      }

      return reply.code(500).send({
        success: false,
        error: 'Subdomain creation failed',
        message: error.message
      });
    }
  });

  // Setup custom domain (Step 1: Create verification)
  fastify.post('/api/dns/custom-domains', {
    schema: {}
  }, async (request: FastifyRequest<{ Body: Record<string, unknown> }>, reply: FastifyReply) => {
    try {
      const { tenantId, customDomain } = request.body as Record<string, unknown>;

      Logger.log('info', 'general', 'setup-custom-domain', 'Setting up custom domain for tenant', { customDomain, tenantId });

      const result = await DNSManagementService.setupCustomDomain(tenantId as string, customDomain as string);

      return reply.send({
        success: true,
        status: result.status,
        message: 'Custom domain setup initiated. Please add the verification TXT record.',
        data: {
          customDomain: result.customDomain,
          verificationDomain: result.verificationDomain,
          verificationToken: result.verificationToken,
          instructions: result.instructions
        }
      });

    } catch (err: unknown) {
      const error = err as Error;
      Logger.log('error', 'general', 'setup-custom-domain', 'Custom domain setup failed', { error: error.message });

      if (error.message.includes('Invalid domain format')) {
        return reply.code(400).send({
          success: false,
          error: 'Invalid domain',
          message: error.message
        });
      }

      if (error.message.includes('already assigned')) {
        return reply.code(409).send({
          success: false,
          error: 'Domain in use',
          message: error.message
        });
      }

      return reply.code(500).send({
        success: false,
        error: 'Custom domain setup failed',
        message: error.message
      });
    }
  });

  // Verify custom domain (Step 2: Verify ownership)
  fastify.post('/api/dns/verify-domain', {
    schema: {}
  }, async (request: FastifyRequest<{ Body: Record<string, unknown> }>, reply: FastifyReply) => {
    try {
      const { tenantId, customDomain } = request.body as Record<string, unknown>;

      Logger.log('info', 'general', 'verify-domain', 'Verifying domain ownership for tenant', { customDomain, tenantId });

      const result = await DNSManagementService.verifyDomainOwnership(tenantId as string, customDomain as string);

      if (!result.verified) {
        return reply.send({
          success: false,
          verified: false,
          message: result.message,
          data: {
            instructions: result.instructions
          }
        });
      }

      return reply.send({
        success: true,
        verified: true,
        message: result.message,
        data: {
          customDomain: result.customDomain,
          cnameChangeId: result.cnameChangeId
        }
      });

    } catch (err: unknown) {
      const error = err as Error;
      Logger.log('error', 'general', 'verify-domain', 'Domain verification failed', { error: error.message });

      if (error.message.includes('No verification request found')) {
        return reply.code(404).send({
          success: false,
          error: 'Verification not found',
          message: error.message
        });
      }

      return reply.code(500).send({
        success: false,
        error: 'Domain verification failed',
        message: error.message
      });
    }
  });

  // Get tenant domains
  fastify.get('/api/dns/tenants/:tenantId/domains', {
    schema: {}
  }, async (request: FastifyRequest<{ Params: { tenantId: string } }>, reply: FastifyReply) => {
    try {
      const { tenantId } = request.params;

      const domains = await DNSManagementService.getTenantDomains(tenantId);

      return reply.send({
        success: true,
        data: domains
      });

    } catch (err: unknown) {
      const error = err as Error;
      Logger.log('error', 'general', 'get-tenant-domains', 'Error fetching tenant domains', { error: error.message });

      if (error.message.includes('not found')) {
        return reply.code(404).send({
          success: false,
          error: 'Tenant not found',
          message: error.message
        });
      }

      return reply.code(500).send({
        success: false,
        error: 'Failed to fetch tenant domains',
        message: error.message
      });
    }
  });

  // Check subdomain availability
  fastify.post('/api/dns/check-subdomain', {
    schema: {}
  }, async (request: FastifyRequest<{ Body: Record<string, unknown> }>, reply: FastifyReply) => {
    try {
      const { subdomain } = request.body as Record<string, unknown>;

      // Clean and validate subdomain
      const cleanSubdomain = String(subdomain ?? '').toLowerCase().trim();

      if (!/^[a-z0-9-]+$/.test(cleanSubdomain)) {
        return reply.send({
          success: false,
          available: false,
          subdomain: cleanSubdomain,
          message: 'Invalid subdomain format. Use only lowercase letters, numbers, and hyphens.'
        });
      }

      // Check if subdomain exists
      const existing = await db
        .select({ tenantId: tenants.tenantId })
        .from(tenants)
        .where(eq(tenants.subdomain, cleanSubdomain))
        .limit(1);

      const available = existing.length === 0;

      return reply.send({
        success: true,
        available,
        subdomain: cleanSubdomain,
        message: available ? 'Subdomain is available' : 'Subdomain is already taken'
      });

    } catch (err: unknown) {
      const error = err as Error;
      Logger.log('error', 'general', 'check-subdomain', 'Subdomain check failed', { error: error.message });
      return reply.code(500).send({
        success: false,
        error: 'Subdomain check failed',
        message: error.message
      });
    }
  });

  // Validate custom domain format
  fastify.post('/api/dns/validate-domain', {
    schema: {}
  }, async (request: FastifyRequest<{ Body: Record<string, unknown> }>, reply: FastifyReply) => {
    try {
      const { domain } = request.body as Record<string, unknown>;

      const domainStr = String(domain ?? '');
      const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
      const isValid = domainRegex.test(domainStr);

      // Additional checks
      const parts = domainStr.split('.');
      const hasValidTLD = parts.length >= 2 && parts[parts.length - 1].length >= 2;
      const noConsecutiveHyphens = !domainStr.includes('--');
      const noLeadingTrailingHyphens = !domainStr.startsWith('-') && !domainStr.endsWith('-');

      const finalValid = isValid && hasValidTLD && noConsecutiveHyphens && noLeadingTrailingHyphens;

      return reply.send({
        success: true,
        valid: finalValid,
        domain: domain ?? '',
        message: finalValid ? 'Domain format is valid' : 'Invalid domain format'
      });

    } catch (err: unknown) {
      const error = err as Error;
      Logger.log('error', 'general', 'validate-domain', 'Domain validation failed', { error: error.message });
      return reply.code(500).send({
        success: false,
        error: 'Domain validation failed',
        message: error.message
      });
    }
  });

  // Get DNS change status
  fastify.get('/api/dns/changes/:changeId', {
    schema: {}
  }, async (request: FastifyRequest<{ Params: { changeId: string } }>, reply: FastifyReply) => {
    try {
      const { changeId } = request.params;

      const changeStatus = await DNSManagementService.getChangeStatus(changeId);

      return reply.send({
        success: true,
        data: changeStatus
      });

    } catch (err: unknown) {
      const error = err as Error;
      Logger.log('error', 'general', 'get-dns-change', 'Error fetching DNS change status', { error: error.message });
      return reply.code(500).send({
        success: false,
        error: 'Failed to fetch DNS change status',
        message: error.message
      });
    }
  });

  // DNS service health check
  fastify.get('/api/dns/health', async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const health = await DNSManagementService.healthCheck();

      return reply.send({
        success: true,
        ...health
      });

    } catch (err: unknown) {
      const error = err as Error;
      Logger.log('error', 'general', 'dns-health', 'DNS health check failed', { error: error.message });
      return reply.code(500).send({
        success: false,
        status: 'error',
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });

  // Delete subdomain
  fastify.delete<{ Params: { tenantId: string } }>('/api/dns/subdomains/:tenantId', {
    preHandler: authenticateToken
  }, async (request, reply) => {
    try {
      const { tenantId } = request.params;

      if (request.userContext.tenantId !== tenantId) {
        return reply.code(403).send({
          success: false,
          error: 'Forbidden: you do not have access to this tenant'
        });
      }

      Logger.log('info', 'general', 'delete-subdomain', 'Deleting subdomain for tenant', { tenantId });

      // Get tenant details
      const tenant = await db
        .select({
          tenantId: tenants.tenantId,
          subdomain: tenants.subdomain
        })
        .from(tenants)
        .where(eq(tenants.tenantId, tenantId))
        .limit(1);

      if (tenant.length === 0) {
        return reply.code(404).send({
          success: false,
          error: 'Tenant not found'
        });
      }

      if (!tenant[0].subdomain) {
        return reply.code(400).send({
          success: false,
          error: 'No subdomain to delete'
        });
      }

      const fullDomain = `${tenant[0].subdomain}.${DNSManagementService.baseDomain}`;

      // Delete DNS record
      const dnsResult = await DNSManagementService.deleteDNSRecord(
        fullDomain,
        DNSManagementService.recordTypes.SUBDOMAIN
      );

      // Update tenant record (clear subdomain)
      await db.update(tenants)
        .set({ subdomain: null as unknown as string, updatedAt: new Date() })
        .where(eq(tenants.tenantId, tenantId));

      Logger.log('info', 'general', 'delete-subdomain', 'Subdomain deleted', { fullDomain });

      return reply.send({
        success: true,
        message: 'Subdomain deleted successfully',
        data: {
          deletedDomain: fullDomain,
          dnsDeleted: dnsResult.deleted
        }
      });

    } catch (err: unknown) {
      const error = err as Error;
      Logger.log('error', 'general', 'delete-subdomain', 'Subdomain deletion failed', { error: error.message });
      return reply.code(500).send({
        success: false,
        error: 'Subdomain deletion failed',
        message: error.message
      });
    }
  });

  // Delete custom domain
  fastify.delete<{ Params: { tenantId: string } }>('/api/dns/custom-domains/:tenantId', {
    preHandler: authenticateToken
  }, async (request, reply) => {
    try {
      const { tenantId } = request.params;

      if (request.userContext.tenantId !== tenantId) {
        return reply.code(403).send({
          success: false,
          error: 'Forbidden: you do not have access to this tenant'
        });
      }

      Logger.log('info', 'general', 'delete-custom-domain', 'Deleting custom domain for tenant', { tenantId });

      // Get tenant details
      const tenant = await db
        .select({
          tenantId: tenants.tenantId,
          customDomain: tenants.customDomain
        })
        .from(tenants)
        .where(eq(tenants.tenantId, tenantId))
        .limit(1);

      if (tenant.length === 0) {
        return reply.code(404).send({
          success: false,
          error: 'Tenant not found'
        });
      }

      if (!tenant[0].customDomain) {
        return reply.code(400).send({
          success: false,
          error: 'No custom domain to delete'
        });
      }

      // Delete DNS record
      const dnsResult = await DNSManagementService.deleteDNSRecord(
        tenant[0].customDomain,
        'CNAME'
      );

      // Update tenant record
      await db.update(tenants)
        .set({
          customDomain: null,
          updatedAt: new Date()
        })
        .where(eq(tenants.tenantId, tenantId));

      Logger.log('info', 'general', 'delete-custom-domain', 'Custom domain deleted', { customDomain: tenant[0].customDomain });

      return reply.send({
        success: true,
        message: 'Custom domain deleted successfully',
        data: {
          deletedDomain: tenant[0].customDomain,
          dnsDeleted: dnsResult.deleted
        }
      });

    } catch (err: unknown) {
      const error = err as Error;
      Logger.log('error', 'general', 'delete-custom-domain', 'Custom domain deletion failed', { error: error.message });
      return reply.code(500).send({
        success: false,
        error: 'Custom domain deletion failed',
        message: error.message
      });
    }
  });
}
