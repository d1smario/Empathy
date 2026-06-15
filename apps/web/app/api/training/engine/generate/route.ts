import { NextRequest, NextResponse } from "next/server";
import { AthleteReadContextError, requireAthleteReadContext } from "@/lib/auth/athlete-read-context";
import { resolveOperationalSignalsBundle } from "@/lib/dashboard/resolve-operational-signals-bundle";
import { resolveAthleteMemorySlice } from "@/lib/memory/athlete-memory-resolver";
import { resolveLatestRecoverySummary } from "@/lib/reality/recovery-summary";
import { resolveCanonicalPhysiologyState } from "@/lib/physiology/profile-resolver";
import { resolveCanonicalTwinState } from "@/lib/twin/athlete-state-resolver";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { applyBuilderOperationalScaling } from "@/lib/training/builder/apply-builder-operational-scaling";
import {
  coerceTechnicalModuleFocus,
  generateTrainingSession,
  inferDomainFromSport,
  TRAINING_EXERCISE_LIBRARY,
  type AdaptationTarget,
  type AthleteMetabolicState,
  type ExerciseLibraryItem,
  type GeneratedSession,
  type GymContractionEmphasis,
  type GymEquipmentChannel,
  type GymGenerationProfile,
  type LoadBand,
  type PrimaryPhysiologySystem,
  type SessionBlock,
  type SessionGoalRequest,
  type SessionMethod,
  type TrainingDomain,
} from "@/lib/training/engine";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const NO_STORE = { "Cache-Control": "no-store" as const };

/**
 * Materializzazione sessione canonica (builder engine deterministico).
 * Vyria / piano annuale devono richiamare questo stesso percorso per ogni blocco da materializzare — nessun secondo motore sessione.
 *
 * Fase Pro 2: core `generateTrainingSession` + `resolveCanonicalPhysiologyState` + lettura `twin_states`.
 * Scaling operativo recovery/bioenergetica: solo se `applyOperationalScaling` (builder giornaliero).
 * Materializzazione VIRYA annuale: lasciare `applyOperationalScaling` false per non alterare il piano guida.
 */
function coerceAdaptationTarget(v: string): AdaptationTarget | null {
  const allowed: AdaptationTarget[] = [
    "mitochondrial_density",
    "vo2_max_support",
    "lactate_tolerance",
    "lactate_clearance",
    "max_strength",
    "power_output",
    "hypertrophy_mixed",
    "hypertrophy_myofibrillar",
    "hypertrophy_sarcoplasmic",
    "neuromuscular_adaptation",
    "movement_quality",
    "mobility_capacity",
    "skill_transfer",
    "recovery",
  ];
  return allowed.includes(v as AdaptationTarget) ? (v as AdaptationTarget) : null;
}

const GYM_EQUIPMENT_CHANNELS: GymEquipmentChannel[] = [
  "free_weight",
  "bodyweight",
  "cable",
  "elastic",
  "machine",
];

const GYM_CONTRACTIONS: GymContractionEmphasis[] = ["standard", "eccentric", "isometric", "plyometric"];

function coerceGymProfile(raw: unknown): GymGenerationProfile | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const o = raw as Record<string, unknown>;
  let equipmentChannels: GymEquipmentChannel[] | undefined;
  const eqRaw = o.equipmentChannels;
  if (Array.isArray(eqRaw)) {
    equipmentChannels = eqRaw
      .map((x) => String(x).trim() as GymEquipmentChannel)
      .filter((x): x is GymEquipmentChannel => GYM_EQUIPMENT_CHANNELS.includes(x));
    if (equipmentChannels.length === 0) equipmentChannels = undefined;
  }
  let contraction: GymContractionEmphasis | undefined;
  const cRaw = o.contraction;
  if (typeof cRaw === "string" && GYM_CONTRACTIONS.includes(cRaw as GymContractionEmphasis)) {
    contraction = cRaw as GymContractionEmphasis;
    if (contraction === "standard") contraction = undefined;
  }
  if (!equipmentChannels && !contraction) return undefined;
  return { equipmentChannels, contraction };
}

