/**
 * UnifiedOnboardingService — Integration Tests
 *
 * Runs against a REAL PostgreSQL container (Testcontainers).
 *
 * What these tests prove that unit tests cannot:
 *   1. completeOnboardingWorkflow writes ALL expected records in one transaction
 *      and marks onboarding complete in the real DB.
 *   2. Duplicate email detection works against the live DB — a completed tenant
 *      triggers the AlreadyOnboardedError path.
 *   3. A failure inside the DB transaction is fully rolled back — no partial rows.
 *   4. generateUniqueSubdomain increments the suffix when the base subdomain is
 *      already taken in the real DB.
 *
 * External side-effects mocked:
 *   - cognito-admin-service     (Cognito user lifecycle)
 *   - VerificationService       (sandbox.co.in PAN/GSTIN API)
 *   - InterAppEventService      (SNS publish)
 *   - OnboardingFileLogger      (filesystem writes)
 *   - OnboardingVerificationService (heavy internal verifier — returns "all OK")
 *   - onboarding-tracking-service   (event tracking — no-op)
 */

import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  afterEach,
  vi,
} from 'vitest';
import { randomUUID } from 'crypto';
import { sql } from 'drizzle-orm';
import { createTestDb, seedTenant, type TestDb } from '../../../db/test-helpers/seed.js';

// ---------------------------------------------------------------------------
// Module-level mocks (hoisted before imports of the SUT)
// ---------------------------------------------------------------------------

// 1. cognito-admin-service — prevent real AWS Cognito admin API calls.
//    Onboarding user-creation now goes through adminCreateUser (Cognito user lifecycle),
//    invoked by OnboardingExternalService.setupKindeIntegration. The other admin fns are
//    stubbed defensively in case the lifecycle path touches them.
vi.mock('../../auth/services/cognito-admin-service.js', () => ({
  adminCreateUser: vi.fn(async () => ({ sub: 'cognito-sub-1', username: 'test@example.com' })),
  adminGetUserByEmail: vi.fn(),
  adminDisableUser: vi.fn(),
  adminDeleteUser: vi.fn(),
}));

// 2. VerificationService — skip external PAN/GSTIN HTTP calls
vi.mock('./verification-service.js', () => ({
  default: {
    verifyPAN:   vi.fn().mockResolvedValue({ verified: true, details: {} }),
    verifyGSTIN: vi.fn().mockResolvedValue({ verified: true, details: { status: 'active', isActive: true } }),
  },
}));

// 3. InterAppEventService — prevent SNS/SQS connection
vi.mock('../../../features/messaging/index.js', () => ({
  InterAppEventService: {
    publishEvent: vi.fn().mockResolvedValue(undefined),
  },
}));

// 4. OnboardingFileLogger — prevent filesystem writes
vi.mock('../../../utils/onboarding-file-logger.js', () => ({
  // Use a class (unambiguously a constructor — the code does `new OnboardingFileLogger`).
  OnboardingFileLogger: class {
    onboarding = { start: vi.fn(), step: vi.fn(), success: vi.fn(), warning: vi.fn(), error: vi.fn() };
    kinde      = { start: vi.fn(), success: vi.fn(), error: vi.fn(), warning: vi.fn() };
    finalize   = vi.fn().mockResolvedValue({ logFile: null });
  },
}));

// 5. OnboardingVerificationService (dynamically imported) — return "all verified"
vi.mock('./onboarding-verification-service.js', () => ({
  OnboardingVerificationService: {
    verifyOnboardingCompletion: vi.fn().mockResolvedValue({
      verified: true,
      criticalIssues: [],
      details: { applicationAssignments: [], missingItems: [] },
    }),
    autoFixOnboardingIssues: vi.fn().mockResolvedValue({ success: true }),
  },
}));

// 6. onboarding-tracking-service (dynamically imported) — no-op
vi.mock('./onboarding-tracking-service.js', () => ({
  default: {
    trackOnboardingPhase: vi.fn().mockResolvedValue(undefined),
  },
}));

// ---------------------------------------------------------------------------
// Now import the SUT (after mocks are registered)
// ---------------------------------------------------------------------------
import { UnifiedOnboardingService } from './unified-onboarding-service.js';
import OnboardingValidationService from './onboarding-validation-service.js';

// ---------------------------------------------------------------------------
// Shared test state
// ---------------------------------------------------------------------------

let db: TestDb;
let endDb: () => Promise<void>;

/** tenantIds inserted by each test — cleaned up in afterEach */
const createdTenantIds: string[] = [];

beforeAll(() => {
  const conn = createTestDb();
  db    = conn.db;
  endDb = conn.end;
});

afterAll(() => endDb());

