/**
 * SINGLE SOURCE OF TRUTH for subscription plan definitions.
 *
 * Billing is annual only (no monthly Stripe prices). USD and INR each have
 * their own Stripe Price ID. Display shows both currencies; checkout uses `currency`.
 *
 * **Access control:** `applications`, `modules`, and `permissions` are aligned with
 * `PLAN_ACCESS_MATRIX` in `permission-matrix.ts` (starter / professional / enterprise).
 * Trial uses the CRM subset of the `free` tier from that matrix.
 */

import { PLAN_ACCESS_MATRIX } from './permission-matrix.js';

export type PlanKey = 'trial' | 'starter' | 'professional' | 'enterprise';

export type PlanCheckoutCurrency = 'usd' | 'inr';

/** App code → module code → permission / operation codes (matches matrix). */
export type PlanModulePermissions = Record<string, Record<string, string[]>>;

export interface PlanDefinition {
  id: PlanKey;
  name: string;
  description: string;
  /** Deprecated: monthly billing removed; always 0 for paid tiers */
  monthlyPrice: number;
  /** Annual amount in USD */
  yearlyPrice: number;
  /** Annual amount in INR (whole rupees, for display) */
  yearlyPriceInr: number;
  /** @deprecated No monthly billing — unused */
  stripePriceId: string | undefined;
  /** Stripe annual subscription price — USD */
  stripeYearlyPriceId: string | undefined;
  /** Stripe annual subscription price — INR */
  stripeYearlyPriceIdInr: string | undefined;
  /** Annual credit allocation */
  credits: number;
  /** Marketing feature bullets shown on pricing page */
  features: string[];
  limits: {
    users: number;
    roles: number;
  };
  applications: string[];
  /** Enabled module codes per application; mirrors PLAN_ACCESS_MATRIX for paid tiers */
  modules: Record<string, string[] | '*'>;
  /**
   * Enabled permission codes per module (operations), same shape as PLAN_ACCESS_MATRIX.permissions.
   */
  permissions: PlanModulePermissions;
  popular?: boolean;
}

type MatrixPaidPlan = 'starter' | 'professional' | 'enterprise';

function accessFromPlanMatrix(planId: MatrixPaidPlan): {
  applications: string[];
  modules: Record<string, string[]>;
  permissions: PlanModulePermissions;
} {
  const row = PLAN_ACCESS_MATRIX[planId];
  const modules: Record<string, string[]> = {};
  for (const [app, modList] of Object.entries(row.modules)) {
    modules[app] = [...modList];
  }
  return {
    applications: [...row.applications],
    modules,
    permissions: structuredClone(row.permissions) as PlanModulePermissions,
  };
}

const starterYearlyUsd =
  process.env.STRIPE_STARTER_YEARLY_PRICE_ID ??
  process.env.STRIPE_PRICE_ID_STARTER ??
  undefined;
const professionalYearlyUsd =
  process.env.STRIPE_PROFESSIONAL_YEARLY_PRICE_ID ??
  process.env.STRIPE_PRICE_ID_PROFESSIONAL ??
  undefined;
const enterpriseYearlyUsd =
  process.env.STRIPE_ENTERPRISE_YEARLY_PRICE_ID ??
  process.env.STRIPE_PRICE_ID_ENTERPRISE ??
  undefined;

const starterAccess = accessFromPlanMatrix('starter');
const professionalAccess = accessFromPlanMatrix('professional');
const enterpriseAccess = accessFromPlanMatrix('enterprise');

/** Trial CRM permissions = `free` tier CRM slice from PLAN_ACCESS_MATRIX */
const trialCrmPerms = PLAN_ACCESS_MATRIX.free.permissions.crm;

