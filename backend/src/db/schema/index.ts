// Core
export * from './core/tenants.js';
export * from './core/users.js';
export * from './core/permissions.js';
export * from './core/suite-schema.js';
export * from './core/contact-submissions.js';
export * from './core/onboarding-form-data.js';

// Billing & Credits
export * from './billing/subscriptions.js';
export * from './billing/credits.js';
export * from './billing/credit_purchases.js';
export * from './billing/credit_usage.js';
export * from './billing/credit_configurations.js';
export * from './billing/seasonal-credits.js';

// Organizations
export * from './organizations/unified-entities.js';
export * from './organizations/organization_memberships.js';
export * from './organizations/responsible_persons.js';

// Notifications
export * from './notifications/notifications.js';
export * from './notifications/notification-templates.js';

// Tracking
export * from './tracking/event-tracking.js';
export * from './tracking/webhook-logs.js';

// Platform staff (cross-tenant access control)
export * from './platform/platform-staff.js';

// Define relationships
import { relations } from 'drizzle-orm';
import {
  tenants,
  tenantUsers,
  subscriptions,
  payments,
  customRoles,
  userRoleAssignments,
  tenantInvitations,
  auditLogs,
  // New schema imports for relationships
  entities,
  organizationMemberships,
  credits,
  creditTransactions,
  creditPurchases,
  creditUsage,
  creditConfigurations,
  responsiblePersons,
  responsibilityHistory,
  eventTracking,
  notifications
} from './index.js';

export const tenantsRelations = relations(tenants, ({ many, one }) => ({
  users: many(tenantUsers),
  subscription: one(subscriptions),
  roles: many(customRoles),
  payments: many(payments),
  // New relationships for unified entities system
  entities: many(entities),
  memberships: many(organizationMemberships),
  credits: many(credits),
  creditPurchases: many(creditPurchases),
  creditUsage: many(creditUsage),
  responsiblePersons: many(responsiblePersons),
  notifications: many(notifications),
}));

export const tenantUsersRelations = relations(tenantUsers, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [tenantUsers.tenantId],
    references: [tenants.tenantId],
  }),
  primaryOrganization: one(entities, {
    fields: [tenantUsers.primaryOrganizationId],
    references: [entities.entityId],
  }),
  roleAssignments: many(userRoleAssignments),
  // New relationships for hierarchical organizations and credit system
  memberships: many(organizationMemberships),
  creditUsage: many(creditUsage),
  responsibleFor: many(responsiblePersons),
}));

export const subscriptionsRelations = relations(subscriptions, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [subscriptions.tenantId],
    references: [tenants.tenantId],
  }),
  payments: many(payments),
}));

export const paymentsRelations = relations(payments, ({ one }) => ({
  tenant: one(tenants, {
    fields: [payments.tenantId],
    references: [tenants.tenantId],
  }),
  subscription: one(subscriptions, {
    fields: [payments.subscriptionId],
    references: [subscriptions.subscriptionId],
  }),
}));

export const customRolesRelations = relations(customRoles, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [customRoles.tenantId],
    references: [tenants.tenantId],
  }),
  organization: one(entities, {
    fields: [customRoles.organizationId],
    references: [entities.entityId],
  }),
  parentRole: one(customRoles, {
    fields: [customRoles.parentRoleId],
    references: [customRoles.roleId],
  }),
  userAssignments: many(userRoleAssignments),
  invitations: many(tenantInvitations),
  // New relationships for hierarchical organizations
  memberships: many(organizationMemberships),
}));

export const userRoleAssignmentsRelations = relations(userRoleAssignments, ({ one }) => ({
  user: one(tenantUsers, {
    fields: [userRoleAssignments.userId],
    references: [tenantUsers.userId],
  }),
  role: one(customRoles, {
    fields: [userRoleAssignments.roleId],
    references: [customRoles.roleId],
  }),
  organization: one(entities, {
    fields: [userRoleAssignments.organizationId],
    references: [entities.entityId],
  }),
  inheritedFrom: one(userRoleAssignments, {
    fields: [userRoleAssignments.inheritedFrom],
    references: [userRoleAssignments.id],
  }),
  assignedByUser: one(tenantUsers, {
    fields: [userRoleAssignments.assignedBy],
    references: [tenantUsers.userId],
  }),
}));

export const tenantInvitationsRelations = relations(tenantInvitations, ({ one }) => ({
  tenant: one(tenants, {
    fields: [tenantInvitations.tenantId],
    references: [tenants.tenantId],
  }),
  role: one(customRoles, {
    fields: [tenantInvitations.roleId],
    references: [customRoles.roleId],
  }),
  primaryEntity: one(entities, {
    fields: [tenantInvitations.primaryEntityId],
    references: [entities.entityId],
  }),
  invitedByUser: one(tenantUsers, {
    fields: [tenantInvitations.invitedBy],
    references: [tenantUsers.userId],
  }),
}));

// New relationship definitions for unified entities system

export const entitiesRelations = relations(entities, ({ many, one }) => ({
  tenant: one(tenants, {
    fields: [entities.tenantId],
    references: [tenants.tenantId],
  }),
  parentEntity: one(entities, {
    fields: [entities.parentEntityId],
    references: [entities.entityId],
  }),
  childEntities: many(entities),
  memberships: many(organizationMemberships),
  responsiblePerson: one(tenantUsers, {
    fields: [entities.responsiblePersonId],
    references: [tenantUsers.userId],
  }),
}));

export const organizationMembershipsRelations = relations(organizationMemberships, ({ many, one }) => ({
  user: one(tenantUsers, {
    fields: [organizationMemberships.userId],
    references: [tenantUsers.userId],
  }),
  tenant: one(tenants, {
    fields: [organizationMemberships.tenantId],
    references: [tenants.tenantId],
  }),
  role: one(customRoles, {
    fields: [organizationMemberships.roleId],
    references: [customRoles.roleId],
  }),
  entity: one(entities, {
    fields: [organizationMemberships.entityId],
    references: [entities.entityId],
  }),
}));

export const creditsRelations = relations(credits, ({ many, one }) => ({
  tenant: one(tenants, {
    fields: [credits.tenantId],
    references: [tenants.tenantId],
  }),
  entity: one(entities, {
    fields: [credits.entityId],
    references: [entities.entityId],
  }),
  transactions: many(creditTransactions),
}));

export const creditPurchasesRelations = relations(creditPurchases, ({ one }) => ({
  tenant: one(tenants, {
    fields: [creditPurchases.tenantId],
    references: [tenants.tenantId],
  }),
  entity: one(entities, {
    fields: [creditPurchases.entityId],
    references: [entities.entityId],
  }),
}));


export const creditUsageRelations = relations(creditUsage, ({ one }) => ({
  tenant: one(tenants, {
    fields: [creditUsage.tenantId],
    references: [tenants.tenantId],
  }),
  entity: one(entities, {
    fields: [creditUsage.entityId],
    references: [entities.entityId],
  }),
  user: one(tenantUsers, {
    fields: [creditUsage.userId],
    references: [tenantUsers.userId],
  }),
}));

export const responsiblePersonsRelations = relations(responsiblePersons, ({ many, one }) => ({
  tenant: one(tenants, {
    fields: [responsiblePersons.tenantId],
    references: [tenants.tenantId],
  }),
  user: one(tenantUsers, {
    fields: [responsiblePersons.userId],
    references: [tenantUsers.userId],
  }),
  history: many(responsibilityHistory),
})); 