function coerceDomain(v: string | null | undefined): TrainingDomain | null {
  const allowed: TrainingDomain[] = [
    "endurance",
    "gym",
    "crossfit",
    "hyrox",
    "team_sport",
    "combat",
    "mind_body",
  ];
  if (!v) return null;
  return allowed.includes(v as TrainingDomain) ? (v as TrainingDomain) : null;
}

function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* Engine 'db' — generazione sessione via Postgres (generate_training_session) */
/* ------------------------------------------------------------------ */

const SESSION_METHODS: SessionMethod[] = [
  "steady",
  "interval",
  "repeated_sprint",
  "strength_sets",
  "power_sets",
  "mixed_circuit",
  "technical_drill",
  "flow_recovery",
];

const PHYSIOLOGY_SYSTEMS: PrimaryPhysiologySystem[] = [
  "aerobic",
  "anaerobic_alactic",
  "anaerobic_lactic",
  "neuromuscular_strength",
  "neuromuscular_power",
  "coordination",
  "proprioception",
  "mobility",
  "stability",
  "skill",
];

const LOAD_BANDS: LoadBand[] = ["low", "moderate", "high", "very_high"];

function isRecord(v: unknown): v is Record<string, unknown> {
  return v != null && typeof v === "object" && !Array.isArray(v);
}

function strArray(v: unknown): string[] {
  return Array.isArray(v) ? v.map((x) => String(x)) : [];
}

function coerceSessionMethod(v: unknown): SessionMethod | null {
  const s = String(v ?? "").trim();
  return SESSION_METHODS.includes(s as SessionMethod) ? (s as SessionMethod) : null;
}

function coercePhysiologySystem(v: unknown): PrimaryPhysiologySystem | null {
  const s = String(v ?? "").trim();
  return PHYSIOLOGY_SYSTEMS.includes(s as PrimaryPhysiologySystem)
    ? (s as PrimaryPhysiologySystem)
    : null;
}

function coerceLoadBand(v: unknown): LoadBand | null {
  const s = String(v ?? "").trim();
  return LOAD_BANDS.includes(s as LoadBand) ? (s as LoadBand) : null;
}

function coerceLevel(v: unknown): "low" | "medium" | "high" | null {
  const s = String(v ?? "").trim();
  return s === "low" || s === "medium" || s === "high" ? s : null;
}

/** `exercise` (DB) → forma `ExerciseLibraryItem` per `blockExercises` compatibile col motore TS. */
function mapDbExerciseRow(row: Record<string, unknown>, fallbackDomain: TrainingDomain): ExerciseLibraryItem {
  const channels = strArray(row.gym_channels).filter((x): x is GymEquipmentChannel =>
    GYM_EQUIPMENT_CHANNELS.includes(x as GymEquipmentChannel),
  );
  const contractions = strArray(row.gym_contractions).filter((x): x is GymContractionEmphasis =>
    GYM_CONTRACTIONS.includes(x as GymContractionEmphasis),
  );
  return {
    id: String(row.id),
    name: String(row.name ?? row.id),
    domain: coerceDomain(typeof row.domain === "string" ? row.domain : null) ?? fallbackDomain,
    sportTags: strArray(row.sport_tags),
    movementPattern: String(row.movement_pattern ?? ""),
    muscleGroups: strArray(row.muscle_groups),
    equipment: strArray(row.equipment),
    ...(channels.length > 0 || contractions.length > 0
      ? {
          gymMeta: {
            ...(channels.length > 0 ? { channels } : {}),
            ...(contractions.length > 0 ? { contractions } : {}),
          },
        }
      : {}),
    physiology: {
      primarySystem: coercePhysiologySystem(row.primary_system) ?? "aerobic",
      secondarySystems: strArray(row.secondary_systems)
        .map((x) => coercePhysiologySystem(x))
        .filter((x): x is PrimaryPhysiologySystem => x != null),
      adaptationTargets: strArray(row.adaptation_targets)
        .map((x) => coerceAdaptationTarget(x))
        .filter((x): x is AdaptationTarget => x != null),
      loadBand: coerceLoadBand(row.load_band) ?? "moderate",
      lactateImpact: coerceLevel(row.lactate_impact) ?? "low",
      cnsLoad: coerceLevel(row.cns_load) ?? "low",
    },
    skills: {
      coordination: coerceLevel(row.coordination) ?? "medium",
      balance: coerceLevel(row.balance) ?? "medium",
      techniqueLevel: coerceLevel(row.technique) ?? "medium",
    },
  };
}

