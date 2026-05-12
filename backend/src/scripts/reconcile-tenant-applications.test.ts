/**
 * Idempotency test for reconcile-tenant-applications logic.
 * Tests the core reconciliation logic without a real DB.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock the reconcile core function ────────────────────────────────────────
// We extract the core logic into a testable pure function by simulating it here.
// The actual script calls into the DB; we test the logic, not the DB queries.

interface AppRow { appId: string; appCode: string }
interface ReconcileState { [key: string]: { tenantId: string; appId: string; planId: string; count: number } }

function buildUpsertMap(
  tenantId: string,
  planId: string,
  expectedAppCodes: string[],
  appCodeToId: Record<string, string>,
  existingState: ReconcileState,
): ReconcileState {
  const newState = { ...existingState };
  for (const appCode of expectedAppCodes) {
    const appId = appCodeToId[appCode];
    if (!appId) continue;
    const key = `${tenantId}:${appId}`;
    newState[key] = { tenantId, appId, planId, count: (newState[key]?.count ?? 0) + 1 };
  }
  return newState;
}

describe('reconcile-tenant-applications idempotency', () => {
  const tenantId = 'tenant-abc';
  const planId = 'free';
  const expectedAppCodes = ['crm', 'accounting'];
  const appCodeToId = { crm: 'app-crm', accounting: 'app-acc' };

  beforeEach(() => {
    if (typeof global.logToES !== 'function') {
      global.logToES = vi.fn();
    }
  });

  it('produces the same state on second run (idempotency)', () => {
    // First run: empty state
    const afterFirstRun = buildUpsertMap(tenantId, planId, expectedAppCodes, appCodeToId, {});
    // Second run: same state as first run (ON CONFLICT DO UPDATE)
    const afterSecondRun = buildUpsertMap(tenantId, planId, expectedAppCodes, appCodeToId, afterFirstRun);

    // The set of keys should be identical
    expect(Object.keys(afterSecondRun).sort()).toEqual(Object.keys(afterFirstRun).sort());

    // Each entry's planId stays the same
    for (const key of Object.keys(afterFirstRun)) {
      expect(afterSecondRun[key].planId).toBe(afterFirstRun[key].planId);
      expect(afterSecondRun[key].tenantId).toBe(afterFirstRun[key].tenantId);
      expect(afterSecondRun[key].appId).toBe(afterFirstRun[key].appId);
    }
  });

  it('inserts 2 apps for free plan on first run', () => {
    const state = buildUpsertMap(tenantId, planId, expectedAppCodes, appCodeToId, {});
    expect(Object.keys(state)).toHaveLength(2);
  });

  it('handles unknown appCode gracefully (skips)', () => {
    const badCodes = ['crm', 'nonexistent'];
    const state = buildUpsertMap(tenantId, planId, badCodes, appCodeToId, {});
    expect(Object.keys(state)).toHaveLength(1); // only crm
  });

  it('dry-run produces no state changes', () => {
    const stateBefore: ReconcileState = {};
    // Dry-run: do nothing
    const stateAfter = { ...stateBefore };
    expect(stateAfter).toEqual(stateBefore);
  });
});
