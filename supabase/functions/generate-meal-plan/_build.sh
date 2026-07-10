#!/usr/bin/env bash
# Rigenera il bundle Deno del motore nutrizione V2 da apps/web.
# esbuild risolve gli alias @/ (tsconfig di apps/web) e impacchetta tutte le dipendenze
# in un unico modulo ESM puro (nessun process.env, nessun import esterno): il motore
# prende solo il client `db` come parametro, quindi gira as-is su Deno.
#
# Uso: dalla root del repo →  bash supabase/functions/generate-meal-plan/_build.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
cd "$ROOT"

ENTRY="$(mktemp -d)/edge-entry.ts"
cat > "$ENTRY" <<'TS'
import { prepareIntelligentMealPlanContext } from "@/lib/nutrition/intelligent-meal-plan-route-prep";
import { buildMealPlanV2Production } from "@/lib/nutrition/v2/build-meal-plan-v2-production";
import { persistV2PlanToDb } from "@/lib/nutrition/v2/persist-v2-plan-to-db";
export { prepareIntelligentMealPlanContext, buildMealPlanV2Production, persistV2PlanToDb };
TS

node_modules/.bin/esbuild "$ENTRY" \
  --bundle --format=esm --platform=neutral \
  --external:@supabase/supabase-js \
  --tsconfig=apps/web/tsconfig.json \
  --outfile=supabase/functions/generate-meal-plan/nutrition-v2-engine.mjs \
  --log-level=warning

echo "OK: supabase/functions/generate-meal-plan/nutrition-v2-engine.mjs rigenerato"
