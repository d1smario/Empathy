var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};

// apps/web/lib/training/builder/pro2-session-contract.ts
var BUILDER_SESSION_JSON_TAG;
var init_pro2_session_contract = __esm({
  "apps/web/lib/training/builder/pro2-session-contract.ts"() {
    "use strict";
    BUILDER_SESSION_JSON_TAG = "BUILDER_SESSION_JSON::";
  }
});

// apps/web/lib/training/builder/pro2-intensity.ts
function intensityScore(intensity) {
  const map = {
    Z1: 1,
    Z2: 2,
    Z3: 3,
    Z4: 4,
    Z5: 5,
    Z6: 6,
    Z7: 7,
    LT1: 3,
    LT2: 4,
    FatMax: 2
  };
  return map[intensity] ?? 3;
}
function intensityToRelativeLoad(intensity) {
  const map = {
    Z1: 0.55,
    Z2: 0.68,
    Z3: 0.8,
    Z4: 0.92,
    Z5: 1.02,
    Z6: 1.1,
    Z7: 1.2,
    LT1: 0.79,
    LT2: 0.95,
    FatMax: 0.65
  };
  return map[intensity] ?? 0.8;
}
function zoneRelativeRange(intensity) {
  const map = {
    Z1: { min: 0.5, max: 0.62 },
    Z2: { min: 0.63, max: 0.74 },
    Z3: { min: 0.75, max: 0.86 },
    Z4: { min: 0.87, max: 0.98 },
    Z5: { min: 0.99, max: 1.07 },
    Z6: { min: 1.08, max: 1.14 },
    Z7: { min: 1.15, max: 1.28 },
    LT1: { min: 0.76, max: 0.82 },
    LT2: { min: 0.92, max: 0.99 },
    FatMax: { min: 0.6, max: 0.7 }
  };
  return map[intensity] ?? { min: 0.75, max: 0.86 };
}
function zoneFromIntensityCue(cue, fallback = "Z2") {
  const text = cue.toUpperCase();
  if (text.includes("FATMAX") || text.includes("FAT MAX")) return "FatMax";
  if (text.includes("LT2")) return "LT2";
  if (text.includes("LT1")) return "LT1";
  if (text.includes("Z7")) return "Z7";
  if (text.includes("Z6")) return "Z6";
  if (text.includes("Z5")) return "Z5";
  if (text.includes("Z4")) return "Z4";
  if (text.includes("Z3")) return "Z3";
  if (text.includes("Z2")) return "Z2";
  if (text.includes("Z1")) return "Z1";
  if (text.includes("RECOVERY") || text.includes("LOW INTENSITY") || text.includes("BREATHING")) return "Z1";
  if (text.includes("EXPLOSIVE") || text.includes("POWER")) return "Z5";
  if (text.includes("THRESHOLD")) return "LT2";
  return fallback;
}
function zoneForTargetValue(value, unit, ftpW, hrMax) {
  const rel = unit === "watt" ? value / Math.max(1, ftpW) : value / Math.max(1, hrMax);
  if (rel < 0.6) return "Z1";
  if (rel < 0.74) return "Z2";
  if (rel < 0.86) return "Z3";
  if (rel < 0.98) return "Z4";
  if (rel < 1.08) return "Z5";
  if (rel < 1.15) return "Z6";
  return "Z7";
}
var init_pro2_intensity = __esm({
  "apps/web/lib/training/builder/pro2-intensity.ts"() {
    "use strict";
  }
});

// apps/web/lib/training/builder/zwo-step-text-events.ts
function sanitizeCoachNoteForTextEvent(raw) {
  const t = (raw ?? "").trim();
  if (!t) return null;
  const withoutOrigin = t.replace(/\borigin=virya_planner\b/gi, "").replace(/\s*\|\s*/g, " ").trim();
  if (!withoutOrigin) return null;
  return withoutOrigin.slice(0, MAX_MESSAGE_LEN);
}
function coachNoteToTextEvents(note) {
  const msg = sanitizeCoachNoteForTextEvent(note);
  if (!msg) return [];
  return [{ offsetSec: 0, message: msg }];
}
var MAX_MESSAGE_LEN;
var init_zwo_step_text_events = __esm({
  "apps/web/lib/training/builder/zwo-step-text-events.ts"() {
    "use strict";
    MAX_MESSAGE_LEN = 120;
  }
});

// apps/web/lib/training/builder/pro2-structured-interval-ladder.ts
function chartOrDefaults(block) {
  const ch = block.chart;
  if (ch) return ch;
  return {
    minutes: Math.max(0, Math.floor(block.durationMinutes)),
    seconds: 0,
    intensity: "",
    startIntensity: "",
    endIntensity: "",
    intensity2: "",
    intensity3: "",
    repeats: 1,
    workSeconds: 180,
    recoverSeconds: 90,
    step1Seconds: 120,
    step2Seconds: 90,
    step3Seconds: 60,
    pyramidSteps: 5,
    pyramidStepSeconds: 180,
    pyramidStartTarget: 100,
    pyramidEndTarget: 200,
    distanceKm: 0,
    gradePercent: 0,
    elevationMeters: 0,
    cadence: "",
    frequencyHint: "",
    loadFactor: 1
  };
}
function blockDurationSeconds(block, lengthMode, speedRefKmh) {
  const ch = block.chart;
  if (lengthMode === "distance" && ch && (ch.distanceKm ?? 0) > 0) {
    return Math.max(30, Math.round(Math.max(0.1, ch.distanceKm) / Math.max(1, speedRefKmh) * 3600));
  }
  const dm = Number(block.durationMinutes);
  if (Number.isFinite(dm) && dm > 0) return Math.max(30, Math.round(dm * 60));
  if (ch) {
    const sec = Math.max(0, ch.minutes * 60 + Math.min(59, ch.seconds));
    return Math.max(30, sec > 0 ? sec : 60);
  }
  return Math.max(60, Math.round(Math.max(0.25, Number(block.durationMinutes) || 1) * 60));
}
function wattsTripleForZoneLabel(label, ftpW) {
  const z = zoneFromIntensityCue(label, "Z3");
  const r = zoneRelativeRange(z);
  const low = Math.max(45, Math.round(r.min * ftpW));
  const high = Math.max(low, Math.round(r.max * ftpW));
  const avg = Math.max(45, Math.round((r.min + r.max) / 2 * ftpW));
  return { low, high, avg };
}
function draftStep(block, suffix, label, durationSec, zoneLabel, kind, watts, opts) {
  const coachNote = opts.firstInBlock ? block.notes?.trim() || void 0 : void 0;
  return {
    id: `${block.id}-${suffix}`,
    label,
    durationSec: Math.max(1, Math.round(durationSec)),
    zoneLabel,
    kind,
    powerAvgW: watts.avg,
    powerLowW: watts.low,
    powerHighW: watts.high,
    coachNote,
    textEvents: coachNoteToTextEvents(coachNote),
    ...opts.extras
  };
}
function expandContractBlock(block, contract) {
  const kind = (block.kind ?? "steady").toLowerCase();
  const ch = chartOrDefaults(block);
  const ftpW = Math.max(1, contract.renderProfile?.ftpW ?? 250);
  const hrMax = Math.max(1, contract.renderProfile?.hrMax ?? 185);
  const unit = contract.renderProfile?.intensityUnit ?? "watt";
  const lengthMode = contract.renderProfile?.lengthMode ?? "time";
  const speedRef = contract.renderProfile?.speedRefKmh ?? 35;
  const dur = blockDurationSeconds(block, lengthMode, speedRef);
  const out = [];
  if (kind === "interval2") {
    const reps = Math.max(1, Math.round(ch.repeats || 1));
    const work = Math.max(10, Math.round(ch.workSeconds || 180));
    const rec = Math.max(10, Math.round(ch.recoverSeconds || 90));
    const zOn = zoneFromIntensityCue(String(ch.intensity || block.intensityCue || ""), "Z4");
    const zOff = zoneFromIntensityCue(String(ch.intensity2 || ""), "Z1");
    for (let i = 0; i < reps; i += 1) {
      out.push(
        draftStep(block, `w-${i}`, `${block.label} \xB7 lavoro`, work, zOn, "steady", wattsTripleForZoneLabel(zOn, ftpW), {
          firstInBlock: i === 0
        })
      );
      out.push(
        draftStep(block, `r-${i}`, `${block.label} \xB7 recupero`, rec, zOff, "steady", wattsTripleForZoneLabel(zOff, ftpW), {
          firstInBlock: false
        })
      );
    }
    return out;
  }
  if (kind === "interval3") {
    const reps = Math.max(1, Math.round(ch.repeats || 1));
    const a = Math.max(10, Math.round(ch.step1Seconds || 120));
    const b = Math.max(10, Math.round(ch.step2Seconds || 90));
    const c = Math.max(10, Math.round(ch.step3Seconds || 60));
    const z1 = zoneFromIntensityCue(String(ch.intensity || ""), "Z4");
    const z2 = zoneFromIntensityCue(String(ch.intensity2 || ""), "Z3");
    const z3 = zoneFromIntensityCue(String(ch.intensity3 || ""), "Z2");
    for (let i = 0; i < reps; i += 1) {
      out.push(draftStep(block, `a-${i}`, `${block.label} \xB7 A`, a, z1, "steady", wattsTripleForZoneLabel(z1, ftpW), { firstInBlock: i === 0 }));
      out.push(draftStep(block, `b-${i}`, `${block.label} \xB7 B`, b, z2, "steady", wattsTripleForZoneLabel(z2, ftpW), { firstInBlock: false }));
      out.push(draftStep(block, `c-${i}`, `${block.label} \xB7 C`, c, z3, "steady", wattsTripleForZoneLabel(z3, ftpW), { firstInBlock: false }));
    }
    return out;
  }
  if (kind === "pyramid") {
    const steps = Math.max(1, Math.round(ch.pyramidSteps || 1));
    const stepSec = Math.max(20, Math.round(ch.pyramidStepSeconds || 60));
    const start = ch.pyramidStartTarget || 0.75 * ftpW;
    const end = ch.pyramidEndTarget || 1.05 * ftpW;
    const span = end - start;
    const lo = Math.min(start, end);
    const hi = Math.max(start, end);
    const spanAbs = hi - lo || 1;
    const unitLabel = unit === "watt" ? "W" : "bpm";
    for (let i = 1; i <= steps; i += 1) {
      const targetValue = Math.round(start + span * i / steps);
      const z2 = zoneForTargetValue(targetValue, unit, ftpW, hrMax);
      const pyramidLinearT = Math.min(1, Math.max(0, (targetValue - lo) / spanAbs));
      const barIntensityScore = Math.min(7, Math.max(0.35, 0.35 + pyramidLinearT * 6.65));
      out.push(
        draftStep(
          block,
          `py-${i}`,
          `${block.label} ${i}/${steps} (~${targetValue} ${unitLabel})`,
          stepSec,
          z2,
          "steady",
          wattsTripleForZoneLabel(z2, ftpW),
          { firstInBlock: i === 1, extras: { barIntensityScore, pyramidLinearT } }
        )
      );
    }
    return out;
  }
  if (kind === "ramp") {
    const zStart = zoneFromIntensityCue(String(ch.startIntensity || ""), "Z2");
    const zEnd = zoneFromIntensityCue(String(ch.endIntensity || ch.intensity || ""), "Z4");
    const a = wattsTripleForZoneLabel(zStart, ftpW);
    const b = wattsTripleForZoneLabel(zEnd, ftpW);
    out.push(
      draftStep(
        block,
        "ramp",
        `${block.label} (${ch.startIntensity || "Z1"}\u2192${zEnd})`,
        dur,
        zEnd,
        "ramp",
        { low: Math.min(a.low, b.low), high: Math.max(a.high, b.high), avg: Math.round((a.avg + b.avg) / 2) },
        { firstInBlock: true }
      )
    );
    return out;
  }
  const z = intensityLabelForContractBlock(block);
  out.push(draftStep(block, "steady", block.label, dur, z, "steady", wattsTripleForZoneLabel(z, ftpW), { firstInBlock: true }));
  return out;
}
function expandContractToLadderSteps(contract) {
  const flat = [];
  let order = 1;
  for (const b of contract.blocks ?? []) {
    for (const draft of expandContractBlock(b, contract)) {
      flat.push({ ...draft, order: order++ });
    }
  }
  return flat;
}
function ladderStepsToChartSegments(steps) {
  return steps.map((s) => ({
    id: s.id,
    order: s.order,
    label: s.label,
    durationSeconds: s.durationSec,
    intensityLabel: s.zoneLabel,
    intensityScore: intensityScore(s.zoneLabel),
    barIntensityScore: s.barIntensityScore,
    pyramidLinearT: s.pyramidLinearT
  }));
}
var init_pro2_structured_interval_ladder = __esm({
  "apps/web/lib/training/builder/pro2-structured-interval-ladder.ts"() {
    "use strict";
    init_pro2_intensity();
    init_pro2_session_notes();
    init_zwo_step_text_events();
  }
});

// apps/web/lib/training/builder/pro2-contract-chart-segments.ts
function pro2BuilderContractToExpandedChartSegments(contract) {
  return ladderStepsToChartSegments(expandContractToLadderSteps(contract));
}
var init_pro2_contract_chart_segments = __esm({
  "apps/web/lib/training/builder/pro2-contract-chart-segments.ts"() {
    "use strict";
    init_pro2_structured_interval_ladder();
  }
});

// apps/web/lib/training/builder/tss-estimate.ts
function estimateTssFromSegments(segments) {
  const refIf = Math.max(0.05, intensityToRelativeLoad("Z4"));
  let sum = 0;
  for (const s of segments) {
    const raw = intensityToRelativeLoad(s.intensityLabel);
    const ifN = raw / refIf;
    const hours = Math.max(0, s.durationSeconds) / 3600;
    sum += hours * ifN * ifN * 100;
  }
  return Math.round(Math.min(999, Math.max(0, sum)));
}
var init_tss_estimate = __esm({
  "apps/web/lib/training/builder/tss-estimate.ts"() {
    "use strict";
    init_pro2_intensity();
  }
});

// packages/domain-physiology/src/session-mechanical-energy.ts
function zoneRelativeLoadForLabel(intensity) {
  return ZONE_RELATIVE_LOAD[intensity] ?? 0.8;
}
function normalizeZoneKey(intensity) {
  const t = intensity.trim();
  if (/^fatmax$/i.test(t)) return "FatMax";
  if (/^LT1$/i.test(t)) return "LT1";
  if (/^LT2$/i.test(t)) return "LT2";
  const m = t.match(/\b(Z[1-7])\b/i);
  if (m) return m[1].toUpperCase();
  return t;
}
function powerWattsForZoneLabel(intensity, ftpW) {
  const ftp = Math.max(1, ftpW);
  const key = normalizeZoneKey(intensity);
  const range = ZONE_RELATIVE_RANGE[key];
  const rel = range ? (range.min + range.max) / 2 : zoneRelativeLoadForLabel(key);
  return Math.max(45, Math.round(ftp * rel));
}
function mechanicalKjFromIntensitySegments(segments, ftpW) {
  const segs = segments.map((s) => ({
    powerW: powerWattsForZoneLabel(s.intensityLabel, ftpW),
    durationSeconds: s.durationSeconds
  }));
  return mechanicalKjFromSegments(segs);
}
function mechanicalJoulesFromSegments(segments) {
  return segments.reduce(
    (sum, seg) => sum + Math.max(0, seg.powerW) * Math.max(0, seg.durationSeconds),
    0
  );
}
function mechanicalKjFromSegments(segments) {
  return Math.round(mechanicalJoulesFromSegments(segments) / 1e3);
}
function mechanicalKjFromAvgPower(avgPowerW, durationSec) {
  if (!Number.isFinite(avgPowerW) || !Number.isFinite(durationSec) || avgPowerW <= 0 || durationSec <= 0) {
    return 0;
  }
  return Math.round(avgPowerW * durationSec / 1e3);
}
function metabolicKcalFromMechanicalKj(mechanicalKj, efficiency = DEFAULT_MECHANICAL_EFFICIENCY) {
  if (!Number.isFinite(mechanicalKj) || mechanicalKj <= 0) return 0;
  const eta = Math.max(0.05, Math.min(0.5, efficiency));
  return Math.round(mechanicalKj / eta / 4.184);
}
var DEFAULT_MECHANICAL_EFFICIENCY, ZONE_RELATIVE_LOAD, ZONE_RELATIVE_RANGE;
var init_session_mechanical_energy = __esm({
  "packages/domain-physiology/src/session-mechanical-energy.ts"() {
    "use strict";
    DEFAULT_MECHANICAL_EFFICIENCY = 0.24;
    ZONE_RELATIVE_LOAD = {
      Z1: 0.55,
      Z2: 0.68,
      Z3: 0.8,
      Z4: 0.92,
      Z5: 1.02,
      Z6: 1.1,
      Z7: 1.2,
      LT1: 0.79,
      LT2: 0.95,
      FatMax: 0.65
    };
    ZONE_RELATIVE_RANGE = {
      Z1: { min: 0.5, max: 0.62 },
      Z2: { min: 0.63, max: 0.74 },
      Z3: { min: 0.75, max: 0.86 },
      Z4: { min: 0.87, max: 0.98 },
      Z5: { min: 0.99, max: 1.07 },
      Z6: { min: 1.08, max: 1.14 },
      Z7: { min: 1.15, max: 1.28 },
      LT1: { min: 0.76, max: 0.82 },
      LT2: { min: 0.92, max: 0.99 },
      FatMax: { min: 0.6, max: 0.7 }
    };
  }
});

// packages/domain-physiology/src/index.ts
var init_src = __esm({
  "packages/domain-physiology/src/index.ts"() {
    "use strict";
    init_session_mechanical_energy();
  }
});

// apps/web/lib/training/physiology/resolve-athlete-ftp-watts.ts
function isUsableAthleteFtpWatts(value) {
  return typeof value === "number" && Number.isFinite(value) && value > 40 && value < 600;
}
function resolveAthleteFtpWattsForSessionEnergy(input) {
  if (isUsableAthleteFtpWatts(input.athleteFtpWatts)) return Math.round(input.athleteFtpWatts);
  const fromContract = input.contract?.renderProfile?.ftpW;
  if (isUsableAthleteFtpWatts(fromContract)) return Math.round(fromContract);
  return null;
}
var init_resolve_athlete_ftp_watts = __esm({
  "apps/web/lib/training/physiology/resolve-athlete-ftp-watts.ts"() {
    "use strict";
  }
});

// apps/web/lib/training/physiology/session-metabolic-kcal.ts
function contractWithFtp(contract, ftpW) {
  const rp = contract.renderProfile;
  return {
    ...contract,
    renderProfile: {
      intensityUnit: rp?.intensityUnit ?? "watt",
      ftpW,
      hrMax: rp?.hrMax ?? 185,
      lengthMode: rp?.lengthMode ?? "time",
      speedRefKmh: rp?.speedRefKmh ?? 35
    }
  };
}
function mechanicalKjFromPro2BuilderContract(contract, ctx) {
  if (!contract) return 0;
  const ftpW = resolveAthleteFtpWattsForSessionEnergy({
    athleteFtpWatts: ctx?.athleteFtpWatts,
    contract
  });
  if (ftpW != null && (contract.blocks?.length ?? 0) > 0) {
    const scaled = contractWithFtp(contract, ftpW);
    const steps = expandContractToLadderSteps(scaled);
    if (steps.length > 0) {
      return mechanicalKjFromSegments(
        steps.map((s) => ({ powerW: s.powerAvgW, durationSeconds: s.durationSec }))
      );
    }
    const segs = pro2BuilderContractToExpandedChartSegments(scaled);
    if (segs.length > 0) {
      return mechanicalKjFromIntensitySegments(
        segs.map((s) => ({ durationSeconds: s.durationSeconds, intensityLabel: s.intensityLabel })),
        ftpW
      );
    }
  }
  const summary = contract.summary;
  if (typeof summary?.kj === "number" && summary.kj > 0) return Math.round(summary.kj);
  return mechanicalKjFromAvgPower(summary?.avgPowerW ?? 0, summary?.durationSec ?? 0);
}
function metabolicKcalFromPro2BuilderContract(contract, ctx) {
  const kj = mechanicalKjFromPro2BuilderContract(contract, ctx);
  return metabolicKcalFromMechanicalKj(kj, ctx?.efficiency ?? DEFAULT_MECHANICAL_EFFICIENCY);
}
function metabolicKcalFromPro2SessionSummary(summary) {
  if (!summary) return 0;
  const kj = typeof summary.kj === "number" && summary.kj > 0 ? summary.kj : mechanicalKjFromAvgPower(summary.avgPowerW, summary.durationSec);
  return metabolicKcalFromMechanicalKj(kj);
}
function effectiveMetabolicKcalForPlannedContract(input) {
  if (input.contract && (input.contract.blocks?.length ?? 0) > 0) {
    const fromMechanical = metabolicKcalFromPro2BuilderContract(input.contract, {
      athleteFtpWatts: input.athleteFtpWatts
    });
    if (fromMechanical > 0) return fromMechanical;
  } else if (input.contract?.summary) {
    const fromSummary = metabolicKcalFromPro2SessionSummary(input.contract.summary);
    if (fromSummary > 0) return fromSummary;
  }
  const db = typeof input.kcalTargetDb === "number" && Number.isFinite(input.kcalTargetDb) ? Math.max(0, Math.round(input.kcalTargetDb)) : 0;
  if (db > 0) return db;
  return null;
}
var init_session_metabolic_kcal = __esm({
  "apps/web/lib/training/physiology/session-metabolic-kcal.ts"() {
    "use strict";
    init_src();
    init_pro2_contract_chart_segments();
    init_pro2_structured_interval_ladder();
    init_resolve_athlete_ftp_watts();
  }
});

// apps/web/lib/training/physiology/planned-session-metrics.ts
function resolvePlannedSessionMetrics(input) {
  const contract = input.contract ?? null;
  const durationMinutes = effectiveDurationMinutesFromPro2Contract(
    contract,
    Number(input.durationMinutesDb) || 0
  );
  const tss = effectiveTssDisplayFromPro2Contract(contract, Number(input.tssTargetDb) || 0);
  const kjFromMechanical = mechanicalKjFromPro2BuilderContract(contract, {
    athleteFtpWatts: input.athleteFtpWatts
  });
  const kjDb = Number(input.kjTargetDb);
  const kj = kjFromMechanical > 0 ? kjFromMechanical : Number.isFinite(kjDb) && kjDb > 0 ? Math.round(kjDb) : contract?.summary?.kj != null && contract.summary.kj > 0 ? Math.round(contract.summary.kj) : 0;
  const kcalResolved = effectiveMetabolicKcalForPlannedContract({
    contract,
    kcalTargetDb: input.kcalTargetDb,
    athleteFtpWatts: input.athleteFtpWatts
  });
  const kcal = kcalResolved != null && kcalResolved > 0 ? kcalResolved : 0;
  const durationSec = durationMinutes * 60;
  const avgFromSummary = contract?.summary?.avgPowerW;
  const avgPowerW = typeof avgFromSummary === "number" && avgFromSummary > 0 ? Math.round(avgFromSummary) : durationSec > 0 && kj > 0 ? Math.round(kj * 1e3 / durationSec) : null;
  return { durationMinutes, tss, kj, kcal, avgPowerW };
}
var init_planned_session_metrics = __esm({
  "apps/web/lib/training/physiology/planned-session-metrics.ts"() {
    "use strict";
    init_pro2_session_notes();
    init_session_metabolic_kcal();
  }
});

// apps/web/lib/training/builder/pro2-session-notes.ts
function collectBuilderJsonSegments(line) {
  const t = line.trim();
  if (!t) return [];
  return t.split(/\s*\|\s*/).map((s) => s.trim()).filter((s) => s.startsWith(BUILDER_SESSION_JSON_TAG));
}
function parsePro2BuilderSessionFromNotes(notes) {
  if (!notes?.trim()) return null;
  const candidates = [];
  for (const line of notes.split(/\r?\n/)) {
    candidates.push(...collectBuilderJsonSegments(line));
  }
  for (const t of candidates) {
    const payload = t.slice(BUILDER_SESSION_JSON_TAG.length);
    try {
      const json = JSON.parse(decodeURIComponent(payload));
      const c = json;
      const sourceOk = c.source === "builder" || c.source === "virya";
      if (json && typeof json === "object" && c.version === 1 && sourceOk && typeof c.discipline === "string")
        return json;
    } catch {
      continue;
    }
  }
  return null;
}
function intensityLabelForContractBlock(b) {
  const lbl = (b.label ?? "").toLowerCase();
  if (/\bwarm-up\b|riscaldamento|\bwarm\b/i.test(lbl) && !/cool/.test(lbl)) return "Z1";
  if (/\bcool-down\b|defaticamento|\bcool\b/i.test(lbl)) return "Z2";
  const ch0 = (b.chart?.intensity ?? "").trim();
  if (ch0) {
    const canon = ch0.match(/\b(Z[1-7]|LT1|LT2|FatMax)\b/i);
    if (canon) return /^fatmax$/i.test(canon[1]) ? "FatMax" : canon[1].toUpperCase();
  }
  const cue = (b.intensityCue ?? "").trim();
  const m = cue.match(/\b(Z[1-7]|LT1|LT2|FatMax)\b/i);
  if (m) return /^fatmax$/i.test(m[1]) ? "FatMax" : m[1].toUpperCase();
  return "Z3";
}
function pro2BuilderContractToChartSegments(contract) {
  return pro2BuilderContractToExpandedChartSegments(contract);
}
function estimatedTssFromPro2Contract(contract) {
  const blocks = contract.blocks ?? [];
  if (blocks.length > 0) {
    const segs = pro2BuilderContractToChartSegments(contract);
    if (segs.length > 0) {
      const fromSegments = estimateTssFromSegments(segs);
      if (fromSegments > 0) return Math.round(fromSegments);
    }
  }
  const fromSummary = contract.summary?.tss;
  if (typeof fromSummary === "number" && Number.isFinite(fromSummary) && fromSummary > 0) return Math.round(fromSummary);
  return 0;
}
function effectiveDurationMinutesFromPro2Contract(contract, fallbackMinutes) {
  if (!contract) return Math.max(1, Math.round(fallbackMinutes));
  const sec = contract.summary?.durationSec;
  if (typeof sec === "number" && Number.isFinite(sec) && sec > 0) {
    return Math.max(1, Math.round(sec / 60));
  }
  const fromBlocks = (contract.blocks ?? []).reduce((s, b) => s + (Number(b.durationMinutes) || 0), 0);
  if (fromBlocks > 0) return Math.max(1, Math.round(fromBlocks));
  return Math.max(1, Math.round(fallbackMinutes));
}
function effectiveTssDisplayFromPro2Contract(contract, fallbackTss) {
  if (!contract) return Math.max(0, Math.round(fallbackTss));
  const t = estimatedTssFromPro2Contract(contract);
  return t > 0 ? t : Math.max(0, Math.round(fallbackTss));
}
var init_pro2_session_notes = __esm({
  "apps/web/lib/training/builder/pro2-session-notes.ts"() {
    "use strict";
    init_pro2_session_contract();
    init_pro2_contract_chart_segments();
    init_tss_estimate();
    init_planned_session_metrics();
  }
});

// apps/web/lib/nutrition/intelligent-meal-plan-types.ts
var MEAL_SLOT_ORDER = ["breakfast", "lunch", "dinner", "snack_am", "snack_pm"];
var MEAL_SLOT_KEYS = [...MEAL_SLOT_ORDER, "snack_evening"];
var SLOT_KEYS = [...MEAL_SLOT_KEYS];
function rescaleSlotKcalToTarget(slot, targetKcal) {
  const sum = slot.items.reduce((a, i) => a + i.approxKcal, 0);
  if (sum <= 0 || targetKcal <= 0) return slot;
  const f = targetKcal / sum;
  const items = slot.items.map((i) => ({
    ...i,
    approxKcal: Math.max(15, Math.round(i.approxKcal * f))
  }));
  let newSum = items.reduce((a, i) => a + i.approxKcal, 0);
  const drift = Math.round(targetKcal - newSum);
  if (items.length && drift !== 0) {
    const last = items.length - 1;
    items[last] = {
      ...items[last],
      approxKcal: Math.max(15, items[last].approxKcal + drift)
    };
  }
  return { ...slot, items };
}

// apps/web/lib/nutrition/routine-week-plan-meal-times.ts
function asRecord(v) {
  return v && typeof v === "object" && !Array.isArray(v) ? v : {};
}
function profileWeekDayKeyFromIsoLocal(isoDate) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return "Mon";
  const d = /* @__PURE__ */ new Date(`${isoDate}T12:00:00`);
  if (Number.isNaN(d.getTime())) return "Mon";
  const labels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return labels[d.getDay()] ?? "Mon";
}
function nonEmptyTime(v) {
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
}
function mealTimesFromRoutineWeekPlanForDate(routineConfig, isoPlanDate, flatFromRoutineRoot) {
  if (!routineConfig) return flatFromRoutineRoot;
  const wd = profileWeekDayKeyFromIsoLocal(isoPlanDate);
  const weekPlan = asRecord(routineConfig.week_plan);
  const day = asRecord(weekPlan[wd]);
  const bt = nonEmptyTime(day.breakfast_time);
  const lt = nonEmptyTime(day.lunch_time);
  const dt = nonEmptyTime(day.dinner_time);
  const st = nonEmptyTime(day.snack_time);
  const ast = nonEmptyTime(day.afternoon_snack_time);
  const nt = nonEmptyTime(day.night_time);
  if (!bt && !lt && !dt && !st && !ast && !nt) return flatFromRoutineRoot;
  return {
    breakfast: bt ?? flatFromRoutineRoot.breakfast,
    lunch: lt ?? flatFromRoutineRoot.lunch,
    dinner: dt ?? flatFromRoutineRoot.dinner,
    snack_am: st ?? flatFromRoutineRoot.snack_am,
    snack_pm: ast ?? flatFromRoutineRoot.snack_pm,
    snack_evening: nt ?? flatFromRoutineRoot.snack_evening
  };
}

// apps/web/lib/nutrition/nutrition-meal-times-training-coherence.ts
function parseLocalTimeToMinutes(t) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(t.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const mi = Number(m[2]);
  if (!Number.isFinite(h) || !Number.isFinite(mi) || h < 0 || h > 23 || mi < 0 || mi > 59) return null;
  return h * 60 + mi;
}
function formatMinutesToLocalHHmm(totalMinutes) {
  const x = (Math.round(totalMinutes) % (24 * 60) + 24 * 60) % (24 * 60);
  const h = Math.floor(x / 60);
  const mi = x % 60;
  return `${String(h).padStart(2, "0")}:${String(mi).padStart(2, "0")}`;
}

// apps/web/lib/nutrition/race-day-pre-race-lunch.ts
var RACE_DAY_PRE_RACE_LUNCH_PROTOCOL = {
  hoursBeforeRace: 3,
  carbsPerKgG: 3,
  staple: "pasta_or_rice",
  granaPadanoG: { min: 15, max: 20 },
  oliveOilG: 15
};
function getRaceDayPreRaceLunchProtocol() {
  return RACE_DAY_PRE_RACE_LUNCH_PROTOCOL;
}
var PRE_RACE_SLOT_LABEL_IT = {
  breakfast: "colazione",
  lunch: "pranzo",
  dinner: "cena",
  snack_am: "spuntino mattina",
  snack_pm: "merenda",
  snack_evening: "spuntino serale"
};
var RACE_TEXT = /\b(gara|race|competition|gran fondo|granfondo|marathon|maratona|ironman|triathlon)\b/i;
function asRecord2(v) {
  return v && typeof v === "object" && !Array.isArray(v) ? v : {};
}
function numFromUnknown(v, fallback = 0) {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  }
  return fallback;
}
function nonEmptyTime2(v) {
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
}
function textBlob(...parts) {
  return parts.map((p) => typeof p === "string" ? p : p != null ? String(p) : "").join(" ").toLowerCase();
}
function isPlannedSessionRaceLike(input) {
  if (input.routineDayMode === "race") return true;
  const blob = textBlob(input.type, input.notes, input.sessionName, input.adaptiveGoal);
  if (RACE_TEXT.test(blob)) return true;
  const t = textBlob(input.type);
  return t === "race" || t.includes("gara");
}
function inferRaceStartMinutesFromRoutine(routineConfig, planDate) {
  if (!routineConfig) return null;
  const wd = profileWeekDayKeyFromIsoLocal(planDate);
  const weekPlan = asRecord2(routineConfig.week_plan);
  const day = asRecord2(weekPlan[wd]);
  const startStr = nonEmptyTime2(day.training1_start_time) ?? nonEmptyTime2(asRecord2(routineConfig.training_1).start_time) ?? nonEmptyTime2(routineConfig.training1_start_time) ?? null;
  if (!startStr) return null;
  return parseLocalTimeToMinutes(startStr);
}
function detectPrimaryRaceSessionForDay(input) {
  const wd = profileWeekDayKeyFromIsoLocal(input.planDate);
  const weekPlan = asRecord2(input.routineConfig?.week_plan);
  const dayRoutine = asRecord2(weekPlan[wd]);
  const dayMode = nonEmptyTime2(dayRoutine.day_mode) ?? null;
  const startMinutes = inferRaceStartMinutesFromRoutine(input.routineConfig, input.planDate);
  const candidates = input.plannedSessions.map((s, idx) => {
    const durationMinutes = numFromUnknown(s.duration_minutes, 0);
    const label = String(s.sessionName ?? s.type ?? `Sessione ${idx + 1}`).trim() || `Sessione ${idx + 1}`;
    const raceLike = isPlannedSessionRaceLike({
      type: s.type,
      notes: s.notes,
      sessionName: s.sessionName,
      adaptiveGoal: s.adaptiveGoal,
      durationMinutes,
      routineDayMode: dayMode
    });
    if (!raceLike) return null;
    const start = startMinutes ?? 7 * 60 + 30;
    return {
      label,
      startMinutes: start,
      raceStartLocal: formatMinutesToLocalHHmm(start),
      durationMinutes: Math.max(durationMinutes, 0)
    };
  }).filter((c) => c != null);
  if (candidates.length === 0) {
    if (dayMode !== "race" || startMinutes == null) return null;
    return {
      label: "Gara (routine)",
      startMinutes,
      raceStartLocal: formatMinutesToLocalHHmm(startMinutes),
      durationMinutes: numFromUnknown(dayRoutine.training1_duration_minutes, 0)
    };
  }
  candidates.sort((a, b) => b.durationMinutes - a.durationMinutes || b.startMinutes - a.startMinutes);
  const best = candidates[0];
  return { ...best };
}
function computePreRaceLunchMinutes(raceStartMinutes, hoursBeforeRace) {
  return Math.max(6 * 60, raceStartMinutes - Math.round(hoursBeforeRace * 60));
}
var RACE_DAY_POST_RECOVERY_RULE = {
  choPerKgByDuration: {
    shortUnder120Min: 1,
    medium120To180Min: 1.2,
    longOver180Min: 1.5
  },
  proteinPerKgG: 0.6,
  mctPerKgG: 0.2
};
function getRaceDayPostRecoveryRule() {
  return RACE_DAY_POST_RECOVERY_RULE;
}
function choosePostRaceChoPerKg(durationMinutes, rule) {
  if (durationMinutes > 180) return rule.choPerKgByDuration.longOver180Min;
  if (durationMinutes >= 120) return rule.choPerKgByDuration.medium120To180Min;
  return rule.choPerKgByDuration.shortUnder120Min;
}
function resolvePostRaceRecoveryMealSlot(input) {
  const recoveryAt = input.raceEndMinutes + 15;
  const lunchMin = parseLocalTimeToMinutes(input.mealTimesBySlot.lunch ?? "");
  if (input.activeSlots.includes("snack_am") && lunchMin != null && recoveryAt < lunchMin - 10) {
    return "snack_am";
  }
  const candidates = input.activeSlots.map((slot) => {
    const t = parseLocalTimeToMinutes(input.mealTimesBySlot[slot] ?? "");
    return t == null ? null : { slot, minutes: t };
  }).filter((row2) => row2 != null).filter((row2) => {
    if (lunchMin != null && recoveryAt < lunchMin - 10 && row2.slot === "lunch") return false;
    return row2.minutes >= recoveryAt;
  }).sort((a, b) => a.minutes - b.minutes);
  if (candidates.length > 0) return candidates[0].slot;
  if (input.activeSlots.includes("snack_evening")) return "snack_evening";
  if (input.activeSlots.includes("dinner")) return "dinner";
  if (input.activeSlots.includes("snack_pm")) return "snack_pm";
  return input.activeSlots[0] ?? "dinner";
}
function buildRacePostRecoveryContext(input) {
  const race = detectPrimaryRaceSessionForDay({
    planDate: input.planDate,
    routineConfig: input.routineConfig,
    plannedSessions: input.plannedSessions
  });
  if (!race) return null;
  const weightKg = numFromUnknown(input.weightKg, 0);
  if (weightKg < 35) return null;
  const rule = getRaceDayPostRecoveryRule();
  const raceEndMinutes = race.startMinutes + Math.max(45, race.durationMinutes);
  const choPerKgG = choosePostRaceChoPerKg(race.durationMinutes, rule);
  const choG = Math.round(weightKg * choPerKgG);
  const proteinG = Math.round(weightKg * rule.proteinPerKgG);
  const mctG = Math.round(weightKg * rule.mctPerKgG);
  const totalKcal = Math.round(choG * 4 + proteinG * 4 + mctG * 8.3);
  const mealSlot = resolvePostRaceRecoveryMealSlot({
    raceEndMinutes,
    activeSlots: input.activeMealSlots,
    mealTimesBySlot: input.mealTimesBySlot
  });
  return {
    weightKg,
    raceLabel: race.label,
    raceEndMinutes,
    recoveryTimeLocal: formatMinutesToLocalHHmm(raceEndMinutes + 15),
    mealSlot,
    choPerKgG,
    choG,
    proteinG,
    mctG,
    totalKcal
  };
}
function rebalanceMealRowsForRacePostRecovery(rows, recoveryCtx) {
  const idx = rows.findIndex((r) => r.key === recoveryCtx.mealSlot);
  if (idx < 0) return rows;
  const next = rows.map((r) => ({ ...r }));
  const before = Math.round(next[idx].kcal);
  next[idx] = {
    ...next[idx],
    kcal: recoveryCtx.totalKcal,
    carbs: recoveryCtx.choG,
    protein: recoveryCtx.proteinG,
    fat: recoveryCtx.mctG,
    timeLocal: recoveryCtx.recoveryTimeLocal
  };
  let delta = recoveryCtx.totalKcal - before;
  if (Math.abs(delta) < 5) return next;
  const isMealSlotKey = (s) => MEAL_SLOT_KEYS.includes(s);
  const recoveryIsSnack = recoveryCtx.mealSlot.startsWith("snack");
  const candidates = next.map((row2, i) => ({ row: row2, i })).filter(({ i, row: row2 }) => i !== idx && isMealSlotKey(row2.key)).filter(({ row: row2 }) => !(recoveryIsSnack && row2.key === "lunch")).sort((a, b) => b.row.kcal - a.row.kcal);
  if (delta > 0) {
    for (const c of candidates) {
      const minKcal = c.row.key.startsWith("snack") ? 70 : 130;
      const reducible = Math.max(0, Math.round(c.row.kcal - minKcal));
      if (reducible <= 0) continue;
      const take = Math.min(delta, reducible);
      const ratio = Math.max(0.1, (c.row.kcal - take) / Math.max(1, c.row.kcal));
      c.row.kcal = Math.round(c.row.kcal - take);
      c.row.carbs = Math.round(c.row.carbs * ratio);
      c.row.protein = Math.round(c.row.protein * ratio);
      c.row.fat = Math.max(0, Math.round(c.row.fat * ratio));
      next[c.i] = { ...c.row };
      delta -= take;
      if (delta <= 0) break;
    }
  } else {
    const donor = candidates[0];
    if (donor) {
      const add = Math.abs(delta);
      const ratio = (donor.row.kcal + add) / Math.max(1, donor.row.kcal);
      donor.row.kcal = Math.round(donor.row.kcal + add);
      donor.row.carbs = Math.round(donor.row.carbs * ratio);
      donor.row.protein = Math.round(donor.row.protein * ratio);
      donor.row.fat = Math.max(0, Math.round(donor.row.fat * ratio));
      next[donor.i] = { ...donor.row };
    }
  }
  return next;
}
function resolvePreRaceMealSlot(preRaceMinutes, activeSlots) {
  const set = new Set(activeSlots);
  if (preRaceMinutes < 9 * 60 + 15 && set.has("breakfast")) return "breakfast";
  if (set.has("lunch")) return "lunch";
  if (set.has("breakfast")) return "breakfast";
  return activeSlots[0] ?? "lunch";
}
var RACE_DAY_FUELING_LEAD_MINUTES = 60;
var RACE_DAY_FUELING_TAIL_MINUTES = 60;
function computeRaceDayFuelingWindow(ctx) {
  return {
    startMinutes: ctx.raceStartMinutes - RACE_DAY_FUELING_LEAD_MINUTES,
    endMinutes: ctx.raceEndMinutes + RACE_DAY_FUELING_TAIL_MINUTES
  };
}
function computeRaceDaySuppressedSlots(input) {
  const { startMinutes, endMinutes } = computeRaceDayFuelingWindow(input.ctx);
  const out = [];
  for (const slot of input.activeSlots) {
    if (slot === input.ctx.mealSlot) continue;
    if (input.postRecoveryMealSlot && slot === input.postRecoveryMealSlot) continue;
    const t = parseLocalTimeToMinutes(input.mealTimesBySlot[slot] ?? "");
    if (t == null) continue;
    if (t >= startMinutes && t <= endMinutes) out.push(slot);
  }
  return [...new Set(out)];
}
function isRacePreRaceMealSlot(slot, ctx) {
  return Boolean(ctx && slot === ctx.mealSlot);
}
function mapPlannedSessionsForRaceDetection(sessions) {
  return sessions.map((s) => ({
    duration_minutes: s.duration_minutes,
    type: s.type,
    notes: s.notes,
    sessionName: s.plannedSessionName ?? s.builderSession?.sessionName ?? null,
    adaptiveGoal: s.plannedAdaptationTarget ?? s.builderSession?.adaptationTarget ?? null
  }));
}
function buildRacePreLunchDayContext(input) {
  const rule = getRaceDayPreRaceLunchProtocol();
  const race = detectPrimaryRaceSessionForDay({
    planDate: input.planDate,
    routineConfig: input.routineConfig,
    plannedSessions: input.plannedSessions
  });
  if (!race) return null;
  const weightKg = numFromUnknown(input.weightKg, 0);
  if (weightKg < 35) return null;
  const preRaceMealMinutes = computePreRaceLunchMinutes(race.startMinutes, rule.hoursBeforeRace);
  const activeSlots = input.activeMealSlots && input.activeMealSlots.length > 0 ? input.activeMealSlots : MEAL_SLOT_KEYS;
  const mealSlot = resolvePreRaceMealSlot(preRaceMealMinutes, activeSlots);
  const raceEndMinutes = race.startMinutes + Math.max(45, race.durationMinutes);
  const preRaceTimeLocal = formatMinutesToLocalHHmm(preRaceMealMinutes);
  return {
    weightKg,
    rule,
    raceLabel: race.label,
    raceStartLocal: race.raceStartLocal,
    lunchTimeLocal: preRaceTimeLocal,
    mealSlot,
    raceStartMinutes: race.startMinutes,
    raceEndMinutes,
    preRaceMealMinutes
  };
}
function racePreLunchContextLine(ctx) {
  const cho = Math.round(ctx.weightKg * ctx.rule.carbsPerKgG);
  const slotLabel = PRE_RACE_SLOT_LABEL_IT[ctx.mealSlot] ?? ctx.mealSlot;
  return `Protocollo pre-gara: ${slotLabel} ${ctx.lunchTimeLocal} (${ctx.rule.hoursBeforeRace} h prima di ${ctx.raceStartLocal} \xB7 ${ctx.raceLabel}) \u2014 pasta o riso ${ctx.rule.carbsPerKgG} g CHO/kg (~${cho} g), grana ${ctx.rule.granaPadanoG.min}\u2013${ctx.rule.granaPadanoG.max} g, olio ${ctx.rule.oliveOilG} g; se mancano kcal rispetto al target Diet \u2192 crostata/torta CHO (no verdure voluminose pre-gara).`;
}
function racePostRecoveryContextLine(ctx) {
  return `Recovery post-gara (${ctx.raceLabel}) nello slot ${ctx.mealSlot}: CHO ${ctx.choPerKgG.toFixed(1)} g/kg (~${ctx.choG} g), PRO 0.6 g/kg (~${ctx.proteinG} g), MCT 0.2 g/kg (~${ctx.mctG} g), totale ~${ctx.totalKcal} kcal.`;
}
var RACE_D = {
  pastaDryKcalPerG: 3.71,
  pastaDryChoPerG: 0.75,
  pastaDryProtPerG: 0.13,
  riceDryKcalPerG: 3.65,
  riceDryChoPerG: 0.8,
  riceDryProtPerG: 0.071,
  granaKcalPerG: 4,
  granaProtPerG: 0.33,
  granaFatPerG: 0.28,
  oilKcalPerMl: 8.84,
  oilFatPerMl: 1,
  crostataKcalPerG: 3.2,
  crostataChoPerG: 0.48,
  crackerKcalPerG: 4.16,
  jamKcalPerG: 2.5
};
function clampStep(n, lo, hi, step = 5) {
  const rounded = Math.round(n / step) * step;
  return Math.max(lo, Math.min(hi, rounded));
}
function item(name, portionHint, approxKcal, role, bridge) {
  return {
    name,
    portionHint,
    approxKcal: Math.max(8, Math.round(approxKcal)),
    macroRole: role,
    functionalBridge: bridge.slice(0, 500)
  };
}
function dryStapleGramsForTargetCarbs(staple, targetCarbsG) {
  const choPerG = staple === "pasta" ? RACE_D.pastaDryChoPerG : RACE_D.riceDryChoPerG;
  const raw = targetCarbsG / choPerG;
  return staple === "pasta" ? clampStep(raw, 50, 320) : clampStep(raw, 45, 300);
}
function pickPreRaceMediterraneanProtein(seed, dayCtx) {
  const diet = dayCtx?.dietType ?? "omnivore";
  let order = ["pollo", "pesce", "uova"];
  if (diet === "pescatarian") order = ["pesce", "uova", "pollo"];
  else if (diet === "vegetarian") order = ["uova", "tofu"];
  else if (diet === "vegan") order = ["tofu"];
  const deny = (dayCtx?.denyFragments ?? []).join(" ").toLowerCase();
  order = order.filter((p) => {
    if (p === "pollo" && /\b(pollo|chicken|tacchino|turkey)\b/.test(deny)) return false;
    if (p === "pesce" && /\b(pesce|fish|salmone|merluzzo)\b/.test(deny)) return false;
    if (p === "uova" && /\b(uov|egg)\b/.test(deny)) return false;
    if (p === "tofu" && /\btofu\b/.test(deny)) return false;
    return true;
  });
  const pool = order.length ? order : ["uova"];
  return pool[Math.abs(seed + 5) % pool.length] ?? "uova";
}
function preRaceMediterraneanProteinItem(kind, seed) {
  switch (kind) {
    case "pollo":
      return item(
        "Petto di pollo o tacchino",
        `${clampStep(70 + seed % 3 * 10, 65, 95, 5)} g petto di pollo/tacchino (cottura semplice)`,
        120,
        "protein",
        "Pre-gara mediterraneo: proteina magra digeribile prima dello sforzo."
      );
    case "pesce":
      return item(
        "Pesce bianco",
        `${clampStep(80 + seed % 2 * 15, 75, 110, 5)} g merluzzo o pesce bianco (al vapore/padella)`,
        95,
        "protein",
        "Pre-gara mediterraneo: pesce magro, basso carico lipidico."
      );
    case "tofu":
      return item(
        "Tofu",
        `${clampStep(90 + seed % 2 * 15, 80, 120, 10)} g tofu compatto`,
        110,
        "protein",
        "Pre-gara mediterraneo: proteina vegetale."
      );
    default:
      return item(
        "Uova",
        `${2 + seed % 2} uova medie (\u2248${clampStep(100 + seed % 2 * 25, 100, 130, 25)} g, strapazzate)`,
        140,
        "protein",
        "Pre-gara mediterraneo: uova, fonte proteica classica."
      );
  }
}
function pickRacePreLunchStaple(seed, ctx) {
  const order = [];
  const deny = ctx?.denyFragments ?? [];
  const denyText = deny.join(" ").toLowerCase();
  if (!/\bpasta\b|\bglut/i.test(denyText)) order.push("pasta");
  if (!/\briso\b|\brice/i.test(denyText)) order.push("riso");
  const pool = order.length ? order : ["riso"];
  return pool[Math.abs(seed) % pool.length] ?? "pasta";
}
var RACE_PRE_RACE_KCAL_TOPUP_MIN = 60;
function denyHit(fragments, deny) {
  if (!deny?.length) return false;
  const blob = deny.join(" ").toLowerCase();
  return fragments.some((f) => blob.includes(f.toLowerCase()));
}
function buildRacePreRaceKcalTopUpItem(gapKcal, seed, denyFragments) {
  if (gapKcal < RACE_PRE_RACE_KCAL_TOPUP_MIN) return null;
  const glutenBlocked = denyHit(["glutine", "gluten", "frumento", "wheat"], denyFragments);
  if (!glutenBlocked) {
    const useTorta = Math.abs(seed) % 2 === 1;
    const label = useTorta ? "Torta semplice" : "Crostata di mela";
    const portionLabel = useTorta ? "torta semplice (porzione CHO pre-gara)" : "crostata di mela (porzione CHO pre-gara)";
    const g = clampStep(gapKcal / RACE_D.crostataKcalPerG, 55, 190);
    const kcal2 = Math.round(g * RACE_D.crostataKcalPerG);
    return item(
      label,
      `${g} g ${portionLabel}`,
      kcal2,
      "cho_heavy",
      "Protocollo pre-gara: top-up kcal slot Diet con dolce CHO digeribile (no verdure voluminose)."
    );
  }
  if (denyHit(["marmellat", "jam"], denyFragments)) return null;
  const jamG = clampStep(gapKcal * 0.35 / RACE_D.jamKcalPerG, 25, 55);
  const ruskG = clampStep((gapKcal - jamG * RACE_D.jamKcalPerG) / RACE_D.crackerKcalPerG, 30, 80);
  const kcal = Math.round(jamG * RACE_D.jamKcalPerG + ruskG * RACE_D.crackerKcalPerG);
  return item(
    "Fette biscottate e marmellata",
    `${ruskG} g fette biscottate + ${jamG} g marmellata (CHO pre-gara)`,
    kcal,
    "cho_heavy",
    "Protocollo pre-gara: top-up kcal senza glutine \u2014 CHO rapido, no verdure."
  );
}
function composeRacePreLunchMainMeal(slot, m, seed, raceCtx, dayCtx) {
  const rule = raceCtx.rule;
  const targetCarbsG = Math.max(40, Math.round(raceCtx.weightKg * rule.carbsPerKgG));
  const staple = pickRacePreLunchStaple(seed, dayCtx);
  const carbG = dryStapleGramsForTargetCarbs(staple, targetCarbsG);
  const granaG = clampStep(
    rule.granaPadanoG.min + Math.abs(seed) % Math.max(1, rule.granaPadanoG.max - rule.granaPadanoG.min + 1),
    rule.granaPadanoG.min,
    rule.granaPadanoG.max,
    1
  );
  const oilG = rule.oliveOilG;
  const oilMl = Math.round(oilG / 0.92);
  const carbLine = staple === "pasta" ? `${carbG} g pasta secca (peso a crudo) \u2014 ~${targetCarbsG} g CHO (${rule.carbsPerKgG} g/kg)` : `${carbG} g riso (peso a crudo) \u2014 ~${targetCarbsG} g CHO (${rule.carbsPerKgG} g/kg)`;
  const carbKcal = carbG * (staple === "pasta" ? RACE_D.pastaDryKcalPerG : RACE_D.riceDryKcalPerG);
  const items = [
    item(
      staple === "pasta" ? "Pasta" : "Riso",
      carbLine,
      carbKcal,
      "cho_heavy",
      "Protocollo pre-gara: amido complesso a densit\xE0 CHO/kg (canonico piattaforma)."
    ),
    item(
      "Grana Padano",
      `${granaG} g grana grattugiato`,
      granaG * RACE_D.granaKcalPerG,
      "protein",
      "Protocollo pre-gara: grana 15\u201320 g."
    ),
    preRaceMediterraneanProteinItem(pickPreRaceMediterraneanProtein(seed, dayCtx), seed),
    item(
      "Olio extravergine d'oliva",
      `${oilG} g olio EVO (~${oilMl} ml)`,
      oilMl * RACE_D.oilKcalPerMl,
      "fat",
      "Protocollo pre-gara: olio 15 g."
    )
  ];
  const usedKcal = items.reduce((s, i) => s + i.approxKcal, 0);
  const gapKcal = m.kcal - usedKcal;
  const topUp = buildRacePreRaceKcalTopUpItem(gapKcal, seed, dayCtx?.denyFragments);
  if (topUp) items.push(topUp);
  const lines = items.map((i) => i.portionHint);
  const totalApproxKcal = items.reduce((s, i) => s + i.approxKcal, 0);
  return {
    items,
    lines,
    totalApproxKcal
  };
}
function isSnackMealSlot(slot) {
  return slot === "snack_am" || slot === "snack_pm" || slot === "snack_evening";
}
function composeMediterraneanPostWorkoutSnackMeal(ctx, seed, dayCtx) {
  const deny = (dayCtx?.denyFragments ?? []).join(" ").toLowerCase();
  const useBanana = !/\bbanana\b/.test(deny) && Math.abs(seed) % 2 === 0;
  const choItem = useBanana ? item(
    "Banana",
    `${clampStep(Math.max(80, Math.round(ctx.choG * 0.55)), 80, 140, 10)} g banana matura`,
    Math.round(ctx.choG * 0.55 * 4),
    "cho_heavy",
    "Post-workout: CHO rapido nello spuntino (pranzo alle 13 resta pasto completo)."
  ) : item(
    "Riso bianco (post-workout)",
    `${Math.max(45, Math.round(ctx.choG * 0.55 / 0.8))} g riso cotto`,
    Math.round(ctx.choG * 0.55 * 4),
    "cho_heavy",
    "Post-workout: riso leggero nello spuntino."
  );
  const proteinItem = preRaceMediterraneanProteinItem(
    pickPreRaceMediterraneanProtein(seed + 11, dayCtx),
    seed + 3
  );
  proteinItem.approxKcal = Math.max(80, Math.round(ctx.proteinG * 3.5));
  const items = [choItem, proteinItem];
  return {
    items,
    lines: items.map((i) => i.portionHint),
    totalApproxKcal: items.reduce((s, i) => s + i.approxKcal, 0)
  };
}
function composeRacePostRecoveryMeal(slot, seed, ctx, dayCtx) {
  if (isSnackMealSlot(slot)) {
    return composeMediterraneanPostWorkoutSnackMeal(ctx, seed, dayCtx);
  }
  const deny = (dayCtx?.denyFragments ?? []).join(" ").toLowerCase();
  const preferRice = /\briso\b|\brice\b/.test(deny) ? false : Math.abs(seed) % 2 === 0;
  const choItem = preferRice ? item(
    "Riso bianco (post-gara)",
    `${Math.max(70, Math.round(ctx.choG / 0.8))} g riso (peso a crudo) per ~${ctx.choG} g CHO`,
    ctx.choG * 4,
    "cho_heavy",
    "Recovery post-gara: CHO rapidi/medi per ripristino glicogeno."
  ) : item(
    "Carbo Recovery Mix",
    `${ctx.choG} g CHO da miscela carbo recovery`,
    ctx.choG * 4,
    "cho_heavy",
    "Recovery post-gara: miscela carbo ad alta disponibilita."
  );
  const proteinKind = pickPreRaceMediterraneanProtein(seed + 7, dayCtx);
  const proteinItem = preRaceMediterraneanProteinItem(proteinKind, seed);
  proteinItem.approxKcal = Math.max(100, Math.round(ctx.proteinG * 4));
  proteinItem.functionalBridge = "Recovery post-gara: proteina mediterranea (carne/pesce/uova).";
  const mctItem = item(
    "MCT oil",
    `${ctx.mctG} g MCT oil`,
    Math.round(ctx.mctG * 8.3),
    "fat",
    "Recovery post-gara: quota lipidica rapida da MCT."
  );
  const items = [choItem, proteinItem, mctItem];
  return {
    items,
    lines: items.map((i) => i.portionHint),
    totalApproxKcal: items.reduce((sum, i) => sum + i.approxKcal, 0)
  };
}

// apps/web/lib/nutrition/routine-race-day-context.ts
function asRecord3(v) {
  return v && typeof v === "object" && !Array.isArray(v) ? v : {};
}
function numFromUnknown2(v, fallback = 0) {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  }
  return fallback;
}
function nonEmptyTime3(v) {
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
}
function detectRoutineRaceDay(input) {
  const rc = input.routineConfig;
  if (!rc) return null;
  const wd = profileWeekDayKeyFromIsoLocal(input.planDate);
  const day = asRecord3(asRecord3(rc.week_plan)[wd]);
  const dayMode = String(day.day_mode ?? "").toLowerCase();
  if (dayMode !== "race") return null;
  const startTimeLocal = nonEmptyTime3(day.training1_start_time) ?? nonEmptyTime3(asRecord3(rc.training_1).start_time) ?? nonEmptyTime3(rc.training1_start_time) ?? null;
  if (!startTimeLocal) return null;
  const durationMinutes = Math.max(
    30,
    numFromUnknown2(day.training1_duration_minutes, numFromUnknown2(day.training2_duration_minutes, 120))
  );
  return {
    label: "Gara (routine)",
    startTimeLocal,
    durationMinutes
  };
}
function buildRoutineSyntheticPlannedSessionsForRaceDetection(input) {
  const race = detectRoutineRaceDay(input);
  if (!race) return [];
  return [
    {
      duration_minutes: race.durationMinutes,
      type: "race",
      sessionName: race.label,
      adaptiveGoal: "race"
    }
  ];
}

// apps/web/lib/nutrition/enrich-meal-plan-request-race-day.ts
init_pro2_session_notes();
function coerceDbNumeric(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value.trim());
    return Number.isFinite(n) ? n : null;
  }
  return null;
}
function asRecord4(v) {
  return v && typeof v === "object" && !Array.isArray(v) ? v : null;
}
function notesForBuilderParse(v) {
  return typeof v === "string" ? v : null;
}
function plannedSessionsForRaceFromDbRows(rows) {
  const mapped = rows.map((row2) => {
    const bs = parsePro2BuilderSessionFromNotes(notesForBuilderParse(row2.notes));
    return {
      duration_minutes: row2.duration_minutes,
      type: row2.type,
      notes: row2.notes,
      sessionName: bs?.sessionName ?? null,
      adaptiveGoal: bs?.adaptationTarget ?? null
    };
  });
  return mapPlannedSessionsForRaceDetection(mapped);
}
function enrichIntelligentMealPlanRequestWithRaceDay(input) {
  const routine = asRecord4(input.routineConfig);
  const weightKg = coerceDbNumeric(input.weightKg);
  const planned = input.plannedSessions.length > 0 ? input.plannedSessions : buildRoutineSyntheticPlannedSessionsForRaceDetection({
    routineConfig: routine,
    planDate: input.request.planDate
  });
  const activeSlots = input.request.slots.map((s) => s.slot);
  const racePreLunch = buildRacePreLunchDayContext({
    weightKg,
    planDate: input.request.planDate,
    routineConfig: routine,
    plannedSessions: planned,
    activeMealSlots: activeSlots
  });
  if (!racePreLunch) {
    return input.request;
  }
  const contextLine = racePreLunchContextLine(racePreLunch);
  const contextLines = [
    ...input.request.contextLines.filter((l) => !l.includes("Protocollo pre-gara")),
    contextLine
  ];
  let slots = input.request.slots.map(
    (slot) => slot.slot === racePreLunch.mealSlot ? { ...slot, scheduledTimeLocal: racePreLunch.lunchTimeLocal } : slot
  );
  const mealTimesBySlot = Object.fromEntries(
    slots.map((s) => [s.slot, s.scheduledTimeLocal])
  );
  const racePostRecovery = buildRacePostRecoveryContext({
    weightKg,
    planDate: input.request.planDate,
    routineConfig: routine,
    plannedSessions: planned,
    activeMealSlots: activeSlots,
    mealTimesBySlot
  });
  if (racePostRecovery) {
    const rows = slots.map((s) => ({
      key: s.slot,
      label: s.labelIt,
      kcal: s.targetKcal,
      carbs: s.targetCarbsG,
      protein: s.targetProteinG,
      fat: s.targetFatG,
      timeLocal: s.scheduledTimeLocal
    }));
    const rebalanced = rebalanceMealRowsForRacePostRecovery(rows, racePostRecovery);
    const byKey = new Map(rebalanced.map((r) => [r.key, r]));
    slots = slots.map((slot) => {
      const row2 = byKey.get(slot.slot);
      if (!row2) return slot;
      return {
        ...slot,
        scheduledTimeLocal: row2.timeLocal,
        targetKcal: Math.max(50, Math.round(row2.kcal)),
        targetCarbsG: Math.max(0, Math.round(row2.carbs)),
        targetProteinG: Math.max(0, Math.round(row2.protein)),
        targetFatG: Math.max(0, Math.round(row2.fat))
      };
    });
  }
  const mealTimesFinal = Object.fromEntries(
    slots.map((s) => [s.slot, s.scheduledTimeLocal])
  );
  const raceSuppressed = computeRaceDaySuppressedSlots({
    ctx: racePreLunch,
    activeSlots,
    mealTimesBySlot: mealTimesFinal,
    postRecoveryMealSlot: racePostRecovery?.mealSlot ?? null
  });
  const suppressedSlots = [.../* @__PURE__ */ new Set([...input.request.suppressedSlots ?? [], ...raceSuppressed])];
  const integrationLeverLines = [
    ...input.request.mealPlanSolverMeta?.integrationLeverLines ?? [],
    `Protocollo pre-gara attivo (${racePreLunch.mealSlot} ${racePreLunch.lunchTimeLocal} \xB7 routine race).`,
    ...racePostRecovery ? [
      `Recovery post-gara (${racePostRecovery.mealSlot} ~${racePostRecovery.recoveryTimeLocal} \xB7 CHO ${racePostRecovery.choPerKgG} g/kg).`
    ] : []
  ].slice(0, 16);
  return {
    ...input.request,
    slots,
    postWorkoutMealBySlot: racePostRecovery ? { [racePostRecovery.mealSlot]: true } : input.request.postWorkoutMealBySlot,
    contextLines: [
      ...contextLines,
      ...racePostRecovery ? [racePostRecoveryContextLine(racePostRecovery)] : []
    ],
    racePreLunch,
    racePostRecovery: racePostRecovery ?? void 0,
    suppressedSlots: suppressedSlots.length ? suppressedSlots : void 0,
    mealPlanSolverMeta: {
      ...input.request.mealPlanSolverMeta,
      integrationLeverLines
    }
  };
}

// apps/web/lib/nutrition/meal-plan-profile-food-filter.ts
var PHRASE_TO_DENY_FRAGMENTS = [
  { match: /lattos|lactose|latteos|dairy|casein|caseina/i, fragments: [
    "latte",
    "lactose",
    "yogurt",
    "yoghurt",
    "ricotta",
    "mascarpone",
    "mozzarella",
    "parmigiano",
    "pecorino",
    "formaggio",
    "burro",
    "panna",
    "cream",
    "whey",
    "siero",
    "cottage",
    "kefir",
    "latticino"
  ] },
  { match: /glutin|gluten|celiac|celiaca|celiachia/i, fragments: [
    "glutine",
    "gluten",
    "grano",
    "wheat",
    "orzo",
    "barley",
    "segale",
    "rye",
    "farro",
    "spelt",
    "kamut",
    "triticale",
    "semola",
    "couscous",
    "bulgur",
    "frumento"
  ] },
  { match: /uov|egg|ovo/i, fragments: ["uov", "ovo", "album", "egg", "mayo", "maionese"] },
  { match: /arachid|peanut|groundnut/i, fragments: ["arachid", "peanut", "groundnut"] },
  {
    match: /frutta\s*a\s*guscio|tree\s*nut|nocciol|mandorl|noci\b|nocciole|pistacch|anacard|macadamia|pecan/i,
    fragments: ["mandorl", "nocciole", "noci", "pistacch", "anacard", "macadamia", "pecan", "noce "]
  },
  { match: /soia|soy|soja/i, fragments: ["soia", "soy", "soja", "tofu", "edamame", "miso"] },
  { match: /pesce|fish\b|ittic/i, fragments: ["pesce", "fish", "tonno", "salmone", "sgombro", "acciug", "merluzz", "gamber", "gambero", "calamar", "polpo", "cozze", "ostric"] },
  { match: /crostace|shellfish|mollusc/i, fragments: ["gamber", "aragost", "granchio", "cozze", "ostric", "calamar", "polpo"] },
  { match: /sesam|sesamo/i, fragments: ["sesam", "sesamo", "tahin"] },
  { match: /senap|mustard/i, fragments: ["senap", "mustard"] },
  { match: /sedan|celery|sedano/i, fragments: ["sedan", "celery", "sedano"] },
  { match: /lupin/i, fragments: ["lupin"] },
  { match: /mais|corn\b/i, fragments: ["mais", "corn", "cornmeal", "polenta"] }
];
var DIET_DENY = {
  vegan: [
    "pollo",
    "tacchino",
    "manzo",
    "maiale",
    "agnello",
    "prosciutto",
    "salame",
    "salsicc",
    "carne",
    "bresaola",
    "cotechino",
    "wurstel",
    "bacon",
    "pancetta",
    "pesce",
    "tonno",
    "salmone",
    "sgombro",
    "acciug",
    "merluzz",
    "gamber",
    "gambero",
    "calamar",
    "polpo",
    "cozze",
    "ostric",
    "uov",
    "ovo",
    "album",
    /** Latticini animali: NON includere "yogurt"/"yoghurt"/"latte"/"kefir" generici qui:
     *  il composer vegan emette "Yogurt vegetale", "Bevanda vegetale" che sono OK e
     *  contengono ancora le sottostringhe "yogurt"/"latte". La logica `breakfastDairyBlocked`
     *  + `dietType==="vegan"` nel composer redirige gia' allo specifico vegetale. */
    "formaggio",
    "burro",
    "panna",
    "ricotta",
    "parmigiano",
    "mozzarella",
    "mascarpone",
    "pecorino",
    "whey",
    "cottage",
    /** "Latte vaccino", "Latte di capra" usano specifico: il dietType="vegan" del composer
     *  filtra il pool BREAKFAST_BEVERAGES.animal=true a monte. */
    "latte vaccino",
    "latte di capra",
    "latte di pecora",
    "latte di mucca",
    "yogurt vaccino",
    "yogurt greco",
    "yogurt animale",
    "miele",
    "honey",
    "gelatina",
    "gelatin"
  ],
  vegetarian: [
    "pollo",
    "tacchino",
    "manzo",
    "maiale",
    "agnello",
    "prosciutto",
    "salame",
    "salsicc",
    "carne",
    "bresaola",
    "cotechino",
    "wurstel",
    "bacon",
    "pancetta",
    "pesce",
    "tonno",
    "salmone",
    "sgombro",
    "acciug",
    "merluzz",
    "gamber",
    "gambero",
    "calamar",
    "polpo",
    "cozze",
    "ostric"
  ],
  pescatarian: [
    "pollo",
    "tacchino",
    "manzo",
    "maiale",
    "agnello",
    "prosciutto",
    "salame",
    "salsicc",
    "carne",
    "bresaola",
    "cotechino",
    "wurstel",
    "bacon",
    "pancetta"
  ]
};
function normalizePhrase(s) {
  return s.trim().toLowerCase();
}
function collectFragmentsFromUserList(entries, out) {
  for (const raw of entries ?? []) {
    const phrase = normalizePhrase(String(raw));
    if (phrase.length < 2) continue;
    out.add(phrase);
    for (const row2 of PHRASE_TO_DENY_FRAGMENTS) {
      if (row2.match.test(phrase)) {
        for (const f of row2.fragments) out.add(f);
      }
    }
  }
}
function dietDenyFragments(dietType) {
  const d = normalizePhrase(dietType ?? "");
  if (!d || d === "omnivore" || d === "other") return [];
  if (d === "vegan") return [...DIET_DENY.vegan];
  if (d === "vegetarian") return [...DIET_DENY.vegetarian];
  if (d === "pescatarian") return [...DIET_DENY.pescatarian];
  if (d.includes("vegan")) return [...DIET_DENY.vegan];
  if (d.includes("veget")) return [...DIET_DENY.vegetarian];
  if (d.includes("pesc")) return [...DIET_DENY.pescatarian];
  return [];
}
function buildMealPlanFoodDenyFragments(req) {
  const set = /* @__PURE__ */ new Set();
  collectFragmentsFromUserList(req.allergies ?? void 0, set);
  collectFragmentsFromUserList(req.intolerances ?? void 0, set);
  collectFragmentsFromUserList(req.foodExclusions ?? void 0, set);
  for (const f of dietDenyFragments(req.dietType)) set.add(f);
  return [...set].filter((s) => s.length >= 2);
}
function textMatchesDeny(text, fragments) {
  const t = text.toLowerCase();
  return fragments.some((f) => t.includes(f));
}
function readExcludedFdcIds(nutritionConfig) {
  const rec = nutritionConfig && typeof nutritionConfig === "object" && !Array.isArray(nutritionConfig) ? nutritionConfig : null;
  const raw = rec?.excluded_fdc_foods;
  if (!Array.isArray(raw)) return [];
  const out = [];
  const seen = /* @__PURE__ */ new Set();
  for (const item2 of raw) {
    if (!item2 || typeof item2 !== "object") continue;
    const r = item2;
    const id = Number(r.fdcId ?? r.fdc_id);
    if (!Number.isFinite(id) || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}
function readExcludedFoodLabels(nutritionConfig) {
  const rec = nutritionConfig && typeof nutritionConfig === "object" && !Array.isArray(nutritionConfig) ? nutritionConfig : null;
  const raw = rec?.excluded_fdc_foods;
  if (!Array.isArray(raw)) return [];
  const out = [];
  const seen = /* @__PURE__ */ new Set();
  for (const item2 of raw) {
    if (!item2 || typeof item2 !== "object") continue;
    const r = item2;
    const label = String(r.label ?? "").trim();
    if (!label) continue;
    const key = label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(label);
  }
  return out;
}
function optionAllowed(o, fragments, excludedFdcIds) {
  if (o.fdcId != null && excludedFdcIds.has(o.fdcId)) return false;
  if (textMatchesDeny(o.label, fragments)) return false;
  if (o.rationale && textMatchesDeny(o.rationale, fragments)) return false;
  return true;
}
function filterGroup(g, fragments, excludedFdcIds) {
  const options = g.options.filter((o) => optionAllowed(o, fragments, excludedFdcIds));
  if (options.length === 0) return null;
  return { ...g, options };
}
function filterSlot(slot, fragments, excludedFdcIds) {
  const groups = slot.functionalFoodGroups.map((g) => filterGroup(g, fragments, excludedFdcIds)).filter((g) => g != null);
  const nutrientIds = new Set(groups.map((g) => g.nutrientId));
  const functionalTargets = slot.functionalTargets.filter((t) => nutrientIds.has(t.nutrientId));
  const foodCandidates = slot.foodCandidates.filter((c) => !textMatchesDeny(c, fragments));
  return {
    ...slot,
    functionalFoodGroups: groups,
    functionalTargets,
    foodCandidates: [...new Set(foodCandidates)]
  };
}
function filterIntelligentMealPlanRequestFoods(req) {
  const fragments = buildMealPlanFoodDenyFragments(req);
  const excludedFdcIds = new Set((req.excludedFdcIds ?? []).filter((n) => Number.isFinite(n)));
  if (fragments.length === 0 && excludedFdcIds.size === 0) return req;
  return {
    ...req,
    slots: req.slots.map((s) => filterSlot(s, fragments, excludedFdcIds))
  };
}

// apps/web/lib/nutrition/meal-slot-food-rules.ts
var LIGHT_SLOTS = /* @__PURE__ */ new Set(["breakfast", "snack_am", "snack_pm", "snack_evening"]);
var BREAKFAST_SNACK_DENY_FRAGMENTS = [
  "lenticch",
  "lentil",
  "ceci",
  "chickpea",
  "fagiol",
  "bean",
  "beans",
  "pisell",
  // piselli
  "hummus",
  "cicerch",
  "legum",
  "black eyed",
  "spinaci",
  "spinach",
  "bietol",
  "chard",
  "cicoria",
  "chicory",
  "rucola",
  "arugula",
  "rocket",
  "cavolf",
  "broccol",
  "broccoli",
  "verza",
  "cavolo",
  "cabbage",
  "kale",
  "songino",
  "valerian",
  "patat",
  "potato",
  "barbabiet",
  "beetroot",
  "beet ",
  "pasta",
  "carbonara",
  "lasagn",
  "gnocch",
  "risotto",
  "raviol",
  "tortell",
  "cannellon",
  "couscous",
  "polenta",
  "melanz",
  "eggplant",
  "zucchin",
  "carciof",
  "artichoke",
  "verdure miste",
  "insalata verde",
  "peanut flour",
  // Pesce “da conserva / secondo” (colazione/spuntino: ok salmone/affumicato se in allow)
  "tonno",
  "tuna",
  "sgombro",
  "mackerel",
  "sardine",
  "sardina",
  "acciug",
  "anchov",
  "merluzz",
  "filetto di merluzz",
  // Carni da piatto principale (ok salumi in allow: bresaola, prosciutto, speck)
  "pollo",
  "chicken",
  "tacchino",
  "turkey",
  "petto di",
  "manzo",
  "beef",
  "maiale",
  "pork",
  "agnello",
  "lamb"
];
var BREAKFAST_SNACK_ALLOW_FRAGMENTS = [
  "bresaola",
  "prosciutto",
  "speck",
  "salame",
  "mortadella",
  // borderline snack
  "salmone",
  "salmon",
  "affumicat",
  "uov",
  "egg",
  "pane",
  "bread",
  "toast",
  "cereal",
  "avena",
  "oat",
  "muesli",
  "latte",
  "milk",
  "yogurt",
  "yoghurt",
  "ricotta",
  "cottage",
  "frutta",
  "fruit",
  "banana",
  "mela",
  "apple",
  "mirtill",
  "berry",
  "berries",
  "kiwi",
  "arancia",
  "orange",
  "mandorl",
  "almond",
  "cracker",
  "grissin",
  "burro",
  "marmellat",
  "jam",
  "honey",
  "miele",
  "whey",
  "proteina in polvere",
  "protein powder"
];
function labelLower(label) {
  return label.trim().toLowerCase();
}
var BREAKFAST_ONLY_DENY_FRAGMENTS = [
  "olio d'oliva",
  "olio d\u2019oliva",
  "olio evo",
  "extra virgin",
  "olive ",
  "olives",
  "oliva da tavola"
];
function isFoodLabelAllowedInMealSlot(label, slot) {
  if (!LIGHT_SLOTS.has(slot)) return true;
  const t = labelLower(label);
  if (BREAKFAST_SNACK_ALLOW_FRAGMENTS.some((a) => t.includes(a))) return true;
  if (slot === "breakfast" && BREAKFAST_ONLY_DENY_FRAGMENTS.some((d) => t.includes(d))) return false;
  return !BREAKFAST_SNACK_DENY_FRAGMENTS.some((d) => t.includes(d));
}
function filterFoodOptionRefsForMealSlot(options, slot) {
  return options.filter((o) => isFoodLabelAllowedInMealSlot(o.label, slot));
}
function filterFunctionalFoodGroupsForMealSlot(groups, slot) {
  return groups.map((g) => {
    const options = filterFoodOptionRefsForMealSlot(g.options, slot);
    if (options.length === 0) return null;
    return { ...g, options };
  }).filter((g) => g != null);
}
function filterMealPlanSlotRow(row2) {
  const groups = filterFunctionalFoodGroupsForMealSlot(row2.functionalFoodGroups, row2.slot);
  const nutrientIds = new Set(groups.map((g) => g.nutrientId));
  const functionalTargets = row2.functionalTargets.filter((t) => nutrientIds.has(t.nutrientId));
  const foodCandidates = row2.foodCandidates.filter((c) => isFoodLabelAllowedInMealSlot(c, row2.slot));
  return {
    ...row2,
    functionalFoodGroups: groups,
    functionalTargets,
    foodCandidates: [...new Set(foodCandidates)]
  };
}
function applyMealSlotRulesToIntelligentMealPlanRequest(req) {
  return {
    ...req,
    slots: req.slots.map((s) => filterMealPlanSlotRow(s))
  };
}

// apps/web/lib/nutrition/diet-meal-slot-budgets.ts
function resolveSixMealSnackPercentages(dist) {
  const am = dist.snack_am;
  const pm = dist.snack_pm;
  const ev = dist.snack_evening;
  const hasExplicit = am != null && Number.isFinite(am) || pm != null && Number.isFinite(pm) || ev != null && Number.isFinite(ev);
  if (hasExplicit) {
    const snack_am = am ?? 0;
    const snack_pm = pm ?? 0;
    const snack_evening = ev ?? 0;
    const snacksTotal = snack_am + snack_pm + snack_evening;
    return { snack_am, snack_pm, snack_evening, snacksTotal };
  }
  const mains = dist.breakfast + dist.lunch + dist.dinner;
  const s = dist.snacks;
  if (s > 0 && s * 3 + mains <= 100.5) {
    return { snack_am: s, snack_pm: s, snack_evening: s, snacksTotal: s * 3 };
  }
  const third = s / 3;
  return { snack_am: third, snack_pm: third, snack_evening: third, snacksTotal: s };
}
function round0(v) {
  return Math.round(v);
}
function normalizeCaloricDistribution(dist) {
  const sum = dist.breakfast + dist.lunch + dist.dinner + dist.snacks;
  if (sum <= 0) return dist;
  if (Math.abs(sum - 100) < 0.05) return dist;
  const f = 100 / sum;
  return {
    breakfast: dist.breakfast * f,
    lunch: dist.lunch * f,
    dinner: dist.dinner * f,
    snacks: dist.snacks * f
  };
}
function redistributeSnacksOntoMains(dist) {
  const mainSum = dist.breakfast + dist.lunch + dist.dinner;
  if (mainSum <= 0) return { breakfast: 100 / 3, lunch: 100 / 3, dinner: 100 / 3 };
  const extra = dist.snacks;
  const scale = (mainSum + extra) / mainSum;
  return {
    breakfast: dist.breakfast * scale,
    lunch: dist.lunch * scale,
    dinner: dist.dinner * scale
  };
}
function dietMealSlotSpecsForMode(mealCountMode) {
  const m = String(mealCountMode ?? "").trim();
  const dist = (d, fn) => fn(d);
  if (m === "1") {
    return [{ key: "dinner", label: "Cena", pct: () => 100 }];
  }
  if (m === "2") {
    const mains = (d) => redistributeSnacksOntoMains(d);
    return [
      { key: "lunch", label: "Pranzo", pct: (d) => dist(d, (x) => mains(x).lunch) },
      { key: "dinner", label: "Cena", pct: (d) => dist(d, (x) => mains(x).dinner) }
    ];
  }
  if (m === "3") {
    const mains = (d) => redistributeSnacksOntoMains(d);
    return [
      { key: "breakfast", label: "Colazione", pct: (d) => dist(d, (x) => mains(x).breakfast) },
      { key: "lunch", label: "Pranzo", pct: (d) => dist(d, (x) => mains(x).lunch) },
      { key: "dinner", label: "Cena", pct: (d) => dist(d, (x) => mains(x).dinner) }
    ];
  }
  if (m === "4") {
    return [
      { key: "breakfast", label: "Colazione", pct: (d) => d.breakfast },
      { key: "lunch", label: "Pranzo", pct: (d) => d.lunch },
      { key: "dinner", label: "Cena", pct: (d) => d.dinner },
      { key: "snack_am", label: "Spuntino", pct: (d) => d.snacks }
    ];
  }
  if (m === "6") {
    const snackPct = (which) => (d) => {
      const r = resolveSixMealSnackPercentages(d);
      if (which === "am") return r.snack_am;
      if (which === "pm") return r.snack_pm;
      return r.snack_evening;
    };
    return [
      { key: "breakfast", label: "Colazione", pct: (d) => d.breakfast },
      { key: "snack_am", label: "Spuntino \xB7 mattina", pct: snackPct("am") },
      { key: "lunch", label: "Pranzo", pct: (d) => d.lunch },
      { key: "snack_pm", label: "Spuntino \xB7 pomeriggio", pct: snackPct("pm") },
      { key: "dinner", label: "Cena", pct: (d) => d.dinner },
      { key: "snack_evening", label: "Spuntino \xB7 serale", pct: snackPct("evening") }
    ];
  }
  const half = (d) => d.snacks / 2;
  return [
    { key: "breakfast", label: "Colazione", pct: (d) => d.breakfast },
    { key: "snack_am", label: "Spuntino \xB7 mattina", pct: half },
    { key: "lunch", label: "Pranzo", pct: (d) => d.lunch },
    { key: "snack_pm", label: "Spuntino \xB7 pomeriggio", pct: half },
    { key: "dinner", label: "Cena", pct: (d) => d.dinner }
  ];
}
function buildDietMealSlotBudgets(input) {
  const round6 = input.round ?? round0;
  const dist = normalizeCaloricDistribution(input.caloricDistribution);
  const specs = dietMealSlotSpecsForMode(input.mealCountMode);
  const t = input.mealTimes;
  const timeFor = (key) => {
    switch (key) {
      case "breakfast":
        return t.breakfast;
      case "lunch":
        return t.lunch;
      case "dinner":
        return t.dinner;
      case "snack_am":
        return t.snack_am;
      case "snack_pm":
        return t.snack_pm;
      case "snack_evening":
        return t.snack_evening?.trim() || "22:00";
      default:
        return "12:00";
    }
  };
  return specs.map((spec) => {
    const pct = spec.pct(dist);
    const kcal = input.dailyKcal * pct / 100;
    const macro = input.macroSplit;
    return {
      key: spec.key,
      label: spec.label,
      pct,
      time: timeFor(spec.key),
      kcal: round6(kcal),
      carbs: round6(kcal * (macro.carbs / 100) / 4),
      protein: round6(kcal * (macro.protein / 100) / 4),
      fat: round6(kcal * (macro.fat / 100) / 9)
    };
  });
}

// apps/web/lib/nutrition/resolve-nutrition-diet-day.ts
function asRecord5(v) {
  return v && typeof v === "object" && !Array.isArray(v) ? v : {};
}
function parseNutritionConfigRecord(nutritionConfig) {
  if (typeof nutritionConfig === "string") {
    const t = nutritionConfig.trim();
    if (!t) return {};
    try {
      return asRecord5(JSON.parse(t));
    } catch {
      return {};
    }
  }
  return asRecord5(nutritionConfig);
}
function distributionImpliesSixMeals(dist, dayRaw) {
  const cal = asRecord5(dayRaw?.caloric_distribution);
  if (num(cal.snack_am) != null || num(cal.snack_pm) != null || num(cal.snack_evening) != null) {
    return true;
  }
  const r = resolveSixMealSnackPercentages(dist);
  const mains = dist.breakfast + dist.lunch + dist.dinner;
  const daySum = mains + dist.snacks;
  if (dist.snacks >= 20 && mains >= 55 && Math.abs(daySum - 100) < 2) return true;
  if (r.snacksTotal >= 24 && Math.abs(r.snack_am - r.snack_pm) < 2 && Math.abs(r.snack_pm - r.snack_evening) < 2) {
    return true;
  }
  if (dist.snacks > 0 && dist.snacks * 3 + mains <= 100.5) return true;
  return false;
}
function num(v) {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}
function readCaloricDistributionFields(cal, pctSuffix) {
  const bKey = pctSuffix ? "breakfast_pct" : "breakfast";
  const lKey = pctSuffix ? "lunch_pct" : "lunch";
  const dKey = pctSuffix ? "dinner_pct" : "dinner";
  const sKey = pctSuffix ? "snacks_pct" : "snacks";
  const breakfast = num(cal[bKey] ?? cal.breakfast);
  const lunch = num(cal[lKey] ?? cal.lunch);
  const dinner = num(cal[dKey] ?? cal.dinner);
  const snacks = num(cal[sKey] ?? cal.snacks);
  const snackAm = num(cal.snack_am ?? cal.snack_am_pct);
  const snackPm = num(cal.snack_pm ?? cal.snack_pm_pct);
  const snackEvening = num(cal.snack_evening ?? cal.snack_evening_pct);
  if (breakfast == null && lunch == null && dinner == null && snacks == null && snackAm == null && snackPm == null && snackEvening == null) {
    return null;
  }
  return normalizeCaloricDistribution({
    breakfast: breakfast ?? 0,
    lunch: lunch ?? 0,
    dinner: dinner ?? 0,
    snacks: snacks ?? 0,
    ...snackAm != null ? { snack_am: snackAm } : {},
    ...snackPm != null ? { snack_pm: snackPm } : {},
    ...snackEvening != null ? { snack_evening: snackEvening } : {}
  });
}
function readCaloricDistribution(raw) {
  const fromDiet = readCaloricDistributionFields(asRecord5(raw.caloric_distribution), false);
  if (isUsableCaloricDistribution(fromDiet)) return fromDiet;
  const fromSplit = readCaloricDistributionFields(asRecord5(raw.caloric_split), true);
  if (isUsableCaloricDistribution(fromSplit)) return fromSplit;
  return fromDiet ?? fromSplit;
}
function isUsableCaloricDistribution(dist) {
  if (!dist) return false;
  return dist.breakfast + dist.lunch + dist.dinner + dist.snacks > 0;
}
function profileParityCaloricDistribution(dayRaw) {
  const cal = asRecord5(dayRaw.caloric_distribution);
  return normalizeCaloricDistribution({
    breakfast: num(cal.breakfast) ?? 30,
    lunch: num(cal.lunch) ?? 35,
    dinner: num(cal.dinner) ?? 25,
    snacks: num(cal.snacks) ?? 10
  });
}
function resolveCaloricDistributionForDay(dayRaw, nc, weekMealMode, weekConfigured) {
  const fromWeek = readCaloricDistribution(dayRaw);
  if (isUsableCaloricDistribution(fromWeek)) return fromWeek;
  const legacy = readFromLegacyRoot(nc);
  if (isUsableCaloricDistribution(legacy.caloricDistribution)) return legacy.caloricDistribution;
  if (weekMealMode.length > 0 || weekConfigured) {
    return profileParityCaloricDistribution(dayRaw);
  }
  return null;
}
function readDailyMacros(raw) {
  const macros = asRecord5(raw.daily_macros);
  const carbs = num(macros.cho_pct ?? macros.carbs_pct);
  const protein = num(macros.pro_pct ?? macros.protein_pct);
  const fat = num(macros.fat_pct);
  if (carbs == null && protein == null && fat == null) return null;
  return {
    carbs: carbs ?? 50,
    protein: protein ?? 25,
    fat: fat ?? 25
  };
}
function readFromLegacyRoot(nc) {
  const mealPlan = asRecord5(nc.meal_plan);
  const dist = readCaloricDistributionFields(asRecord5(mealPlan.caloric_split), true) ?? readCaloricDistributionFields(asRecord5(nc.caloric_split), true);
  const macroRoot = asRecord5(nc.macro_split);
  const macroMealPlan = asRecord5(mealPlan.macro_split);
  const macro = Object.keys(macroMealPlan).length ? macroMealPlan : macroRoot;
  const dailyMacros = num(macro.carbs_pct) != null || num(macro.protein_pct) != null || num(macro.fat_pct) != null ? {
    carbs: num(macro.carbs_pct) ?? 50,
    protein: num(macro.protein_pct) ?? 25,
    fat: num(macro.fat_pct) ?? 25
  } : null;
  const mealStrategy = String(mealPlan.meal_strategy ?? nc.meal_strategy ?? "").trim();
  let mealCountMode = "4";
  if (mealStrategy === "6-meals") mealCountMode = "6";
  else if (mealStrategy === "5-meals") mealCountMode = "5";
  else if (mealStrategy === "3-meals") mealCountMode = "3";
  return { mealCountMode, caloricDistribution: dist, dailyMacros };
}
function inferMealCountModeForDay(dayRaw, weekDist, legacyMealCountMode) {
  const explicit = String(dayRaw.meal_count_mode ?? "").trim();
  if (explicit && explicit !== "fasting") {
    if (explicit === "4" && weekDist && distributionImpliesSixMeals(weekDist, dayRaw)) return "6";
    return explicit;
  }
  if (weekDist && distributionImpliesSixMeals(weekDist, dayRaw)) return "6";
  if (legacyMealCountMode === "6" || legacyMealCountMode === "5" || legacyMealCountMode === "3") {
    return legacyMealCountMode;
  }
  if (legacyMealCountMode === "4" && weekDist && distributionImpliesSixMeals(weekDist, dayRaw)) {
    return "6";
  }
  return legacyMealCountMode || "4";
}
function enrichCaloricDistributionForMealMode(dist, mealCountMode) {
  if (!dist || mealCountMode !== "6") return dist;
  const r = resolveSixMealSnackPercentages(dist);
  return {
    ...dist,
    snack_am: r.snack_am,
    snack_pm: r.snack_pm,
    snack_evening: r.snack_evening,
    snacks: r.snacksTotal
  };
}
function resolveNutritionDietDay(nutritionConfig, planDate, options) {
  const preferredMealCount = options?.preferredMealCount != null ? Math.trunc(options.preferredMealCount) : null;
  const iso = planDate.slice(0, 10);
  const weekDayKey = profileWeekDayKeyFromIsoLocal(iso);
  const nc = parseNutritionConfigRecord(nutritionConfig);
  const weekPlan = asRecord5(nc.week_plan);
  const dayRaw = asRecord5(weekPlan[weekDayKey]);
  const dayType = String(dayRaw.day_type ?? "normocaloric-100");
  const dayTypePctRaw = num(dayRaw.day_type_pct);
  const dayTypePct = dayTypePctRaw != null ? Math.max(0, Math.min(200, dayTypePctRaw)) : 100;
  const weekMacros = readDailyMacros(dayRaw);
  const weekMealMode = String(dayRaw.meal_count_mode ?? "").trim();
  const weekConfigured = Boolean(weekMealMode) || readCaloricDistribution(dayRaw) != null || weekMacros != null || dayTypePctRaw != null;
  const legacy = readFromLegacyRoot(nc);
  const weekDist = resolveCaloricDistributionForDay(dayRaw, nc, weekMealMode, weekConfigured);
  if (weekConfigured) {
    let mealCountMode = inferMealCountModeForDay(dayRaw, weekDist, legacy.mealCountMode);
    if (mealCountMode === "4" && preferredMealCount === 6 && weekDist && distributionImpliesSixMeals(weekDist, dayRaw)) {
      mealCountMode = "6";
    }
    const caloricDistribution = enrichCaloricDistributionForMealMode(weekDist, mealCountMode);
    return {
      planDate: iso,
      weekDayKey,
      source: "week_plan",
      configured: isUsableCaloricDistribution(caloricDistribution) && mealCountMode.length > 0,
      mealCountMode,
      caloricDistribution,
      dailyMacros: weekMacros ?? legacy.dailyMacros,
      dayType,
      dayTypePct
    };
  }
  if (isUsableCaloricDistribution(legacy.caloricDistribution)) {
    let mealCountMode = inferMealCountModeForDay({}, legacy.caloricDistribution, legacy.mealCountMode);
    if (mealCountMode === "4" && preferredMealCount === 6 && legacy.caloricDistribution && distributionImpliesSixMeals(legacy.caloricDistribution, {})) {
      mealCountMode = "6";
    }
    const caloricDistribution = enrichCaloricDistributionForMealMode(legacy.caloricDistribution, mealCountMode);
    return {
      planDate: iso,
      weekDayKey,
      source: "legacy_root",
      configured: true,
      mealCountMode,
      caloricDistribution,
      dailyMacros: legacy.dailyMacros,
      dayType,
      dayTypePct
    };
  }
  return {
    planDate: iso,
    weekDayKey,
    source: "missing",
    configured: false,
    mealCountMode: "4",
    caloricDistribution: null,
    dailyMacros: null,
    dayType,
    dayTypePct
  };
}

// apps/web/lib/nutrition/reconcile-meal-plan-slots-with-diet.ts
function routineMealTimesFlat(routine) {
  const rc = routine && typeof routine === "object" && !Array.isArray(routine) ? routine : {};
  const mt = rc.meal_times && typeof rc.meal_times === "object" && !Array.isArray(rc.meal_times) ? rc.meal_times : {};
  return {
    breakfast: String(mt.breakfast ?? "07:30"),
    lunch: String(mt.lunch ?? "13:00"),
    dinner: String(mt.dinner ?? "20:00"),
    snack_am: String(mt.snack_am ?? "10:30"),
    snack_pm: String(mt.snack_pm ?? mt.snacks ?? "16:30"),
    snack_evening: String(mt.snack_evening ?? "22:30")
  };
}
var DEFAULT_MACRO = { carbs: 50, protein: 25, fat: 25 };
function reconcileMealPlanSlotsWithDiet(input) {
  const clientSlots = input.clientSlots ?? [];
  const dietDay = resolveNutritionDietDay(input.nutritionConfig, input.planDate, {
    preferredMealCount: input.preferredMealCount
  });
  if (!dietDay.configured || !dietDay.caloricDistribution) {
    return {
      slots: clientSlots,
      mealCountMode: dietDay.mealCountMode || "4",
      dietConfigured: false,
      rebuiltFromDiet: false
    };
  }
  const flatRoot = routineMealTimesFlat(
    input.routineConfig && typeof input.routineConfig === "object" && !Array.isArray(input.routineConfig) ? input.routineConfig : null
  );
  const mealTimes = mealTimesFromRoutineWeekPlanForDate(
    input.routineConfig,
    input.planDate,
    flatRoot
  );
  const macroSplit = dietDay.dailyMacros ?? DEFAULT_MACRO;
  const dailyKcal = Math.max(0, Math.round(input.dailyMealsKcalTotal));
  const budgets = buildDietMealSlotBudgets({
    mealCountMode: dietDay.mealCountMode,
    caloricDistribution: dietDay.caloricDistribution,
    dailyKcal,
    macroSplit,
    mealTimes
  });
  const clientBySlot = /* @__PURE__ */ new Map();
  for (const s of clientSlots) {
    if (s?.slot) clientBySlot.set(s.slot, s);
  }
  const rebuiltFromDiet = budgets.length !== clientSlots.length || budgets.some((b) => !clientBySlot.has(b.key)) || clientSlots.some((s) => !budgets.find((b) => b.key === s.slot));
  const slots = budgets.map((b) => {
    const prev = clientBySlot.get(b.key);
    return {
      slot: b.key,
      labelIt: b.label,
      scheduledTimeLocal: b.time,
      targetKcal: b.kcal,
      targetCarbsG: b.carbs,
      targetProteinG: b.protein,
      targetFatG: b.fat,
      functionalTargets: prev?.functionalTargets ?? [],
      functionalFoodGroups: prev?.functionalFoodGroups ?? [],
      foodCandidates: prev?.foodCandidates ?? []
    };
  });
  return {
    slots,
    mealCountMode: dietDay.mealCountMode,
    dietConfigured: true,
    rebuiltFromDiet
  };
}

// apps/web/lib/nutrition/intelligent-meal-plan-route-prep.ts
init_pro2_session_notes();
init_planned_session_metrics();

// apps/web/lib/nutrition/daily-energy-solver.ts
var LIFESTYLE_PCT = {
  sedentary: 0.15,
  moderate: 0.2,
  active: 0.3,
  very_active: 0.4
};
function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
function round(value, digits = 0) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}
function asFinite(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const t = value.trim();
    if (!t) return null;
    const n = Number(t);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}
function deriveAgeYears(birthDate) {
  if (!birthDate) return null;
  const birth = /* @__PURE__ */ new Date(`${birthDate}T00:00:00`);
  if (Number.isNaN(birth.getTime())) return null;
  const now = /* @__PURE__ */ new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const monthDiff = now.getMonth() - birth.getMonth();
  if (monthDiff < 0 || monthDiff === 0 && now.getDate() < birth.getDate()) {
    age -= 1;
  }
  return age >= 0 ? age : null;
}
function normalizeLifestyleActivityClass(value) {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (normalized === "sedentary") return "sedentary";
  if (normalized === "moderate") return "moderate";
  if (normalized === "active") return "active";
  if (normalized === "very_active" || normalized === "very active") return "very_active";
  return "moderate";
}
function computeLeanMassKg(input) {
  const weightKg = asFinite(input.weightKg);
  const bodyFatPct = asFinite(input.bodyFatPct);
  if (weightKg == null || bodyFatPct == null) return null;
  return round(weightKg * (1 - clamp(bodyFatPct, 0, 70) / 100), 1);
}
function computeMifflinStJeor(input) {
  const ageYears = asFinite(input.ageYears);
  const heightCm = asFinite(input.heightCm);
  const weightKg = asFinite(input.weightKg);
  if (ageYears == null || heightCm == null || weightKg == null) return null;
  const sex = String(input.sex ?? "").toLowerCase();
  const sexOffset = sex === "male" ? 5 : sex === "female" ? -161 : -78;
  return 10 * weightKg + 6.25 * heightCm - 5 * ageYears + sexOffset;
}
function computeWeightProxyBmr(weightKg) {
  const weight = asFinite(weightKg);
  if (weight == null) return null;
  return weight * 22;
}
function deriveAthleteCalibrationPct(input) {
  const vo2max = asFinite(input.vo2maxMlMinKg);
  const ftpWatts = asFinite(input.ftpWatts);
  const weightKg = asFinite(input.weightKg);
  const ftpWKg = ftpWatts != null && weightKg != null && weightKg > 0 ? ftpWatts / weightKg : null;
  const vo2Score = vo2max != null ? clamp((vo2max - 45) / 25, 0, 1) : 0;
  const ftpScore = ftpWKg != null ? clamp((ftpWKg - 3.2) / 1.8, 0, 1) : 0;
  return round(clamp(vo2Score * 0.03 + ftpScore * 0.02, 0, 0.05), 3);
}
function deriveBmr(input) {
  const notes = [];
  const ageYears = deriveAgeYears(input.birthDate);
  const weightKg = asFinite(input.weightKg);
  const leanMassKg = computeLeanMassKg({
    weightKg,
    bodyFatPct: input.bodyFatPct
  });
  const ftpWKg = input.ftpWatts != null && weightKg != null && weightKg > 0 ? round(input.ftpWatts / weightKg, 2) : null;
  if (leanMassKg != null) {
    notes.push("BMR anchored to Cunningham using fat-free mass.");
    return {
      bmrKcal: round(500 + 22 * leanMassKg),
      bmrMethod: "cunningham_ffm",
      leanMassKg,
      ageYears,
      ftpWKg,
      notes
    };
  }
  const mifflin = computeMifflinStJeor({
    sex: input.sex,
    ageYears,
    heightCm: input.heightCm,
    weightKg
  });
  if (mifflin != null) {
    const athleteCalibrationPct = deriveAthleteCalibrationPct(input);
    if (athleteCalibrationPct > 0) {
      notes.push("BMR calibrated upward from Mifflin using athlete aerobic phenotype proxies.");
    } else {
      notes.push("BMR derived from Mifflin-St Jeor fallback due to missing body-fat data.");
    }
    return {
      bmrKcal: round(mifflin * (1 + athleteCalibrationPct)),
      bmrMethod: "mifflin_st_jeor",
      leanMassKg,
      ageYears,
      ftpWKg,
      notes
    };
  }
  const proxy = computeWeightProxyBmr(weightKg);
  notes.push("BMR derived from weight-only fallback because composition and full anthropometry are incomplete.");
  return {
    bmrKcal: round(proxy ?? 0),
    bmrMethod: "weight_proxy",
    leanMassKg,
    ageYears,
    ftpWKg,
    notes
  };
}
function estimateTrainingKcalFromTss(totalTss, durationMin) {
  if (totalTss <= 0) return 0;
  const hours = Math.max(0.25, durationMin / 60);
  const tssPerHour = totalTss / hours;
  const scale = clamp(tssPerHour / 80, 0.85, 1.15);
  return round(totalTss * 10 * scale);
}
function deriveTrainingSummary(plannedTraining = []) {
  const sessions = plannedTraining.filter((session) => {
    const duration = asFinite(session.durationMinutes) ?? 0;
    const kcal2 = asFinite(session.kcalTarget) ?? 0;
    const tss = asFinite(session.tssTarget) ?? 0;
    return duration > 0 || kcal2 > 0 || tss > 0;
  });
  const durationMin = round(
    sessions.reduce((sum, session) => sum + Math.max(0, asFinite(session.durationMinutes) ?? 0), 0)
  );
  let kcal = round(
    sessions.reduce((sum, session) => sum + Math.max(0, asFinite(session.kcalTarget) ?? 0), 0)
  );
  const totalTss = sessions.reduce((sum, session) => sum + Math.max(0, asFinite(session.tssTarget) ?? 0), 0);
  if (kcal === 0 && totalTss > 0) {
    kcal = estimateTrainingKcalFromTss(totalTss, durationMin);
  }
  const totalWeightedPower = sessions.reduce((sum, session) => {
    const avgPowerW = asFinite(session.avgPowerW);
    const durationMinutes = Math.max(0, asFinite(session.durationMinutes) ?? 0);
    return sum + (avgPowerW != null ? avgPowerW * Math.max(1, durationMinutes) : 0);
  }, 0);
  const totalPowerMinutes = sessions.reduce((sum, session) => {
    const avgPowerW = asFinite(session.avgPowerW);
    const durationMinutes = Math.max(0, asFinite(session.durationMinutes) ?? 0);
    return sum + (avgPowerW != null ? Math.max(1, durationMinutes) : 0);
  }, 0);
  const hours = durationMin > 0 ? durationMin / 60 : 0;
  const avgIntensityPctFtp = hours > 0 ? round(clamp(Math.sqrt(Math.max(0, totalTss / hours) / 100) * 100, 45, 120), 1) : null;
  return {
    sessionsCount: sessions.length,
    durationMin,
    kcal,
    avgIntensityPctFtp,
    avgPowerW: totalPowerMinutes > 0 ? round(totalWeightedPower / totalPowerMinutes) : null
  };
}
function deriveEvidenceChoRange(input) {
  const duration = Math.max(0, input.durationMin);
  const intensity = asFinite(input.avgIntensityPctFtp) ?? 70;
  const avgPower = asFinite(input.estimatedAvgPowerW) ?? 0;
  const ftpWKg = asFinite(input.ftpWKg) ?? 0;
  const vo2max = asFinite(input.vo2maxMlMinKg) ?? 0;
  if (duration >= 60 && avgPower >= 300 && (ftpWKg >= 4.8 || vo2max >= 68)) {
    return { tier: "elite", min: 100, target: 120, max: 130 };
  }
  if (duration >= 75 && (avgPower >= 250 || ftpWKg >= 4.2 || vo2max >= 60)) {
    return { tier: "high", min: 90, target: 100, max: 110 };
  }
  if (duration < 45) {
    return { tier: "base", min: 0, target: 15, max: 30 };
  }
  if (duration < 120) {
    return intensity >= 85 ? { tier: "base", min: 30, target: 50, max: 60 } : { tier: "base", min: 20, target: 40, max: 50 };
  }
  if (duration < 180) {
    return intensity >= 85 ? { tier: "base", min: 50, target: 70, max: 90 } : { tier: "base", min: 40, target: 60, max: 75 };
  }
  return intensity >= 85 ? { tier: "base", min: 60, target: 90, max: 90 } : { tier: "base", min: 50, target: 75, max: 90 };
}
function computeNutritionDailyEnergyModel(input) {
  const bmr = deriveBmr(input);
  const lifestyleClass = normalizeLifestyleActivityClass(input.lifestyleActivityClass);
  const lifestylePct = LIFESTYLE_PCT[lifestyleClass];
  const lifestyleKcal = round(bmr.bmrKcal * lifestylePct);
  const training = deriveTrainingSummary(input.plannedTraining);
  const integration = input.performanceIntegration ?? null;
  const trainingEnergyScale = integration?.trainingEnergyScale ?? 1;
  const mealTrainingFraction = integration?.mealTrainingFraction ?? 0.4;
  const fuelingChoScale = integration?.fuelingChoScale ?? 1;
  const trainingKcal = training.kcal;
  const estimatedAvgPowerW = training.avgPowerW != null ? training.avgPowerW : input.ftpWatts != null && training.avgIntensityPctFtp != null ? round(input.ftpWatts * (training.avgIntensityPctFtp / 100)) : null;
  const dietScale = input.dietDayMealsScalePct != null && Number.isFinite(input.dietDayMealsScalePct) ? clamp(input.dietDayMealsScalePct, 0, 200) / 100 : 1;
  const observedActiveKcal = input.observedActiveKcal != null && Number.isFinite(input.observedActiveKcal) && input.observedActiveKcal >= 0 ? input.observedActiveKcal : null;
  const usesObserved = observedActiveKcal != null;
  const observedTotalKcal = usesObserved ? bmr.bmrKcal + observedActiveKcal : null;
  const fuelingKcal = round(trainingKcal * (1 - mealTrainingFraction));
  const totalDailyKcal = round(
    (usesObserved ? observedTotalKcal : bmr.bmrKcal + lifestyleKcal + trainingKcal) * dietScale
  );
  const mealsKcal = round(
    (usesObserved ? Math.max(0, observedTotalKcal - fuelingKcal) : bmr.bmrKcal + lifestyleKcal + trainingKcal * mealTrainingFraction) * dietScale
  );
  const recoveryStatus = input.recoveryStatus ?? "unknown";
  const split = recoveryStatus === "poor" ? { pre: 0.08, intra: 0.4, post: 0.12 } : recoveryStatus === "moderate" ? { pre: 0.06, intra: 0.44, post: 0.1 } : { pre: 0.05, intra: 0.45, post: 0.1 };
  const preKcal = round(trainingKcal * split.pre);
  const intraKcal = round(trainingKcal * split.intra);
  const postKcal = round(trainingKcal * split.post);
  const preChoG = round(preKcal / 4, 1);
  const intraChoG = round(intraKcal / 4, 1);
  const postChoG = round(postKcal / 4, 1);
  const hours = training.durationMin > 0 ? training.durationMin / 60 : 0;
  const energyDrivenChoGPerHour = hours > 0 ? round(intraChoG / hours, 1) : 0;
  const evidenceRange = deriveEvidenceChoRange({
    durationMin: training.durationMin,
    avgIntensityPctFtp: training.avgIntensityPctFtp,
    estimatedAvgPowerW,
    ftpWKg: bmr.ftpWKg,
    vo2maxMlMinKg: input.vo2maxMlMinKg
  });
  let adjustedChoGPerHour = hours > 0 ? round(
    recoveryStatus === "poor" ? clamp(energyDrivenChoGPerHour, evidenceRange.min, evidenceRange.target) : recoveryStatus === "moderate" ? clamp(energyDrivenChoGPerHour, evidenceRange.min, Math.min(evidenceRange.max, evidenceRange.target + 5)) : clamp(energyDrivenChoGPerHour, evidenceRange.min, evidenceRange.max),
    1
  ) : 0;
  if (hours > 0 && fuelingChoScale !== 1) {
    adjustedChoGPerHour = round(
      clamp(adjustedChoGPerHour * fuelingChoScale, evidenceRange.min, evidenceRange.max),
      1
    );
  }
  const notes = [...bmr.notes];
  notes.push(
    "Daily total = BMR + lifestyle load + planned training cost (kcal del consumo programmato; sostituito dall'eseguito quando importato).",
    "Meals cover BMR + lifestyle load + 40% of planned training energy.",
    "Fueling covers the remaining 60% of planned training energy split as 5% pre, 45% intra, 10% post.",
    "Evidence layer constrains intra-workout CHO/h independently from raw calorie math.",
    "Integrazione performance (recovery/bio): agisce su distribuzione pasti\u2194fueling, CHO/h, proteine, idratazione \u2014 NON riduce il fabbisogno energetico totale."
  );
  if (usesObserved) {
    notes.push(
      `Consumo OSSERVATO (device): BMR ${bmr.bmrKcal} + kcal attive ${Math.round(observedActiveKcal)} = ${observedTotalKcal} kcal. Il fabbisogno segue il consumo reale; fueling intra-seduta (${fuelingKcal} kcal) resta dal pianificato.`
    );
  }
  if (recoveryStatus === "moderate") {
    notes.push("Recovery-aware solver active: moderate recovery shifts more energy toward pre/post support and slightly tempers intra CHO aggressiveness.");
  }
  if (recoveryStatus === "poor") {
    notes.push("Recovery-aware solver active: poor recovery protects the day by simplifying intra CHO delivery and reinforcing pre/post support.");
  }
  if (input.recoverySleepHours != null) {
    notes.push(`Recovery feed detected: sleep ${round(input.recoverySleepHours, 1)} h.`);
  }
  if (input.recoveryHrvMs != null) {
    notes.push(`Recovery feed detected: HRV ${round(input.recoveryHrvMs)} ms.`);
  }
  if (input.recoveryStrainScore != null) {
    notes.push(`Recovery feed detected: strain ${round(input.recoveryStrainScore)}.`);
  }
  if (evidenceRange.tier === "high") {
    notes.push("High-capacity athlete tier enabled: intra-workout CHO can scale into the 90-110 g/h band.");
  }
  if (evidenceRange.tier === "elite") {
    notes.push("Elite fueling tier enabled: sustained high-power sessions can scale into the 120-130 g/h band.");
  }
  if (integration) {
    notes.push(
      `Integrazione performance (informativa): indicatore recovery/bio \xD7${trainingEnergyScale}, quota pasti sul training ${Math.round(mealTrainingFraction * 100)}%, CHO/h \xD7${fuelingChoScale}. Non viene applicata al fabbisogno totale.`
    );
    notes.push(...integration.rationale);
  }
  if (dietScale !== 1) {
    notes.push(`Profile Diet: fabbisogno pasti scalato al ${Math.round(dietScale * 100)}% del giorno (day_type_pct).`);
  }
  return {
    athleteId: input.athleteId,
    date: input.date,
    algorithmVersion: "v1",
    bmrMethod: bmr.bmrMethod,
    bmrKcal: bmr.bmrKcal,
    leanMassKg: bmr.leanMassKg,
    ageYears: bmr.ageYears,
    ftpWKg: bmr.ftpWKg,
    vo2maxMlMinKg: asFinite(input.vo2maxMlMinKg),
    lifestyle: {
      activityClass: lifestyleClass,
      pct: lifestylePct,
      kcal: lifestyleKcal
    },
    training: {
      ...training,
      kcal: trainingKcal,
      estimatedAvgPowerW
    },
    totals: {
      dailyKcal: totalDailyKcal,
      mealsKcal,
      fuelingKcal
    },
    fueling: {
      capabilityTier: evidenceRange.tier,
      preKcal,
      intraKcal,
      postKcal,
      preChoG,
      intraChoG,
      postChoG,
      evidenceMinChoGPerHour: evidenceRange.min,
      evidenceTargetChoGPerHour: evidenceRange.target,
      evidenceMaxChoGPerHour: evidenceRange.max,
      energyDrivenChoGPerHour,
      adjustedChoGPerHour
    },
    performanceIntegration: integration ? {
      trainingEnergyScale: integration.trainingEnergyScale,
      mealTrainingFraction: integration.mealTrainingFraction,
      fuelingChoScale: integration.fuelingChoScale,
      proteinBiasPctPoints: integration.proteinBiasPctPoints,
      hydrationFloorMultiplier: integration.hydrationFloorMultiplier,
      sessionFluidMultiplier: integration.sessionFluidMultiplier,
      rationale: integration.rationale,
      ...integration.diaryInsight != null ? { diaryInsight: integration.diaryInsight } : {}
    } : void 0,
    notes
  };
}

// apps/web/lib/nutrition/v2/fdc-food-taxonomy.ts
var CLASSIFIER_VERSION = "empathy_v2_rules_v1";
function dietProfileFromAthleteDietType(raw) {
  const d = (raw ?? "").trim().toLowerCase();
  if (!d || d === "omnivore" || d === "other") return "omnivore";
  if (d.includes("vegan")) return "vegan";
  if (d.includes("veget")) return "vegetarian";
  if (d.includes("pesc")) return "pescatarian";
  if (d.includes("carniv")) return "carnivore";
  if (d.includes("paleo")) return "paleo";
  if (d.includes("mediterr")) return "mediterranean";
  if (d.includes("thai")) return "thai";
  if (d.includes("celiac") || d.includes("gluten")) return "celiac";
  if (d.includes("lactose") || d.includes("lattosio")) return "lactose_free";
  if (d.includes("histamin")) return "low_histamine";
  return "mediterranean";
}

// apps/web/lib/nutrition/v2/substrate-rates.ts
var DEFAULT_EFFICIENCY = 0.24;
var DEFAULT_FTP_W = 250;
function clamp2(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}
function round2(n, d = 1) {
  const f = 10 ** d;
  return Math.round(n * f) / f;
}
function rerFromIntensityPctFtp(intensityPctFtp) {
  const i = clamp2(intensityPctFtp, 40, 120);
  if (i < 60) return 0.82;
  if (i < 75) return 0.88;
  if (i < 85) return 0.92;
  if (i < 95) return 0.96;
  return 1.02;
}
function substrateRatesAtPowerW(avgPowerW, options) {
  const ftp = Math.max(120, options?.ftpW ?? DEFAULT_FTP_W);
  const efficiency = options?.efficiency ?? DEFAULT_EFFICIENCY;
  const intensityPctFtp = avgPowerW / ftp * 100;
  const rer = rerFromIntensityPctFtp(intensityPctFtp);
  const choFrac = clamp2((rer - 0.7) / 0.3, 0.05, 0.99);
  const fatFrac = 1 - choFrac;
  const kcalPerH = avgPowerW / efficiency * 3600 / 4184;
  const choGPerH = kcalPerH * choFrac / 4;
  const fatGPerH = kcalPerH * fatFrac / 9;
  const proGPerH = options?.proteinGPerH ?? clamp2(0.08 * (avgPowerW / 100), 2, 12);
  return {
    choGPerH: round2(choGPerH),
    fatGPerH: round2(fatGPerH),
    proGPerH: round2(proGPerH),
    rer: round2(rer, 2),
    kcalPerH: round2(kcalPerH)
  };
}
function substrateTotalsForSession(avgPowerW, durationMinutes, options) {
  const durationH = Math.max(0.05, durationMinutes / 60);
  const perH = substrateRatesAtPowerW(avgPowerW, options);
  return {
    ...perH,
    durationH: round2(durationH, 2),
    choG: round2(perH.choGPerH * durationH),
    fatG: round2(perH.fatGPerH * durationH),
    proG: round2(perH.proGPerH * durationH)
  };
}

// apps/web/lib/nutrition/v2/fueling-from-substrates.ts
function clamp3(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}
function round3(n, d = 1) {
  const f = 10 ** d;
  return Math.round(n * f) / f;
}
function intraChoReplaceFractionFromEnergyShare(choEnergyShare) {
  const s = clamp3(choEnergyShare, 0, 1);
  if (s >= 0.88) return 0.85;
  if (s >= 0.78) return 0.75;
  if (s >= 0.65) return 0.65;
  if (s >= 0.52) return 0.55;
  return 0.45;
}
function evidenceMaxChoGPerHour(durationMin, choEnergyShare) {
  const h = durationMin / 60;
  if (h < 0.75) return 30;
  if (h < 2) return choEnergyShare >= 0.85 ? 90 : 60;
  if (h < 3) return choEnergyShare >= 0.85 ? 110 : 75;
  return choEnergyShare >= 0.85 ? 120 : 90;
}
function computeSubstrateFuelingPlan(input) {
  const ftp = Math.max(120, input.ftpW ?? 250);
  const weightKg = Math.max(45, input.weightKg ?? 70);
  const sessions = [];
  const provenance = [
    "Fueling intra: frazione del CHO bruciato in seduta (substrati), non % kcal training.",
    "Alta intensit\xE0 (CHO \u2248 energia) \u2192 replace fino ~85%; Z1/Z2 (CHO 50\u201365%) \u2192 replace ~45\u201355%.",
    "Cap intra g/h da durata + intensit\xE0 (evidence band). Pre/post = CHO mirato, non split % kcal training."
  ];
  for (const s of input.sessions) {
    const totals = substrateTotalsForSession(s.avgPowerW, s.durationMin, { ftpW: ftp });
    const choKcal = totals.choG * 4;
    const fatKcal = totals.fatG * 9;
    const proKcal = totals.proG * 4;
    const substrateKcal = choKcal + fatKcal + proKcal;
    const choEnergyShare = substrateKcal > 0 ? choKcal / substrateKcal : 0.5;
    const replaceFrac = intraChoReplaceFractionFromEnergyShare(choEnergyShare);
    const maxPerH = evidenceMaxChoGPerHour(s.durationMin, choEnergyShare);
    let intraChoG2 = round3(totals.choG * replaceFrac);
    const intraCap = round3(maxPerH * totals.durationH);
    if (intraChoG2 > intraCap) {
      intraChoG2 = intraCap;
      provenance.push(
        `Sessione ${s.label.slice(0, 40)}: intra CHO capped a ${maxPerH} g/h \xD7 ${totals.durationH} h.`
      );
    }
    const preChoG2 = s.durationMin >= 45 ? round3(clamp3(weightKg * 0.35, 20, 70)) : round3(clamp3(weightKg * 0.2, 10, 40));
    const postChoG2 = round3(totals.choG * clamp3(0.22 + choEnergyShare * 0.12, 0.2, 0.38));
    const preKcal = round3(preChoG2 * 4, 0);
    const intraKcal = round3(intraChoG2 * 4, 0);
    const postKcal = round3(postChoG2 * 4, 0);
    sessions.push({
      sessionLabel: s.label,
      avgPowerW: s.avgPowerW,
      durationH: totals.durationH,
      choBurnedG: totals.choG,
      fatBurnedG: totals.fatG,
      proBurnedG: totals.proG,
      choEnergyShare: round3(choEnergyShare, 2),
      intraChoReplaceFraction: replaceFrac,
      preChoG: preChoG2,
      intraChoG: intraChoG2,
      postChoG: postChoG2,
      preKcal,
      intraKcal,
      postKcal,
      evidenceMaxChoGPerH: maxPerH,
      intraChoGPerH: totals.durationH > 0 ? round3(intraChoG2 / totals.durationH) : 0
    });
  }
  const preChoG = round3(sessions.reduce((sum, x) => sum + x.preChoG, 0));
  const intraChoG = round3(sessions.reduce((sum, x) => sum + x.intraChoG, 0));
  const postChoG = round3(sessions.reduce((sum, x) => sum + x.postChoG, 0));
  const fuelingKcal = Math.round(preChoG * 4 + intraChoG * 4 + postChoG * 4);
  const fatKcalTotal = sessions.reduce((sum, x) => sum + x.fatBurnedG * 9, 0);
  const proKcalTotal = sessions.reduce((sum, x) => sum + x.proBurnedG * 4, 0);
  const choNotOral = sessions.reduce(
    (sum, x) => sum + (x.choBurnedG - x.intraChoG) * 4,
    0
  );
  return {
    algorithmVersion: "substrate_fueling_v1",
    sessions,
    totals: {
      preChoG,
      intraChoG,
      postChoG,
      fuelingKcal,
      oralTrainingKcal: fuelingKcal,
      endogenousFatKcal: Math.round(fatKcalTotal + proKcalTotal + choNotOral)
    },
    provenance
  };
}

// apps/web/lib/nutrition/v2/daily-nutrition-requirements.ts
var PAL_BY_LIFESTYLE = {
  sedentary: 1.25,
  moderate: 1.4,
  active: 1.55,
  very_active: 1.75
};
var STRATEGY_TEMPLATES = {
  maintenance: { choMinGPerKg: 3, choMaxGPerKg: 5, proGPerKg: 1.4, fatGPerKg: 0.9 },
  load: { choMinGPerKg: 8, choMaxGPerKg: 12, proGPerKg: 1.5, fatGPerKg: 0.5 },
  deload: { choMinGPerKg: 0.5, choMaxGPerKg: 1, proGPerKg: 2.5, fatGPerKg: 1.5 },
  recovery: { choMinGPerKg: 2, choMaxGPerKg: 4, proGPerKg: 1.8, fatGPerKg: 1 },
  race: { choMinGPerKg: 7, choMaxGPerKg: 10, proGPerKg: 1.6, fatGPerKg: 0.6 },
  custom: { choMinGPerKg: 4, choMaxGPerKg: 6, proGPerKg: 1.5, fatGPerKg: 0.8 }
};
function roundG(n) {
  return Math.round(n);
}
function basalMacrosFromTemplate(weightKg, template) {
  const choMid = (template.choMinGPerKg + template.choMaxGPerKg) / 2;
  return {
    choG: roundG(choMid * weightKg),
    proG: roundG(template.proGPerKg * weightKg),
    fatG: roundG(template.fatGPerKg * weightKg)
  };
}
function sumMacros(a, b) {
  return {
    choG: roundG(a.choG + b.choG),
    proG: roundG(a.proG + b.proG),
    fatG: roundG(a.fatG + b.fatG)
  };
}
function inferStrategyKindFromRequest(req) {
  const trainingLines = (req.trainingDayLines ?? []).join(" ").toLowerCase();
  if (req.racePreLunch || req.racePostRecovery) return "race";
  if (/recovery|scarico|deload|riposo/.test(trainingLines)) return "recovery";
  if (/long|endurance|4h|>3|carbo.?load|load|vo2|soglia|threshold/.test(trainingLines)) return "load";
  return "maintenance";
}
function buildDailyNutritionRequirementsV2(input) {
  const { request, weightKg } = input;
  const w = Math.max(45, weightKg);
  const strategyKind = input.strategyKind ?? inferStrategyKindFromRequest(request);
  const template = STRATEGY_TEMPLATES[strategyKind];
  const dietProfileActive = dietProfileFromAthleteDietType(request.dietType);
  const lifestyleClass = normalizeLifestyleActivityClass(input.lifestyleActivityClass ?? "moderate");
  const pal = PAL_BY_LIFESTYLE[lifestyleClass] ?? 1.4;
  const sessions = input.plannedSessions?.length ? input.plannedSessions : extractPlannedSessionsFromRequest(request, input.ftpWatts ?? 250);
  const energyModel = computeNutritionDailyEnergyModel({
    athleteId: request.athleteId,
    date: request.planDate,
    weightKg: w,
    ftpWatts: input.ftpWatts ?? null,
    lifestyleActivityClass: lifestyleClass,
    dietDayMealsScalePct: input.dietDayMealsScalePct ?? 100,
    plannedTraining: sessions.map((s) => ({
      durationMinutes: s.durationMin,
      avgPowerW: s.avgPowerW,
      kcalTarget: null,
      tssTarget: null
    }))
  });
  const lifestyleKcalPal = Math.round(energyModel.bmrKcal * (pal - 1));
  let trainingCho = 0;
  let trainingFat = 0;
  let trainingPro = 0;
  const substrateRates = [];
  for (const s of sessions) {
    const totals = substrateTotalsForSession(s.avgPowerW, s.durationMin, { ftpW: input.ftpWatts ?? 250 });
    trainingCho += totals.choG;
    trainingFat += totals.fatG;
    trainingPro += totals.proG;
    substrateRates.push({
      sessionLabel: s.label,
      avgPowerW: s.avgPowerW,
      durationH: totals.durationH,
      choGPerH: totals.choGPerH,
      fatGPerH: totals.fatGPerH,
      proGPerH: totals.proGPerH
    });
  }
  const basal = basalMacrosFromTemplate(w, template);
  const training = {
    choG: roundG(trainingCho),
    proG: roundG(trainingPro),
    fatG: roundG(trainingFat)
  };
  const total = sumMacros(basal, training);
  const dietScale = input.dietDayMealsScalePct != null && Number.isFinite(input.dietDayMealsScalePct) ? Math.max(0, Math.min(200, input.dietDayMealsScalePct)) / 100 : 1;
  const substrateTrainingKcal = roundG(
    sessions.reduce((sum, s) => {
      const t = substrateTotalsForSession(s.avgPowerW, s.durationMin, { ftpW: input.ftpWatts ?? 250 });
      return sum + t.kcalPerH * t.durationH;
    }, 0)
  );
  const trainingKcal = energyModel.training.kcal > 0 ? energyModel.training.kcal : substrateTrainingKcal;
  const dailyKcal = Math.round((energyModel.bmrKcal + lifestyleKcalPal + trainingKcal) * dietScale);
  const substrateFueling = sessions.length > 0 ? computeSubstrateFuelingPlan({
    sessions: sessions.map((s) => ({
      label: s.label,
      avgPowerW: s.avgPowerW,
      durationMin: s.durationMin
    })),
    ftpW: input.ftpWatts ?? 250,
    weightKg: w
  }) : void 0;
  const fuelingKcal = substrateFueling?.totals.fuelingKcal ?? energyModel.totals.fuelingKcal;
  const mealsKcal = Math.max(800, Math.round(dailyKcal - fuelingKcal));
  const provenance = [
    `Strategia V2 preview: ${strategyKind} (CHO ${template.choMinGPerKg}\u2013${template.choMaxGPerKg} g/kg, PRO ${template.proGPerKg} g/kg, FAT ${template.fatGPerKg} g/kg).`,
    `Profilo dieta attivo (asse 4): ${dietProfileActive}.`,
    `PAL ${pal} \xD7 BMR ${energyModel.bmrKcal} kcal \u2192 lifestyle stimato ${lifestyleKcalPal} kcal (V1 solver lifestyle: ${energyModel.lifestyle.kcal} kcal).`,
    `Training: ${trainingKcal} kcal \xB7 ${sessions.length} seduta/e \xB7 substrati CHO/FAT/PRO da potenza media.`,
    substrateFueling ? `Fueling V2: ${fuelingKcal} kcal oral (pre+intra+post CHO da consumo substrati); pasti ${mealsKcal} kcal = fabbisogno \u2212 fueling.` : "Nessuna seduta: fueling V1 solver legacy.",
    "Ripartizione % tra pasti: Profile Diet (`buildDietMealSlotBudgets`), non preset composer.",
    ...substrateFueling?.provenance ?? []
  ];
  return {
    athleteId: request.athleteId,
    planDate: request.planDate,
    algorithmVersion: "nutrition_requirements_v2_production",
    weightKg: w,
    strategyKind,
    dietProfileActive,
    dailyMacroTargetsGPerKg: {
      choMinGPerKg: template.choMinGPerKg,
      choMaxGPerKg: template.choMaxGPerKg,
      proGPerKg: template.proGPerKg,
      fatGPerKg: template.fatGPerKg
    },
    energy: {
      bmrKcal: energyModel.bmrKcal,
      lifestyleKcal: lifestyleKcalPal,
      trainingKcal,
      dailyKcal,
      mealsKcal,
      fuelingKcal,
      palMultiplier: pal,
      endogenousTrainingKcal: substrateFueling?.totals.endogenousFatKcal
    },
    substrateFueling: substrateFueling ? {
      algorithmVersion: substrateFueling.algorithmVersion,
      sessions: substrateFueling.sessions.map((s) => ({
        sessionLabel: s.sessionLabel,
        avgPowerW: s.avgPowerW,
        durationH: s.durationH,
        choBurnedG: s.choBurnedG,
        fatBurnedG: s.fatBurnedG,
        choEnergyShare: s.choEnergyShare,
        intraChoReplaceFraction: s.intraChoReplaceFraction,
        preChoG: s.preChoG,
        intraChoG: s.intraChoG,
        postChoG: s.postChoG,
        intraChoGPerH: s.intraChoGPerH
      })),
      totals: {
        preChoG: substrateFueling.totals.preChoG,
        intraChoG: substrateFueling.totals.intraChoG,
        postChoG: substrateFueling.totals.postChoG,
        fuelingKcal: substrateFueling.totals.fuelingKcal,
        endogenousFatKcal: substrateFueling.totals.endogenousFatKcal
      }
    } : void 0,
    macros: { basal, training, total },
    substrateRates,
    provenance
  };
}
function extractPlannedSessionsFromRequest(req, defaultFtp) {
  const out = [];
  for (const line of req.trainingDayLines ?? []) {
    const power = parsePowerFromLine(line, defaultFtp);
    const dur = parseDurationFromLine(line);
    if (dur > 0 && power > 0) {
      out.push({ label: line.slice(0, 80), avgPowerW: power, durationMin: dur });
    }
  }
  if (out.length === 0 && (req.suppressedSlots?.length || req.trainingDayLines?.length)) {
    out.push({ label: "Allenamento pianificato (stima preview)", avgPowerW: Math.round(defaultFtp * 0.86), durationMin: 240 });
  }
  return out;
}
function parsePowerFromLine(line, ftp) {
  const w = line.match(/(\d{2,4})\s*w\b/i);
  if (w) return Number(w[1]);
  const pct = line.match(/(\d{2,3})\s*%\s*ftp/i);
  if (pct) return Math.round(Number(pct[1]) / 100 * ftp);
  return 0;
}
function parseDurationFromLine(line) {
  const h = line.match(/(\d+(?:[.,]\d+)?)\s*h\b/i);
  if (h) return Math.round(Number(h[1].replace(",", ".")) * 60);
  const min = line.match(/(\d+)\s*min/i);
  if (min) return Number(min[1]);
  return 0;
}

// apps/web/lib/nutrition/intelligent-meal-plan-route-prep.ts
function isRecord(v) {
  return v != null && typeof v === "object" && !Array.isArray(v);
}
function sanitizeWeeklyStapleCounts(raw) {
  if (!isRecord(raw)) return void 0;
  const out = {};
  for (const [k, v] of Object.entries(raw)) {
    if (typeof k !== "string" || k.length > 72) continue;
    if (typeof v !== "number" || !Number.isFinite(v) || v < 0 || v > 21) continue;
    out[k] = Math.min(21, Math.floor(v));
  }
  return Object.keys(out).length ? out : void 0;
}
async function prepareIntelligentMealPlanContext(db, body) {
  const athleteId = String(body.athleteId ?? "").trim();
  if (!athleteId) return { error: "Missing athleteId", status: 400 };
  const planDate = String(body.plan?.planDate ?? "").slice(0, 10) || (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
  const [{ data: profileRow }, { data: plannedRows }] = await Promise.all([
    db.from("athlete_profiles").select(
      "nutrition_config, routine_config, preferred_meal_count, weight_kg, diet_type, lifestyle_activity_class, ftp_watts, supplement_config"
    ).eq("id", athleteId).maybeSingle(),
    db.from("planned_workouts").select("duration_minutes, type, notes, tss_target, kcal_target").eq("athlete_id", athleteId).eq("date", planDate)
  ]);
  const plan = body.plan;
  if (!isRecord(plan)) return { error: "Missing plan", status: 400 };
  const weekly = sanitizeWeeklyStapleCounts(plan.weeklyStapleCounts);
  const planMerged = {
    ...plan,
    ...weekly ? { weeklyStapleCounts: weekly } : {}
  };
  const clientSlots = Array.isArray(planMerged.slots) ? planMerged.slots : [];
  const dailyMealsKcalTotal = typeof planMerged.mealPlanSolverMeta?.dailyMealsKcalTotal === "number" ? planMerged.mealPlanSolverMeta.dailyMealsKcalTotal : clientSlots.reduce((s, sl) => s + (Number.isFinite(sl.targetKcal) ? sl.targetKcal : 0), 0);
  const row2 = profileRow ?? null;
  const reconciled = reconcileMealPlanSlotsWithDiet({
    planDate,
    nutritionConfig: row2?.nutrition_config ?? null,
    routineConfig: row2?.routine_config ?? null,
    dailyMealsKcalTotal,
    clientSlots,
    preferredMealCount: typeof row2?.preferred_meal_count === "number" ? row2.preferred_meal_count : typeof row2?.preferred_meal_count === "string" ? Number(row2.preferred_meal_count) : null
  });
  const excludedFdcIds = [
    ...new Set([
      ...Array.isArray(planMerged.excludedFdcIds) ? planMerged.excludedFdcIds : [],
      ...readExcludedFdcIds(row2?.nutrition_config ?? null)
    ].filter((n) => Number.isFinite(n)))
  ];
  const excludedFoodLabels = readExcludedFoodLabels(row2?.nutrition_config ?? null);
  const foodExclusions = (() => {
    const base = Array.isArray(planMerged.foodExclusions) ? planMerged.foodExclusions : null;
    if (excludedFoodLabels.length === 0) return planMerged.foodExclusions ?? null;
    const out = [];
    const seen = /* @__PURE__ */ new Set();
    for (const raw of [...base ?? [], ...excludedFoodLabels]) {
      const s = String(raw).trim();
      if (!s) continue;
      const key = s.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(s);
    }
    return out;
  })();
  const planFromDiet = {
    ...planMerged,
    athleteId,
    planDate,
    slots: reconciled.slots,
    excludedFdcIds,
    foodExclusions,
    dietType: row2?.diet_type != null ? String(row2.diet_type) : planMerged.dietType,
    mealPlanSolverMeta: {
      ...planMerged.mealPlanSolverMeta,
      dailyMealsKcalTotal: Math.round(dailyMealsKcalTotal),
      integrationLeverLines: [
        ...planMerged.mealPlanSolverMeta?.integrationLeverLines ?? [],
        ...reconciled.rebuiltFromDiet ? [`Diet ${reconciled.mealCountMode} pasti (${reconciled.slots.length} slot) da athlete_profiles.`] : []
      ].slice(0, 16)
    }
  };
  const routineConfig = row2?.routine_config && typeof row2.routine_config === "object" && !Array.isArray(row2.routine_config) ? row2.routine_config : null;
  const raceSessions = plannedSessionsForRaceFromDbRows(Array.isArray(plannedRows) ? plannedRows : []);
  const withRace = enrichIntelligentMealPlanRequestWithRaceDay({
    request: planFromDiet,
    routineConfig,
    weightKg: row2?.weight_kg,
    plannedSessions: raceSessions
  });
  const request = applyMealSlotRulesToIntelligentMealPlanRequest(filterIntelligentMealPlanRequestFoods(withRace));
  if (request.athleteId !== athleteId) return { error: "athleteId mismatch", status: 400 };
  if (!Array.isArray(request.slots) || request.slots.length < 3 || request.slots.length > 6) {
    return { error: "plan.slots: da 3 a 6 pasti (Profile Diet)", status: 400 };
  }
  if (!request.mealPlanSolverMeta || typeof request.mealPlanSolverMeta.dailyMealsKcalTotal !== "number" || !Array.isArray(request.mealPlanSolverMeta.integrationLeverLines)) {
    return { error: "plan.mealPlanSolverMeta obbligatorio", status: 400 };
  }
  const dietDay = resolveNutritionDietDay(row2?.nutrition_config ?? null, planDate, {
    preferredMealCount: row2?.preferred_meal_count
  });
  const ftp = Number(row2?.ftp_watts) || 250;
  const weightKg = Number(row2?.weight_kg) || 70;
  const plannedSessions = (Array.isArray(plannedRows) ? plannedRows : []).map((pr, idx) => {
    const notes = String(pr.notes ?? "");
    const bs = parsePro2BuilderSessionFromNotes(notes || null);
    const m = resolvePlannedSessionMetrics({
      contract: bs,
      durationMinutesDb: Number(pr.duration_minutes) || 0,
      tssTargetDb: Number(pr.tss_target) || 0,
      kcalTargetDb: Number(pr.kcal_target) || 0,
      athleteFtpWatts: ftp
    });
    return {
      label: `${String(pr.type ?? "session")} #${idx + 1} \xB7 ${m.avgPowerW ?? "?"}W \xB7 ${m.durationMinutes}min`,
      avgPowerW: m.avgPowerW ?? Math.round(ftp * 0.75),
      durationMin: m.durationMinutes
    };
  });
  const sessions = plannedSessions.length > 0 ? plannedSessions : extractPlannedSessionsFromRequest(request, ftp);
  const perfRaw = body.plan?.performanceIntegration ?? request.performanceIntegration;
  const performanceIntegration = perfRaw && typeof perfRaw === "object" && !Array.isArray(perfRaw) ? perfRaw : null;
  return {
    request,
    athleteId,
    planDate,
    profileRow: row2,
    dietDay,
    plannedSessions: sessions,
    ftp,
    weightKg,
    performanceIntegration
  };
}

// apps/web/lib/nutrition/v2/apply-performance-integration-fueling.ts
function round4(n, d = 1) {
  const f = 10 ** d;
  return Math.round(n * f) / f;
}
function applyPerformanceIntegrationToSubstrateFueling(requirements, integration) {
  const sf = requirements.substrateFueling;
  if (!sf?.sessions.length) return requirements;
  const scale = integration.fuelingChoScale ?? 1;
  if (scale === 1) {
    return {
      ...requirements,
      provenance: [
        ...requirements.provenance,
        `Integrazione performance: CHO/h fueling \xD7${scale} (informativo recovery/bio).`,
        ...integration.rationale.slice(0, 3)
      ]
    };
  }
  const sessions = sf.sessions.map((s) => {
    const intraChoG2 = round4(s.intraChoG * scale);
    const intraChoGPerH = s.durationH > 0 ? round4(intraChoG2 / s.durationH) : 0;
    return {
      ...s,
      intraChoG: intraChoG2,
      intraChoGPerH
    };
  });
  const intraChoG = round4(sessions.reduce((sum, x) => sum + x.intraChoG, 0));
  const fuelingKcal = Math.round(sf.totals.preChoG * 4 + intraChoG * 4 + sf.totals.postChoG * 4);
  const mealsKcal = Math.max(800, Math.round(requirements.energy.dailyKcal - fuelingKcal));
  return {
    ...requirements,
    energy: {
      ...requirements.energy,
      mealsKcal,
      fuelingKcal
    },
    substrateFueling: {
      ...sf,
      sessions,
      totals: {
        ...sf.totals,
        intraChoG,
        fuelingKcal
      }
    },
    provenance: [
      ...requirements.provenance,
      `Integrazione performance: intra CHO scalato \xD7${scale} (cap evidence in composer fueling).`,
      ...integration.rationale.slice(0, 3)
    ]
  };
}

// apps/web/lib/nutrition/v2/nutrition-day-model-v2.ts
function buildNutritionDayModelV2(input) {
  const base = buildDailyNutritionRequirementsV2(input);
  if (!input.performanceIntegration || !base.substrateFueling) {
    return { requirements: base };
  }
  const adjusted = applyPerformanceIntegrationToSubstrateFueling(base, input.performanceIntegration);
  return { requirements: adjusted };
}

// apps/web/lib/nutrition/meal-composition-rules.ts
var MAIN_MEAL_SLOTS = /* @__PURE__ */ new Set(["lunch", "dinner"]);
var FRUIT_CANONICAL_KEYS = /* @__PURE__ */ new Set([
  "banana",
  "mixed_fruit",
  "orange_raw",
  "kiwi_raw",
  "strawberries_raw",
  "jam_fruit"
]);
var VEG_CANONICAL_KEYS = /* @__PURE__ */ new Set([
  "mixed_veg",
  "spinach_raw",
  "broccoli_raw",
  "zucchini_raw",
  "bell_pepper_red",
  "carrot_raw",
  "tomato_raw",
  "asparagus_raw",
  "arugula_raw",
  "lettuce_romaine"
]);
var MAIN_ROLE_CAPS = {
  cho_complex: 2,
  cho_simple: 0,
  protein_primary: 1,
  protein_secondary: 1,
  fat: 2,
  veg_condiment: 3,
  composite_dish: 1,
  beverage: 0
};
var ROTATION_TARGET_WEEK_USES = 2;
var ROTATION_MAX_WEEK_USES = 3;
function isMainMealSlot(slot) {
  return MAIN_MEAL_SLOTS.has(slot);
}
function isFruitCanonicalKey(key) {
  return typeof key === "string" && FRUIT_CANONICAL_KEYS.has(key);
}
function isVegCanonicalKey(key) {
  return typeof key === "string" && VEG_CANONICAL_KEYS.has(key);
}

// apps/web/lib/nutrition/canonical-food-composition.ts
var Z = {
  kcalPer100g: 0,
  proteinG: 0,
  carbsG: 0,
  fatG: 0,
  fiberG: 0,
  saturatedFatG: 0,
  monoFatG: 0,
  polyFatG: 0,
  omega3G: 0,
  vitA_mcg_RAE: 0,
  vitC_mg: 0,
  vitD_mcg: 0,
  vitE_mg: 0,
  vitK_mcg: 0,
  thiamineB1_mg: 0,
  riboflavinB2_mg: 0,
  niacinB3_mg: 0,
  vitB6_mg: 0,
  folate_mcg: 0,
  vitB12_mcg: 0,
  ca_mg: 0,
  fe_mg: 0,
  mg_mg: 0,
  p_mg: 0,
  k_mg: 0,
  na_mg: 0,
  zn_mg: 0,
  se_mcg: 0,
  eaa_leu: 0,
  eaa_lys: 0,
  eaa_met: 0,
  eaa_phe: 0,
  eaa_thr: 0,
  eaa_trp: 0,
  eaa_ile: 0,
  eaa_val: 0,
  eaa_his: 0
};
function row(p) {
  return { ...Z, ...p };
}
var CANONICAL_FOOD_TABLE = {
  generic_mixed: row({
    kcalPer100g: 165,
    proteinG: 8,
    carbsG: 18,
    fatG: 6,
    fiberG: 2,
    saturatedFatG: 2,
    monoFatG: 2.2,
    polyFatG: 1.2,
    omega3G: 0.15,
    vitC_mg: 8,
    vitD_mcg: 0.3,
    folate_mcg: 35,
    ca_mg: 40,
    fe_mg: 1,
    mg_mg: 22,
    k_mg: 200,
    na_mg: 120,
    zn_mg: 0.6,
    eaa_leu: 0.55,
    eaa_lys: 0.45,
    eaa_met: 0.18,
    eaa_phe: 0.35,
    eaa_thr: 0.3,
    eaa_trp: 0.08,
    eaa_ile: 0.32,
    eaa_val: 0.38,
    eaa_his: 0.2
  }),
  milk_2pct: row({
    kcalPer100g: 52,
    proteinG: 3.3,
    carbsG: 4.9,
    fatG: 2,
    fiberG: 0,
    saturatedFatG: 1.2,
    monoFatG: 0.5,
    polyFatG: 0.1,
    omega3G: 0.03,
    vitA_mcg_RAE: 32,
    vitD_mcg: 1.1,
    vitB12_mcg: 0.45,
    riboflavinB2_mg: 0.17,
    ca_mg: 120,
    p_mg: 95,
    k_mg: 150,
    na_mg: 40,
    zn_mg: 0.4,
    eaa_leu: 0.27,
    eaa_lys: 0.22,
    eaa_met: 0.08,
    eaa_phe: 0.16,
    eaa_thr: 0.14,
    eaa_trp: 0.04,
    eaa_ile: 0.15,
    eaa_val: 0.18,
    eaa_his: 0.09
  }),
  /** Latte di capra (stime educative / USDA-like, per 100 ml ≈ 100 g). */
  milk_goat: row({
    kcalPer100g: 69,
    proteinG: 3.6,
    carbsG: 4.5,
    fatG: 4.1,
    fiberG: 0,
    saturatedFatG: 2.7,
    monoFatG: 1,
    polyFatG: 0.15,
    omega3G: 0.04,
    vitA_mcg_RAE: 28,
    vitD_mcg: 0.6,
    vitB12_mcg: 0.05,
    riboflavinB2_mg: 0.14,
    ca_mg: 134,
    p_mg: 111,
    k_mg: 135,
    na_mg: 50,
    zn_mg: 0.34,
    eaa_leu: 0.29,
    eaa_lys: 0.24,
    eaa_met: 0.09,
    eaa_phe: 0.17,
    eaa_thr: 0.15,
    eaa_trp: 0.05,
    eaa_ile: 0.16,
    eaa_val: 0.19,
    eaa_his: 0.1
  }),
  oat_dry: row({
    kcalPer100g: 389,
    proteinG: 13,
    carbsG: 66,
    fatG: 7,
    fiberG: 11,
    saturatedFatG: 1.2,
    monoFatG: 2.2,
    polyFatG: 2.5,
    omega3G: 0.45,
    folate_mcg: 32,
    mg_mg: 138,
    p_mg: 410,
    k_mg: 360,
    zn_mg: 3.6,
    fe_mg: 4,
    eaa_leu: 0.95,
    eaa_lys: 0.55,
    eaa_met: 0.25,
    eaa_phe: 0.7,
    eaa_thr: 0.45,
    eaa_trp: 0.18,
    eaa_ile: 0.5,
    eaa_val: 0.75,
    eaa_his: 0.35
  }),
  /** Marmellata di frutta (~250 kcal/100g, prevalentemente zucchero + frutta).
   *  USDA FDC 168989 "Jams and preserves" media. */
  jam_fruit: row({
    kcalPer100g: 250,
    proteinG: 0.4,
    carbsG: 62,
    fatG: 0.1,
    fiberG: 1.1,
    saturatedFatG: 0,
    ca_mg: 20,
    k_mg: 77,
    vitC_mg: 8,
    na_mg: 32
  }),
  /** Crostata / torta semplice pre-gara (densità CHO, basso volume fibra vs verdure). */
  crostata_torta_cho: row({
    kcalPer100g: 320,
    proteinG: 5,
    carbsG: 48,
    fatG: 12,
    fiberG: 1.5,
    saturatedFatG: 4,
    monoFatG: 4,
    polyFatG: 1.5,
    na_mg: 180
  }),
  /** Tofu compatto preparato con solfato di calcio (USDA FDC 172476, 100 g). */
  tofu_firm: row({
    kcalPer100g: 144,
    proteinG: 17.3,
    carbsG: 2.8,
    fatG: 8.7,
    fiberG: 2.3,
    saturatedFatG: 1.3,
    monoFatG: 1.9,
    polyFatG: 4.9,
    omega3G: 0.6,
    ca_mg: 683,
    fe_mg: 2.7,
    mg_mg: 58,
    p_mg: 190,
    k_mg: 121,
    na_mg: 14,
    zn_mg: 1.6,
    se_mcg: 17,
    folate_mcg: 19,
    eaa_leu: 1.38,
    eaa_lys: 1.13,
    eaa_met: 0.22,
    eaa_phe: 0.89,
    eaa_thr: 0.71,
    eaa_trp: 0.27,
    eaa_ile: 0.81,
    eaa_val: 0.85,
    eaa_his: 0.45
  }),
  /** Tempeh (USDA FDC 172475, 100 g). */
  tempeh: row({
    kcalPer100g: 192,
    proteinG: 20.3,
    carbsG: 7.6,
    fatG: 10.8,
    fiberG: 0,
    saturatedFatG: 2.5,
    monoFatG: 3,
    polyFatG: 4.3,
    omega3G: 0.18,
    ca_mg: 111,
    fe_mg: 2.7,
    mg_mg: 81,
    p_mg: 266,
    k_mg: 412,
    na_mg: 9,
    zn_mg: 1.1,
    se_mcg: 0,
    folate_mcg: 24,
    eaa_leu: 1.6,
    eaa_lys: 0.91,
    eaa_met: 0.18,
    eaa_phe: 1.04,
    eaa_thr: 0.8,
    eaa_trp: 0.19,
    eaa_ile: 0.88,
    eaa_val: 0.92,
    eaa_his: 0.55
  }),
  /** Seitan (glutine di frumento cotto, stime educative da USDA-like). */
  seitan: row({
    kcalPer100g: 142,
    proteinG: 25,
    carbsG: 9,
    fatG: 1.5,
    fiberG: 0.6,
    saturatedFatG: 0.2,
    monoFatG: 0.2,
    polyFatG: 0.8,
    ca_mg: 28,
    fe_mg: 1.4,
    mg_mg: 25,
    p_mg: 90,
    k_mg: 100,
    na_mg: 29,
    zn_mg: 0.7,
    folate_mcg: 12,
    eaa_leu: 1.75,
    eaa_lys: 0.4,
    eaa_met: 0.4,
    eaa_phe: 1.3,
    eaa_thr: 0.65,
    eaa_trp: 0.25,
    eaa_ile: 0.95,
    eaa_val: 1.05,
    eaa_his: 0.5
  }),
  /** Bevanda di mandorla non zuccherata fortificata (USDA-like 12087.0). */
  plant_drink_almond: row({
    kcalPer100g: 24,
    proteinG: 1,
    carbsG: 0.6,
    fatG: 2.2,
    fiberG: 0.4,
    saturatedFatG: 0.2,
    monoFatG: 1.4,
    polyFatG: 0.6,
    ca_mg: 188,
    vitD_mcg: 1,
    vitB12_mcg: 1.2,
    riboflavinB2_mg: 0.5,
    k_mg: 67,
    na_mg: 72,
    zn_mg: 0.2
  }),
  /** Bevanda di riso non zuccherata (USDA-like 14642.0). */
  plant_drink_rice: row({
    kcalPer100g: 47,
    proteinG: 0.3,
    carbsG: 9.2,
    fatG: 1,
    fiberG: 0.3,
    saturatedFatG: 0.1,
    monoFatG: 0.6,
    polyFatG: 0.3,
    ca_mg: 118,
    vitD_mcg: 1,
    vitB12_mcg: 1.5,
    riboflavinB2_mg: 0.14,
    k_mg: 27,
    na_mg: 39
  }),
  /** Bevanda d'avena non zuccherata (stime educative). */
  plant_drink_oat: row({
    kcalPer100g: 45,
    proteinG: 1,
    carbsG: 6.7,
    fatG: 1.5,
    fiberG: 0.8,
    saturatedFatG: 0.2,
    monoFatG: 0.7,
    polyFatG: 0.4,
    ca_mg: 120,
    vitD_mcg: 1.1,
    vitB12_mcg: 0.4,
    riboflavinB2_mg: 0.21,
    k_mg: 145,
    na_mg: 90
  }),
  /** Bevanda vegetale generica (media tra soia/avena/riso/mandorla). */
  plant_drink_generic: row({
    kcalPer100g: 35,
    proteinG: 1.5,
    carbsG: 3.5,
    fatG: 1.8,
    fiberG: 0.4,
    saturatedFatG: 0.2,
    monoFatG: 0.9,
    polyFatG: 0.4,
    ca_mg: 120,
    vitD_mcg: 1,
    vitB12_mcg: 0.4,
    k_mg: 100,
    na_mg: 60
  }),
  yogurt_plain: row({
    kcalPer100g: 75,
    proteinG: 4.5,
    carbsG: 5.5,
    fatG: 3.5,
    saturatedFatG: 2.2,
    monoFatG: 0.9,
    polyFatG: 0.1,
    ca_mg: 120,
    p_mg: 110,
    k_mg: 160,
    zn_mg: 0.6,
    vitB12_mcg: 0.35,
    riboflavinB2_mg: 0.15,
    eaa_leu: 0.35,
    eaa_lys: 0.3,
    eaa_met: 0.12,
    eaa_phe: 0.2,
    eaa_thr: 0.18,
    eaa_trp: 0.05,
    eaa_ile: 0.22,
    eaa_val: 0.28,
    eaa_his: 0.11
  }),
  banana: row({
    kcalPer100g: 89,
    proteinG: 1.1,
    carbsG: 23,
    fatG: 0.3,
    fiberG: 2.6,
    vitC_mg: 9,
    vitB6_mg: 0.4,
    folate_mcg: 20,
    k_mg: 360,
    mg_mg: 27,
    eaa_leu: 0.05,
    eaa_lys: 0.04,
    eaa_met: 0.01,
    eaa_phe: 0.04,
    eaa_thr: 0.03,
    eaa_trp: 0.01,
    eaa_ile: 0.03,
    eaa_val: 0.05,
    eaa_his: 0.04
  }),
  mixed_fruit: row({
    kcalPer100g: 52,
    proteinG: 0.7,
    carbsG: 13,
    fatG: 0.2,
    fiberG: 2,
    vitC_mg: 35,
    folate_mcg: 18,
    k_mg: 200,
    eaa_leu: 0.03,
    eaa_lys: 0.03,
    eaa_met: 0.01,
    eaa_phe: 0.03,
    eaa_thr: 0.02,
    eaa_trp: 0.01,
    eaa_ile: 0.02,
    eaa_val: 0.03,
    eaa_his: 0.02
  }),
  egg_whole: row({
    kcalPer100g: 143,
    proteinG: 13,
    carbsG: 1.1,
    fatG: 9.5,
    saturatedFatG: 3.2,
    monoFatG: 3.7,
    polyFatG: 1.4,
    omega3G: 0.08,
    vitA_mcg_RAE: 160,
    vitD_mcg: 2,
    vitB12_mcg: 1.1,
    folate_mcg: 47,
    se_mcg: 15,
    p_mg: 200,
    k_mg: 130,
    na_mg: 140,
    zn_mg: 1.3,
    eaa_leu: 0.95,
    eaa_lys: 0.75,
    eaa_met: 0.38,
    eaa_phe: 0.55,
    eaa_thr: 0.5,
    eaa_trp: 0.17,
    eaa_ile: 0.55,
    eaa_val: 0.7,
    eaa_his: 0.3
  }),
  bread_white: row({
    kcalPer100g: 265,
    proteinG: 9,
    carbsG: 49,
    fatG: 3.2,
    fiberG: 2.7,
    saturatedFatG: 0.6,
    monoFatG: 0.5,
    polyFatG: 1.4,
    folate_mcg: 85,
    na_mg: 450,
    fe_mg: 3,
    eaa_leu: 0.6,
    eaa_lys: 0.25,
    eaa_met: 0.15,
    eaa_phe: 0.4,
    eaa_thr: 0.28,
    eaa_trp: 0.12,
    eaa_ile: 0.35,
    eaa_val: 0.42,
    eaa_his: 0.2
  }),
  pasta_cooked: row({
    kcalPer100g: 131,
    proteinG: 5,
    carbsG: 25,
    fatG: 1.1,
    fiberG: 1.8,
    folate_mcg: 18,
    fe_mg: 0.5,
    mg_mg: 18,
    p_mg: 45,
    eaa_leu: 0.35,
    eaa_lys: 0.2,
    eaa_met: 0.1,
    eaa_phe: 0.28,
    eaa_thr: 0.2,
    eaa_trp: 0.08,
    eaa_ile: 0.22,
    eaa_val: 0.3,
    eaa_his: 0.14
  }),
  rice_cooked: row({
    kcalPer100g: 130,
    proteinG: 2.7,
    carbsG: 28,
    fatG: 0.3,
    fiberG: 0.4,
    folate_mcg: 3,
    mg_mg: 12,
    p_mg: 43,
    k_mg: 35,
    na_mg: 1,
    eaa_leu: 0.18,
    eaa_lys: 0.1,
    eaa_met: 0.06,
    eaa_phe: 0.15,
    eaa_thr: 0.1,
    eaa_trp: 0.03,
    eaa_ile: 0.12,
    eaa_val: 0.18,
    eaa_his: 0.08
  }),
  potato_cooked: row({
    kcalPer100g: 87,
    proteinG: 1.9,
    carbsG: 20,
    fatG: 0.1,
    fiberG: 1.8,
    vitC_mg: 13,
    vitB6_mg: 0.3,
    k_mg: 380,
    mg_mg: 23,
    p_mg: 44,
    folate_mcg: 10,
    eaa_leu: 0.1,
    eaa_lys: 0.1,
    eaa_met: 0.03,
    eaa_phe: 0.12,
    eaa_thr: 0.08,
    eaa_trp: 0.03,
    eaa_ile: 0.07,
    eaa_val: 0.12,
    eaa_his: 0.05
  }),
  farro_cooked: row({
    kcalPer100g: 125,
    proteinG: 4.5,
    carbsG: 26,
    fatG: 1,
    fiberG: 3.5,
    mg_mg: 40,
    zn_mg: 1.2,
    fe_mg: 1,
    eaa_leu: 0.32,
    eaa_lys: 0.2,
    eaa_met: 0.1,
    eaa_phe: 0.25,
    eaa_thr: 0.18,
    eaa_trp: 0.07,
    eaa_ile: 0.2,
    eaa_val: 0.28,
    eaa_his: 0.12
  }),
  pasta_dry: row({
    kcalPer100g: 371,
    proteinG: 13,
    carbsG: 75,
    fatG: 1.5,
    fiberG: 3.2,
    folate_mcg: 237,
    fe_mg: 3.3,
    mg_mg: 53,
    p_mg: 189,
    eaa_leu: 0.85,
    eaa_lys: 0.35,
    eaa_met: 0.22,
    eaa_phe: 0.58,
    eaa_thr: 0.42,
    eaa_trp: 0.16,
    eaa_ile: 0.52,
    eaa_val: 0.58,
    eaa_his: 0.28
  }),
  rice_dry: row({
    kcalPer100g: 365,
    proteinG: 7.1,
    carbsG: 80,
    fatG: 0.7,
    fiberG: 1.3,
    folate_mcg: 8,
    mg_mg: 25,
    p_mg: 115,
    k_mg: 115,
    na_mg: 5,
    eaa_leu: 0.55,
    eaa_lys: 0.28,
    eaa_met: 0.18,
    eaa_phe: 0.38,
    eaa_thr: 0.26,
    eaa_trp: 0.1,
    eaa_ile: 0.32,
    eaa_val: 0.48,
    eaa_his: 0.22
  }),
  farro_dry: row({
    kcalPer100g: 338,
    proteinG: 14,
    carbsG: 70,
    fatG: 2.2,
    fiberG: 10,
    mg_mg: 60,
    zn_mg: 2.5,
    fe_mg: 2.5,
    eaa_leu: 0.95,
    eaa_lys: 0.42,
    eaa_met: 0.28,
    eaa_phe: 0.58,
    eaa_thr: 0.38,
    eaa_trp: 0.14,
    eaa_ile: 0.48,
    eaa_val: 0.62,
    eaa_his: 0.3
  }),
  /**
   * Quinoa cruda (USDA FDC SR Legacy ~368 kcal/100g, profilo AA completo).
   * Sorgente: USDA FoodData Central — quinoa, uncooked (FDC ID 168874).
   * Usato come 5° amido complesso nella rotazione settimanale del composer.
   */
  quinoa_dry: row({
    kcalPer100g: 368,
    proteinG: 14.1,
    carbsG: 64.2,
    fatG: 6.1,
    fiberG: 7,
    mg_mg: 197,
    zn_mg: 3.1,
    fe_mg: 4.6,
    p_mg: 457,
    k_mg: 563,
    eaa_leu: 0.84,
    eaa_lys: 0.77,
    eaa_met: 0.31,
    eaa_phe: 0.59,
    eaa_thr: 0.42,
    eaa_trp: 0.17,
    eaa_ile: 0.5,
    eaa_val: 0.59,
    eaa_his: 0.41
  }),
  chicken_breast: row({
    kcalPer100g: 165,
    proteinG: 31,
    fatG: 3.6,
    saturatedFatG: 1,
    monoFatG: 1.2,
    polyFatG: 0.8,
    vitB6_mg: 0.6,
    niacinB3_mg: 14,
    vitB12_mcg: 0.3,
    p_mg: 240,
    k_mg: 256,
    zn_mg: 1,
    se_mcg: 22,
    eaa_leu: 2.1,
    eaa_lys: 1.9,
    eaa_met: 0.65,
    eaa_phe: 1,
    eaa_thr: 1.1,
    eaa_trp: 0.3,
    eaa_ile: 1.2,
    eaa_val: 1.25,
    eaa_his: 0.75
  }),
  fish_white: row({
    kcalPer100g: 140,
    proteinG: 24,
    fatG: 4,
    saturatedFatG: 0.8,
    monoFatG: 1.4,
    polyFatG: 1.2,
    omega3G: 0.6,
    vitD_mcg: 4,
    vitB12_mcg: 2.5,
    se_mcg: 36,
    p_mg: 220,
    k_mg: 320,
    na_mg: 60,
    zn_mg: 0.5,
    eaa_leu: 1.8,
    eaa_lys: 1.7,
    eaa_met: 0.65,
    eaa_phe: 0.85,
    eaa_thr: 0.95,
    eaa_trp: 0.25,
    eaa_ile: 1,
    eaa_val: 1.1,
    eaa_his: 0.55
  }),
  beef_lean: row({
    kcalPer100g: 180,
    proteinG: 26,
    fatG: 8,
    saturatedFatG: 3.2,
    monoFatG: 3.4,
    polyFatG: 0.4,
    vitB12_mcg: 2.4,
    zn_mg: 5,
    fe_mg: 2.4,
    p_mg: 200,
    k_mg: 315,
    se_mcg: 20,
    eaa_leu: 1.9,
    eaa_lys: 1.8,
    eaa_met: 0.55,
    eaa_phe: 0.9,
    eaa_thr: 1,
    eaa_trp: 0.25,
    eaa_ile: 1.05,
    eaa_val: 1.15,
    eaa_his: 0.7
  }),
  legumes_cooked: row({
    kcalPer100g: 120,
    proteinG: 8,
    carbsG: 20,
    fatG: 0.5,
    fiberG: 7,
    saturatedFatG: 0.1,
    monoFatG: 0.1,
    polyFatG: 0.25,
    folate_mcg: 120,
    fe_mg: 2.5,
    mg_mg: 45,
    k_mg: 280,
    zn_mg: 1.5,
    p_mg: 140,
    eaa_leu: 0.55,
    eaa_lys: 0.5,
    eaa_met: 0.12,
    eaa_phe: 0.45,
    eaa_thr: 0.35,
    eaa_trp: 0.1,
    eaa_ile: 0.38,
    eaa_val: 0.45,
    eaa_his: 0.28
  }),
  mixed_veg: row({
    kcalPer100g: 35,
    proteinG: 2,
    carbsG: 6,
    fatG: 0.3,
    fiberG: 2.5,
    vitA_mcg_RAE: 180,
    vitC_mg: 28,
    vitK_mcg: 180,
    folate_mcg: 60,
    k_mg: 300,
    mg_mg: 25,
    fe_mg: 1.2,
    eaa_leu: 0.12,
    eaa_lys: 0.12,
    eaa_met: 0.03,
    eaa_phe: 0.1,
    eaa_thr: 0.08,
    eaa_trp: 0.02,
    eaa_ile: 0.08,
    eaa_val: 0.12,
    eaa_his: 0.05
  }),
  olive_oil: row({
    kcalPer100g: 884,
    proteinG: 0,
    carbsG: 0,
    fatG: 100,
    saturatedFatG: 14,
    monoFatG: 73,
    polyFatG: 11,
    omega3G: 0.76,
    vitE_mg: 14,
    vitK_mcg: 60,
    eaa_leu: 0,
    eaa_lys: 0,
    eaa_met: 0,
    eaa_phe: 0,
    eaa_thr: 0,
    eaa_trp: 0,
    eaa_ile: 0,
    eaa_val: 0,
    eaa_his: 0
  }),
  cheese_hard: row({
    kcalPer100g: 400,
    proteinG: 32,
    fatG: 30,
    saturatedFatG: 18,
    monoFatG: 8,
    polyFatG: 1,
    ca_mg: 700,
    vitA_mcg_RAE: 250,
    vitB12_mcg: 1.4,
    zn_mg: 3.5,
    p_mg: 550,
    na_mg: 650,
    se_mcg: 15,
    eaa_leu: 2.4,
    eaa_lys: 2,
    eaa_met: 0.75,
    eaa_phe: 1.35,
    eaa_thr: 1.1,
    eaa_trp: 0.45,
    eaa_ile: 1.3,
    eaa_val: 1.65,
    eaa_his: 0.85
  }),
  avocado: row({
    kcalPer100g: 160,
    proteinG: 2,
    carbsG: 9,
    fatG: 15,
    fiberG: 7,
    saturatedFatG: 2.1,
    monoFatG: 10,
    polyFatG: 1.8,
    omega3G: 0.11,
    vitK_mcg: 21,
    folate_mcg: 81,
    k_mg: 485,
    mg_mg: 29,
    vitE_mg: 2,
    eaa_leu: 0.12,
    eaa_lys: 0.12,
    eaa_met: 0.04,
    eaa_phe: 0.12,
    eaa_thr: 0.08,
    eaa_trp: 0.03,
    eaa_ile: 0.08,
    eaa_val: 0.12,
    eaa_his: 0.05
  }),
  crackers_whole: row({
    kcalPer100g: 416,
    proteinG: 10,
    carbsG: 69,
    fatG: 10,
    fiberG: 8,
    saturatedFatG: 2,
    monoFatG: 3,
    polyFatG: 4,
    na_mg: 600,
    fe_mg: 2.5,
    mg_mg: 70,
    folate_mcg: 40,
    eaa_leu: 0.65,
    eaa_lys: 0.3,
    eaa_met: 0.2,
    eaa_phe: 0.45,
    eaa_thr: 0.32,
    eaa_trp: 0.14,
    eaa_ile: 0.38,
    eaa_val: 0.48,
    eaa_his: 0.24
  }),
  deli_lean: row({
    kcalPer100g: 120,
    proteinG: 20,
    fatG: 4,
    saturatedFatG: 1.4,
    monoFatG: 1.6,
    polyFatG: 0.6,
    na_mg: 900,
    vitB12_mcg: 0.5,
    zn_mg: 1.5,
    p_mg: 200,
    se_mcg: 12,
    eaa_leu: 1.4,
    eaa_lys: 1.35,
    eaa_met: 0.45,
    eaa_phe: 0.75,
    eaa_thr: 0.8,
    eaa_trp: 0.2,
    eaa_ile: 0.85,
    eaa_val: 0.9,
    eaa_his: 0.5
  }),
  whey_powder: row({
    kcalPer100g: 400,
    proteinG: 80,
    carbsG: 6,
    fatG: 5,
    fiberG: 0,
    saturatedFatG: 2.5,
    monoFatG: 1,
    polyFatG: 0.5,
    ca_mg: 400,
    p_mg: 300,
    k_mg: 500,
    zn_mg: 2,
    vitB12_mcg: 1,
    eaa_leu: 6.5,
    eaa_lys: 5.5,
    eaa_met: 1.6,
    eaa_phe: 1.8,
    eaa_thr: 4.2,
    eaa_trp: 1.2,
    eaa_ile: 3.8,
    eaa_val: 3.5,
    eaa_his: 1.2
  }),
  omega_capsule: row({
    kcalPer100g: 900,
    proteinG: 0,
    carbsG: 0,
    fatG: 100,
    saturatedFatG: 10,
    monoFatG: 30,
    polyFatG: 55,
    omega3G: 30,
    vitE_mg: 10,
    vitA_mcg_RAE: 300,
    eaa_leu: 0,
    eaa_lys: 0,
    eaa_met: 0,
    eaa_phe: 0,
    eaa_thr: 0,
    eaa_trp: 0,
    eaa_ile: 0,
    eaa_val: 0,
    eaa_his: 0
  }),
  // --- Verdure distinte (micro densi; pathway + rotazione pranzo/cena) ---
  spinach_raw: row({
    kcalPer100g: 23,
    proteinG: 2.9,
    carbsG: 3.6,
    fatG: 0.4,
    fiberG: 2.2,
    vitA_mcg_RAE: 469,
    vitC_mg: 28,
    vitK_mcg: 483,
    folate_mcg: 194,
    fe_mg: 2.7,
    mg_mg: 79,
    k_mg: 558,
    ca_mg: 99,
    zn_mg: 0.5,
    eaa_leu: 0.18,
    eaa_lys: 0.16,
    eaa_met: 0.04,
    eaa_phe: 0.12,
    eaa_thr: 0.1,
    eaa_trp: 0.03,
    eaa_ile: 0.1,
    eaa_val: 0.14,
    eaa_his: 0.06
  }),
  kale_raw: row({
    kcalPer100g: 35,
    proteinG: 2.9,
    carbsG: 4.4,
    fatG: 1.5,
    fiberG: 4.1,
    vitA_mcg_RAE: 241,
    vitC_mg: 93,
    vitK_mcg: 390,
    folate_mcg: 62,
    fe_mg: 1.5,
    mg_mg: 33,
    k_mg: 348,
    ca_mg: 254,
    zn_mg: 0.4,
    eaa_leu: 0.16,
    eaa_lys: 0.14,
    eaa_met: 0.04,
    eaa_phe: 0.11,
    eaa_thr: 0.09,
    eaa_trp: 0.03,
    eaa_ile: 0.09,
    eaa_val: 0.13,
    eaa_his: 0.05
  }),
  broccoli_raw: row({
    kcalPer100g: 34,
    proteinG: 2.8,
    carbsG: 7,
    fatG: 0.4,
    fiberG: 2.6,
    vitA_mcg_RAE: 31,
    vitC_mg: 89,
    vitK_mcg: 102,
    folate_mcg: 63,
    fe_mg: 0.7,
    mg_mg: 21,
    k_mg: 316,
    ca_mg: 47,
    zn_mg: 0.4,
    eaa_leu: 0.14,
    eaa_lys: 0.13,
    eaa_met: 0.03,
    eaa_phe: 0.1,
    eaa_thr: 0.08,
    eaa_trp: 0.02,
    eaa_ile: 0.08,
    eaa_val: 0.11,
    eaa_his: 0.05
  }),
  bell_pepper_red: row({
    kcalPer100g: 31,
    proteinG: 1,
    carbsG: 6,
    fatG: 0.3,
    fiberG: 2.1,
    vitA_mcg_RAE: 157,
    vitC_mg: 128,
    folate_mcg: 46,
    fe_mg: 0.4,
    mg_mg: 12,
    k_mg: 211,
    eaa_leu: 0.05,
    eaa_lys: 0.05,
    eaa_met: 0.02,
    eaa_phe: 0.04,
    eaa_thr: 0.03,
    eaa_trp: 0.01,
    eaa_ile: 0.03,
    eaa_val: 0.04,
    eaa_his: 0.02
  }),
  asparagus_raw: row({
    kcalPer100g: 20,
    proteinG: 2.2,
    carbsG: 3.9,
    fatG: 0.1,
    fiberG: 2.1,
    vitA_mcg_RAE: 38,
    vitC_mg: 6,
    folate_mcg: 52,
    fe_mg: 2.1,
    mg_mg: 14,
    k_mg: 202,
    zn_mg: 0.5,
    eaa_leu: 0.1,
    eaa_lys: 0.09,
    eaa_met: 0.03,
    eaa_phe: 0.07,
    eaa_thr: 0.06,
    eaa_trp: 0.02,
    eaa_ile: 0.06,
    eaa_val: 0.08,
    eaa_his: 0.04
  }),
  beetroot_raw: row({
    kcalPer100g: 43,
    proteinG: 1.6,
    carbsG: 10,
    fatG: 0.2,
    fiberG: 2.8,
    vitC_mg: 4,
    folate_mcg: 109,
    fe_mg: 0.8,
    mg_mg: 23,
    k_mg: 325,
    zn_mg: 0.4,
    eaa_leu: 0.06,
    eaa_lys: 0.06,
    eaa_met: 0.02,
    eaa_phe: 0.05,
    eaa_thr: 0.04,
    eaa_trp: 0.01,
    eaa_ile: 0.04,
    eaa_val: 0.05,
    eaa_his: 0.02
  }),
  arugula_raw: row({
    kcalPer100g: 25,
    proteinG: 2.6,
    carbsG: 3.7,
    fatG: 0.7,
    fiberG: 1.6,
    vitA_mcg_RAE: 119,
    vitC_mg: 15,
    vitK_mcg: 109,
    folate_mcg: 97,
    fe_mg: 1.5,
    mg_mg: 47,
    k_mg: 369,
    ca_mg: 160,
    eaa_leu: 0.14,
    eaa_lys: 0.12,
    eaa_met: 0.03,
    eaa_phe: 0.09,
    eaa_thr: 0.07,
    eaa_trp: 0.02,
    eaa_ile: 0.07,
    eaa_val: 0.1,
    eaa_his: 0.04
  }),
  zucchini_raw: row({
    kcalPer100g: 17,
    proteinG: 1.2,
    carbsG: 3.1,
    fatG: 0.3,
    fiberG: 1,
    vitC_mg: 18,
    folate_mcg: 24,
    fe_mg: 0.4,
    mg_mg: 18,
    k_mg: 262,
    eaa_leu: 0.06,
    eaa_lys: 0.05,
    eaa_met: 0.02,
    eaa_phe: 0.04,
    eaa_thr: 0.03,
    eaa_trp: 0.01,
    eaa_ile: 0.03,
    eaa_val: 0.04,
    eaa_his: 0.02
  }),
  tomato_raw: row({
    kcalPer100g: 18,
    proteinG: 0.9,
    carbsG: 3.9,
    fatG: 0.2,
    fiberG: 1.2,
    vitA_mcg_RAE: 42,
    vitC_mg: 14,
    folate_mcg: 17,
    fe_mg: 0.3,
    mg_mg: 11,
    k_mg: 237,
    eaa_leu: 0.04,
    eaa_lys: 0.04,
    eaa_met: 0.01,
    eaa_phe: 0.03,
    eaa_thr: 0.02,
    eaa_trp: 0.01,
    eaa_ile: 0.02,
    eaa_val: 0.03,
    eaa_his: 0.02
  }),
  carrot_raw: row({
    kcalPer100g: 41,
    proteinG: 0.9,
    carbsG: 10,
    fatG: 0.2,
    fiberG: 2.8,
    vitA_mcg_RAE: 835,
    vitC_mg: 6,
    folate_mcg: 19,
    fe_mg: 0.3,
    mg_mg: 12,
    k_mg: 320,
    eaa_leu: 0.04,
    eaa_lys: 0.04,
    eaa_met: 0.01,
    eaa_phe: 0.03,
    eaa_thr: 0.02,
    eaa_trp: 0.01,
    eaa_ile: 0.02,
    eaa_val: 0.03,
    eaa_his: 0.02
  }),
  lettuce_romaine: row({
    kcalPer100g: 17,
    proteinG: 1.2,
    carbsG: 3.3,
    fatG: 0.3,
    fiberG: 2.1,
    vitA_mcg_RAE: 145,
    vitC_mg: 4,
    folate_mcg: 64,
    fe_mg: 0.9,
    mg_mg: 14,
    k_mg: 247,
    eaa_leu: 0.05,
    eaa_lys: 0.05,
    eaa_met: 0.02,
    eaa_phe: 0.04,
    eaa_thr: 0.03,
    eaa_trp: 0.01,
    eaa_ile: 0.03,
    eaa_val: 0.04,
    eaa_his: 0.02
  }),
  // --- Frutta distinta ---
  orange_raw: row({
    kcalPer100g: 47,
    proteinG: 0.9,
    carbsG: 12,
    fatG: 0.1,
    fiberG: 2.4,
    vitC_mg: 53,
    folate_mcg: 30,
    k_mg: 181,
    eaa_leu: 0.03,
    eaa_lys: 0.03,
    eaa_met: 0.01,
    eaa_phe: 0.02,
    eaa_thr: 0.02,
    eaa_trp: 0.01,
    eaa_ile: 0.02,
    eaa_val: 0.02,
    eaa_his: 0.01
  }),
  kiwi_raw: row({
    kcalPer100g: 61,
    proteinG: 1.1,
    carbsG: 15,
    fatG: 0.5,
    fiberG: 3,
    vitC_mg: 93,
    folate_mcg: 25,
    k_mg: 312,
    eaa_leu: 0.05,
    eaa_lys: 0.05,
    eaa_met: 0.02,
    eaa_phe: 0.04,
    eaa_thr: 0.03,
    eaa_trp: 0.01,
    eaa_ile: 0.03,
    eaa_val: 0.04,
    eaa_his: 0.02
  }),
  strawberries_raw: row({
    kcalPer100g: 32,
    proteinG: 0.7,
    carbsG: 7.7,
    fatG: 0.3,
    fiberG: 2,
    vitC_mg: 59,
    folate_mcg: 24,
    k_mg: 153,
    eaa_leu: 0.03,
    eaa_lys: 0.03,
    eaa_met: 0.01,
    eaa_phe: 0.02,
    eaa_thr: 0.02,
    eaa_trp: 0.01,
    eaa_ile: 0.02,
    eaa_val: 0.02,
    eaa_his: 0.01
  }),
  apple_raw: row({
    kcalPer100g: 52,
    proteinG: 0.3,
    carbsG: 14,
    fatG: 0.2,
    fiberG: 2.4,
    vitC_mg: 5,
    folate_mcg: 3,
    k_mg: 107,
    eaa_leu: 0.02,
    eaa_lys: 0.02,
    eaa_met: 0.01,
    eaa_phe: 0.02,
    eaa_thr: 0.01,
    eaa_trp: 0.01,
    eaa_ile: 0.01,
    eaa_val: 0.02,
    eaa_his: 0.01
  }),
  blueberries_raw: row({
    kcalPer100g: 57,
    proteinG: 0.7,
    carbsG: 14,
    fatG: 0.3,
    fiberG: 2.4,
    vitC_mg: 10,
    vitK_mcg: 19,
    folate_mcg: 6,
    k_mg: 77,
    eaa_leu: 0.03,
    eaa_lys: 0.03,
    eaa_met: 0.01,
    eaa_phe: 0.02,
    eaa_thr: 0.02,
    eaa_trp: 0.01,
    eaa_ile: 0.02,
    eaa_val: 0.02,
    eaa_his: 0.01
  }),
  pear_raw: row({
    kcalPer100g: 57,
    proteinG: 0.4,
    carbsG: 15,
    fatG: 0.1,
    fiberG: 3.1,
    vitC_mg: 4,
    folate_mcg: 7,
    k_mg: 116,
    eaa_leu: 0.02,
    eaa_lys: 0.02,
    eaa_met: 0.01,
    eaa_phe: 0.02,
    eaa_thr: 0.01,
    eaa_trp: 0.01,
    eaa_ile: 0.01,
    eaa_val: 0.02,
    eaa_his: 0.01
  }),
  // --- Legumi / semi / latticini spuntino ---
  chickpeas_cooked: row({
    kcalPer100g: 164,
    proteinG: 8.9,
    carbsG: 27,
    fatG: 2.6,
    fiberG: 7.6,
    folate_mcg: 172,
    fe_mg: 2.9,
    mg_mg: 48,
    k_mg: 291,
    zn_mg: 1.5,
    eaa_leu: 0.6,
    eaa_lys: 0.55,
    eaa_met: 0.14,
    eaa_phe: 0.48,
    eaa_thr: 0.38,
    eaa_trp: 0.1,
    eaa_ile: 0.42,
    eaa_val: 0.5,
    eaa_his: 0.3
  }),
  pumpkin_seeds_raw: row({
    kcalPer100g: 559,
    proteinG: 30,
    carbsG: 11,
    fatG: 49,
    fiberG: 6,
    saturatedFatG: 8.7,
    monoFatG: 16,
    polyFatG: 21,
    vitE_mg: 2.2,
    folate_mcg: 58,
    fe_mg: 8.8,
    mg_mg: 592,
    zn_mg: 7.6,
    k_mg: 809,
    eaa_leu: 1.8,
    eaa_lys: 1.5,
    eaa_met: 0.55,
    eaa_phe: 1.2,
    eaa_thr: 0.95,
    eaa_trp: 0.35,
    eaa_ile: 1.1,
    eaa_val: 1.35,
    eaa_his: 0.7
  }),
  almonds_raw: row({
    kcalPer100g: 579,
    proteinG: 21,
    carbsG: 22,
    fatG: 50,
    fiberG: 12,
    saturatedFatG: 3.8,
    monoFatG: 32,
    polyFatG: 12,
    vitE_mg: 25,
    folate_mcg: 44,
    fe_mg: 3.7,
    mg_mg: 270,
    zn_mg: 3.1,
    k_mg: 733,
    eaa_leu: 1.2,
    eaa_lys: 0.55,
    eaa_met: 0.25,
    eaa_phe: 0.95,
    eaa_thr: 0.55,
    eaa_trp: 0.2,
    eaa_ile: 0.65,
    eaa_val: 0.85,
    eaa_his: 0.45
  }),
  ricotta_cheese: row({
    kcalPer100g: 156,
    proteinG: 11,
    carbsG: 5,
    fatG: 10,
    saturatedFatG: 6.5,
    monoFatG: 2.8,
    polyFatG: 0.4,
    vitA_mcg_RAE: 120,
    vitB12_mcg: 0.4,
    ca_mg: 207,
    p_mg: 158,
    k_mg: 105,
    na_mg: 110,
    zn_mg: 0.5,
    eaa_leu: 0.85,
    eaa_lys: 0.75,
    eaa_met: 0.28,
    eaa_phe: 0.55,
    eaa_thr: 0.45,
    eaa_trp: 0.15,
    eaa_ile: 0.5,
    eaa_val: 0.6,
    eaa_his: 0.32
  }),
  cottage_cheese: row({
    kcalPer100g: 72,
    proteinG: 11,
    carbsG: 3.4,
    fatG: 1,
    saturatedFatG: 0.6,
    monoFatG: 0.3,
    polyFatG: 0.05,
    vitB12_mcg: 0.4,
    ca_mg: 61,
    p_mg: 130,
    k_mg: 86,
    na_mg: 330,
    zn_mg: 0.4,
    eaa_leu: 0.85,
    eaa_lys: 0.75,
    eaa_met: 0.28,
    eaa_phe: 0.55,
    eaa_thr: 0.45,
    eaa_trp: 0.15,
    eaa_ile: 0.5,
    eaa_val: 0.6,
    eaa_his: 0.32
  }),
  dark_chocolate_70: row({
    kcalPer100g: 598,
    proteinG: 7.8,
    carbsG: 46,
    fatG: 43,
    fiberG: 11,
    saturatedFatG: 24,
    monoFatG: 12,
    polyFatG: 1.4,
    fe_mg: 11,
    mg_mg: 228,
    zn_mg: 3.3,
    k_mg: 715,
    eaa_leu: 0.45,
    eaa_lys: 0.35,
    eaa_met: 0.12,
    eaa_phe: 0.32,
    eaa_thr: 0.25,
    eaa_trp: 0.1,
    eaa_ile: 0.28,
    eaa_val: 0.38,
    eaa_his: 0.18
  })
};
var INFER_RULES = [
  { test: /omega|epa|dha|capsula/i, key: "omega_capsule" },
  { test: /\bwhey\b|protein(e|a)?\s+in\s+polvere|protein\s+powder|polvere\s+protein/i, key: "whey_powder" },
  { test: /olio|evo|olive oil/i, key: "olive_oil" },
  /** Proteine vegetali strutturate (soia/glutine): rule prima delle generic "legum"
   *  e "verdur" cosi' non vengono mappate al gruppo sbagliato. Regression bug
   *  "Proteina vegetale: tofu 220 g -> 0 kcal" trovato dal guardrail memoria. */
  { test: /tofu/i, key: "tofu_firm" },
  { test: /tempeh/i, key: "tempeh" },
  { test: /seita[nm]|glutine\s+(?:vegetale|cotto|cucinato)|wheat\s+gluten/i, key: "seitan" },
  { test: /grana|parmigiano|formaggio/i, key: "cheese_hard" },
  { test: /avocado/i, key: "avocado" },
  { test: /gallette|cracker|fette\s+biscot|fetta\s+biscot|rusk|toast\s+secco/i, key: "crackers_whole" },
  { test: /marmellat|confettur|jam\b/i, key: "jam_fruit" },
  { test: /crostata|torta\s+(di\s+)?(mela|frutta|ricotta|semplice)|torta\s+al\s+cioccolato|dolce\s+da\s+forno/i, key: "crostata_torta_cho" },
  { test: /bresaola|prosciutto|affettato|mortadella|salame/i, key: "deli_lean" },
  /** Bevande vegetali: matchare PRIMA di "latte\b" generico per non cadere su milk_2pct.
   *  Le rule sono specifiche per ingrediente (mandorla/riso/avena) cosi' lo scaling USDA
   *  produce kcal realistiche. Fallback su plant_drink_generic per "bevanda vegetale". */
  { test: /bevanda\s+(?:di\s+)?mandorla|almond\s+(?:milk|drink|beverage)|latte\s+(?:di\s+)?mandorla/i, key: "plant_drink_almond" },
  { test: /bevanda\s+(?:di\s+)?riso|rice\s+(?:milk|drink|beverage)|latte\s+(?:di\s+)?riso/i, key: "plant_drink_rice" },
  { test: /bevanda\s+(?:d['’]?\s*)?avena|oat\s+(?:milk|drink|beverage)|latte\s+(?:d['’]?\s*)?avena|bevanda\s+vegetale.*avena/i, key: "plant_drink_oat" },
  { test: /bevanda\s+(?:di\s+)?soia|soy\s+(?:milk|drink|beverage)|latte\s+(?:di\s+)?soia/i, key: "plant_drink_generic" },
  { test: /bevanda\s+(?:di\s+)?cocco|coconut\s+(?:milk|drink|beverage)|latte\s+(?:di\s+)?cocco/i, key: "plant_drink_generic" },
  { test: /bevanda\s+vegetale|plant\s+(?:based\s+)?(?:milk|drink|beverage)/i, key: "plant_drink_generic" },
  { test: /latte di capra|latte caprina|goat milk|latte\s+di\s+capra/i, key: "milk_goat" },
  { test: /latte\b|milk/i, key: "milk_2pct" },
  { test: /yogurt|yoghurt|kefir/i, key: "yogurt_plain" },
  { test: /cereal|muesli|avena|fiocchi/i, key: "oat_dry" },
  { test: /banana/i, key: "banana" },
  { test: /uov|egg/i, key: "egg_whole" },
  { test: /pane|focaccia|bread|toast/i, key: "bread_white" },
  {
    test: /(pasta|spaghetti|penne|tagliatelle).*(cotto|cottura|peso\s*cotto|già\s*cotta|cooked)/i,
    key: "pasta_cooked"
  },
  { test: /pasta|spaghetti|penne|tagliatelle/i, key: "pasta_dry" },
  {
    test: /(riso|rice|basmati|jasmine).*(cotto|cottura|peso\s*cotto|già\s*cotto|cooked)/i,
    key: "rice_cooked"
  },
  { test: /riso|rice|basmati|jasmine/i, key: "rice_dry" },
  { test: /patat|potato/i, key: "potato_cooked" },
  {
    test: /quinoa/i,
    key: "quinoa_dry"
  },
  {
    test: /(farro|orzo|grano).*(cotto|cottura|peso\s*cotto|già\s*cotto|cooked)/i,
    key: "farro_cooked"
  },
  { test: /farro|orzo/i, key: "farro_dry" },
  { test: /pollo|chicken|tacchino|turkey|petto|fesa/i, key: "chicken_breast" },
  { test: /pesce|salmone|merluzz|tonno|fish|tuna|salmon|orata|branzino|spigola|nasello|sogliola|trota|sgombro|sardina|gamber|polpo|calamar/i, key: "fish_white" },
  { test: /manzo|beef|maiale|pork|agnello|lamb|carne|vitello|bovino|hamburger|filetto|bistecca/i, key: "beef_lean" },
  { test: /ricotta/i, key: "ricotta_cheese" },
  { test: /cottage/i, key: "cottage_cheese" },
  { test: /cioccolat|dark\s*chocolate|fondente/i, key: "dark_chocolate_70" },
  { test: /semi\s+di\s+zucca|pumpkin\s*seed/i, key: "pumpkin_seeds_raw" },
  { test: /mandorl|almond/i, key: "almonds_raw" },
  { test: /ceci|chickpea|garbanzo/i, key: "chickpeas_cooked" },
  { test: /legum|lenticch|fagiol|pisell/i, key: "legumes_cooked" },
  { test: /spinac/i, key: "spinach_raw" },
  { test: /kale|cavolo\s*nero/i, key: "kale_raw" },
  { test: /broccoli/i, key: "broccoli_raw" },
  { test: /asparag/i, key: "asparagus_raw" },
  { test: /barbabiet|beetroot|barbabietol/i, key: "beetroot_raw" },
  { test: /rucol|arugul|rocket/i, key: "arugula_raw" },
  { test: /peperone?\s+rosso|peperon\s+rosso|bell\s*pepper|pepper.*red/i, key: "bell_pepper_red" },
  { test: /zucchin/i, key: "zucchini_raw" },
  { test: /pomodor|tomato/i, key: "tomato_raw" },
  { test: /carot/i, key: "carrot_raw" },
  { test: /lattuga|romaine|insalata\s+romana/i, key: "lettuce_romaine" },
  { test: /verdur|insalat|peperon|melanz|carciof|verza|cavolf/i, key: "mixed_veg" },
  { test: /kiwi/i, key: "kiwi_raw" },
  { test: /arancia|orange|agrum/i, key: "orange_raw" },
  { test: /fragol|strawber/i, key: "strawberries_raw" },
  { test: /mirtill|blueberr/i, key: "blueberries_raw" },
  { test: /pera\b|pear/i, key: "pear_raw" },
  { test: /mela\b|apple/i, key: "apple_raw" },
  { test: /frutta|frutti di bosco|berry|berries/i, key: "mixed_fruit" }
];
function inferCanonicalFoodKey(label) {
  const t = label.trim();
  for (const r of INFER_RULES) {
    if (r.test.test(t)) return r.key;
  }
  return "generic_mixed";
}
function inferCanonicalFoodKeyPreferName(name, portionHint = "") {
  const fromName = inferCanonicalFoodKey(name);
  if (fromName !== "generic_mixed") return fromName;
  return inferCanonicalFoodKey(`${name} ${portionHint}`);
}
function scaleCanonicalNutrientsToKcal(row2, targetKcal) {
  const k = Math.max(15, Math.round(targetKcal));
  const dens = row2.kcalPer100g / 100;
  const factor = dens > 0 ? k / dens : 0;
  const f = factor / 100;
  const num3 = (v) => Math.round(v * f * 1e3) / 1e3;
  const numMicro = (v) => Math.round(v * f * 10) / 10;
  return {
    kcal: k,
    proteinG: num3(row2.proteinG),
    carbsG: num3(row2.carbsG),
    fatG: num3(row2.fatG),
    fiberG: num3(row2.fiberG),
    saturatedFatG: num3(row2.saturatedFatG),
    monoFatG: num3(row2.monoFatG),
    polyFatG: num3(row2.polyFatG),
    omega3G: num3(row2.omega3G),
    vitA_mcg_RAE: numMicro(row2.vitA_mcg_RAE),
    vitC_mg: numMicro(row2.vitC_mg),
    vitD_mcg: numMicro(row2.vitD_mcg),
    vitE_mg: numMicro(row2.vitE_mg),
    vitK_mcg: numMicro(row2.vitK_mcg),
    thiamineB1_mg: numMicro(row2.thiamineB1_mg),
    riboflavinB2_mg: numMicro(row2.riboflavinB2_mg),
    niacinB3_mg: numMicro(row2.niacinB3_mg),
    vitB6_mg: numMicro(row2.vitB6_mg),
    folate_mcg: numMicro(row2.folate_mcg),
    vitB12_mcg: numMicro(row2.vitB12_mcg),
    ca_mg: numMicro(row2.ca_mg),
    fe_mg: numMicro(row2.fe_mg),
    mg_mg: numMicro(row2.mg_mg),
    p_mg: numMicro(row2.p_mg),
    k_mg: numMicro(row2.k_mg),
    na_mg: numMicro(row2.na_mg),
    zn_mg: numMicro(row2.zn_mg),
    se_mcg: numMicro(row2.se_mcg),
    eaa_leu: num3(row2.eaa_leu),
    eaa_lys: num3(row2.eaa_lys),
    eaa_met: num3(row2.eaa_met),
    eaa_phe: num3(row2.eaa_phe),
    eaa_thr: num3(row2.eaa_thr),
    eaa_trp: num3(row2.eaa_trp),
    eaa_ile: num3(row2.eaa_ile),
    eaa_val: num3(row2.eaa_val),
    eaa_his: num3(row2.eaa_his),
    glycemicIndex: 0,
    insulinIndex: 0,
    glycemicLoad: 0
  };
}
var OLIVE_OIL_G_PER_ML = 0.92;
function parseExplicitGramsFromPortionHint(hint) {
  const m = hint.match(/(\d+(?:[.,]\d+)?)\s*g(?:rammi?)?\b/i);
  if (!m) return void 0;
  const v = parseFloat(m[1].replace(",", "."));
  if (!Number.isFinite(v) || v <= 0) return void 0;
  return v;
}
function parseMlFromPortionHint(hint) {
  const m = hint.match(/(\d+(?:[.,]\d+)?)\s*ml\b/i);
  if (!m) return void 0;
  const v = parseFloat(m[1].replace(",", "."));
  if (!Number.isFinite(v) || v <= 0) return void 0;
  return v;
}
function looksLikeMultiIngredientPortionHint(portionHint) {
  const hint = portionHint.trim();
  if (!hint) return false;
  if (hint.includes(" + ")) return true;
  const quantityMatches = hint.match(/\b\d+(?:[.,]\d+)?\s*(g(?:rammi?)?|ml)\b/gi) ?? [];
  return quantityMatches.length >= 2;
}
var LIQUID_DAIRY_G_PER_ML = 1.03;
var LIQUIDS_AS_GRAMS_KEYS = /* @__PURE__ */ new Set([
  "milk_2pct",
  "milk_goat",
  "yogurt_plain",
  "plant_drink_almond",
  "plant_drink_rice",
  "plant_drink_oat",
  "plant_drink_generic"
]);
function resolveServingGramsFromPortionHint(portionHint, compositionKey) {
  const hint = portionHint.trim();
  if (!hint) return void 0;
  if (looksLikeMultiIngredientPortionHint(hint)) return void 0;
  const g = parseExplicitGramsFromPortionHint(hint);
  if (g != null) return g;
  const ml = parseMlFromPortionHint(hint);
  if (ml == null) return void 0;
  if (compositionKey === "olive_oil") return ml * OLIVE_OIL_G_PER_ML;
  if (LIQUIDS_AS_GRAMS_KEYS.has(compositionKey)) return ml * LIQUID_DAIRY_G_PER_ML;
  return void 0;
}
function scaleCanonicalNutrientsToGrams(row2, gramsEdible) {
  const g = Math.max(0.1, gramsEdible);
  const f = g / 100;
  const num3 = (v) => Math.round(v * f * 1e3) / 1e3;
  const numMicro = (v) => Math.round(v * f * 10) / 10;
  const kcal = Math.max(1, Math.round(row2.kcalPer100g * f));
  return {
    kcal,
    proteinG: num3(row2.proteinG),
    carbsG: num3(row2.carbsG),
    fatG: num3(row2.fatG),
    fiberG: num3(row2.fiberG),
    saturatedFatG: num3(row2.saturatedFatG),
    monoFatG: num3(row2.monoFatG),
    polyFatG: num3(row2.polyFatG),
    omega3G: num3(row2.omega3G),
    vitA_mcg_RAE: numMicro(row2.vitA_mcg_RAE),
    vitC_mg: numMicro(row2.vitC_mg),
    vitD_mcg: numMicro(row2.vitD_mcg),
    vitE_mg: numMicro(row2.vitE_mg),
    vitK_mcg: numMicro(row2.vitK_mcg),
    thiamineB1_mg: numMicro(row2.thiamineB1_mg),
    riboflavinB2_mg: numMicro(row2.riboflavinB2_mg),
    niacinB3_mg: numMicro(row2.niacinB3_mg),
    vitB6_mg: numMicro(row2.vitB6_mg),
    folate_mcg: numMicro(row2.folate_mcg),
    vitB12_mcg: numMicro(row2.vitB12_mcg),
    ca_mg: numMicro(row2.ca_mg),
    fe_mg: numMicro(row2.fe_mg),
    mg_mg: numMicro(row2.mg_mg),
    p_mg: numMicro(row2.p_mg),
    k_mg: numMicro(row2.k_mg),
    na_mg: numMicro(row2.na_mg),
    zn_mg: numMicro(row2.zn_mg),
    se_mcg: numMicro(row2.se_mcg),
    eaa_leu: num3(row2.eaa_leu),
    eaa_lys: num3(row2.eaa_lys),
    eaa_met: num3(row2.eaa_met),
    eaa_phe: num3(row2.eaa_phe),
    eaa_thr: num3(row2.eaa_thr),
    eaa_trp: num3(row2.eaa_trp),
    eaa_ile: num3(row2.eaa_ile),
    eaa_val: num3(row2.eaa_val),
    eaa_his: num3(row2.eaa_his),
    glycemicIndex: 0,
    insulinIndex: 0,
    glycemicLoad: 0
  };
}
function nutrientsForMealPlanItem(item2) {
  const compositionKey = inferCanonicalFoodKeyPreferName(item2.name, item2.portionHint);
  const row2 = CANONICAL_FOOD_TABLE[compositionKey];
  if (!row2 || compositionKey === "generic_mixed") {
    return { compositionKey: "unresolved", compositionStatus: "unresolved", nutrients: { ...ZERO_SCALED } };
  }
  const hintForServing = `${item2.portionHint} ${item2.name}`.trim();
  const gramsFromHint = resolveServingGramsFromPortionHint(hintForServing, compositionKey);
  const nutrients = gramsFromHint != null ? scaleCanonicalNutrientsToGrams(row2, gramsFromHint) : scaleCanonicalNutrientsToKcal(row2, item2.approxKcal);
  return { compositionKey, compositionStatus: "canonical_estimate", nutrients };
}
var NON_ADDITIVE_KEYS = /* @__PURE__ */ new Set(["glycemicIndex", "insulinIndex"]);
var ZERO_SCALED = {
  kcal: 0,
  proteinG: 0,
  carbsG: 0,
  fatG: 0,
  fiberG: 0,
  saturatedFatG: 0,
  monoFatG: 0,
  polyFatG: 0,
  omega3G: 0,
  vitA_mcg_RAE: 0,
  vitC_mg: 0,
  vitD_mcg: 0,
  vitE_mg: 0,
  vitK_mcg: 0,
  thiamineB1_mg: 0,
  riboflavinB2_mg: 0,
  niacinB3_mg: 0,
  vitB6_mg: 0,
  folate_mcg: 0,
  vitB12_mcg: 0,
  ca_mg: 0,
  fe_mg: 0,
  mg_mg: 0,
  p_mg: 0,
  k_mg: 0,
  na_mg: 0,
  zn_mg: 0,
  se_mcg: 0,
  eaa_leu: 0,
  eaa_lys: 0,
  eaa_met: 0,
  eaa_phe: 0,
  eaa_thr: 0,
  eaa_trp: 0,
  eaa_ile: 0,
  eaa_val: 0,
  eaa_his: 0,
  glycemicIndex: 0,
  insulinIndex: 0,
  glycemicLoad: 0
};
function sumScaledNutrients(rows) {
  const out = { ...ZERO_SCALED };
  if (rows.length === 0) return out;
  const keys = Object.keys(out);
  let weightedGi = 0;
  let weightedIi = 0;
  let totKcalForIndices = 0;
  for (const r of rows) {
    for (const k of keys) {
      if (NON_ADDITIVE_KEYS.has(k)) continue;
      out[k] = Math.round((out[k] + r[k]) * 1e3) / 1e3;
    }
    if (r.kcal > 0 && r.glycemicIndex > 0) {
      weightedGi += r.glycemicIndex * r.kcal;
      totKcalForIndices += r.kcal;
    }
    if (r.kcal > 0 && r.insulinIndex > 0) {
      weightedIi += r.insulinIndex * r.kcal;
    }
  }
  out.glycemicIndex = totKcalForIndices > 0 ? Math.round(weightedGi / totKcalForIndices) : 0;
  out.insulinIndex = totKcalForIndices > 0 ? Math.round(weightedIi / totKcalForIndices) : 0;
  return out;
}

// apps/web/lib/nutrition/meal-rotation-guard.ts
function weekCountFor(stapleKey, week) {
  return week?.[stapleKey] ?? 0;
}
function isCanonicalKeyUsedToday(ctx, canonicalKey) {
  return ctx.dayUsedCanonicalKeys?.has(canonicalKey) ?? false;
}
function canUseCanonicalKeyWeek(ctx, canonicalKey, options) {
  const count = weekCountFor(canonicalKey, ctx.weekStapleCounts);
  if (count >= ROTATION_TARGET_WEEK_USES) {
    if (options?.allowExceptionCap && count < ROTATION_MAX_WEEK_USES) return true;
    return false;
  }
  return true;
}
function canUseCanonicalKey(ctx, canonicalKey, options) {
  if (!canonicalKey) return false;
  if (isCanonicalKeyUsedToday(ctx, canonicalKey)) return false;
  return canUseCanonicalKeyWeek(ctx, canonicalKey, { allowExceptionCap: options?.allowWeekException });
}
function registerMealCanonicalKeys(ctx, meal) {
  if (!ctx.dayUsedCanonicalKeys) ctx.dayUsedCanonicalKeys = /* @__PURE__ */ new Set();
  for (const it of meal.items) {
    const key = inferCanonicalFoodKeyPreferName(it.name, it.portionHint);
    if (key) ctx.dayUsedCanonicalKeys.add(key);
  }
}

// apps/web/lib/nutrition/nutrient-pathway-slot-registry.ts
var MAIN_SLOTS = /* @__PURE__ */ new Set(["lunch", "dinner"]);
function slotCategory(slot) {
  return MAIN_SLOTS.has(slot) ? "main" : "light";
}
var NUTRIENT_PATHWAY_SLOT_POOL = {
  folate_mcg: {
    main: [
      { nutrientId: "folate_mcg", canonicalKey: "spinach_raw", name: "Spinaci (folato)", noun: "spinaci freschi", bridge: "Folato denso da verdure a foglia (pathway cofactor).", defaultGrams: 150, macroRole: "veg", mode: "add", fromKeys: [] },
      { nutrientId: "folate_mcg", canonicalKey: "legumes_cooked", name: "Legumi cotti (folato)", noun: "legumi cotti (lenticchie/ceci)", bridge: "Folato complementare da legumi.", defaultGrams: 120, macroRole: "protein", mode: "add", fromKeys: [] },
      { nutrientId: "folate_mcg", canonicalKey: "chickpeas_cooked", name: "Ceci cotti (folato)", noun: "ceci cotti", bridge: "Folato + proteine vegetali (pathway).", defaultGrams: 120, macroRole: "protein", mode: "add", fromKeys: [] },
      { nutrientId: "folate_mcg", canonicalKey: "asparagus_raw", name: "Asparagi (folato)", noun: "asparagi", bridge: "Folato complementare (pathway).", defaultGrams: 140, macroRole: "veg", mode: "add", fromKeys: [] },
      { nutrientId: "folate_mcg", canonicalKey: "kale_raw", name: "Cavolo nero (folato)", noun: "cavolo nero / kale", bridge: "Folato da verdure a foglia.", defaultGrams: 120, macroRole: "veg", mode: "add", fromKeys: [] }
    ],
    light: []
  },
  vitC_mg: {
    main: [
      { nutrientId: "vitC_mg", canonicalKey: "bell_pepper_red", name: "Peperone rosso (vit C)", noun: "peperone rosso crudo", bridge: "Vitamina C densa (pathway redox).", defaultGrams: 120, macroRole: "veg", mode: "add", fromKeys: [] }
    ],
    light: [
      { nutrientId: "vitC_mg", canonicalKey: "kiwi_raw", name: "Kiwi (vit C)", noun: "kiwi", bridge: "Vitamina C complementare (non sostituisce cereali).", defaultGrams: 100, macroRole: "cho_heavy", mode: "add", fromKeys: [] },
      { nutrientId: "vitC_mg", canonicalKey: "orange_raw", name: "Arancia (vit C)", noun: "arancia", bridge: "Vitamina C complementare colazione/spuntino.", defaultGrams: 130, macroRole: "cho_heavy", mode: "add", fromKeys: [] },
      { nutrientId: "vitC_mg", canonicalKey: "strawberries_raw", name: "Fragole (vit C)", noun: "fragole", bridge: "Vitamina C complementare spuntino.", defaultGrams: 90, macroRole: "cho_heavy", mode: "add", fromKeys: [] }
    ]
  },
  fe_mg: {
    main: [
      { nutrientId: "fe_mg", canonicalKey: "spinach_raw", name: "Spinaci (ferro)", noun: "spinaci freschi", bridge: "Ferro non eme (pathway eritropoiesi).", defaultGrams: 150, macroRole: "veg", mode: "add", fromKeys: [] },
      { nutrientId: "fe_mg", canonicalKey: "chickpeas_cooked", name: "Ceci cotti (ferro)", noun: "ceci cotti", bridge: "Ferro vegetale complementare.", defaultGrams: 130, macroRole: "protein", mode: "add", fromKeys: [] },
      { nutrientId: "fe_mg", canonicalKey: "legumes_cooked", name: "Legumi cotti (ferro)", noun: "legumi cotti", bridge: "Ferro vegetale (pathway).", defaultGrams: 130, macroRole: "protein", mode: "add", fromKeys: [] }
    ],
    light: []
  },
  mg_mg: {
    main: [
      { nutrientId: "mg_mg", canonicalKey: "pumpkin_seeds_raw", name: "Semi di zucca (magnesio)", noun: "semi di zucca", bridge: "Magnesio denso (cofactor chinasi).", defaultGrams: 25, macroRole: "fat", mode: "add", fromKeys: [] },
      { nutrientId: "mg_mg", canonicalKey: "spinach_raw", name: "Spinaci (magnesio)", noun: "spinaci freschi", bridge: "Magnesio da verdure.", defaultGrams: 150, macroRole: "veg", mode: "add", fromKeys: [] },
      { nutrientId: "mg_mg", canonicalKey: "legumes_cooked", name: "Legumi cotti (magnesio)", noun: "legumi cotti", bridge: "Magnesio complementare da legumi.", defaultGrams: 120, macroRole: "protein", mode: "add", fromKeys: [] }
    ],
    light: [
      { nutrientId: "mg_mg", canonicalKey: "almonds_raw", name: "Mandorle (magnesio)", noun: "mandorle", bridge: "Magnesio in colazione/spuntino.", defaultGrams: 25, macroRole: "fat", mode: "add", fromKeys: [] }
    ]
  },
  zn_mg: {
    main: [
      { nutrientId: "zn_mg", canonicalKey: "pumpkin_seeds_raw", name: "Semi di zucca (zinco)", noun: "semi di zucca", bridge: "Zinco denso.", defaultGrams: 25, macroRole: "fat", mode: "add", fromKeys: [] },
      { nutrientId: "zn_mg", canonicalKey: "chickpeas_cooked", name: "Ceci cotti (zinco)", noun: "ceci cotti", bridge: "Zinco complementare.", defaultGrams: 120, macroRole: "protein", mode: "add", fromKeys: [] },
      { nutrientId: "zn_mg", canonicalKey: "legumes_cooked", name: "Legumi cotti (zinco)", noun: "legumi cotti", bridge: "Zinco complementare da legumi.", defaultGrams: 120, macroRole: "protein", mode: "add", fromKeys: [] }
    ],
    light: []
  },
  vitB12_mcg: {
    main: [
      {
        nutrientId: "vitB12_mcg",
        canonicalKey: "egg_whole",
        name: "Uova (B12)",
        noun: "uova",
        bridge: "Vitamina B12 (pathway eritropoiesi).",
        defaultGrams: 100,
        macroRole: "protein",
        mode: "replace",
        fromKeys: ["yogurt_plain", "plant_drink_generic"]
      }
    ],
    light: [
      {
        nutrientId: "vitB12_mcg",
        canonicalKey: "egg_whole",
        name: "Uova (B12)",
        noun: "uova",
        bridge: "Vitamina B12 colazione/spuntino.",
        defaultGrams: 100,
        macroRole: "protein",
        mode: "replace",
        fromKeys: ["yogurt_plain", "plant_drink_generic", "whey_powder"]
      }
    ]
  },
  omega3G: {
    main: [
      {
        nutrientId: "omega3G",
        canonicalKey: "fish_white",
        name: "Pesce (omega-3)",
        noun: "pesce bianco o azzurro",
        bridge: "Omega-3 EPA/DHA da pesce (pathway lipidico).",
        defaultGrams: 120,
        macroRole: "protein",
        mode: "replace",
        fromKeys: ["chicken_breast", "beef_lean", "egg_whole"]
      }
    ],
    light: [
      {
        nutrientId: "omega3G",
        canonicalKey: "fish_white",
        name: "Pesce affumicato (omega-3)",
        noun: "salmone affumicato o azzurro",
        bridge: "Omega-3 EPA/DHA colazione/spuntino salato.",
        defaultGrams: 70,
        macroRole: "protein",
        mode: "replace",
        fromKeys: ["yogurt_plain", "deli_lean", "whey_powder"]
      }
    ]
  }
};
var VEGAN_BLOCKED_KEYS = /* @__PURE__ */ new Set(["egg_whole", "fish_white", "yogurt_plain", "deli_lean", "cheese_hard"]);
var VEGETARIAN_BLOCKED_KEYS = /* @__PURE__ */ new Set(["fish_white"]);
function isCanonicalKeyBlocked(canonicalKey, dietType) {
  if (dietType === "vegan" && VEGAN_BLOCKED_KEYS.has(canonicalKey)) return true;
  if (dietType === "vegetarian" && VEGETARIAN_BLOCKED_KEYS.has(canonicalKey)) return true;
  return false;
}
function listNutrientPathwaySwapsForSlot(nutrientId, slot, dietType) {
  const cat = slotCategory(slot);
  const pool = NUTRIENT_PATHWAY_SLOT_POOL[nutrientId]?.[cat];
  if (!pool?.length) return [];
  return pool.filter((spec) => {
    if (!CANONICAL_FOOD_TABLE[spec.canonicalKey]) return false;
    if (isCanonicalKeyBlocked(spec.canonicalKey, dietType)) return false;
    if (!isFoodLabelAllowedInMealSlot(spec.name, slot)) return false;
    return true;
  });
}
function nutrientDisplayLabelIt(id) {
  const labels = {
    folate_mcg: "Folati (B9)",
    vitC_mg: "Vitamina C",
    fe_mg: "Ferro",
    mg_mg: "Magnesio",
    zn_mg: "Zinco",
    vitB12_mcg: "Vitamina B12",
    thiamineB1_mg: "Tiamina (B1)",
    riboflavinB2_mg: "Riboflavina (B2)",
    niacinB3_mg: "Niacina (B3)",
    vitB6_mg: "Vitamina B6",
    vitD_mcg: "Vitamina D",
    vitE_mg: "Vitamina E",
    se_mcg: "Selenio",
    omega3G: "Omega-3 EPA/DHA",
    fiberG: "Fibre"
  };
  return labels[id] ?? id;
}
var INTEGRATION_ACTION_BY_TARGET = {
  folate_mcg: "Acido folico (B9) o multivitaminico con folati \u2014 oppure pi\xF9 verdure a foglia/legumi a pranzo/cena.",
  vitB12_mcg: "Vitamina B12 (cobalamina): integrazione orale o IM solo se concordata; alimenti: uova, pesce, latticini tollerati.",
  fe_mg: "Ferro (es. bisglicinato) se ferritina bassa; abbinare vitamina C lontano da pasti ricchi di calcio.",
  zn_mg: "Zinco (pidolato/bisglicinato) se deficit; fonti alimentari: semi, legumi, pesce.",
  mg_mg: "Magnesio (citrato/glicinato) la sera se necessario; fonti: verdure, semi, mandorle.",
  vitC_mg: "Vitamina C idrosolubile o agrumi/kiwi a colazione/spuntino.",
  thiamineB1_mg: "Tiamina (B1): cereali integrali a colazione o B-complex se indicato.",
  riboflavinB2_mg: "Riboflavina (B2): latticini/uova/pesce o integrazione B-complex.",
  niacinB3_mg: "Niacina (B3): fonti dense a pranzo/cena o B-complex se concordato.",
  vitB6_mg: "Vitamina B6: pesce, legumi o integrazione mirata se deficit.",
  vitD_mcg: "Vitamina D3 (colecalciferolo) se livelli bassi \u2014 dosaggio da medico.",
  se_mcg: "Selenio: integrazione mirata o pesce/noci se tollerati.",
  omega3G: "Omega-3 EPA/DHA: pesce a pranzo/cena o capsula se concordata.",
  fiberG: "Fibre: aumentare verdure/legumi/cereali integrali nei pasti principali."
};
function integrationActionForTarget(nutrientId, displayNameIt) {
  const action = INTEGRATION_ACTION_BY_TARGET[nutrientId] ?? `Valuta integrazione mirata per ${displayNameIt} con medico/nutrizionista.`;
  return action;
}

// apps/web/lib/nutrition/pathway-cofactors-to-nutrient-targets.ts
var PATTERNS = [
  /** Vitamine B */
  { regex: /\b(b1|tiamin|thiamin)\b/i, nutrientId: "thiamineB1_mg", labelIt: "Tiamina (B1)" },
  { regex: /\b(b2|riboflav)\b/i, nutrientId: "riboflavinB2_mg", labelIt: "Riboflavina (B2)" },
  { regex: /\b(b3|niacin|niaci|nicotin)\b/i, nutrientId: "niacinB3_mg", labelIt: "Niacina (B3)" },
  { regex: /\b(b6|piridoss|pyridox)\b/i, nutrientId: "vitB6_mg", labelIt: "Vitamina B6" },
  { regex: /\b(b9|folat|folic|folati)\b/i, nutrientId: "folate_mcg", labelIt: "Folati (B9)" },
  { regex: /\b(b12|cobalam|cyanocobal|methylcobal)\b/i, nutrientId: "vitB12_mcg", labelIt: "Vitamina B12" },
  /** Vitamine liposolubili */
  { regex: /\b(vit(amina)?\s*a|retinol)\b/i, nutrientId: "vitA_mcg_RAE", labelIt: "Vitamina A" },
  { regex: /\b(vit(amina)?\s*c|ascorb)\b/i, nutrientId: "vitC_mg", labelIt: "Vitamina C" },
  { regex: /\b(vit(amina)?\s*d|colecalcif|cholecalcif)\b/i, nutrientId: "vitD_mcg", labelIt: "Vitamina D" },
  { regex: /\b(vit(amina)?\s*e|tocoferol|tocopher)\b/i, nutrientId: "vitE_mg", labelIt: "Vitamina E" },
  { regex: /\b(vit(amina)?\s*k|fillochin|phyllochin)\b/i, nutrientId: "vitK_mcg", labelIt: "Vitamina K" },
  /** Minerali principali (l'ordine conta: Mg/Fe prima dei generici per evitare match secondari) */
  { regex: /\b(magnes|\bmg\b)/i, nutrientId: "mg_mg", labelIt: "Magnesio" },
  { regex: /\b(ferr|iron|\bfe\b)/i, nutrientId: "fe_mg", labelIt: "Ferro" },
  { regex: /\b(zinc|zinco|\bzn\b)/i, nutrientId: "zn_mg", labelIt: "Zinco" },
  /** "selenio" ≠ `\bseleni\b` (suffix -o): prima regex non matchava mai il cofactor italiano. */
  { regex: /\b(seleni[o]?|selenium)\b/i, nutrientId: "se_mcg", labelIt: "Selenio" },
  { regex: /\b(calci|calcium)\b/i, nutrientId: "ca_mg", labelIt: "Calcio" },
  /**
   * Vietato `\bk\b` / `\bna\b`: in substrati tipo "Na/K" matchano lettere chimiche e saturano i boost
   * con falsi Potassio/Sodio prima dei cofactor redox (Vit C, Se, Zn).
   */
  { regex: /\b(potassio|potassium|kalium)\b/i, nutrientId: "k_mg", labelIt: "Potassio" },
  { regex: /\b(sodio|sodium|natrium)\b/i, nutrientId: "na_mg", labelIt: "Sodio" },
  { regex: /\b(fosfor|phosph|\bp\b)/i, nutrientId: "p_mg", labelIt: "Fosforo" },
  /** Macro funzionali rilevanti per pathway (omega-3, fibre) */
  { regex: /\b(omega.?3|epa|dha)\b/i, nutrientId: "omega3G", labelIt: "Omega-3 (EPA/DHA)" },
  { regex: /\b(fibre?|fiber)\b/i, nutrientId: "fiberG", labelIt: "Fibre alimentari" }
];
function labelForNutrientTargetId(id) {
  const hit = PATTERNS.find((p) => p.nutrientId === id);
  return hit?.labelIt ?? id;
}
var CATALOG_TO_NUTRIENT_TARGET = {
  folate_b9: "folate_mcg",
  vitamin_c_redox: "vitC_mg",
  magnesium_kinase: "mg_mg",
  iron_heme: "fe_mg",
  iron_nonheme: "fe_mg",
  zinc_immunity: "zn_mg",
  selenium_redox: "se_mcg",
  omega3_epa_dha: "omega3G",
  fiber_gut: "fiberG",
  potassium_electrolyte: "k_mg",
  calcium_bone: "ca_mg",
  vitamin_d_hormone: "vitD_mcg",
  vitamin_b12_nerve: "vitB12_mcg",
  thiamine_b1: "thiamineB1_mg",
  riboflavin_b2: "riboflavinB2_mg",
  niacin_b3: "niacinB3_mg",
  vitamin_b6: "vitB6_mg"
};
function catalogIdToNutrientTargetId(catalogId) {
  return CATALOG_TO_NUTRIENT_TARGET[catalogId] ?? null;
}

// apps/web/lib/nutrition/meal-pathway-advisor.ts
function mealHasCanonicalKey(meal, canonicalKey) {
  return meal.items.some((it) => inferCanonicalFoodKeyPreferName(it.name, it.portionHint) === canonicalKey);
}
function countVegInMeal(meal) {
  return meal.items.filter((it) => isVegCanonicalKey(inferCanonicalFoodKeyPreferName(it.name, it.portionHint))).length;
}
function countFruitInMeal(meal) {
  return meal.items.filter((it) => isFruitCanonicalKey(inferCanonicalFoodKeyPreferName(it.name, it.portionHint))).length;
}
function applyAddSpec(meal, spec) {
  if (mealHasCanonicalKey(meal, spec.canonicalKey)) return null;
  const toRow = CANONICAL_FOOD_TABLE[spec.canonicalKey];
  if (!toRow) return null;
  const grams = spec.defaultGrams;
  const approxKcal = Math.max(15, Math.round(toRow.kcalPer100g * grams / 100));
  const portion = `${grams} g ${spec.noun}`.slice(0, 160);
  const newItem = {
    name: spec.name,
    portionHint: portion,
    approxKcal,
    macroRole: spec.macroRole,
    functionalBridge: spec.bridge.slice(0, 500)
  };
  const items = [...meal.items, newItem];
  return {
    ...meal,
    items,
    lines: [...meal.lines, portion],
    totalApproxKcal: items.reduce((a, i) => a + i.approxKcal, 0)
  };
}
function pickRotatedSpec(specs, ctx) {
  for (const spec of specs) {
    if (!ctx || !canUseCanonicalKey(ctx, spec.canonicalKey, { allowWeekException: true })) continue;
    return spec;
  }
  return null;
}
function applyPathwayAdvice(meal, slot, targetIds, ctx) {
  const adviceNotes = [];
  if (!targetIds.length || ctx?.suppressedSlots?.includes(slot)) {
    return { meal, adviceNotes };
  }
  if (isMainMealSlot(slot)) {
    const vegCount = countVegInMeal(meal);
    for (const id of targetIds) {
      const specs = listNutrientPathwaySwapsForSlot(id, slot, ctx?.dietType);
      if (!specs.length) continue;
      const head = specs[0];
      if (isFruitCanonicalKey(head.canonicalKey)) {
        adviceNotes.push("Micronutriente: preferisci frutta a colazione o spuntino, non a pranzo/cena.");
        continue;
      }
      if (vegCount >= MAIN_ROLE_CAPS.veg_condiment) {
        adviceNotes.push(
          `Pasto gi\xE0 con ${vegCount} verdure: valuta sostituzione contorno con ${head.noun} o integrazione mirata.`
        );
        continue;
      }
      adviceNotes.push(`Suggerimento pathway: ${head.noun} come alternativa contorno (non aggiunto automaticamente).`);
    }
    return { meal, adviceNotes };
  }
  let current = meal;
  let addsApplied = 0;
  for (const id of targetIds) {
    if (addsApplied >= 1) break;
    const specs = listNutrientPathwaySwapsForSlot(id, slot, ctx?.dietType).filter((s) => s.mode === "add");
    const spec = pickRotatedSpec(specs, ctx);
    if (!spec) {
      adviceNotes.push(
        `${labelForNutrientTargetId(id)}: il pasto \xE8 gi\xE0 completo \u2014 coprilo con l'integrazione o nei prossimi giorni.`
      );
      continue;
    }
    if (isFruitCanonicalKey(spec.canonicalKey) && countFruitInMeal(current) >= 1) continue;
    const next = applyAddSpec(current, spec);
    if (!next) continue;
    current = next;
    addsApplied += 1;
  }
  return { meal: current, adviceNotes };
}

// apps/web/lib/nutrition/mediterranean-meal-composer.ts
function createMediterraneanDayContext(planDate, weekStapleCounts, postWorkoutMealBySlot, dietType, denyFragments, suppressedSlots, racePreLunch, racePostRecovery) {
  const w = weekStapleCounts && Object.keys(weekStapleCounts).length ? { ...weekStapleCounts } : void 0;
  const pw = postWorkoutMealBySlot && Object.keys(postWorkoutMealBySlot).length ? { ...postWorkoutMealBySlot } : void 0;
  const deny = denyFragments && denyFragments.length > 0 ? denyFragments.map((s) => s.toLowerCase()).filter((s) => s.length >= 2) : void 0;
  const supp = suppressedSlots && suppressedSlots.length > 0 ? [...suppressedSlots] : void 0;
  return {
    planDate,
    usedStaples: /* @__PURE__ */ new Set(),
    weekStapleCounts: w,
    postWorkoutMealBySlot: pw,
    dietType,
    denyFragments: deny,
    suppressedSlots: supp,
    racePreLunch,
    racePostRecovery,
    dayUsedCanonicalKeys: /* @__PURE__ */ new Set()
  };
}

// apps/web/lib/nutrition/v2/fdc-candidate-filter.ts
var DESCRIPTION_DENYLIST = [
  /^beverage$/i,
  /^beverages$/i,
  /^snacks?,?\s/i,
  /butter replacement/i,
  /meal replacement/i,
  /infant formula/i,
  /babyfood/i,
  /walrus/i,
  /alaska native/i,
  /navajo/i,
  /graham cracker.*crust/i,
  /pie crust.*cookie/i,
  /restaurant,\s*chinese/i,
  /gelatins,\s*dry powder/i,
  /french fries/i,
  /potato chips/i,
  /tortilla chips/i,
  /onion rings/i,
  /corn dog/i,
  /fast foods/i,
  /kraft foods/i,
  /general mills/i,
  /granola bar/i,
  /fruit leather/i,
  /candy bar/i,
  /ice cream/i,
  /cupcake/i,
  /doughnut/i,
  /rice cake/i,
  /\bcrackers?\b/i,
  /mini rice cakes/i,
  /^candies/i,
  /^candy,/i
];
function isDeniedFdcDescription(description, denyFragments) {
  const d = description.toLowerCase();
  for (const frag of denyFragments) {
    if (frag && d.includes(frag.toLowerCase())) return true;
  }
  for (const re of DESCRIPTION_DENYLIST) {
    if (re.test(description)) return true;
  }
  return false;
}
function filterFdcCandidates(candidates, denyFragments) {
  return candidates.filter(
    (c) => c.kcalPer100g > 0 && !isDeniedFdcDescription(c.description, denyFragments)
  );
}

// apps/web/lib/nutrition/v2/fdc-meal-macro-solver.ts
function clampStep2(n, lo, hi, step) {
  const clamped = Math.max(lo, Math.min(hi, n));
  return Math.round(clamped / step) * step;
}
function macroPerG(hit) {
  return {
    c: hit.carbsPer100g / 100,
    p: hit.proteinPer100g / 100,
    f: hit.fatPer100g / 100
  };
}
function solveFdcMealPortions(lines, target) {
  const grams = lines.map((line) => {
    if (line.spec.lever === "fixed") {
      return clampStep2(line.spec.fixedG ?? line.spec.minG, line.spec.minG, line.spec.maxG, line.spec.stepG);
    }
    return line.spec.minG;
  });
  const idxOf = (lever) => lines.findIndex((l) => l.spec.lever === lever);
  const choIdx = idxOf("cho");
  const proIdx = idxOf("protein");
  const fatIdx = idxOf("fat");
  const sumMacro = (m) => lines.reduce((acc, line, i) => acc + grams[i] * macroPerG(line.hit)[m], 0);
  const adjust = (idx, m, t) => {
    if (idx < 0) return;
    const line = lines[idx];
    const perG = macroPerG(line.hit)[m];
    if (perG <= 0) return;
    const others = sumMacro(m) - grams[idx] * perG;
    grams[idx] = clampStep2((t - others) / perG, line.spec.minG, line.spec.maxG, line.spec.stepG);
  };
  for (let it = 0; it < 20; it++) {
    adjust(proIdx, "p", Math.max(0, target.proteinG));
    adjust(choIdx, "c", Math.max(0, target.carbsG));
    adjust(fatIdx, "f", Math.max(0, target.fatG));
  }
  return grams;
}

// apps/web/lib/nutrition/v2/fdc-healthy-meal-scoring.ts
var MAIN_MEAL_FORBIDDEN = /\b(cereal|corn flakes|bran flakes|muesli|granola|oat,?\s|oats,?\s|crisp|crisps|chip|chips|potato chips|french fries|snack bar|granola bar|cookie|babyfood|walrus|kraft foods|fast foods|rice cake|crackers?)\b/i;
var MAIN_CARB_PREFERRED = /\b(pasta|spaghetti|macaroni|riso\b|quinoa|barley|lentil|chickpea|potato.*flesh|potato.*baked|sweet potato|rice,?\s+(white|brown|long-grain|cooked))\b/i;
var BREAKFAST_CHO_PREFERRED = /\b(oats?|oatmeal|avena|bread|pane|muesli|cereal|corn flakes|bran|cracker|biscott|rusk|toast)\b/i;
var PROTEIN_PREFERRED = /\b(chicken breast|turkey|salmon|tuna|cod|egg|uova|yogurt|tofu|lean beef|fish|legume|lentil|chickpea|cottage|ricotta)\b/i;
var FAT_PREFERRED = /\b(almond|mandorl|walnut|noci|olive oil|olio|avocado|peanut|seed|semi)\b/i;
var VEG_PREFERRED = /\b(spinach|broccoli|zucchini|pepper|tomato|carrot|lettuce|kale|asparagus|green bean|salad|insalat|verdur)\b/i;
function isForbiddenForRole(hit, ctx, denyFragments) {
  const d = hit.description;
  if (isDeniedFdcDescription(d, denyFragments)) return true;
  if (/\b(kraft foods|general mills)\b/i.test(d)) return true;
  if (ctx.slot === "breakfast" && ctx.spec.foodRole === "cho_complex") {
    if (/\b(pasta|spaghetti|rice\b|riso|potato|lentil|chickpea|salmon|chicken)\b/i.test(d)) return true;
  }
  if (isMainMealSlot(ctx.slot)) {
    if (MAIN_MEAL_FORBIDDEN.test(d)) return true;
    if (/\b(rice cake|crackers?,?\s|mini rice cakes)\b/i.test(d)) return true;
    if (ctx.spec.foodRole === "cho_complex" && /\b(cereal|oat|muesli|bread,?\s*white)\b/i.test(d)) return true;
  }
  return false;
}
function macroBonus(hit, spec) {
  if (spec.lever === "cho") return hit.carbsPer100g * 0.5;
  if (spec.lever === "protein") return hit.proteinPer100g * 0.55;
  if (spec.lever === "fat") return hit.fatPer100g * 0.6;
  return 100 - hit.kcalPer100g;
}
function scoreFdcForRole(hit, ctx, denyFragments, staplePenalty) {
  if (isForbiddenForRole(hit, ctx, denyFragments)) return -1e4;
  let score = macroBonus(hit, ctx.spec);
  const d = hit.description;
  if (ctx.spec.foodRole === "cho_complex") {
    if (isMainMealSlot(ctx.slot) && MAIN_CARB_PREFERRED.test(d) && !/\brice cake\b/i.test(d)) score += 200;
    if (ctx.slot === "breakfast" && BREAKFAST_CHO_PREFERRED.test(d)) score += 200;
  }
  if (ctx.spec.foodRole === "protein_primary" || ctx.spec.foodRole === "protein_secondary") {
    if (PROTEIN_PREFERRED.test(d)) score += 180;
  }
  if (ctx.spec.foodRole === "fat" && FAT_PREFERRED.test(d)) score += 160;
  if (ctx.spec.foodRole === "veg_condiment" && VEG_PREFERRED.test(d)) score += 160;
  score -= staplePenalty(d) * 40;
  return score;
}
function pickBestFdcForRole(pool, ctx, denyFragments, usedFdcIds, staplePenalty) {
  let best = null;
  let bestScore = -Infinity;
  for (const hit of pool) {
    if (usedFdcIds.has(hit.fdcId) || hit.kcalPer100g <= 0) continue;
    if (ctx.spec.lever === "cho" && hit.carbsPer100g < 8) continue;
    if (ctx.spec.lever === "protein" && hit.proteinPer100g < 6) continue;
    if (ctx.spec.lever === "fat" && hit.fatPer100g < 3) continue;
    const score = scoreFdcForRole(hit, ctx, denyFragments, staplePenalty);
    if (score <= -5e3) continue;
    if (score > bestScore) {
      bestScore = score;
      best = hit;
    }
  }
  return best;
}

// apps/web/lib/nutrition/canonical-food-fdc-aliases.ts
var CANONICAL_FOOD_TO_FDC_ID = {
  // Cereali e amidi
  bread_white: 174925,
  // Bread, white, commercially prepared, toasted
  pasta_cooked: 168928,
  // Pasta, cooked, unenriched, without added salt
  pasta_dry: 168927,
  // Pasta, dry, unenriched
  rice_cooked: 169757,
  // Rice, white, long-grain, regular, unenriched, cooked without salt
  rice_dry: 169756,
  // Rice, white, long-grain, regular, raw, unenriched
  oat_dry: 172989,
  // Cereals, QUAKER, Quick Oats, Dry (proxy SR Legacy per fiocchi avena secchi)
  farro_cooked: 169746,
  // Spelt, cooked (farro = spelt USDA)
  farro_dry: 169746,
  // proxy spelt — macro da TS table se mismatch
  quinoa_dry: 168874,
  // Quinoa, uncooked
  tofu_firm: 172475,
  tempeh: 174272,
  potato_cooked: 170093,
  // Potatoes, baked, flesh and skin, without salt
  crackers_whole: 174985,
  // Crackers, wheat, regular
  // Verdure
  mixed_veg: 168462,
  // Spinach, raw — proxy verdura foglia generica
  spinach_raw: 168462,
  kale_raw: 168421,
  broccoli_raw: 170379,
  bell_pepper_red: 170108,
  asparagus_raw: 168389,
  beetroot_raw: 2685576,
  arugula_raw: 169387,
  zucchini_raw: 169291,
  tomato_raw: 170457,
  carrot_raw: 170393,
  lettuce_romaine: 169247,
  // Frutta
  banana: 173944,
  mixed_fruit: 2346411,
  // Blueberries, raw — proxy frutta rossa ricca
  orange_raw: 169097,
  kiwi_raw: 327046,
  strawberries_raw: 167762,
  apple_raw: 1750340,
  blueberries_raw: 2346411,
  pear_raw: 169118,
  // Legumi
  legumes_cooked: 172421,
  // Lentils, mature seeds, cooked, boiled, without salt
  chickpeas_cooked: 173799,
  // Semi / snack
  pumpkin_seeds_raw: 170556,
  almonds_raw: 2346393,
  dark_chocolate_70: 170273,
  // Proteine animali
  egg_whole: 171287,
  chicken_breast: 171077,
  beef_lean: 168608,
  fish_white: 175167,
  // Fish, salmon, Atlantic, farmed, raw — proxy pesce ricco di micro/omega
  deli_lean: 167876,
  // Latticini
  milk_goat: 171278,
  yogurt_plain: 171284,
  cheese_hard: 171247,
  ricotta_cheese: 170851,
  cottage_cheese: 173417,
  // Grassi
  olive_oil: 171413,
  avocado: 171705,
  // Senza fdcId (proxy interni — USDA non offre un match diretto rilevante)
  generic_mixed: void 0,
  whey_powder: void 0,
  omega_capsule: void 0
};
function fdcIdForCanonicalKey(canonicalKey) {
  return CANONICAL_FOOD_TO_FDC_ID[canonicalKey];
}

// apps/web/lib/nutrition/macro-plausibility.ts
var MAX_KCAL_PER_100G = 900;
var MAX_MACRO_PER_100G = 100;
function isPlausiblePer100gMacros(row2) {
  const { kcal_100, carbs_100, protein_100, fat_100 } = row2;
  if (kcal_100 != null && (!Number.isFinite(kcal_100) || kcal_100 < 0 || kcal_100 > MAX_KCAL_PER_100G)) return false;
  for (const m of [carbs_100, protein_100, fat_100]) {
    if (m != null && (!Number.isFinite(m) || m < 0 || m > MAX_MACRO_PER_100G)) return false;
  }
  return true;
}

// apps/web/lib/nutrition/v2/fdc-staple-registry.ts
var LABEL_IT = {
  oat_dry: "Fiocchi d'avena",
  bread_white: "Pane integrale",
  pasta_dry: "Pasta di semola",
  rice_dry: "Riso",
  potato_cooked: "Patate",
  farro_dry: "Farro",
  quinoa_dry: "Quinoa",
  egg_whole: "Uova",
  yogurt_plain: "Yogurt greco",
  chicken_breast: "Petto di pollo",
  fish_white: "Salmone",
  beef_lean: "Manzo magro",
  legumes_cooked: "Legumi",
  tofu_firm: "Tofu",
  tempeh: "Tempeh",
  seitan: "Seitan",
  ricotta_cheese: "Ricotta",
  cottage_cheese: "Ricotta magra",
  milk_2pct: "Latte",
  milk_goat: "Latte di capra",
  olive_oil: "Olio EVO",
  almonds_raw: "Mandorle",
  avocado: "Avocado",
  spinach_raw: "Spinaci",
  broccoli_raw: "Broccoli",
  zucchini_raw: "Zucchine",
  mixed_veg: "Insalata mista",
  tomato_raw: "Pomodori",
  carrot_raw: "Carote",
  banana: "Banana",
  apple_raw: "Mela",
  orange_raw: "Arancia",
  blueberries_raw: "Mirtilli",
  mixed_fruit: "Frutta mista",
  cheese_hard: "Grana Padano"
};
function entry(canonicalKey, servingBasis, opts) {
  return {
    canonicalKey,
    labelIt: opts?.labelIt ?? LABEL_IT[canonicalKey] ?? canonicalKey.replace(/_/g, " "),
    servingBasis,
    rotationKey: opts?.rotationKey,
    carbFamily: opts?.carbFamily
  };
}
var STAPLE_ALLOWLIST_BY_POOL = {
  breakfast_cho: [
    entry("oat_dry", "dry_grams", { rotationKey: "breakfast:oat" }),
    entry("bread_white", "dry_grams", { rotationKey: "breakfast:bread" }),
    entry("crackers_whole", "dry_grams", { rotationKey: "breakfast:crackers" })
  ],
  breakfast_pro: [
    entry("yogurt_plain", "dry_grams", { rotationKey: "breakfast:yogurt" }),
    entry("egg_whole", "dry_grams", { rotationKey: "breakfast:egg" }),
    entry("ricotta_cheese", "dry_grams"),
    entry("cottage_cheese", "dry_grams")
  ],
  breakfast_fat: [
    entry("almonds_raw", "dry_grams"),
    entry("olive_oil", "ml"),
    entry("avocado", "dry_grams")
  ],
  lunch_carb: [
    entry("pasta_dry", "dry_grams", { rotationKey: "carb:pasta", carbFamily: "carb_starch" }),
    entry("rice_dry", "dry_grams", { rotationKey: "carb:riso", carbFamily: "carb_starch" }),
    entry("potato_cooked", "cooked_grams", { rotationKey: "carb:patate", carbFamily: "carb_starch" }),
    entry("farro_dry", "dry_grams", { rotationKey: "carb:farro", carbFamily: "carb_starch" }),
    entry("quinoa_dry", "dry_grams", { rotationKey: "carb:quinoa", carbFamily: "carb_starch" })
  ],
  dinner_carb: [
    entry("rice_dry", "dry_grams", { rotationKey: "carb:riso", carbFamily: "carb_starch" }),
    entry("pasta_dry", "dry_grams", { rotationKey: "carb:pasta", carbFamily: "carb_starch" }),
    entry("potato_cooked", "cooked_grams", { rotationKey: "carb:patate", carbFamily: "carb_starch" }),
    entry("farro_dry", "dry_grams", { rotationKey: "carb:farro", carbFamily: "carb_starch" }),
    entry("quinoa_dry", "dry_grams", { rotationKey: "carb:quinoa", carbFamily: "carb_starch" })
  ],
  lunch_pro: [
    entry("chicken_breast", "dry_grams", { rotationKey: "prot:pollo" }),
    entry("fish_white", "dry_grams", { rotationKey: "prot:pesce" }),
    entry("beef_lean", "dry_grams", { rotationKey: "prot:manzo" }),
    entry("legumes_cooked", "cooked_grams", { rotationKey: "prot:legumi" }),
    entry("egg_whole", "dry_grams"),
    entry("tofu_firm", "dry_grams")
  ],
  dinner_pro: [
    entry("fish_white", "dry_grams", { rotationKey: "prot:pesce" }),
    entry("chicken_breast", "dry_grams", { rotationKey: "prot:pollo" }),
    entry("beef_lean", "dry_grams", { rotationKey: "prot:manzo" }),
    entry("legumes_cooked", "cooked_grams", { rotationKey: "prot:legumi" }),
    entry("tofu_firm", "dry_grams"),
    entry("tempeh", "dry_grams")
  ],
  lunch_veg: [
    entry("mixed_veg", "dry_grams"),
    entry("spinach_raw", "dry_grams"),
    entry("broccoli_raw", "dry_grams"),
    entry("zucchini_raw", "dry_grams"),
    entry("tomato_raw", "dry_grams")
  ],
  dinner_veg: [
    entry("spinach_raw", "dry_grams"),
    entry("broccoli_raw", "dry_grams"),
    entry("zucchini_raw", "dry_grams"),
    entry("mixed_veg", "dry_grams"),
    entry("carrot_raw", "dry_grams")
  ],
  snack_cho: [
    entry("banana", "dry_grams"),
    entry("apple_raw", "dry_grams"),
    entry("orange_raw", "dry_grams"),
    entry("blueberries_raw", "dry_grams"),
    entry("mixed_fruit", "dry_grams")
  ],
  snack_pro: [
    entry("yogurt_plain", "dry_grams"),
    entry("cottage_cheese", "dry_grams"),
    entry("almonds_raw", "dry_grams"),
    entry("egg_whole", "dry_grams")
  ]
};
function filterByDiet(entries, dietType) {
  if (!dietType || dietType === "omnivore" || dietType === "pescatarian") {
    if (dietType === "pescatarian") {
      return entries.filter((e) => !["chicken_breast", "beef_lean"].includes(e.canonicalKey));
    }
    return entries;
  }
  if (dietType === "vegetarian") {
    return entries.filter((e) => !["chicken_breast", "beef_lean", "fish_white"].includes(e.canonicalKey));
  }
  if (dietType === "vegan") {
    return entries.filter(
      (e) => !["chicken_breast", "beef_lean", "fish_white", "egg_whole", "yogurt_plain", "ricotta_cheese", "cottage_cheese", "cheese_hard", "milk_2pct", "milk_goat"].includes(
        e.canonicalKey
      )
    );
  }
  return entries;
}
function canonicalToHit(entry2) {
  const row2 = CANONICAL_FOOD_TABLE[entry2.canonicalKey];
  if (!row2?.kcalPer100g) return null;
  const fdcId = fdcIdForCanonicalKey(entry2.canonicalKey) ?? 0;
  if (!isPlausiblePer100gMacros({
    kcal_100: row2.kcalPer100g,
    carbs_100: row2.carbsG,
    protein_100: row2.proteinG,
    fat_100: row2.fatG
  })) {
    return null;
  }
  return {
    fdcId,
    description: entry2.labelIt,
    kcalPer100g: row2.kcalPer100g,
    proteinPer100g: row2.proteinG,
    carbsPer100g: row2.carbsG,
    fatPer100g: row2.fatG,
    tags: {
      mealCourse: [],
      foodFamily: [],
      macroDominant: [],
      slotFit: [],
      dietProfile: ["omnivore"],
      dietExclude: [],
      mealRole: [],
      aminoProfile: [],
      nutrientDensity: [],
      classifierVersion: "staple_registry"
    },
    tagSource: "db"
  };
}
function denyHit2(key, denyFragments) {
  const d = key.toLowerCase();
  return denyFragments.some((f) => f && d.includes(f.toLowerCase()));
}
function pickStapleForPool(ctx) {
  const raw = STAPLE_ALLOWLIST_BY_POOL[ctx.poolKey] ?? [];
  const entries = filterByDiet(raw, ctx.dietType);
  const deny = ctx.denyFragments ?? [];
  const scored = entries.map((e, idx) => {
    if (denyHit2(e.labelIt, deny) || denyHit2(e.canonicalKey, deny)) return { e, score: -1e4, idx };
    const weekCount = weekStapleCountForEntry(e, ctx.dayCtx?.weekStapleCounts);
    if (weekCount >= ROTATION_MAX_WEEK_USES) return { e, score: -5e3, idx };
    if (ctx.dayCtx && isCanonicalKeyUsedToday(ctx.dayCtx, e.canonicalKey)) {
      return { e, score: -5e3, idx };
    }
    if (e.rotationKey && ctx.usedCarbFamilies?.has(e.rotationKey)) return { e, score: -3e3, idx };
    else if (!e.rotationKey && e.carbFamily && ctx.usedCarbFamilies?.has(e.carbFamily)) {
      return { e, score: -3e3, idx };
    }
    const hit = canonicalToHit(e);
    if (!hit) return { e, score: -8e3, idx };
    if (ctx.usedFdcIds?.has(hit.fdcId) && hit.fdcId > 0) return { e, score: -4e3, idx };
    let score = 1e3 - idx * 10;
    if (weekCount >= ROTATION_TARGET_WEEK_USES) score -= 120;
    else if (weekCount > 0) score -= weekCount * 80;
    score += (ctx.seed + idx * 7) % 11;
    return { e, score, idx, hit };
  }).filter((x) => x.score > 0 && "hit" in x && x.hit).sort((a, b) => b.score - a.score);
  const best = scored[0];
  if (!best || !("hit" in best) || !best.hit) return null;
  return { entry: best.e, hit: best.hit };
}
function rotationKeyForCanonical(canonicalKey) {
  for (const list of Object.values(STAPLE_ALLOWLIST_BY_POOL)) {
    const found = list.find((e) => e.canonicalKey === canonicalKey);
    if (found?.rotationKey) return found.rotationKey;
  }
  return void 0;
}
function weekStapleCountForEntry(entry2, week) {
  if (!week) return 0;
  return Math.max(
    week[entry2.canonicalKey] ?? 0,
    entry2.rotationKey ? week[entry2.rotationKey] ?? 0 : 0
  );
}
function mealRotationStaplesFromComposedItems(items) {
  const keys = /* @__PURE__ */ new Set();
  for (const item2 of items) {
    const ck = item2.canonicalKey?.trim();
    if (!ck) continue;
    const rk = rotationKeyForCanonical(ck);
    keys.add(rk ?? ck);
  }
  return [...keys].slice(0, 24);
}
function servingBasisForCanonical(canonicalKey) {
  for (const list of Object.values(STAPLE_ALLOWLIST_BY_POOL)) {
    const found = list.find((e) => e.canonicalKey === canonicalKey);
    if (found) return found.servingBasis;
  }
  if (/_cooked$/.test(canonicalKey)) return "cooked_grams";
  if (/oil|milk|drink/.test(canonicalKey)) return "ml";
  return "dry_grams";
}

// apps/web/lib/nutrition/meal-exposition-helpers.ts
function parseGramsFromPortion(hint) {
  if (!hint) return void 0;
  const gm = hint.match(/(\d+(?:[.,]\d+)?)\s*g(?:rammi?)?\b/i);
  if (gm) return Math.round(Number(parseFloat(gm[1].replace(",", "."))));
  const ml = hint.match(/(\d+(?:[.,]\d+)?)\s*ml\b/i);
  if (ml && /olio|evo|olive\s+oil/i.test(hint)) {
    return Math.round(Number(parseFloat(ml[1].replace(",", "."))) * 0.92);
  }
  return void 0;
}

// apps/web/lib/nutrition/v2/v2-mediterranean-meal-adapter.ts
function round1(n) {
  return Math.round(n * 10) / 10;
}
function gramsFromMediterraneanItem(it, canonicalKey, kcal) {
  const fromHint = parseGramsFromPortion(`${it.portionHint} ${it.name}`.trim());
  if (fromHint != null && fromHint > 0) return fromHint;
  const row2 = CANONICAL_FOOD_TABLE[canonicalKey];
  if (row2?.kcalPer100g) return Math.max(8, Math.round(kcal * 100 / row2.kcalPer100g));
  return 0;
}
function mediterraneanMealToV2Items(meal) {
  return meal.items.map((it) => {
    const canonicalKey = inferCanonicalFoodKeyPreferName(it.name, it.portionHint);
    const fdcId = fdcIdForCanonicalKey(canonicalKey) ?? 0;
    const servingBasis = servingBasisForCanonical(canonicalKey);
    const kcal = Math.max(1, Math.round(it.approxKcal));
    const grams = gramsFromMediterraneanItem(it, canonicalKey, kcal);
    const role = it.macroRole ?? "mixed";
    const split = role === "cho_heavy" ? { c: 0.72, p: 0.14, f: 0.14 } : role === "protein" ? { c: 0.25, p: 0.45, f: 0.3 } : role === "fat" ? { c: 0.18, p: 0.18, f: 0.64 } : role === "veg" ? { c: 0.45, p: 0.2, f: 0.35 } : { c: 0.5, p: 0.2, f: 0.3 };
    return {
      fdcId,
      description: it.name,
      grams,
      kcal,
      choG: round1(kcal * split.c / 4),
      proG: round1(kcal * split.p / 4),
      fatG: round1(kcal * split.f / 9),
      canonicalKey,
      servingBasis
    };
  });
}

// apps/web/lib/nutrition/v2/meal-slot-assembly-spec.ts
var MEAL_SLOT_ASSEMBLY = {
  breakfast: [
    {
      foodRole: "cho_complex",
      lever: "cho",
      poolKey: "breakfast_cho",
      minG: 30,
      maxG: 200,
      stepG: 5
    },
    {
      foodRole: "protein_primary",
      lever: "protein",
      poolKey: "breakfast_pro",
      minG: 80,
      maxG: 350,
      stepG: 10
    },
    {
      foodRole: "fat",
      lever: "fat",
      poolKey: "breakfast_fat",
      minG: 5,
      maxG: 45,
      stepG: 2
    }
  ],
  snack_am: [
    { foodRole: "cho_simple", lever: "cho", poolKey: "snack_cho", minG: 25, maxG: 180, stepG: 5 },
    { foodRole: "protein_secondary", lever: "protein", poolKey: "snack_pro", minG: 40, maxG: 200, stepG: 10 }
  ],
  lunch: [
    { foodRole: "cho_complex", lever: "cho", poolKey: "lunch_carb", minG: 45, maxG: 400, stepG: 5 },
    { foodRole: "protein_primary", lever: "protein", poolKey: "lunch_pro", minG: 80, maxG: 320, stepG: 5 },
    {
      foodRole: "veg_condiment",
      lever: "fixed",
      poolKey: "lunch_veg",
      minG: 80,
      maxG: 220,
      stepG: 10,
      fixedG: 120
    }
  ],
  snack_pm: [
    { foodRole: "cho_simple", lever: "cho", poolKey: "snack_cho", minG: 25, maxG: 180, stepG: 5 },
    { foodRole: "protein_secondary", lever: "protein", poolKey: "snack_pro", minG: 40, maxG: 200, stepG: 10 }
  ],
  dinner: [
    { foodRole: "cho_complex", lever: "cho", poolKey: "dinner_carb", minG: 45, maxG: 400, stepG: 5 },
    { foodRole: "protein_primary", lever: "protein", poolKey: "dinner_pro", minG: 80, maxG: 320, stepG: 5 },
    {
      foodRole: "veg_condiment",
      lever: "fixed",
      poolKey: "dinner_veg",
      minG: 80,
      maxG: 220,
      stepG: 10,
      fixedG: 120
    }
  ],
  snack_evening: [
    { foodRole: "cho_simple", lever: "cho", poolKey: "snack_cho", minG: 20, maxG: 150, stepG: 5 },
    { foodRole: "protein_secondary", lever: "protein", poolKey: "snack_pro", minG: 40, maxG: 180, stepG: 10 }
  ]
};
function slotMacroTargetsFromDiet(slot) {
  return {
    kcal: slot.kcal,
    carbsG: slot.carbs,
    proteinG: slot.protein,
    fatG: slot.fat
  };
}

// apps/web/lib/nutrition/v2/compose-meal-plan-v2.ts
function round12(n) {
  return Math.round(n * 10) / 10;
}
function macrosFromHit(c, grams) {
  const f = grams / 100;
  return {
    kcal: round12(c.kcalPer100g * f),
    choG: round12(c.carbsPer100g * f),
    proG: round12(c.proteinPer100g * f),
    fatG: round12(c.fatPer100g * f) || round12((c.kcalPer100g - c.carbsPer100g * 4 - c.proteinPer100g * 4) / 9 * f) || 0
  };
}
function pickFromPoolFallback(pool, ctx, denyFragments, usedFdcIds, staplePenalty) {
  const filtered = filterFdcCandidates(pool, denyFragments);
  const pick = pickBestFdcForRole(filtered, ctx, denyFragments, usedFdcIds, staplePenalty);
  if (pick) return pick;
  if (isMainMealSlot(ctx.slot) && ctx.spec.foodRole === "cho_complex") {
    for (const hit of filtered) {
      if (usedFdcIds.has(hit.fdcId) || hit.carbsPer100g < 12) continue;
      if (/\b(rice cake|crackers?|cookie|cake|snack bar)\b/i.test(hit.description)) continue;
      if (/\b(pasta|riso\b|potato|quinoa|spaghetti)\b/i.test(hit.description) && !/\brice cake\b/i.test(hit.description)) {
        return hit;
      }
    }
  }
  return null;
}
function portionHintIt(label, grams, spec, servingBasis) {
  const g = Math.round(grams);
  const basis = servingBasis ?? "dry_grams";
  if (spec.foodRole === "cho_complex" && (/pasta|semola/i.test(label) || basis === "dry_grams" && /pasta/i.test(label))) {
    return `${g} g pasta di semola (peso a crudo)`;
  }
  if (spec.foodRole === "cho_complex" && (/riso/i.test(label) || /rice/i.test(label))) {
    return basis === "dry_grams" ? `${g} g riso (peso a crudo)` : `${g} g riso cotto`;
  }
  if (spec.foodRole === "cho_complex" && /patat/i.test(label)) {
    return `${g} g patate lesse o al forno`;
  }
  if (spec.foodRole === "protein_primary" && /uov/i.test(label)) {
    return `${Math.max(1, Math.round(g / 50))} uova medie (\u2248${g} g)`;
  }
  if (/grana|parmesan|pecorino|padano/i.test(label)) {
    return `${g} g grana grattugiato`;
  }
  if (spec.foodRole === "fat" && /olio/i.test(label)) {
    return `${g} ml olio EVO`;
  }
  if (/latte/i.test(label)) {
    return `${g} ml latte`;
  }
  if (basis === "ml") return `${g} ml ${label}`;
  if (basis === "cooked_grams") return `${g} g ${label} (cotto)`;
  return `${g} g ${label}`;
}
function pickLineForRole(spec, slotKey, pools, ctx) {
  const roleCtx = { slot: slotKey, poolKey: spec.poolKey, spec };
  const seed = ctx.seed + spec.poolKey.length;
  const staplePick = pickStapleForPool({
    poolKey: spec.poolKey,
    seed,
    dietType: ctx.dietType,
    denyFragments: ctx.denyFragments,
    dayCtx: ctx.dayCtx,
    usedCarbFamilies: ctx.usedCarbFamilies,
    usedFdcIds: ctx.usedFdcIds
  });
  if (staplePick) {
    if (staplePick.entry.rotationKey) {
      ctx.usedCarbFamilies.add(staplePick.entry.rotationKey);
      ctx.dayCtx.usedStaples.add(staplePick.entry.rotationKey);
    } else if (staplePick.entry.carbFamily) {
      ctx.usedCarbFamilies.add(staplePick.entry.carbFamily);
    }
    if (staplePick.hit.fdcId > 0) ctx.usedFdcIds.add(staplePick.hit.fdcId);
    ctx.dayCtx.dayUsedCanonicalKeys?.add(staplePick.entry.canonicalKey);
    return { spec, hit: staplePick.hit, staple: staplePick.entry };
  }
  const rawPool = pools.get(spec.poolKey) ?? [];
  const hit = pickFromPoolFallback(rawPool, roleCtx, ctx.denyFragments, ctx.usedFdcIds, ctx.staplePenalty);
  if (!hit) return null;
  ctx.usedFdcIds.add(hit.fdcId);
  return { spec, hit };
}
function composeSlotFromAssembly(slot, pools, ctx) {
  const slotKey = slot.key;
  const roles = MEAL_SLOT_ASSEMBLY[slotKey] ?? MEAL_SLOT_ASSEMBLY.snack_am;
  const target = slotMacroTargetsFromDiet(slot);
  const lines = [];
  for (const spec of roles) {
    const line = pickLineForRole(spec, slotKey, pools, ctx);
    if (line) lines.push(line);
  }
  if (lines.length === 0) {
    return {
      slot: slot.key,
      labelIt: slot.label,
      targetKcal: slot.kcal,
      items: [],
      totals: { kcal: 0, choG: 0, proG: 0, fatG: 0 }
    };
  }
  applyRegola7Cho(lines, target, slotKey, ctx);
  const grams = solveFdcMealPortions(lines, target);
  const items = [];
  lines.forEach((line, i) => {
    const g = grams[i] ?? 0;
    const minG = line.spec.lever === "fat" ? 4 : 8;
    if (g < minG) return;
    const canonicalKey = line.staple?.canonicalKey;
    const servingBasis = line.staple?.servingBasis ?? (canonicalKey ? servingBasisForCanonical(canonicalKey) : void 0);
    const label = line.staple?.labelIt ?? line.hit.description;
    items.push({
      fdcId: line.hit.fdcId,
      description: label,
      grams: g,
      canonicalKey,
      servingBasis,
      ...macrosFromHit(line.hit, g)
    });
  });
  const totals = items.reduce(
    (acc, it) => ({
      kcal: round12(acc.kcal + it.kcal),
      choG: round12(acc.choG + it.choG),
      proG: round12(acc.proG + it.proG),
      fatG: round12(acc.fatG + it.fatG)
    }),
    { kcal: 0, choG: 0, proG: 0, fatG: 0 }
  );
  return {
    slot: slot.key,
    labelIt: slot.label,
    targetKcal: slot.kcal,
    items,
    totals
  };
}
function applyRegola7Cho(lines, target, slotKey, ctx) {
  if (!isMainMealSlot(slotKey)) return;
  const choIdx = lines.findIndex((l) => l.spec.lever === "cho");
  if (choIdx < 0) return;
  const choLine = lines[choIdx];
  if (target.carbsG > 100 && choLine.staple?.canonicalKey === "bread_white") {
    const alt = pickStapleForPool({
      poolKey: choLine.spec.poolKey,
      seed: ctx.seed + 17,
      dietType: ctx.dietType,
      denyFragments: ctx.denyFragments,
      dayCtx: ctx.dayCtx,
      usedCarbFamilies: ctx.usedCarbFamilies,
      usedFdcIds: ctx.usedFdcIds
    });
    if (alt && alt.entry.canonicalKey !== "bread_white") {
      lines[choIdx] = { spec: choLine.spec, hit: alt.hit, staple: alt.entry };
    }
  }
  if (target.carbsG >= 130 && !lines.some((l) => l.staple?.canonicalKey === "bread_white")) {
    const breadHit = pickStapleForPool({
      poolKey: "breakfast_cho",
      seed: ctx.seed + 31,
      dietType: ctx.dietType,
      denyFragments: ctx.denyFragments,
      dayCtx: ctx.dayCtx,
      usedCarbFamilies: ctx.usedCarbFamilies,
      usedFdcIds: ctx.usedFdcIds
    });
    if (breadHit?.entry.canonicalKey === "bread_white") {
      lines.push({
        spec: {
          foodRole: "cho_simple",
          lever: "fixed",
          poolKey: "breakfast_cho",
          minG: 40,
          maxG: 90,
          stepG: 5,
          fixedG: target.carbsG >= 180 ? 80 : 55
        },
        hit: breadHit.hit,
        staple: breadHit.entry
      });
    }
  }
}
function composeRaceSlot(slot, ctx) {
  const slotKey = slot.key;
  const req = ctx.request;
  if (!req) return null;
  const slotMacros = {
    kcal: slot.kcal,
    carbsG: slot.carbs,
    proteinG: slot.protein,
    fatG: slot.fat
  };
  if (isRacePreRaceMealSlot(slotKey, req.racePreLunch ?? null)) {
    const meal = composeRacePreLunchMainMeal(slotKey, slotMacros, ctx.seed, req.racePreLunch, ctx.dayCtx);
    const items = mediterraneanMealToV2Items(meal);
    const totals = items.reduce(
      (acc, it) => ({
        kcal: round12(acc.kcal + it.kcal),
        choG: round12(acc.choG + it.choG),
        proG: round12(acc.proG + it.proG),
        fatG: round12(acc.fatG + it.fatG)
      }),
      { kcal: 0, choG: 0, proG: 0, fatG: 0 }
    );
    return { slot: slot.key, labelIt: slot.label, targetKcal: slot.kcal, items, totals };
  }
  if (req.racePostRecovery && slotKey === req.racePostRecovery.mealSlot) {
    const meal = composeRacePostRecoveryMeal(slotKey, ctx.seed, req.racePostRecovery, ctx.dayCtx);
    const items = mediterraneanMealToV2Items(meal);
    const totals = items.reduce(
      (acc, it) => ({
        kcal: round12(acc.kcal + it.kcal),
        choG: round12(acc.choG + it.choG),
        proG: round12(acc.proG + it.proG),
        fatG: round12(acc.fatG + it.fatG)
      }),
      { kcal: 0, choG: 0, proG: 0, fatG: 0 }
    );
    return { slot: slot.key, labelIt: slot.label, targetKcal: slot.kcal, items, totals };
  }
  return null;
}
function normalizeDietType(raw) {
  const d = (raw ?? "").trim().toLowerCase();
  if (d === "vegan" || d.includes("vegan")) return "vegan";
  if (d === "vegetarian" || d.includes("veget")) return "vegetarian";
  if (d === "pescatarian" || d.includes("pesc")) return "pescatarian";
  return "omnivore";
}
function composeMealPlanV2(requirements, dietSlots, pools, options) {
  void requirements;
  const denyFragments = options?.denyFragments ?? [];
  const suppressed = new Set(options?.suppressedSlots ?? []);
  const request = options?.request;
  const seed = Math.abs((request?.planDate ?? "2026-01-01").split("-").reduce((a, p) => a + Number(p), 0));
  const dayCtx = createMediterraneanDayContext(
    request?.planDate ?? (/* @__PURE__ */ new Date()).toISOString().slice(0, 10),
    options?.weeklyStapleCounts,
    request?.postWorkoutMealBySlot,
    normalizeDietType(request?.dietType),
    denyFragments,
    options?.suppressedSlots,
    request?.racePreLunch ?? void 0,
    request?.racePostRecovery ?? void 0
  );
  const usedFdcIds = /* @__PURE__ */ new Set();
  const usedCarbFamilies = /* @__PURE__ */ new Set();
  const staplePenalty = (description) => {
    const key = description.slice(0, 40).toLowerCase();
    return options?.weeklyStapleCounts?.[key] ?? 0;
  };
  const ctx = {
    seed,
    dietType: normalizeDietType(request?.dietType),
    denyFragments,
    dayCtx,
    usedFdcIds,
    usedCarbFamilies,
    staplePenalty,
    request
  };
  return dietSlots.map((slot) => {
    if (suppressed.has(slot.key)) {
      return {
        slot: slot.key,
        labelIt: slot.label,
        targetKcal: slot.kcal,
        items: [],
        totals: { kcal: 0, choG: 0, proG: 0, fatG: 0 }
      };
    }
    const raceSlot = composeRaceSlot(slot, ctx);
    if (raceSlot) return raceSlot;
    return composeSlotFromAssembly(slot, pools, ctx);
  });
}

// apps/web/lib/nutrition/v2/fdc-pool-specs.ts
var FDC_BRANCH_POOL_SPECS = [
  {
    poolKey: "breakfast_cho",
    labelIt: "Colazione \u2014 carboidrato complesso",
    filter: { dietProfile: "omnivore", slotFit: "breakfast", macroDominant: "cho_complex", limit: 24 }
  },
  {
    poolKey: "breakfast_pro",
    labelIt: "Colazione \u2014 proteina",
    filter: { dietProfile: "omnivore", slotFit: "breakfast", macroDominant: "protein_dense", limit: 20 }
  },
  {
    poolKey: "breakfast_fat",
    labelIt: "Colazione \u2014 grasso",
    filter: { dietProfile: "omnivore", slotFit: "breakfast", macroDominant: "fat_dense", limit: 16 }
  },
  { poolKey: "lunch_carb", labelIt: "Pranzo \u2014 primo (carb)", filter: { dietProfile: "omnivore", slotFit: "main_meal", mealCourse: "primo_carb", limit: 24 } },
  { poolKey: "lunch_pro", labelIt: "Pranzo \u2014 secondo (proteina)", filter: { dietProfile: "omnivore", slotFit: "main_meal", mealCourse: "secondo_protein", limit: 24 } },
  { poolKey: "lunch_veg", labelIt: "Pranzo \u2014 contorno verdura", filter: { dietProfile: "omnivore", slotFit: "main_meal", mealCourse: "contorno_veg", limit: 20 } },
  { poolKey: "dinner_carb", labelIt: "Cena \u2014 primo (carb)", filter: { dietProfile: "omnivore", slotFit: "main_meal", mealCourse: "primo_carb", limit: 24 } },
  { poolKey: "dinner_pro", labelIt: "Cena \u2014 secondo (proteina)", filter: { dietProfile: "omnivore", slotFit: "main_meal", mealCourse: "secondo_protein", limit: 24 } },
  { poolKey: "dinner_veg", labelIt: "Cena \u2014 contorno verdura", filter: { dietProfile: "omnivore", slotFit: "main_meal", mealCourse: "contorno_veg", limit: 20 } },
  {
    poolKey: "snack_cho",
    labelIt: "Spuntino \u2014 carb (frutta / CHO leggero)",
    filter: { dietProfile: "omnivore", slotFit: "snack", macroDominant: "cho_simple", limit: 20 }
  },
  {
    poolKey: "snack_pro",
    labelIt: "Spuntino \u2014 proteina",
    filter: { dietProfile: "omnivore", slotFit: "snack", macroDominant: "protein_dense", limit: 16 }
  },
  { poolKey: "fueling", labelIt: "Fueling sport", filter: { dietProfile: "omnivore", slotFit: "fueling", mealCourse: "energetico_sport", limit: 12 } }
];

// apps/web/lib/nutrition/v2/classify-fdc-description.ts
function has(re, text) {
  return re.test(text);
}
function inferMacroDominant(row2) {
  const kcal = Math.max(1, row2.kcalPer100g);
  const p = row2.proteinG * 4 / kcal;
  const c = row2.carbsG * 4 / kcal;
  const f = row2.fatG * 9 / kcal;
  const fib = row2.fiberG ?? 0;
  if (fib >= 4 && c < 0.45) return ["fiber_dense"];
  if (p >= 0.28) return ["protein_dense"];
  if (f >= 0.45) return ["fat_dense"];
  if (c >= 0.55 && row2.carbsG >= 15) return row2.carbsG >= 40 ? ["cho_complex"] : ["cho_simple"];
  return ["mixed"];
}
function inferFoodFamily(desc) {
  const d = desc.toLowerCase();
  const out = [];
  if (has(/\b(pasta|spaghetti|rice\b|riso|quinoa|farro|barley|bulgur|couscous|macaroni)\b/i, d)) out.push("pasta_riso");
  if (has(/\b(bread|pane|toast|cracker|bagel|roll)\b/i, d)) out.push("pane", "cereale");
  if (has(/\b(oat|cereal|muesli|granola|corn flakes|bran flakes|wheat, cream|grits)\b/i, d)) out.push("cereale");
  if (has(/\b(chicken|pollo|turkey|beef|pork|lamb|meat|bresaola)\b/i, d)) out.push("carne");
  if (has(/\b(fish|salmon|tuna|cod|sardine|pesce|sgombro)\b/i, d)) out.push("pesce");
  if (has(/\b(egg|uova)\b/i, d)) out.push("uova");
  if (has(/\b(milk|yogurt|cheese|ricotta|mozzarella|latte|formaggio)\b/i, d)) out.push("latticino");
  if (has(/\b(lentil|chickpea|bean|legume|ceci|lenticch|fagiol)\b/i, d)) out.push("legume");
  if (has(/\b(spinach|broccoli|pepper|tomato|lettuce|kale|carrot|vegetable|verdur)\b/i, d)) out.push("verdura");
  if (has(/\b(apple|banana|orange|berry|fruit|kiwi|mela|frutta)\b/i, d)) out.push("frutta");
  if (has(/\b(almond|walnut|seed|nut|mandorl|semi)\b/i, d)) out.push("oleaginoso");
  if (has(/\b(oil|olive|olio)\b/i, d)) out.push("olio");
  if (has(/\b(potato|patat|sweet potato)\b/i, d)) out.push("tuberi");
  if (has(/\b(almond milk|soy milk|oat milk|rice milk|beverage)\b/i, d)) out.push("bevanda_vegetale");
  return [...new Set(out)];
}
function inferMealCourse(desc, families) {
  const d = desc.toLowerCase();
  const out = [];
  if (families.includes("pasta_riso") || families.includes("pane")) out.push("primo_carb");
  if (families.includes("carne") || families.includes("pesce") || families.includes("uova") || families.includes("legume"))
    out.push("secondo_protein");
  if (families.includes("verdura")) out.push("contorno_veg");
  if (families.includes("frutta")) out.push("frutta");
  if (has(/\b(cookie|cake|chocolate|biscuit|dolce|dessert|granola bar)\b/i, d)) out.push("dolce", "snack");
  if (has(/\b(milk|juice|beverage|drink|coffee|tea|latte)\b/i, d)) out.push("bevanda");
  if (families.includes("latticino")) out.push("latticino");
  if (families.includes("legume")) out.push("legume");
  if (has(/\b(sauce|dressing|vinegar|condiment)\b/i, d)) out.push("condimento");
  if (has(/\b(pizza|lasagna|casserole|stew)\b/i, d)) out.push("composite_dish");
  if (has(/\b(powder|whey|protein powder)\b/i, d)) out.push("preparato_polvere");
  if (has(/\b(sport|energy gel|isotonic)\b/i, d)) out.push("energetico_sport");
  return [...new Set(out)];
}
function inferSlotFit(courses, families, desc) {
  const d = desc.toLowerCase();
  const out = [];
  const breakfastOnlyCarb = families.includes("cereale") && !families.includes("pasta_riso") && has(/\b(oat|cereal|muesli|granola|corn flakes|bran|wheat, cream|grits)\b/i, d);
  const junkSnack = has(/\b(chip|crisp|french fries|pretzel|popcorn|cookie|donut|doughnut|ice cream|candy|snack bar)\b/i, d);
  if (courses.includes("frutta") || courses.includes("bevanda") || courses.includes("preparato_polvere"))
    out.push("breakfast", "snack");
  if ((courses.includes("primo_carb") || courses.includes("secondo_protein") || courses.includes("contorno_veg")) && !breakfastOnlyCarb && !junkSnack) {
    out.push("main_meal");
  }
  if (courses.includes("energetico_sport")) out.push("fueling");
  if (courses.includes("dolce") || families.includes("latticino") || breakfastOnlyCarb) out.push("evening", "snack", "breakfast");
  if (out.length === 0 && !junkSnack) out.push("main_meal");
  return [...new Set(out)];
}
function inferDietExclude(desc, families) {
  const d = desc.toLowerCase();
  const out = [];
  if (families.includes("carne") || families.includes("pesce") || families.includes("uova") || families.includes("latticino")) {
    out.push("animal");
  }
  if (families.includes("latticino")) out.push("lactose");
  if (families.includes("pane") || families.includes("pasta_riso") || families.includes("cereale") || has(/\b(wheat|gluten|barley|rye|spelt|farro|malt|bread|pasta)\b/i, d)) {
    out.push("gluten", "grain");
  }
  if (families.includes("legume")) out.push("legume");
  if (has(/\b(tomato|eggplant|pepper|potato|nightshade)\b/i, d)) out.push("nightshade");
  if (has(/\b(aged cheese|wine|ferment|tuna|canned|salami|vinegar|sauerkraut|soy sauce)\b/i, d)) {
    out.push("high_histamine");
  }
  return [...new Set(out)];
}
function inferMealRole(courses) {
  const out = [];
  if (courses.includes("primo_carb")) out.push("primo");
  if (courses.includes("secondo_protein")) out.push("secondo");
  if (courses.includes("contorno_veg")) out.push("contorno");
  if (courses.includes("dolce")) out.push("dolce");
  if (courses.includes("bevanda")) out.push("bevanda");
  if (courses.includes("snack") || courses.includes("frutta")) out.push("snack");
  return [...new Set(out)];
}
function inferDietProfile(desc, families, exclude) {
  const d = desc.toLowerCase();
  const out = ["omnivore"];
  const isMeat = families.includes("carne");
  const isFish = families.includes("pesce");
  const isDairy = families.includes("latticino");
  const isEgg = families.includes("uova");
  const isLegume = families.includes("legume");
  const isGrain = families.includes("cereale") || families.includes("pasta_riso") || families.includes("pane");
  const hasAnimal = exclude.includes("animal");
  if (!hasAnimal && !has(/\b(honey|gelatin|whey|casein)\b/i, d)) out.push("vegan", "vegetarian", "lactose_free");
  else if (!isMeat && !isFish) out.push("vegetarian");
  if (!isMeat && isFish) out.push("pescatarian");
  if (!isGrain && !exclude.includes("gluten")) out.push("celiac");
  if (!isDairy) out.push("lactose_free");
  if (!exclude.includes("high_histamine")) out.push("low_histamine");
  if (isMeat && !isGrain && !isLegume) out.push("carnivore", "paleo");
  if (!isMeat && (isFish || isLegume || isGrain || families.includes("pasta_riso") || families.includes("verdura") || families.includes("olio"))) {
    out.push("mediterranean");
  }
  if (has(/\b(coconut milk|lemongrass|basil|thai|curry paste|fish sauce|rice noodle)\b/i, d)) out.push("thai");
  return [...new Set(out)];
}
function inferAminoProfile(desc, row2) {
  const d = desc.toLowerCase();
  const out = [];
  if (has(/\b(aged cheese|wine|ferment|tuna|canned|salami|sardine|mackerel|soy sauce|vinegar|sauerkraut|tomato)\b/i, d))
    out.push("histamine_rich");
  else out.push("histamine_low");
  if (has(/\b(whey|casein|beef|chicken|fish|egg|tofu|yogurt)\b/i, d) && row2.proteinG >= 15) {
    out.push("leucine_rich", "bcaa_rich");
  }
  if (has(/\b(bone broth|gelatin|collagen)\b/i, d)) out.push("collagen_rich", "glutamine_rich");
  if (has(/\b(cottage|ricotta|turkey|banana)\b/i, d)) out.push("tryptophan_rich");
  if (has(/\b(seafood|shellfish|heart|liver)\b/i, d)) out.push("taurine_rich");
  if (row2.proteinG >= 8 && has(/\b(meat|fish|legume|dairy|egg)\b/i, d)) out.push("glutamine_rich");
  return [...new Set(out)];
}
function inferNutrientDensity(desc, row2) {
  const d = desc.toLowerCase();
  const out = [];
  if (has(/\b(spinach|lentil|asparagus|leafy|legume)\b/i, d)) out.push("folate_dense", "iron_dense");
  if (has(/\b(liver|beef|lentil|spinach)\b/i, d)) out.push("iron_dense");
  if (has(/\b(egg|fish|liver|milk|cheese)\b/i, d)) out.push("b12_dense");
  if (has(/\b(oyster|pumpkin seed|beef|chickpea)\b/i, d)) out.push("zinc_dense");
  if (has(/\b(almond|spinach|pumpkin|dark chocolate)\b/i, d)) out.push("magnesium_dense");
  if (has(/\b(pepper|citrus|kiwi|strawber|broccoli)\b/i, d)) out.push("vit_c_dense");
  if (has(/\b(salmon|sardine|mackerel|fish oil)\b/i, d)) out.push("omega3_dense");
  if (has(/\b(banana|potato|bean)\b/i, d) && row2.carbsG >= 15) out.push("potassium_dense");
  return [...new Set(out)];
}
function classifyFdcFoodRow(input) {
  const desc = input.description.trim();
  const macroRow = input;
  const foodFamily = inferFoodFamily(desc);
  const mealCourse = inferMealCourse(desc, foodFamily);
  const macroDominant = inferMacroDominant(macroRow);
  const slotFit = inferSlotFit(mealCourse, foodFamily, desc);
  const dietExclude = inferDietExclude(desc, foodFamily);
  const dietProfile = inferDietProfile(desc, foodFamily, dietExclude);
  const mealRole = inferMealRole(mealCourse);
  const aminoProfile = inferAminoProfile(desc, macroRow);
  const nutrientDensity = inferNutrientDensity(desc, macroRow);
  return {
    mealCourse,
    foodFamily,
    macroDominant,
    slotFit,
    dietProfile,
    dietExclude,
    mealRole,
    aminoProfile,
    nutrientDensity,
    classifierVersion: CLASSIFIER_VERSION
  };
}
function dietExcludeForActiveProfile(active) {
  switch (active) {
    case "celiac":
      return ["gluten"];
    case "lactose_free":
      return ["lactose"];
    case "vegan":
      return ["animal"];
    case "vegetarian":
      return [];
    case "paleo":
      return ["grain", "legume"];
    case "low_histamine":
      return ["high_histamine"];
    default:
      return [];
  }
}
function foodMatchesDietProfile(taxonomy, active) {
  const mustExclude = dietExcludeForActiveProfile(active);
  if (mustExclude.some((t) => taxonomy.dietExclude.includes(t))) return false;
  if (active === "omnivore") return true;
  if (taxonomy.dietProfile.includes(active)) return true;
  if (active === "vegetarian" && taxonomy.dietProfile.includes("vegan")) return true;
  if (active === "pescatarian") {
    if (taxonomy.foodFamily.includes("carne")) return false;
    return taxonomy.dietProfile.includes("pescatarian") || taxonomy.dietProfile.includes("vegetarian") || taxonomy.dietProfile.includes("vegan");
  }
  if (active === "mediterranean") return taxonomy.dietProfile.includes("mediterranean") || taxonomy.dietProfile.includes("omnivore");
  if (active === "celiac") return !taxonomy.dietExclude.includes("gluten");
  if (active === "vegan") return taxonomy.dietProfile.includes("vegan") && !taxonomy.dietExclude.includes("animal");
  if (active === "vegetarian") {
    if (taxonomy.foodFamily.includes("carne") || taxonomy.foodFamily.includes("pesce")) return false;
    return taxonomy.dietProfile.includes("vegetarian") || taxonomy.dietProfile.includes("vegan");
  }
  return false;
}
function taxonomyMatchesFilter(taxonomy, filter) {
  if (!foodMatchesDietProfile(taxonomy, filter.dietProfile)) return false;
  if (filter.slotFit && !taxonomy.slotFit.includes(filter.slotFit)) return false;
  if (filter.mealCourse && !taxonomy.mealCourse.includes(filter.mealCourse)) return false;
  if (filter.mealRole && !taxonomy.mealRole.includes(filter.mealRole)) return false;
  if (filter.macroDominant && !taxonomy.macroDominant.includes(filter.macroDominant)) return false;
  if (filter.foodFamily && !taxonomy.foodFamily.includes(filter.foodFamily)) return false;
  if (filter.nutrientDensity && !taxonomy.nutrientDensity.includes(filter.nutrientDensity)) return false;
  if (filter.aminoProfile && !taxonomy.aminoProfile.includes(filter.aminoProfile)) return false;
  const absent = filter.requireDietExcludeAbsent ?? dietExcludeForActiveProfile(filter.dietProfile);
  if (absent.some((t) => taxonomy.dietExclude.includes(t))) return false;
  if (filter.excludeAminoProfile?.some((t) => taxonomy.aminoProfile.includes(t))) return false;
  if (filter.dietProfile === "low_histamine" && taxonomy.aminoProfile.includes("histamine_rich")) return false;
  return true;
}

// apps/web/lib/nutrition/v2/fdc-branch-query.ts
var TAG_PREFETCH_CAP = 300;
function fdcRowToHit(row2, tagRow) {
  const fdcId = Math.round(Number(row2.fdc_id));
  if (!Number.isFinite(fdcId) || fdcId < 1) return null;
  const description = String(row2.description ?? "").trim();
  if (!description) return null;
  const kcalPer100g = Number(row2.kcal_100g) || 0;
  const proteinPer100g = Number(row2.protein_100g) || 0;
  const carbsPer100g = Number(row2.carbs_100g) || 0;
  const fatPer100g = Number(row2.fat_100g) || 0;
  const fiberG = row2.fiber_100g != null ? Number(row2.fiber_100g) : void 0;
  let tags;
  let tagSource = "runtime_classifier";
  if (tagRow && Array.isArray(tagRow.diet_profile)) {
    tags = {
      mealCourse: tagRow.meal_course ?? [],
      foodFamily: tagRow.food_family ?? [],
      macroDominant: tagRow.macro_dominant ?? [],
      slotFit: tagRow.slot_fit ?? [],
      dietProfile: tagRow.diet_profile ?? [],
      dietExclude: tagRow.diet_exclude ?? [],
      mealRole: tagRow.meal_role ?? [],
      aminoProfile: tagRow.amino_profile ?? [],
      nutrientDensity: tagRow.nutrient_density ?? [],
      classifierVersion: String(tagRow.classifier_version ?? CLASSIFIER_VERSION)
    };
    tagSource = "db";
  } else {
    tags = classifyFdcFoodRow({
      description,
      kcalPer100g,
      proteinG: proteinPer100g,
      carbsG: carbsPer100g,
      fatG: fatPer100g,
      fiberG
    });
  }
  return {
    fdcId,
    description,
    kcalPer100g,
    proteinPer100g,
    carbsPer100g,
    fatPer100g,
    tags,
    tagSource
  };
}
function applyDietProfileSqlFilter(query, dietProfile) {
  if (dietProfile === "omnivore") return query;
  if (dietProfile === "mediterranean") {
    return query.or("diet_profile.cs.{mediterranean},diet_profile.cs.{omnivore}");
  }
  if (dietProfile === "vegetarian") {
    return query.or("diet_profile.cs.{vegetarian},diet_profile.cs.{vegan}");
  }
  if (dietProfile === "pescatarian") {
    return query.or("diet_profile.cs.{pescatarian},diet_profile.cs.{vegetarian},diet_profile.cs.{vegan}");
  }
  return query.contains("diet_profile", [dietProfile]);
}
async function queryFdcBranchPool(admin, filter) {
  const limit = Math.min(80, Math.max(5, filter.limit ?? 24));
  const prefetch = Math.min(TAG_PREFETCH_CAP, Math.max(limit * 6, 48));
  let tagQuery = admin.from("nutrition_fdc_food_tags").select(
    "fdc_id, meal_course, food_family, macro_dominant, slot_fit, diet_profile, diet_exclude, meal_role, amino_profile, nutrient_density, classifier_version"
  );
  tagQuery = applyDietProfileSqlFilter(tagQuery, filter.dietProfile);
  const mustExclude = filter.requireDietExcludeAbsent ?? dietExcludeForActiveProfile(filter.dietProfile);
  if (mustExclude.length > 0) {
    tagQuery = tagQuery.not("diet_exclude", "ov", mustExclude);
  }
  if (filter.slotFit) tagQuery = tagQuery.contains("slot_fit", [filter.slotFit]);
  if (filter.mealCourse) tagQuery = tagQuery.contains("meal_course", [filter.mealCourse]);
  if (filter.mealRole) tagQuery = tagQuery.contains("meal_role", [filter.mealRole]);
  if (filter.macroDominant) tagQuery = tagQuery.contains("macro_dominant", [filter.macroDominant]);
  if (filter.foodFamily) tagQuery = tagQuery.contains("food_family", [filter.foodFamily]);
  if (filter.aminoProfile) tagQuery = tagQuery.contains("amino_profile", [filter.aminoProfile]);
  if (filter.nutrientDensity) tagQuery = tagQuery.contains("nutrient_density", [filter.nutrientDensity]);
  for (const amino of filter.excludeAminoProfile ?? []) {
    tagQuery = tagQuery.not("amino_profile", "cs", [amino]);
  }
  if (filter.dietProfile === "low_histamine") {
    tagQuery = tagQuery.not("amino_profile", "cs", ["histamine_rich"]);
  }
  const { data: tagRows, error: tagErr } = await tagQuery.order("fdc_id").limit(prefetch);
  if (tagErr || !Array.isArray(tagRows) || tagRows.length === 0) return [];
  const tagMap = /* @__PURE__ */ new Map();
  const ids = [];
  for (const tr of tagRows) {
    const row2 = tr;
    const id = Math.round(Number(row2.fdc_id));
    if (!Number.isFinite(id) || id < 1) continue;
    tagMap.set(id, row2);
    ids.push(id);
  }
  if (ids.length === 0) return [];
  const { data: foods, error: foodErr } = await admin.from("nutrition_fdc_foods").select("fdc_id, description, kcal_100g, protein_100g, carbs_100g, fat_100g, fiber_100g").in("fdc_id", ids).gt("kcal_100g", 0);
  if (foodErr || !Array.isArray(foods) || foods.length === 0) return [];
  const hits = [];
  for (const row2 of foods) {
    const r = row2;
    const id = Math.round(Number(r.fdc_id));
    const hit = fdcRowToHit(r, tagMap.get(id) ?? null);
    if (!hit || hit.tagSource !== "db") continue;
    if (!isPlausiblePer100gMacros({
      kcal_100: hit.kcalPer100g,
      carbs_100: hit.carbsPer100g,
      protein_100: hit.proteinPer100g,
      fat_100: hit.fatPer100g
    })) {
      continue;
    }
    if (!taxonomyMatchesFilter(hit.tags, filter)) continue;
    hits.push(hit);
    if (hits.length >= limit) break;
  }
  return hits;
}

// apps/web/lib/nutrition/fueling-product-catalog.ts
function isIntraCarbohydrateEligibleProduct(p) {
  if (!p.timing.includes("intra")) return false;
  if (p.functionalFocus.includes("bcaa") || p.functionalFocus.includes("eaa")) return false;
  if (p.functionalFocus.includes("protein") && !p.functionalFocus.includes("carbo")) return false;
  if (p.functionalFocus.includes("preworkout") && !p.functionalFocus.includes("carbo")) return false;
  if (p.functionalFocus.includes("recovery") && !p.functionalFocus.includes("carbo")) return false;
  if (p.functionalFocus.includes("creatine") && !p.functionalFocus.includes("carbo")) return false;
  return p.functionalFocus.includes("carbo");
}
var FUELING_PRODUCT_CATALOG = [
  { brand: "Enervit", product: "R2 Recovery Drink", category: "recovery", productUrl: "https://www.enervit.com/en/wp-recovery-drink.html", logoDomain: "enervit.com", format: "powder", functionalFocus: ["recovery", "protein", "carbo"], timing: ["post"] },
  { brand: "Enervit", product: "C2:1PRO Gel", category: "gel", productUrl: "https://www.enervit.com/en/products/the-carbo-gel-c-2-1-pro-orange.html", logoDomain: "enervit.com", format: "gel", functionalFocus: ["carbo"], timing: ["intra"], carbohydrateGPerServing: 30 },
  {
    brand: "Enervit",
    product: "Isocarb C2:1PRO",
    category: "drink",
    productUrl: "https://www.enervit.com/en/products/isocarb-c-2-1-pro.html",
    logoDomain: "enervit.com",
    imageUrl: "https://enervit.kleecks-cdn.com/media/catalog/product/b/u/busta-isocarb-lemon-786x818_con_ombra.jpg",
    format: "powder",
    functionalFocus: ["carbo", "electrolyte"],
    timing: ["pre", "intra"],
    carbohydrateGPerServing: 40
  },
  { brand: "Enervit", product: "Competition Bar", category: "bar", productUrl: "https://www.enervit.com/en/competition-bar-orange.html", logoDomain: "enervit.com", format: "bar", functionalFocus: ["carbo"], timing: ["pre", "intra"], carbohydrateGPerServing: 38 },
  { brand: "Enervit", product: "Pre Sport", category: "drink", productUrl: "https://www.enervit.com", logoDomain: "enervit.com", format: "powder", functionalFocus: ["preworkout", "caffeine"], timing: ["pre"] },
  { brand: "Enervit", product: "Whey Protein", category: "recovery", productUrl: "https://www.enervit.com", logoDomain: "enervit.com", format: "powder", functionalFocus: ["protein", "recovery"], timing: ["post", "daily"] },
  { brand: "Enervit", product: "EAA Amino Mix", category: "drink", productUrl: "https://www.enervit.com", logoDomain: "enervit.com", format: "powder", functionalFocus: ["eaa", "recovery"], timing: ["post", "daily"] },
  { brand: "Enervit", product: "BCAA 2:1:1", category: "chew", productUrl: "https://www.enervit.com", logoDomain: "enervit.com", format: "tablet", functionalFocus: ["bcaa", "recovery"], timing: ["pre", "post", "daily"] },
  { brand: "Maurten", product: "Drink Mix 160", category: "drink", productUrl: "https://www.maurten.com/products/drink-mix-160-box", logoDomain: "maurten.com", format: "powder", functionalFocus: ["carbo"], timing: ["pre", "intra"], carbohydrateGPerServing: 39 },
  { brand: "Maurten", product: "Gel 100", category: "gel", productUrl: "https://www.maurten.com/products/hr/gel-100-box", logoDomain: "maurten.com", format: "gel", functionalFocus: ["carbo"], timing: ["intra"], carbohydrateGPerServing: 25 },
  { brand: "Maurten", product: "Gel 100 Caf 100", category: "chew", productUrl: "https://www.maurten.com/products/hr/gel-100-caf-100-box", logoDomain: "maurten.com", format: "gel", functionalFocus: ["carbo", "caffeine"], timing: ["pre", "intra"], carbohydrateGPerServing: 25 },
  { brand: "Maurten", product: "Drink Mix 320", category: "drink", productUrl: "https://www.maurten.com", logoDomain: "maurten.com", format: "powder", functionalFocus: ["carbo"], timing: ["intra"], carbohydrateGPerServing: 40 },
  { brand: "Maurten", product: "Solid 160", category: "bar", productUrl: "https://www.maurten.com", logoDomain: "maurten.com", format: "bar", functionalFocus: ["carbo"], timing: ["pre", "intra"], carbohydrateGPerServing: 40 },
  { brand: "SiS", product: "REGO Rapid Recovery", category: "recovery", productUrl: "https://www.scienceinsport.com/shop-sis/rego-range/rapid-recovery-1kg", logoDomain: "scienceinsport.com", format: "powder", functionalFocus: ["recovery", "protein", "carbo"], timing: ["post"] },
  { brand: "SiS", product: "GO Isotonic Gel", category: "gel", productUrl: "https://www.scienceinsport.com/shop-sis/go-range/go-isotonic-energy-gel", logoDomain: "scienceinsport.com", format: "gel", functionalFocus: ["carbo"], timing: ["intra"], carbohydrateGPerServing: 22 },
  { brand: "SiS", product: "Beta Fuel Drink", category: "drink", productUrl: "https://www.scienceinsport.com/shop-sis/beta-fuel-range/beta-fuel-energy-drink", logoDomain: "scienceinsport.com", format: "powder", functionalFocus: ["carbo", "electrolyte"], timing: ["intra"], carbohydrateGPerServing: 40 },
  { brand: "SiS", product: "GO Energy Bar", category: "bar", productUrl: "https://www.scienceinsport.com/shop-sis/go-range/go-energy-bar", logoDomain: "scienceinsport.com", format: "bar", functionalFocus: ["carbo"], timing: ["pre", "intra"], carbohydrateGPerServing: 40 },
  { brand: "SiS", product: "GO Electrolyte", category: "drink", productUrl: "https://www.scienceinsport.com", logoDomain: "scienceinsport.com", format: "powder", functionalFocus: ["carbo", "electrolyte"], timing: ["pre", "intra"], carbohydrateGPerServing: 36 },
  { brand: "SiS", product: "GO Caffeine Gel", category: "gel", productUrl: "https://www.scienceinsport.com", logoDomain: "scienceinsport.com", format: "gel", functionalFocus: ["carbo", "caffeine"], timing: ["pre", "intra"], carbohydrateGPerServing: 22 },
  { brand: "SiS", product: "Beta Fuel Chew", category: "chew", productUrl: "https://www.scienceinsport.com", logoDomain: "scienceinsport.com", format: "chew", functionalFocus: ["carbo"], timing: ["intra"], carbohydrateGPerServing: 46 },
  { brand: "SiS", product: "BCAA Performance", category: "drink", productUrl: "https://www.scienceinsport.com", logoDomain: "scienceinsport.com", format: "powder", functionalFocus: ["bcaa", "recovery"], timing: ["post", "daily"] },
  { brand: "+Watt", product: "R.M. Pump Recovery Mix", category: "recovery", productUrl: "https://watt.it/en/post-workout-en/r-m-pump-recovery-mix/", logoDomain: "watt.it", format: "powder", functionalFocus: ["recovery", "protein", "carbo"], timing: ["post"] },
  { brand: "+Watt", product: "Energy Gel", category: "gel", productUrl: "https://watt.it", logoDomain: "watt.it", format: "gel", functionalFocus: ["carbo"], timing: ["intra"], carbohydrateGPerServing: 30 },
  { brand: "+Watt", product: "Carbo Drink", category: "drink", productUrl: "https://watt.it", logoDomain: "watt.it", format: "powder", functionalFocus: ["carbo", "electrolyte"], timing: ["pre", "intra"], carbohydrateGPerServing: 40 },
  { brand: "+Watt", product: "Pre Workout Nitro Pump", category: "drink", productUrl: "https://watt.it", logoDomain: "watt.it", format: "powder", functionalFocus: ["preworkout", "caffeine"], timing: ["pre"] },
  { brand: "+Watt", product: "Whey Isolate", category: "recovery", productUrl: "https://watt.it", logoDomain: "watt.it", format: "powder", functionalFocus: ["protein", "recovery"], timing: ["post", "daily"] },
  { brand: "+Watt", product: "EAA Zero", category: "drink", productUrl: "https://watt.it", logoDomain: "watt.it", format: "powder", functionalFocus: ["eaa", "recovery"], timing: ["post", "daily"] },
  { brand: "+Watt", product: "BCAA 4:1:1", category: "chew", productUrl: "https://watt.it", logoDomain: "watt.it", format: "tablet", functionalFocus: ["bcaa"], timing: ["pre", "post", "daily"] },
  { brand: "+Watt", product: "Creatine Powder", category: "drink", productUrl: "https://watt.it", logoDomain: "watt.it", format: "powder", functionalFocus: ["creatine"], timing: ["daily", "post"] },
  { brand: "Powerbar", product: "Recovery Max", category: "recovery", productUrl: "https://www.powerbar.com/en-gb/products/recovery-max-regeneration-whey-drink-with-carbohydrates", logoDomain: "powerbar.com", format: "powder", functionalFocus: ["recovery", "protein", "carbo"], timing: ["post"] },
  { brand: "Powerbar", product: "PowerGel Hydro", category: "gel", productUrl: "https://www.powerbar.com", logoDomain: "powerbar.com", format: "gel", functionalFocus: ["carbo"], timing: ["intra"], carbohydrateGPerServing: 27 },
  { brand: "Powerbar", product: "IsoActive Drink", category: "drink", productUrl: "https://www.powerbar.com/en-gb/products/isoactive-isotonic-sports-drink", logoDomain: "powerbar.com", format: "powder", functionalFocus: ["carbo", "electrolyte"], timing: ["pre", "intra"], carbohydrateGPerServing: 33 },
  { brand: "Powerbar", product: "Energize Original", category: "bar", productUrl: "https://www.powerbar.com", logoDomain: "powerbar.com", format: "bar", functionalFocus: ["carbo"], timing: ["pre", "intra"], carbohydrateGPerServing: 40 },
  { brand: "Powerbar", product: "Black Line Pre-Workout", category: "drink", productUrl: "https://www.powerbar.com", logoDomain: "powerbar.com", format: "powder", functionalFocus: ["preworkout", "caffeine"], timing: ["pre"] },
  { brand: "Powerbar", product: "Protein Plus", category: "recovery", productUrl: "https://www.powerbar.com", logoDomain: "powerbar.com", format: "bar", functionalFocus: ["protein", "recovery"], timing: ["post", "daily"] },
  { brand: "Precision Fuel & Hydration", product: "PF 30 Gel", category: "gel", productUrl: "https://www.precisionhydration.com", logoDomain: "precisionhydration.com", format: "gel", functionalFocus: ["carbo"], timing: ["intra"], carbohydrateGPerServing: 30 },
  { brand: "Precision Fuel & Hydration", product: "Carb & Electrolyte Drink Mix", category: "drink", productUrl: "https://www.precisionhydration.com", logoDomain: "precisionhydration.com", format: "powder", functionalFocus: ["carbo", "electrolyte"], timing: ["pre", "intra"], carbohydrateGPerServing: 40 },
  { brand: "Precision Fuel & Hydration", product: "PH 1000", category: "drink", productUrl: "https://www.precisionhydration.com", logoDomain: "precisionhydration.com", format: "tablet", functionalFocus: ["electrolyte"], timing: ["pre", "intra", "daily"] },
  { brand: "Precision Fuel & Hydration", product: "PF Chew", category: "chew", productUrl: "https://www.precisionhydration.com", logoDomain: "precisionhydration.com", format: "chew", functionalFocus: ["carbo"], timing: ["intra"], carbohydrateGPerServing: 30 },
  { brand: "Named Sport", product: "Race Fuel", category: "drink", productUrl: "https://www.namedsport.com", logoDomain: "namedsport.com", format: "powder", functionalFocus: ["carbo", "electrolyte"], timing: ["pre", "intra"], carbohydrateGPerServing: 40 },
  { brand: "Named Sport", product: "Total Energy Hydro Gel", category: "gel", productUrl: "https://www.namedsport.com", logoDomain: "namedsport.com", format: "gel", functionalFocus: ["carbo"], timing: ["intra"], carbohydrateGPerServing: 30 },
  { brand: "Named Sport", product: "Whey Isolate", category: "recovery", productUrl: "https://www.namedsport.com", logoDomain: "namedsport.com", format: "powder", functionalFocus: ["protein", "recovery"], timing: ["post", "daily"] },
  { brand: "Named Sport", product: "BCAA Powder", category: "drink", productUrl: "https://www.namedsport.com", logoDomain: "namedsport.com", format: "powder", functionalFocus: ["bcaa"], timing: ["pre", "post", "daily"] },
  { brand: "Named Sport", product: "EAA Amino Tabs", category: "chew", productUrl: "https://www.namedsport.com", logoDomain: "namedsport.com", format: "tablet", functionalFocus: ["eaa"], timing: ["post", "daily"] },
  { brand: "Neversecond", product: "C30 Fuel Drink", category: "drink", productUrl: "https://www.neversecond.com", logoDomain: "neversecond.com", format: "powder", functionalFocus: ["carbo"], timing: ["intra"], carbohydrateGPerServing: 30 },
  { brand: "Neversecond", product: "C30 Fuel Gel", category: "gel", productUrl: "https://www.neversecond.com", logoDomain: "neversecond.com", format: "gel", functionalFocus: ["carbo"], timing: ["intra"], carbohydrateGPerServing: 30 },
  { brand: "Neversecond", product: "C30 Fuel Bar", category: "bar", productUrl: "https://www.neversecond.com", logoDomain: "neversecond.com", format: "bar", functionalFocus: ["carbo"], timing: ["pre", "intra"], carbohydrateGPerServing: 30 },
  { brand: "Neversecond", product: "C30+ Caffeine Gel", category: "gel", productUrl: "https://www.neversecond.com", logoDomain: "neversecond.com", format: "gel", functionalFocus: ["carbo", "caffeine"], timing: ["pre", "intra"], carbohydrateGPerServing: 30 }
];

// apps/web/lib/nutrition/fueling-intra-protocol.ts
function roundN(v, digits = 1) {
  const p = 10 ** digits;
  return Math.round(v * p) / p;
}
function orderIntraCarbohydrateCandidates(preferredBrands, catalog = FUELING_PRODUCT_CATALOG) {
  const eligible = catalog.filter(isIntraCarbohydrateEligibleProduct);
  const ordered = [];
  const used = /* @__PURE__ */ new Set();
  for (const brand of preferredBrands) {
    for (const p of eligible) {
      if (p.brand !== brand) continue;
      const key = `${p.brand}__${p.product}`;
      if (used.has(key)) continue;
      used.add(key);
      ordered.push(p);
    }
  }
  for (const p of eligible) {
    const key = `${p.brand}__${p.product}`;
    if (used.has(key)) continue;
    used.add(key);
    ordered.push(p);
  }
  return ordered.length ? ordered : eligible;
}
function buildIntraFuelingPlan(params) {
  const { intraTotalCho, durationMin, perStepFluid, preferredBrands, tierBand } = params;
  const catalog = params.catalog ?? FUELING_PRODUCT_CATALOG;
  const intraStepsCount = Math.max(1, Math.ceil(durationMin / 20));
  const raw = intraStepsCount > 0 ? intraTotalCho / intraStepsCount : intraTotalCho;
  const engineSteps = [];
  for (let i = 0; i < intraStepsCount; i++) {
    const isLast = i === intraStepsCount - 1;
    const distributedBefore = roundN(raw * i, 1);
    const remaining = Math.max(0, roundN(intraTotalCho - distributedBefore, 1));
    engineSteps.push(isLast ? remaining : roundN(raw, 1));
  }
  const candidates = orderIntraCarbohydrateCandidates(preferredBrands, catalog);
  const steps = [];
  for (let i = 0; i < intraStepsCount; i++) {
    const product = candidates[i % Math.max(1, candidates.length)];
    const engineCho = engineSteps[i];
    const labelG = product.carbohydrateGPerServing;
    const cho = labelG != null && labelG > 0 ? labelG : Math.max(0, roundN(engineCho, 1));
    const deltaNote = labelG != null && labelG > 0 && Math.abs(cho - engineCho) >= 1 ? ` \xB7 porzione catalogo ${cho}g vs obiettivo lineare ~${engineCho}g` : labelG == null || labelG <= 0 ? " \xB7 CHO da obiettivo lineare (porzione non valorizzata in catalogo)" : "";
    const minute = i * 20;
    const time = minute === 0 ? "0'" : `+${minute}'`;
    const plan = `${cho}g CHO \xB7 ${product.brand} \u2014 ${product.product}`;
    steps.push({
      slot: {
        phase: "Intra",
        time,
        icon: "\u{1F7E6}",
        plan,
        cho,
        fluid: perStepFluid,
        notes: `Tier ${tierBand} \xB7 intra carbo${deltaNote}`,
        category: product.category
      },
      product,
      engineLinearStepChoG: engineCho
    });
  }
  const totalDeclared = roundN(steps.reduce((s, x) => s + x.slot.cho, 0), 1);
  const budgetDelta = roundN(totalDeclared - intraTotalCho, 1);
  if (steps.length && Math.abs(budgetDelta) >= 0.5) {
    steps[0].slot.notes += ` \xB7 \u03A3 intra CHO ${totalDeclared}g vs target motore ${intraTotalCho}g (\u0394 ${budgetDelta >= 0 ? "+" : ""}${budgetDelta}g)`;
  }
  return steps;
}
function resolvePreWorkoutCarbProduct(preferredBrands, catalog = FUELING_PRODUCT_CATALOG) {
  const ok = (p) => p.timing.includes("pre") && p.functionalFocus.includes("carbo") && !p.functionalFocus.includes("bcaa") && !p.functionalFocus.includes("eaa");
  for (const brand of preferredBrands) {
    const hit = catalog.find((p) => p.brand === brand && ok(p));
    if (hit) return hit;
  }
  return catalog.find(ok) ?? catalog[0] ?? FUELING_PRODUCT_CATALOG[0];
}
function resolvePostRecoveryProduct(preferredBrands, catalog = FUELING_PRODUCT_CATALOG) {
  for (const brand of preferredBrands) {
    const hit = catalog.find(
      (p) => p.brand === brand && p.category === "recovery" && (p.timing.includes("post") || p.timing.includes("daily"))
    );
    if (hit) return hit;
  }
  return catalog.find((p) => p.category === "recovery") ?? catalog[0] ?? FUELING_PRODUCT_CATALOG[0];
}

// apps/web/lib/nutrition/fueling-session-protocol.ts
function round5(v, digits = 0) {
  const m = 10 ** digits;
  return Math.round(v * m) / m;
}
function buildFuelingProtocolSlots(input) {
  const brands = input.preferredBrands.length > 0 ? input.preferredBrands : input.profileSupplements;
  const preProduct = resolvePreWorkoutCarbProduct(brands, input.catalog);
  const postProduct = resolvePostRecoveryProduct(brands, input.catalog);
  const durationMin = Math.max(1, input.durationMin);
  const durationHours = Math.max(0.5, durationMin / 60);
  const preCho = Math.max(12, round5(input.preCho));
  const postCho = Math.max(18, round5(input.postCho));
  const intraTotalCho = Math.max(0, round5(input.intraTotalCho, 1));
  const intraStepsCount = Math.max(1, Math.ceil(durationMin / 20));
  const perStepFluid = Math.max(
    120,
    round5(input.effectiveFluidMlPerHour * durationHours / intraStepsCount)
  );
  const engineSuffix = input.engineSuffix;
  const intraSplitNote = input.intraSplitNote;
  const intraPlan = buildIntraFuelingPlan({
    intraTotalCho,
    durationMin,
    perStepFluid,
    preferredBrands: brands,
    tierBand: input.resolvedFuelingTierBand,
    catalog: input.catalog
  });
  const intraSteps = intraPlan.map((row2, i) => ({
    ...row2.slot,
    catalogProduct: row2.product,
    notes: i === 0 ? `${row2.slot.notes}${engineSuffix}${intraSplitNote}` : row2.slot.notes
  }));
  return [
    {
      phase: "Pre-workout",
      time: "-30'",
      icon: "\u{1F7E3}",
      plan: `${preCho}g CHO + ${preProduct.product} (${preProduct.brand}) + 300ml acqua`,
      cho: preCho,
      fluid: 300,
      notes: `Priming metabolico \xB7 tier ${input.resolvedFuelingTierBand}${engineSuffix}${intraSplitNote}`,
      category: preProduct.category,
      catalogProduct: preProduct
    },
    ...intraSteps,
    {
      phase: "Post-workout",
      time: "+10'",
      icon: "\u{1F7E2}",
      plan: `${postCho}g CHO + ${postProduct.product} (${postProduct.brand}) + 350ml acqua`,
      cho: postCho,
      fluid: 350,
      notes: `Recovery immediato${engineSuffix}`,
      category: "recovery",
      catalogProduct: postProduct
    }
  ];
}

// apps/web/lib/nutrition/v2/bridge-substrate-fueling-to-protocol.ts
function bridgeSubstrateFuelingToProtocolMeta(input) {
  const session = input.substrateFueling.sessions[0];
  const preCho = session?.preChoG ?? input.substrateFueling.totals.preChoG;
  const intraCho = session?.intraChoG ?? input.substrateFueling.totals.intraChoG;
  const postCho = session?.postChoG ?? input.substrateFueling.totals.postChoG;
  const protocolSlots = buildFuelingProtocolSlots({
    durationMin: input.durationMin,
    preCho,
    postCho,
    intraTotalCho: intraCho,
    effectiveFluidMlPerHour: input.fluidMlPerHour ?? 600,
    resolvedFuelingTierBand: (session?.intraChoGPerH ?? 0) >= 90 ? "high" : "base",
    engineSuffix: " \xB7 fueling V2 substrati",
    intraSplitNote: "",
    profileSupplements: input.preferredBrands ?? [],
    preferredBrands: input.preferredBrands ?? []
  });
  return {
    preChoG: preCho,
    intraChoG: intraCho,
    postChoG: postCho,
    fuelingKcal: input.substrateFueling.totals.fuelingKcal,
    protocolSlots
  };
}

// apps/web/lib/nutrition/v2/build-meal-plan-v2-production.ts
var DEFAULT_MEAL_TIMES = {
  breakfast: "07:30",
  snack_am: "10:30",
  lunch: "13:00",
  snack_pm: "17:00",
  dinner: "20:30",
  snack_evening: "22:00"
};
var DEFAULT_MACRO_SPLIT = { carbs: 50, protein: 25, fat: 25 };
var fdcPoolCacheByDietProfile = /* @__PURE__ */ new Map();
var FDC_POOL_CACHE_TTL_MS = 5 * 6e4;
async function loadFdcPools(admin, dietProfile) {
  const cached = fdcPoolCacheByDietProfile.get(dietProfile);
  if (cached && Date.now() - cached.at < FDC_POOL_CACHE_TTL_MS) {
    return cached.pools;
  }
  const excludeAmino = dietProfile === "low_histamine" ? ["histamine_rich"] : void 0;
  const entries = await Promise.all(
    FDC_BRANCH_POOL_SPECS.map(async (spec) => {
      const filter = {
        ...spec.filter,
        dietProfile,
        excludeAminoProfile: excludeAmino ? [...excludeAmino] : void 0
      };
      const hits = await queryFdcBranchPool(admin, filter);
      return [spec.poolKey, hits];
    })
  );
  const map = new Map(entries);
  fdcPoolCacheByDietProfile.set(dietProfile, { at: Date.now(), pools: map });
  return map;
}
function mealTimesFromRequest(request, fallback) {
  const out = { ...fallback };
  for (const s of request.slots) {
    const t = s.scheduledTimeLocal?.trim();
    if (!t) continue;
    const key = s.slot;
    if (key in out) out[key] = t;
  }
  if (request.racePreLunch?.lunchTimeLocal) {
    const slot = request.racePreLunch.mealSlot;
    if (slot in out) out[slot] = request.racePreLunch.lunchTimeLocal;
  }
  return out;
}
function resolveDietSlots(requirements, request, dietDay, mealTimes) {
  let budgets;
  if (dietDay?.configured && dietDay.caloricDistribution) {
    const macroSplit = dietDay.dailyMacros ?? DEFAULT_MACRO_SPLIT;
    budgets = buildDietMealSlotBudgets({
      mealCountMode: dietDay.mealCountMode,
      caloricDistribution: dietDay.caloricDistribution,
      dailyKcal: requirements.energy.mealsKcal,
      macroSplit,
      mealTimes
    }).map((b) => ({
      key: b.key,
      label: b.label,
      pct: b.pct,
      kcal: b.kcal,
      carbs: b.carbs,
      protein: b.protein,
      fat: b.fat
    }));
  } else {
    budgets = request.slots.map((s) => ({
      key: s.slot,
      label: s.labelIt,
      pct: 0,
      kcal: s.targetKcal,
      carbs: s.targetCarbsG,
      protein: s.targetProteinG,
      fat: s.targetFatG
    }));
  }
  if (request.racePostRecovery && request.slots.length > 0) {
    const bySlot = new Map(request.slots.map((s) => [s.slot, s]));
    budgets = budgets.map((b) => {
      const r = bySlot.get(b.key);
      if (!r) return b;
      return {
        ...b,
        kcal: r.targetKcal,
        carbs: r.targetCarbsG,
        protein: r.targetProteinG,
        fat: r.targetFatG
      };
    });
  }
  return budgets;
}
async function buildMealPlanV2Production(input, admin) {
  const { requirements } = buildNutritionDayModelV2({
    ...input,
    performanceIntegration: input.performanceIntegration
  });
  const mealTimes = mealTimesFromRequest(input.request, input.mealTimes ?? DEFAULT_MEAL_TIMES);
  const dietMealSlotBudgets = resolveDietSlots(requirements, input.request, input.dietDay, mealTimes);
  const pools = await loadFdcPools(admin, requirements.dietProfileActive);
  const denyFragments = buildMealPlanFoodDenyFragments(input.request);
  const composedMealPlan = composeMealPlanV2(requirements, dietMealSlotBudgets, pools, {
    denyFragments,
    weeklyStapleCounts: input.request.weeklyStapleCounts,
    suppressedSlots: input.request.suppressedSlots,
    request: input.request
  });
  const sessions = requirements.substrateFueling?.sessions ?? [];
  const fuelingProtocolMeta = sessions.length > 0 && requirements.substrateFueling ? bridgeSubstrateFuelingToProtocolMeta({
    substrateFueling: requirements.substrateFueling,
    durationMin: Math.round(sessions.reduce((m, s) => Math.max(m, s.durationH * 60), 0)),
    preferredBrands: input.preferredFuelingBrands ?? []
  }) : void 0;
  return {
    engine: "nutrition_v2",
    algorithmVersion: "nutrition_meal_plan_v2_production",
    taxonomyVersion: CLASSIFIER_VERSION,
    requirements,
    dietMealSlotBudgets,
    composedMealPlan,
    fuelingProtocolMeta
  };
}

// apps/web/lib/nutrition/pathway-absorption-hints.ts
var IRON_HINT = {
  nutrientId: "fe_mg",
  slotPreference: ["lunch", "dinner"],
  avoidWith: ["t\xE8", "caff\xE8", "calcio contemporaneo"],
  pairWith: ["vitamina C", "pasto misto"],
  rationaleIt: "Ferro alimentare: preferire pranzo/cena lontano da tannini/calcio; associare vit C (modello qualitativo)."
};
var B12_HINT = {
  nutrientId: "vitB12_mcg",
  slotPreference: ["breakfast", "lunch"],
  avoidWith: ["alcol mattutino"],
  pairWith: ["proteine", "pasto completo"],
  rationaleIt: "B12: assorbimento migliore con pasto proteico regolare (classe emivita oraria)."
};
var B1_HINT = {
  nutrientId: "thiamineB1_mg",
  slotPreference: ["breakfast", "lunch"],
  avoidWith: ["alcol nelle ore pre-carico intenso"],
  pairWith: ["CHO complessi", "pasto misto"],
  rationaleIt: "Tiamina (PDH/glicolisi): distribuzione su colazione/pranzo regolari (enzyme-linked v3)."
};
var FOLATE_HINT = {
  nutrientId: "folate_mcg",
  slotPreference: ["lunch", "dinner"],
  avoidWith: [],
  pairWith: ["verdure a foglia", "legumi"],
  rationaleIt: "Folati: preferenza pranzo/cena; integrazione orale una sola volta al giorno se non coperto dal menu."
};
var ZN_HINT = {
  nutrientId: "zn_mg",
  slotPreference: ["lunch", "dinner"],
  avoidWith: ["ferro contemporaneo", "fibre molto alte nello stesso momento"],
  pairWith: ["proteine", "pasto misto"],
  rationaleIt: "Zinco: assorbimento migliore lontano da ferro e fibre concentrate."
};
var VIT_C_HINT = {
  nutrientId: "vitC_mg",
  slotPreference: ["breakfast", "snack_am"],
  avoidWith: [],
  pairWith: ["frutta", "pasto leggero"],
  rationaleIt: "Vitamina C idrosolubile: colazione/spuntino; non ripetere integrazione su pi\xF9 pasti."
};
var MG_HINT = {
  nutrientId: "mg_mg",
  slotPreference: ["lunch", "snack_pm"],
  avoidWith: [],
  pairWith: ["pasto misto", "idratazione"],
  rationaleIt: "Magnesio (PFK/PDH): preferenza pranzo/spuntino pomeridiano peri-stimolo."
};
var VIT_D_HINT = {
  nutrientId: "vitD_mcg",
  slotPreference: ["lunch", "dinner"],
  avoidWith: ["pasto iperlipidico estremo pre-intenso"],
  pairWith: ["grassi insaturi moderati"],
  rationaleIt: "Vitamina D liposolubile: con pasto contenente grassi moderati."
};
var FAT_SOLUBLE_HINT = {
  nutrientId: "vitA_mcg_RAE",
  slotPreference: ["lunch", "dinner"],
  avoidWith: [],
  pairWith: ["olio EVO", "grassi insaturi"],
  rationaleIt: "Micronutrienti liposolubili: preferire pasti principali con grassi alimentari."
};
var STATIC_HINTS = [
  IRON_HINT,
  B12_HINT,
  B1_HINT,
  FOLATE_HINT,
  ZN_HINT,
  VIT_C_HINT,
  MG_HINT,
  VIT_D_HINT,
  FAT_SOLUBLE_HINT
];
function pathwayText(vm) {
  if (!vm?.pathways?.length) return "";
  return vm.pathways.flatMap((p) => [
    ...p.cofactors ?? [],
    ...p.inhibitorsToAvoid ?? [],
    p.pathwayLabel,
    ...p.stimulatedBy ?? []
  ]).join(" ").toLowerCase();
}
function hasStimulatedNode(vm, nodeId) {
  return Boolean(vm?.pathways.some((p) => p.stimulatedBy?.includes(nodeId)));
}
function mergeHintsByNutrient(hints) {
  const byId = /* @__PURE__ */ new Map();
  for (const h of hints) {
    if (!byId.has(h.nutrientId)) byId.set(h.nutrientId, h);
  }
  return [...byId.values()];
}
function buildPathwayAbsorptionHints(vm) {
  const haystack2 = pathwayText(vm);
  const out = [];
  if (/ferr|iron|ferro|eritropo/i.test(haystack2)) out.push(IRON_HINT);
  if (/b12|cobalam/i.test(haystack2)) out.push(B12_HINT);
  if (/tiamin|thiamin|\bb1\b|pdh|piruvato/i.test(haystack2)) out.push(B1_HINT);
  if (/folat|folic|b9|b-9/i.test(haystack2)) out.push(FOLATE_HINT);
  if (/zinc|\bzn\b/i.test(haystack2)) out.push(ZN_HINT);
  if (/vit\s*c|vitamina c|ascorb/i.test(haystack2)) out.push(VIT_C_HINT);
  if (/magnes|\bmg\b|pfk|chinasi/i.test(haystack2)) out.push(MG_HINT);
  if (/vit\s*d|vitamina d|colecalcif/i.test(haystack2)) out.push(VIT_D_HINT);
  if (/vit\s*a|vit\s*e|vit\s*k|liposolub/i.test(haystack2)) out.push(FAT_SOLUBLE_HINT);
  if (hasStimulatedNode(vm, "enzyme.pdh")) {
    if (!out.some((h) => h.nutrientId === "thiamineB1_mg")) out.push(B1_HINT);
    if (!out.some((h) => h.nutrientId === "mg_mg")) out.push(MG_HINT);
  }
  if (hasStimulatedNode(vm, "enzyme.pfk") && !out.some((h) => h.nutrientId === "mg_mg")) {
    out.push(MG_HINT);
  }
  return mergeHintsByNutrient(out);
}
function resolveNutrientTargetIdForHintLookup(nutrientOrCatalogId) {
  const fromCatalog = catalogIdToNutrientTargetId(nutrientOrCatalogId);
  if (fromCatalog) return fromCatalog;
  if (STATIC_HINTS.some((h) => h.nutrientId === nutrientOrCatalogId)) {
    return nutrientOrCatalogId;
  }
  return null;
}
function preferredSlotsForNutrientBoost(nutrientId, vm) {
  const resolved = resolveNutrientTargetIdForHintLookup(nutrientId) ?? nutrientId;
  const hint = buildPathwayAbsorptionHints(vm).find((h) => h.nutrientId === resolved);
  return hint?.slotPreference ?? null;
}
function slotPriorityForNutrientTarget(nutrientOrCatalogId, vm, focusFallback) {
  const prefs = preferredSlotsForNutrientBoost(nutrientOrCatalogId, vm);
  if (!prefs?.length) return focusFallback;
  const rest = focusFallback.filter((s) => !prefs.includes(s));
  return [...prefs, ...rest];
}
function nutrientBoostAppliesToSlot(nutrientId, slot, vm) {
  const prefs = preferredSlotsForNutrientBoost(nutrientId, vm);
  if (!prefs?.length) return true;
  return prefs.includes(slot);
}

// apps/web/lib/nutrition/meal-plan-daily-supplement-scheduler.ts
var TIMING_LABEL_IT = {
  before: "Prima del pasto",
  with: "Durante il pasto",
  after: "Dopo il pasto",
  away: "Lontano dal pasto"
};
var DEFAULT_SLOT_ORDER = [
  "breakfast",
  "lunch",
  "snack_pm",
  "dinner",
  "snack_am",
  "snack_evening"
];
var INTAKE_TIMING_BY_NUTRIENT = {
  fe_mg: {
    timing: "away",
    noteIt: "1\u20132 h lontano da t\xE8, caff\xE8 e latticini; abbinare vitamina C se indicato."
  },
  vitB12_mcg: {
    timing: "with",
    noteIt: "Con un pasto che contenga proteine (assorbimento cobalamina)."
  },
  thiamineB1_mg: {
    timing: "with",
    noteIt: "Con carboidrati complessi a colazione o pranzo (cofattore PDH)."
  },
  folate_mcg: {
    timing: "with",
    noteIt: "Con pranzo o cena; se integrazione, non ripetere negli altri pasti."
  },
  riboflavinB2_mg: { timing: "with", noteIt: "Con pasto misto (latticini/uova/pesce se tollerati)." },
  niacinB3_mg: { timing: "with", noteIt: "Con pasto principale; evitare dosi alte a stomaco vuoto." },
  vitB6_mg: { timing: "with", noteIt: "Con pasto leggero o principale." },
  mg_mg: {
    timing: "after",
    noteIt: "Preferenza serale/post-cena; distanziare da allenamento molto intenso."
  },
  zn_mg: {
    timing: "away",
    noteIt: "Lontano da ferro, calcio e pasti molto ricchi di fibre."
  },
  vitD_mcg: { timing: "with", noteIt: "Con pasto che includa grassi moderati (liposolubile)." },
  vitC_mg: { timing: "with", noteIt: "Con colazione o spuntino leggero." },
  se_mcg: { timing: "with", noteIt: "Con pasto principale; non superare soglie senza controllo." },
  omega3G: { timing: "with", noteIt: "Con pranzo/cena (grassi alimentari) o come da protocollo." },
  vitE_mg: { timing: "with", noteIt: "Con pasto contenente grassi insaturi." },
  fiberG: { timing: "with", noteIt: "Distribuire fibre negli alimenti dei pasti, non capsule ripetute." }
};
function nutrientHasFoodPathwayAnywhere(nutrientId, dietType) {
  for (const slot of DEFAULT_SLOT_ORDER) {
    if (listNutrientPathwaySwapsForSlot(nutrientId, slot, dietType).length > 0) return true;
  }
  return false;
}
function resolveIntakeTiming(nutrientId, vm) {
  const pk = buildPathwayAbsorptionHints(vm).find((h) => h.nutrientId === nutrientId);
  const base = INTAKE_TIMING_BY_NUTRIENT[nutrientId] ?? {
    timing: "with",
    noteIt: "Una sola assunzione giornaliera nel pasto indicato."
  };
  if (pk?.avoidWith.length) {
    const avoid = pk.avoidWith.join(", ");
    if (base.timing === "with") {
      return {
        timing: "away",
        noteIt: `${base.noteIt} Evita contestualmente: ${avoid}.`
      };
    }
    return { ...base, noteIt: `${base.noteIt} Evita: ${avoid}.` };
  }
  if (pk?.pairWith.length) {
    return { ...base, noteIt: `${base.noteIt} Preferisci: ${pk.pairWith.join(", ")}.` };
  }
  return base;
}
function pickSlotForNutrient(nutrientId, slots, suppressed, vm) {
  const available = slots.filter((s) => !suppressed.includes(s.slot));
  if (!available.length) return null;
  const priority = slotPriorityForNutrientTarget(
    nutrientId,
    vm,
    available.map((s) => s.slot)
  );
  for (const slotKey of priority) {
    const row2 = available.find((s) => s.slot === slotKey);
    if (row2) return row2;
  }
  return available[0] ?? null;
}
function buildScheduledIntegrationItem(nutrientId, slot, vm) {
  const label = nutrientDisplayLabelIt(nutrientId);
  const action = integrationActionForTarget(nutrientId, label);
  const { timing, noteIt } = resolveIntakeTiming(nutrientId, vm);
  const timingLabel = TIMING_LABEL_IT[timing];
  const mealLabel = slot.labelIt?.trim() || slot.slot;
  const time = slot.scheduledTimeLocal?.trim() || "\u2014";
  const portionHint = `${timingLabel} \xB7 ${mealLabel} ${time}. ${action}`.slice(0, 160);
  const functionalBridge = `Integrazione giornaliera (1\xD7/giorno): ${timingLabel.toLowerCase()} \u2014 ${mealLabel} alle ${time}. ${noteIt} ${action}`.slice(
    0,
    500
  );
  return {
    name: `Integrazione giornaliera: ${label}`,
    portionHint,
    approxKcal: 12,
    macroRole: "mixed",
    functionalBridge
  };
}
function buildDailySupplementIntegrationPlan(input) {
  const suppressed = input.suppressedSlots ?? [];
  const plan = {};
  const assignedNutrients = /* @__PURE__ */ new Set();
  for (const target of input.boostTargets) {
    const id = target.nutrientId;
    if (assignedNutrients.has(id)) continue;
    if (nutrientHasFoodPathwayAnywhere(id, input.dietType)) continue;
    const slot = pickSlotForNutrient(id, input.slots, suppressed, input.pathwayModulation);
    if (!slot) continue;
    const item2 = buildScheduledIntegrationItem(id, slot, input.pathwayModulation);
    const list = plan[slot.slot] ?? [];
    list.push(item2);
    plan[slot.slot] = list;
    assignedNutrients.add(id);
  }
  return plan;
}

// apps/web/lib/nutrition/enrich-meal-slots-after-compose.ts
var VALID_NUTRIENT_TARGET_IDS = /* @__PURE__ */ new Set([
  "vitA_mcg_RAE",
  "vitC_mg",
  "vitD_mcg",
  "vitE_mg",
  "vitK_mcg",
  "thiamineB1_mg",
  "riboflavinB2_mg",
  "niacinB3_mg",
  "vitB6_mg",
  "folate_mcg",
  "vitB12_mcg",
  "ca_mg",
  "fe_mg",
  "mg_mg",
  "p_mg",
  "k_mg",
  "na_mg",
  "zn_mg",
  "se_mcg",
  "fiberG",
  "omega3G"
]);
function normalizeDietType2(raw) {
  const d = (raw ?? "").trim().toLowerCase();
  if (d === "vegan" || d.includes("vegan")) return "vegan";
  if (d === "vegetarian" || d.includes("veget")) return "vegetarian";
  if (d === "pescatarian" || d.includes("pesc")) return "pescatarian";
  return "omnivore";
}
function selectValidBoostTargets(targets) {
  return targets.filter((t) => VALID_NUTRIENT_TARGET_IDS.has(t.nutrientId)).map((t) => ({ nutrientId: t.nutrientId, labelIt: t.labelIt }));
}
function syncItemsApproxKcalFromCanonical(items) {
  return items.map((it) => {
    const { nutrients } = nutrientsForMealPlanItem({
      name: it.name,
      portionHint: it.portionHint,
      approxKcal: it.approxKcal
    });
    return { ...it, approxKcal: Math.max(8, Math.round(nutrients.kcal)) };
  });
}
function buildMediterraneanDayContextFromRequest(req) {
  return createMediterraneanDayContext(
    req.planDate,
    req.weeklyStapleCounts,
    req.postWorkoutMealBySlot,
    normalizeDietType2(req.dietType),
    buildMealPlanFoodDenyFragments(req),
    req.suppressedSlots,
    req.racePreLunch ?? void 0,
    req.racePostRecovery ?? void 0
  );
}
function enrichMealSlotsAfterCompose(input) {
  const { request } = input;
  const dayCtx = input.dayCtx ?? buildMediterraneanDayContextFromRequest(request);
  const suppressed = request.suppressedSlots ?? [];
  const validBoostTargets = request.nutrientBoostTargets ? selectValidBoostTargets(request.nutrientBoostTargets) : [];
  const dailyIntegrationPlan = buildDailySupplementIntegrationPlan({
    boostTargets: validBoostTargets,
    slots: request.slots,
    suppressedSlots: suppressed,
    pathwayModulation: request.pathwayModulation,
    dietType: normalizeDietType2(request.dietType)
  });
  const slotMeta = new Map(input.slots.map((s) => [s.slot, s]));
  return request.slots.map((slotReq) => {
    const existing = slotMeta.get(slotReq.slot);
    const isSuppressed = suppressed.includes(slotReq.slot);
    const isRacePreLunch = isRacePreRaceMealSlot(slotReq.slot, request.racePreLunch ?? null);
    if (isSuppressed) {
      return existing ?? {
        slot: slotReq.slot,
        targetKcalEcho: slotReq.targetKcal,
        items: [],
        slotCoherence: "",
        slotTimingRationale: ""
      };
    }
    const baseMeal = input.getBaseMealForSlot(slotReq);
    const slotBoostIds = validBoostTargets.filter((t) => nutrientBoostAppliesToSlot(t.nutrientId, slotReq.slot, request.pathwayModulation)).map((t) => t.nutrientId);
    const pathway = isRacePreLunch ? { meal: baseMeal, adviceNotes: [] } : applyPathwayAdvice(baseMeal, slotReq.slot, slotBoostIds, dayCtx);
    registerMealCanonicalKeys(dayCtx, pathway.meal);
    const integrationItems = isRacePreLunch ? [] : dailyIntegrationPlan[slotReq.slot] ?? [];
    const groupTitles = slotReq.functionalFoodGroups.map((g) => g.displayNameIt).join(" \xB7 ");
    const bridgePrefix = groupTitles ? `Target funzionali (solver): ${groupTitles.slice(0, 180)}${groupTitles.length > 180 ? "\u2026" : ""}. ` : "";
    let items = syncItemsApproxKcalFromCanonical(
      [...pathway.meal.items, ...integrationItems].map((it) => ({
        ...it,
        functionalBridge: `${bridgePrefix}Composizione mediterranea: ${it.functionalBridge}`.slice(0, 500)
      }))
    );
    if (slotReq.targetKcal > 0) {
      items = rescaleSlotKcalToTarget(
        {
          slot: slotReq.slot,
          targetKcalEcho: slotReq.targetKcal,
          items,
          slotCoherence: "",
          slotTimingRationale: ""
        },
        slotReq.targetKcal
      ).items;
    }
    const timing = slotReq.functionalFoodGroups.find((g) => g.timingHalfLifeHint.trim())?.timingHalfLifeHint ?? request.pathwayTimingLines[0] ?? `Orario pasto ${slotReq.scheduledTimeLocal || "\u2014"}; allinea al carico del giorno.`;
    const baseCoherence = isRacePreLunch ? racePreLunchContextLine(request.racePreLunch) : groupTitles ? `Combinazione solver + funzionale: target ${slotReq.targetKcal} kcal con priorit\xE0 a ${groupTitles.slice(0, 260)}` : `Pasto strutturato su target Diet: ${slotReq.targetKcal} kcal; porzioni da staple sportivi.`;
    const slotBoostNote = pathway.adviceNotes.length > 0 ? `Suggerimenti pathway: ${pathway.adviceNotes.slice(0, 3).join(" | ")}` : void 0;
    return {
      slot: slotReq.slot,
      targetKcalEcho: slotReq.targetKcal,
      items,
      slotCoherence: `${baseCoherence}${slotBoostNote ? ` \xB7 ${slotBoostNote}` : ""}`.slice(0, 480),
      slotTimingRationale: timing.slice(0, 400),
      boostNote: slotBoostNote
    };
  });
}
function pathwayBoostStatusFromRequest(request) {
  const valid = request.nutrientBoostTargets ? selectValidBoostTargets(request.nutrientBoostTargets) : [];
  return valid.length > 0 ? "applied" : void 0;
}
function dayInteractionSummaryExtras(request, engineNote) {
  const validBoostTargets = request.nutrientBoostTargets ? selectValidBoostTargets(request.nutrientBoostTargets) : [];
  const bits = [
    engineNote,
    `\u03A3 pasti solver: ${request.mealPlanSolverMeta.dailyMealsKcalTotal} kcal/giorno`,
    validBoostTargets.length > 0 ? `Cofactors attivi: ${validBoostTargets.map((t) => t.labelIt).join(", ")}` : null,
    request.routineDigest
  ].filter((s) => Boolean(s?.trim()));
  return bits.join(" \xB7 ").slice(0, 820);
}

// apps/web/lib/nutrition/fdc-canonical-map.ts
var FDC_NUTRIENT_TO_CANONICAL = {
  1008: "kcalPer100g",
  1003: "proteinG",
  1005: "carbsG",
  1004: "fatG",
  1079: "fiberG",
  1258: "saturatedFatG",
  1292: "monoFatG",
  1293: "polyFatG",
  1106: "vitA_mcg_RAE",
  1162: "vitC_mg",
  1114: "vitD_mcg",
  1109: "vitE_mg",
  1185: "vitK_mcg",
  1165: "thiamineB1_mg",
  1166: "riboflavinB2_mg",
  1167: "niacinB3_mg",
  1175: "vitB6_mg",
  1177: "folate_mcg",
  1178: "vitB12_mcg",
  1087: "ca_mg",
  1089: "fe_mg",
  1090: "mg_mg",
  1091: "p_mg",
  1092: "k_mg",
  1093: "na_mg",
  1095: "zn_mg",
  1103: "se_mcg",
  1210: "eaa_trp",
  1211: "eaa_thr",
  1212: "eaa_ile",
  1213: "eaa_leu",
  1214: "eaa_lys",
  1215: "eaa_met",
  1217: "eaa_phe",
  1219: "eaa_val",
  1221: "eaa_his"
};
var FDC_OMEGA3_IDS = [1404, 1278, 1279, 1280, 1405, 1406];
var ZERO_CANONICAL = {
  kcalPer100g: 0,
  proteinG: 0,
  carbsG: 0,
  fatG: 0,
  fiberG: 0,
  saturatedFatG: 0,
  monoFatG: 0,
  polyFatG: 0,
  omega3G: 0,
  vitA_mcg_RAE: 0,
  vitC_mg: 0,
  vitD_mcg: 0,
  vitE_mg: 0,
  vitK_mcg: 0,
  thiamineB1_mg: 0,
  riboflavinB2_mg: 0,
  niacinB3_mg: 0,
  vitB6_mg: 0,
  folate_mcg: 0,
  vitB12_mcg: 0,
  ca_mg: 0,
  fe_mg: 0,
  mg_mg: 0,
  p_mg: 0,
  k_mg: 0,
  na_mg: 0,
  zn_mg: 0,
  se_mcg: 0,
  eaa_leu: 0,
  eaa_lys: 0,
  eaa_met: 0,
  eaa_phe: 0,
  eaa_thr: 0,
  eaa_trp: 0,
  eaa_ile: 0,
  eaa_val: 0,
  eaa_his: 0
};
function fdcCachedFoodToCanonical(food) {
  const out = { ...ZERO_CANONICAL };
  out.kcalPer100g = Math.max(0, Number(food.kcalPer100g ?? 0));
  out.proteinG = Math.max(0, Number(food.proteinPer100g ?? 0));
  out.carbsG = Math.max(0, Number(food.carbsPer100g ?? 0));
  out.fatG = Math.max(0, Number(food.fatPer100g ?? 0));
  out.fiberG = Math.max(0, Number(food.fiberPer100g ?? 0));
  out.na_mg = Math.max(0, Number(food.sodiumMgPer100g ?? 0));
  let omega3 = 0;
  const apply = (rows) => {
    for (const r of rows) {
      const target = FDC_NUTRIENT_TO_CANONICAL[r.nutrientId];
      if (target) {
        const v = Math.max(0, Number(r.amountPer100g ?? 0));
        out[target] = v;
      }
      if (FDC_OMEGA3_IDS.includes(r.nutrientId)) {
        omega3 += Math.max(0, Number(r.amountPer100g ?? 0));
      }
    }
  };
  apply(food.vitamins);
  apply(food.minerals);
  apply(food.aminoAcids);
  apply(food.fattyAcids);
  apply(food.otherNutrients);
  out.omega3G = Number(omega3.toFixed(3));
  return out;
}
function metabolicIndicesPer100gFromFdc(food) {
  return {
    gi: Number(food.glycemicIndexEstimate ?? 0) || 0,
    ii: Number(food.insulinIndexEstimate ?? 0) || 0,
    glPer100g: Number(food.glycemicLoadPer100g ?? 0) || 0
  };
}
function snapshotEntryFromCachedFood(food, fdcId) {
  const canonical = fdcCachedFoodToCanonical(food);
  if (!canonical.kcalPer100g) return null;
  const indices = metabolicIndicesPer100gFromFdc(food);
  return { canonical, ...indices, fdcId, description: food.description };
}
function buildFdcCanonicalSnapshotFromFoods(canonicalKeys, foodsByFdcId) {
  const out = {};
  for (const key of new Set(canonicalKeys)) {
    const fdcId = fdcIdForCanonicalKey(key);
    if (!fdcId) continue;
    const food = foodsByFdcId.get(fdcId);
    if (!food) continue;
    const entry2 = snapshotEntryFromCachedFood(food, fdcId);
    if (entry2) out[key] = entry2;
  }
  return out;
}
function buildFdcCanonicalSnapshotFromFdcIds(fdcIds, foodsByFdcId) {
  const out = {};
  for (const id of new Set(fdcIds)) {
    if (!Number.isFinite(id) || id < 1) continue;
    const food = foodsByFdcId.get(id);
    if (!food) continue;
    const entry2 = snapshotEntryFromCachedFood(food, id);
    if (entry2) out[`fdc:${id}`] = entry2;
  }
  return out;
}

// apps/web/lib/nutrition/fdc-micronutrient-extract.ts
var SKIP_NAME_FRAGMENTS = [
  "energy",
  "protein",
  "total lipid",
  "carbohydrate, by difference",
  "carbohydrate",
  "fiber, total dietary",
  "sugars, total including",
  "sugars, total",
  "starch",
  "water",
  "ash",
  "alcohol",
  "caffeine",
  "theobromine"
];
function shouldSkipName(lower) {
  return SKIP_NAME_FRAGMENTS.some((f) => lower.includes(f));
}
function shouldSkipFdcNutrientNameForMicroProfile(name) {
  return shouldSkipName(name.toLowerCase());
}
function bucketForFdcNutrientName(name) {
  const L = name.toLowerCase();
  if (shouldSkipName(L)) return null;
  if (L.includes("sodium") && (L.includes("na") || L === "sodium, na")) return null;
  if (/fatty acid|cholesterol|phytosterol|trans fat|trans-monoenoic|trans-polyenoic|omega|linole|linolen|arachidonic|epa|dha\b|elaidic|erucic| nervonic|^\d+:\d+/.test(
    L
  ) || L.includes("cis-") || L.includes("octadecenoic") || L.includes("eicosapentaenoic") || L.includes("docosahexaenoic") || L.includes("docosapentaenoic")) {
    return "fattyAcids";
  }
  const aminoHints = [
    "tryptophan",
    "threonine",
    "isoleucine",
    "leucine",
    "lysine",
    "methionine",
    "cystine",
    "cysteine",
    "phenylalanine",
    "tyrosine",
    "valine",
    "arginine",
    "histidine",
    "alanine",
    "aspartic acid",
    "glutamic acid",
    "glycine",
    "proline",
    "serine",
    "hydroxyproline",
    "taurine",
    "asparagine",
    "glutamine"
  ];
  if (aminoHints.some((a) => L.includes(a))) return "aminoAcids";
  if (/vitamin|thiamin|riboflavin|niacin|folate|folic acid|choline|pantothenic|biotin|carotene|retinol|cryptoxanthin|lutein|zeaxanthin|lycopene/.test(
    L
  )) {
    return "vitamins";
  }
  const mineralHints = [
    "calcium",
    "iron",
    "magnesium",
    "phosphorus",
    "phosphorous",
    "potassium",
    "zinc",
    "copper",
    "selenium",
    "manganese",
    "iodine",
    "chromium",
    "molybdenum",
    "fluoride",
    "chloride"
  ];
  if (mineralHints.some((m) => L.includes(m))) return "minerals";
  return null;
}
function partitionFdcNutrientsFromCompact(compact) {
  const byId = /* @__PURE__ */ new Map();
  for (const row2 of compact) {
    if (!Number.isFinite(row2.nutrientId) || row2.nutrientId <= 0) continue;
    if (!row2.name?.trim()) continue;
    if (shouldSkipFdcNutrientNameForMicroProfile(row2.name)) continue;
    if (!byId.has(row2.nutrientId)) byId.set(row2.nutrientId, row2);
  }
  const vitamins = [];
  const minerals = [];
  const aminoAcids = [];
  const fattyAcids = [];
  const bucketedIds = /* @__PURE__ */ new Set();
  for (const row2 of byId.values()) {
    const b = bucketForFdcNutrientName(row2.name);
    if (b === "vitamins") {
      vitamins.push(row2);
      bucketedIds.add(row2.nutrientId);
    } else if (b === "minerals") {
      minerals.push(row2);
      bucketedIds.add(row2.nutrientId);
    } else if (b === "aminoAcids") {
      aminoAcids.push(row2);
      bucketedIds.add(row2.nutrientId);
    } else if (b === "fattyAcids") {
      fattyAcids.push(row2);
      bucketedIds.add(row2.nutrientId);
    }
  }
  const other = [];
  for (const row2 of byId.values()) {
    if (!bucketedIds.has(row2.nutrientId)) other.push(row2);
  }
  return { vitamins, minerals, aminoAcids, fattyAcids, other };
}

// apps/web/lib/supabase/admin.ts
import { createClient } from "@supabase/supabase-js";
function createSupabaseAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

// apps/web/lib/nutrition/fdc-food-cache.ts
function toNumber(v) {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim()) {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}
var FDC_BATCH_SELECT_CHUNK = 80;
function asMicroArray(v) {
  if (!Array.isArray(v)) return [];
  return v.map((row2) => {
    if (!row2 || typeof row2 !== "object") return null;
    const r = row2;
    const nutrientIdRaw = toNumber(r.nutrientId);
    const amountRaw = toNumber(r.amountPer100g);
    const name = typeof r.name === "string" ? r.name : "";
    const unit = typeof r.unit === "string" ? r.unit : "\u2014";
    if (!nutrientIdRaw || !name || amountRaw == null) return null;
    return { nutrientId: Math.round(nutrientIdRaw), name, amountPer100g: amountRaw, unit };
  }).filter((row2) => Boolean(row2));
}
function cachedFoodFromDbRow(row2) {
  const base = {
    fdcId: Number(row2.fdc_id),
    description: String(row2.description ?? "Alimento FDC"),
    dataType: row2.data_type != null ? String(row2.data_type) : null,
    publicationDate: row2.publication_date != null ? String(row2.publication_date) : null,
    foodCategory: row2.food_category != null ? String(row2.food_category) : null,
    kcalPer100g: Number(row2.kcal_100g ?? 0),
    carbsPer100g: Number(row2.carbs_100g ?? 0),
    proteinPer100g: Number(row2.protein_100g ?? 0),
    fatPer100g: Number(row2.fat_100g ?? 0),
    fiberPer100g: row2.fiber_100g != null ? Number(row2.fiber_100g) : null,
    sugarsPer100g: row2.sugars_100g != null ? Number(row2.sugars_100g) : null,
    sodiumMgPer100g: row2.sodium_mg_100g != null ? Number(row2.sodium_mg_100g) : null,
    glycemicIndexEstimate: row2.glycemic_index_estimate != null ? Number(row2.glycemic_index_estimate) : null,
    insulinIndexEstimate: row2.insulin_index_estimate != null ? Number(row2.insulin_index_estimate) : null,
    glycemicLoadPer100g: row2.glycemic_load_100g != null ? Number(row2.glycemic_load_100g) : null,
    insulinLoadPer100g: row2.insulin_load_100g != null ? Number(row2.insulin_load_100g) : null,
    metabolicIndices: row2.metabolic_indices && typeof row2.metabolic_indices === "object" ? row2.metabolic_indices : {}
  };
  const rawLines = asMicroArray(row2.nutrients_raw);
  if (rawLines.length > 0) {
    const p = partitionFdcNutrientsFromCompact(rawLines);
    return {
      ...base,
      vitamins: p.vitamins,
      minerals: p.minerals,
      aminoAcids: p.aminoAcids,
      fattyAcids: p.fattyAcids,
      otherNutrients: p.other
    };
  }
  return {
    ...base,
    vitamins: asMicroArray(row2.vitamins),
    minerals: asMicroArray(row2.minerals),
    aminoAcids: asMicroArray(row2.amino_acids),
    fattyAcids: asMicroArray(row2.fatty_acids),
    otherNutrients: asMicroArray(row2.other_nutrients)
  };
}
function chunkNumericIds(ids, size) {
  const out = [];
  for (let i = 0; i < ids.length; i += size) out.push(ids.slice(i, i + size));
  return out;
}
async function loadFdcFoodsByIds(fdcIds) {
  const ids = [
    ...new Set(
      fdcIds.map((v) => Math.round(Number(v))).filter((id) => Number.isFinite(id) && id >= 1)
    )
  ];
  const out = /* @__PURE__ */ new Map();
  if (ids.length === 0) return out;
  const admin = createSupabaseAdminClient();
  if (!admin) return out;
  for (const chunk of chunkNumericIds(ids, FDC_BATCH_SELECT_CHUNK)) {
    const { data, error } = await admin.from("nutrition_fdc_foods").select("*").in("fdc_id", chunk);
    if (error && error.code !== "42P01") break;
    if (!Array.isArray(data)) continue;
    for (const row2 of data) {
      const r = row2;
      const id = Math.round(Number(r.fdc_id));
      if (Number.isFinite(id) && id >= 1) out.set(id, cachedFoodFromDbRow(r));
    }
  }
  return out;
}

// apps/web/lib/nutrition/fdc-to-canonical-scaler.ts
async function buildFdcCanonicalSnapshot(canonicalKeys) {
  const uniqueKeys = Array.from(new Set(canonicalKeys));
  const fdcIds = uniqueKeys.map((k) => fdcIdForCanonicalKey(k)).filter((id) => typeof id === "number");
  if (fdcIds.length === 0) return {};
  const foodsByFdcId = await loadFdcFoodsByIds(fdcIds);
  return buildFdcCanonicalSnapshotFromFoods(uniqueKeys, foodsByFdcId);
}
var OLIVE_OIL_G_PER_ML2 = 0.92;
var LIQUID_DAIRY_G_PER_ML2 = 1.03;
var LIQUIDS_AS_GRAMS_KEYS2 = /* @__PURE__ */ new Set([
  "milk_2pct",
  "milk_goat",
  "yogurt_plain",
  "plant_drink_almond",
  "plant_drink_rice",
  "plant_drink_oat",
  "plant_drink_generic"
]);
function parseGramsFromHint(hint, compositionKey) {
  const text = hint.trim();
  if (!text) return void 0;
  if (looksLikeMultiIngredientPortionHint(text)) return void 0;
  const grams = text.match(/(\d+(?:[.,]\d+)?)\s*g(?:rammi?)?\b/i);
  if (grams) {
    const v = parseFloat(grams[1].replace(",", "."));
    if (Number.isFinite(v) && v > 0) return v;
  }
  const ml = text.match(/(\d+(?:[.,]\d+)?)\s*ml\b/i);
  if (ml) {
    const v = parseFloat(ml[1].replace(",", "."));
    if (Number.isFinite(v) && v > 0) {
      if (compositionKey === "olive_oil") return v * OLIVE_OIL_G_PER_ML2;
      if (LIQUIDS_AS_GRAMS_KEYS2.has(compositionKey)) return v * LIQUID_DAIRY_G_PER_ML2;
    }
  }
  return void 0;
}
function reconcileScaledNutrients(scaled, approxKcal, canonical) {
  if (approxKcal <= 0 || scaled.kcal <= 0) return scaled;
  const deviation = Math.abs(scaled.kcal - approxKcal) / Math.max(approxKcal, 1);
  if (deviation <= 0.2) return scaled;
  return scaleCanonicalNutrientsToKcal(canonical, approxKcal);
}
function scaleFromCanonical(canonical, item2, compositionKey, giMeta) {
  if (!isPlausiblePer100gMacros({
    kcal_100: canonical.kcalPer100g,
    carbs_100: canonical.carbsG,
    protein_100: canonical.proteinG,
    fat_100: canonical.fatG
  })) {
    const tsFallback = CANONICAL_FOOD_TABLE[compositionKey.replace(/^fdc:\d+$/, "")];
    if (tsFallback?.kcalPer100g) {
      return scaleCanonicalNutrientsToKcal(tsFallback, item2.approxKcal);
    }
    return scaleCanonicalNutrientsToKcal(canonical, item2.approxKcal);
  }
  const hintForServing = `${item2.portionHint} ${item2.name}`.trim();
  const grams = parseGramsFromHint(hintForServing, compositionKey);
  let scaled = grams != null ? scaleCanonicalNutrientsToGrams(canonical, grams) : scaleCanonicalNutrientsToKcal(canonical, item2.approxKcal);
  scaled = reconcileScaledNutrients(scaled, item2.approxKcal, canonical);
  if (giMeta) {
    const massG = grams ?? (canonical.kcalPer100g > 0 ? item2.approxKcal * 100 / canonical.kcalPer100g : 0);
    scaled.glycemicIndex = giMeta.gi;
    scaled.insulinIndex = giMeta.ii;
    scaled.glycemicLoad = Number((giMeta.glPer100g * massG / 100).toFixed(2));
  }
  return scaled;
}
function nutrientsForMealPlanItemFromCache(item2, snapshot) {
  const fdcKey = item2.compositionKey?.startsWith("fdc:") ? item2.compositionKey : null;
  if (fdcKey && snapshot[fdcKey]) {
    const fdc2 = snapshot[fdcKey];
    const scaled2 = scaleFromCanonical(fdc2.canonical, item2, fdcKey, {
      gi: fdc2.gi,
      ii: fdc2.ii,
      glPer100g: fdc2.glPer100g
    });
    return { compositionKey: fdcKey, compositionStatus: "fdc_cache", nutrients: scaled2 };
  }
  const compositionKey = inferCanonicalFoodKeyPreferName(item2.name, item2.portionHint);
  if (compositionKey === "generic_mixed") {
    return {
      compositionKey: "unresolved",
      compositionStatus: "unresolved",
      nutrients: zeroScaled()
    };
  }
  const fdc = snapshot[compositionKey];
  const tsRow = CANONICAL_FOOD_TABLE[compositionKey];
  const canonical = fdc?.canonical ?? tsRow;
  if (!canonical || !canonical.kcalPer100g) {
    return {
      compositionKey: "unresolved",
      compositionStatus: "unresolved",
      nutrients: zeroScaled()
    };
  }
  const scaled = scaleFromCanonical(
    canonical,
    item2,
    compositionKey,
    fdc ? { gi: fdc.gi, ii: fdc.ii, glPer100g: fdc.glPer100g } : void 0
  );
  if (fdc) {
    return { compositionKey, compositionStatus: "fdc_cache", nutrients: scaled };
  }
  return { compositionKey, compositionStatus: "canonical_estimate", nutrients: scaled };
}
function zeroScaled() {
  return {
    kcal: 0,
    proteinG: 0,
    carbsG: 0,
    fatG: 0,
    fiberG: 0,
    saturatedFatG: 0,
    monoFatG: 0,
    polyFatG: 0,
    omega3G: 0,
    vitA_mcg_RAE: 0,
    vitC_mg: 0,
    vitD_mcg: 0,
    vitE_mg: 0,
    vitK_mcg: 0,
    thiamineB1_mg: 0,
    riboflavinB2_mg: 0,
    niacinB3_mg: 0,
    vitB6_mg: 0,
    folate_mcg: 0,
    vitB12_mcg: 0,
    ca_mg: 0,
    fe_mg: 0,
    mg_mg: 0,
    p_mg: 0,
    k_mg: 0,
    na_mg: 0,
    zn_mg: 0,
    se_mcg: 0,
    eaa_leu: 0,
    eaa_lys: 0,
    eaa_met: 0,
    eaa_phe: 0,
    eaa_thr: 0,
    eaa_trp: 0,
    eaa_ile: 0,
    eaa_val: 0,
    eaa_his: 0,
    glycemicIndex: 0,
    insulinIndex: 0,
    glycemicLoad: 0
  };
}

// apps/web/lib/nutrition/meal-plan-hydration-routine.ts
function parseMinutes(hhmm) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm).trim());
  if (!m) return null;
  const h = Math.min(23, Math.max(0, parseInt(m[1], 10)));
  const min = Math.min(59, Math.max(0, parseInt(m[2], 10)));
  return h * 60 + min;
}
function formatMinutes(total) {
  const day = 24 * 60;
  const t = (total % day + day) % day;
  const h = Math.floor(t / 60);
  const m = t % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
function buildHydrationRoutineFromMealPlanRequest(req) {
  const totalKcal = Math.max(800, req.mealPlanSolverMeta.dailyMealsKcalTotal);
  const baselineDailyMl = Math.max(2200, Math.round(Math.min(4200, totalKcal * 0.62 + 1350)));
  const hasTraining = req.trainingDayLines.some((l) => String(l).trim().length > 0);
  let trainingExtraMl = hasTraining ? 720 : 320;
  const joined = req.trainingDayLines.join(" ");
  const durMatch = joined.match(/(\d+)\s*min/);
  if (durMatch) {
    const dm = parseInt(durMatch[1], 10);
    if (Number.isFinite(dm) && dm > 0) trainingExtraMl = Math.max(480, Math.round(dm * 11));
  }
  const totalTargetMl = baselineDailyMl + trainingExtraMl;
  const ordered = [...req.slots].map((s) => ({
    slot: s.slot,
    labelIt: s.labelIt,
    scheduledTimeLocal: s.scheduledTimeLocal,
    m: parseMinutes(s.scheduledTimeLocal) ?? 12 * 60
  })).sort((a, b) => a.m - b.m);
  const windows = [];
  const first = ordered[0];
  if (first) {
    const wakeM = Math.max(6 * 60, first.m - 50);
    windows.push({
      labelIt: "Mattino \u2014 idratazione iniziale / pre-primo pasto",
      scheduledTimeLocal: formatMinutes(wakeM),
      volumeMl: 420,
      notesIt: "Acqua a piccoli sorsi; utile prima della colazione o al risveglio.",
      sodiumMg: 0,
      potassiumMg: 0,
      magnesiumMg: 0
    });
  }
  for (const s of ordered) {
    if (s.slot === "breakfast" || s.slot === "lunch" || s.slot === "dinner") {
      const ml = s.slot === "lunch" ? 450 : s.slot === "dinner" ? 380 : 360;
      windows.push({
        labelIt: `Pasto \u2014 ${s.labelIt}`,
        scheduledTimeLocal: s.scheduledTimeLocal?.trim() ? s.scheduledTimeLocal : formatMinutes(s.m),
        volumeMl: ml,
        notesIt: "Durante il pasto o nei 20' precedenti; distribuisci in pi\xF9 bicchieri.",
        sodiumMg: Math.round(ml * 0.035),
        potassiumMg: Math.round(ml * 0.018),
        magnesiumMg: Math.round(ml * 0.012)
      });
    }
    if (s.slot === "snack_am" || s.slot === "snack_pm") {
      windows.push({
        labelIt: `Spuntino \u2014 ${s.labelIt}`,
        scheduledTimeLocal: s.scheduledTimeLocal?.trim() ? s.scheduledTimeLocal : formatMinutes(s.m),
        volumeMl: 300,
        notesIt: "Associa acqua alla merenda; se allenamento intenso entro 2h, +150 ml.",
        sodiumMg: 8,
        potassiumMg: 5,
        magnesiumMg: 3
      });
    }
  }
  if (hasTraining) {
    windows.push({
      labelIt: "Allenamento \u2014 peri / post (fluidi + elettroliti se seduta lunga o caldo)",
      scheduledTimeLocal: "\u2014",
      volumeMl: trainingExtraMl,
      notesIt: "Se sudorazione elevata: integra Na/K/Mg (bevanda o protocollo concordato).",
      sodiumMg: Math.min(900, Math.round(trainingExtraMl * 0.5)),
      potassiumMg: Math.round(trainingExtraMl * 0.11),
      magnesiumMg: Math.round(trainingExtraMl * 0.035)
    });
  }
  windows.push({
    labelIt: "Sera \u2014 chiusura idratazione",
    scheduledTimeLocal: "21:15",
    volumeMl: 260,
    notesIt: "Volume moderato se sensibilit\xE0 a risvegli notturni per diuresi.",
    sodiumMg: 0,
    potassiumMg: 0,
    magnesiumMg: 0
  });
  const sumVol = windows.reduce((a, w) => a + w.volumeMl, 0);
  const scale = sumVol > 0 ? totalTargetMl / sumVol : 1;
  const scaled = windows.map((w) => ({
    ...w,
    volumeMl: Math.max(100, Math.round(w.volumeMl * scale))
  }));
  return {
    baselineDailyMl,
    trainingExtraMl,
    totalTargetMl,
    windows: scaled
  };
}

// apps/web/lib/nutrition/meal-plan-nutrient-integration-hints.ts
function buildMealPlanNutrientIntegrationHints(day) {
  const lines = [];
  if (day.fiberG < 22) {
    lines.push(
      "Fibre sotto target: pi\xF9 verdura/legumi/integrali; in alternativa integrazione fibre solo se concordata."
    );
  }
  if (day.omega3G < 1.2) {
    lines.push("Omega-3 bassi: pesce azzurro o integrazione EPA/DHA se prescritta.");
  }
  if (day.vitD_mcg < 8) {
    lines.push("Vitamina D: sole sicuro, alimenti fortificati o integrazione solo su parere clinico.");
  }
  if (day.ca_mg < 700) {
    lines.push("Calcio sotto soglia: latticini/bevande fortificate o integrazione se concordata.");
  }
  if (day.fe_mg < 9 && day.proteinG < 90) {
    lines.push("Ferro: privilegia fonti eme e vitamina C a pasto; integrazione solo se indicata.");
  }
  return lines.slice(0, 5);
}

// apps/web/lib/nutrition/meal-plan-protein-dedupe.ts
var FAMILY_ORDER = ["poultry", "fish", "legume", "red_meat", "egg"];
function haystack(it) {
  return `${it.name} ${it.portionHint}`.toLowerCase();
}
function isSecondaryDairyOrPowder(it) {
  if (it.macroRole !== "protein") return false;
  const t = haystack(it);
  if (/\buov|\beggs?\b|frittata|strapazzat|omelett/i.test(t)) return false;
  return /yogurt|kefir|latte |bevanda (di )?(mandorla|riso|avena)|proteine in polvere|whey|shake proteic/i.test(t) || /(grana|parmigiano|formaggio).{0,24}(gratt|fette)/i.test(t);
}
function proteinFamilyFromItem(it) {
  if (it.macroRole !== "protein") return null;
  if (isSecondaryDairyOrPowder(it)) return null;
  const t = haystack(it);
  if (/\buov|\beggs?\b|frittata|strapazzat|omelett|albumi/i.test(t)) return "egg";
  if (/merluzz|salmon|salmone|tonn|sgombr|spigol|pesce|acciug|gamber|filetto|orata|branzin|trota|sarde/i.test(t)) {
    return "fish";
  }
  if (/pollo|tacchino|petto|pollo|turkey|chicken/i.test(t)) return "poultry";
  if (/legum|lenticch|ceci|fagiol|pisell|cece|hummus|soia edamame/i.test(t)) return "legume";
  if (/manzo|maiale|agnell|carne magra|bresaola|vitello|hamburger|spezzatin|ragù|prosciutto cotto|prosciutto crudo|affettat/i.test(t)) {
    return "red_meat";
  }
  return null;
}
function collectLunchFamilies(lunch) {
  const s = /* @__PURE__ */ new Set();
  for (const it of lunch.items) {
    const f = proteinFamilyFromItem(it);
    if (f) s.add(f);
  }
  return s;
}
function templateFor(family, approxKcal) {
  const note = "Variazione automatica EMPATHY: evitata la stessa famiglia proteica principale gi\xE0 usata a pranzo (stesso giorno).";
  switch (family) {
    case "poultry":
      return {
        name: "Proteina: pollo/tacchino",
        portionHint: `${approxKcal >= 280 ? 200 : 170} g petto di pollo o tacchino`,
        functionalBridge: note
      };
    case "fish":
      return {
        name: "Proteina: merluzzo",
        portionHint: `${approxKcal >= 280 ? 220 : 190} g merluzzo o altro pesce magro (cottura semplice)`,
        functionalBridge: note
      };
    case "legume":
      return {
        name: "Proteina: legumi",
        portionHint: `${approxKcal >= 280 ? 220 : 190} g legumi cotti (ceci, lenticchie o fagioli)`,
        functionalBridge: note
      };
    case "red_meat":
      return {
        name: "Proteina: carne magra",
        portionHint: `${approxKcal >= 280 ? 180 : 150} g carne magra (manzo/maiale magro)`,
        functionalBridge: note
      };
    case "egg":
      return {
        name: "Proteina: uova",
        portionHint: `${approxKcal >= 320 ? 3 : 2} uova (frittata o strapazzate)`,
        functionalBridge: note
      };
    default:
      return templateFor("poultry", approxKcal);
  }
}
function pickReplacementFamily(lunchFamilies, duplicate) {
  for (const f of FAMILY_ORDER) {
    if (f === duplicate) continue;
    if (!lunchFamilies.has(f)) return f;
  }
  for (const f of FAMILY_ORDER) {
    if (f !== duplicate) return f;
  }
  return "poultry";
}
function dedupeLunchDinnerMainProteins(slots) {
  const bySlot = new Map(slots.map((s) => [s.slot, s]));
  const lunch = bySlot.get("lunch");
  const dinner = bySlot.get("dinner");
  if (!lunch || !dinner) return slots;
  const lunchFamilies = collectLunchFamilies(lunch);
  if (lunchFamilies.size === 0) return slots;
  let changed = false;
  const newItems = dinner.items.map((it) => {
    if (it.macroRole !== "protein") return it;
    const fam = proteinFamilyFromItem(it);
    if (!fam || !lunchFamilies.has(fam)) return it;
    changed = true;
    const alt = pickReplacementFamily(lunchFamilies, fam);
    const t = templateFor(alt, Math.max(40, it.approxKcal));
    return {
      ...it,
      name: t.name,
      portionHint: t.portionHint.slice(0, 160),
      functionalBridge: `${it.functionalBridge} ${t.functionalBridge}`.slice(0, 500)
    };
  });
  if (!changed) return slots;
  return slots.map((s) => s.slot === "dinner" ? { ...s, items: newItems } : s);
}

// apps/web/lib/nutrition/pathway-target-rollup-compare.ts
var EDUCATIONAL_DAY_FLOORS = {
  folate_mcg: 300,
  vitC_mg: 70,
  vitB12_mcg: 2,
  fe_mg: 9,
  mg_mg: 280,
  zn_mg: 8,
  ca_mg: 700,
  vitD_mcg: 8,
  omega3G: 1.2,
  fiberG: 22,
  thiamineB1_mg: 1,
  riboflavinB2_mg: 1,
  niacinB3_mg: 12,
  vitB6_mg: 1,
  se_mcg: 45
};
var UNITS = {
  folate_mcg: "mcg",
  vitC_mg: "mg",
  vitB12_mcg: "mcg",
  fe_mg: "mg",
  mg_mg: "mg",
  zn_mg: "mg",
  ca_mg: "mg",
  vitD_mcg: "mcg",
  omega3G: "g",
  fiberG: "g",
  thiamineB1_mg: "mg",
  riboflavinB2_mg: "mg",
  niacinB3_mg: "mg",
  vitB6_mg: "mg",
  se_mcg: "mcg",
  vitA_mcg_RAE: "mcg",
  vitE_mg: "mg",
  vitK_mcg: "mcg",
  p_mg: "mg",
  k_mg: "mg",
  na_mg: "mg"
};
function dayValueForNutrient(day, id) {
  const v = day[id];
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}
function buildPathwayTargetRollupComparison(targets, dayTotals) {
  const seen = /* @__PURE__ */ new Set();
  const lines = [];
  for (const t of targets) {
    if (seen.has(t.nutrientId)) continue;
    seen.add(t.nutrientId);
    const floor = EDUCATIONAL_DAY_FLOORS[t.nutrientId];
    if (floor == null) continue;
    const dayValue = dayValueForNutrient(dayTotals, t.nutrientId);
    const unit = UNITS[t.nutrientId] ?? "";
    lines.push({
      nutrientId: t.nutrientId,
      labelIt: t.labelIt,
      dayValue: Math.round(dayValue * 100) / 100,
      unit,
      floor,
      status: dayValue >= floor ? "met" : "low"
    });
  }
  return lines.slice(0, 12);
}

// apps/web/lib/nutrition/meal-plan-response-finalize.ts
function enrichSlot(slot, snapshot) {
  const items = slot.items.map((it) => {
    const { compositionKey, compositionStatus, nutrients } = nutrientsForMealPlanItemFromCache(
      {
        name: it.name,
        portionHint: it.portionHint,
        approxKcal: it.approxKcal,
        compositionKey: it.compositionKey
      },
      snapshot
    );
    return {
      ...it,
      compositionKey: it.compositionKey ?? compositionKey,
      compositionStatus,
      nutrients
    };
  });
  return { ...slot, items };
}
async function finalizeIntelligentMealPlanCore(core, req, snapshot) {
  const slotsDeduped = dedupeLunchDinnerMainProteins(core.slots);
  const fdcSnapshot = snapshot ?? await buildFdcCanonicalSnapshot(
    slotsDeduped.flatMap((s) => s.items.map((it) => inferCanonicalFoodKeyPreferName(it.name, it.portionHint)))
  );
  const slots = slotsDeduped.map((s) => enrichSlot(s, fdcSnapshot));
  const byReq = new Map(req.slots.map((s) => [s.slot, s]));
  const perSlot = slots.map((s) => {
    const meta = byReq.get(s.slot);
    const totals = sumScaledNutrients(s.items.map((i) => i.nutrients));
    return {
      slot: s.slot,
      labelIt: meta?.labelIt ?? s.slot,
      scheduledTimeLocal: meta?.scheduledTimeLocal ?? "",
      totals
    };
  });
  const dayTotals = sumScaledNutrients(perSlot.map((p) => p.totals));
  const integrationHints = buildMealPlanNutrientIntegrationHints(dayTotals);
  let dayInteractionSummary = core.dayInteractionSummary;
  if (integrationHints.length) {
    dayInteractionSummary = `${dayInteractionSummary} \xB7 ${integrationHints.join(" \xB7 ")}`.slice(0, 900);
  }
  const boostTargets = req.nutrientBoostTargets?.filter(
    (t) => typeof t.nutrientId === "string" && typeof t.labelIt === "string" && t.labelIt.trim() !== ""
  ) ?? [];
  const pathwayTargetRollup = boostTargets.length > 0 ? buildPathwayTargetRollupComparison(boostTargets, dayTotals) : void 0;
  return {
    ...core,
    slots,
    dayInteractionSummary,
    pathwayTargetRollup,
    nutrientRollup: {
      disclaimerIt: "Composizione da cache USDA FDC (nutrition_fdc_foods) quando disponibile; fallback alla banca canonica interna per voci non ancora mappate. GI/II derivati da macro USDA (Wolever-style estimate, salvati in DB).",
      dayTotals,
      perSlot
    },
    hydrationRoutine: buildHydrationRoutineFromMealPlanRequest(req)
  };
}

// apps/web/lib/nutrition/v2/map-v2-plan-to-v1-response.ts
function macroRoleFromItem(choG, proG, fatG) {
  const choK = choG * 4;
  const proK = proG * 4;
  const fatK = fatG * 9;
  const total = choK + proK + fatK;
  if (total <= 0) return "mixed";
  if (choK / total >= 0.55) return "cho_heavy";
  if (proK / total >= 0.35) return "protein";
  if (fatK / total >= 0.45) return "fat";
  return "mixed";
}
function mapItem(item2, slotKey, itemIndex) {
  const label = item2.description;
  const roles = MEAL_SLOT_ASSEMBLY[slotKey] ?? [];
  const spec = roles[itemIndex] ?? roles[roles.length - 1] ?? {
    foodRole: "cho_simple",
    lever: "cho",
    poolKey: "snack_cho",
    minG: 25,
    maxG: 180,
    stepG: 5
  };
  const canonicalKey = item2.canonicalKey;
  const compositionKey = item2.fdcId > 0 && item2.servingBasis ? `fdc:${item2.fdcId}` : canonicalKey && fdcIdForCanonicalKey(canonicalKey) ? `fdc:${fdcIdForCanonicalKey(canonicalKey)}` : canonicalKey ?? `fdc:${item2.fdcId}`;
  return {
    name: label,
    portionHint: portionHintIt(label, item2.grams, spec, item2.servingBasis),
    functionalBridge: "Alimentazione sportiva \xB7 staple canonico",
    approxKcal: Math.round(item2.kcal),
    macroRole: macroRoleFromItem(item2.choG, item2.proG, item2.fatG),
    compositionKey,
    compositionStatus: compositionKey.startsWith("fdc:") ? "fdc_cache" : "canonical_estimate"
  };
}
function slotCoherenceFor(slot, suppressed) {
  if (suppressed) {
    return "Pasto soppresso: energia in finestra allenamento \u2192 modulo Fueling (substrati V2).";
  }
  return "Composizione mediterranea sportiva: primo + secondo + contorno (V2 staple).";
}
function composedMealForSlot(production, slotReq) {
  const composed = production.composedMealPlan.find((s) => s.slot === slotReq.slot);
  if (!composed || composed.items.length === 0) {
    return { items: [], lines: [], totalApproxKcal: 0 };
  }
  const items = composed.items.map((it, idx) => mapItem(it, slotReq.slot, idx));
  return {
    items: items.map((it) => ({
      name: it.name,
      portionHint: it.portionHint,
      functionalBridge: it.functionalBridge ?? "",
      approxKcal: it.approxKcal,
      macroRole: it.macroRole
    })),
    lines: items.map((i) => i.portionHint),
    totalApproxKcal: items.reduce((s, i) => s + i.approxKcal, 0)
  };
}
function mapV2PlanToV1AssembledCore(production, request) {
  const suppressed = new Set(request.suppressedSlots ?? []);
  const slotMeta = new Map(request.slots.map((s) => [s.slot, s]));
  const preEnrichSlots = production.composedMealPlan.map((composed) => {
    const slotKey = composed.slot;
    const meta = slotMeta.get(slotKey);
    const isSuppressed = suppressed.has(slotKey);
    if (isSuppressed) {
      return {
        slot: slotKey,
        targetKcalEcho: composed.targetKcal,
        items: [
          {
            name: "Fueling in seduta",
            portionHint: "Vedi timeline Fueling",
            functionalBridge: "CHO intra da substrati fisiologici",
            approxKcal: 0,
            macroRole: "cho_heavy"
          }
        ],
        slotCoherence: slotCoherenceFor(slotKey, true),
        slotTimingRationale: meta?.scheduledTimeLocal ? `Orario ${meta.scheduledTimeLocal}: slot dentro finestra training.` : "Slot in finestra training."
      };
    }
    return {
      slot: slotKey,
      targetKcalEcho: composed.targetKcal,
      items: composed.items.map((it, idx) => mapItem(it, slotKey, idx)),
      slotCoherence: slotCoherenceFor(slotKey, false),
      slotTimingRationale: meta?.scheduledTimeLocal ? `Pasto ${meta.labelIt} alle ${meta.scheduledTimeLocal} \xB7 target Diet ${composed.targetKcal} kcal.` : `Target Diet ${composed.targetKcal} kcal.`
    };
  });
  const enrichedSlots = enrichMealSlotsAfterCompose({
    request,
    slots: preEnrichSlots,
    getBaseMealForSlot: (slotReq) => composedMealForSlot(production, slotReq)
  });
  const fuelNote = production.requirements.substrateFueling ? `Fueling V2: ${production.requirements.energy.fuelingKcal} kcal oral (CHO substrati).` : "";
  return {
    layer: "deterministic_meal_assembly_v1",
    disclaimer: `Piano generato con motore Nutrition V2 (staple sportivi + fueling substrati). ${fuelNote} Ripartizione pasti da Profile Diet.`,
    slots: enrichedSlots,
    dayInteractionSummary: dayInteractionSummaryExtras(
      request,
      [`Strategia ${production.requirements.strategyKind}`, fuelNote].filter(Boolean).join(" \xB7 ")
    ),
    mealRotationStaples: composedStaples(production),
    pathwayBoostStatus: pathwayBoostStatusFromRequest(request)
  };
}
function composedStaples(production) {
  const items = production.composedMealPlan.flatMap((slot) => slot.items);
  return mealRotationStaplesFromComposedItems(items);
}
async function mapV2PlanToV1Response(production, request) {
  const core = mapV2PlanToV1AssembledCore(production, request);
  const fdcIds = /* @__PURE__ */ new Set();
  const canonicalKeys = [];
  for (const slot of core.slots) {
    for (const it of slot.items) {
      const key = it.compositionKey ?? "";
      if (key.startsWith("fdc:")) {
        const id = Number(key.slice(4));
        if (Number.isFinite(id) && id > 0) fdcIds.add(id);
      } else if (key && !key.startsWith("fdc:")) {
        canonicalKeys.push(key);
      }
    }
  }
  for (const slot of production.composedMealPlan) {
    for (const it of slot.items) {
      if (it.fdcId > 0) fdcIds.add(it.fdcId);
      if (it.canonicalKey) canonicalKeys.push(it.canonicalKey);
    }
  }
  const foodsByFdcId = fdcIds.size > 0 ? await loadFdcFoodsByIds([...fdcIds]) : /* @__PURE__ */ new Map();
  const snapFdc = buildFdcCanonicalSnapshotFromFdcIds([...fdcIds], foodsByFdcId);
  const snapCanon = buildFdcCanonicalSnapshotFromFoods([...new Set(canonicalKeys)], foodsByFdcId);
  const snapshot = { ...snapCanon, ...snapFdc };
  return finalizeIntelligentMealPlanCore(core, request, snapshot);
}

// apps/web/lib/nutrition/v2/persist-v2-plan-to-db.ts
function num2(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}
async function persistV2PlanToDb(admin, athleteId, planDate, production, opts) {
  const slots = production.composedMealPlan.filter((s) => s.items.length > 0);
  if (slots.length === 0) return { ok: false, error: "Piano V2 senza pasti da persistere" };
  const { error: delErr } = await admin.from("nutrition_plan").delete().eq("athlete_id", athleteId).eq("plan_date", planDate);
  if (delErr) return { ok: false, error: `delete piano: ${delErr.message}` };
  const planTotals = slots.reduce(
    (acc, s) => {
      acc.kcal += num2(s.totals.kcal);
      acc.cho += num2(s.totals.choG);
      acc.pro += num2(s.totals.proG);
      acc.fat += num2(s.totals.fatG);
      return acc;
    },
    { kcal: 0, cho: 0, pro: 0, fat: 0 }
  );
  const { data: planRow, error: planErr } = await admin.from("nutrition_plan").insert({
    athlete_id: athleteId,
    plan_date: planDate,
    algorithm_version: production.algorithmVersion,
    goal: opts?.goal ?? null,
    meal_count: slots.length,
    kcal_target: Math.round(planTotals.kcal),
    carbs_g_target: Math.round(planTotals.cho),
    protein_g_target: Math.round(planTotals.pro),
    fat_g_target: Math.round(planTotals.fat),
    hydration_ml_target: opts?.hydrationMlTarget ?? null
  }).select("id").single();
  if (planErr || !planRow?.id) return { ok: false, error: `insert piano: ${planErr?.message ?? "no id"}` };
  const planId = String(planRow.id);
  const mealPayload = slots.map((s, idx) => ({
    plan_id: planId,
    slot: s.slot,
    slot_order: idx + 1,
    kcal_target: Math.round(num2(s.totals.kcal)),
    carbs_g_target: Math.round(num2(s.totals.choG)),
    protein_g_target: Math.round(num2(s.totals.proG)),
    fat_g_target: Math.round(num2(s.totals.fatG))
  }));
  const { data: mealRows, error: mealErr } = await admin.from("meal").insert(mealPayload).select("id, slot");
  if (mealErr || !mealRows?.length) return { ok: false, error: `insert pasti: ${mealErr?.message ?? "no rows"}` };
  const mealIdBySlot = /* @__PURE__ */ new Map();
  for (const row2 of mealRows) mealIdBySlot.set(row2.slot, String(row2.id));
  const itemPayload = [];
  for (const s of slots) {
    const mealId = mealIdBySlot.get(s.slot);
    if (!mealId) continue;
    const roles = MEAL_SLOT_ASSEMBLY[s.slot] ?? [];
    s.items.forEach((it, i) => {
      const resolvedFdc = it.fdcId > 0 ? it.fdcId : it.canonicalKey ? fdcIdForCanonicalKey(it.canonicalKey) : null;
      const foodRole = roles[i]?.foodRole ?? roles[roles.length - 1]?.foodRole ?? "cho_simple";
      itemPayload.push({
        meal_id: mealId,
        fdc_id: resolvedFdc && resolvedFdc > 0 ? resolvedFdc : null,
        label: it.description ?? null,
        canonical_key: it.canonicalKey ?? null,
        food_role: foodRole,
        grams: Math.round(num2(it.grams)),
        kcal: Math.round(num2(it.kcal)),
        carbs_g: num2(it.choG),
        protein_g: num2(it.proG),
        fat_g: num2(it.fatG)
      });
    });
  }
  if (itemPayload.length > 0) {
    const { error: itemErr } = await admin.from("meal_item").insert(itemPayload);
    if (itemErr) return { ok: false, error: `insert voci: ${itemErr.message}` };
  }
  return { ok: true, planId };
}

// apps/web/lib/nutrition/meal-plan-solver-basis.ts
function profileConstraintLines(req) {
  const lines = [];
  if (req.dietType?.trim()) lines.push(`Dieta dichiarata: ${req.dietType.trim()}`);
  if (req.allergies?.length) lines.push(`Allergie: ${req.allergies.join(", ")}`);
  if (req.intolerances?.length) lines.push(`Intolleranze: ${req.intolerances.join(", ")}`);
  if (req.foodExclusions?.length) lines.push(`Esclusioni alimentari: ${req.foodExclusions.join(", ")}`);
  if (req.foodPreferences?.length) lines.push(`Preferenze: ${req.foodPreferences.join(", ")}`);
  if (req.supplements?.length) lines.push(`Integratori (nota): ${req.supplements.join(", ")}`);
  return lines;
}
function buildSolverBasisFromRequest(req) {
  const postWorkoutMealBySlot = req.postWorkoutMealBySlot && Object.keys(req.postWorkoutMealBySlot).length ? req.postWorkoutMealBySlot : void 0;
  const suppressedSlots = req.suppressedSlots && req.suppressedSlots.length > 0 ? [...req.suppressedSlots] : void 0;
  const nutrientBoostTargets = req.nutrientBoostTargets && req.nutrientBoostTargets.length > 0 ? req.nutrientBoostTargets.map((t) => ({ nutrientId: t.nutrientId, labelIt: t.labelIt })) : void 0;
  const pathwayModulationActiveLabels = req.pathwayModulationActiveLabels && req.pathwayModulationActiveLabels.trim() ? req.pathwayModulationActiveLabels.trim().slice(0, 360) : void 0;
  return {
    source: "nutrition_meal_plan_solver",
    planDate: req.planDate,
    dailyMealsKcalTotal: req.mealPlanSolverMeta.dailyMealsKcalTotal,
    dietType: req.dietType,
    profileConstraintLines: profileConstraintLines(req),
    trainingDayLines: [...req.trainingDayLines],
    routineDigest: req.routineDigest,
    integrationLeverLines: [...req.mealPlanSolverMeta.integrationLeverLines],
    pathwayTimingLines: [...req.pathwayTimingLines],
    aggregateInhibitors: req.aggregateInhibitors ? [...req.aggregateInhibitors] : null,
    postWorkoutMealBySlot,
    suppressedSlots,
    nutrientBoostTargets,
    pathwayModulationActiveLabels,
    slots: req.slots.map((s) => ({
      slot: s.slot,
      labelIt: s.labelIt,
      scheduledTimeLocal: s.scheduledTimeLocal,
      targetKcal: s.targetKcal,
      targetCarbsG: s.targetCarbsG,
      targetProteinG: s.targetProteinG,
      targetFatG: s.targetFatG
    }))
  };
}
function attachSolverBasisToAssembled(core, req) {
  return {
    ...core,
    solverBasis: buildSolverBasisFromRequest(req)
  };
}

// apps/web/lib/coach-org-id.ts
var EMPATHY_DEFAULT_ORG_ID = "00000000-0000-4000-8000-000000000001";
function coachOrgIdForDb() {
  const fromEnv = process.env.EMPATHY_COACH_ATHLETES_ORG_ID?.trim();
  return fromEnv && fromEnv.length > 0 ? fromEnv : EMPATHY_DEFAULT_ORG_ID;
}

// apps/web/lib/platform-coach-status.ts
function coachOperationalApproved(role, status) {
  if (role !== "coach") return true;
  return status === "approved";
}

// apps/web/lib/athlete/can-access-athlete-data.ts
async function canAccessAthleteData(client, userId, athleteId, orgId) {
  const { data: prof, error } = await client.from("app_user_profiles").select("role, athlete_id, is_platform_admin, platform_coach_status").eq("user_id", userId).maybeSingle();
  if (error || !prof) return false;
  const p = prof;
  if (p.is_platform_admin === true) return true;
  const linkedAthleteId = typeof p.athlete_id === "string" ? p.athlete_id : null;
  if (linkedAthleteId === athleteId) return true;
  if (p.role !== "coach") return false;
  if (!coachOperationalApproved("coach", p.platform_coach_status ?? null)) return false;
  const resolvedOrg = orgId ?? coachOrgIdForDb();
  const { data: links, error: linkErr } = await client.from("coach_athletes").select("athlete_id").eq("coach_user_id", userId).eq("athlete_id", athleteId).eq("org_id", resolvedOrg).limit(1);
  if (linkErr) return false;
  return Boolean(links?.length);
}
export {
  attachSolverBasisToAssembled,
  buildMealPlanV2Production,
  canAccessAthleteData,
  mapV2PlanToV1Response,
  persistV2PlanToDb,
  prepareIntelligentMealPlanContext
};
