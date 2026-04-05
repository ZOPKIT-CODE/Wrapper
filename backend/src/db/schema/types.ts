import type { InferSelectModel, InferInsertModel } from 'drizzle-orm';
import type {
  tenants,
  tenantInvitations,
  onboardingEvents,
  tenantUsers,
  auditLogs,
  subscriptions,
  payments,
  customRoles,
  userRoleAssignments,
  applications,
  applicationModules,
  organizationApplications,
  eventTracking,
  onboardingFormData,
  entities,
  organizationMemberships,
  credits,
  creditTransactions,
  creditPurchases,
  creditConfigurations,
  responsiblePersons,
  notifications,
  notificationTemplates,
  seasonalCreditCampaigns,
  seasonalCreditAllocations,
  contactSubmissions,
} from './index.js';

// ── Select types (returned from queries) ────────────────────────────

export type Tenant = InferSelectModel<typeof tenants>;
export type TenantInvitation = InferSelectModel<typeof tenantInvitations>;
export type OnboardingEvent = InferSelectModel<typeof onboardingEvents>;

export type TenantUser = InferSelectModel<typeof tenantUsers>;
export type AuditLog = InferSelectModel<typeof auditLogs>;

export type Subscription = InferSelectModel<typeof subscriptions>;
export type Payment = InferSelectModel<typeof payments>;

export type CustomRole = InferSelectModel<typeof customRoles>;
export type UserRoleAssignment = InferSelectModel<typeof userRoleAssignments>;

export type Application = InferSelectModel<typeof applications>;
export type ApplicationModule = InferSelectModel<typeof applicationModules>;
export type OrganizationApplication = InferSelectModel<typeof organizationApplications>;

export type EventTrackingRecord = InferSelectModel<typeof eventTracking>;
export type OnboardingFormData = InferSelectModel<typeof onboardingFormData>;

export type Entity = InferSelectModel<typeof entities>;
export type OrganizationMembership = InferSelectModel<typeof organizationMemberships>;

export type Credit = InferSelectModel<typeof credits>;
export type CreditTransaction = InferSelectModel<typeof creditTransactions>;
export type CreditPurchase = InferSelectModel<typeof creditPurchases>;
export type CreditConfiguration = InferSelectModel<typeof creditConfigurations>;

export type ResponsiblePerson = InferSelectModel<typeof responsiblePersons>;

export type Notification = InferSelectModel<typeof notifications>;
export type NotificationTemplate = InferSelectModel<typeof notificationTemplates>;

export type SeasonalCreditCampaign = InferSelectModel<typeof seasonalCreditCampaigns>;
export type SeasonalCreditAllocation = InferSelectModel<typeof seasonalCreditAllocations>;
export type ContactSubmission = InferSelectModel<typeof contactSubmissions>;

// ── Insert types (passed to .insert()) ──────────────────────────────

export type NewTenant = InferInsertModel<typeof tenants>;
export type NewTenantInvitation = InferInsertModel<typeof tenantInvitations>;
export type NewOnboardingEvent = InferInsertModel<typeof onboardingEvents>;

export type NewTenantUser = InferInsertModel<typeof tenantUsers>;
export type NewAuditLog = InferInsertModel<typeof auditLogs>;

export type NewSubscription = InferInsertModel<typeof subscriptions>;
export type NewPayment = InferInsertModel<typeof payments>;

export type NewCustomRole = InferInsertModel<typeof customRoles>;
export type NewUserRoleAssignment = InferInsertModel<typeof userRoleAssignments>;

export type NewApplication = InferInsertModel<typeof applications>;
export type NewOrganizationApplication = InferInsertModel<typeof organizationApplications>;

export type NewEntity = InferInsertModel<typeof entities>;
export type NewOrganizationMembership = InferInsertModel<typeof organizationMemberships>;

export type NewCredit = InferInsertModel<typeof credits>;
export type NewCreditTransaction = InferInsertModel<typeof creditTransactions>;
export type NewCreditPurchase = InferInsertModel<typeof creditPurchases>;
export type NewCreditConfiguration = InferInsertModel<typeof creditConfigurations>;

export type NewNotification = InferInsertModel<typeof notifications>;
export type NewNotificationTemplate = InferInsertModel<typeof notificationTemplates>;

export type NewSeasonalCreditCampaign = InferInsertModel<typeof seasonalCreditCampaigns>;
export type NewSeasonalCreditAllocation = InferInsertModel<typeof seasonalCreditAllocations>;
export type NewContactSubmission = InferInsertModel<typeof contactSubmissions>;
