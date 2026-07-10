#!/usr/bin/env bash
# Rigenera il bundle Deno del motore nutrizione V2 da apps/web.
# esbuild risolve gli alias @/ (tsconfig di apps/web) e impacchetta tutte le dipendenze
# in un unico modulo ESM. `@supabase/supabase-js` resta esterno (fornito dal runtime via
# deno.json). `server-only`/`client-only` (guard Next) sono aliasati a un modulo vuoto:
# il codice server gira così anche fuori da un React Server Component.
# process.env è letto lazy dal bundle → shimmato in env-shim.ts (Deno.env).
#
# Uso: dalla root del repo →  bash supabase/functions/generate-meal-plan/_build.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
cd "$ROOT"

TMP="$(mktemp -d)"
ENTRY="$TMP/edge-entry.ts"
EMPTY="$TMP/empty.js"
printf 'export {};\n' > "$EMPTY"
cat > "$ENTRY" <<'TS'
import { prepareIntelligentMealPlanContext } from "@/lib/nutrition/intelligent-meal-plan-route-prep";
import { buildMealPlanV2Production } from "@/lib/nutrition/v2/build-meal-plan-v2-production";
import { mapV2PlanToV1Response } from "@/lib/nutrition/v2/map-v2-plan-to-v1-response";
import { persistV2PlanToDb } from "@/lib/nutrition/v2/persist-v2-plan-to-db";
import { attachSolverBasisToAssembled } from "@/lib/nutrition/meal-plan-solver-basis";
import { canAccessAthleteData } from "@/lib/athlete/can-access-athlete-data";
export {
  prepareIntelligentMealPlanContext,
  buildMealPlanV2Production,
  mapV2PlanToV1Response,
  persistV2PlanToDb,
  attachSolverBasisToAssembled,
  canAccessAthleteData,
};
TS

node_modules/.bin/esbuild "$ENTRY" \
  --bundle --format=esm --platform=neutral \
  --external:@supabase/supabase-js \
  --alias:server-only="$EMPTY" \
  --alias:client-only="$EMPTY" \
  --tsconfig=apps/web/tsconfig.json \
  --outfile=supabase/functions/generate-meal-plan/nutrition-v2-engine.mjs \
  --log-level=warning

echo "OK: supabase/functions/generate-meal-plan/nutrition-v2-engine.mjs rigenerato"
