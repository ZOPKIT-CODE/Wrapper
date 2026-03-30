#!/bin/bash

# 🔄 **RUN ALL ONBOARDING MIGRATIONS**
# This script runs all necessary migrations for the onboarding flow changes
#
# Usage:
#   chmod +x src/db/migrations/scripts/run-all-migrations.sh
#   ./src/db/migrations/scripts/run-all-migrations.sh
#   OR
#   pnpm run db:migrate:all

set -e # Exit on error

echo "🚀 Starting All Onboarding Migrations"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
  echo -e "${RED}❌ DATABASE_URL environment variable is required${NC}"
  echo "   Please set it in your .env file or export it"
  exit 1
fi

echo -e "${GREEN}✅ DATABASE_URL found${NC}"
echo ""

# Step 1: Drop credit allocation tables
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Step 1: Dropping Credit Allocation Tables"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
node src/db/migrations/scripts/run-credit-allocation-migration.js

if [ $? -eq 0 ]; then
  echo -e "${GREEN}✅ Step 1 completed successfully${NC}\n"
else
  echo -e "${RED}❌ Step 1 failed${NC}"
  exit 1
fi

# Step 2: Verify schema changes
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Step 2: Verifying Schema Changes"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Check if tables were dropped
node -e "
import postgres from 'postgres';
import 'dotenv/config';

const sql = postgres(process.env.DATABASE_URL);

async function verify() {
    const allocations = await sql\`SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'credit_allocations') as exists;\`;
    const transactions = await sql\`SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'credit_allocation_transactions') as exists;\`;

    if (!allocations[0]?.exists && !transactions[0]?.exists) {
        console.log('✅ Credit allocation tables successfully removed');
        process.exit(0);
    } else {
        console.log('⚠️  Some tables still exist');
        if (allocations[0]?.exists) console.log('   - credit_allocations');
        if (transactions[0]?.exists) console.log('   - credit_allocation_transactions');
        process.exit(1);
    }
}

verify().finally(() => sql.end());
"

if [ $? -eq 0 ]; then
  echo -e "${GREEN}✅ Step 2 completed successfully${NC}\n"
else
  echo -e "${YELLOW}⚠️  Step 2 completed with warnings${NC}\n"
fi

# Summary
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${GREEN}✅ All Migrations Completed${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📋 Changes Applied:"
echo "   • Removed credit_allocations table"
echo "   • Removed credit_allocation_transactions table"
echo ""
echo "📝 Next Steps:"
echo "   • Verify your application code doesn't reference these tables"
echo "   • Test onboarding flow to ensure everything works"
echo "   • Applications should now manage their own credit consumption"
echo ""

