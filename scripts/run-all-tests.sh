#!/bin/bash
# Run all detection logic tests
set -e

echo "========================================================================"
echo "FINOPS AGENT - COMPREHENSIVE TEST SUITE"
echo "========================================================================"
echo ""

echo "1. EDGE CASE TESTS (69 scenarios)"
echo "----------------------------------------"
npx tsx scripts/test-comprehensive.ts
echo ""

echo "2. STRESS TEST (100,000 random resources)"
echo "----------------------------------------"
npx tsx scripts/test-stress.ts
echo ""

echo "3. DESCRIPTION GENERATION TESTS (18 scenarios)"
echo "----------------------------------------"
npx tsx scripts/test-descriptions.ts
echo ""

echo "4. RECOMMENDATION TYPE TESTS (23 explicit + 10,000 random)"
echo "----------------------------------------"
npx tsx scripts/test-rec-types-comprehensive.ts
echo ""

echo "5. INTEGRATION TEST (verifies against actual database)"
echo "----------------------------------------"
DATABASE_URL='postgres://postgres.tpevphqubhugurdebthl:vYOu4r6YgiL7D8o4@aws-1-us-west-1.pooler.supabase.com:6543/postgres' npx tsx scripts/test-integration.ts
echo ""

echo "========================================================================"
echo "ALL TESTS COMPLETE"
echo "========================================================================"