export const PLANS: Record<PlanKey, PlanDefinition> = {
  trial: {
    id: 'trial',
    name: 'Trial',
    description: 'Try the platform for free',
    monthlyPrice: 0,
    yearlyPrice: 0,
    yearlyPriceInr: 0,
    stripePriceId: undefined,
    stripeYearlyPriceId: undefined,
    stripeYearlyPriceIdInr: undefined,
    credits: 5000,
    features: ['CRM tools (basic)', 'Up to 2 users'],
    limits: { users: 2, roles: 2 },
    applications: ['crm'],
    modules: {
      crm: ['leads', 'contacts', 'dashboard'],
    },
    permissions: {
      crm: {
        leads: [...trialCrmPerms.leads],
        contacts: [...trialCrmPerms.contacts],
        dashboard: [...trialCrmPerms.dashboard],
      },
    },
  },

  starter: {
    id: 'starter',
    name: 'Starter',
    description: 'Essential tools for small teams',
    monthlyPrice: 0,
    yearlyPrice: 120,
    yearlyPriceInr: 9999,
    stripePriceId: undefined,
    stripeYearlyPriceId: starterYearlyUsd,
    stripeYearlyPriceIdInr: process.env.STRIPE_STARTER_YEARLY_INR_PRICE_ID,
    credits: 60_000,
    features: ['CRM tools', 'User Management', 'Basic permissions', 'Email support'],
    limits: { users: 5, roles: 3 },
    applications: starterAccess.applications,
    modules: starterAccess.modules,
    permissions: starterAccess.permissions,
  },

  professional: {
    id: 'professional',
    name: 'Professional',
    description: 'Comprehensive tools for growing businesses',
    monthlyPrice: 0,
    yearlyPrice: 240,
    yearlyPriceInr: 19_999,
    stripePriceId: undefined,
    stripeYearlyPriceId: professionalYearlyUsd,
    stripeYearlyPriceIdInr: process.env.STRIPE_PROFESSIONAL_YEARLY_INR_PRICE_ID,
    credits: 300_000,
    features: [
      'All Starter features',
      'CRM & HR tools',
      'Advanced permissions',
      'Priority support',
      'Affiliate management',
      'Custom integrations',
    ],
    limits: { users: 25, roles: 10 },
    applications: professionalAccess.applications,
    modules: professionalAccess.modules,
    permissions: professionalAccess.permissions,
    popular: true,
  },

  enterprise: {
    id: 'enterprise',
    name: 'Enterprise',
    description: 'Complete solution with all features',
    monthlyPrice: 0,
    yearlyPrice: 360,
    yearlyPriceInr: 29_999,
    stripePriceId: undefined,
    stripeYearlyPriceId: enterpriseYearlyUsd,
    stripeYearlyPriceIdInr: process.env.STRIPE_ENTERPRISE_YEARLY_INR_PRICE_ID,
    credits: 1_200_000,
    features: [
      'All Professional features',
      'Unlimited users',
      'White-label options',
      'Dedicated support',
      'Custom development',
      'Advanced analytics',
      'All integrations',
    ],
    limits: { users: -1, roles: -1 },
    applications: enterpriseAccess.applications,
    modules: enterpriseAccess.modules,
    permissions: enterpriseAccess.permissions,
  },
};

/** Stripe annual price ID for checkout (USD or INR). */
export function getAnnualStripePriceId(plan: PlanDefinition, currency: PlanCheckoutCurrency): string | undefined {
  if (currency === 'inr') return plan.stripeYearlyPriceIdInr;
  return plan.stripeYearlyPriceId;
}

/** Display / bookkeeping amount for the selected checkout currency */
export function getAnnualAmount(plan: PlanDefinition, currency: PlanCheckoutCurrency): number {
  if (currency === 'inr') return plan.yearlyPriceInr;
  return plan.yearlyPrice;
}

/** Returns the 3 purchasable plans (trial excluded — it's auto-assigned). */
export function getAvailablePlans(): PlanDefinition[] {
  return [PLANS.starter, PLANS.professional, PLANS.enterprise];
}

export function getPlan(planId: string): PlanDefinition | undefined {
  return PLANS[planId as PlanKey];
}

export function getPlanApplications(planId: string): string[] {
  return getPlan(planId)?.applications ?? [];
}

export function getPlanModules(planId: string): Record<string, string[] | '*'> {
  return getPlan(planId)?.modules ?? {};
}

/** Operation codes enabled per module for this plan (from PLAN_ACCESS_MATRIX). */
export function getPlanPermissions(planId: string): PlanModulePermissions {
  return getPlan(planId)?.permissions ?? {};
}

export function getPlanLimits(planId: string): { users: number; roles: number } {
  return getPlan(planId)?.limits ?? { users: 2, roles: 2 };
}

export function getMinimumPlanForApp(application: string): string {
  const order: PlanKey[] = ['trial', 'starter', 'professional', 'enterprise'];
  for (const key of order) {
    if (PLANS[key].applications.includes(application)) return key;
  }
  return 'enterprise';
}

export function getMinimumPlanForModule(application: string, module: string): string {
  const order: PlanKey[] = ['trial', 'starter', 'professional', 'enterprise'];
  for (const key of order) {
    const mods = PLANS[key].modules[application];
    if (mods === '*' || (Array.isArray(mods) && mods.includes(module))) return key;
  }
  return 'enterprise';
}

/**
 * Whether `operation` is allowed for app/module on this plan (must be in matrix-backed permissions).
 */
export function planAllowsOperation(planId: string, application: string, module: string, operation: string): boolean {
  const perms = getPlanPermissions(planId)[application]?.[module];
  if (!perms?.length) return false;
  return perms.includes(operation);
}
