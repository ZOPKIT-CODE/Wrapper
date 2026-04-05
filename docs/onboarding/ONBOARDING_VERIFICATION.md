# Verifying Onboarding Success

After running the onboarding E2E test (or completing onboarding in the app), you can verify success in the database in two ways.

---

## 1. Supabase MCP (execute_sql)

If the **Supabase MCP** is enabled and connected to the same Postgres database as the wrapper backend, use the `execute_sql` tool with these queries.

### Latest tenants and users (overview)

Run this to see the most recent tenants and their users, with onboarding status:

```sql
SELECT
  t.tenant_id,
  t.company_name,
  t.subdomain,
  t.admin_email,
  t.created_at AS tenant_created_at,
  u.user_id,
  u.email,
  u.name,
  u.onboarding_completed,
  u.onboarding_step
FROM tenants t
LEFT JOIN tenant_users u ON u.tenant_id = t.tenant_id
ORDER BY t.created_at DESC
LIMIT 20;
```

**Success:** You should see at least one row with `onboarding_completed = true` for the user who completed onboarding.

### Check a specific user by email

```sql
SELECT
  t.tenant_id,
  t.company_name,
  t.subdomain,
  u.user_id,
  u.email,
  u.name,
  u.onboarding_completed,
  u.onboarding_step
FROM tenant_users u
JOIN tenants t ON t.tenant_id = u.tenant_id
WHERE u.email = 'your-test-user@example.com'
ORDER BY t.created_at DESC;
```

Replace `'your-test-user@example.com'` with the email used in the test. **Success:** `onboarding_completed` is `true`.

### Optional: tenant initial setup data

To confirm the tenant has stored onboarding form data:

```sql
SELECT
  tenant_id,
  company_name,
  subdomain,
  initial_setup_data IS NOT NULL AS has_setup_data,
  jsonb_pretty(initial_setup_data) AS setup_data_preview
FROM tenants
ORDER BY created_at DESC
LIMIT 5;
```

---

## 2. Backend script (same DB, no MCP)

From the **backend** directory, using the same `DATABASE_URL` as the app:

```bash
cd backend
node scripts/verify-onboarding-in-db.js
```

This prints a table of the latest tenants and users and whether `onboarding_completed` is true.

To check a specific email:

```bash
EMAIL=your-test-user@example.com node scripts/verify-onboarding-in-db.js
```

Exit code: `0` if at least one user has onboarding completed (or when checking by email, that user is completed); `1` otherwise.

---

## Summary

| Method              | When to use                                      |
|---------------------|--------------------------------------------------|
| Supabase MCP        | When MCP is enabled; run the SQL above in `execute_sql`. |
| Backend script      | Anytime; uses `DATABASE_URL` from backend `.env`. |

Both methods query the same tables: `tenants` and `tenant_users`. Onboarding is considered successful when:

1. A row exists in `tenants` for the new company (e.g. after "Create tenant" in onboarding).
2. A row exists in `tenant_users` for the admin user linked to that tenant.
3. `tenant_users.onboarding_completed = true` for that user (set when they complete the flow and click "Launch Workspace" / complete step).
