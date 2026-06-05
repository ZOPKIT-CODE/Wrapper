/**
 * Seed helpers for integration tests
 *
 * Every helper inserts the minimum required fields to satisfy NOT NULL and FK
 * constraints, while generating unique identifiers so tests never collide.
 *
 * WHY RAW SQL for inserts?
 * ------------------------
 * Drizzle v0.29 generates INSERT statements with ALL schema columns (using
 * DEFAULT for unspecified ones) even when you only pass a subset to .values().
 * If the migration SQL is behind the TypeScript schema (schema drift), Drizzle
 * tries to INSERT into columns that don't exist in the DB yet and PostgreSQL
 * rejects the statement with "column X does not exist".
 *
 * Using raw SQL (db.execute(sql`...`)) lets us insert exactly the columns
 * we know exist in the migrations — no schema drift surprises.
 *
 * Usage (inside a test):
 *
 *   const { db, end } = createTestDb();
 *   const tenant = await seedTenant(db);
 *   const user   = await seedUser(db, tenant.tenantId);
 *   const org    = await seedOrganization(db, tenant.tenantId);
 *   await seedMembership(db, { userId: user.userId, tenantId: tenant.tenantId, entityId: org.entityId });
 *   afterAll(() => end());
 */

import { randomUUID } from 'crypto';
import { sql } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from '../schema/index.js';

// Re-export table refs for convenience in tests that run direct queries.
export const {
  tenants,
  tenantUsers,
  entities,
  organizationMemberships,
  credits,
  payments,
} = schema;

// ---------------------------------------------------------------------------
// TestDb type
// ---------------------------------------------------------------------------
export type TestDb = PostgresJsDatabase<typeof schema>;

// ---------------------------------------------------------------------------
// Minimal row shapes returned by seed helpers.
// Explicit interfaces (not $inferSelect) so we are NOT affected by schema drift.
// ---------------------------------------------------------------------------
export interface SeededTenant {
  tenantId:    string;
  companyName: string;
  subdomain:   string;
  idpOrgId:    string;
  adminEmail:  string;
}

export interface SeededUser {
  userId:   string;
  tenantId: string;
  email:    string;
  name:     string;
}

export interface SeededEntity {
  entityId:       string;
  tenantId:       string;
  entityType:     string;
  entityName:     string;
  parentEntityId: string | null;
}

export interface SeededMembership {
  membershipId:     string;
  userId:           string;
  tenantId:         string;
  entityId:         string;
  membershipStatus: string | null;
  isPrimary:        boolean | null;
}

export interface SeededCredit {
  creditId:         string;
  tenantId:         string;
  entityId:         string | null;
  availableCredits: string | null;
}

export interface SeededPayment {
  paymentId:             string;
  tenantId:              string;
  amount:                string;
  status:                string;
  currency:              string | null;
  stripePaymentIntentId: string | null;
}

// ---------------------------------------------------------------------------
// createTestDb
// ---------------------------------------------------------------------------

/**
 * Create a fresh Drizzle connection pointing at the container started by
 * global-setup.ts.  Call this ONCE per test file (inside beforeAll), then
 * pass the instance to seed helpers.
 */
export function createTestDb(): { db: TestDb; end: () => Promise<void> } {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('[seed] DATABASE_URL is not set — did globalSetup run?');

  const pg = postgres(url, {
    max: 3,
    onnotice: () => {},
  });

  const db = drizzle(pg, { schema }) as TestDb;

  return { db, end: () => pg.end() };
}

// ---------------------------------------------------------------------------
// Internal helper: cast execute() result rows to a typed interface
// ---------------------------------------------------------------------------
function rows<T>(result: unknown): T[] {
  // drizzle db.execute() returns an array-like object; cast safely.
  return Array.from(result as T[]);
}

// ---------------------------------------------------------------------------
// Tenant
// ---------------------------------------------------------------------------

export type SeedTenantOverrides = Partial<{
  companyName: string;
  subdomain:   string;
  idpOrgId:    string;
  adminEmail:  string;
}>;

