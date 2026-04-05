/**
 * Integration tests for credit-config-tenant service functions.
 *
 * Tests hit a real PostgreSQL container (started by global-setup.ts).
 * SNS publisher is mocked — no real AWS calls made.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'crypto';
import {
  createTestDb,
  seedTenant,
  seedUser,
  type TestDb,
} from '../../../db/test-helpers/seed.js';
import {
  getTenantOperationConfigs,
  setTenantOperationConfig,
  resetTenantConfiguration,
  getTenantConfigurations,
} from './credit-config-tenant.js';

// ── Mock SNS/SQS publisher so events are fire-and-forget in tests ──────────
vi.mock('../../messaging/utils/sns-sqs-publisher.js', () => ({
  snsSqsPublisher: {
    publishCreditEvent: vi.fn().mockResolvedValue(undefined),
  },
}));

let testDb: TestDb;
let endDb: () => Promise<void>;

beforeAll(() => {
  const conn = createTestDb();
  testDb = conn.db;
  endDb = conn.end;
});

afterAll(() => endDb());

// ── getTenantOperationConfigs ─────────────────────────────────────────────

describe('getTenantOperationConfigs', () => {
  it('returns an empty array for a tenant with no configurations', async () => {
    const tenant = await seedTenant(testDb);

    const result = await getTenantOperationConfigs(tenant.tenantId);

    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(0);
  });
});

// ── setTenantOperationConfig ──────────────────────────────────────────────

describe('setTenantOperationConfig – create', () => {
  it('creates a new config and returns success=true with action="created"', async () => {
    const tenant = await seedTenant(testDb);
    const user = await seedUser(testDb, tenant.tenantId);
    const opCode = `crm.leads.create_${randomUUID().slice(0, 8)}`;

    const result = await setTenantOperationConfig(
      opCode,
      { creditCost: 2.5, unit: 'operation' },
      user.userId,
      tenant.tenantId,
    );

    expect(result.success).toBe(true);
    expect(result.action).toBe('created');
    const config = result.config as Record<string, unknown>;
    expect(config.operationCode).toBe(opCode);
  });

  it('the created config appears in getTenantOperationConfigs', async () => {
    const tenant = await seedTenant(testDb);
    const user = await seedUser(testDb, tenant.tenantId);
    const opCode = `crm.contacts.read_${randomUUID().slice(0, 8)}`;

    await setTenantOperationConfig(
      opCode,
      { creditCost: 1.0 },
      user.userId,
      tenant.tenantId,
    );

    const configs = await getTenantOperationConfigs(tenant.tenantId);

    const found = configs.find((c) => (c as Record<string, unknown>).operationCode === opCode);
    expect(found).toBeDefined();
    expect((found as Record<string, unknown>).creditCost).toBeCloseTo(1.0);
  });

  it('stores the creditCost accurately (decimal precision)', async () => {
    const tenant = await seedTenant(testDb);
    const user = await seedUser(testDb, tenant.tenantId);
    const opCode = `hr.payroll.process_${randomUUID().slice(0, 8)}`;

    await setTenantOperationConfig(
      opCode,
      { creditCost: 7.75, unit: 'record' },
      user.userId,
      tenant.tenantId,
    );

    const configs = await getTenantOperationConfigs(tenant.tenantId);
    const found = configs.find((c) => (c as Record<string, unknown>).operationCode === opCode) as Record<string, unknown>;

    expect(found).toBeDefined();
    expect(parseFloat(String(found.creditCost))).toBeCloseTo(7.75);
    expect(found.unit).toBe('record');
  });

  it('defaults unit to "operation" when not provided', async () => {
    const tenant = await seedTenant(testDb);
    const user = await seedUser(testDb, tenant.tenantId);
    const opCode = `crm.deals.close_${randomUUID().slice(0, 8)}`;

    await setTenantOperationConfig(opCode, { creditCost: 5 }, user.userId, tenant.tenantId);

    const configs = await getTenantOperationConfigs(tenant.tenantId);
    const found = configs.find((c) => (c as Record<string, unknown>).operationCode === opCode) as Record<string, unknown>;

    expect(found?.unit).toBe('operation');
  });

  it('throws when creditCost is missing', async () => {
    const tenant = await seedTenant(testDb);
    const user = await seedUser(testDb, tenant.tenantId);
    const opCode = `bad.op_${randomUUID().slice(0, 8)}`;

    await expect(
      setTenantOperationConfig(opCode, {}, user.userId, tenant.tenantId),
    ).rejects.toThrow('Valid credit cost is required');
  });

  it('throws when creditCost is NaN', async () => {
    const tenant = await seedTenant(testDb);
    const user = await seedUser(testDb, tenant.tenantId);
    const opCode = `bad.nan_${randomUUID().slice(0, 8)}`;

    await expect(
      setTenantOperationConfig(opCode, { creditCost: 'not-a-number' }, user.userId, tenant.tenantId),
    ).rejects.toThrow('Valid credit cost is required');
  });
});

describe('setTenantOperationConfig – update', () => {
  it('updates an existing config and returns action="updated"', async () => {
    const tenant = await seedTenant(testDb);
    const user = await seedUser(testDb, tenant.tenantId);
    const opCode = `crm.leads.export_${randomUUID().slice(0, 8)}`;

    // Create first
    await setTenantOperationConfig(opCode, { creditCost: 3.0 }, user.userId, tenant.tenantId);

    // Update
    const updateResult = await setTenantOperationConfig(
      opCode,
      { creditCost: 5.0, unit: 'batch' },
      user.userId,
      tenant.tenantId,
    );

    expect(updateResult.action).toBe('updated');
    const config = updateResult.config as Record<string, unknown>;
    expect(parseFloat(String(config.creditCost))).toBeCloseTo(5.0);
  });

  it('config is tenant-scoped: same opCode for different tenants does not conflict', async () => {
    const tenantA = await seedTenant(testDb);
    const tenantB = await seedTenant(testDb);
    const userA = await seedUser(testDb, tenantA.tenantId);
    const userB = await seedUser(testDb, tenantB.tenantId);
    const sharedOpCode = `shared.op_${randomUUID().slice(0, 8)}`;

    await setTenantOperationConfig(sharedOpCode, { creditCost: 1.0 }, userA.userId, tenantA.tenantId);
    await setTenantOperationConfig(sharedOpCode, { creditCost: 9.0 }, userB.userId, tenantB.tenantId);

    const configsA = await getTenantOperationConfigs(tenantA.tenantId);
    const configsB = await getTenantOperationConfigs(tenantB.tenantId);

    const foundA = configsA.find((c) => (c as Record<string, unknown>).operationCode === sharedOpCode) as Record<string, unknown>;
    const foundB = configsB.find((c) => (c as Record<string, unknown>).operationCode === sharedOpCode) as Record<string, unknown>;

    expect(parseFloat(String(foundA.creditCost))).toBeCloseTo(1.0);
    expect(parseFloat(String(foundB.creditCost))).toBeCloseTo(9.0);
  });
});

// ── resetTenantConfiguration ──────────────────────────────────────────────

describe('resetTenantConfiguration', () => {
  it('deletes a tenant operation config and reports deletedCount=1', async () => {
    const tenant = await seedTenant(testDb);
    const user = await seedUser(testDb, tenant.tenantId);
    const opCode = `crm.reports.view_${randomUUID().slice(0, 8)}`;

    await setTenantOperationConfig(opCode, { creditCost: 2 }, user.userId, tenant.tenantId);

    const result = await resetTenantConfiguration(
      tenant.tenantId,
      'operation',
      opCode,
      user.userId,
    );

    expect(result.success).toBe(true);
    expect((result as Record<string, unknown>).deletedCount).toBe(1);

    // Verify gone from DB
    const configs = await getTenantOperationConfigs(tenant.tenantId);
    const found = configs.find((c) => (c as Record<string, unknown>).operationCode === opCode);
    expect(found).toBeUndefined();
  });

  it('returns success with no deletedCount when config does not exist', async () => {
    const tenant = await seedTenant(testDb);
    const user = await seedUser(testDb, tenant.tenantId);
    const opCode = `nonexistent.op_${randomUUID().slice(0, 8)}`;

    const result = await resetTenantConfiguration(
      tenant.tenantId,
      'operation',
      opCode,
      user.userId,
    );

    expect(result.success).toBe(true);
    // No deletedCount when nothing was found
    expect((result as Record<string, unknown>).deletedCount).toBeUndefined();
  });

  it('throws for invalid configType', async () => {
    const tenant = await seedTenant(testDb);
    const user = await seedUser(testDb, tenant.tenantId);

    await expect(
      resetTenantConfiguration(tenant.tenantId, 'invalid_type', 'any.op', user.userId),
    ).rejects.toThrow('Invalid config type');
  });
});

// ── getTenantConfigurations ───────────────────────────────────────────────

describe('getTenantConfigurations', () => {
  it('returns a well-formed structure with tenantId, configurations, and globalConfigs', async () => {
    const tenant = await seedTenant(testDb);

    const result = await getTenantConfigurations(tenant.tenantId);

    expect(result.tenantId).toBe(tenant.tenantId);
    expect(typeof result.configurations).toBe('object');
    expect(typeof result.globalConfigs).toBe('object');
    expect(Array.isArray((result.configurations as Record<string, unknown>).operations)).toBe(true);
  });

  it('includes tenant-specific configs in the configurations.operations array', async () => {
    const tenant = await seedTenant(testDb);
    const user = await seedUser(testDb, tenant.tenantId);
    const opCode = `crm.tasks.create_${randomUUID().slice(0, 8)}`;

    await setTenantOperationConfig(opCode, { creditCost: 3 }, user.userId, tenant.tenantId);

    const result = await getTenantConfigurations(tenant.tenantId);
    const ops = (result.configurations as Record<string, unknown>).operations as Record<string, unknown>[];

    const found = ops.find((c) => c.operationCode === opCode);
    expect(found).toBeDefined();
  });
});
