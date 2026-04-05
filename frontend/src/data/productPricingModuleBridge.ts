/**
 * Maps marketing product slugs → pricing matrix application ids (`pricingPlanMatrix` /
 * backend PLAN_ACCESS_MATRIX). Used so product pages show the same modules as the public pricing UI.
 */

import {
  FALLBACK_PLAN_COVERAGE,
  FULL_MODULE_CATALOG_BY_APP,
  type PlanCoverageRow,
} from '@/data/pricingPlanMatrix';
import { moduleDisplayName } from '@/data/planDisplayLabels';

/** Product page slug → key in `PlanCoverageRow.modules` */
const PRODUCT_SLUG_TO_PRICING_APP: Record<string, string> = {
  'affiliate-connect': 'affiliateConnect',
  'b2b-crm': 'crm',
  'b2c-crm': 'crm',
  'hrms': 'hr',
  'financial-accounting': 'accounting',
  'project-management': 'project_management',
  'operations-management': 'operations',
  'esop-system': 'hr',
  'flowtilla': 'project_management',
};

export function getPricingAppIdForProductSlug(slug: string): string | undefined {
  return PRODUCT_SLUG_TO_PRICING_APP[slug];
}

export type ProductModuleMatrixRow = {
  code: string;
  label: string;
  starter: boolean;
  professional: boolean;
  enterprise: boolean;
};

function modulesForTier(row: PlanCoverageRow, appId: string): Set<string> {
  const val = row.modules[appId];
  let list: string[] = [];
  if (val === '*') {
    list = FULL_MODULE_CATALOG_BY_APP[appId] ?? [];
  } else if (Array.isArray(val)) {
    list = val;
  }
  return new Set(list);
}

/** Module rows for the comparison table + module grid — aligned with `FALLBACK_PLAN_COVERAGE`. */
export function getProductModuleMatrixRows(appId: string): ProductModuleMatrixRow[] {
  const starter = FALLBACK_PLAN_COVERAGE.find((t) => t.id === 'starter');
  const professional = FALLBACK_PLAN_COVERAGE.find((t) => t.id === 'professional');
  const enterprise = FALLBACK_PLAN_COVERAGE.find((t) => t.id === 'enterprise');
  if (!starter || !professional || !enterprise) return [];

  const s = modulesForTier(starter, appId);
  const p = modulesForTier(professional, appId);
  const e = modulesForTier(enterprise, appId);

  const union = new Set<string>([...s, ...p, ...e]);
  const sorted = [...union].sort((a, b) =>
    moduleDisplayName(a).localeCompare(moduleDisplayName(b))
  );

  return sorted.map((code) => ({
    code,
    label: moduleDisplayName(code),
    starter: s.has(code),
    professional: p.has(code),
    enterprise: e.has(code),
  }));
}
