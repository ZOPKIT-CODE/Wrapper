/**
 * **ONBOARDING TYPES**
 * Shared interfaces and type definitions for the onboarding feature.
 */

/** Validation result with optional errors and data */
export interface ValidationResult {
  success: boolean;
  errors?: Array<{ message?: string; field?: string }>;
  data?: Record<string, unknown> & { alreadyOnboarded?: boolean; tenantId?: string; redirectTo?: string; generatedSubdomain?: string };
}

/** Extended Error with optional onboarding fields */
export interface OnboardingError extends Error {
  errors?: Array<{ type?: string; message?: string; field?: string }>;
  redirectTo?: string;
  tenantId?: string;
}

/** Result of createCompleteOnboardingInTransaction */
export interface DbOnboardingResult {
  tenant: { tenantId: string; companyName?: string; subdomain?: string; idpOrgId?: string; adminEmail?: string; onboardingCompleted?: boolean; onboardedAt?: Date; trialStartedAt?: Date };
  organization: { organizationId: string; organizationName?: string };
  adminUser: { userId: string };
  adminRole?: Record<string, unknown>;
  roleAssignment?: Record<string, unknown>;
  orgMembership?: Record<string, unknown>;
  responsiblePerson?: Record<string, unknown>;
  subscription?: { subscriptionId?: string };
  creditResult: { amount: number };
}

/** Onboarding payload from frontend/enhanced flow */
export interface OnboardingPayload {
  type?: string;
  companyName?: string;
  adminEmail?: string;
  subdomain?: string;
  selectedPlan?: string;
  companyType?: string;
  companySize?: string;
  businessType?: string;
  primaryUseCase?: string;
  website?: string;
  firstName?: string;
  lastName?: string;
  hasGstin?: boolean;
  gstin?: string;
  panNumber?: string;
  country?: string;
  state?: string;
  timezone?: string;
  currency?: string;
  defaultLanguage?: string;
  defaultLocale?: string;
  termsAccepted?: boolean;
  taxRegistered?: boolean;
  vatGstRegistered?: boolean;
  billingEmail?: string;
  adminMobile?: string;
  supportEmail?: string;
  contactJobTitle?: string;
  preferredContactMethod?: string;
  mailingAddressSameAsRegistered?: boolean;
  mailingStreet?: string;
  mailingCity?: string;
  mailingState?: string;
  mailingZip?: string;
  mailingCountry?: string;
  billingStreet?: string;
  billingCity?: string;
  billingState?: string;
  billingZip?: string;
  billingCountry?: string;
  contactSalutation?: string;
  contactMiddleName?: string;
  contactDepartment?: string;
  contactDirectPhone?: string;
  contactMobilePhone?: string;
  contactPreferredContactMethod?: string;
  contactAuthorityLevel?: string;
  taxRegistrationDetails?: Record<string, unknown>;
  planName?: string;
  planPrice?: number;
  maxUsers?: number;
  maxProjects?: number;
  teamEmails?: string[];
  initialCredits?: number;
}
