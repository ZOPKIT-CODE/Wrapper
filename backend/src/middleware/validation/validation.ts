/**
 * Validation Middleware - Enhanced input validation for API requests
 * Provides comprehensive validation for organizations and locations
 */

import { db } from '../../db/index.js';
import { tenants, entities, tenantUsers } from '../../db/schema/index.js';
import { eq, and, ne } from 'drizzle-orm';
import type { FastifyRequest, FastifyReply } from 'fastify';
import Logger from '../../utils/logger.js';

// GSTIN validation regex
const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

// Email validation regex
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Phone validation regex (Indian format)
const PHONE_REGEX = /^(\+91|91|0)?[6-9]\d{9}$/;

/**
 * Validate GSTIN format
 */
export function validateGSTIN(gstin: string | null | undefined) {
  if (!gstin) return { valid: true, message: 'GSTIN is optional' };

  if (!GSTIN_REGEX.test(gstin)) {
    return {
      valid: false,
      message: 'Invalid GSTIN format. Must be 15 characters: 2 digits, 5 letters, 4 digits, 1 letter, 1 digit, 1 letter, 1 digit'
    };
  }

  return { valid: true, message: 'Valid GSTIN' };
}

/**
 * Validate email format
 */
export function validateEmail(email: string | null | undefined) {
  if (!email) return { valid: true, message: 'Email is optional' };

  if (!EMAIL_REGEX.test(email)) {
    return {
      valid: false,
      message: 'Invalid email format'
    };
  }

  return { valid: true, message: 'Valid email' };
}

/**
 * Validate phone number
 */
export function validatePhone(phone: string | null | undefined) {
  if (!phone) return { valid: true, message: 'Phone is optional' };

  if (!PHONE_REGEX.test(phone)) {
    return {
      valid: false,
      message: 'Invalid phone number format. Must be 10 digits (Indian format supported)'
    };
  }

  return { valid: true, message: 'Valid phone number' };
}

/**
 * Validate organization name uniqueness within tenant
 */
export async function validateOrganizationNameUniqueness(name: string | null | undefined, tenantId: string | null | undefined, excludeOrgId: string | null = null) {
  if (!name || !tenantId) return { valid: true, message: 'Name and tenant ID required for uniqueness check' };

  const conditions = [
    eq(entities.entityName, name.trim()),
    eq(entities.tenantId, tenantId),
    eq(entities.entityType, 'organization'),
    ...(excludeOrgId ? [ne(entities.entityId, excludeOrgId)] : [])
  ];
  const existingOrg = await db
    .select()
    .from(entities)
    .where(and(...conditions))
    .limit(1);

  if (existingOrg.length > 0) {
    return {
      valid: false,
      message: 'Organization name already exists in this tenant'
    };
  }

  return { valid: true, message: 'Organization name is unique' };
}

/**
 * Validate tenant exists
 */
export async function validateTenantExists(tenantId: string | null | undefined) {
  if (!tenantId) {
    return { valid: false, message: 'Tenant ID is required' };
  }

  const tenant = await db
    .select()
    .from(tenants)
    .where(eq(tenants.tenantId, tenantId))
    .limit(1);

  if (tenant.length === 0) {
    return { valid: false, message: 'Tenant not found' };
  }

  return { valid: true, message: 'Tenant exists' };
}

/**
 * Validate organization exists
 */
export async function validateOrganizationExists(organizationId: string | null | undefined) {
  if (!organizationId) {
    return { valid: false, message: 'Organization ID is required' };
  }

  const organization = await db
    .select()
    .from(entities)
    .where(and(
      eq(entities.entityId, organizationId),
      eq(entities.entityType, 'organization')
    ))
    .limit(1);

  if (organization.length === 0) {
    return { valid: false, message: 'Organization not found' };
  }

  return { valid: true, message: 'Organization exists' };
}

/**
 * Validate user exists
 */
export async function validateUserExists(userId: string | null | undefined) {
  if (!userId) {
    return { valid: false, message: 'User ID is required' };
  }

  const user = await db
    .select()
    .from(tenantUsers)
    .where(eq(tenantUsers.userId, userId))
    .limit(1);

  if (user.length === 0) {
    return { valid: false, message: 'User not found' };
  }

  return { valid: true, message: 'User exists' };
}

/**
 * Validate organization hierarchy (prevent circular references)
 */
export async function validateHierarchyIntegrity(parentOrgId: string | null | undefined, childOrgId: string | null = null) {
  if (!parentOrgId) return { valid: true, message: 'No parent organization to validate' };

  // If we're creating a new org, just validate parent exists
  if (!childOrgId) {
    return await validateOrganizationExists(parentOrgId);
  }

  // For existing org moves, check for circular references
  const parentOrg = await db
    .select({ hierarchyPath: entities.hierarchyPath })
    .from(entities)
    .where(and(
      eq(entities.entityId, parentOrgId),
      eq(entities.entityType, 'organization')
    ))
    .limit(1);

  if (parentOrg.length === 0) {
    return { valid: false, message: 'Parent organization not found' };
  }

  // Check if moving to a descendant would create a circular reference
  const hierarchyPath = parentOrg[0]?.hierarchyPath;
  if (hierarchyPath && childOrgId && hierarchyPath.includes(childOrgId)) {
    return {
      valid: false,
      message: 'Cannot move organization to its own descendant (circular reference)'
    };
  }

  return { valid: true, message: 'Hierarchy integrity validated' };
}

/**
 * Validate location data
 */
