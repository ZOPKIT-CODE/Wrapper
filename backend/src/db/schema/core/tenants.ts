import { pgTable, uuid, varchar, timestamp, jsonb, boolean, integer, index } from 'drizzle-orm/pg-core';

// Main tenants table
export const tenants = pgTable('tenants', {

  //phase of extracting data from users
  tenantId: uuid('tenant_id').primaryKey().defaultRandom(),
  companyName: varchar('company_name', { length: 255 }).notNull(),
  subdomain: varchar('subdomain', { length: 100 }).notNull().unique(),
  kindeOrgId: varchar('kinde_org_id', { length: 255 }).notNull().unique(),
  adminEmail: varchar('admin_email', { length: 255 }).notNull(),
  
  // Essential Company Profile Fields
  legalCompanyName: varchar('legal_company_name', { length: 255 }),
  gstin: varchar('gstin', { length: 15 }), // Keep for Indian market
  companyType: varchar('company_type', { length: 100 }),
  industry: varchar('industry', { length: 100 }),
  website: varchar('website', { length: 500 }),

  // New Essential Fields from Onboarding Analysis
  taxRegistered: boolean('tax_registered').default(false),
  vatGstRegistered: boolean('vat_gst_registered').default(false),
  organizationSize: varchar('organization_size', { length: 50 }), // '1-10', '11-50', etc.
  billingEmail: varchar('billing_email', { length: 255 }),
  contactJobTitle: varchar('contact_job_title', { length: 150 }),
  preferredContactMethod: varchar('preferred_contact_method', { length: 20 }), // 'email', 'phone', 'sms'

  // Mailing Address (if different from registered)
  mailingAddressSameAsRegistered: boolean('mailing_address_same_as_registered').default(true),
  mailingStreet: varchar('mailing_street', { length: 255 }),
  mailingCity: varchar('mailing_city', { length: 100 }),
  mailingState: varchar('mailing_state', { length: 100 }),
  mailingZip: varchar('mailing_zip', { length: 20 }),
  mailingCountry: varchar('mailing_country', { length: 100 }),

  // Additional Contact Details
  supportEmail: varchar('support_email', { length: 255 }),
  contactSalutation: varchar('contact_salutation', { length: 20 }),
  contactMiddleName: varchar('contact_middle_name', { length: 100 }),
  contactDepartment: varchar('contact_department', { length: 100 }),
  contactDirectPhone: varchar('contact_direct_phone', { length: 50 }),
  contactMobilePhone: varchar('contact_mobile_phone', { length: 50 }),
  // DEPRECATED: use preferredContactMethod instead (same table, line 26).
  // Column kept in schema for migration safety; will be dropped in a future migration.
  contactPreferredContactMethod: varchar('contact_preferred_contact_method', { length: 20 }),
  contactAuthorityLevel: varchar('contact_authority_level', { length: 50 }),

  // Country-specific tax registration details (flexible storage)
  taxRegistrationDetails: jsonb('tax_registration_details').default('{}'),

  // Essential Contact & Address Fields
  billingStreet: varchar('billing_street', { length: 255 }),
  billingCity: varchar('billing_city', { length: 100 }),
  billingState: varchar('billing_state', { length: 100 }),
  billingZip: varchar('billing_zip', { length: 20 }),
  billingCountry: varchar('billing_country', { length: 100 }),
  phone: varchar('phone', { length: 50 }),

  // Essential Localization Settings
  defaultLanguage: varchar('default_language', { length: 10 }).default('en'),
  defaultLocale: varchar('default_locale', { length: 20 }).default('en-IN'),
  defaultCurrency: varchar('default_currency', { length: 3 }).default('INR'),
  defaultTimeZone: varchar('default_timezone', { length: 50 }).default('Asia/Kolkata'),
  
  // Essential Branding & Customization
  logoUrl: varchar('logo_url', { length: 500 }),
  primaryColor: varchar('primary_color', { length: 7 }).default('#2563eb'),
  customDomain: varchar('custom_domain', { length: 255 }),
  brandingConfig: jsonb('branding_config').default({}),

  // Essential Status & Settings
  isActive: boolean('is_active').default(true),
  isVerified: boolean('is_verified').default(false),
  settings: jsonb('settings').default({}),

  // Stripe Integration
  stripeCustomerId: varchar('stripe_customer_id', { length: 255 }),

  // Simplified Onboarding & Setup Tracking
  onboardingCompleted: boolean('onboarding_completed').default(false),
  onboardedAt: timestamp('onboarded_at'),
  onboardingStartedAt: timestamp('onboarding_started_at'),

  // Trial dates moved to subscriptions table (fix_019 migration).
  // trialEndsAt and trialStartedAt removed — query via subscriptions JOIN.

  // Fiscal year bounds (collected during onboarding)
  fiscalYearStartMonth: integer('fiscal_year_start_month'),
  fiscalYearEndMonth: integer('fiscal_year_end_month'),
  fiscalYearStartDay: integer('fiscal_year_start_day'),
  fiscalYearEndDay: integer('fiscal_year_end_day'),

  // Activity Tracking
  firstLoginAt: timestamp('first_login_at'),
  lastActivityAt: timestamp('last_activity_at'),
  
  // Metadata
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  idxTenantsStripeCustomerId: index('idx_tenants_stripe_customer_id').on(table.stripeCustomerId),
}));



// Tenant invitations for team members
export const tenantInvitations = pgTable('tenant_invitations', {
  invitationId: uuid('invitation_id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').references(() => tenants.tenantId).notNull(),
  email: varchar('email', { length: 255 }).notNull(),

  // Legacy role field for backward compatibility (single role)
  roleId: uuid('role_id'), // Reference to role they'll get (deprecated for multi-entity)

  // Multi-entity invitation support
  targetEntities: jsonb('target_entities').default([]), // Array of {entityId, roleId, entityType, membershipType}
  invitationScope: varchar('invitation_scope', { length: 20 }).default('tenant'), // 'tenant', 'organization', 'location', 'multi-entity'
  primaryEntityId: uuid('primary_entity_id'), // User's primary organization/location (references entities table)

  invitedBy: uuid('invited_by').notNull(),
  invitationToken: varchar('invitation_token', { length: 255 }).notNull().unique(),
  invitationUrl: varchar('invitation_url', { length: 1000 }), // Full invitation URL for easy access
  status: varchar('status', { length: 20 }).default('pending'), // 'pending', 'accepted', 'expired', 'cancelled'
  expiresAt: timestamp('expires_at').notNull(),
  acceptedAt: timestamp('accepted_at'),
  cancelledAt: timestamp('cancelled_at'),
  cancelledBy: uuid('cancelled_by'), // Who cancelled the invitation
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  idxTenantInvitationsScope: index('idx_tenant_invitations_scope').on(table.invitationScope),
  idxTenantInvitationsPrimaryEntity: index('idx_tenant_invitations_primary_entity').on(table.primaryEntityId),
  idxTenantInvitationsPendingMulti: index('idx_tenant_invitations_pending_multi').on(table.invitationToken, table.expiresAt),
}));

// Onboarding events tracking for analytics and scalability
export const onboardingEvents = pgTable('onboarding_events', {
  eventId: uuid('event_id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').references(() => tenants.tenantId).notNull(),

  // Event details
  eventType: varchar('event_type', { length: 100 }).notNull(),
  eventAction: varchar('event_action', { length: 50 }).notNull(), // 'started', 'completed', 'skipped', 'abandoned'

  // Context
  userId: uuid('user_id'),

  // Timestamps
  createdAt: timestamp('created_at').defaultNow()
}); 