/**
 * Insert a tenant row using raw SQL.
 * Only the 4 NOT NULL columns are touched — no schema drift.
 */
export async function seedTenant(
  db: TestDb,
  overrides: SeedTenantOverrides = {},
): Promise<SeededTenant> {
  const suffix      = randomUUID().slice(0, 8);
  const companyName = overrides.companyName ?? `Test Co ${suffix}`;
  const subdomain   = overrides.subdomain   ?? `test-${suffix}`;
  const idpOrgId    = overrides.idpOrgId    ?? `idp_${suffix}`;
  const adminEmail  = overrides.adminEmail  ?? `admin-${suffix}@example.com`;

  const result = await db.execute(sql`
    INSERT INTO tenants (company_name, subdomain, idp_org_id, admin_email)
    VALUES (${companyName}, ${subdomain}, ${idpOrgId}, ${adminEmail})
    RETURNING
      tenant_id    AS "tenantId",
      company_name AS "companyName",
      subdomain    AS "subdomain",
      idp_org_id   AS "idpOrgId",
      admin_email  AS "adminEmail"
  `);

  return rows<SeededTenant>(result)[0];
}

// ---------------------------------------------------------------------------
// Tenant user
// ---------------------------------------------------------------------------

export type SeedUserOverrides = Partial<{
  email:         string;
  name:          string;
  idpSub:        string;
  isTenantAdmin: boolean;
}>;

/**
 * Insert a tenant_users row using raw SQL.
 */
export async function seedUser(
  db: TestDb,
  tenantId: string,
  overrides: SeedUserOverrides = {},
): Promise<SeededUser> {
  const suffix      = randomUUID().slice(0, 8);
  const email       = overrides.email         ?? `user-${suffix}@example.com`;
  const name        = overrides.name          ?? `User ${suffix}`;
  const idpSub  = overrides.idpSub        ?? `idp_user_${suffix}`;
  const isAdmin = overrides.isTenantAdmin ?? false;

  // tenant_users has first_name/last_name (NOT a `name` column) — matches prod.
  const result = await db.execute(sql`
    INSERT INTO tenant_users (tenant_id, email, first_name, idp_sub, is_tenant_admin)
    VALUES (${tenantId}, ${email}, ${name}, ${idpSub}, ${isAdmin})
    RETURNING
      user_id    AS "userId",
      tenant_id  AS "tenantId",
      email      AS "email",
      first_name AS "name"
  `);

  return rows<SeededUser>(result)[0];
}

// ---------------------------------------------------------------------------
// Entity (organization or location)
// ---------------------------------------------------------------------------

export type SeedEntityOverrides = Partial<{
  entityName:     string;
  entityType:     'organization' | 'location' | 'department' | 'team';
  parentEntityId: string | null;
  isDefault:      boolean;
  isActive:       boolean;
}>;

/**
 * Insert an entity row using raw SQL.
 */
export async function seedOrganization(
  db: TestDb,
  tenantId: string,
  overrides: SeedEntityOverrides = {},
): Promise<SeededEntity> {
  const suffix         = randomUUID().slice(0, 8);
  const entityType     = overrides.entityType     ?? 'organization';
  const entityName     = overrides.entityName     ?? `Org ${suffix}`;
  const parentEntityId = overrides.parentEntityId ?? null;
  const isActive       = overrides.isActive       ?? true;
  // NOTE: `entities.is_default` was dropped in migration 0015_drop_unused_columns.
  // The `overrides.isDefault` field is still accepted for call-site compatibility
  // but is no longer persisted (findRootOrganization does not key off it).

  const result = await db.execute(sql`
    INSERT INTO entities (tenant_id, entity_type, entity_name, parent_entity_id, is_active)
    VALUES (${tenantId}, ${entityType}, ${entityName}, ${parentEntityId}, ${isActive})
    RETURNING
      entity_id        AS "entityId",
      tenant_id        AS "tenantId",
      entity_type      AS "entityType",
      entity_name      AS "entityName",
      parent_entity_id AS "parentEntityId"
  `);

  return rows<SeededEntity>(result)[0];
}

