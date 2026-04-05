import { describe, expect, it } from 'vitest';
import {
  calculateDataRetention,
  calculateFeatureLoss,
  calculateUserLimits,
  isValidPlanChange,
} from './subscription-plan-change.helpers.js';

describe('subscription-plan-change helper logic', () => {
  it('allows upgrades and blocks restricted downgrades', () => {
    const upgrade = isValidPlanChange({ id: 'starter' }, { id: 'professional' });
    const allowedDowngrade = isValidPlanChange({ id: 'enterprise' }, { id: 'starter', allowDowngrade: true });
    const blockedDowngrade = isValidPlanChange({ id: 'enterprise' }, { id: 'starter', allowDowngrade: false });

    expect(upgrade).toBe(true);
    expect(allowedDowngrade).toBe(true);
    expect(blockedDowngrade).toBe(false);
  });

  it('calculates feature loss between plans', () => {
    const loss = calculateFeatureLoss('enterprise', 'starter');
    expect(loss).toContain('affiliateConnect');
    expect(loss).toContain('operations');
    expect(loss).not.toContain('crm');
    expect(loss).not.toContain('accounting');
  });

  it('calculates retention and user-limit downgrade impact', () => {
    const retention = calculateDataRetention('enterprise', 'starter');
    const limits = calculateUserLimits('professional', 'starter');

    expect(retention.impact).toBe('data_loss_risk');
    expect(limits.reduction).toBeGreaterThan(0);
    expect(limits.from).toBe(50);
    expect(limits.to).toBe(10);
  });
});
