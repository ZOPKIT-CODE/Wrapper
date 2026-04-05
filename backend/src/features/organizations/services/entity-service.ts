import { v4 as uuidv4 } from 'uuid';
import { and, eq } from 'drizzle-orm';

import { db } from '../../../db/index.js';
import { entities } from '../../../db/schema/organizations/unified-entities.js';
import { snsSqsPublisher } from '../../messaging/utils/sns-sqs-publisher.js';
import accountingEntityProvisioningService from '../../messaging/services/accounting-entity-provisioning-service.js';

type EntityType = 'organization' | 'location' | 'department' | 'team';

type CreateEntityInput = {
  entityName: string;
  entityType: EntityType;
  subType?: string;
  parentEntityId?: string | null;
  parentTenantId?: string;
  responsiblePersonId?: string | null;
  entityCode?: string;
  description?: string;
  legalName?: string;
  status?: string;
  country?: string;
  currency?: string;
  fiscalYearEnd?: string;
  taxId?: string;
  registrationNumber?: string;
  email?: string;
  phone?: string;
  website?: string;
  notes?: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    country?: string;
  };
};

class EntityService {
  async createEntity(data: CreateEntityInput, createdBy?: string) {
    const entityId = uuidv4();
    const now = new Date();

    let tenantIdToUse = data.parentTenantId ?? '';
    let parentEntityId: string | null = data.parentEntityId ?? null;
    let parentEntityCode: string | null = null;

    if (parentEntityId) {
      const [parent] = await db
        .select({
          entityId: entities.entityId,
          tenantId: entities.tenantId,
        })
        .from(entities)
        .where(and(eq(entities.entityId, parentEntityId), eq(entities.isActive, true)))
        .limit(1);

      if (!parent) {
        throw new Error('Parent entity not found');
      }
      tenantIdToUse = parent.tenantId;
      parentEntityId = parent.entityId;
      parentEntityCode = parent.entityId ?? null;
    }

    if (!tenantIdToUse) {
      throw new Error('Tenant ID is required');
    }

    const entityCode =
      data.entityCode ||
      (data.entityType === 'location'
        ? `LOC_${entityId.substring(0, 8)}`
        : `ENT_${entityId.substring(0, 8)}`);

    const inserted = await db
      .insert(entities)
      .values({
        entityId,
        tenantId: tenantIdToUse,
        entityType: data.entityType,
        parentEntityId,
        entityName: data.entityName.trim(),
        description: data.description || null,
        locationType: data.entityType === 'location' ? data.subType ?? null : null,
        address: data.entityType === 'location' ? (data.address as any) ?? null : null,
        responsiblePersonId: data.responsiblePersonId || createdBy || null,
        isActive: data.status ? data.status !== 'inactive' : true,
        createdBy: createdBy || null,
        createdAt: now,
        // Financial Accounting required fields
        legalName: data.legalName ?? data.entityName.trim(),
        country: data.country ?? data.address?.country ?? null,
        currency: data.currency ?? 'USD',
        fiscalYearEnd: data.fiscalYearEnd ?? '12-31',
        taxId: data.taxId ?? null,
        registrationNumber: data.registrationNumber ?? null,
        contactEmail: data.email ?? null,
        contactPhone: data.phone ?? null,
        contactWebsite: data.website ?? null,
      })
      .returning();

    const entity = inserted[0];

    // Publish one unified event across suite apps.
    try {
      await snsSqsPublisher.publishOrgEventToSuite(
        'entity.created',
        tenantIdToUse,
        entity.entityId,
        {
          // Canonical unified-entity field names (entityId for FA wrapper_entities.entity_id FK)
          entityId: entity.entityId,
          entityCode: entityCode,
          entityName: entity.entityName,
          entityType: data.entityType,
          subType: data.subType ?? null,
          legalName: data.legalName ?? data.entityName,
          country: data.country ?? data.address?.country ?? null,
          currency: data.currency ?? 'USD',
          fiscalYearEnd: data.fiscalYearEnd ?? '12-31',
          taxId: data.taxId ?? null,
          registrationNumber: data.registrationNumber ?? null,
          email: data.email ?? null,
          phone: data.phone ?? null,
          website: data.website ?? null,
          parentId: parentEntityId,
          parentEntityCode: parentEntityCode,
          parentOrgCode: parentEntityCode,
          status: data.status ?? 'active',
          isActive: entity.isActive,
          description: data.description ?? null,
          notes: data.notes ?? null,
          address: data.address ?? null,
          entityLevel: entity.entityLevel,
          hierarchyPath: entity.hierarchyPath ?? null,
          fullHierarchyPath: entity.fullHierarchyPath ?? null,
          createdBy: entity.createdBy ?? createdBy ?? null,
          createdAt: entity.createdAt ?? now,
        },
      );
    } catch (streamError: unknown) {
      const e = streamError as Error;
      console.warn('⚠️ Failed to publish entity creation event:', e.message);
    }

    // Accounting bridge: request auto-provision for eligible organization subtypes.
    try {
      await accountingEntityProvisioningService.publishProvisionRequest({
        tenantId: tenantIdToUse,
        entityId: entity.entityId,
        entityType: data.entityType,
        subType: data.subType ?? null,
        entityCode,
        entityName: entity.entityName,
        parentId: parentEntityId,
        description: data.description ?? null,
        createdBy: entity.createdBy ?? createdBy ?? null,
        createdAt: entity.createdAt ?? now,
      });
    } catch (provisionError: unknown) {
      const e = provisionError as Error;
      console.warn('⚠️ Failed to publish accounting provisioning request:', e.message);
    }

    return {
      success: true,
      entity,
      message: 'Entity created successfully',
    };
  }
}

export default new EntityService();
