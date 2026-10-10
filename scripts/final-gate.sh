#!/bin/bash
set -e

echo "--- STARTING FINAL RELEASE GATE ---"

# 1. Typecheck
echo "Step 1: Typecheck..."
npm run lint

# 2. Build
echo "Step 2: Build..."
npm run build

# 3. Behavioral Integration Tests (Local PGlite/Memory)
echo "Step 3: Behavioral Integration Tests..."
timeout 300 npm test || (echo "Behavioral tests failed or timed out" && exit 1)

# 4. Live Supabase Integration Tests
echo "Step 4: Live Supabase Integration Tests..."
if [ -n "$NEXT_PUBLIC_SUPABASE_URL" ]; then
  FORCE_SUPABASE_TESTS=true npx tsx scripts/test-supabase-integration.ts
else
  echo "Skipping live tests: NEXT_PUBLIC_SUPABASE_URL not set"
  exit 1
fi

echo "--- FINAL GATE PASSED ---"
