import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { isPlatformAdminIdentity } from './platform-plane.js';

// platform-plane is a pure config-driven helper — no DB/Cognito to mock. These
// tests pin the platform-vs-tenant boundary: only the configured Cognito group or
// the break-glass allowlist confer platform-admin; nothing tenant-scoped does.

describe('isPlatformAdminIdentity', () => {
  const ORIG = { ...process.env };

  beforeEach(() => {
    delete process.env.COGNITO_PLATFORM_ADMIN_GROUP;
    delete process.env.PLATFORM_ADMIN_BOOTSTRAP_EMAILS;
  });
  afterEach(() => {
    process.env = { ...ORIG };
  });

  it('returns true when the user is in the default platform-admin group', () => {
    expect(isPlatformAdminIdentity({ groups: ['platform-admins'], email: 'op@zopkit.com' })).toBe(true);
  });

  it('honours a custom group name from COGNITO_PLATFORM_ADMIN_GROUP', () => {
    process.env.COGNITO_PLATFORM_ADMIN_GROUP = 'staff-superusers';
    expect(isPlatformAdminIdentity({ groups: ['staff-superusers'], email: 'x@y.com' })).toBe(true);
    // The default name no longer counts once overridden.
    expect(isPlatformAdminIdentity({ groups: ['platform-admins'], email: 'x@y.com' })).toBe(false);
  });

  it('returns false for a user with only tenant-level groups (no platform group)', () => {
    expect(isPlatformAdminIdentity({ groups: ['tenant-admins', 'billing'], email: 'a@b.com' })).toBe(false);
  });

  it('returns false when groups is missing/empty and no bootstrap allowlist', () => {
    expect(isPlatformAdminIdentity({ groups: undefined, email: 'a@b.com' })).toBe(false);
    expect(isPlatformAdminIdentity({ groups: [], email: 'a@b.com' })).toBe(false);
    expect(isPlatformAdminIdentity({})).toBe(false);
  });

  it('grants via the break-glass bootstrap allowlist (case/space-insensitive)', () => {
    process.env.PLATFORM_ADMIN_BOOTSTRAP_EMAILS = ' Founder@Zopkit.com , ops@zopkit.com ';
    expect(isPlatformAdminIdentity({ email: 'founder@zopkit.com' })).toBe(true);
    expect(isPlatformAdminIdentity({ email: 'OPS@ZOPKIT.COM' })).toBe(true);
    expect(isPlatformAdminIdentity({ email: 'someone-else@zopkit.com' })).toBe(false);
  });

  it('does not grant on an empty bootstrap allowlist value', () => {
    process.env.PLATFORM_ADMIN_BOOTSTRAP_EMAILS = '';
    expect(isPlatformAdminIdentity({ email: 'a@b.com' })).toBe(false);
  });
});
