import { InterAppEventService } from './inter-app-event-service.js';

type ProvisionCandidateInput = {
  tenantId: string;
  entityId: string;
  entityType?: string | null;
  subType?: string | null;
  entityCode?: string | null;
  entityName?: string | null;
  parentId?: string | null;
  description?: string | null;
  createdBy?: string | null;
  createdAt?: string | Date | null;
};

const ACCOUNTING_ELIGIBLE_SUBTYPES = new Set([
  'subsidiary',
  'branch',
  'division',
  'parent',
  'business_unit',
]);

function normalizeSubType(value: string | null | undefined): string | null {
  if (!value) return null;
  return value.trim().toLowerCase();
}

function isAccountingProvisionCandidate(input: ProvisionCandidateInput): boolean {
  const entityType = String(input.entityType || '').trim().toLowerCase();
  const subType = normalizeSubType(input.subType);
  return entityType === 'organization' && !!subType && ACCOUNTING_ELIGIBLE_SUBTYPES.has(subType);
}

class AccountingEntityProvisioningService {
  async publishProvisionRequest(input: ProvisionCandidateInput): Promise<void> {
    if (!isAccountingProvisionCandidate(input)) return;
    if (!input.tenantId || !input.entityId) return;

    const normalizedSubType = normalizeSubType(input.subType);
    const idempotencyKey = `acct-provision:${input.tenantId}:${input.entityId}`;
    const createdAtIso =
      input.createdAt instanceof Date
        ? input.createdAt.toISOString()
        : input.createdAt || new Date().toISOString();

    await InterAppEventService.publishEvent({
      eventType: 'accounting.entity.provision.requested',
      sourceApplication: 'wrapper',
      targetApplication: 'accounting',
      tenantId: input.tenantId,
      entityId: input.entityId,
      publishedBy: input.createdBy || 'system',
      eventData: {
        idempotencyKey,
        entity: {
          entityId: input.entityId,
          entityCode: input.entityCode || input.entityId,
          entityName: input.entityName || '',
          entityType: 'organization',
          subType: normalizedSubType,
          parentId: input.parentId || null,
          description: input.description || null,
          createdAt: createdAtIso,
          createdBy: input.createdBy || null,
        },
        requestedBy: 'wrapper.entity.created',
      },
    });
  }
}

export default new AccountingEntityProvisioningService();