afterEach(async () => {
  // Delete rows created during each test to keep the DB clean.
  // Order matters — delete children before parents to respect FKs.
  if (createdTenantIds.length === 0) return;

  for (const tenantId of createdTenantIds) {
    // The onboarding graph has many interdependent FKs (memberships/assignments ->
    // roles & entities, entities <-> tenant_users, credit_transactions -> entities,
    // ...). Rather than chase a perfect delete order, disable FK triggers for the
    // per-tenant cleanup. SET LOCAL is scoped to this transaction and resets on
    // commit, so it does not leak to other tests; tester is the container superuser.
    await db.transaction(async (tx) => {
      await tx.execute(sql`SET LOCAL session_replication_role = replica`);
      await tx.execute(sql`DELETE FROM user_role_assignments    WHERE organization_id = ${tenantId}`);
      await tx.execute(sql`DELETE FROM organization_memberships WHERE tenant_id       = ${tenantId}`);
      await tx.execute(sql`DELETE FROM custom_roles             WHERE tenant_id       = ${tenantId}`);
      await tx.execute(sql`DELETE FROM responsible_persons      WHERE tenant_id       = ${tenantId}`);
      await tx.execute(sql`DELETE FROM credit_transactions      WHERE tenant_id       = ${tenantId}`);
      await tx.execute(sql`DELETE FROM credits                  WHERE tenant_id       = ${tenantId}`);
      await tx.execute(sql`DELETE FROM entities                 WHERE tenant_id       = ${tenantId}`);
      await tx.execute(sql`DELETE FROM tenant_users             WHERE tenant_id       = ${tenantId}`);
      await tx.execute(sql`DELETE FROM subscriptions            WHERE tenant_id       = ${tenantId}`);
      await tx.execute(sql`DELETE FROM onboarding_events        WHERE tenant_id       = ${tenantId}`);
      await tx.execute(sql`DELETE FROM tenants                  WHERE tenant_id       = ${tenantId}`);
    });
  }

  createdTenantIds.length = 0;
});

// ---------------------------------------------------------------------------
// Helper: build a minimal valid "frontend" onboarding payload
// ---------------------------------------------------------------------------

