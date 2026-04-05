# 🚀 Supabase SQL Editor Migration Instructions

## Quick Start

1. **Open Supabase Dashboard**
   - Go to your Supabase project
   - Navigate to **SQL Editor**

2. **Copy the Migration SQL**
   - Open file: `wrapper/backend/src/db/migrations/supabase_drop_credit_allocation_tables.sql`
   - Copy the entire contents

3. **Paste and Run**
   - Paste into Supabase SQL Editor
   - Click **Run** or press `Ctrl+Enter` (Windows/Linux) or `Cmd+Enter` (Mac)

4. **Verify Results**
   - Check the output messages in the SQL Editor
   - Look for "✅ SUCCESS" message

## 📋 Migration File Location

```
wrapper/backend/src/db/migrations/supabase_drop_credit_allocation_tables.sql
```

## ⚠️ Important Notes

### Before Running:
- ✅ **Backup your database** (Supabase provides automatic backups, but verify)
- ✅ **Test in a development/staging environment first**
- ✅ **Ensure no application code references these tables**

### What Gets Dropped:
- `credit_allocation_transactions` table
- `credit_allocations` table
- All related constraints, indexes, and foreign keys (via CASCADE)

### What Remains:
- ✅ `credits` table (core credit balance)
- ✅ `credit_transactions` table (core transaction ledger)
- ✅ `credit_purchases` table
- ✅ `credit_usage` table
- ✅ `credit_configurations` table

## 🔍 Verification

After running the migration, verify in Supabase:

### Option 1: SQL Query
```sql
-- Check if tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('credit_allocations', 'credit_allocation_transactions');
```

Expected result: **0 rows** (tables should not exist)

### Option 2: Table Editor
- Go to **Table Editor** in Supabase Dashboard
- Look for `credit_allocations` and `credit_allocation_transactions`
- They should **not** appear in the list

## 📊 Migration Output

The migration will show:
- ✅ Status check (before migration)
- ✅ Record counts (if tables exist)
- ✅ Verification (after migration)
- ✅ Success/Warning messages

## 🐛 Troubleshooting

### Error: "permission denied"
**Solution**: Ensure you're running as a database owner/admin in Supabase

### Error: "table does not exist"
**Solution**: This is expected if tables were already dropped. The migration uses `IF EXISTS` so it's safe.

### Warning: "Some tables still exist"
**Solution**: Check for custom constraints or permissions that might prevent dropping. Contact Supabase support if needed.

## ✅ Post-Migration Checklist

- [ ] Tables successfully dropped (verified in SQL Editor output)
- [ ] No errors in application logs
- [ ] Onboarding flow works correctly
- [ ] Credit allocation works at organization level
- [ ] No references to dropped tables in codebase

## 📞 Support

If you encounter issues:
1. Check Supabase SQL Editor output for error messages
2. Verify database permissions
3. Review Supabase logs
4. Contact Supabase support if needed

---

**Migration Version**: 1.0.0  
**Last Updated**: 2024

















