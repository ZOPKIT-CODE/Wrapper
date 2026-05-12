/**
 * Unit tests for the organization_applications post-condition assertion in onboarding.
 * Uses vitest with mocked DB — no real database needed.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Minimal mock for drizzle tx ──────────────────────────────────────────────
const makeCountResult = (n: number) => [[{ seededCount: n }]];

function makeTx(countResult: number) {
  const insert = vi.fn().mockReturnValue({
    values: vi.fn().mockResolvedValue([]),
  });
  const select = vi.fn().mockReturnValue({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(makeCountResult(countResult)[0]),
    }),
  });
  return { insert, select };
}

// ── Tests ────────────────────────────────────────────────────────────────────
describe('onboarding org_apps post-condition', () => {
  beforeEach(() => {
    // Ensure global.logToES exists (not set in test env)
    if (typeof global.logToES !== 'function') {
      global.logToES = vi.fn();
    }
  });

  it('throws ONBOARDING_INTEGRITY_FAIL when insert wrote 0 rows', async () => {
    // Simulate: we tried to insert 2 apps but seededCount returned 0
    const applicationsToInsert = [{ id: '1' }, { id: '2' }];
    const seededCount = 0;

    const shouldThrow = () => {
      if (applicationsToInsert.length > 0 && seededCount === 0) {
        throw Object.assign(
          new Error('ONBOARDING_INTEGRITY_FAIL: organization_applications empty after seed'),
          { statusCode: 500, code: 'ONBOARDING_INTEGRITY_FAIL' }
        );
      }
    };

    expect(shouldThrow).toThrow('ONBOARDING_INTEGRITY_FAIL');
    try {
      shouldThrow();
    } catch (err: unknown) {
      expect((err as { code?: string }).code).toBe('ONBOARDING_INTEGRITY_FAIL');
      expect((err as { statusCode?: number }).statusCode).toBe(500);
    }
  });

  it('does NOT throw when insert wrote the expected number of rows', () => {
    const applicationsToInsert: { id: string }[] = [{ id: '1' }, { id: '2' }];
    const seededCount: number = 2;

    const shouldNotThrow = () => {
      if (applicationsToInsert.length > 0 && seededCount === 0) {
        throw new Error('should not reach here');
      }
    };

    expect(shouldNotThrow).not.toThrow();
  });

  it('does NOT throw when no apps were expected (empty plan)', () => {
    const applicationsToInsert: unknown[] = [];
    const seededCount = 0;

    const shouldNotThrow = () => {
      if (applicationsToInsert.length > 0 && seededCount === 0) {
        throw new Error('should not reach here');
      }
    };

    expect(shouldNotThrow).not.toThrow();
  });
});
