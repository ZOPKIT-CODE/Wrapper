// =============================================================================
// RECOMMENDED APPROACH: UNIFIED ENTITY TABLE
// =============================================================================
// Since locations ARE organizations in your context, use ONE table for everything
// This replaces both organizations.js and locations.js files

import { pgTable, uuid, varchar, timestamp, jsonb, boolean, integer, text, index, type AnyPgColumn } from 'drizzle-orm/pg-core';
import { tenants } from '../core/tenants.js';

// Unified entity table (handles organizations, locations, departments, etc.)
export const entities = pgTable('entities', {
  entityId: uuid('entity_id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').references(() => tenants.tenantId).notNull(),

  // Entity Classification
  entityType: varchar('entity_type', { length: 20 }).notNull(), // 'organization', 'location', 'department', 'team'

  // Hierarchy Structure (ANY entity can have children)
  parentEntityId: uuid('parent_entity_id').references((): AnyPgColumn => entities.entityId, { onDelete: 'set null' }),
  entityLevel: integer('entity_level').default(1),

  // Basic Entity Info
  entityName: varchar('entity_name', { length: 255 }).notNull(),
  description: text('description'),

  // Classification fields (depend on entity_type)
  locationType: varchar('location_type', { length: 20 }), // 'office', 'warehouse', 'retail', 'remote', 'branch'
  departmentType: varchar('department_type', { length: 20 }), // 'hr', 'finance', 'it', 'sales', 'marketing'
  teamType: varchar('team_type', { length: 20 }), // 'development', 'design', 'management', 'support'

  // Physical attributes (for location-type entities)
  address: jsonb('address'), // Physical address

  // Common fields for both (with inheritance)
  timezone: varchar('timezone', { length: 50 }).default('Asia/Kolkata'),
  currency: varchar('currency', { length: 3 }).default('INR'),
  language: varchar('language', { length: 10 }).default('en'),

  // Financial Accounting / Legal & Compliance fields
  legalName: varchar('legal_name', { length: 255 }),
  country: varchar('country', { length: 3 }),
  fiscalYearEnd: varchar('fiscal_year_end', { length: 10 }).default('12-31'),
  taxId: varchar('tax_id', { length: 50 }),
  registrationNumber: varchar('registration_number', { length: 100 }),
  contactWebsite: varchar('contact_website', { length: 500 }),

  // Responsible person & contact
  responsiblePersonId: uuid('responsible_person_id'),
  contactEmail: varchar('contact_email', { length: 255 }),
  contactPhone: varchar('contact_phone', { length: 50 }),

  // Inheritance controls
  inheritCredits: boolean('inherit_credits').default(false),

  // Settings (entity-specific)
  settings: jsonb('settings').default({
    notifications: true,
    autoBackup: true,
    features: {}
  }),

  // Status
  isActive: boolean('is_active').default(true),

  // Hierarchy path (auto-generated)
  hierarchyPath: text('hierarchy_path'),
  fullHierarchyPath: text('full_hierarchy_path'),

  // Metadata
  createdBy: uuid('created_by'),
  updatedBy: uuid('updated_by'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  idxEntitiesHierarchyPath: index('idx_entities_hierarchy_path').on(table.hierarchyPath),
  idxEntitiesParentEntityId: index('idx_entities_parent_entity_id').on(table.parentEntityId),
  idxEntitiesTenantHierarchy: index('idx_entities_tenant_hierarchy').on(table.tenantId, table.parentEntityId, table.entityLevel),
  idxEntitiesTypeHierarchy: index('idx_entities_type_hierarchy').on(table.entityType, table.tenantId, table.parentEntityId),
}));

// =============================================================================
// ADVANTAGES OF UNIFIED APPROACH
// =============================================================================

/*
✅ **Perfect for Your Use Case:**
Since locations ARE organizations in your context, this unified approach works perfectly!

✅ **Your Actual Hierarchy:**
Tenant (Company)
├── Marketing Dept (organization, level 1)
│   ├── Content Team (organization, level 2)
│   │   ├── NYC Office (location, level 3) ← This is ALSO an organization!
│   │   │   ├── Design Sub-team (organization, level 4)
│   │   │   └── Writing Sub-team (organization, level 4)
│   │   └── LA Office (location, level 3) ← This is ALSO an organization!
│   │       └── West Coast Team (organization, level 4)
│   └── Digital Marketing (organization, level 2)
│       └── Remote Office (location, level 3) ← This is ALSO an organization!
│           └── Freelance Team (organization, level 4)

✅ **Key Advantages:**
- ANY entity can have children (organizations, locations, departments, teams)
- Locations can be parents to other organizations
- No artificial distinction between "business" and "physical" entities
- Credit allocation works seamlessly across the entire hierarchy
- Settings inherit naturally from parent to child

✅ **Usage Examples:**

-- Create Marketing Department (organization)
INSERT INTO entities (tenant_id, entity_type, entity_name, entity_code, organization_type)
VALUES ('tenant-uuid', 'organization', 'Marketing Department', 'MKT', 'department');

-- Create NYC Office (location that is also an organization)
INSERT INTO entities (tenant_id, entity_type, parent_entity_id, entity_name, entity_code, location_type, address, timezone)
VALUES ('tenant-uuid', 'location', 'marketing-entity-id', 'NYC Office', 'NYC', 'office',
  '{"street": "123 Main St", "city": "New York", "state": "NY"}'::jsonb, 'America/New_York');

-- Create Design Team under NYC Office (organization under location)
INSERT INTO entities (tenant_id, entity_type, parent_entity_id, entity_name, entity_code, organization_type)
VALUES ('tenant-uuid', 'organization', 'nyc-office-entity-id', 'Design Team', 'DESIGN', 'team');

-- Get entire hierarchy
SELECT entity_name, entity_type, entity_level, hierarchy_path
FROM entities WHERE tenant_id = 'tenant-uuid'
ORDER BY entity_level, entity_name;

-- Get all children of NYC Office (both organizations and locations)
SELECT * FROM entities
WHERE parent_entity_id = 'nyc-office-entity-id';

-- Get effective settings with inheritance
SELECT get_entity_effective_settings(entity_id) FROM entities
WHERE entity_id = 'design-team-entity-id';
*/