export function validateLocationData(data: Record<string, unknown>) {
  const { name, address, city, country } = data as { name?: string; address?: string; city?: string; country?: string };

  if (!name || name.trim().length < 2) {
    return { valid: false, message: 'Location name must be at least 2 characters' };
  }

  if (!address || address.trim().length < 5) {
    return { valid: false, message: 'Address must be at least 5 characters' };
  }

  if (!city || city.trim().length < 2) {
    return { valid: false, message: 'City must be at least 2 characters' };
  }

  if (!country || country.trim().length < 2) {
    return { valid: false, message: 'Country must be at least 2 characters' };
  }

  return { valid: true, message: 'Location data is valid' };
}

/**
 * Comprehensive organization validation
 */
export async function validateOrganizationData(data: Record<string, unknown>, isUpdate = false, existingOrgId: string | null = null) {
  const name = data.name as string | undefined;
  const organizationName = data.organizationName as string | undefined;
  const entityName = data.entityName as string | undefined;
  const description = data.description as string | undefined;
  const gstin = data.gstin as string | undefined;
  const parentTenantId = data.parentTenantId as string | undefined;
  const parentOrganizationId = data.parentOrganizationId as string | undefined;
  const parentEntityId = data.parentEntityId as string | undefined;
  const orgName = name ?? organizationName ?? entityName;
  const tenantId = parentTenantId;
  const parentOrgId = parentOrganizationId ?? parentEntityId;
  const errors: string[] = [];

  if (!isUpdate && (!orgName || (typeof orgName === 'string' && orgName.trim().length < 2))) {
    errors.push('Organization name must be at least 2 characters');
  }
  if (isUpdate && orgName !== undefined && typeof orgName === 'string' && orgName.trim().length < 2) {
    errors.push('Organization name must be at least 2 characters');
  }
  if (!isUpdate && !tenantId && parentOrgId) {
    errors.push('Parent tenant ID is required for new organizations');
  }
  if (orgName && typeof orgName === 'string' && orgName.length > 255) {
    errors.push('Organization name cannot exceed 255 characters');
  }
  if (description && typeof description === 'string' && description.length > 1000) {
    errors.push('Description cannot exceed 1000 characters');
  }
  if (gstin) {
    const gstinValidation = validateGSTIN(gstin);
    if (!gstinValidation.valid) {
      errors.push(gstinValidation.message);
    }
  }
  if (orgName && tenantId) {
    const uniquenessCheck = await validateOrganizationNameUniqueness(orgName, tenantId, existingOrgId);
    if (!uniquenessCheck.valid) {
      errors.push(uniquenessCheck.message);
    }
  }
  if (parentOrgId) {
    const parentValidation = await validateOrganizationExists(parentOrgId);
    if (!parentValidation.valid) {
      errors.push(parentValidation.message);
    }
    const hierarchyValidation = await validateHierarchyIntegrity(parentOrgId, existingOrgId);
    if (!hierarchyValidation.valid) {
      errors.push(hierarchyValidation.message);
    }
  }
  if (tenantId) {
    const tenantValidation = await validateTenantExists(tenantId);
    if (!tenantValidation.valid) {
      errors.push(tenantValidation.message);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    message: errors.length === 0 ? 'All validations passed' : `Validation failed: ${errors.join(', ')}`
  };
}

/**
 * Validation middleware for organization creation
 */
export async function validateOrganizationCreation(request: FastifyRequest, reply: FastifyReply) {
  const validation = await validateOrganizationData((request.body ?? {}) as Record<string, unknown>);

  if (!validation.valid) {
    return reply.code(400).send({
      success: false,
      error: 'Validation failed',
      message: validation.message,
      errors: validation.errors
    });
  }
}

/**
 * Validation middleware for organization updates
 */
export async function validateOrganizationUpdate(request: FastifyRequest, reply: FastifyReply) {
  const params = request.params as { organizationId?: string };
  const organizationId = params?.organizationId ?? null;
  const validation = await validateOrganizationData((request.body ?? {}) as Record<string, unknown>, true, organizationId);

  if (!validation.valid) {
    return reply.code(400).send({
      success: false,
      error: 'Validation failed',
      message: validation.message,
      errors: validation.errors
    });
  }
}

/**
 * Validation middleware for location creation
 */
export async function validateLocationCreation(request: FastifyRequest, reply: FastifyReply) {
  const body = (request.body ?? {}) as Record<string, unknown>;
  const locationValidation = validateLocationData(body);

  if (!locationValidation.valid) {
    return reply.code(400).send({
      success: false,
      error: 'Validation failed',
      message: locationValidation.message
    });
  }

  const organizationId = body.organizationId as string | undefined;
  if (organizationId) {
    const orgValidation = await validateOrganizationExists(organizationId);
    if (!orgValidation.valid) {
      return reply.code(400).send({
        success: false,
        error: 'Validation failed',
        message: orgValidation.message
      });
    }
  }
}

/**
 * Sanitize input data
 */
export function sanitizeInput(data: Record<string, unknown>): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(data)) {
    if (typeof value === 'string') {
      // Trim whitespace and escape HTML
      sanitized[key] = value.trim().replace(/[<>]/g, '');
    } else if (value !== null && value !== undefined) {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

/**
 * Middleware to sanitize request input
 */
export function sanitizeInputMiddleware() {
  return async (request: FastifyRequest, _reply: FastifyReply) => {
    try {
      if (request.body && typeof request.body === 'object') {
        (request as { body: unknown }).body = sanitizeInput(request.body as Record<string, unknown>);
      }
      if (request.query && typeof request.query === 'object') {
        (request as { query: unknown }).query = sanitizeInput(request.query as Record<string, unknown>);
      }
      if (request.params && typeof request.params === 'object') {
        (request as { params: unknown }).params = sanitizeInput(request.params as Record<string, unknown>);
      }
    } catch (error) {
      Logger.log('error', 'validation', 'sanitize-input-middleware', '❌ Input sanitization error', { error });
      // Don't fail the request for sanitization errors, just log them
    }
  };
}