type DbEngineArgs = {
  athleteId: string;
  sessionDate: string;
  adaptationTarget: AdaptationTarget;
  request: SessionGoalRequest;
  athleteState: AthleteMetabolicState;
  applyOperationalScaling: boolean;
  physiologyPresent: boolean;
  twinPresent: boolean;
};

/**
 * Branch motore DB: `generate_training_session` (RPC, ritorna uuid workout) + lettura
 * `workout` / `workout_block` / `workout_block_exercise` / `exercise`, rimappata nella
 * stessa forma di risposta del motore TS (`session: GeneratedSession`, `blockExercises`).
 * Scaling operativo opzionale: `fn_apply_operational_scaling(p_workout_id)` → jsonb.
 */
async function generateViaDbEngine(args: DbEngineArgs): Promise<NextResponse> {
  const admin = createSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json(
      { error: "Motore DB non disponibile: SUPABASE_SERVICE_ROLE_KEY mancante" },
      { status: 500, headers: NO_STORE },
    );
  }

  const gymProfile = args.request.gymProfile;
  const { data: workoutIdRaw, error: rpcErr } = await admin.rpc("generate_training_session", {
    p_athlete_id: args.athleteId,
    p_date: args.sessionDate,
    p_adaptation_target: args.adaptationTarget,
    p_sport: args.request.sport,
    p_session_minutes: args.request.sessionMinutes,
    p_phase: args.request.phase,
    p_readiness: args.athleteState.readinessScore,
    p_fatigue: args.athleteState.fatigueScore,
    p_gym_channels: gymProfile?.equipmentChannels ?? null,
    p_gym_contraction: gymProfile?.contraction ?? null,
  });
  if (rpcErr || !workoutIdRaw) {
    return NextResponse.json(
      { error: `generate_training_session fallita: ${rpcErr?.message ?? "nessun workout id restituito"}` },
      { status: 500, headers: NO_STORE },
    );
  }
  const workoutId = String(workoutIdRaw);

  // Scaling operativo recovery/bioenergetica calcolato nel DB (prima della lettura: muta i blocchi).
  let operationalScaling: unknown = null;
  if (args.applyOperationalScaling) {
    const { data: scaling, error: scalingErr } = await admin.rpc("fn_apply_operational_scaling", {
      p_workout_id: workoutId,
    });
    if (scalingErr) {
      return NextResponse.json(
        { error: `fn_apply_operational_scaling fallita: ${scalingErr.message}` },
        { status: 500, headers: NO_STORE },
      );
    }
    operationalScaling = scaling ?? null;
  }

  const { data: workoutRow, error: workoutErr } = await admin
    .from("workout")
    .select(
      "id, date, discipline, family, adaptation_target, phase, session_name, source, duration_minutes, tss_target, kcal_target, inputs_provenance",
    )
    .eq("id", workoutId)
    .maybeSingle();
  if (workoutErr || !workoutRow) {
    return NextResponse.json(
      { error: `Lettura workout DB fallita: ${workoutErr?.message ?? "workout non trovato"}` },
      { status: 500, headers: NO_STORE },
    );
  }
  const workout = workoutRow as Record<string, unknown>;

  const { data: blockRowsRaw, error: blocksErr } = await admin
    .from("workout_block")
    .select("id, block_order, label, kind, duration_minutes, intensity_cue, params")
    .eq("workout_id", workoutId)
    .order("block_order", { ascending: true });
  if (blocksErr) {
    return NextResponse.json(
      { error: `Lettura blocchi DB fallita: ${blocksErr.message}` },
      { status: 500, headers: NO_STORE },
    );
  }
  const blockRows = (blockRowsRaw ?? []) as Record<string, unknown>[];

  let blockExerciseRows: Record<string, unknown>[] = [];
  const blockIds = blockRows.map((b) => String(b.id));
  if (blockIds.length > 0) {
    const { data, error } = await admin
      .from("workout_block_exercise")
      .select("block_id, exercise_id, exercise_order, sets, reps, load_hint")
      .in("block_id", blockIds)
      .order("exercise_order", { ascending: true });
    if (error) {
      return NextResponse.json(
        { error: `Lettura esercizi blocco DB fallita: ${error.message}` },
        { status: 500, headers: NO_STORE },
      );
    }
    blockExerciseRows = (data ?? []) as Record<string, unknown>[];
  }

  const provenance = isRecord(workout.inputs_provenance) ? workout.inputs_provenance : {};
  const sessionDomain =
    coerceDomain(typeof provenance.domain === "string" ? provenance.domain : null) ?? args.request.domain;

  const exerciseIds = Array.from(new Set(blockExerciseRows.map((r) => String(r.exercise_id))));
  const exerciseById = new Map<string, ExerciseLibraryItem>();
  if (exerciseIds.length > 0) {
    const { data, error } = await admin
      .from("exercise")
      .select(
        "id, name, domain, sport_tags, movement_pattern, muscle_groups, equipment, primary_system, secondary_systems, adaptation_targets, load_band, lactate_impact, cns_load, coordination, balance, technique, gym_channels, gym_contractions",
      )
      .in("id", exerciseIds);
    if (error) {
      return NextResponse.json(
        { error: `Lettura catalogo esercizi DB fallita: ${error.message}` },
        { status: 500, headers: NO_STORE },
      );
    }
    for (const row of (data ?? []) as Record<string, unknown>[]) {
      exerciseById.set(String(row.id), mapDbExerciseRow(row, sessionDomain));
    }
  }

  const exerciseIdsByBlock = new Map<string, string[]>();
  for (const row of blockExerciseRows) {
    const blockId = String(row.block_id);
    const list = exerciseIdsByBlock.get(blockId) ?? [];
    list.push(String(row.exercise_id));
    exerciseIdsByBlock.set(blockId, list);
  }

  const blocks: SessionBlock[] = blockRows.map((row, idx) => {
    const params = isRecord(row.params) ? row.params : {};
    const method = coerceSessionMethod(params.method) ?? "steady";
    return {
      order: num(row.block_order) ?? idx + 1,
      label: String(row.label ?? `Blocco ${idx + 1}`),
      method,
      targetSystem:
        coercePhysiologySystem(params.targetSystem) ?? (method === "flow_recovery" ? "mobility" : "aerobic"),
      durationMinutes: Math.max(0, Math.round(num(row.duration_minutes) ?? 0)),
      intensityCue: String(row.intensity_cue ?? ""),
      expectedAdaptation:
        coerceAdaptationTarget(String(params.expectedAdaptation ?? "")) ?? args.adaptationTarget,
      exerciseIds: exerciseIdsByBlock.get(String(row.id)) ?? [],
    };
  });

  const loadBand = coerceLoadBand(provenance.loadBand) ?? "moderate";
  const tssTarget = num(workout.tss_target);
  const rationale: string[] = [
    `Motore DB Postgres: generate_training_session → workout ${workoutId}.`,
    `Load band ${loadBand} derivata nel DB da readiness ${args.athleteState.readinessScore} / fatigue ${args.athleteState.fatigueScore}.`,
  ];
  if (typeof provenance.mainMethod === "string" || typeof provenance.secondaryMethod === "string") {
    rationale.push(
      `Metodi blocchi (regole DB): principale ${String(provenance.mainMethod ?? "n/d")}, secondario ${String(provenance.secondaryMethod ?? "n/d")}.`,
    );
  }

  const session: GeneratedSession = {
    sport: String(workout.discipline ?? args.request.sport),
    domain: sessionDomain,
    goalLabel: args.request.goalLabel,
    physiologicalTarget:
      coerceAdaptationTarget(String(workout.adaptation_target ?? "")) ?? args.adaptationTarget,
    expectedLoad: {
      loadBand,
      tssHint: tssTarget != null ? Math.round(tssTarget) : null,
    },
    blocks,
    rationale,
  };

  const blockExercises = blocks.map((block) => ({
    order: block.order,
    label: block.label,
    exercises: block.exerciseIds
      .map((id) => exerciseById.get(id))
      .filter((item): item is ExerciseLibraryItem => item != null),
  }));

  return NextResponse.json(
    {
      ok: true as const,
      athleteId: args.athleteId,
      athleteState: args.athleteState,
      session,
      blockExercises,
      source: "db_engine_postgres",
      physiologyPresent: args.physiologyPresent,
      twinPresent: args.twinPresent,
      adaptationGuidance: null,
      operationalContext: null,
      adaptationLoop: null,
      bioenergeticModulation: null,
      operationalScaling,
      workoutId,
      sessionDate: args.sessionDate,
      /** Vyria / planner annuale: usare questo endpoint (o wrapper server) per materializzare ogni sessione. */
      materializationPolicy: "single_session_via_builder_engine_only",
    },
    { headers: NO_STORE },
  );
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as {
    athleteId?: string;
    applyOperationalScaling?: boolean;
    /** 'db' → generazione via Postgres (generate_training_session). Default: motore TS. */
    engine?: string;
    /** Solo engine 'db': data sessione YYYY-MM-DD (default oggi). */
    date?: string;
    request?: Partial<SessionGoalRequest>;
  };
  const athleteId = String(body.athleteId ?? "").trim();
  if (!athleteId) {
    return NextResponse.json({ error: "Missing athleteId" }, { status: 400, headers: NO_STORE });
  }

  let db: Awaited<ReturnType<typeof requireAthleteReadContext>>["db"];
  try {
    ({ db } = await requireAthleteReadContext(req, athleteId));
  } catch (err) {
    if (err instanceof AthleteReadContextError) {
      const msg =
        err.status === 401 ? "Unauthorized" : err.status === 403 ? "Forbidden" : err.message;
      return NextResponse.json({ error: msg }, { status: err.status, headers: NO_STORE });
    }
    throw err;
  }

  const requestRaw = body.request ?? {};
  const adaptationTarget = coerceAdaptationTarget(String(requestRaw.adaptationTarget ?? "").trim());
  if (!adaptationTarget) {
    return NextResponse.json({ error: "Invalid adaptationTarget" }, { status: 400, headers: NO_STORE });
  }

  const phase = (String(requestRaw.phase ?? "base").trim() || "base") as SessionGoalRequest["phase"];
  const sport = String(requestRaw.sport ?? "").trim() || "cycling";
  const goalLabel = String(requestRaw.goalLabel ?? "").trim() || adaptationTarget;
  const sessionMinutes = Math.max(20, Math.min(180, Math.round(Number(requestRaw.sessionMinutes ?? 60) || 60)));
  const tssTargetHintRaw = Number(requestRaw.tssTargetHint ?? 0);
  const tssTargetHint =
    Number.isFinite(tssTargetHintRaw) && tssTargetHintRaw > 0 ? Math.round(tssTargetHintRaw) : undefined;
  const intensityHint = String(requestRaw.intensityHint ?? "").trim() || undefined;
  const objectiveDetail = String(requestRaw.objectiveDetail ?? "").trim() || undefined;
  const gymProfile = coerceGymProfile(requestRaw.gymProfile);
  const domainCoerced = coerceDomain(requestRaw.domain ?? null);
  const technicalModuleFocus = coerceTechnicalModuleFocus(requestRaw.technicalModuleFocus);

  const canonPhys = await resolveCanonicalPhysiologyState(athleteId);
  const phys = canonPhys.physiologicalProfile;
  const twin = await resolveCanonicalTwinState(athleteId, canonPhys);

  const athleteState: AthleteMetabolicState = {
    ftpW: phys.ftpWatts ?? null,
    vo2maxMlKgMin: phys.vo2maxMlMinKg ?? null,
    vLamax: phys.vLamax ?? null,
    lactateThresholdPowerW: phys.lt2Watts ?? null,
    readinessScore: Math.max(0, Math.min(100, Math.round(twin.readiness ?? 68))),
    fatigueScore: Math.max(0, Math.min(100, Math.round(twin.fatigueAcute ?? 35))),
  };

  const requestNormalized: SessionGoalRequest = {
    sport,
    domain: domainCoerced ?? inferDomainFromSport(sport),
    goalLabel,
    adaptationTarget,
    sessionMinutes,
    phase: ["base", "build", "peak", "taper"].includes(phase) ? phase : "base",
    tssTargetHint,
    intensityHint,
    objectiveDetail,
    gymProfile,
    ...(technicalModuleFocus ? { technicalModuleFocus } : {}),
  };

  // Engine 'db': body.engine vince; senza body.engine vale env TRAINING_ENGINE. Default invariato (motore TS).
  const engineRequested = typeof body.engine === "string" ? body.engine.trim().toLowerCase() : "";
  const useDbEngine =
    engineRequested === "db" ||
    (engineRequested === "" && (process.env.TRAINING_ENGINE ?? "").trim().toLowerCase() === "db");
  if (useDbEngine) {
    const dateRaw = typeof body.date === "string" ? body.date.trim() : "";
    const sessionDate = /^\d{4}-\d{2}-\d{2}$/.test(dateRaw)
      ? dateRaw
      : new Date().toISOString().slice(0, 10);
    return generateViaDbEngine({
      athleteId,
      sessionDate,
      adaptationTarget,
      request: requestNormalized,
      athleteState,
      applyOperationalScaling: body.applyOperationalScaling === true,
      physiologyPresent: Object.values(canonPhys.sources).some(Boolean),
      twinPresent: Boolean(twin?.asOf),
    });
  }

  let generated = generateTrainingSession(requestNormalized, athleteState);
  let operationalScaling = null;
  let operationalContext = null;
  let adaptationLoop = null;
  let bioenergeticModulation = null;
  let adaptationGuidance = null;

  if (body.applyOperationalScaling === true) {
    const athleteMemory = await resolveAthleteMemorySlice(athleteId, { slice: "training" });
    const recoverySummary = await resolveLatestRecoverySummary(athleteId).catch(() => null);
    const bundle = await resolveOperationalSignalsBundle({
      athleteId,
      athleteMemory,
      recoverySummary,
    });
    adaptationGuidance = bundle.adaptationGuidance;
    operationalContext = bundle.operationalContext;
    adaptationLoop = bundle.adaptationLoop;
    bioenergeticModulation = bundle.bioenergeticModulation;
    if (operationalContext) {
      const scaled = applyBuilderOperationalScaling({
        session: generated,
        sessionMinutesRequested: sessionMinutes,
        tssTargetHintRequested: tssTargetHint ?? null,
        adaptationGuidance: bundle.adaptationGuidance,
        operationalContext,
        bioenergeticModulation,
        adaptationLoop: bundle.adaptationLoop,
        recoveryStatus: recoverySummary?.status ?? null,
      });
      generated = scaled.session;
      operationalScaling = scaled.operationalScaling;
    }
  }

  const blockExercises = generated.blocks.map((block) => ({
    order: block.order,
    label: block.label,
    exercises: block.exerciseIds
      .map((id) => TRAINING_EXERCISE_LIBRARY.find((item) => item.id === id))
      .filter((item): item is NonNullable<typeof item> => item != null),
  }));

  return NextResponse.json(
    {
      ok: true as const,
      athleteId,
      athleteState,
      session: generated,
      blockExercises,
      source: "pro2_builder_engine_deterministic",
      physiologyPresent: Object.values(canonPhys.sources).some(Boolean),
      twinPresent: Boolean(twin?.asOf),
      adaptationGuidance,
      operationalContext,
      adaptationLoop,
      bioenergeticModulation,
      operationalScaling,
      /** Vyria / planner annuale: usare questo endpoint (o wrapper server) per materializzare ogni sessione. */
      materializationPolicy: "single_session_via_builder_engine_only",
    },
    { headers: NO_STORE },
  );
}