function buildPayload(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  const suffix = randomUUID().slice(0, 8);
  return {
    type:          'frontend',
    companyName:   `Test Company ${suffix}`,
    adminEmail:    `admin-${suffix}@testco.example`,
    firstName:     'Test',
    lastName:      'Admin',
    companySize:   '1-10',
    businessType:  'technology',
    country:       'IN',
    state:         'KA',
    timezone:      'Asia/Kolkata',
    currency:      'INR',
    defaultLanguage: 'en',
    defaultLocale:   'en-IN',
    termsAccepted: true,
    selectedPlan:  'free',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('UnifiedOnboardingService.completeOnboardingWorkflow', () => {

  // -------------------------------------------------------------------------
  it(
    'happy path: creates all expected DB records and marks onboarding complete',
    async () => {
      const payload = buildPayload();

      const result = await UnifiedOnboardingService.completeOnboardingWorkflow(payload);

      // Service must report success
      expect(result.success).toBe(true);
      expect(result.verified).toBe(true);

      const tenantId = (result.tenant as { tenantId: string }).tenantId;
      createdTenantIds.push(tenantId);

      // ---- tenants row ----
      const [tenantRow] = await db.execute(sql`
        SELECT tenant_id, onboarding_completed, admin_email
        FROM tenants
        WHERE tenant_id = ${tenantId}
      `) as unknown as Array<{ tenant_id: string; onboarding_completed: boolean; admin_email: string }>;
      expect(tenantRow).toBeDefined();
      expect(tenantRow.onboarding_completed).toBe(true);
      expect(tenantRow.admin_email).toBe(payload.adminEmail);

      // ---- tenant_users row (isTenantAdmin = true) ----
      const [userRow] = await db.execute(sql`
        SELECT user_id, is_tenant_admin, email
        FROM tenant_users
        WHERE tenant_id = ${tenantId}
        LIMIT 1
      `) as unknown as Array<{ user_id: string; is_tenant_admin: boolean; email: string }>;
      expect(userRow).toBeDefined();
      expect(userRow.is_tenant_admin).toBe(true);
      expect(userRow.email).toBe(payload.adminEmail);

      // ---- custom_roles row ----
      const [roleRow] = await db.execute(sql`
        SELECT role_id, role_name FROM custom_roles
        WHERE tenant_id = ${tenantId}
        LIMIT 1
      `) as unknown as Array<{ role_id: string; role_name: string }>;
      expect(roleRow).toBeDefined();

      // ---- user_role_assignments row (PK column is `id`, not `assignment_id`) ----
      const [assignmentRow] = await db.execute(sql`
        SELECT id FROM user_role_assignments
        WHERE organization_id = ${tenantId}
        LIMIT 1
      `) as unknown as Array<{ id: string }>;
      expect(assignmentRow).toBeDefined();

      // ---- subscriptions row ----
      const [subRow] = await db.execute(sql`
        SELECT subscription_id, plan FROM subscriptions
        WHERE tenant_id = ${tenantId}
        LIMIT 1
      `) as unknown as Array<{ subscription_id: string; plan: string }>;
      expect(subRow).toBeDefined();
      expect(subRow.plan).toBe('free');

      // ---- entities row (root organization) ----
      const [orgRow] = await db.execute(sql`
        SELECT entity_id, entity_type FROM entities
        WHERE tenant_id = ${tenantId}
          AND entity_type = 'organization'
        LIMIT 1
      `) as unknown as Array<{ entity_id: string; entity_type: string }>;
      expect(orgRow).toBeDefined();

      // ---- credits row ----
      const [creditRow] = await db.execute(sql`
        SELECT credit_id, available_credits FROM credits
        WHERE tenant_id = ${tenantId}
        LIMIT 1
      `) as unknown as Array<{ credit_id: string; available_credits: string }>;
      expect(creditRow).toBeDefined();
      expect(Number(creditRow.available_credits)).toBeGreaterThan(0);
    },
    30_000,
  );

  // -------------------------------------------------------------------------
  it(
    'duplicate email: already-onboarded tenant causes AlreadyOnboardedError',
    async () => {
      // Pre-insert a tenant with onboarding_completed = true and a fixed email
      const existingTenant = await seedTenant(db, {
        adminEmail: `dup-${randomUUID().slice(0, 8)}@dup.example`,
      });

      // Force onboarding_completed = true in the raw row
      await db.execute(sql`
        UPDATE tenants
        SET onboarding_completed = true
        WHERE tenant_id = ${existingTenant.tenantId}
      `);

      createdTenantIds.push(existingTenant.tenantId);

      // Now attempt onboarding with the SAME email
      const payload = buildPayload({ adminEmail: existingTenant.adminEmail });

      await expect(
        UnifiedOnboardingService.completeOnboardingWorkflow(payload),
      ).rejects.toSatisfy((err: unknown) => {
        const e = err as Error & { name?: string };
        return (
          e.name === 'AlreadyOnboardedError' ||
          (e.message ?? '').toLowerCase().includes('already')
        );
      });
    },
    30_000,
  );

  // -------------------------------------------------------------------------
  it(
    'transaction rollback: failure inside DB transaction leaves no tenant row',
    async () => {
      // Arrange: make createSuperAdminRoleConfig throw so the INSERT inside the
      // transaction fails before COMMIT.  We mock the permission-matrix module.
      vi.doMock('../../../data/permission-matrix.js', () => ({
        createSuperAdminRoleConfig: vi.fn().mockImplementation(() => {
          throw new Error('Simulated role config failure — triggers rollback');
        }),
        PermissionMatrixUtils: { getPlanCredits: vi.fn().mockReturnValue({ free: 1000 }) },
        PLAN_ACCESS_MATRIX: {
          free:       { applications: [], modules: {} },
          trial:      { applications: [], modules: {} },
          enterprise: { applications: [], modules: {} },
        },
      }));

      const payload = buildPayload();
      const emailUsed = payload.adminEmail as string;

      // Act: the workflow should throw because the transaction was aborted
      await expect(
        UnifiedOnboardingService.completeOnboardingWorkflow(payload),
      ).rejects.toThrow();

      // Assert: no tenant row with this email was persisted
      const rows = await db.execute(sql`
        SELECT tenant_id FROM tenants WHERE admin_email = ${emailUsed}
      `) as unknown as Array<{ tenant_id: string }>;

      expect(rows).toHaveLength(0);

      // Restore the real module for subsequent tests
      vi.doUnmock('../../../data/permission-matrix.js');
    },
    30_000,
  );

  // -------------------------------------------------------------------------
  it(
    'subdomain collision: generateUniqueSubdomain appends a numeric suffix when base is taken',
    async () => {
      // Seed a tenant whose subdomain matches what "Acme Corp" would produce
      const baseSubdomain = 'acme-corp';
      await seedTenant(db, { subdomain: baseSubdomain });

      // The seed helper does NOT push this into createdTenantIds automatically —
      // but we do want it cleaned up.
      const [existing] = await db.execute(sql`
        SELECT tenant_id FROM tenants WHERE subdomain = ${baseSubdomain} LIMIT 1
      `) as unknown as Array<{ tenant_id: string }>;
      createdTenantIds.push(existing.tenant_id);

      // generateUniqueSubdomain uses the systemDbConnection to check availability
      // — it will find 'acme-corp' taken and try 'acme-corp-1'.
      const generated = await OnboardingValidationService.generateUniqueSubdomain('Acme Corp');

      expect(generated).not.toBe(baseSubdomain);
      expect(generated).toMatch(/^acme-corp-\d+$/);
    },
    30_000,
  );
});
