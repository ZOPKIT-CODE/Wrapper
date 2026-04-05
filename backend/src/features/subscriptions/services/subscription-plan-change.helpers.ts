import { getPlanApplications } from '../../../data/plans.js';

export function isValidPlanChange(currentPlan: Record<string, unknown>, targetPlan: Record<string, unknown>): boolean {
  const planHierarchy: Record<string, number> = {
    free: 0,
    starter: 1,
    professional: 2,
    enterprise: 3,
  };

  const currentLevel = planHierarchy[currentPlan.id as string] ?? 0;
  const targetLevel = planHierarchy[targetPlan.id as string] ?? 0;

  if (targetLevel >= currentLevel) return true;

  return (targetPlan as Record<string, unknown>).allowDowngrade !== false;
}

export function calculateFeatureLoss(fromPlan: string, toPlan: string): string[] {
  const fromFeatures = getPlanApplications(fromPlan);
  const toFeatures = getPlanApplications(toPlan);
  return fromFeatures.filter((feature: string) => !toFeatures.includes(feature));
}

export function calculateDataRetention(fromPlan: string, toPlan: string): Record<string, unknown> {
  const retentionPolicies = {
    free: { months: 3, features: ['basic_data'] },
    starter: { months: 12, features: ['basic_data', 'reports'] },
    professional: { months: 24, features: ['basic_data', 'reports', 'analytics'] },
    enterprise: { months: 60, features: ['basic_data', 'reports', 'analytics', 'backups'] },
  };

  return {
    from: retentionPolicies[fromPlan as keyof typeof retentionPolicies],
    to: retentionPolicies[toPlan as keyof typeof retentionPolicies],
    impact:
      (retentionPolicies[fromPlan as keyof typeof retentionPolicies]?.months ?? 0) >
      (retentionPolicies[toPlan as keyof typeof retentionPolicies]?.months ?? 0)
        ? 'data_loss_risk'
        : 'no_impact',
  };
}

export function calculateUserLimits(fromPlan: string, toPlan: string): Record<string, unknown> {
  const userLimits = {
    free: 1,
    starter: 10,
    professional: 50,
    enterprise: -1,
  };

  return {
    from: userLimits[fromPlan as keyof typeof userLimits],
    to: userLimits[toPlan as keyof typeof userLimits],
    reduction:
      (userLimits[fromPlan as keyof typeof userLimits] ?? 0) -
      (userLimits[toPlan as keyof typeof userLimits] ?? 0),
  };
}