/** Convenience alias for inserting a location entity. */
export async function seedLocation(
  db: TestDb,
  tenantId: string,
  overrides: SeedEntityOverrides = {},
): Promise<SeededEntity> {
  return seedOrganization(db, tenantId, { ...overrides, entityType: 'location' });
}

// ---------------------------------------------------------------------------
// Organization membership
// ---------------------------------------------------------------------------

export type SeedMembershipInput = {
  userId:           string;
  tenantId:         string;
  entityId:         string;
  createdBy?:       string;
  membershipType?:  string;
  membershipStatus?: string;
  isPrimary?:       boolean;
  entityType?:      string;
};

/**
 * Insert an organization_memberships row using raw SQL.
 */
export async function seedMembership(
  db: TestDb,
  input: SeedMembershipInput,
): Promise<SeededMembership> {
  const createdBy        = input.createdBy        ?? input.userId;
  const membershipType   = input.membershipType   ?? 'member';
  const membershipStatus = input.membershipStatus ?? 'active';
  const isPrimary        = input.isPrimary        ?? false;
  const entityType       = input.entityType       ?? 'organization';

  const result = await db.execute(sql`
    INSERT INTO organization_memberships
      (user_id, tenant_id, entity_id, created_by, membership_type, membership_status, is_primary, entity_type)
    VALUES
      (${input.userId}, ${input.tenantId}, ${input.entityId}, ${createdBy},
       ${membershipType}, ${membershipStatus}, ${isPrimary}, ${entityType})
    RETURNING
      membership_id     AS "membershipId",
      user_id           AS "userId",
      tenant_id         AS "tenantId",
      entity_id         AS "entityId",
      membership_status AS "membershipStatus",
      is_primary        AS "isPrimary"
  `);

  return rows<SeededMembership>(result)[0];
}

// ---------------------------------------------------------------------------
// Credit record
// ---------------------------------------------------------------------------

/**
 * Insert a credits row using raw SQL.
 */
export async function seedCreditRecord(
  db: TestDb,
  tenantId: string,
  entityId: string,
  availableCredits = '0',
): Promise<SeededCredit> {
  const result = await db.execute(sql`
    INSERT INTO credits (tenant_id, entity_id, available_credits, is_active, last_updated_at)
    VALUES (${tenantId}, ${entityId}, ${availableCredits}, true, NOW())
    RETURNING
      credit_id         AS "creditId",
      tenant_id         AS "tenantId",
      entity_id         AS "entityId",
      available_credits AS "availableCredits"
  `);

  return rows<SeededCredit>(result)[0];
}

// ---------------------------------------------------------------------------
// Payment record
// ---------------------------------------------------------------------------

export type SeedPaymentInput = {
  tenantId:              string;
  amount?:               string;
  currency?:             string;
  status?:               string;
  stripePaymentIntentId?: string;
};

/**
 * Insert a minimal payments row using raw SQL.
 */
export async function seedPayment(
  db: TestDb,
  input: SeedPaymentInput,
): Promise<SeededPayment> {
  const amount   = input.amount   ?? '100.00';
  const currency = input.currency ?? 'USD';
  const status   = input.status   ?? 'succeeded';
  const intentId = input.stripePaymentIntentId ?? null;

  const result = await db.execute(sql`
    INSERT INTO payments (tenant_id, amount, currency, status, stripe_payment_intent_id, paid_at)
    VALUES (${input.tenantId}, ${amount}, ${currency}, ${status}, ${intentId}, NOW())
    RETURNING
      payment_id                AS "paymentId",
      tenant_id                 AS "tenantId",
      amount                    AS "amount",
      status                    AS "status",
      currency                  AS "currency",
      stripe_payment_intent_id  AS "stripePaymentIntentId"
  `);

  return rows<SeededPayment>(result)[0];
}
