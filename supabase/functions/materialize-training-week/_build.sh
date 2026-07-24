#!/usr/bin/env bash
# Rigenera il bundle Deno del motore L2 allenamenti (VIRYA rework F3) da apps/web.
#
# STESSA FUNZIONE, DUE RUNTIME: l'entry esporta `materializeTrainingMacro` — la
# IDENTICA funzione chiamata in-process dal server Next (approve route, cron
# continuità). La Edge Function non ha un motore suo: qui si impacchetta quello
# canonico, così una divergenza è impossibile per costruzione (blueprint C).
#
# esbuild risolve gli alias @/ (tsconfig di apps/web) e impacchetta tutte le
# dipendenze in un unico modulo ESM. `@supabase/supabase-js` resta esterno
# (fornito dal runtime via deno.json). `server-only`/`client-only` (guard Next)
# sono aliasati a un modulo vuoto: il codice server gira così anche fuori da un
# React Server Component. process.env è letto lazy dal bundle (resolver motore
# L2, coachOrgIdForDb) → shimmato in env-shim.ts (Deno.env).
#
# Uso: dalla root del repo →  bash supabase/functions/materialize-training-week/_build.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
cd "$ROOT"

TMP="$(mktemp -d)"
ENTRY="$TMP/edge-entry.ts"
EMPTY="$TMP/empty.js"
printf 'export {};\n' > "$EMPTY"
cat > "$ENTRY" <<'TS'
import { materializeTrainingMacro } from "@/lib/training/materialize-training-macro";
import { canAccessAthleteData } from "@/lib/athlete/can-access-athlete-data";
export { materializeTrainingMacro, canAccessAthleteData };
TS

node_modules/.bin/esbuild "$ENTRY" \
  --bundle --format=esm --platform=neutral \
  --external:@supabase/supabase-js \
  --alias:server-only="$EMPTY" \
  --alias:client-only="$EMPTY" \
  --tsconfig=apps/web/tsconfig.json \
  --outfile=supabase/functions/materialize-training-week/training-l2-engine.mjs \
  --log-level=warning

echo "OK: supabase/functions/materialize-training-week/training-l2-engine.mjs rigenerato"
