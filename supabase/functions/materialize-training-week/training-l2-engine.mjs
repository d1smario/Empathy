var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

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

// apps/web/lib/training/builder/block-length-mode.ts
function kindSupportsDistanceMode(kind) {
  const k = (kind ?? "").toLowerCase();
  return k === "steady" || k === "ramp";
}
function distanceModeDurationSeconds(distanceKm, refSpeedKmh) {
  const km = Math.max(0.1, distanceKm || 0);
  return Math.max(30, Math.round(km / Math.max(1, refSpeedKmh) * 3600));
}
var init_block_length_mode = __esm({
  "apps/web/lib/training/builder/block-length-mode.ts"() {
    "use strict";
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
  if (ch?.lengthMode != null) {
    if (ch.lengthMode === "distance" && kindSupportsDistanceMode(block.kind)) {
      return distanceModeDurationSeconds(ch.distanceKm, speedRefKmh);
    }
  } else if (lengthMode === "distance" && ch && (ch.distanceKm ?? 0) > 0) {
    return distanceModeDurationSeconds(ch.distanceKm, speedRefKmh);
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
    const rec2 = Math.max(10, Math.round(ch.recoverSeconds || 90));
    const zOn = zoneFromIntensityCue(String(ch.intensity || block.intensityCue || ""), "Z4");
    const zOff = zoneFromIntensityCue(String(ch.intensity2 || ""), "Z1");
    for (let i = 0; i < reps; i += 1) {
      out.push(
        draftStep(block, `w-${i}`, `${block.label} \xB7 lavoro`, work, zOn, "steady", wattsTripleForZoneLabel(zOn, ftpW), {
          firstInBlock: i === 0
        })
      );
      out.push(
        draftStep(block, `r-${i}`, `${block.label} \xB7 recupero`, rec2, zOff, "steady", wattsTripleForZoneLabel(zOff, ftpW), {
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
    init_block_length_mode();
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

// apps/web/lib/training/session-multilevel-analysis-strip.ts
function buildStripSlotsFromFacets(sortedFacets) {
  const byCat = /* @__PURE__ */ new Map();
  for (const f of sortedFacets) {
    const prev = byCat.get(f.category) ?? [];
    prev.push(f);
    byCat.set(f.category, prev);
  }
  return CATEGORY_ORDER.map((cat) => {
    const list = byCat.get(cat);
    if (!list?.length) {
      return {
        category: cat,
        shortLabelIt: STRIP_SHORT_LABEL[cat],
        valueLineIt: "\u2014",
        detailHintIt: "Nessun segnale strutturato per questo settore su questa sessione.",
        facetId: `empty_${cat}`
      };
    }
    const best = [...list].sort((a, b) => SOURCE_RANK[a.source] - SOURCE_RANK[b.source])[0];
    return {
      category: cat,
      shortLabelIt: STRIP_SHORT_LABEL[cat],
      valueLineIt: best.pillLabelIt,
      detailHintIt: best.hintIt,
      facetId: best.id
    };
  });
}
function isAdaptationTarget(s) {
  return ALL_ADAPTATION_TARGETS.includes(s);
}
function pushFacet(out, input) {
  if (out.some((f) => f.id === input.id)) return;
  out.push({
    ...input,
    categoryLabelIt: CATEGORY_LABELS[input.category]
  });
}
function knowledgeBlob(contract) {
  const sk = contract.sessionKnowledge;
  const parts = [];
  if (sk) {
    parts.push(
      ...sk.physiologicalIntent,
      ...sk.primaryMechanisms,
      ...sk.nutritionSupports,
      ...sk.inhibitorsAndRisks,
      ...sk.relevantPathways?.map((p) => p.label) ?? [],
      ...sk.relevantGenes?.map((g) => g.label) ?? [],
      ...sk.relevantMetabolites?.map((m) => m.label) ?? [],
      ...sk.relevantMicrobiota?.map((m) => m.label) ?? []
    );
  }
  if (contract.structure?.objective) parts.push(contract.structure.objective);
  if (contract.structure?.methodology) parts.push(contract.structure.methodology);
  if (contract.structure?.descriptor) parts.push(contract.structure.descriptor);
  return parts.join(" ").toLowerCase();
}
function facetsFromAdaptationTarget(target) {
  const out = [];
  switch (target) {
    case "vo2_max_support":
      out.push({
        id: "at_vo2_bio",
        category: "bioenergetics",
        pillLabelIt: "VO2 \xB7 capacit\xE0 aerobica",
        hintIt: "Stimolo orientato a massa/tempo sopra soglie aerobiche: economia O2 e integrazione cardiaca\u2013muscolare.",
        source: "adaptation_target"
      });
      out.push({
        id: "at_vo2_hypox",
        category: "oxygen_hypoxia",
        pillLabelIt: "Ipossia funzionale muscolare",
        hintIt: "Durante blocchi intensi: gradiente O2 muscolo \u2194 mitocondri; asse HIF come contesto adattivo (non misura invasiva).",
        source: "adaptation_target"
      });
      out.push({
        id: "at_vo2_gly",
        category: "glycolysis",
        pillLabelIt: "Glicolisi di supporto",
        hintIt: "A intervalli o progressioni: glucosio rapido e lattato come shuttle energetico accanto all\u2019ossidazione.",
        source: "adaptation_target"
      });
      break;
    case "mitochondrial_density":
      out.push({
        id: "at_mito_bio",
        category: "bioenergetics",
        pillLabelIt: "Mitocondri \xB7 densit\xE0 / efficienza",
        hintIt: "Segnali PGC-1\u03B1 / biogenesi (contesto allenamento); integrazione con recupero e disponibilit\xE0 substrato.",
        source: "adaptation_target"
      });
      out.push({
        id: "at_mito_hyp",
        category: "oxygen_hypoxia",
        pillLabelIt: "Stress redox \xB7 O2",
        hintIt: "Ripetute ondate ipossiche transitorie come trigger comuni in protocolli aerobici strutturati.",
        source: "adaptation_target"
      });
      break;
    case "lactate_tolerance":
      out.push({
        id: "at_lt_gly",
        category: "glycolysis",
        pillLabelIt: "Glicolisi \xB7 acido lattato",
        hintIt: "Produzione H+ e lactate intramuscolo; tolleranza a carico metabolico acuto.",
        source: "adaptation_target"
      });
      out.push({
        id: "at_lt_muscle",
        category: "muscle_cellular",
        pillLabelIt: "Buffer \xB7 microambiente",
        hintIt: "Capacit\xE0 tampone e trasportatori (es. MCT) come asse cellulare (contesto, non lab).",
        source: "adaptation_target"
      });
      out.push({
        id: "at_lt_hyp",
        category: "oxygen_hypoxia",
        pillLabelIt: "Gradiente O\u2082 \xB7 blocchi soglia",
        hintIt: "Ripetute ondate ipossiche transitorie durante lavoro LT2/LT1: contesto adattivo HIF (non misura invasiva).",
        source: "adaptation_target"
      });
      out.push({
        id: "at_lt_neuro",
        category: "neuro_adrenergic",
        pillLabelIt: "Drive adrenergico \xB7 soglia",
        hintIt: "Blocco sopra LT: reclutamento fibre veloci e picco catecolaminergico acuto.",
        source: "adaptation_target"
      });
      break;
    case "lactate_clearance":
      out.push({
        id: "at_lc_gly",
        category: "glycolysis",
        pillLabelIt: "Clearance lattato",
        hintIt: "Riossidazione / gluconeogenesi periferica; accoppiamento con lavoro sotto soglia e recupero attivo.",
        source: "adaptation_target"
      });
      out.push({
        id: "at_lc_bio",
        category: "bioenergetics",
        pillLabelIt: "Mitocondri \xB7 ossidazione",
        hintIt: "Utilizzo lattato come substrato in fibre ossidative e cuore (contesto fisiologico).",
        source: "adaptation_target"
      });
      break;
    case "max_strength":
    case "hypertrophy_mixed":
    case "hypertrophy_myofibrillar":
    case "hypertrophy_sarcoplasmic":
      out.push({
        id: "at_ms_mech",
        category: "muscle_cellular",
        pillLabelIt: "Stress meccanico / ipertrofia",
        hintIt: "Tensione muscolo\u2013tendinea; segnali meccanotrasduzione e stress metabolico (contesto forza-massa).",
        source: "adaptation_target"
      });
      out.push({
        id: "at_ms_neuro",
        category: "neuro_adrenergic",
        pillLabelIt: "Drive neuromuscolare",
        hintIt: "Reclutamento unit\xE0 motorie; simpatico acuto su serie intense.",
        source: "adaptation_target"
      });
      out.push({
        id: "at_ms_mtor",
        category: "repair_anabolic",
        pillLabelIt: "Segnale anabolico (timing)",
        hintIt: "mTOR / sintesi proteica sensibile al post-carico con aminoacidi ed energia adeguata.",
        source: "adaptation_target"
      });
      break;
    case "neuromuscular_adaptation":
      out.push({
        id: "at_neuro_nm",
        category: "neuro_adrenergic",
        pillLabelIt: "RFD \xB7 innervazione",
        hintIt: "Intento velocit\xE0 e reclutamento; non priorit\xE0 volume ipertrofico massimo.",
        source: "adaptation_target"
      });
      out.push({
        id: "at_neuro_muscle",
        category: "muscle_cellular",
        pillLabelIt: "Accoppiamento eccitazione\u2013contrazione",
        hintIt: "Qualit\xE0 contrattile e coordinazione sotto carico moderato-alto.",
        source: "adaptation_target"
      });
      break;
    case "power_output":
      out.push({
        id: "at_po_neuro",
        category: "neuro_adrenergic",
        pillLabelIt: "Catecolamine \xB7 output",
        hintIt: "Sprint e salti: picco simpatico e coordinazione.",
        source: "adaptation_target"
      });
      out.push({
        id: "at_po_muscle",
        category: "muscle_cellular",
        pillLabelIt: "PCr \xB7 velocit\xE0 di accoppiamento",
        hintIt: "Sistemi anaerobici alattacidici e glicolitici rapidi.",
        source: "adaptation_target"
      });
      break;
    case "recovery":
      out.push({
        id: "at_rec_rep",
        category: "repair_anabolic",
        pillLabelIt: "Riparazione prioritaria",
        hintIt: "Bassa densit\xE0 di segnale catabolico; focus sonno, energia, micronutrienti.",
        source: "adaptation_target"
      });
      out.push({
        id: "at_rec_hpa",
        category: "endocrine_stress",
        pillLabelIt: "Ridurre allostasi",
        hintIt: "Attenuare cortisolo cronico da sovrallenamento (contesto gestionale).",
        source: "adaptation_target"
      });
      break;
    case "movement_quality":
    case "mobility_capacity":
    case "skill_transfer":
      out.push({
        id: "at_motor_neuro",
        category: "neuro_adrenergic",
        pillLabelIt: "Plasticit\xE0 motoria",
        hintIt: "Apprendimento e rifinitura pattern; carico simpatico tipicamente moderato.",
        source: "adaptation_target"
      });
      break;
    default:
      break;
  }
  return out;
}
function facetsFromKnowledgeBlob(blob) {
  const out = [];
  if (/hif|ipossi|hypox|hiposs/i.test(blob)) {
    out.push({
      id: "sk_hif",
      category: "oxygen_hypoxia",
      pillLabelIt: "HIF / risposta ipossica",
      hintIt: "Dal knowledge packet: contesto ossigeno\u2013trascrizione (allenamento o altri segnali dichiarati).",
      source: "session_knowledge"
    });
  }
  if (/igf|igf-1|growth hormone|ormone della crescita|somatro/i.test(blob)) {
    out.push({
      id: "sk_igf",
      category: "endocrine_growth",
      pillLabelIt: "IGF-1 / GH (contesto)",
      hintIt: "Asse somatotropo legato a carico, sonno, nutrizione; interpretazione qualitativa.",
      source: "session_knowledge"
    });
  }
  if (/cortisol|cortisolo|hpa|glucorticoid/i.test(blob)) {
    out.push({
      id: "sk_hpa",
      category: "endocrine_stress",
      pillLabelIt: "HPA \xB7 glucocorticoidi",
      hintIt: "Stress neuroendocrino; bilanciare con recupero e energia disponibile.",
      source: "session_knowledge"
    });
  }
  if (/catecolamin|adrenalin|noradrenalin|noradrenal|epinefrin|simpatic/i.test(blob)) {
    out.push({
      id: "sk_cat",
      category: "neuro_adrenergic",
      pillLabelIt: "Catecolamine",
      hintIt: "Asse simpatico\u2013adrenergico su intensit\xE0 e durata.",
      source: "session_knowledge"
    });
  }
  if (/mtor|m-tor|sintesi proteic|ipertrof/i.test(blob)) {
    out.push({
      id: "sk_mtor",
      category: "repair_anabolic",
      pillLabelIt: "mTOR \xB7 sintesi proteica",
      hintIt: "Timing nutrizione\u2013allenamento per massimizzare segnale (non override clinico).",
      source: "session_knowledge"
    });
  }
  if (/gene|geni|transcript|hif1|ppargc1|pgc-1/i.test(blob)) {
    out.push({
      id: "sk_genes",
      category: "genetic_regulation",
      pillLabelIt: "Regolazione genica",
      hintIt: "Contesto da packet (pathway / geni citati); non \xE8 test genetico.",
      source: "session_knowledge"
    });
  }
  if (/microbiota|probiotic|probiot|veillonella|butirrato|butyrate|acetato|acetic|propion|scfa|fibra|fiber|lattato.*microb/i.test(blob)) {
    out.push({
      id: "sk_micro",
      category: "microbiota_gut",
      pillLabelIt: "Microbiota \xB7 assorbimento",
      hintIt: "Carichi glucidici intensi + fibre / fermentazione \u2192 modulatori (butirrato, acetato, propionato); contesto letteratura.",
      source: "session_knowledge"
    });
  }
  return out;
}
function facetsFromFamily(contract) {
  const out = [];
  if (contract.family === "strength") {
    out.push({
      id: "fam_strength_mech",
      category: "muscle_cellular",
      pillLabelIt: "Carico strutturale",
      hintIt: "Forza: tensione meccanica dominante rispetto al costo aerobico globale.",
      source: "session_family"
    });
  }
  if (contract.family === "aerobic") {
    out.push({
      id: "fam_aer_bio",
      category: "bioenergetics",
      pillLabelIt: "Dominante aerobio",
      hintIt: "Ossidazione e gestione substrato come asse centrale della sessione.",
      source: "session_family"
    });
  }
  return out;
}
function facetsFromLoadProxy(tss, durationMin) {
  const out = [];
  if (tss >= 75 && durationMin >= 50) {
    out.push({
      id: "load_gly",
      category: "glycolysis",
      pillLabelIt: "Carico glucidico elevato",
      hintIt: "Proxy da TSS/durata: probabile dipendenza da glicogeno e glicolisi per porzioni della sessione.",
      source: "load_proxy"
    });
  }
  if (tss >= 90) {
    out.push({
      id: "load_neuro",
      category: "neuro_adrenergic",
      pillLabelIt: "Stress neuro\u2013endocrino acuto",
      hintIt: "Alto TSS: picco simpatico e bisogno di recovery strutturato.",
      source: "load_proxy"
    });
    out.push({
      id: "load_hpa",
      category: "endocrine_stress",
      pillLabelIt: "Allostasi \xB7 HPA",
      hintIt: "Carico globale elevato: monitorare sonno, HRV e segnali di overreaching nelle 48\u201372h.",
      source: "load_proxy"
    });
  }
  if (tss >= 60 && durationMin >= 75) {
    out.push({
      id: "load_mito",
      category: "bioenergetics",
      pillLabelIt: "Volume ossidativo sostenuto",
      hintIt: "Durata + carico medio-alto: elevato fabbisogno mitocondriale e substrati.",
      source: "load_proxy"
    });
  }
  return out;
}
function isHighIntensityLabel(label) {
  const u = label.toUpperCase();
  return /\b(Z[4567]|LT1|LT2|VO2|VO₂|FTP|ANAEROBIC)\b/.test(u);
}
function facetsFromChartProfile(contract, segments) {
  const out = [];
  if (!segments.length) return out;
  const totalSec = segments.reduce((s, x) => s + x.durationSeconds, 0) || 1;
  let highSec = 0;
  let recoverySec = 0;
  for (const seg of segments) {
    if (isHighIntensityLabel(seg.intensityLabel)) highSec += seg.durationSeconds;
    if (/Z1|Z2|RECOVERY|RECUPERO|WARM|COOL|FatMax/i.test(seg.intensityLabel)) recoverySec += seg.durationSeconds;
  }
  const highFrac = highSec / totalSec;
  const recoveryFrac = recoverySec / totalSec;
  if (highFrac >= 0.12) {
    out.push({
      id: "chart_hypox",
      category: "oxygen_hypoxia",
      pillLabelIt: "Ipossia funzionale \xB7 blocchi",
      hintIt: `~${Math.round(highFrac * 100)}% del tempo sopra soglia: gradiente O\u2082 muscolo \u2194 mitocondri durante i lavori.`,
      source: "chart_profile"
    });
    out.push({
      id: "chart_neuro",
      category: "neuro_adrenergic",
      pillLabelIt: "Catecolamine \xB7 intervalli",
      hintIt: "Segmenti intensi: drive simpatico e reclutamento fibre veloci (modelo da profilo blocchi).",
      source: "chart_profile"
    });
  }
  if (highFrac >= 0.08 && recoveryFrac >= 0.2) {
    out.push({
      id: "chart_lactate_shuttle",
      category: "glycolysis",
      pillLabelIt: "Shuttle lattato \xB7 work:rest",
      hintIt: "Alternanza lavoro/recupero: produzione e riossidazione lattato come shuttle energetico.",
      source: "chart_profile"
    });
  }
  if (contract.family === "aerobic" && highFrac >= 0.05) {
    out.push({
      id: "chart_pgc1",
      category: "genetic_regulation",
      pillLabelIt: "Segnali adattivi \xB7 PGC-1\u03B1",
      hintIt: "Contesto allenamento aerobico strutturato: biogenesi mitocondriale e regolazione trascrizionale (non test genetico).",
      source: "chart_profile"
    });
  }
  if (highFrac >= 0.1 || (contract.summary?.tss ?? 0) >= 85) {
    out.push({
      id: "chart_mtor_timing",
      category: "repair_anabolic",
      pillLabelIt: "Recovery anabolico post-carico",
      hintIt: "Dopo blocchi intensi: finestra proteine + CHO per ripristino glicogeno e segnale mTOR (timing, non prescrizione).",
      source: "chart_profile"
    });
  }
  return out;
}
function buildCoachPrompts(input) {
  const prompts = [];
  const target = String(input.contract.adaptationTarget ?? "").trim();
  if (target === "lactate_tolerance" || target === "lactate_clearance") {
    prompts.push("RPE e potenza sui blocchi LT2: c\u2019\xE8 drift (>5%) rispetto al target pianificato?");
    prompts.push("CHO nelle 3h pre-seduta: adeguati al volume di lavoro sopra soglia?");
  }
  if (input.tss >= 85) {
    prompts.push("Sonno e HRV nelle 48h precedenti: compatibili con questo carico o conviene ridurre un blocco?");
  }
  if (input.highIntensityFrac >= 0.15) {
    prompts.push("Recupero tra i blocchi intensi: percezione di clearance lattato vs target Z1/Z2?");
  }
  if (input.contract.family === "aerobic" && input.durationMin >= 75) {
    prompts.push("Idratazione ed elettroliti: sufficienti per la durata e la frazione sopra soglia?");
  }
  if (!prompts.length && input.facets.length > 0) {
    prompts.push("Confronta percezione (RPE) vs target di zona sui blocchi principali.");
    prompts.push("Recovery nelle 24h post: sonno, energia e DOMS coerenti con lo stimolo pianificato?");
  }
  return prompts.slice(0, 4);
}
function buildFacilitationHints(input) {
  const hints = [];
  const cats = new Set(input.facets.map((f) => f.category));
  if (cats.has("glycolysis") || input.tss >= 70) {
    hints.push("\u2192 CHO pre/post e intra se sessione >75\u2032 o TSS elevato: supporto glicogeno e shuttle lattato.");
  }
  if (cats.has("oxygen_hypoxia") || cats.has("bioenergetics")) {
    hints.push("\u2192 Recovery attivo Z1\u2013Z2 tra blocchi (gi\xE0 in struttura): facilita riossidazione e clearance.");
  }
  if (cats.has("repair_anabolic")) {
    hints.push("\u2190 Proteine + CHO entro 2h post: modulatore timing mTOR / ripristino (Nutrizione \xB7 diario).");
  }
  if (cats.has("endocrine_stress") || input.tss >= 90) {
    hints.push("\u2190 Sonno, idratazione e giorno leggero successivo: modulatori HPA / allostasi.");
  }
  if (cats.has("microbiota_gut")) {
    hints.push("\u2190 Fibre fermentabili + variet\xE0 vegetale: modulatori SCFA / assorbimento (Health \xB7 Nutrizione).");
  }
  if (!hints.length && input.contract.family === "aerobic") {
    hints.push("\u2192 Idrosolubili + minerali su sessioni lunghe; verifica fueling plan in export JSON.");
  }
  return hints.slice(0, 4);
}
function sortFacets(facets) {
  const order = new Map(CATEGORY_ORDER.map((c, i) => [c, i]));
  return [...facets].sort((a, b) => {
    const da = order.get(a.category) ?? 99;
    const db = order.get(b.category) ?? 99;
    if (da !== db) return da - db;
    return a.pillLabelIt.localeCompare(b.pillLabelIt, "it");
  });
}
function buildSessionMultilevelAnalysisStrip(input) {
  const contract = input.contract;
  const raw = [];
  if (!contract) {
    return {
      modelVersion: 1,
      layer: "deterministic_session_facet_template",
      facets: [],
      stripSlots: buildStripSlotsFromFacets([]),
      notes: [
        "Nessun contract builder: collega una sessione generata dal builder per attivare le pillole di analisi multilivello."
      ],
      coachPrompts: [],
      facilitationHints: []
    };
  }
  const segments = contract.family !== "strength" ? pro2BuilderContractToExpandedChartSegments(contract) : [];
  let highIntensitySec = 0;
  const totalSegSec = segments.reduce((s, x) => s + x.durationSeconds, 0) || 1;
  for (const seg of segments) {
    if (isHighIntensityLabel(seg.intensityLabel)) highIntensitySec += seg.durationSeconds;
  }
  const highIntensityFrac = highIntensitySec / totalSegSec;
  const targetStr = String(contract.adaptationTarget ?? "").trim();
  if (targetStr && isAdaptationTarget(targetStr)) {
    for (const f of facetsFromAdaptationTarget(targetStr)) pushFacet(raw, f);
  } else if (targetStr) {
    const low = targetStr.toLowerCase();
    if (low.includes("vo2") || low.includes("aerobic") || low.includes("mitochond")) {
      for (const f of facetsFromAdaptationTarget("vo2_max_support")) pushFacet(raw, f);
    }
  }
  for (const f of facetsFromFamily(contract)) pushFacet(raw, f);
  const blob = knowledgeBlob(contract);
  for (const f of facetsFromKnowledgeBlob(blob)) pushFacet(raw, f);
  for (const f of facetsFromChartProfile(contract, segments)) pushFacet(raw, f);
  const summaryTss = contract.summary?.tss;
  const fallbackTss = input.fallbackTss ?? 0;
  const tss = Math.max(
    typeof summaryTss === "number" && Number.isFinite(summaryTss) && summaryTss > 0 ? summaryTss : 0,
    typeof fallbackTss === "number" && Number.isFinite(fallbackTss) && fallbackTss > 0 ? fallbackTss : 0
  );
  const durMin = contract.summary?.durationSec ? Math.max(1, Math.round(contract.summary.durationSec / 60)) : input.fallbackDurationMin ?? 0;
  for (const f of facetsFromLoadProxy(tss, durMin)) pushFacet(raw, f);
  const facets = sortFacets(raw);
  const coachPrompts = buildCoachPrompts({
    contract,
    tss,
    durationMin: durMin,
    facets,
    highIntensityFrac
  });
  const facilitationHints = buildFacilitationHints({ contract, tss, facets });
  return {
    modelVersion: 1,
    layer: "deterministic_session_facet_template",
    facets,
    stripSlots: buildStripSlotsFromFacets(facets),
    notes: [
      "Interpretazione strutturata da target adattativo, profilo blocchi, knowledge packet e proxy di carico \u2014 non diagnosi e non decisione clinica.",
      "Nutrizione, microbiota e genetica sono modulatori transversali: usa Nutrizione / Health per approfondire con evidenza e tracce ricerca."
    ],
    coachPrompts,
    facilitationHints
  };
}
var CATEGORY_LABELS, CATEGORY_ORDER, STRIP_SHORT_LABEL, SOURCE_RANK, ALL_ADAPTATION_TARGETS;
var init_session_multilevel_analysis_strip = __esm({
  "apps/web/lib/training/session-multilevel-analysis-strip.ts"() {
    "use strict";
    init_pro2_contract_chart_segments();
    CATEGORY_LABELS = {
      bioenergetics: "Bioenergetica \xB7 ossidazione",
      oxygen_hypoxia: "Ossigeno \xB7 HIF / ipossia funzionale",
      glycolysis: "Glicolisi \xB7 glucosio \xB7 lattato",
      muscle_cellular: "Muscolo \xB7 ambiente \xB7 tensione",
      neuro_adrenergic: "Neuro \xB7 catecolamine \xB7 drive",
      endocrine_stress: "Endocrino \xB7 stress \xB7 HPA",
      endocrine_growth: "Endocrino \xB7 crescita \xB7 IGF / GH",
      repair_anabolic: "Riparazione \xB7 anabolismo \xB7 mTOR (timing)",
      genetic_regulation: "Genetica \xB7 regolazione (contesto)",
      microbiota_gut: "Microbiota \xB7 intestino \xB7 fibre / SCFA"
    };
    CATEGORY_ORDER = [
      "bioenergetics",
      "oxygen_hypoxia",
      "glycolysis",
      "muscle_cellular",
      "neuro_adrenergic",
      "endocrine_stress",
      "endocrine_growth",
      "repair_anabolic",
      "genetic_regulation",
      "microbiota_gut"
    ];
    STRIP_SHORT_LABEL = {
      bioenergetics: "Bioenergetica",
      oxygen_hypoxia: "O\u2082 \xB7 HIF",
      glycolysis: "Glicolisi",
      muscle_cellular: "Muscolo",
      neuro_adrenergic: "Neuro \xB7 CA",
      endocrine_stress: "Stress \xB7 HPA",
      endocrine_growth: "Crescita \xB7 IGF",
      repair_anabolic: "Riparo \xB7 mTOR",
      genetic_regulation: "Genetica",
      microbiota_gut: "Microbiota"
    };
    SOURCE_RANK = {
      session_knowledge: 0,
      session_structure: 1,
      chart_profile: 2,
      session_family: 3,
      adaptation_target: 4,
      load_proxy: 5
    };
    ALL_ADAPTATION_TARGETS = [
      "mitochondrial_density",
      "vo2_max_support",
      "lactate_tolerance",
      "lactate_clearance",
      "max_strength",
      "hypertrophy_mixed",
      "hypertrophy_myofibrillar",
      "hypertrophy_sarcoplasmic",
      "neuromuscular_adaptation",
      "power_output",
      "movement_quality",
      "mobility_capacity",
      "skill_transfer",
      "recovery"
    ];
  }
});

// apps/web/lib/training/builder/pro2-session-interpretation.ts
var pro2_session_interpretation_exports = {};
__export(pro2_session_interpretation_exports, {
  ensurePro2BuilderSessionInterpretation: () => ensurePro2BuilderSessionInterpretation,
  preparePro2BuilderSessionContractForPersist: () => preparePro2BuilderSessionContractForPersist,
  viewModelFromSessionInterpretation: () => viewModelFromSessionInterpretation
});
function pathwayDirection(source) {
  return source === "load_proxy" || source === "session_knowledge" ? "reverse" : "forward";
}
function interpretationFromContract(contract, fallback) {
  const durMin = fallback?.durationMin ?? (contract.summary?.durationSec ? Math.max(1, Math.round(contract.summary.durationSec / 60)) : contract.plannedSessionDurationMinutes ?? 0);
  const tssFallback = fallback?.tss ?? contract.summary?.tss ?? 0;
  const vm = buildSessionMultilevelAnalysisStrip({
    contract,
    fallbackTss: tssFallback,
    fallbackDurationMin: durMin > 0 ? durMin : void 0
  });
  const sectors = vm.stripSlots.filter((s) => s.valueLineIt !== "\u2014").map((s) => {
    const pills = vm.facets.filter((f) => f.category === s.category).slice(0, 3).map((f) => ({
      id: f.id,
      text: f.pillLabelIt,
      direction: pathwayDirection(f.source)
    }));
    return {
      category: s.category,
      shortLabelIt: s.shortLabelIt,
      valueLineIt: s.valueLineIt,
      detailHintIt: s.detailHintIt,
      facetId: s.facetId,
      pathwayPills: pills.length > 0 ? pills : void 0
    };
  });
  return {
    modelVersion: 1,
    layer: "deterministic_session_facet_template",
    coachPrompts: vm.coachPrompts,
    facilitationHints: vm.facilitationHints,
    sectors,
    generatedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
}
function preparePro2BuilderSessionContractForPersist(contract, fallback) {
  return {
    ...contract,
    sessionInterpretation: interpretationFromContract(contract, fallback)
  };
}
function ensurePro2BuilderSessionInterpretation(contract, fallback) {
  if (contract.sessionInterpretation?.modelVersion === 1 && contract.sessionInterpretation.sectors.length > 0) {
    return contract;
  }
  return preparePro2BuilderSessionContractForPersist(contract, fallback);
}
function viewModelFromSessionInterpretation(interpretation) {
  const stripSlots = interpretation.sectors.map((s) => ({
    category: s.category,
    shortLabelIt: s.shortLabelIt,
    valueLineIt: s.valueLineIt,
    detailHintIt: s.detailHintIt,
    facetId: s.facetId
  }));
  return {
    modelVersion: 1,
    layer: "deterministic_session_facet_template",
    facets: [],
    stripSlots,
    notes: [
      "Snapshot interpretazione dal contratto (domande coach e settori al momento del salvataggio).",
      "Ricalcolo live se il contratto non include sessionInterpretation."
    ],
    coachPrompts: interpretation.coachPrompts,
    facilitationHints: interpretation.facilitationHints
  };
}
var init_pro2_session_interpretation = __esm({
  "apps/web/lib/training/builder/pro2-session-interpretation.ts"() {
    "use strict";
    init_session_multilevel_analysis_strip();
  }
});

// apps/web/lib/training/builder/pro2-session-contract.ts
function serializePro2BuilderSessionContract(contract) {
  const { preparePro2BuilderSessionContractForPersist: preparePro2BuilderSessionContractForPersist2 } = (init_pro2_session_interpretation(), __toCommonJS(pro2_session_interpretation_exports));
  const prepared = preparePro2BuilderSessionContractForPersist2(contract);
  return `${BUILDER_SESSION_JSON_TAG}${encodeURIComponent(JSON.stringify(prepared))}`;
}
var BUILDER_SESSION_JSON_TAG;
var init_pro2_session_contract = __esm({
  "apps/web/lib/training/builder/pro2-session-contract.ts"() {
    "use strict";
    BUILDER_SESSION_JSON_TAG = "BUILDER_SESSION_JSON::";
  }
});

// apps/web/lib/training/db-engine/publish-db-workouts.ts
init_pro2_session_contract();

// apps/web/lib/training/library/starter-pack-aerobic-helpers.ts
init_pro2_session_interpretation();
init_planned_session_metrics();
var DEFAULT_STARTER_RENDER = {
  intensityUnit: "watt",
  ftpW: 250,
  hrMax: 190,
  lengthMode: "time",
  speedRefKmh: 35
};
function defaultChart(minutes, intensity, extra) {
  return {
    minutes: Math.floor(minutes),
    seconds: Math.round(minutes % 1 * 60),
    intensity,
    startIntensity: extra?.startIntensity ?? intensity,
    endIntensity: extra?.endIntensity ?? intensity,
    intensity2: extra?.intensity2 ?? "Z1",
    intensity3: "Z5",
    repeats: extra?.repeats ?? 1,
    workSeconds: extra?.workSeconds ?? 180,
    recoverSeconds: extra?.recoverSeconds ?? 90,
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
function blockFromSpec(spec, index) {
  const isWarm = /riscaldamento|warm/i.test(spec.label);
  const isCool = /defaticamento|cool/i.test(spec.label);
  const primary = spec.intensityCue.split("/")[0]?.trim() || "Z2";
  const ftp = DEFAULT_STARTER_RENDER.ftpW;
  const chart = defaultChart(spec.durationMinutes, primary, {
    startIntensity: spec.startIntensity ?? (isWarm ? "Z1" : isCool ? "Z2" : primary),
    endIntensity: spec.endIntensity ?? (isWarm ? "Z2" : isCool ? "Z1" : primary),
    intensity2: spec.intensity2 ?? "Z1",
    repeats: spec.repeats ?? 1,
    workSeconds: spec.workSeconds ?? 180,
    recoverSeconds: spec.recoverSeconds ?? 90
  });
  if (spec.kind === "interval3") {
    chart.intensity2 = spec.intensity2 ?? "Z3";
    chart.intensity3 = spec.intensity3 ?? primary;
    chart.step1Seconds = spec.step1Seconds ?? 120;
    chart.step2Seconds = spec.step2Seconds ?? 60;
    chart.step3Seconds = spec.step3Seconds ?? 120;
    chart.repeats = spec.repeats ?? 1;
  }
  if (spec.kind === "pyramid") {
    chart.pyramidSteps = spec.pyramidSteps ?? 5;
    chart.pyramidStepSeconds = spec.pyramidStepSeconds ?? 180;
    chart.pyramidStartTarget = spec.pyramidStartTarget ?? Math.round(ftp * 0.72);
    chart.pyramidEndTarget = spec.pyramidEndTarget ?? Math.round(ftp * 1.06);
  }
  return {
    id: `sp-${index + 1}`,
    label: spec.label,
    kind: spec.kind,
    durationMinutes: spec.durationMinutes,
    intensityCue: spec.intensityCue,
    notes: spec.notes,
    chart
  };
}
function shell(warmMin, coolMin, main) {
  return [
    {
      label: "Riscaldamento",
      kind: "ramp",
      durationMinutes: warmMin,
      intensityCue: "Z1->Z2",
      startIntensity: "Z1",
      endIntensity: "Z2"
    },
    ...main,
    {
      label: "Defaticamento",
      kind: "ramp",
      durationMinutes: coolMin,
      intensityCue: "Z2->Z1",
      startIntensity: "Z2",
      endIntensity: "Z1"
    }
  ];
}
function st(label, durationMinutes, intensityCue, notes) {
  return { label, kind: "steady", durationMinutes, intensityCue, notes };
}
function iv(label, repeats, workSeconds, recoverSeconds, workZone, recoverZone, notes) {
  const durationMinutes = Math.max(1, Math.ceil(repeats * (workSeconds + recoverSeconds) / 60));
  return {
    label,
    kind: "interval2",
    durationMinutes,
    intensityCue: `${workZone}/${recoverZone}`,
    intensity2: recoverZone,
    repeats,
    workSeconds,
    recoverSeconds,
    notes
  };
}
function i3(label, repeats, step1Seconds, step2Seconds, step3Seconds, zoneA, zoneB, zoneC, notes) {
  const durationMinutes = Math.max(1, Math.ceil(repeats * (step1Seconds + step2Seconds + step3Seconds) / 60));
  return {
    label,
    kind: "interval3",
    durationMinutes,
    intensityCue: `${zoneA}/${zoneB}/${zoneC}`,
    intensity2: zoneB,
    intensity3: zoneC,
    repeats,
    step1Seconds,
    step2Seconds,
    step3Seconds,
    notes
  };
}
function py(label, steps, stepSeconds, startTargetW, endTargetW, notes) {
  const durationMinutes = Math.max(1, Math.ceil(steps * stepSeconds / 60));
  return {
    label,
    kind: "pyramid",
    durationMinutes,
    intensityCue: "Z2\u2192Z5\u2192Z2",
    pyramidSteps: steps,
    pyramidStepSeconds: stepSeconds,
    pyramidStartTarget: startTargetW,
    pyramidEndTarget: endTargetW,
    notes
  };
}
function rm(label, durationMinutes, startZone, endZone, notes) {
  return {
    label,
    kind: "ramp",
    durationMinutes,
    intensityCue: `${startZone}\u2192${endZone}`,
    startIntensity: startZone,
    endIntensity: endZone,
    notes
  };
}
function rec(durationMinutes, zone = "Z1", notes) {
  return {
    label: `Recupero profondo \xB7 ${durationMinutes}\u2032`,
    kind: "steady",
    durationMinutes,
    intensityCue: zone,
    notes: notes ?? "Recupero generoso tra blocchi di lavoro"
  };
}
function preset(presetId, discipline, title, description, adaptationTarget, phase, tags, plannedMinutes, tss, main, shellOpts) {
  const warm = shellOpts?.warm ?? (plannedMinutes >= 100 ? 15 : 12);
  const cool = shellOpts?.cool ?? (plannedMinutes >= 100 ? 12 : 10);
  return {
    presetId,
    title,
    description,
    discipline,
    adaptationTarget,
    phase,
    tags,
    plannedMinutes,
    tss,
    viryaWeekObjective: shellOpts?.viryaWeekObjective,
    blocks: shell(warm, cool, main)
  };
}
function presetForDisciplines(baseId, disciplines, build) {
  return disciplines.map(({ discipline, slug, durationScale, tssScale }) => {
    const base = build(discipline, durationScale, tssScale);
    const plannedMinutes = Math.max(25, Math.round(base.plannedMinutes * durationScale));
    const tss = Math.max(15, Math.round(base.tss * tssScale));
    const warm = plannedMinutes >= 100 ? 15 : 12;
    const cool = plannedMinutes >= 100 ? 12 : 10;
    return {
      ...base,
      presetId: `${slug}_${baseId}`,
      discipline,
      plannedMinutes,
      tss,
      blocks: shell(warm, cool, base.blocks)
    };
  });
}
var DISCIPLINE_SCALES = {
  cycling: { discipline: "Cycling", slug: "cyc", durationScale: 1, tssScale: 1 },
  running: { discipline: "Running", slug: "run", durationScale: 0.82, tssScale: 0.88 },
  swimming: { discipline: "Swimming", slug: "swm", durationScale: 0.62, tssScale: 0.72 },
  canoe: { discipline: "Canoe", slug: "can", durationScale: 0.88, tssScale: 0.9 },
  xcSki: { discipline: "XC Ski", slug: "xcs", durationScale: 0.9, tssScale: 0.92 },
  trailRunning: { discipline: "Trail Running", slug: "trl", durationScale: 0.85, tssScale: 0.86 }
};
var ALL_DISCIPLINES = [
  DISCIPLINE_SCALES.cycling,
  DISCIPLINE_SCALES.running,
  DISCIPLINE_SCALES.swimming,
  DISCIPLINE_SCALES.canoe,
  DISCIPLINE_SCALES.xcSki,
  DISCIPLINE_SCALES.trailRunning
];
function buildStarterContractFromPreset(preset2) {
  const durationSec = Math.max(60, preset2.plannedMinutes * 60);
  const avgPowerW = Math.max(80, Math.round(preset2.tss * 1e3 / Math.max(durationSec / 3600, 0.25) / 36));
  const blocks = preset2.blocks.map((b, i) => blockFromSpec(b, i));
  const draft = {
    version: 1,
    source: "builder",
    family: "aerobic",
    discipline: preset2.discipline,
    sessionName: preset2.title,
    adaptationTarget: preset2.adaptationTarget,
    phase: preset2.phase,
    plannedSessionDurationMinutes: preset2.plannedMinutes,
    summary: {
      durationSec,
      tss: preset2.tss,
      kcal: 0,
      kj: 0,
      avgPowerW
    },
    renderProfile: DEFAULT_STARTER_RENDER,
    blocks
  };
  const metrics = resolvePlannedSessionMetrics({
    contract: draft,
    durationMinutesDb: preset2.plannedMinutes,
    tssTargetDb: preset2.tss,
    athleteFtpWatts: DEFAULT_STARTER_RENDER.ftpW
  });
  return preparePro2BuilderSessionContractForPersist({
    ...draft,
    summary: {
      durationSec,
      tss: metrics.tss > 0 ? metrics.tss : preset2.tss,
      kcal: metrics.kcal,
      kj: metrics.kj,
      avgPowerW: metrics.avgPowerW ?? avgPowerW
    }
  });
}

// apps/web/lib/training/planned/insert-planned-workout.ts
init_pro2_session_contract();

// apps/web/lib/training/builder/session-duration-choices.ts
var PLANNED_SESSION_DURATION_MAX_MIN = 720;
var FINE_STEP_MIN = 5;
var FINE_END_MIN = 120;
var COARSE_STEP_MIN = 15;
var COARSE_START_MIN = 135;
function buildChoices() {
  const fine = [];
  for (let m = 30; m <= FINE_END_MIN; m += FINE_STEP_MIN) fine.push(m);
  const coarse = [];
  for (let m = COARSE_START_MIN; m <= PLANNED_SESSION_DURATION_MAX_MIN; m += COARSE_STEP_MIN) {
    coarse.push(m);
  }
  if (coarse[coarse.length - 1] !== PLANNED_SESSION_DURATION_MAX_MIN) {
    coarse.push(PLANNED_SESSION_DURATION_MAX_MIN);
  }
  return [...fine, ...coarse];
}
var SESSION_DURATION_CHOICES = buildChoices();

// apps/web/lib/training/planned/clamp-planned-row.ts
function clampPlannedWorkoutRow(row) {
  const type = row.type.trim().slice(0, 120) || "pro2_builder";
  const duration = Math.max(1, Math.min(PLANNED_SESSION_DURATION_MAX_MIN, Math.round(Number(row.duration_minutes) || 0)));
  const tss = Math.max(0, Math.min(999, Math.round(Number(row.tss_target) || 0)));
  let kcal = null;
  if (row.kcal_target != null && Number.isFinite(Number(row.kcal_target))) {
    kcal = Math.max(0, Math.min(2e4, Math.round(Number(row.kcal_target))));
  }
  let kj = null;
  if (row.kj_target != null && Number.isFinite(Number(row.kj_target))) {
    kj = Math.max(0, Math.min(5e4, Math.round(Number(row.kj_target))));
  }
  const planId = typeof row.plan_id === "string" && row.plan_id.trim() ? row.plan_id.trim() : null;
  return {
    athlete_id: row.athlete_id.trim(),
    date: row.date.trim().slice(0, 10),
    type,
    duration_minutes: duration,
    tss_target: tss,
    kcal_target: kcal,
    kj_target: kj,
    plan_id: planId,
    notes: row.notes && row.notes.trim() ? row.notes.trim().slice(0, 32e3) : null
  };
}

// apps/web/lib/training/planned/planned-workout-dedupe-fingerprint.ts
init_pro2_session_contract();

// apps/web/lib/training/virya/virya-planned-notes.ts
var VIRYA_NOTES_ILIKE_MARKER = "%\\[VIRYA:%";

// apps/web/lib/training/planned/planned-workout-dedupe-fingerprint.ts
function plannedWorkoutDedupeFingerprint(row) {
  const notes = row.notes ?? "";
  const importMatch = notes.match(/\[EMPATHY_IMPORT:checksum=([a-f0-9]+)\]/i);
  if (importMatch) return `import:${importMatch[1].toLowerCase()}`;
  const importSha1Match = notes.match(/import_sha1=([a-f0-9]+)/i);
  if (importSha1Match) return `import_sha1:${importSha1Match[1].toLowerCase()}`;
  const idx = notes.indexOf(BUILDER_SESSION_JSON_TAG);
  if (idx >= 0) {
    const payload = notes.slice(idx + BUILDER_SESSION_JSON_TAG.length).split(/\s*\|\s*/)[0]?.trim();
    if (payload) return `builder:${payload}`;
  }
  const kcal = row.kcal_target ?? 0;
  return `ops:${row.type.trim()}|${row.duration_minutes}|${row.tss_target}|${kcal}`;
}
function isPro2BuilderPlannedNotes(notes) {
  const t = notes ?? "";
  return t.includes("[PRO2_BUILDER") || t.includes(BUILDER_SESSION_JSON_TAG);
}
function isPro2BuilderPlannedRow(row) {
  if (isPro2BuilderPlannedNotes(row.notes)) return true;
  return String(row.type ?? "").trim().toLowerCase().startsWith("pro2_builder");
}

// apps/web/lib/training/planned/insert-planned-workout.ts
function toPlannedWorkoutInsertRecord(row) {
  const clamped = clampPlannedWorkoutRow(row);
  const payload = {
    athlete_id: clamped.athlete_id,
    date: clamped.date,
    type: clamped.type,
    duration_minutes: clamped.duration_minutes,
    tss_target: clamped.tss_target,
    kcal_target: clamped.kcal_target,
    notes: clamped.notes
  };
  if (clamped.kj_target != null) payload.kj_target = clamped.kj_target;
  if (clamped.plan_id) payload.plan_id = clamped.plan_id;
  return payload;
}
async function findExistingPlannedWorkoutByFingerprint(db, row) {
  const clamped = clampPlannedWorkoutRow(row);
  const targetFp = plannedWorkoutDedupeFingerprint(clamped);
  const { data, error } = await db.from("planned_workouts").select("id,type,duration_minutes,tss_target,kcal_target,notes").eq("athlete_id", clamped.athlete_id).eq("date", clamped.date);
  if (error) throw new Error(error.message);
  for (const existing of data ?? []) {
    const rec2 = existing;
    if (typeof rec2.id !== "string") continue;
    const fp = plannedWorkoutDedupeFingerprint({
      type: String(rec2.type ?? ""),
      duration_minutes: Number(rec2.duration_minutes ?? 0),
      tss_target: Number(rec2.tss_target ?? 0),
      kcal_target: rec2.kcal_target ?? null,
      notes: rec2.notes ?? null
    });
    if (fp === targetFp) return rec2.id;
  }
  return null;
}
async function replaceBuilderPlannedSameTypeOnDay(db, row) {
  const clamped = clampPlannedWorkoutRow(row);
  if (!isPro2BuilderPlannedRow(clamped)) return 0;
  const { data, error } = await db.from("planned_workouts").delete().eq("athlete_id", clamped.athlete_id).eq("date", clamped.date).eq("type", clamped.type).ilike("notes", `%${BUILDER_SESSION_JSON_TAG}%`).select("id");
  if (error) throw new Error(error.message);
  return data?.length ?? 0;
}
async function insertSinglePlannedWorkout(db, row) {
  const clamped = clampPlannedWorkoutRow(row);
  const existingId = await findExistingPlannedWorkoutByFingerprint(db, clamped);
  if (existingId) {
    return { id: existingId, dedupeSkipped: true };
  }
  let replacedSameTypeCount = 0;
  if (isPro2BuilderPlannedRow(clamped)) {
    replacedSameTypeCount = await replaceBuilderPlannedSameTypeOnDay(db, clamped);
  }
  const payload = toPlannedWorkoutInsertRecord(clamped);
  const { data, error } = await db.from("planned_workouts").insert(payload).select("id").maybeSingle();
  if (error) throw new Error(error.message);
  const id = data && typeof data.id === "string" ? data.id : null;
  return { id, replacedSameTypeCount: replacedSameTypeCount > 0 ? replacedSameTypeCount : void 0 };
}
async function insertPlannedWorkoutRows(db, rows) {
  const ids = [];
  let dedupeSkippedCount = 0;
  let replacedSameTypeCount = 0;
  for (const row of rows) {
    const result = await insertSinglePlannedWorkout(db, row);
    if (result.id) ids.push(result.id);
    if (result.dedupeSkipped) dedupeSkippedCount += 1;
    if (result.replacedSameTypeCount) replacedSameTypeCount += result.replacedSameTypeCount;
  }
  return { ids, dedupeSkippedCount, replacedSameTypeCount };
}

// apps/web/lib/training/db-engine/publish-db-workouts.ts
var DB_ENGINE_NOTES_TAG = "[EMPATHY_DB_ENGINE";
function asFiniteNumber(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}
function asTrimmedString(value) {
  if (typeof value !== "string") return null;
  const t = value.trim();
  return t ? t : null;
}
async function readDbEngineWorkouts(db, workoutIds) {
  const ids = [...new Set(workoutIds.map((id) => String(id).trim()).filter(Boolean))];
  if (ids.length === 0) return [];
  const { data: workoutRows, error: workoutErr } = await db.from("workout").select(
    "id,athlete_id,date,discipline,family,session_role,adaptation_target,phase,session_name,preset_id,duration_minutes,tss_target,kcal_target,plan_id"
  ).in("id", ids).order("date", { ascending: true });
  if (workoutErr) throw new Error(`Lettura workout fallita: ${workoutErr.message}`);
  const { data: blockRows, error: blockErr } = await db.from("workout_block").select("id,workout_id,block_order,label,kind,duration_minutes,intensity_cue,params").in("workout_id", ids).order("block_order", { ascending: true });
  if (blockErr) throw new Error(`Lettura workout_block fallita: ${blockErr.message}`);
  const blockIds = (blockRows ?? []).map((b) => String(b.id ?? "")).filter(Boolean);
  let wbeRows = [];
  const exerciseNameById = /* @__PURE__ */ new Map();
  if (blockIds.length > 0) {
    const { data, error } = await db.from("workout_block_exercise").select("block_id,exercise_id,exercise_order,sets,reps,load_hint").in("block_id", blockIds).order("exercise_order", { ascending: true });
    if (error) throw new Error(`Lettura workout_block_exercise fallita: ${error.message}`);
    wbeRows = data ?? [];
    const exerciseIds = [...new Set(wbeRows.map((r) => String(r.exercise_id)))];
    if (exerciseIds.length > 0) {
      const { data: exRows, error: exErr } = await db.from("exercise").select("id,name").in("id", exerciseIds);
      if (exErr) throw new Error(`Lettura exercise fallita: ${exErr.message}`);
      for (const ex of exRows ?? []) {
        exerciseNameById.set(String(ex.id), String(ex.name ?? "").trim() || String(ex.id));
      }
    }
  }
  const exercisesByBlockId = /* @__PURE__ */ new Map();
  for (const r of wbeRows) {
    const list = exercisesByBlockId.get(String(r.block_id)) ?? [];
    list.push({
      exercise_order: Math.round(asFiniteNumber(r.exercise_order) ?? 0),
      exercise_name: exerciseNameById.get(String(r.exercise_id)) ?? String(r.exercise_id),
      sets: asFiniteNumber(r.sets),
      reps: asTrimmedString(r.reps),
      load_hint: asTrimmedString(r.load_hint)
    });
    exercisesByBlockId.set(String(r.block_id), list);
  }
  const blocksByWorkoutId = /* @__PURE__ */ new Map();
  for (const raw of blockRows ?? []) {
    const b = raw;
    const blockId = String(b.id ?? "");
    const workoutId = String(b.workout_id ?? "");
    const list = blocksByWorkoutId.get(workoutId) ?? [];
    list.push({
      id: blockId,
      workout_id: workoutId,
      block_order: Math.round(asFiniteNumber(b.block_order) ?? list.length),
      label: asTrimmedString(b.label),
      kind: String(b.kind ?? "").trim() || "free",
      duration_minutes: Math.max(0, asFiniteNumber(b.duration_minutes) ?? 0),
      intensity_cue: asTrimmedString(b.intensity_cue),
      params: b.params && typeof b.params === "object" && !Array.isArray(b.params) ? b.params : {},
      exercises: exercisesByBlockId.get(blockId) ?? []
    });
    blocksByWorkoutId.set(workoutId, list);
  }
  return (workoutRows ?? []).map((raw) => {
    const w = raw;
    const workout = {
      id: String(w.id ?? ""),
      athlete_id: String(w.athlete_id ?? ""),
      date: String(w.date ?? "").slice(0, 10),
      discipline: asTrimmedString(w.discipline),
      family: String(w.family ?? "").trim() || "aerobic",
      session_role: asTrimmedString(w.session_role),
      adaptation_target: asTrimmedString(w.adaptation_target),
      phase: asTrimmedString(w.phase),
      session_name: asTrimmedString(w.session_name),
      preset_id: asTrimmedString(w.preset_id),
      duration_minutes: asFiniteNumber(w.duration_minutes),
      tss_target: asFiniteNumber(w.tss_target),
      kcal_target: asFiniteNumber(w.kcal_target),
      plan_id: asTrimmedString(w.plan_id)
    };
    const blocks = (blocksByWorkoutId.get(workout.id) ?? []).sort((a, b2) => a.block_order - b2.block_order);
    return { workout, blocks };
  });
}
function plannedTypeForDbWorkout(workout) {
  if (workout.family === "aerobic") return (workout.discipline ?? "cycling").toLowerCase();
  if (workout.family === "strength") return "gym";
  return workout.family;
}
var AEROBIC_CONTRACT_KINDS = ["steady", "ramp", "interval2", "interval3", "pyramid"];
function isAerobicContractKind(kind) {
  return AEROBIC_CONTRACT_KINDS.includes(kind);
}
function specFromDbBlock(block, index) {
  if (!isAerobicContractKind(block.kind)) return null;
  const p = block.params;
  return {
    label: block.label ?? `Blocco ${index + 1}`,
    kind: block.kind,
    durationMinutes: Math.max(1, Math.round(block.duration_minutes || 1)),
    intensityCue: block.intensity_cue ?? "Z2",
    startIntensity: asTrimmedString(p.startIntensity) ?? void 0,
    endIntensity: asTrimmedString(p.endIntensity) ?? void 0,
    intensity2: asTrimmedString(p.intensity2) ?? void 0,
    intensity3: asTrimmedString(p.intensity3) ?? void 0,
    repeats: asFiniteNumber(p.repeats) ?? void 0,
    workSeconds: asFiniteNumber(p.workSeconds) ?? void 0,
    recoverSeconds: asFiniteNumber(p.recoverSeconds) ?? void 0,
    step1Seconds: asFiniteNumber(p.step1Seconds) ?? void 0,
    step2Seconds: asFiniteNumber(p.step2Seconds) ?? void 0,
    step3Seconds: asFiniteNumber(p.step3Seconds) ?? void 0,
    pyramidSteps: asFiniteNumber(p.pyramidSteps) ?? void 0,
    pyramidStepSeconds: asFiniteNumber(p.pyramidStepSeconds) ?? void 0,
    pyramidStartTarget: asFiniteNumber(p.pyramidStartTarget) ?? void 0,
    pyramidEndTarget: asFiniteNumber(p.pyramidEndTarget) ?? void 0,
    notes: asTrimmedString(p.notes) ?? void 0
  };
}
function displayDiscipline(discipline) {
  const d = (discipline ?? "cycling").trim() || "cycling";
  return d.charAt(0).toUpperCase() + d.slice(1);
}
function tryBuildDbAerobicContract(detail) {
  const { workout, blocks } = detail;
  if (workout.family !== "aerobic" || blocks.length === 0) return null;
  const specs = [];
  for (const [index, block] of blocks.entries()) {
    const spec = specFromDbBlock(block, index);
    if (!spec) return null;
    specs.push(spec);
  }
  const minutesFromBlocks = specs.reduce((sum, s) => sum + s.durationMinutes, 0);
  const plannedMinutes = Math.max(1, Math.round(workout.duration_minutes ?? minutesFromBlocks));
  const preset2 = {
    presetId: workout.preset_id ?? `db_engine_${workout.id}`,
    title: workout.session_name ?? "Seduta motore DB",
    description: "Seduta generata dal motore allenamenti Postgres (bridge calendario).",
    discipline: displayDiscipline(workout.discipline),
    adaptationTarget: workout.adaptation_target ?? "",
    phase: workout.phase ?? "base",
    tags: [],
    plannedMinutes,
    tss: Math.max(0, Math.round(workout.tss_target ?? 0)),
    blocks: specs
  };
  try {
    return buildStarterContractFromPreset(preset2);
  } catch {
    return null;
  }
}
function descriptiveNotesLines(detail) {
  const { workout, blocks } = detail;
  const title = workout.session_name ?? `Seduta ${workout.family}`;
  const lines = [
    `${DB_ENGINE_NOTES_TAG} workout=${workout.id}] ${title} \xB7 ${workout.phase ?? "base"}/${workout.session_role ?? workout.family}`
  ];
  for (const block of blocks) {
    const minutes = Math.max(1, Math.round(block.duration_minutes || 1));
    const cue = block.intensity_cue ? ` ${block.intensity_cue}` : "";
    lines.push(`\u2014 ${block.label ?? "Blocco"} ${block.kind} ${minutes}\u2032${cue}`);
    for (const ex of block.exercises) {
      const setsReps = ex.sets != null && ex.reps ? ` ${ex.sets}x${ex.reps}` : ex.sets != null ? ` ${ex.sets} serie` : "";
      const load = ex.load_hint ? ` (${ex.load_hint})` : "";
      lines.push(`\xB7 ${ex.exercise_name}${setsReps}${load}`);
    }
  }
  return lines;
}
function mapDbWorkoutToPlannedRow(detail) {
  const { workout, blocks } = detail;
  const contract = tryBuildDbAerobicContract(detail);
  const lines = descriptiveNotesLines(detail);
  if (contract) lines.unshift(serializePro2BuilderSessionContract(contract));
  const minutesFromBlocks = blocks.reduce((sum, b) => sum + (Number(b.duration_minutes) || 0), 0);
  const durationMinutes = Math.max(1, Math.round(workout.duration_minutes ?? (minutesFromBlocks || 30)));
  return {
    row: {
      athlete_id: workout.athlete_id,
      date: workout.date,
      type: plannedTypeForDbWorkout(workout),
      duration_minutes: durationMinutes,
      tss_target: Math.max(0, Math.round(workout.tss_target ?? 0)),
      kcal_target: workout.kcal_target != null ? Math.round(workout.kcal_target) : null,
      notes: lines.join("\n")
    },
    hasBuilderContract: contract != null
  };
}
async function publishDbWorkoutsToCalendar(db, details, opts) {
  const mappings = details.map((detail) => mapDbWorkoutToPlannedRow(detail));
  const planId = opts?.planId?.trim() || null;
  const rows = mappings.map((m) => planId ? { ...m.row, plan_id: planId } : m.row);
  const { ids, dedupeSkippedCount, replacedSameTypeCount } = await insertPlannedWorkoutRows(db, rows);
  return {
    publishedIds: ids,
    insertedCount: Math.max(0, ids.length - dedupeSkippedCount),
    dedupeSkippedCount,
    replacedSameTypeCount,
    builderContractCount: mappings.filter((m) => m.hasBuilderContract).length
  };
}

// apps/web/lib/training/generate-training-week-headless.ts
function extractWorkoutIds(data) {
  if (!Array.isArray(data)) return [];
  const out = [];
  for (const el of data) {
    if (typeof el === "string") {
      out.push(el);
    } else if (el && typeof el === "object") {
      const v = el.generate_training_week ?? Object.values(el)[0];
      if (typeof v === "string") out.push(v);
    }
  }
  return out.filter(Boolean);
}

// apps/web/lib/training/l2/athlete-render-profile.ts
init_resolve_athlete_ftp_watts();
var DEFAULT_RENDER = {
  intensityUnit: "watt",
  ftpW: 250,
  hrMax: 185,
  lengthMode: "time",
  speedRefKmh: 32
};
var WEEK_PLAN_DAY_KEYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
function asRecord(v) {
  return v && typeof v === "object" && !Array.isArray(v) ? v : null;
}
function asNum(v) {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return null;
}
function normalizeHhMm(value) {
  if (typeof value !== "string") return null;
  const m = /^\d{1,2}:\d{2}/.exec(value.trim());
  return m ? m[0] : null;
}
function isUsableHrMax(value) {
  return value != null && value >= 100 && value <= 240;
}
function availabilityFromRoutineConfig(routineConfig) {
  const rc = asRecord(routineConfig);
  const weekPlan = asRecord(rc?.week_plan);
  const rootTime = normalizeHhMm(asRecord(rc?.training_1)?.start_time);
  const availableDays = [];
  const preferredTimeByOffset = {};
  if (weekPlan) {
    WEEK_PLAN_DAY_KEYS.forEach((key, offset) => {
      const day = asRecord(weekPlan[key]);
      if (!day) return;
      if (String(day.has_training ?? true) === "true") availableDays.push(offset);
      const t = normalizeHhMm(day.training1_start_time) ?? rootTime;
      if (t) preferredTimeByOffset[offset] = t;
    });
  } else if (rootTime) {
    for (let offset = 0; offset < 7; offset += 1) preferredTimeByOffset[offset] = rootTime;
  }
  return { availableDays, preferredTimeByOffset };
}
async function loadAthleteRenderProfile(client, athleteId) {
  const [physRes, athleteRes] = await Promise.all([
    // physiological_profiles è versionata (valid_from/valid_to): si prende la più recente.
    client.from("physiological_profiles").select("ftp_watts, lt1_watts, lt1_heart_rate, lt2_watts, lt2_heart_rate, updated_at").eq("athlete_id", athleteId).order("updated_at", { ascending: false }).limit(1),
    client.from("athlete_profiles").select("max_hr_bpm, training_max_session_minutes, routine_config").eq("id", athleteId).maybeSingle()
  ]);
  if (physRes.error) throw new Error(`physiological_profiles: ${physRes.error.message}`);
  if (athleteRes.error) throw new Error(`athlete_profiles: ${athleteRes.error.message}`);
  const phys = (physRes.data ?? [])[0] ?? null;
  const athlete = athleteRes.data ?? null;
  const ftpMeasured = asNum(phys?.ftp_watts);
  const ftpUsable = isUsableAthleteFtpWatts(ftpMeasured ?? void 0);
  const hrMax = asNum(athlete?.max_hr_bpm);
  const maxSessionRaw = asNum(athlete?.training_max_session_minutes);
  const maxSessionMinutes = maxSessionRaw != null && maxSessionRaw >= 20 && maxSessionRaw <= 480 ? Math.round(maxSessionRaw) : null;
  const { availableDays, preferredTimeByOffset } = availabilityFromRoutineConfig(
    athlete?.routine_config
  );
  return {
    athleteId,
    renderProfile: {
      ...DEFAULT_RENDER,
      ftpW: ftpUsable ? Math.round(ftpMeasured) : DEFAULT_RENDER.ftpW,
      hrMax: isUsableHrMax(hrMax) ? Math.round(hrMax) : DEFAULT_RENDER.hrMax
    },
    ftpSource: ftpUsable ? "measured" : "fallback",
    lt1W: asNum(phys?.lt1_watts),
    lt2W: asNum(phys?.lt2_watts),
    lt1Hr: asNum(phys?.lt1_heart_rate),
    lt2Hr: asNum(phys?.lt2_heart_rate),
    maxSessionMinutes,
    availableDays,
    preferredTimeByOffset
  };
}

// apps/web/lib/training/builder/generated-image-manifest.ts
var GENERATED_EXERCISE_IMAGE_MANIFEST = {
  "empathy-b1-backsquat": "empathy-b1-backsquat-v2.png",
  "empathy-b1-deadlift": "empathy-b1-deadlift-v2.png",
  "empathy-b1-bench": "empathy-b1-bench-v2.png",
  "empathy-b1-ohpress": "empathy-b1-ohpress-v2.png",
  "empathy-b1-latpulldown": "empathy-b1-latpulldown-v2.png",
  "empathy-b1-rowerg": "empathy-b1-rowerg-v2.png",
  "empathy-b1-skierg": "empathy-b1-skierg-v2.png",
  "empathy-b1-thruster": "empathy-b1-thruster-v2.png",
  "empathy-b1-wallball": "empathy-b1-wallball-v2.png",
  "empathy-b1-kbswing": "empathy-b1-kbswing-v2.png",
  "empathy-b1-ttb": "empathy-b1-ttb-v2.png",
  "empathy-b1-burpee": "empathy-b1-burpee-v2.png",
  "empathy-b1-sledpush": "empathy-b1-sledpush-v2.png",
  "empathy-b1-farmer": "empathy-b1-farmer-v2.png",
  "empathy-b1-plank": "empathy-b1-plank-v2.png",
  "empathy-b1-intervalrun": "empathy-b1-intervalrun-v2.png",
  "empathy-b1-cablefly": "empathy-b1-cablefly-v2.png",
  "empathy-b1-inclinedbpress": "empathy-b1-inclinedbpress-v2.png",
  "empathy-b1-machinechestpress": "empathy-b1-machinechestpress-v2.png",
  "empathy-b1-weighteddip": "empathy-b1-weighteddip-v2.png",
  "empathy-b1-lateralraise": "empathy-b1-lateralraise-v2.png",
  "empathy-b1-pause-squat": "empathy-b1-pause-squat-v2.png",
  "empathy-b1-rdl": "empathy-b1-rdl-v2.png",
  "empathy-b1-legpress": "empathy-b1-legpress-v2.png",
  "empathy-b1-wlunge": "empathy-b1-wlunge-v2.png",
  "empathy-b1x-hacksquat": "empathy-b1x-hacksquat-v2.png",
  "empathy-b1x-beltsquat": "empathy-b1x-beltsquat-v2.png",
  "empathy-b1x-pendulumsquat": "empathy-b1x-pendulumsquat-v2.png",
  "empathy-b1x-smithsquat": "empathy-b1x-smithsquat-v2.png",
  "empathy-b1x-landminesquat": "empathy-b1x-landminesquat-v2.png",
  "empathy-b1x-trapbardeadlift": "empathy-b1x-trapbardeadlift-v2.png",
  "empathy-b1x-reverselunge": "empathy-b1x-reverselunge-v2.png",
  "empathy-b1x-heelselevatedsquat": "empathy-b1x-heelselevatedsquat-v2.png",
  "empathy-b1x-zerchersquat": "empathy-b1x-zerchersquat-v2.png",
  "empathy-b1x-safetybarsquat": "empathy-b1x-safetybarsquat-v2.png",
  "empathy-b1x-laterallunge": "empathy-b1x-laterallunge-v2.png",
  "empathy-b1x-cossacksquat": "empathy-b1x-cossacksquat-v2.png",
  "empathy-b1x-stepdown": "empathy-b1x-stepdown-v2.png",
  "empathy-b1x-pistolsquat": "empathy-b1x-pistolsquat-v2.png",
  "empathy-b1x-spanishsquat": "empathy-b1x-spanishsquat-v2.png",
  "empathy-b1x-cyclistsquat": "empathy-b1x-cyclistsquat-v2.png",
  "empathy-b1x-deficitdeadlift": "empathy-b1x-deficitdeadlift-v2.png",
  "empathy-b1x-sumodeadlift": "empathy-b1x-sumodeadlift-v2.png",
  "empathy-b1x-stifflegdeadlift": "empathy-b1x-stifflegdeadlift-v2.png",
  "empathy-b1x-nordiccurl": "empathy-b1x-nordiccurl-v2.png",
  "empathy-b1x-glutehamraise": "empathy-b1x-glutehamraise-v2.png",
  "empathy-b1x-seatedlegcurl": "empathy-b1x-seatedlegcurl-v2.png",
  "empathy-b1x-singlelegpress": "empathy-b1x-singlelegpress-v2.png",
  "empathy-b1x-singlelegextension": "empathy-b1x-singlelegextension-v2.png",
  "empathy-b1x-cablepullthrough": "empathy-b1x-cablepullthrough-v2.png",
  "empathy-b1x-frogpump": "empathy-b1x-frogpump-v2.png",
  "empathy-b1x-donkeycalfraise": "empathy-b1x-donkeycalfraise-v2.png",
  "empathy-b1x-tibialisraise": "empathy-b1x-tibialisraise-v2.png",
  "empathy-b1x-smithsplitsquat": "empathy-b1x-smithsplitsquat-v2.png",
  "empathy-b1x-frontfootelevatedsplit": "empathy-b1x-frontfootelevatedsplit-v2.png",
  "empathy-b1x-inclinebarbellpress": "empathy-b1x-inclinebarbellpress-v2.png",
  "empathy-b1x-declinebenchpress": "empathy-b1x-declinebenchpress-v2.png",
  "empathy-b1x-dumbbellbenchpress": "empathy-b1x-dumbbellbenchpress-v2.png",
  "empathy-b1x-dumbbellshoulderpress": "empathy-b1x-dumbbellshoulderpress-v2.png",
  "empathy-b1x-arnoldpress": "empathy-b1x-arnoldpress-v2.png",
  "empathy-b1x-landminepress": "empathy-b1x-landminepress-v2.png",
  "empathy-b1x-pushpress": "empathy-b1x-pushpress-v2.png",
  "empathy-b1x-machineshoulderpress": "empathy-b1x-machineshoulderpress-v2.png",
  "empathy-b1x-smithbenchpress": "empathy-b1x-smithbenchpress-v2.png",
  "empathy-b1x-floorpress": "empathy-b1x-floorpress-v2.png",
  "empathy-b1x-chinup": "empathy-b1x-chinup-v2.png",
  "empathy-b1x-assistedpullup": "empathy-b1x-assistedpullup-v2.png",
  "empathy-b1x-neutralgrippulldown": "empathy-b1x-neutralgrippulldown-v2.png",
  "empathy-b1x-singlearmpulldown": "empathy-b1x-singlearmpulldown-v2.png",
  "empathy-b1x-singlearmrow": "empathy-b1x-singlearmrow-v2.png",
  "empathy-b1x-sealrow": "empathy-b1x-sealrow-v2.png",
  "empathy-b1x-invertedrow": "empathy-b1x-invertedrow-v2.png",
  "empathy-b1x-meadowsrow": "empathy-b1x-meadowsrow-v2.png",
  "empathy-b1x-machinehighrow": "empathy-b1x-machinehighrow-v2.png",
  "empathy-b1x-machinelowrow": "empathy-b1x-machinelowrow-v2.png",
  "empathy-b1x-cablepullover": "empathy-b1x-cablepullover-v2.png",
  "empathy-b1x-machinepullover": "empathy-b1x-machinepullover-v2.png",
  "empathy-b1x-shrug": "empathy-b1x-shrug-v2.png",
  "empathy-b1x-inclinecurl": "empathy-b1x-inclinecurl-v2.png",
  "empathy-b1x-concentrationcurl": "empathy-b1x-concentrationcurl-v2.png",
  "empathy-b1x-spidercurl": "empathy-b1x-spidercurl-v2.png",
  "empathy-b1x-cablecurl": "empathy-b1x-cablecurl-v2.png",
  "empathy-b1x-preacherhammercurl": "empathy-b1x-preacherhammercurl-v2.png",
  "empathy-b1x-wristcurl": "empathy-b1x-wristcurl-v2.png",
  "empathy-b1x-reversewristcurl": "empathy-b1x-reversewristcurl-v2.png",
  "empathy-b1x-zottmancurl": "empathy-b1x-zottmancurl-v2.png",
  "empathy-b1x-trapbarshrug": "empathy-b1x-trapbarshrug-v2.png",
  "empathy-b1x-yraise": "empathy-b1x-yraise-v2.png",
  "empathy-b1x-bandpullapart": "empathy-b1x-bandpullapart-v2.png",
  "empathy-b1x-scappullup": "empathy-b1x-scappullup-v2.png",
  "empathy-b1x-widegripseatedrow": "empathy-b1x-widegripseatedrow-v2.png",
  "empathy-b1x-ropehammercurl": "empathy-b1x-ropehammercurl-v2.png",
  "empathy-b1x-rackpull": "empathy-b1x-rackpull-v2.png",
  "empathy-b1x-deadbug": "empathy-b1x-deadbug-v2.png",
  "empathy-b1x-hollowhold": "empathy-b1x-hollowhold-v2.png",
  "empathy-b1x-pallofpress": "empathy-b1x-pallofpress-v2.png",
  "empathy-b1x-sideplank": "empathy-b1x-sideplank-v2.png",
  "empathy-b1x-weightedsitup": "empathy-b1x-weightedsitup-v2.png",
  "empathy-b1x-hanginglegraise": "empathy-b1x-hanginglegraise-v2.png",
  "empathy-b1x-cablecrunch": "empathy-b1x-cablecrunch-v2.png",
  "empathy-b1x-reversecrunch": "empathy-b1x-reversecrunch-v2.png",
  "empathy-b1x-mountainclimber": "empathy-b1x-mountainclimber-v2.png",
  "empathy-b1x-birddog": "empathy-b1x-birddog-v2.png",
  "empathy-b1x-suitcasecarry": "empathy-b1x-suitcasecarry-v2.png",
  "empathy-b1x-waitercarry": "empathy-b1x-waitercarry-v2.png",
  "empathy-b1x-stirthepot": "empathy-b1x-stirthepot-v2.png",
  "empathy-b1x-bodysaw": "empathy-b1x-bodysaw-v2.png",
  "empathy-b1x-dragonflag": "empathy-b1x-dragonflag-v2.png",
  "empathy-b1x-landminerotation": "empathy-b1x-landminerotation-v2.png",
  "empathy-b1x-woodchop": "empathy-b1x-woodchop-v2.png",
  "empathy-b1x-backextension": "empathy-b1x-backextension-v2.png",
  "empathy-b1x-supermanhold": "empathy-b1x-supermanhold-v2.png",
  "empathy-b1x-openhagenadduction": "empathy-b1x-openhagenadduction-v2.png",
  "empathy-b1x-assaultbike": "empathy-b1x-assaultbike-v2.png",
  "empathy-b1x-echobike": "empathy-b1x-echobike-v2.png",
  "empathy-b1x-battleropes": "empathy-b1x-battleropes-v2.png",
  "empathy-b1x-shuttlerun": "empathy-b1x-shuttlerun-v2.png",
  "empathy-b1x-bearcrawl": "empathy-b1x-bearcrawl-v2.png",
  "empathy-b1x-crabwalk": "empathy-b1x-crabwalk-v2.png",
  "empathy-b1x-boxstepover": "empathy-b1x-boxstepover-v2.png",
  "empathy-b1x-broadjump": "empathy-b1x-broadjump-v2.png",
  "empathy-b1x-sleddragbackward": "empathy-b1x-sleddragbackward-v2.png",
  "empathy-b1x-sandbagcarry": "empathy-b1x-sandbagcarry-v2.png",
  "empathy-b1x-sandbaglunge": "empathy-b1x-sandbaglunge-v2.png",
  "empathy-b1x-devilpress": "empathy-b1x-devilpress-v2.png"
};
var GENERATED_EXERCISE_IMAGE_PUBLIC_DIR = "/assets/empathy/exercises/generated";
function publicUrlForGeneratedExerciseImage(exerciseId) {
  const id = exerciseId.trim();
  const file = GENERATED_EXERCISE_IMAGE_MANIFEST[id];
  if (!file) return null;
  if (/[/\\]|\.\./.test(file)) return null;
  return `${GENERATED_EXERCISE_IMAGE_PUBLIC_DIR}/${file}`;
}

// apps/web/lib/training/builder/exercise-media.ts
function safePublicAssetPath(input) {
  const value = (input ?? "").trim();
  if (!value) return null;
  if (!value.startsWith("/")) return null;
  if (value.startsWith("//")) return null;
  return value;
}
function safeExternalOrPublicUrl(input) {
  const value = (input ?? "").trim();
  if (!value) return null;
  if (value.startsWith("/")) return value;
  if (/^https?:\/\//i.test(value)) return value;
  return null;
}
function resolveExerciseMediaUrl(record) {
  const generatedPublic = publicUrlForGeneratedExerciseImage(record.id);
  if (generatedPublic) return generatedPublic;
  const localAsset = safePublicAssetPath(record.media?.localAssetPath);
  if (localAsset) return localAsset;
  const thumbnail = safeExternalOrPublicUrl(record.media?.thumbnailUrl);
  if (thumbnail) return thumbnail;
  const gif = safeExternalOrPublicUrl(record.media?.gifUrl);
  if (gif) return gif;
  return `/api/training/builder/exercise-art?catalogExerciseId=${encodeURIComponent(record.id)}`;
}

// apps/web/lib/training/domain-blocks/block1-strength-functional.ts
var BLOCK1_STRENGTH_DISCIPLINES = [
  { id: "Gym", sportTag: "gym", label: "Gym", hint: "Macchine, bilateral push/pull, ipertrofia/forza generale" },
  { id: "Hyrox", sportTag: "hyrox", label: "Hyrox", hint: "Corse + erg + sled + farmer \u2014 endurance di forza" },
  { id: "Crossfit", sportTag: "crossfit", label: "CrossFit", hint: "WOD, mixed modal, skill + engine" },
  { id: "Powerlifting", sportTag: "powerlifting", label: "Powerlifting", hint: "SBD, tecnica, intensit\xE0 specifica" }
];
function disciplineToBlock1SportTag(discipline) {
  const hit = BLOCK1_STRENGTH_DISCIPLINES.find((d) => d.id === discipline);
  return hit?.sportTag ?? "gym";
}

// apps/web/lib/training/exercise-library/block1-taxonomy.ts
var DISTRICTS = {
  quadriceps: { label: "Quadricipiti", aliases: ["quadriceps", "quads", "upper_legs"], bodyRegion: "lower" },
  hamstrings: { label: "Femorali", aliases: ["hamstrings"], bodyRegion: "lower" },
  glutes: { label: "Glutei", aliases: ["glutes"], bodyRegion: "lower" },
  calves: { label: "Polpacci", aliases: ["calves", "lower_legs"], bodyRegion: "lower" },
  chest: { label: "Petto", aliases: ["chest", "pecs"], bodyRegion: "upper" },
  lats: { label: "Gran dorsale", aliases: ["lats", "latissimus"], bodyRegion: "upper" },
  upper_back: { label: "Schiena alta", aliases: ["upper_back", "back", "traps", "rear_delts"], bodyRegion: "upper" },
  shoulders: { label: "Spalle", aliases: ["shoulders", "delts", "deltoids"], bodyRegion: "upper" },
  biceps: { label: "Bicipiti", aliases: ["biceps", "bicep"], bodyRegion: "upper" },
  triceps: { label: "Tricipiti", aliases: ["triceps", "tricep"], bodyRegion: "upper" },
  forearms: { label: "Avambracci", aliases: ["forearms", "grip"], bodyRegion: "upper" },
  core: { label: "Core", aliases: ["core", "abdominals", "abs", "obliques", "waist"], bodyRegion: "trunk" },
  hip_flexors: { label: "Flessori anca", aliases: ["hip_flexors"], bodyRegion: "trunk" },
  posterior_chain: {
    label: "Catena posteriore",
    aliases: ["posterior_chain", "hamstrings", "glutes", "lower_back"],
    bodyRegion: "lower"
  },
  full_body: { label: "Full body", aliases: ["full_body", "total_body"], bodyRegion: "full_body" }
};
function normalize(input) {
  return input.trim().toLowerCase();
}
function normalizedMuscles(exercise) {
  return exercise.muscleGroups.map(normalize);
}
function includesAny(haystack, needles) {
  return needles.some((needle) => haystack.includes(normalize(needle)));
}
function pickPrimaryDistrict(exercise) {
  const muscles = normalizedMuscles(exercise);
  const priority = [
    "full_body",
    "quadriceps",
    "hamstrings",
    "glutes",
    "calves",
    "chest",
    "lats",
    "upper_back",
    "shoulders",
    "biceps",
    "triceps",
    "forearms",
    "core",
    "hip_flexors",
    "posterior_chain"
  ];
  for (const key of priority) {
    if (includesAny(muscles, DISTRICTS[key].aliases)) return key;
  }
  return "full_body";
}
function secondaryDistricts(exercise, primary) {
  const muscles = normalizedMuscles(exercise);
  return Object.entries(DISTRICTS).filter(([key, meta]) => key !== primary && includesAny(muscles, meta.aliases)).map(([key]) => DISTRICTS[key].label).slice(0, 3);
}
function classifyEquipmentClass(exercise) {
  const equipment = exercise.equipment.map(normalize);
  if (equipment.some((item) => ["barbell", "dumbbell", "kettlebell", "weight_plate"].includes(item))) return "Pesi liberi";
  if (equipment.includes("bodyweight") || equipment.includes("pullup_bar")) return "Corpo libero";
  if (equipment.some((item) => item.includes("machine") || item === "leg_press")) return "Macchinario";
  if (equipment.includes("cable")) return "Cavo";
  if (equipment.some((item) => item.includes("erg") || item === "rower" || item === "ski_erg")) return "Ergometro";
  if (equipment.includes("sled")) return "Sled";
  return "Misto";
}
function classifyExerciseKind(exercise) {
  const category = normalize(exercise.category);
  const pattern = normalize(exercise.movementPattern);
  if (category === "skill") return "Skill";
  if (category === "conditioning" || category === "endurance") return "Conditioning";
  if (pattern.includes("carry") || pattern.includes("locomotion")) return "Locomozione";
  if (pattern.includes("push")) return "Spinta";
  if (pattern.includes("pull")) return "Trazione";
  if (pattern.includes("hinge")) return "Hip hinge";
  if (pattern.includes("squat")) return "Squat";
  return "Forza";
}
function classifyCatalogCategory(exercise) {
  const category = normalize(exercise.category);
  const pattern = normalize(exercise.movementPattern);
  const primarySystem = normalize(exercise.physiology.primarySystem);
  const sportTags = exercise.sportTags.map(normalize);
  if (category === "skill") return "sport_specific_skill";
  if (category === "conditioning" || category === "endurance") return "mixed_modal_conditioning";
  if (primarySystem.includes("stability") || pattern.includes("core_control")) return "trunk_stability";
  if (sportTags.some((tag) => ["powerlifting", "crossfit", "hyrox", "weightlifting"].includes(tag)) && (pattern.includes("technical") || pattern.includes("carry"))) {
    return "sport_specific_skill";
  }
  if (category === "accessory") return "strength_accessory";
  return "strength_foundation";
}
function describeBlock1Taxonomy(exercise) {
  const primary = pickPrimaryDistrict(exercise);
  return {
    primaryDistrict: DISTRICTS[primary].label,
    secondaryDistricts: secondaryDistricts(exercise, primary),
    bodyRegion: DISTRICTS[primary].bodyRegion,
    equipmentClass: classifyEquipmentClass(exercise),
    exerciseKind: classifyExerciseKind(exercise),
    catalogCategory: classifyCatalogCategory(exercise)
  };
}

// apps/web/lib/training/exercise-library/catalog-row.ts
function catalogRowToUnifiedRecord(row) {
  const record = {
    id: row.id,
    slug: row.slug,
    name: row.name,
    category: row.category,
    sportTags: row.sport_tags ?? [],
    movementPattern: row.movement_pattern,
    muscleGroups: row.muscle_groups ?? [],
    equipment: row.equipment ?? [],
    difficulty: row.difficulty,
    physiology: row.physiology,
    skills: row.skills,
    provenance: row.provenance ?? []
  };
  if (row.purpose) record.purpose = row.purpose;
  if (row.media) record.media = row.media;
  return record;
}
function rowsToCatalogFile(rows) {
  const exercises = rows.map(catalogRowToUnifiedRecord);
  return {
    version: 1,
    generatedAt: (/* @__PURE__ */ new Date(0)).toISOString(),
    count: exercises.length,
    exercises
  };
}

// apps/web/data/exercises/final/exercise-library.json
var exercise_library_default = {
  version: 1,
  generatedAt: "2026-03-21T12:00:00.000Z",
  count: 64,
  exercises: [
    {
      id: "empathy-b1-backsquat",
      slug: "backsquat",
      name: "Back Squat",
      category: "strength",
      sportTags: ["gym", "crossfit", "hyrox", "powerlifting"],
      movementPattern: "squat",
      muscleGroups: ["quadriceps", "glutes"],
      equipment: ["barbell", "rack"],
      difficulty: "intermediate",
      physiology: {
        primarySystem: "neuromuscular_strength",
        secondarySystem: "anaerobic_lactic",
        energySystem: "anaerobic_lactic",
        lactateImpact: "high",
        cnsLoad: "high"
      },
      skills: { coordination: "medium", balance: "medium", technique: "high" },
      purpose: {
        functionalGoals: ["strength"],
        metabolicGoals: ["anaerobic_lactic", "anabolic"],
        technicalScope: "sport_specific",
        technicalSports: ["crossfit", "hyrox", "powerlifting"],
        technicalTags: ["strength_sport_specific"]
      },
      provenance: [{ source: "empathy_seed_block1" }]
    },
    {
      id: "empathy-b1-deadlift",
      slug: "deadlift",
      name: "Deadlift",
      category: "strength",
      sportTags: ["gym", "powerlifting", "crossfit"],
      movementPattern: "hinge",
      muscleGroups: ["posterior_chain", "glutes"],
      equipment: ["barbell"],
      difficulty: "intermediate",
      physiology: {
        primarySystem: "neuromuscular_strength",
        secondarySystem: "anaerobic_alactic",
        energySystem: "anaerobic_alactic",
        lactateImpact: "medium",
        cnsLoad: "high"
      },
      skills: { coordination: "medium", balance: "medium", technique: "high" },
      purpose: {
        functionalGoals: ["strength"],
        metabolicGoals: ["anaerobic_alactic", "anabolic"],
        technicalScope: "sport_specific",
        technicalSports: ["powerlifting", "crossfit"],
        technicalTags: ["strength_sport_specific"]
      },
      provenance: [{ source: "empathy_seed_block1" }]
    },
    {
      id: "empathy-b1-bench",
      slug: "benchpress",
      name: "Bench Press",
      category: "strength",
      sportTags: ["gym", "powerlifting", "crossfit"],
      movementPattern: "push",
      muscleGroups: ["chest", "shoulders", "triceps"],
      equipment: ["barbell", "bench"],
      difficulty: "intermediate",
      physiology: {
        primarySystem: "neuromuscular_strength",
        secondarySystem: "anaerobic_lactic",
        energySystem: "mixed",
        lactateImpact: "medium",
        cnsLoad: "medium"
      },
      skills: { coordination: "low", balance: "medium", technique: "high" },
      purpose: {
        functionalGoals: ["strength"],
        metabolicGoals: ["mixed", "anabolic"],
        technicalScope: "sport_specific",
        technicalSports: ["powerlifting", "crossfit"],
        technicalTags: ["strength_sport_specific"]
      },
      provenance: [{ source: "empathy_seed_block1" }]
    },
    {
      id: "empathy-b1-pause-squat",
      slug: "pausesquat",
      name: "Paused Squat",
      category: "strength",
      sportTags: ["powerlifting", "gym"],
      movementPattern: "squat",
      muscleGroups: ["quadriceps", "glutes", "core"],
      equipment: ["barbell", "rack"],
      difficulty: "advanced",
      physiology: {
        primarySystem: "neuromuscular_strength",
        secondarySystem: "anaerobic_lactic",
        energySystem: "anaerobic_lactic",
        lactateImpact: "medium",
        cnsLoad: "high"
      },
      skills: { coordination: "medium", balance: "high", technique: "high" },
      purpose: {
        functionalGoals: ["strength", "skill"],
        metabolicGoals: ["anaerobic_lactic", "anabolic"],
        technicalScope: "sport_specific",
        technicalSports: ["powerlifting"],
        technicalTags: ["strength_sport_specific", "technical_skill"]
      },
      provenance: [{ source: "empathy_seed_block1" }]
    },
    {
      id: "empathy-b1-rdl",
      slug: "romaniandeadlift",
      name: "Romanian Deadlift",
      category: "strength",
      sportTags: ["gym", "powerlifting", "hyrox"],
      movementPattern: "hinge",
      muscleGroups: ["posterior_chain", "hamstrings"],
      equipment: ["barbell", "dumbbell"],
      difficulty: "intermediate",
      physiology: {
        primarySystem: "neuromuscular_strength",
        secondarySystem: "anaerobic_lactic",
        energySystem: "mixed",
        lactateImpact: "medium",
        cnsLoad: "medium"
      },
      skills: { coordination: "medium", balance: "medium", technique: "high" },
      purpose: {
        functionalGoals: ["strength", "hypertrophy"],
        metabolicGoals: ["mixed", "anabolic"],
        technicalScope: "generic",
        technicalSports: [],
        technicalTags: []
      },
      provenance: [{ source: "empathy_seed_block1" }]
    },
    {
      id: "empathy-b1-legpress",
      slug: "legpress",
      name: "Leg Press",
      category: "strength",
      sportTags: ["gym"],
      movementPattern: "squat",
      muscleGroups: ["quadriceps", "glutes"],
      equipment: ["leg_press"],
      difficulty: "beginner",
      physiology: {
        primarySystem: "neuromuscular_strength",
        secondarySystem: "anaerobic_lactic",
        energySystem: "anaerobic_lactic",
        lactateImpact: "medium",
        cnsLoad: "medium"
      },
      skills: { coordination: "low", balance: "low", technique: "medium" },
      purpose: {
        functionalGoals: ["strength", "hypertrophy"],
        metabolicGoals: ["anaerobic_lactic", "anabolic"],
        technicalScope: "generic",
        technicalSports: [],
        technicalTags: []
      },
      provenance: [{ source: "empathy_seed_block1" }]
    },
    {
      id: "empathy-b1-latpulldown",
      slug: "latpulldown",
      name: "Lat Pulldown",
      category: "strength",
      sportTags: ["gym"],
      movementPattern: "pull",
      muscleGroups: ["lats", "biceps"],
      equipment: ["cable", "machine"],
      difficulty: "beginner",
      physiology: {
        primarySystem: "neuromuscular_strength",
        secondarySystem: "anaerobic_lactic",
        energySystem: "mixed",
        lactateImpact: "low",
        cnsLoad: "low"
      },
      skills: { coordination: "low", balance: "low", technique: "medium" },
      purpose: {
        functionalGoals: ["strength", "hypertrophy"],
        metabolicGoals: ["mixed", "anabolic"],
        technicalScope: "generic",
        technicalSports: [],
        technicalTags: []
      },
      provenance: [{ source: "empathy_seed_block1" }]
    },
    {
      id: "empathy-b1-thruster",
      slug: "thruster",
      name: "Thruster",
      category: "conditioning",
      sportTags: ["crossfit"],
      movementPattern: "squat",
      muscleGroups: ["quadriceps", "shoulders", "full_body"],
      equipment: ["barbell", "dumbbell"],
      difficulty: "intermediate",
      physiology: {
        primarySystem: "anaerobic_lactic",
        secondarySystem: "neuromuscular_power",
        energySystem: "anaerobic_lactic",
        lactateImpact: "high",
        cnsLoad: "high"
      },
      skills: { coordination: "high", balance: "medium", technique: "high" },
      purpose: {
        functionalGoals: ["power", "muscular_endurance"],
        metabolicGoals: ["anaerobic_lactic", "catabolic"],
        technicalScope: "sport_specific",
        technicalSports: ["crossfit"],
        technicalTags: ["mixed_modal_specific"]
      },
      provenance: [{ source: "empathy_seed_block1" }]
    },
    {
      id: "empathy-b1-wallball",
      slug: "wallball",
      name: "Wall Ball",
      category: "conditioning",
      sportTags: ["crossfit", "hyrox"],
      movementPattern: "squat",
      muscleGroups: ["quadriceps", "shoulders", "core"],
      equipment: ["medicine_ball", "wall_target"],
      difficulty: "intermediate",
      physiology: {
        primarySystem: "anaerobic_lactic",
        secondarySystem: "neuromuscular_power",
        energySystem: "anaerobic_lactic",
        lactateImpact: "high",
        cnsLoad: "high"
      },
      skills: { coordination: "high", balance: "medium", technique: "medium" },
      purpose: {
        functionalGoals: ["power", "muscular_endurance", "coordination"],
        metabolicGoals: ["anaerobic_lactic", "catabolic"],
        technicalScope: "sport_specific",
        technicalSports: ["crossfit", "hyrox"],
        technicalTags: ["mixed_modal_specific", "race_specific"]
      },
      provenance: [{ source: "empathy_seed_block1" }]
    },
    {
      id: "empathy-b1-kbswing",
      slug: "kettlebellswing",
      name: "Kettlebell Swing",
      category: "conditioning",
      sportTags: ["crossfit", "gym", "hyrox"],
      movementPattern: "hinge",
      muscleGroups: ["posterior_chain", "glutes"],
      equipment: ["kettlebell"],
      difficulty: "intermediate",
      physiology: {
        primarySystem: "neuromuscular_power",
        secondarySystem: "anaerobic_lactic",
        energySystem: "anaerobic_lactic",
        lactateImpact: "high",
        cnsLoad: "medium"
      },
      skills: { coordination: "medium", balance: "medium", technique: "medium" },
      purpose: {
        functionalGoals: ["power", "muscular_endurance"],
        metabolicGoals: ["anaerobic_lactic", "catabolic"],
        technicalScope: "generic",
        technicalSports: [],
        technicalTags: []
      },
      provenance: [{ source: "empathy_seed_block1" }]
    },
    {
      id: "empathy-b1-ttb",
      slug: "toestobar",
      name: "Toes-to-Bar",
      category: "skill",
      sportTags: ["crossfit"],
      movementPattern: "pull",
      muscleGroups: ["core", "lats", "hip_flexors"],
      equipment: ["pullup_bar"],
      difficulty: "advanced",
      physiology: {
        primarySystem: "coordination",
        secondarySystem: "neuromuscular_strength",
        energySystem: "anaerobic_alactic",
        lactateImpact: "low",
        cnsLoad: "medium"
      },
      skills: { coordination: "high", balance: "high", technique: "high" },
      purpose: {
        functionalGoals: ["coordination", "skill", "stability_neuro"],
        metabolicGoals: ["anaerobic_alactic"],
        technicalScope: "sport_specific",
        technicalSports: ["crossfit"],
        technicalTags: ["technical_skill", "mixed_modal_specific"]
      },
      provenance: [{ source: "empathy_seed_block1" }]
    },
    {
      id: "empathy-b1-burpee",
      slug: "burpee",
      name: "Burpee",
      category: "conditioning",
      sportTags: ["crossfit", "hyrox", "gym"],
      movementPattern: "locomotion",
      muscleGroups: ["full_body"],
      equipment: ["bodyweight"],
      difficulty: "intermediate",
      physiology: {
        primarySystem: "anaerobic_lactic",
        secondarySystem: "neuromuscular_power",
        energySystem: "anaerobic_lactic",
        lactateImpact: "high",
        cnsLoad: "high"
      },
      skills: { coordination: "high", balance: "medium", technique: "medium" },
      purpose: {
        functionalGoals: ["power", "muscular_endurance"],
        metabolicGoals: ["anaerobic_lactic", "catabolic"],
        technicalScope: "generic",
        technicalSports: [],
        technicalTags: []
      },
      provenance: [{ source: "empathy_seed_block1" }]
    },
    {
      id: "empathy-b1-sledpush",
      slug: "sledpush",
      name: "Sled Push",
      category: "conditioning",
      sportTags: ["hyrox", "crossfit", "gym"],
      movementPattern: "carry",
      muscleGroups: ["quadriceps", "glutes", "calves"],
      equipment: ["sled"],
      difficulty: "intermediate",
      physiology: {
        primarySystem: "neuromuscular_strength",
        secondarySystem: "aerobic",
        energySystem: "mixed",
        lactateImpact: "high",
        cnsLoad: "high"
      },
      skills: { coordination: "medium", balance: "medium", technique: "medium" },
      purpose: {
        functionalGoals: ["strength", "muscular_endurance"],
        metabolicGoals: ["mixed", "catabolic"],
        technicalScope: "sport_specific",
        technicalSports: ["hyrox", "crossfit"],
        technicalTags: ["race_specific", "mixed_modal_specific"]
      },
      provenance: [{ source: "empathy_seed_block1" }]
    },
    {
      id: "empathy-b1-farmer",
      slug: "farmercarry",
      name: "Farmer Carry",
      category: "conditioning",
      sportTags: ["hyrox", "crossfit", "gym"],
      movementPattern: "carry",
      muscleGroups: ["forearms", "traps", "core"],
      equipment: ["dumbbell", "kettlebell", "handles"],
      difficulty: "intermediate",
      physiology: {
        primarySystem: "neuromuscular_strength",
        secondarySystem: "aerobic",
        energySystem: "mixed",
        lactateImpact: "medium",
        cnsLoad: "medium"
      },
      skills: { coordination: "medium", balance: "medium", technique: "medium" },
      purpose: {
        functionalGoals: ["strength", "stability_neuro", "muscular_endurance"],
        metabolicGoals: ["mixed", "catabolic"],
        technicalScope: "sport_specific",
        technicalSports: ["hyrox", "crossfit"],
        technicalTags: ["race_specific", "mixed_modal_specific"]
      },
      provenance: [{ source: "empathy_seed_block1" }]
    },
    {
      id: "empathy-b1-skierg",
      slug: "skierg",
      name: "Ski Erg",
      category: "endurance",
      sportTags: ["hyrox", "crossfit"],
      movementPattern: "locomotion",
      muscleGroups: ["back", "lats", "triceps", "core"],
      equipment: ["ski_erg"],
      difficulty: "intermediate",
      physiology: {
        primarySystem: "aerobic",
        secondarySystem: "anaerobic_lactic",
        energySystem: "aerobic",
        lactateImpact: "medium",
        cnsLoad: "low"
      },
      skills: { coordination: "medium", balance: "low", technique: "medium" },
      purpose: {
        functionalGoals: ["muscular_endurance"],
        metabolicGoals: ["aerobic", "catabolic"],
        technicalScope: "sport_specific",
        technicalSports: ["hyrox", "crossfit"],
        technicalTags: ["race_specific", "mixed_modal_specific"]
      },
      provenance: [{ source: "empathy_seed_block1" }]
    },
    {
      id: "empathy-b1-rowerg",
      slug: "rowerg",
      name: "Row Erg",
      category: "endurance",
      sportTags: ["hyrox", "crossfit", "gym"],
      movementPattern: "locomotion",
      muscleGroups: ["back", "legs", "full_body"],
      equipment: ["rower"],
      difficulty: "intermediate",
      physiology: {
        primarySystem: "aerobic",
        secondarySystem: "anaerobic_lactic",
        energySystem: "aerobic",
        lactateImpact: "medium",
        cnsLoad: "low"
      },
      skills: { coordination: "medium", balance: "low", technique: "medium" },
      purpose: {
        functionalGoals: ["muscular_endurance"],
        metabolicGoals: ["aerobic", "catabolic"],
        technicalScope: "sport_specific",
        technicalSports: ["hyrox", "crossfit"],
        technicalTags: ["race_specific", "mixed_modal_specific"]
      },
      provenance: [{ source: "empathy_seed_block1" }]
    },
    {
      id: "empathy-b1-wlunge",
      slug: "walkinglunge",
      name: "Walking Lunge",
      category: "strength",
      sportTags: ["hyrox", "gym", "crossfit"],
      movementPattern: "squat",
      muscleGroups: ["quadriceps", "glutes"],
      equipment: ["dumbbell", "barbell"],
      difficulty: "intermediate",
      physiology: {
        primarySystem: "neuromuscular_strength",
        secondarySystem: "stability",
        energySystem: "mixed",
        lactateImpact: "medium",
        cnsLoad: "medium"
      },
      skills: { coordination: "high", balance: "high", technique: "medium" },
      purpose: {
        functionalGoals: ["strength", "stability_neuro"],
        metabolicGoals: ["mixed", "anabolic"],
        technicalScope: "generic",
        technicalSports: [],
        technicalTags: []
      },
      provenance: [{ source: "empathy_seed_block1" }]
    },
    {
      id: "empathy-b1-plank",
      slug: "plank",
      name: "Plank",
      category: "accessory",
      sportTags: ["gym", "hyrox", "crossfit", "powerlifting"],
      movementPattern: "push",
      muscleGroups: ["core", "shoulders"],
      equipment: ["bodyweight"],
      difficulty: "beginner",
      physiology: {
        primarySystem: "stability",
        secondarySystem: "mobility",
        energySystem: "aerobic",
        lactateImpact: "low",
        cnsLoad: "low"
      },
      skills: { coordination: "low", balance: "high", technique: "low" },
      purpose: {
        functionalGoals: ["stability_neuro", "mobility"],
        metabolicGoals: ["aerobic", "recovery"],
        technicalScope: "generic",
        technicalSports: [],
        technicalTags: []
      },
      provenance: [{ source: "empathy_seed_block1" }]
    },
    {
      id: "empathy-b1-intervalrun",
      slug: "intervalrun",
      name: "Interval Run",
      category: "endurance",
      sportTags: ["hyrox", "running"],
      movementPattern: "locomotion",
      muscleGroups: ["legs", "full_body"],
      equipment: ["shoes"],
      difficulty: "intermediate",
      physiology: {
        primarySystem: "aerobic",
        secondarySystem: "anaerobic_lactic",
        energySystem: "aerobic",
        lactateImpact: "medium",
        cnsLoad: "low"
      },
      skills: { coordination: "medium", balance: "low", technique: "low" },
      purpose: {
        functionalGoals: ["muscular_endurance"],
        metabolicGoals: ["aerobic", "catabolic"],
        technicalScope: "sport_specific",
        technicalSports: ["hyrox", "running"],
        technicalTags: ["race_specific"]
      },
      provenance: [{ source: "empathy_seed_block1" }]
    },
    {
      id: "empathy-b1-ohpress",
      slug: "overheadpress",
      name: "Overhead Press",
      category: "strength",
      sportTags: ["gym", "powerlifting"],
      movementPattern: "push",
      muscleGroups: ["shoulders", "triceps", "core"],
      equipment: ["barbell", "dumbbell"],
      difficulty: "intermediate",
      physiology: {
        primarySystem: "neuromuscular_strength",
        secondarySystem: "anaerobic_alactic",
        energySystem: "anaerobic_alactic",
        lactateImpact: "low",
        cnsLoad: "high"
      },
      skills: { coordination: "medium", balance: "high", technique: "high" },
      purpose: {
        functionalGoals: ["strength"],
        metabolicGoals: ["anaerobic_alactic", "anabolic"],
        technicalScope: "sport_specific",
        technicalSports: ["powerlifting"],
        technicalTags: ["strength_sport_specific"]
      },
      provenance: [{ source: "empathy_seed_block1" }]
    },
    {
      id: "empathy-b1-inclinedbpress",
      slug: "inclinedumbbellpress",
      name: "Incline Dumbbell Press",
      category: "strength",
      sportTags: ["gym", "hyrox"],
      movementPattern: "push",
      muscleGroups: ["chest", "shoulders", "triceps"],
      equipment: ["dumbbell", "bench"],
      difficulty: "intermediate",
      physiology: {
        primarySystem: "neuromuscular_strength",
        secondarySystem: "anaerobic_lactic",
        energySystem: "mixed",
        lactateImpact: "medium",
        cnsLoad: "medium"
      },
      skills: { coordination: "medium", balance: "medium", technique: "medium" },
      provenance: [{ source: "empathy_seed_block1" }]
    },
    {
      id: "empathy-b1-machinechestpress",
      slug: "machinechestpress",
      name: "Machine Chest Press",
      category: "strength",
      sportTags: ["gym"],
      movementPattern: "push",
      muscleGroups: ["chest", "triceps", "shoulders"],
      equipment: ["machine"],
      difficulty: "beginner",
      physiology: {
        primarySystem: "neuromuscular_strength",
        secondarySystem: "anaerobic_lactic",
        energySystem: "mixed",
        lactateImpact: "low",
        cnsLoad: "low"
      },
      skills: { coordination: "low", balance: "low", technique: "low" },
      provenance: [{ source: "empathy_seed_block1" }]
    },
    {
      id: "empathy-b1-cablefly",
      slug: "cablefly",
      name: "Cable Fly",
      category: "accessory",
      sportTags: ["gym"],
      movementPattern: "push",
      muscleGroups: ["chest", "shoulders"],
      equipment: ["cable"],
      difficulty: "beginner",
      physiology: {
        primarySystem: "hypertrophy",
        secondarySystem: "anaerobic_lactic",
        energySystem: "mixed",
        lactateImpact: "medium",
        cnsLoad: "low"
      },
      skills: { coordination: "low", balance: "low", technique: "low" },
      provenance: [{ source: "empathy_seed_block1" }]
    },
    {
      id: "empathy-b1-weighteddip",
      slug: "weighteddip",
      name: "Weighted Dip",
      category: "strength",
      sportTags: ["gym", "crossfit"],
      movementPattern: "push",
      muscleGroups: ["chest", "triceps", "shoulders"],
      equipment: ["bodyweight", "dip_belt"],
      difficulty: "advanced",
      physiology: {
        primarySystem: "neuromuscular_strength",
        secondarySystem: "anaerobic_alactic",
        energySystem: "anaerobic_alactic",
        lactateImpact: "medium",
        cnsLoad: "medium"
      },
      skills: { coordination: "medium", balance: "medium", technique: "high" },
      provenance: [{ source: "empathy_seed_block1" }]
    },
    {
      id: "empathy-b1-lateralraise",
      slug: "lateralraise",
      name: "Lateral Raise",
      category: "accessory",
      sportTags: ["gym"],
      movementPattern: "push",
      muscleGroups: ["shoulders"],
      equipment: ["dumbbell"],
      difficulty: "beginner",
      physiology: {
        primarySystem: "hypertrophy",
        secondarySystem: "anaerobic_lactic",
        energySystem: "mixed",
        lactateImpact: "medium",
        cnsLoad: "low"
      },
      skills: { coordination: "low", balance: "low", technique: "low" },
      provenance: [{ source: "empathy_seed_block1" }]
    },
    {
      id: "empathy-b1-reardeltfly",
      slug: "reardeltfly",
      name: "Rear Delt Fly",
      category: "accessory",
      sportTags: ["gym"],
      movementPattern: "pull",
      muscleGroups: ["upper_back", "shoulders"],
      equipment: ["dumbbell", "machine"],
      difficulty: "beginner",
      physiology: {
        primarySystem: "hypertrophy",
        secondarySystem: "stability",
        energySystem: "mixed",
        lactateImpact: "low",
        cnsLoad: "low"
      },
      skills: { coordination: "low", balance: "low", technique: "low" },
      provenance: [{ source: "empathy_seed_block1" }]
    },
    {
      id: "empathy-b1-barbellrow",
      slug: "barbellrow",
      name: "Barbell Row",
      category: "strength",
      sportTags: ["gym", "powerlifting", "crossfit"],
      movementPattern: "pull",
      muscleGroups: ["lats", "upper_back", "biceps"],
      equipment: ["barbell"],
      difficulty: "intermediate",
      physiology: {
        primarySystem: "neuromuscular_strength",
        secondarySystem: "anaerobic_lactic",
        energySystem: "mixed",
        lactateImpact: "medium",
        cnsLoad: "medium"
      },
      skills: { coordination: "medium", balance: "medium", technique: "medium" },
      provenance: [{ source: "empathy_seed_block1" }]
    },
    {
      id: "empathy-b1-seatedcablerow",
      slug: "seatedcablerow",
      name: "Seated Cable Row",
      category: "strength",
      sportTags: ["gym"],
      movementPattern: "pull",
      muscleGroups: ["lats", "upper_back", "biceps"],
      equipment: ["cable"],
      difficulty: "beginner",
      physiology: {
        primarySystem: "neuromuscular_strength",
        secondarySystem: "anaerobic_lactic",
        energySystem: "mixed",
        lactateImpact: "low",
        cnsLoad: "low"
      },
      skills: { coordination: "low", balance: "low", technique: "low" },
      provenance: [{ source: "empathy_seed_block1" }]
    },
    {
      id: "empathy-b1-weightedpullup",
      slug: "weightedpullup",
      name: "Weighted Pull-Up",
      category: "strength",
      sportTags: ["gym", "crossfit"],
      movementPattern: "pull",
      muscleGroups: ["lats", "biceps", "core"],
      equipment: ["bodyweight", "dip_belt", "pullup_bar"],
      difficulty: "advanced",
      physiology: {
        primarySystem: "neuromuscular_strength",
        secondarySystem: "anaerobic_alactic",
        energySystem: "anaerobic_alactic",
        lactateImpact: "medium",
        cnsLoad: "high"
      },
      skills: { coordination: "high", balance: "medium", technique: "high" },
      provenance: [{ source: "empathy_seed_block1" }]
    },
    {
      id: "empathy-b1-facepull",
      slug: "facepull",
      name: "Face Pull",
      category: "accessory",
      sportTags: ["gym", "crossfit"],
      movementPattern: "pull",
      muscleGroups: ["upper_back", "shoulders", "forearms"],
      equipment: ["cable"],
      difficulty: "beginner",
      physiology: {
        primarySystem: "stability",
        secondarySystem: "hypertrophy",
        energySystem: "mixed",
        lactateImpact: "low",
        cnsLoad: "low"
      },
      skills: { coordination: "low", balance: "low", technique: "low" },
      provenance: [{ source: "empathy_seed_block1" }]
    },
    {
      id: "empathy-b1-barbellcurl",
      slug: "barbellcurl",
      name: "Barbell Curl",
      category: "accessory",
      sportTags: ["gym"],
      movementPattern: "pull",
      muscleGroups: ["biceps", "forearms"],
      equipment: ["barbell", "e-z_curl_bar"],
      difficulty: "beginner",
      physiology: {
        primarySystem: "hypertrophy",
        secondarySystem: "anaerobic_lactic",
        energySystem: "mixed",
        lactateImpact: "medium",
        cnsLoad: "low"
      },
      skills: { coordination: "low", balance: "low", technique: "low" },
      provenance: [{ source: "empathy_seed_block1" }]
    },
    {
      id: "empathy-b1-hammercurl",
      slug: "hammercurl",
      name: "Hammer Curl",
      category: "accessory",
      sportTags: ["gym"],
      movementPattern: "pull",
      muscleGroups: ["biceps", "forearms"],
      equipment: ["dumbbell"],
      difficulty: "beginner",
      physiology: {
        primarySystem: "hypertrophy",
        secondarySystem: "anaerobic_lactic",
        energySystem: "mixed",
        lactateImpact: "medium",
        cnsLoad: "low"
      },
      skills: { coordination: "low", balance: "low", technique: "low" },
      provenance: [{ source: "empathy_seed_block1" }]
    },
    {
      id: "empathy-b1-tricepspushdown",
      slug: "tricepspushdown",
      name: "Triceps Pushdown",
      category: "accessory",
      sportTags: ["gym"],
      movementPattern: "push",
      muscleGroups: ["triceps"],
      equipment: ["cable"],
      difficulty: "beginner",
      physiology: {
        primarySystem: "hypertrophy",
        secondarySystem: "anaerobic_lactic",
        energySystem: "mixed",
        lactateImpact: "medium",
        cnsLoad: "low"
      },
      skills: { coordination: "low", balance: "low", technique: "low" },
      provenance: [{ source: "empathy_seed_block1" }]
    },
    {
      id: "empathy-b1-skullcrusher",
      slug: "skullcrusher",
      name: "Skull Crusher",
      category: "accessory",
      sportTags: ["gym"],
      movementPattern: "push",
      muscleGroups: ["triceps"],
      equipment: ["barbell", "e-z_curl_bar", "bench"],
      difficulty: "intermediate",
      physiology: {
        primarySystem: "hypertrophy",
        secondarySystem: "anaerobic_lactic",
        energySystem: "mixed",
        lactateImpact: "medium",
        cnsLoad: "low"
      },
      skills: { coordination: "low", balance: "low", technique: "medium" },
      provenance: [{ source: "empathy_seed_block1" }]
    },
    {
      id: "empathy-b1-frontsquat",
      slug: "frontsquat",
      name: "Front Squat",
      category: "strength",
      sportTags: ["gym", "crossfit", "weightlifting"],
      movementPattern: "squat",
      muscleGroups: ["quadriceps", "core", "glutes"],
      equipment: ["barbell", "rack"],
      difficulty: "advanced",
      physiology: {
        primarySystem: "neuromuscular_strength",
        secondarySystem: "anaerobic_alactic",
        energySystem: "anaerobic_alactic",
        lactateImpact: "medium",
        cnsLoad: "high"
      },
      skills: { coordination: "high", balance: "high", technique: "high" },
      provenance: [{ source: "empathy_seed_block1" }]
    },
    {
      id: "empathy-b1-bulgarian",
      slug: "bulgariansplitsquat",
      name: "Bulgarian Split Squat",
      category: "strength",
      sportTags: ["gym", "hyrox"],
      movementPattern: "squat",
      muscleGroups: ["quadriceps", "glutes", "core"],
      equipment: ["dumbbell", "bench"],
      difficulty: "intermediate",
      physiology: {
        primarySystem: "neuromuscular_strength",
        secondarySystem: "stability",
        energySystem: "mixed",
        lactateImpact: "medium",
        cnsLoad: "medium"
      },
      skills: { coordination: "high", balance: "high", technique: "medium" },
      provenance: [{ source: "empathy_seed_block1" }]
    },
    {
      id: "empathy-b1-legextension",
      slug: "legextension",
      name: "Leg Extension",
      category: "accessory",
      sportTags: ["gym"],
      movementPattern: "squat",
      muscleGroups: ["quadriceps"],
      equipment: ["machine"],
      difficulty: "beginner",
      physiology: {
        primarySystem: "hypertrophy",
        secondarySystem: "anaerobic_lactic",
        energySystem: "mixed",
        lactateImpact: "medium",
        cnsLoad: "low"
      },
      skills: { coordination: "low", balance: "low", technique: "low" },
      provenance: [{ source: "empathy_seed_block1" }]
    },
    {
      id: "empathy-b1-legcurl",
      slug: "lyinglegcurl",
      name: "Lying Leg Curl",
      category: "accessory",
      sportTags: ["gym"],
      movementPattern: "hinge",
      muscleGroups: ["hamstrings"],
      equipment: ["machine"],
      difficulty: "beginner",
      physiology: {
        primarySystem: "hypertrophy",
        secondarySystem: "anaerobic_lactic",
        energySystem: "mixed",
        lactateImpact: "medium",
        cnsLoad: "low"
      },
      skills: { coordination: "low", balance: "low", technique: "low" },
      provenance: [{ source: "empathy_seed_block1" }]
    },
    {
      id: "empathy-b1-hipthrust",
      slug: "hipthrust",
      name: "Hip Thrust",
      category: "strength",
      sportTags: ["gym", "powerlifting", "hyrox"],
      movementPattern: "hinge",
      muscleGroups: ["glutes", "hamstrings", "posterior_chain"],
      equipment: ["barbell", "bench"],
      difficulty: "intermediate",
      physiology: {
        primarySystem: "neuromuscular_strength",
        secondarySystem: "anaerobic_lactic",
        energySystem: "mixed",
        lactateImpact: "medium",
        cnsLoad: "medium"
      },
      skills: { coordination: "medium", balance: "medium", technique: "medium" },
      provenance: [{ source: "empathy_seed_block1" }]
    },
    {
      id: "empathy-b1-standingcalfraise",
      slug: "standingcalfraise",
      name: "Standing Calf Raise",
      category: "accessory",
      sportTags: ["gym", "hyrox"],
      movementPattern: "squat",
      muscleGroups: ["calves"],
      equipment: ["machine", "bodyweight"],
      difficulty: "beginner",
      physiology: {
        primarySystem: "hypertrophy",
        secondarySystem: "aerobic",
        energySystem: "mixed",
        lactateImpact: "low",
        cnsLoad: "low"
      },
      skills: { coordination: "low", balance: "medium", technique: "low" },
      provenance: [{ source: "empathy_seed_block1" }]
    },
    {
      id: "empathy-b1-seatedcalfraise",
      slug: "seatedcalfraise",
      name: "Seated Calf Raise",
      category: "accessory",
      sportTags: ["gym"],
      movementPattern: "squat",
      muscleGroups: ["calves"],
      equipment: ["machine"],
      difficulty: "beginner",
      physiology: {
        primarySystem: "hypertrophy",
        secondarySystem: "aerobic",
        energySystem: "mixed",
        lactateImpact: "low",
        cnsLoad: "low"
      },
      skills: { coordination: "low", balance: "low", technique: "low" },
      provenance: [{ source: "empathy_seed_block1" }]
    },
    {
      id: "empathy-b1-hangingkneeraise",
      slug: "hangingkneeraise",
      name: "Hanging Knee Raise",
      category: "accessory",
      sportTags: ["gym", "crossfit"],
      movementPattern: "core_control",
      muscleGroups: ["core", "hip_flexors"],
      equipment: ["pullup_bar", "bodyweight"],
      difficulty: "intermediate",
      physiology: {
        primarySystem: "stability",
        secondarySystem: "coordination",
        energySystem: "mixed",
        lactateImpact: "low",
        cnsLoad: "medium"
      },
      skills: { coordination: "medium", balance: "medium", technique: "medium" },
      provenance: [{ source: "empathy_seed_block1" }]
    },
    {
      id: "empathy-b1-abwheel",
      slug: "abwheelrollout",
      name: "Ab Wheel Rollout",
      category: "accessory",
      sportTags: ["gym", "crossfit"],
      movementPattern: "core_control",
      muscleGroups: ["core", "shoulders"],
      equipment: ["ab_wheel", "bodyweight"],
      difficulty: "intermediate",
      physiology: {
        primarySystem: "stability",
        secondarySystem: "neuromuscular_strength",
        energySystem: "mixed",
        lactateImpact: "low",
        cnsLoad: "medium"
      },
      skills: { coordination: "medium", balance: "high", technique: "medium" },
      provenance: [{ source: "empathy_seed_block1" }]
    },
    {
      id: "empathy-b1-boxjump",
      slug: "boxjump",
      name: "Box Jump",
      category: "conditioning",
      sportTags: ["crossfit", "hyrox", "gym"],
      movementPattern: "jump_landing",
      muscleGroups: ["quadriceps", "glutes", "calves"],
      equipment: ["bodyweight", "plyo_box"],
      difficulty: "intermediate",
      physiology: {
        primarySystem: "neuromuscular_power",
        secondarySystem: "anaerobic_alactic",
        energySystem: "anaerobic_alactic",
        lactateImpact: "medium",
        cnsLoad: "medium"
      },
      skills: { coordination: "high", balance: "medium", technique: "medium" },
      provenance: [{ source: "empathy_seed_block1" }]
    },
    {
      id: "empathy-b1-pushup",
      slug: "pushup",
      name: "Push-Up",
      category: "strength",
      sportTags: ["gym", "hyrox", "crossfit"],
      movementPattern: "push",
      muscleGroups: ["chest", "triceps", "core"],
      equipment: ["bodyweight"],
      difficulty: "beginner",
      physiology: {
        primarySystem: "neuromuscular_endurance",
        secondarySystem: "anaerobic_lactic",
        energySystem: "mixed",
        lactateImpact: "medium",
        cnsLoad: "low"
      },
      skills: { coordination: "medium", balance: "medium", technique: "low" },
      provenance: [{ source: "empathy_seed_block1" }]
    },
    {
      id: "empathy-b1-closegripbench",
      slug: "closegripbenchpress",
      name: "Close-Grip Bench Press",
      category: "strength",
      sportTags: ["gym", "powerlifting"],
      movementPattern: "push",
      muscleGroups: ["triceps", "chest", "shoulders"],
      equipment: ["barbell", "bench"],
      difficulty: "intermediate",
      physiology: {
        primarySystem: "neuromuscular_strength",
        secondarySystem: "anaerobic_lactic",
        energySystem: "mixed",
        lactateImpact: "medium",
        cnsLoad: "medium"
      },
      skills: { coordination: "medium", balance: "medium", technique: "medium" },
      provenance: [{ source: "empathy_seed_block1" }]
    },
    {
      id: "empathy-b1-pecdeck",
      slug: "pecdeck",
      name: "Pec Deck",
      category: "accessory",
      sportTags: ["gym"],
      movementPattern: "push",
      muscleGroups: ["chest"],
      equipment: ["machine"],
      difficulty: "beginner",
      physiology: {
        primarySystem: "hypertrophy",
        secondarySystem: "anaerobic_lactic",
        energySystem: "mixed",
        lactateImpact: "medium",
        cnsLoad: "low"
      },
      skills: { coordination: "low", balance: "low", technique: "low" },
      provenance: [{ source: "empathy_seed_block1" }]
    },
    {
      id: "empathy-b1-chestsupportedrow",
      slug: "chestsupportedrow",
      name: "Chest-Supported Row",
      category: "strength",
      sportTags: ["gym"],
      movementPattern: "pull",
      muscleGroups: ["upper_back", "lats", "biceps"],
      equipment: ["dumbbell", "bench", "machine"],
      difficulty: "beginner",
      physiology: {
        primarySystem: "neuromuscular_strength",
        secondarySystem: "anaerobic_lactic",
        energySystem: "mixed",
        lactateImpact: "low",
        cnsLoad: "low"
      },
      skills: { coordination: "low", balance: "low", technique: "low" },
      provenance: [{ source: "empathy_seed_block1" }]
    },
    {
      id: "empathy-b1-tbarrow",
      slug: "tbarrow",
      name: "T-Bar Row",
      category: "strength",
      sportTags: ["gym"],
      movementPattern: "pull",
      muscleGroups: ["lats", "upper_back", "biceps"],
      equipment: ["barbell", "machine"],
      difficulty: "intermediate",
      physiology: {
        primarySystem: "neuromuscular_strength",
        secondarySystem: "anaerobic_lactic",
        energySystem: "mixed",
        lactateImpact: "medium",
        cnsLoad: "medium"
      },
      skills: { coordination: "medium", balance: "low", technique: "medium" },
      provenance: [{ source: "empathy_seed_block1" }]
    },
    {
      id: "empathy-b1-straightarmpulldown",
      slug: "straightarmpulldown",
      name: "Straight-Arm Pulldown",
      category: "accessory",
      sportTags: ["gym"],
      movementPattern: "pull",
      muscleGroups: ["lats", "upper_back"],
      equipment: ["cable"],
      difficulty: "beginner",
      physiology: {
        primarySystem: "hypertrophy",
        secondarySystem: "anaerobic_lactic",
        energySystem: "mixed",
        lactateImpact: "medium",
        cnsLoad: "low"
      },
      skills: { coordination: "low", balance: "low", technique: "low" },
      provenance: [{ source: "empathy_seed_block1" }]
    },
    {
      id: "empathy-b1-preachercurl",
      slug: "preachercurl",
      name: "Preacher Curl",
      category: "accessory",
      sportTags: ["gym"],
      movementPattern: "pull",
      muscleGroups: ["biceps", "forearms"],
      equipment: ["e-z_curl_bar", "bench", "machine"],
      difficulty: "beginner",
      physiology: {
        primarySystem: "hypertrophy",
        secondarySystem: "anaerobic_lactic",
        energySystem: "mixed",
        lactateImpact: "medium",
        cnsLoad: "low"
      },
      skills: { coordination: "low", balance: "low", technique: "low" },
      provenance: [{ source: "empathy_seed_block1" }]
    },
    {
      id: "empathy-b1-reversecurl",
      slug: "reversecurl",
      name: "Reverse Curl",
      category: "accessory",
      sportTags: ["gym"],
      movementPattern: "pull",
      muscleGroups: ["forearms", "biceps"],
      equipment: ["barbell", "e-z_curl_bar"],
      difficulty: "beginner",
      physiology: {
        primarySystem: "hypertrophy",
        secondarySystem: "anaerobic_lactic",
        energySystem: "mixed",
        lactateImpact: "medium",
        cnsLoad: "low"
      },
      skills: { coordination: "low", balance: "low", technique: "low" },
      provenance: [{ source: "empathy_seed_block1" }]
    },
    {
      id: "empathy-b1-goodmorning",
      slug: "goodmorning",
      name: "Good Morning",
      category: "strength",
      sportTags: ["gym", "powerlifting"],
      movementPattern: "hinge",
      muscleGroups: ["posterior_chain", "hamstrings", "glutes"],
      equipment: ["barbell"],
      difficulty: "advanced",
      physiology: {
        primarySystem: "neuromuscular_strength",
        secondarySystem: "anaerobic_alactic",
        energySystem: "anaerobic_alactic",
        lactateImpact: "medium",
        cnsLoad: "high"
      },
      skills: { coordination: "high", balance: "high", technique: "high" },
      provenance: [{ source: "empathy_seed_block1" }]
    },
    {
      id: "empathy-b1-singlelegrdl",
      slug: "singlelegrdl",
      name: "Single-Leg Romanian Deadlift",
      category: "strength",
      sportTags: ["gym", "hyrox"],
      movementPattern: "hinge",
      muscleGroups: ["hamstrings", "glutes", "core"],
      equipment: ["dumbbell", "kettlebell"],
      difficulty: "intermediate",
      physiology: {
        primarySystem: "neuromuscular_strength",
        secondarySystem: "stability",
        energySystem: "mixed",
        lactateImpact: "medium",
        cnsLoad: "medium"
      },
      skills: { coordination: "high", balance: "high", technique: "medium" },
      provenance: [{ source: "empathy_seed_block1" }]
    },
    {
      id: "empathy-b1-glutebridge",
      slug: "glutebridge",
      name: "Glute Bridge",
      category: "accessory",
      sportTags: ["gym", "hyrox"],
      movementPattern: "hinge",
      muscleGroups: ["glutes", "hamstrings"],
      equipment: ["bodyweight", "barbell"],
      difficulty: "beginner",
      physiology: {
        primarySystem: "hypertrophy",
        secondarySystem: "stability",
        energySystem: "mixed",
        lactateImpact: "low",
        cnsLoad: "low"
      },
      skills: { coordination: "low", balance: "medium", technique: "low" },
      provenance: [{ source: "empathy_seed_block1" }]
    },
    {
      id: "empathy-b1-sissyquat",
      slug: "sissyquat",
      name: "Sissy Squat",
      category: "accessory",
      sportTags: ["gym"],
      movementPattern: "squat",
      muscleGroups: ["quadriceps"],
      equipment: ["bodyweight"],
      difficulty: "intermediate",
      physiology: {
        primarySystem: "hypertrophy",
        secondarySystem: "anaerobic_lactic",
        energySystem: "mixed",
        lactateImpact: "medium",
        cnsLoad: "low"
      },
      skills: { coordination: "medium", balance: "medium", technique: "medium" },
      provenance: [{ source: "empathy_seed_block1" }]
    },
    {
      id: "empathy-b1-gobletsquat",
      slug: "gobletsquat",
      name: "Goblet Squat",
      category: "strength",
      sportTags: ["gym", "hyrox", "crossfit"],
      movementPattern: "squat",
      muscleGroups: ["quadriceps", "glutes", "core"],
      equipment: ["dumbbell", "kettlebell"],
      difficulty: "beginner",
      physiology: {
        primarySystem: "neuromuscular_strength",
        secondarySystem: "anaerobic_lactic",
        energySystem: "mixed",
        lactateImpact: "medium",
        cnsLoad: "medium"
      },
      skills: { coordination: "medium", balance: "medium", technique: "low" },
      provenance: [{ source: "empathy_seed_block1" }]
    },
    {
      id: "empathy-b1-stepup",
      slug: "stepup",
      name: "Step-Up",
      category: "strength",
      sportTags: ["gym", "hyrox"],
      movementPattern: "squat",
      muscleGroups: ["quadriceps", "glutes", "calves"],
      equipment: ["bodyweight", "dumbbell", "bench"],
      difficulty: "beginner",
      physiology: {
        primarySystem: "neuromuscular_endurance",
        secondarySystem: "stability",
        energySystem: "mixed",
        lactateImpact: "medium",
        cnsLoad: "low"
      },
      skills: { coordination: "medium", balance: "medium", technique: "low" },
      provenance: [{ source: "empathy_seed_block1" }]
    },
    {
      id: "empathy-b1-seatedabduction",
      slug: "seatedhipabduction",
      name: "Seated Hip Abduction",
      category: "accessory",
      sportTags: ["gym"],
      movementPattern: "hinge",
      muscleGroups: ["glutes"],
      equipment: ["machine"],
      difficulty: "beginner",
      physiology: {
        primarySystem: "hypertrophy",
        secondarySystem: "stability",
        energySystem: "mixed",
        lactateImpact: "low",
        cnsLoad: "low"
      },
      skills: { coordination: "low", balance: "low", technique: "low" },
      provenance: [{ source: "empathy_seed_block1" }]
    },
    {
      id: "empathy-b1-copenhagensideplank",
      slug: "copenhagensideplank",
      name: "Copenhagen Side Plank",
      category: "accessory",
      sportTags: ["gym", "performance"],
      movementPattern: "core_control",
      muscleGroups: ["core", "hip_flexors", "glutes"],
      equipment: ["bodyweight", "bench"],
      difficulty: "advanced",
      physiology: {
        primarySystem: "stability",
        secondarySystem: "coordination",
        energySystem: "mixed",
        lactateImpact: "low",
        cnsLoad: "medium"
      },
      skills: { coordination: "high", balance: "high", technique: "medium" },
      provenance: [{ source: "empathy_seed_block1" }]
    },
    {
      id: "empathy-b1-russiantwist",
      slug: "russiantwist",
      name: "Russian Twist",
      category: "accessory",
      sportTags: ["gym", "crossfit"],
      movementPattern: "core_control",
      muscleGroups: ["core"],
      equipment: ["bodyweight", "medicine_ball"],
      difficulty: "beginner",
      physiology: {
        primarySystem: "stability",
        secondarySystem: "anaerobic_lactic",
        energySystem: "mixed",
        lactateImpact: "low",
        cnsLoad: "low"
      },
      skills: { coordination: "low", balance: "medium", technique: "low" },
      provenance: [{ source: "empathy_seed_block1" }]
    },
    {
      id: "empathy-b1-vup",
      slug: "vup",
      name: "V-Up",
      category: "accessory",
      sportTags: ["gym", "crossfit"],
      movementPattern: "core_control",
      muscleGroups: ["core", "hip_flexors"],
      equipment: ["bodyweight"],
      difficulty: "intermediate",
      physiology: {
        primarySystem: "stability",
        secondarySystem: "coordination",
        energySystem: "mixed",
        lactateImpact: "low",
        cnsLoad: "low"
      },
      skills: { coordination: "medium", balance: "medium", technique: "low" },
      provenance: [{ source: "empathy_seed_block1" }]
    },
    {
      id: "empathy-b1-jumprope",
      slug: "jumprope",
      name: "Jump Rope",
      category: "conditioning",
      sportTags: ["crossfit", "hyrox", "gym"],
      movementPattern: "locomotion",
      muscleGroups: ["calves", "full_body"],
      equipment: ["bodyweight", "rope"],
      difficulty: "beginner",
      physiology: {
        primarySystem: "aerobic",
        secondarySystem: "anaerobic_lactic",
        energySystem: "aerobic",
        lactateImpact: "medium",
        cnsLoad: "low"
      },
      skills: { coordination: "high", balance: "medium", technique: "medium" },
      provenance: [{ source: "empathy_seed_block1" }]
    },
    {
      id: "empathy-b1-sledpull",
      slug: "sledpull",
      name: "Sled Pull",
      category: "conditioning",
      sportTags: ["hyrox", "crossfit", "gym"],
      movementPattern: "carry",
      muscleGroups: ["posterior_chain", "forearms", "upper_back"],
      equipment: ["sled", "rope"],
      difficulty: "intermediate",
      physiology: {
        primarySystem: "neuromuscular_strength",
        secondarySystem: "aerobic",
        energySystem: "mixed",
        lactateImpact: "high",
        cnsLoad: "medium"
      },
      skills: { coordination: "medium", balance: "medium", technique: "medium" },
      provenance: [{ source: "empathy_seed_block1" }]
    }
  ]
};

// apps/web/lib/training/exercise-library/block1-generated.ts
var GENERATED_SOURCE = { source: "empathy_generated_block1" };
function slugify(input) {
  return input.toLowerCase().replace(/[^a-z0-9]+/g, "").replace(/^-+|-+$/g, "");
}
function buildMetabolicGoals(energySystem, category, primarySystem) {
  const goals = [];
  if (energySystem.includes("aerobic")) goals.push("aerobic");
  if (energySystem.includes("alactic")) goals.push("anaerobic_alactic");
  if (energySystem.includes("lactic")) goals.push("anaerobic_lactic");
  if (energySystem.includes("mixed")) goals.push("mixed");
  if (category === "strength" || category === "accessory" || primarySystem.includes("hypertrophy")) goals.push("anabolic");
  if (category === "conditioning" || category === "endurance") goals.push("catabolic");
  if (primarySystem.includes("stability") || primarySystem.includes("mobility")) goals.push("recovery");
  return Array.from(new Set(goals.length ? goals : ["mixed"]));
}
function buildRecord(seed) {
  const primarySystem = seed.primarySystem ?? "neuromuscular_strength";
  const energySystem = seed.energySystem ?? "mixed";
  return {
    id: `empathy-b1x-${seed.id}`,
    slug: slugify(seed.name),
    name: seed.name,
    category: seed.category,
    sportTags: seed.sportTags,
    movementPattern: seed.movementPattern,
    muscleGroups: seed.muscleGroups,
    equipment: seed.equipment,
    difficulty: seed.difficulty ?? "intermediate",
    physiology: {
      primarySystem,
      secondarySystem: seed.secondarySystem,
      energySystem,
      lactateImpact: seed.lactateImpact ?? "medium",
      cnsLoad: seed.cnsLoad ?? "medium"
    },
    skills: {
      coordination: seed.coordination ?? "medium",
      balance: seed.balance ?? "medium",
      technique: seed.technique ?? "medium"
    },
    purpose: {
      functionalGoals: Array.from(new Set(seed.purpose.functionalGoals)),
      metabolicGoals: Array.from(
        new Set(seed.purpose.metabolicGoals.length ? seed.purpose.metabolicGoals : buildMetabolicGoals(energySystem, seed.category, primarySystem))
      ),
      technicalScope: seed.purpose.technicalScope,
      technicalSports: Array.from(new Set(seed.purpose.technicalSports)),
      technicalTags: Array.from(new Set(seed.purpose.technicalTags))
    },
    provenance: [GENERATED_SOURCE]
  };
}
function strength(id, name, muscleGroups, equipment, sportTags = ["gym"], movementPattern = "strength_pattern", extras = {}) {
  const energySystem = extras.energySystem ?? "mixed";
  return buildRecord({
    id,
    name,
    category: extras.category ?? "strength",
    sportTags,
    movementPattern,
    muscleGroups,
    equipment,
    difficulty: extras.difficulty,
    primarySystem: extras.primarySystem ?? "neuromuscular_strength",
    secondarySystem: extras.secondarySystem ?? (energySystem === "anaerobic_alactic" ? "anaerobic_alactic" : "anaerobic_lactic"),
    energySystem,
    lactateImpact: extras.lactateImpact ?? (energySystem === "anaerobic_alactic" ? "low" : "medium"),
    cnsLoad: extras.cnsLoad ?? "medium",
    coordination: extras.coordination ?? "medium",
    balance: extras.balance ?? "medium",
    technique: extras.technique ?? "medium",
    purpose: {
      functionalGoals: ["strength", ...extras.purpose?.functionalGoals ?? []],
      metabolicGoals: extras.purpose?.metabolicGoals ?? [],
      technicalScope: extras.purpose?.technicalScope ?? "generic",
      technicalSports: extras.purpose?.technicalSports ?? [],
      technicalTags: extras.purpose?.technicalTags ?? []
    }
  });
}
function accessory(id, name, muscleGroups, equipment, sportTags = ["gym"], movementPattern = "accessory_pattern", extras = {}) {
  return buildRecord({
    id,
    name,
    category: "accessory",
    sportTags,
    movementPattern,
    muscleGroups,
    equipment,
    difficulty: extras.difficulty ?? "beginner",
    primarySystem: extras.primarySystem ?? "hypertrophy",
    secondarySystem: extras.secondarySystem ?? "anaerobic_lactic",
    energySystem: extras.energySystem ?? "mixed",
    lactateImpact: extras.lactateImpact ?? "medium",
    cnsLoad: extras.cnsLoad ?? "low",
    coordination: extras.coordination ?? "low",
    balance: extras.balance ?? "low",
    technique: extras.technique ?? "low",
    purpose: {
      functionalGoals: extras.purpose?.functionalGoals ?? ["hypertrophy"],
      metabolicGoals: extras.purpose?.metabolicGoals ?? [],
      technicalScope: extras.purpose?.technicalScope ?? "generic",
      technicalSports: extras.purpose?.technicalSports ?? [],
      technicalTags: extras.purpose?.technicalTags ?? []
    }
  });
}
function conditioning(id, name, muscleGroups, equipment, sportTags, movementPattern = "locomotion", extras = {}) {
  return buildRecord({
    id,
    name,
    category: extras.category ?? "conditioning",
    sportTags,
    movementPattern,
    muscleGroups,
    equipment,
    difficulty: extras.difficulty ?? "intermediate",
    primarySystem: extras.primarySystem ?? "anaerobic_lactic",
    secondarySystem: extras.secondarySystem ?? "neuromuscular_power",
    energySystem: extras.energySystem ?? "anaerobic_lactic",
    lactateImpact: extras.lactateImpact ?? "high",
    cnsLoad: extras.cnsLoad ?? "medium",
    coordination: extras.coordination ?? "medium",
    balance: extras.balance ?? "medium",
    technique: extras.technique ?? "medium",
    purpose: {
      functionalGoals: extras.purpose?.functionalGoals ?? ["muscular_endurance"],
      metabolicGoals: extras.purpose?.metabolicGoals ?? [],
      technicalScope: extras.purpose?.technicalScope ?? "generic",
      technicalSports: extras.purpose?.technicalSports ?? [],
      technicalTags: extras.purpose?.technicalTags ?? []
    }
  });
}
function skill(id, name, muscleGroups, equipment, sportTags, movementPattern = "technical_sequence", extras = {}) {
  return buildRecord({
    id,
    name,
    category: "skill",
    sportTags,
    movementPattern,
    muscleGroups,
    equipment,
    difficulty: extras.difficulty ?? "advanced",
    primarySystem: extras.primarySystem ?? "coordination",
    secondarySystem: extras.secondarySystem ?? "neuromuscular_strength",
    energySystem: extras.energySystem ?? "anaerobic_alactic",
    lactateImpact: extras.lactateImpact ?? "low",
    cnsLoad: extras.cnsLoad ?? "medium",
    coordination: extras.coordination ?? "high",
    balance: extras.balance ?? "high",
    technique: extras.technique ?? "high",
    purpose: {
      functionalGoals: extras.purpose?.functionalGoals ?? ["coordination", "skill"],
      metabolicGoals: extras.purpose?.metabolicGoals ?? ["anaerobic_alactic"],
      technicalScope: extras.purpose?.technicalScope ?? "sport_specific",
      technicalSports: extras.purpose?.technicalSports ?? sportTags.filter((tag) => tag !== "gym"),
      technicalTags: extras.purpose?.technicalTags ?? ["technical_skill"]
    }
  });
}
var BLOCK1_GENERATED_EXERCISES = [
  ...[
    ["hacksquat", "Hack Squat", ["quadriceps", "glutes"], ["machine"]],
    ["beltsquat", "Belt Squat", ["quadriceps", "glutes"], ["machine", "belt"]],
    ["pendulumsquat", "Pendulum Squat", ["quadriceps", "glutes"], ["machine"]],
    ["smithsquat", "Smith Machine Squat", ["quadriceps", "glutes"], ["machine"]],
    ["heelselevatedsquat", "Heels-Elevated Squat", ["quadriceps", "glutes"], ["bodyweight", "dumbbell"]],
    ["landminesquat", "Landmine Squat", ["quadriceps", "glutes", "core"], ["barbell", "landmine"]],
    ["zerchersquat", "Zercher Squat", ["quadriceps", "glutes", "core"], ["barbell"]],
    ["safetybarsquat", "Safety Bar Squat", ["quadriceps", "glutes", "core"], ["barbell", "rack"], ["gym", "powerlifting"]],
    ["reverselunge", "Reverse Lunge", ["quadriceps", "glutes"], ["dumbbell", "barbell"]],
    ["laterallunge", "Lateral Lunge", ["glutes", "quadriceps", "adductors"], ["bodyweight", "dumbbell"]],
    ["cossacksquat", "Cossack Squat", ["glutes", "quadriceps", "adductors"], ["bodyweight"]],
    ["stepdown", "Step-Down", ["quadriceps", "glutes"], ["bodyweight", "bench"]],
    ["pistolsquat", "Pistol Squat", ["quadriceps", "glutes", "core"], ["bodyweight"], ["gym", "crossfit"]],
    ["spanishsquat", "Spanish Squat", ["quadriceps"], ["band"]],
    ["cyclistsquat", "Cyclist Squat", ["quadriceps"], ["bodyweight", "dumbbell"]],
    ["trapbardeadlift", "Trap Bar Deadlift", ["posterior_chain", "glutes", "quadriceps"], ["trap_bar"], ["gym", "hyrox"]],
    ["deficitdeadlift", "Deficit Deadlift", ["posterior_chain", "hamstrings", "glutes"], ["barbell"], ["gym", "powerlifting"]],
    ["sumodeadlift", "Sumo Deadlift", ["posterior_chain", "glutes", "adductors"], ["barbell"], ["gym", "powerlifting"]],
    ["stifflegdeadlift", "Stiff-Leg Deadlift", ["hamstrings", "posterior_chain"], ["barbell", "dumbbell"]],
    ["nordiccurl", "Nordic Curl", ["hamstrings"], ["bodyweight"]],
    ["glutehamraise", "Glute-Ham Raise", ["hamstrings", "glutes"], ["machine"]],
    ["seatedlegcurl", "Seated Leg Curl", ["hamstrings"], ["machine"]],
    ["singlelegpress", "Single-Leg Press", ["quadriceps", "glutes"], ["leg_press"]],
    ["singlelegextension", "Single-Leg Extension", ["quadriceps"], ["machine"]],
    ["cablepullthrough", "Cable Pull-Through", ["glutes", "hamstrings"], ["cable"]],
    ["frogpump", "Frog Pump", ["glutes"], ["bodyweight", "dumbbell"]],
    ["donkeycalfraise", "Donkey Calf Raise", ["calves"], ["machine", "bodyweight"]],
    ["tibialisraise", "Tibialis Raise", ["calves"], ["bodyweight", "machine"]],
    ["smithsplitsquat", "Smith Split Squat", ["quadriceps", "glutes"], ["machine"]],
    ["frontfootelevatedsplit", "Front-Foot Elevated Split Squat", ["quadriceps", "glutes"], ["dumbbell", "bench"]]
  ].map(
    ([id, name, muscles, equipment, sports]) => strength(id, name, muscles, equipment, sports ?? ["gym"], name.toLowerCase().includes("deadlift") || id.includes("curl") ? "hinge" : "squat")
  ),
  ...[
    ["inclinebarbellpress", "Incline Barbell Press", ["chest", "shoulders", "triceps"], ["barbell", "bench"], ["gym"]],
    ["declinebenchpress", "Decline Bench Press", ["chest", "triceps"], ["barbell", "bench"], ["gym"]],
    ["dumbbellbenchpress", "Dumbbell Bench Press", ["chest", "shoulders", "triceps"], ["dumbbell", "bench"], ["gym"]],
    ["dumbbellshoulderpress", "Dumbbell Shoulder Press", ["shoulders", "triceps", "core"], ["dumbbell"], ["gym"]],
    ["arnoldpress", "Arnold Press", ["shoulders", "triceps"], ["dumbbell"], ["gym"]],
    ["landminepress", "Landmine Press", ["shoulders", "chest", "core"], ["barbell", "landmine"], ["gym"]],
    ["pushpress", "Push Press", ["shoulders", "triceps", "quadriceps"], ["barbell", "dumbbell"], ["crossfit", "gym"]],
    ["machineshoulderpress", "Machine Shoulder Press", ["shoulders", "triceps"], ["machine"], ["gym"]],
    ["smithbenchpress", "Smith Bench Press", ["chest", "triceps", "shoulders"], ["machine", "bench"], ["gym"]],
    ["floorpress", "Floor Press", ["chest", "triceps"], ["barbell", "dumbbell"], ["gym", "powerlifting"]],
    ["neutralgripdbpress", "Neutral-Grip Dumbbell Press", ["chest", "triceps"], ["dumbbell", "bench"], ["gym"]],
    ["cablechestpress", "Cable Chest Press", ["chest", "triceps", "shoulders"], ["cable"], ["gym"]],
    ["ringpushup", "Ring Push-Up", ["chest", "triceps", "core"], ["rings", "bodyweight"], ["gym", "crossfit"]],
    ["pikepushup", "Pike Push-Up", ["shoulders", "triceps", "core"], ["bodyweight"], ["gym"]],
    ["handstandpushup", "Handstand Push-Up", ["shoulders", "triceps", "core"], ["bodyweight"], ["crossfit", "gym"]],
    ["inclinepushup", "Incline Push-Up", ["chest", "triceps"], ["bodyweight", "bench"], ["gym"]],
    ["declinepushup", "Decline Push-Up", ["chest", "shoulders", "triceps"], ["bodyweight", "bench"], ["gym"]],
    ["assisteddip", "Assisted Dip", ["chest", "triceps", "shoulders"], ["machine"], ["gym"]],
    ["machinefly", "Machine Fly", ["chest"], ["machine"], ["gym"]],
    ["lowtohighfly", "Low-to-High Cable Fly", ["chest", "shoulders"], ["cable"], ["gym"]],
    ["hightolowfly", "High-to-Low Cable Fly", ["chest"], ["cable"], ["gym"]],
    ["platefrontraise", "Plate Front Raise", ["shoulders"], ["weight_plate"], ["gym"]],
    ["benchdip", "Bench Dip", ["triceps", "shoulders"], ["bench", "bodyweight"], ["gym"]],
    ["overheadtricepsext", "Overhead Triceps Extension", ["triceps"], ["dumbbell", "cable"], ["gym"]],
    ["cableoverheadtriceps", "Cable Overhead Triceps Extension", ["triceps"], ["cable"], ["gym"]],
    ["dumbbellkickback", "Dumbbell Kickback", ["triceps"], ["dumbbell"], ["gym"]],
    ["jmpress", "JM Press", ["triceps", "chest"], ["barbell", "bench"], ["gym", "powerlifting"]],
    ["guillotinepress", "Guillotine Press", ["chest", "shoulders"], ["barbell", "bench"], ["gym"]]
  ].map(
    ([id, name, muscles, equipment, sports]) => strength(id, name, muscles, equipment, sports, "push")
  ),
  ...[
    ["chinup", "Chin-Up", ["lats", "biceps", "core"], ["bodyweight", "pullup_bar"], ["gym"]],
    ["assistedpullup", "Assisted Pull-Up", ["lats", "biceps"], ["machine"], ["gym"]],
    ["neutralgrippulldown", "Neutral-Grip Pulldown", ["lats", "biceps"], ["cable", "machine"], ["gym"]],
    ["singlearmpulldown", "Single-Arm Pulldown", ["lats", "biceps"], ["cable"], ["gym"]],
    ["singlearmrow", "Single-Arm Dumbbell Row", ["lats", "upper_back", "biceps"], ["dumbbell", "bench"], ["gym"]],
    ["sealrow", "Seal Row", ["upper_back", "lats", "biceps"], ["barbell", "bench"], ["gym"]],
    ["invertedrow", "Inverted Row", ["upper_back", "lats", "biceps"], ["bodyweight", "barbell"], ["gym"]],
    ["meadowsrow", "Meadows Row", ["lats", "upper_back"], ["barbell", "landmine"], ["gym"]],
    ["machinehighrow", "Machine High Row", ["upper_back", "lats"], ["machine"], ["gym"]],
    ["machinelowrow", "Machine Low Row", ["lats", "upper_back"], ["machine"], ["gym"]],
    ["cablepullover", "Cable Pullover", ["lats", "upper_back"], ["cable"], ["gym"]],
    ["machinepullover", "Machine Pullover", ["lats", "chest"], ["machine"], ["gym"]],
    ["shrug", "Barbell Shrug", ["upper_back", "forearms"], ["barbell", "dumbbell"], ["gym"]],
    ["inclinecurl", "Incline Curl", ["biceps"], ["dumbbell", "bench"], ["gym"]],
    ["concentrationcurl", "Concentration Curl", ["biceps"], ["dumbbell"], ["gym"]],
    ["spidercurl", "Spider Curl", ["biceps"], ["dumbbell", "bench"], ["gym"]],
    ["cablecurl", "Cable Curl", ["biceps", "forearms"], ["cable"], ["gym"]],
    ["preacherhammercurl", "Preacher Hammer Curl", ["biceps", "forearms"], ["dumbbell", "bench"], ["gym"]],
    ["wristcurl", "Wrist Curl", ["forearms"], ["barbell", "dumbbell"], ["gym"]],
    ["reversewristcurl", "Reverse Wrist Curl", ["forearms"], ["barbell", "dumbbell"], ["gym"]],
    ["zottmancurl", "Zottman Curl", ["biceps", "forearms"], ["dumbbell"], ["gym"]],
    ["trapbarshrug", "Trap Bar Shrug", ["upper_back", "forearms"], ["trap_bar"], ["gym"]],
    ["yraise", "Y Raise", ["upper_back", "shoulders"], ["dumbbell", "cable"], ["gym"]],
    ["bandpullapart", "Band Pull-Apart", ["upper_back", "shoulders"], ["band"], ["gym"]],
    ["scappullup", "Scap Pull-Up", ["lats", "upper_back"], ["bodyweight", "pullup_bar"], ["gym", "crossfit"]],
    ["widegripseatedrow", "Wide-Grip Seated Row", ["upper_back", "lats"], ["cable"], ["gym"]],
    ["ropehammercurl", "Rope Hammer Curl", ["biceps", "forearms"], ["cable"], ["gym"]],
    ["rackpull", "Rack Pull", ["posterior_chain", "upper_back"], ["barbell", "rack"], ["gym", "powerlifting"]]
  ].map(
    ([id, name, muscles, equipment, sports]) => strength(id, name, muscles, equipment, sports, "pull")
  ),
  ...[
    ["deadbug", "Dead Bug", ["core"], ["bodyweight"], ["gym"]],
    ["hollowhold", "Hollow Hold", ["core"], ["bodyweight"], ["gym", "crossfit"]],
    ["pallofpress", "Pallof Press", ["core", "obliques"], ["cable", "band"], ["gym"]],
    ["sideplank", "Side Plank", ["core", "obliques"], ["bodyweight"], ["gym"]],
    ["weightedsitup", "Weighted Sit-Up", ["core", "hip_flexors"], ["bodyweight", "weight_plate"], ["gym"]],
    ["hanginglegraise", "Hanging Leg Raise", ["core", "hip_flexors"], ["pullup_bar", "bodyweight"], ["gym", "crossfit"]],
    ["cablecrunch", "Cable Crunch", ["core"], ["cable"], ["gym"]],
    ["reversecrunch", "Reverse Crunch", ["core", "hip_flexors"], ["bodyweight"], ["gym"]],
    ["mountainclimber", "Mountain Climber", ["core", "hip_flexors"], ["bodyweight"], ["gym", "crossfit"]],
    ["birddog", "Bird Dog", ["core", "glutes"], ["bodyweight"], ["gym"]],
    ["suitcasecarry", "Suitcase Carry", ["core", "forearms"], ["dumbbell", "kettlebell"], ["gym", "hyrox"]],
    ["waitercarry", "Waiter Carry", ["core", "shoulders"], ["dumbbell", "kettlebell"], ["gym"]],
    ["stirthepot", "Stir the Pot", ["core", "shoulders"], ["exercise_ball"], ["gym"]],
    ["bodysaw", "Body Saw", ["core", "shoulders"], ["bodyweight", "slide_disc"], ["gym"]],
    ["dragonflag", "Dragon Flag", ["core", "hip_flexors"], ["bodyweight", "bench"], ["gym"]],
    ["landminerotation", "Landmine Rotation", ["core", "obliques"], ["barbell", "landmine"], ["gym"]],
    ["woodchop", "Wood Chop", ["core", "obliques"], ["cable"], ["gym"]],
    ["backextension", "Back Extension", ["posterior_chain", "glutes"], ["machine", "bodyweight"], ["gym"]],
    ["supermanhold", "Superman Hold", ["posterior_chain", "core"], ["bodyweight"], ["gym"]],
    ["openhagenadduction", "Copenhagen Adduction", ["core", "adductors"], ["bodyweight", "bench"], ["gym"]]
  ].map(
    ([id, name, muscles, equipment, sports]) => accessory(id, name, muscles, equipment, sports, "core_control", {
      primarySystem: ["pallofpress", "bodysaw", "sideplank", "birddog", "openhagenadduction"].includes(id) ? "stability" : "stability",
      purpose: {
        functionalGoals: ["stability_neuro"],
        metabolicGoals: ["recovery"],
        technicalScope: "generic",
        technicalSports: [],
        technicalTags: []
      }
    })
  ),
  ...[
    ["assaultbike", "Assault Bike Sprint", ["full_body"], ["air_bike"], ["crossfit", "hyrox"]],
    ["echobike", "Echo Bike", ["full_body"], ["air_bike"], ["crossfit", "hyrox"]],
    ["battle ropes", "Battle Ropes", ["shoulders", "core", "full_body"], ["rope"], ["gym", "crossfit"]],
    ["shuttlerun", "Shuttle Run", ["full_body", "calves"], ["bodyweight"], ["hyrox", "crossfit", "gym"]],
    ["bearcrawl", "Bear Crawl", ["core", "shoulders", "full_body"], ["bodyweight"], ["crossfit", "gym"]],
    ["crabwalk", "Crab Walk", ["core", "shoulders", "glutes"], ["bodyweight"], ["gym"]],
    ["boxstepover", "Box Step-Over", ["quadriceps", "glutes", "core"], ["plyo_box", "bodyweight"], ["hyrox", "crossfit"]],
    ["broadjump", "Broad Jump", ["glutes", "quadriceps", "calves"], ["bodyweight"], ["crossfit", "gym"]],
    ["sleddragbackward", "Backward Sled Drag", ["quadriceps", "calves"], ["sled", "rope"], ["hyrox", "gym"]],
    ["sandbagcarry", "Sandbag Carry", ["core", "full_body"], ["sandbag"], ["hyrox", "crossfit"]],
    ["sandbaglunge", "Sandbag Lunge", ["quadriceps", "glutes", "core"], ["sandbag"], ["hyrox", "crossfit"]],
    ["devilpress", "Devil Press", ["full_body", "shoulders", "core"], ["dumbbell"], ["crossfit"]],
    ["dumbbellsnatch", "Dumbbell Snatch", ["full_body", "shoulders", "glutes"], ["dumbbell"], ["crossfit", "gym"]],
    ["powerclean", "Power Clean", ["full_body", "posterior_chain"], ["barbell"], ["crossfit", "weightlifting"]],
    ["hangpowerclean", "Hang Power Clean", ["full_body", "posterior_chain"], ["barbell"], ["crossfit", "weightlifting"]],
    ["wallwalk", "Wall Walk", ["shoulders", "core"], ["bodyweight"], ["crossfit"]],
    ["skibound", "Ski Bound", ["glutes", "calves", "core"], ["bodyweight"], ["hyrox", "gym"]],
    ["medballslam", "Medicine Ball Slam", ["core", "lats", "full_body"], ["medicine_ball"], ["crossfit", "gym"]],
    ["cleanandjerk", "Clean and Jerk", ["full_body", "shoulders", "glutes"], ["barbell"], ["crossfit", "weightlifting"]],
    ["snatchbalance", "Snatch Balance", ["full_body", "shoulders", "quadriceps"], ["barbell"], ["crossfit", "weightlifting"]]
  ].map(
    ([id, name, muscles, equipment, sports]) => (() => {
      const sportTags = sports;
      return conditioning(
        String(id).replace(/\s+/g, ""),
        String(name),
        muscles,
        equipment,
        sportTags,
        ["broadjump", "skibound"].includes(String(id).replace(/\s+/g, "")) ? "jump_landing" : "locomotion",
        {
          purpose: {
            functionalGoals: ["muscular_endurance", ...String(name).includes("Jump") || String(name).includes("Clean") || String(name).includes("Snatch") ? ["power"] : []],
            metabolicGoals: [],
            technicalScope: sportTags.includes("crossfit") || sportTags.includes("hyrox") ? "sport_specific" : "generic",
            technicalSports: sportTags.filter((tag) => tag !== "gym"),
            technicalTags: sportTags.includes("hyrox") ? ["race_specific"] : sportTags.includes("crossfit") ? ["mixed_modal_specific"] : []
          },
          energySystem: sportTags.includes("hyrox") ? "mixed" : void 0
        }
      );
    })()
  ),
  ...[
    skill("competitionsquat", "Competition Squat", ["quadriceps", "glutes", "core"], ["barbell", "rack"], ["powerlifting"], "squat", {
      purpose: { functionalGoals: ["strength", "skill"], metabolicGoals: ["anaerobic_alactic", "anabolic"], technicalScope: "sport_specific", technicalSports: ["powerlifting"], technicalTags: ["strength_sport_specific"] },
      primarySystem: "neuromuscular_strength",
      secondarySystem: "anaerobic_alactic"
    }),
    skill("competitionbench", "Competition Bench Press", ["chest", "triceps", "shoulders"], ["barbell", "bench"], ["powerlifting"], "push", {
      purpose: { functionalGoals: ["strength", "skill"], metabolicGoals: ["anaerobic_alactic", "anabolic"], technicalScope: "sport_specific", technicalSports: ["powerlifting"], technicalTags: ["strength_sport_specific"] },
      primarySystem: "neuromuscular_strength",
      secondarySystem: "anaerobic_alactic"
    }),
    skill("competitiondeadlift", "Competition Deadlift", ["posterior_chain", "glutes"], ["barbell"], ["powerlifting"], "hinge", {
      purpose: { functionalGoals: ["strength", "skill"], metabolicGoals: ["anaerobic_alactic", "anabolic"], technicalScope: "sport_specific", technicalSports: ["powerlifting"], technicalTags: ["strength_sport_specific"] },
      primarySystem: "neuromuscular_strength",
      secondarySystem: "anaerobic_alactic"
    }),
    skill("pinsquat", "Pin Squat", ["quadriceps", "glutes", "core"], ["barbell", "rack"], ["powerlifting"], "squat", {
      purpose: { functionalGoals: ["strength", "skill"], metabolicGoals: ["anaerobic_alactic", "anabolic"], technicalScope: "sport_specific", technicalSports: ["powerlifting"], technicalTags: ["strength_sport_specific"] },
      primarySystem: "neuromuscular_strength"
    }),
    skill("boardpress", "Board Press", ["chest", "triceps"], ["barbell", "bench"], ["powerlifting"], "push", {
      purpose: { functionalGoals: ["strength", "skill"], metabolicGoals: ["mixed", "anabolic"], technicalScope: "sport_specific", technicalSports: ["powerlifting"], technicalTags: ["strength_sport_specific"] },
      primarySystem: "neuromuscular_strength"
    }),
    skill("spotopress", "Spoto Press", ["chest", "triceps", "shoulders"], ["barbell", "bench"], ["powerlifting"], "push", {
      purpose: { functionalGoals: ["strength", "skill"], metabolicGoals: ["mixed", "anabolic"], technicalScope: "sport_specific", technicalSports: ["powerlifting"], technicalTags: ["strength_sport_specific"] },
      primarySystem: "neuromuscular_strength"
    }),
    skill("blockpull", "Block Pull", ["posterior_chain", "glutes"], ["barbell", "blocks"], ["powerlifting"], "hinge", {
      purpose: { functionalGoals: ["strength", "skill"], metabolicGoals: ["anaerobic_alactic", "anabolic"], technicalScope: "sport_specific", technicalSports: ["powerlifting"], technicalTags: ["strength_sport_specific"] },
      primarySystem: "neuromuscular_strength"
    }),
    skill("pausedeadlift", "Pause Deadlift", ["posterior_chain", "glutes"], ["barbell"], ["powerlifting"], "hinge", {
      purpose: { functionalGoals: ["strength", "skill"], metabolicGoals: ["mixed", "anabolic"], technicalScope: "sport_specific", technicalSports: ["powerlifting"], technicalTags: ["strength_sport_specific"] },
      primarySystem: "neuromuscular_strength"
    }),
    skill("burpeebroadjump", "Burpee Broad Jump", ["full_body", "quadriceps", "core"], ["bodyweight"], ["hyrox"], "jump_landing", {
      purpose: { functionalGoals: ["power", "muscular_endurance"], metabolicGoals: ["anaerobic_lactic", "catabolic"], technicalScope: "sport_specific", technicalSports: ["hyrox"], technicalTags: ["race_specific"] },
      primarySystem: "anaerobic_lactic",
      secondarySystem: "neuromuscular_power",
      coordination: "high",
      balance: "medium",
      technique: "medium"
    }),
    skill("sandbagfrontcarry", "Sandbag Front Carry", ["core", "full_body"], ["sandbag"], ["hyrox"], "carry", {
      purpose: { functionalGoals: ["strength", "muscular_endurance"], metabolicGoals: ["mixed", "catabolic"], technicalScope: "sport_specific", technicalSports: ["hyrox"], technicalTags: ["race_specific"] },
      primarySystem: "neuromuscular_strength",
      secondarySystem: "aerobic"
    }),
    skill("sleddrag", "Sled Drag", ["posterior_chain", "forearms", "quadriceps"], ["sled", "rope"], ["hyrox"], "carry", {
      purpose: { functionalGoals: ["strength", "muscular_endurance"], metabolicGoals: ["mixed", "catabolic"], technicalScope: "sport_specific", technicalSports: ["hyrox"], technicalTags: ["race_specific"] },
      primarySystem: "neuromuscular_strength",
      secondarySystem: "aerobic"
    }),
    skill("muscleup", "Muscle-Up", ["lats", "triceps", "core"], ["rings", "pullup_bar"], ["crossfit"], "technical_sequence", {
      purpose: { functionalGoals: ["coordination", "skill", "strength"], metabolicGoals: ["anaerobic_alactic"], technicalScope: "sport_specific", technicalSports: ["crossfit"], technicalTags: ["technical_skill", "mixed_modal_specific"] }
    }),
    skill("chesttobar", "Chest-to-Bar Pull-Up", ["lats", "biceps", "core"], ["pullup_bar", "bodyweight"], ["crossfit"], "technical_sequence", {
      purpose: { functionalGoals: ["coordination", "skill", "strength"], metabolicGoals: ["anaerobic_alactic"], technicalScope: "sport_specific", technicalSports: ["crossfit"], technicalTags: ["technical_skill", "mixed_modal_specific"] }
    }),
    skill("doubleunder", "Double Under", ["calves", "full_body"], ["rope", "bodyweight"], ["crossfit"], "technical_sequence", {
      purpose: { functionalGoals: ["coordination", "skill", "muscular_endurance"], metabolicGoals: ["aerobic", "catabolic"], technicalScope: "sport_specific", technicalSports: ["crossfit"], technicalTags: ["technical_skill", "mixed_modal_specific"] },
      energySystem: "aerobic",
      primarySystem: "coordination"
    }),
    skill("sandbagshouldering", "Sandbag Shouldering", ["full_body", "glutes", "core"], ["sandbag"], ["hyrox", "crossfit"], "technical_sequence", {
      purpose: { functionalGoals: ["strength", "power", "skill"], metabolicGoals: ["mixed", "catabolic"], technicalScope: "sport_specific", technicalSports: ["hyrox", "crossfit"], technicalTags: ["race_specific", "mixed_modal_specific"] },
      primarySystem: "neuromuscular_power",
      secondarySystem: "neuromuscular_strength"
    }),
    skill("wallballshot", "Wall Ball Shot", ["quadriceps", "shoulders", "core"], ["medicine_ball", "wall_target"], ["crossfit", "hyrox"], "technical_sequence", {
      purpose: { functionalGoals: ["coordination", "power", "muscular_endurance"], metabolicGoals: ["anaerobic_lactic", "catabolic"], technicalScope: "sport_specific", technicalSports: ["crossfit", "hyrox"], technicalTags: ["mixed_modal_specific", "race_specific"] },
      primarySystem: "anaerobic_lactic",
      secondarySystem: "neuromuscular_power"
    })
  ]
];

// apps/web/lib/training/exercise-library/catalog-loader.ts
function loadUnifiedExerciseCatalog() {
  const baseCatalog = exercise_library_default;
  const exercises = [...baseCatalog.exercises, ...BLOCK1_GENERATED_EXERCISES];
  return {
    ...baseCatalog,
    count: exercises.length,
    exercises
  };
}

// apps/web/lib/training/exercise-library/catalog-db-core.ts
var CATALOG_TABLE = "exercise_catalog";
var SELECT_COLUMNS = [
  "id",
  "slug",
  "name",
  "category",
  "sport_tags",
  "movement_pattern",
  "muscle_groups",
  "equipment",
  "difficulty",
  "primary_system",
  "energy_system",
  "physiology",
  "skills",
  "purpose",
  "provenance",
  "media"
].join(", ");
async function loadUnifiedExerciseCatalogWithClient(client) {
  try {
    const { data, error } = await client.from(CATALOG_TABLE).select(SELECT_COLUMNS).order("id", { ascending: true });
    if (error) throw new Error(error.message);
    const rows = data ?? [];
    if (rows.length === 0) return loadUnifiedExerciseCatalog();
    return rowsToCatalogFile(rows);
  } catch {
    return loadUnifiedExerciseCatalog();
  }
}

// apps/web/lib/training/exercise-library/selector.ts
function normalizeToken(s) {
  return s.trim().toLowerCase();
}
function selectExercises(catalog, query) {
  const limit = query.limit ?? 12;
  const { primarySystem, energySystem, movementPattern, equipmentIncludes, sportTag } = query;
  return catalog.exercises.filter((ex) => {
    if (primarySystem && normalizeToken(ex.physiology.primarySystem) !== normalizeToken(primarySystem)) return false;
    if (energySystem && normalizeToken(ex.physiology.energySystem) !== normalizeToken(energySystem)) return false;
    if (movementPattern && normalizeToken(ex.movementPattern) !== normalizeToken(movementPattern)) return false;
    if (sportTag && !ex.sportTags.some((t) => normalizeToken(t) === normalizeToken(sportTag))) return false;
    if (equipmentIncludes) {
      const q = normalizeToken(equipmentIncludes);
      const ok = ex.equipment.some((e) => normalizeToken(e).includes(q));
      if (!ok) return false;
    }
    return true;
  }).slice(0, limit);
}

// apps/web/lib/training/library/starter-pack-aerobic-catalog-structures.ts
var FTP = DEFAULT_STARTER_RENDER.ftpW;
var STRUCTURE_RICH_PRESETS = [
  // —— Piramidi & rampe ——
  preset(
    "cyc_pyramid_z4_7step",
    "Cycling",
    "Piramide \xB7 7 scalini Z2\u2192Z5\u2192Z2",
    "Piramide watt progressiva e regressiva \u2014 variabilit\xE0 continua.",
    "vo2max",
    "build",
    ["pyramid", "progressive", "vo2", "quality"],
    88,
    92,
    [
      py("Piramide soglia-VO\u2082", 7, 180, Math.round(FTP * 0.72), Math.round(FTP * 1.06), "7\xD73\u2032 scalini"),
      st("Flush Z2", 8, "Z2")
    ],
    { warm: 10, cool: 10 }
  ),
  preset(
    "cyc_ramp_lt2_25",
    "Cycling",
    "Rampa \xB7 25\u2032 Z2\u2192LT2",
    "Progressione lineare fino soglia \u2014 niente salti.",
    "lactate_clearance",
    "build",
    ["ramp", "threshold", "progressive"],
    75,
    78,
    [rm("Rampa soglia", 25, "Z2", "LT2", "Incremento continuo ~1%/3\u2032")],
    { warm: 12, cool: 10 }
  ),
  preset(
    "cyc_ramp_openers",
    "Cycling",
    "Openers \xB7 Z2 + ramp Z3\u2192Z5",
    "Uscita Z2 con openers progressivi pre-gara.",
    "neuromuscular",
    "peak",
    ["ramp", "openers", "race"],
    70,
    68,
    [
      st("Z2 volume", 25, "Z2"),
      rm("Opener ramp", 8, "Z3", "Z5"),
      iv("3\xD71\u2032 snap", 3, 60, 180, "Z6", "Z1"),
      st("Z2 home", 10, "Z2")
    ],
    { warm: 10, cool: 8 }
  ),
  // —— Multi-tier con recupero cospicuo ——
  preset(
    "cyc_vo2_tiered_5x5",
    "Cycling",
    "VO\u2082 tier \xB7 3\xD75\u2032 + 8\u2032 + 2\xD75\u2032",
    "Due tier VO\u2082 separati da recupero profondo 8\u2032.",
    "vo2max",
    "build",
    ["vo2", "tier", "intervals", "quality"],
    95,
    98,
    [
      iv("Tier A \xB7 3\xD75\u2032", 3, 300, 180, "Z5", "Z1"),
      rec(8),
      iv("Tier B \xB7 2\xD75\u2032", 2, 300, 240, "Z5", "Z1"),
      st("Z2 flush", 12, "Z2")
    ],
    { warm: 12, cool: 10 }
  ),
  preset(
    "cyc_norwegian_tier_4x4",
    "Cycling",
    "Norvegese tier \xB7 4\xD74\u2032 \xD72 (10\u2032 tra serie)",
    "Doppia serie 4\xD74 con 10\u2032 Z1 tra blocchi \u2014 formato nordico completo.",
    "vo2max",
    "build",
    ["norwegian", "vo2", "4x4", "tier"],
    105,
    108,
    [
      iv("Serie 1 \xB7 4\xD74\u2032", 4, 240, 240, "Z5", "Z1"),
      rec(10),
      iv("Serie 2 \xB7 4\xD74\u2032", 4, 240, 240, "Z5", "Z1")
    ],
    { warm: 12, cool: 12 }
  ),
  preset(
    "cyc_lactate_2x20_deep",
    "Cycling",
    "Lattacido \xB7 2\xD720\u2032 Z4 (12\u2032 rec)",
    "Due blocchi soglia lunghi \u2014 recupero generoso tra i lavori.",
    "lactate_tolerance",
    "build",
    ["lactate", "z4", "threshold"],
    95,
    102,
    [st("Blocco soglia 1", 20, "Z4"), rec(12), st("Blocco soglia 2", 20, "Z4")],
    { warm: 15, cool: 12 }
  ),
  preset(
    "cyc_sweetspot_tier_3x15",
    "Cycling",
    "Sweet spot tier \xB7 3\xD715\u2032 (6\u2032 rec)",
    "Tre blocchi SS con recupero attivo medio.",
    "lactate_clearance",
    "build",
    ["z3", "sweet_spot", "tempo"],
    90,
    88,
    [
      st("SS 1", 15, "Z3"),
      rec(6, "Z1"),
      st("SS 2", 15, "Z3"),
      rec(6, "Z1"),
      st("SS 3", 15, "Z3")
    ],
    { warm: 12, cool: 10 }
  ),
  // —— Decrescenti & misti ——
  preset(
    "cyc_descending_5_4_3_2_1",
    "Cycling",
    "Decrescente \xB7 5\u2032-4\u2032-3\u2032-2\u2032-1\u2032 @ Z5",
    "Scaletta decrescente VO\u2082 \u2014 lavori diversi ogni step.",
    "vo2max",
    "build",
    ["vo2", "descending", "intervals"],
    80,
    85,
    [
      st("5\u2032 Z5", 5, "Z5"),
      rec(3),
      st("4\u2032 Z5", 4, "Z5"),
      rec(3),
      st("3\u2032 Z5", 3, "Z5"),
      rec(3),
      st("2\u2032 Z5", 2, "Z5"),
      rec(3),
      st("1\u2032 Z5", 1, "Z5"),
      st("Z2 flush", 10, "Z2")
    ],
    { warm: 12, cool: 10 }
  ),
  preset(
    "cyc_mixed_quality_day",
    "Cycling",
    "Giornata mista \xB7 tempo + VO\u2082 + sprint",
    "Tre famiglie di stimolo nello stesso file \u2014 variabilit\xE0 alta.",
    "vo2max",
    "build",
    ["mixed", "vo2", "sprint", "tempo"],
    100,
    105,
    [
      st("Tempo Z3", 18, "Z3"),
      rec(8),
      iv("4\xD73\u2032 VO\u2082", 4, 180, 180, "Z5", "Z1"),
      rec(10),
      iv("6\xD730\u2033 sprint", 6, 30, 150, "Z6", "Z1"),
      st("Z2 cool-down block", 8, "Z2")
    ],
    { warm: 12, cool: 10 }
  ),
  preset(
    "cyc_over_under_i3",
    "Cycling",
    "Over-under \xB7 3\xD7(2\u2032Z4/1\u2032Z3/2\u2032Z4)",
    "Pattern over-under a tre fasi \u2014 interval3.",
    "lactate_tolerance",
    "build",
    ["over-under", "z4", "z3", "lactate"],
    78,
    82,
    [
      i3("OU block 1", 3, 120, 60, 120, "Z4", "Z3", "Z4"),
      rec(5),
      i3("OU block 2", 3, 120, 60, 120, "Z4", "Z3", "Z4")
    ],
    { warm: 12, cool: 10 }
  ),
  preset(
    "cyc_cruise_3x12",
    "Cycling",
    "Cruise \xB7 3\xD712\u2032 Z3 (5\u2032 rec)",
    "Intervalli cruise lunghi \u2014 stile half-marathon.",
    "lactate_clearance",
    "build",
    ["cruise", "z3", "tempo"],
    85,
    80,
    [
      st("Cruise 1", 12, "Z3"),
      rec(5),
      st("Cruise 2", 12, "Z3"),
      rec(5),
      st("Cruise 3", 12, "Z3")
    ],
    { warm: 12, cool: 10 }
  ),
  preset(
    "cyc_billat_progression",
    "Cycling",
    "Billat \xB7 30\u2033/30\u2033 + 15\u2033/15\u2033 + 10\u2033/10\u2033",
    "Tre densit\xE0 micro-intervallo in sequenza.",
    "vo2max",
    "build",
    ["hit", "30-30", "billat", "vo2"],
    65,
    78,
    [
      iv("30\u2033/30\u2033 \xD712", 12, 30, 30, "Z5", "Z1"),
      rec(6),
      iv("15\u2033/15\u2033 \xD710", 10, 15, 15, "Z6", "Z1"),
      rec(6),
      iv("10\u2033/10\u2033 \xD78", 8, 10, 10, "Z6", "Z1")
    ],
    { warm: 10, cool: 8 }
  ),
  preset(
    "cyc_polarized_split",
    "Cycling",
    "Polarizzato split \xB7 50\u2032 Z2 + tier VO\u2082",
    "Volume Z2 isolato poi blocco qualit\xE0 separato.",
    "vo2max",
    "build",
    ["polarized", "z2", "vo2", "long"],
    110,
    95,
    [st("Z2 puro", 50, "Z2"), rec(5), iv("4\xD74\u2032 Z5", 4, 240, 240, "Z5", "Z1")],
    { warm: 10, cool: 12 }
  ),
  // —— Running strutturato ——
  preset(
    "run_yasso_800s",
    "Running",
    "Yasso 800 \xB7 6\xD7800 m equiv.",
    "6\xD73\u2032 Z5 con 3\u2032 rec \u2014 benchmark maratona.",
    "vo2max",
    "build",
    ["running", "vo2", "yasso", "intervals"],
    70,
    75,
    [
      iv("6\xD7800 m", 6, 180, 180, "Z5", "Z1"),
      st("Z2 easy", 12, "Z2")
    ],
    { warm: 12, cool: 10 }
  ),
  preset(
    "run_cruise_tempo_tier",
    "Running",
    "Cruise tempo \xB7 2\xD715\u2032 + 8\u2032 rec + 1\xD710\u2032",
    "Due tempi lunghi + chiusura \u2014 tier running.",
    "lactate_clearance",
    "build",
    ["running", "tempo", "cruise", "z3"],
    80,
    78,
    [
      st("Tempo 1", 15, "Z3"),
      rec(4),
      st("Tempo 2", 15, "Z3"),
      rec(8),
      st("Tempo chiusura", 10, "Z3")
    ],
    { warm: 12, cool: 10 }
  ),
  preset(
    "run_hill_tier",
    "Running",
    "Hill tier \xB7 4\xD74\u2032 + 10\u2032 + 3\xD73\u2032",
    "Salite lunghe poi serie corte \u2014 due stimoli.",
    "lactate_tolerance",
    "build",
    ["running", "hill", "force", "tier"],
    75,
    82,
    [
      iv("4\xD74\u2032 hill", 4, 240, 180, "Z4", "Z1"),
      rec(10),
      iv("3\xD73\u2032 hill", 3, 180, 120, "Z5", "Z1")
    ],
    { warm: 12, cool: 10 }
  ),
  preset(
    "run_progressive_long",
    "Running",
    "Long progressive \xB7 Z2\u2192Z3\u2192Z4",
    "Uscita lunga a intensit\xE0 crescente per blocchi.",
    "aerobic_base",
    "build",
    ["running", "progressive", "long"],
    95,
    72,
    [
      st("Z2 easy", 30, "Z2"),
      rm("Rampa Z2\u2192Z3", 15, "Z2", "Z3"),
      st("Z3 mod", 12, "Z3"),
      st("Z4 finish", 8, "Z4")
    ],
    { warm: 10, cool: 10 }
  ),
  // —— Swim strutturato ——
  preset(
    "swm_mixed_set",
    "Swimming",
    "Mixed set \xB7 400 + 8\xD7100 + 8\xD750",
    "Tre distanze diverse \u2014 aerobico \u2192 soglia \u2192 VO\u2082.",
    "vo2max",
    "build",
    ["swimming", "mixed", "intervals"],
    65,
    58,
    [
      st("400 m aerobic", 8, "Z2"),
      rec(3),
      iv("8\xD7100 m", 8, 90, 30, "Z4", "Z1"),
      rec(5),
      iv("8\xD750 m", 8, 45, 25, "Z5", "Z1")
    ],
    { warm: 10, cool: 8 }
  ),
  preset(
    "swm_pyramid_100s",
    "Swimming",
    "Pyramid 100 m \xB7 1-2-3-4-3-2-1",
    "Piramide di ripetute \u2014 variet\xE0 distanza.",
    "lactate_clearance",
    "build",
    ["swimming", "pyramid", "intervals"],
    60,
    52,
    [
      st("100 m", 2, "Z3"),
      rec(1),
      st("200 m", 4, "Z3"),
      rec(2),
      st("300 m", 6, "Z4"),
      rec(2),
      st("400 m", 8, "Z4"),
      rec(2),
      st("300 m", 6, "Z4"),
      rec(2),
      st("200 m", 4, "Z3"),
      rec(1),
      st("100 m", 2, "Z3")
    ],
    { warm: 10, cool: 8 }
  )
];

// apps/web/lib/training/library/starter-pack-aerobic-catalog-structures-ext.ts
var FTP2 = DEFAULT_STARTER_RENDER.ftpW;
var STRUCTURE_RICH_PRESETS_EXT = [
  // —— Cycling ——
  preset(
    "cyc_ascending_2_6_z4",
    "Cycling",
    "Ascendente \xB7 2\u2032-6\u2032 Z4",
    "Intervalli crescenti a soglia \u2014 ogni blocco diverso.",
    "lactate_tolerance",
    "build",
    ["ascending", "threshold", "z4", "intervals"],
    82,
    88,
    [
      st("2\u2032 Z4", 2, "Z4"),
      rec(3),
      st("3\u2032 Z4", 3, "Z4"),
      rec(3),
      st("4\u2032 Z4", 4, "Z4"),
      rec(4),
      st("5\u2032 Z4", 5, "Z4"),
      rec(4),
      st("6\u2032 Z4", 6, "Z4"),
      st("Z2 flush", 8, "Z2")
    ],
    { warm: 12, cool: 10 }
  ),
  preset(
    "cyc_threshold_vo2_combo",
    "Cycling",
    "Combo \xB7 2\xD712\u2032 Z4 + 4\xD73\u2032 VO\u2082",
    "Soglia poi VO\u2082 nello stesso file \u2014 due qualit\xE0 separate.",
    "vo2max",
    "build",
    ["mixed", "threshold", "vo2", "combo"],
    92,
    98,
    [
      st("Soglia 1", 12, "Z4"),
      rec(5),
      st("Soglia 2", 12, "Z4"),
      rec(10),
      iv("4\xD73\u2032 VO\u2082", 4, 180, 180, "Z5", "Z1")
    ],
    { warm: 12, cool: 10 }
  ),
  preset(
    "cyc_z2_surges_8x1",
    "Cycling",
    "Z2 + 8\xD71\u2032 surge Z4",
    "Endurance con accelerazioni incorporate \u2014 stile gran fondo.",
    "aerobic_base",
    "build",
    ["endurance", "z2", "surges", "pickups"],
    95,
    72,
    [
      st("Z2 base", 35, "Z2"),
      iv("8\xD71\u2032 surge", 8, 60, 180, "Z4", "Z2"),
      st("Z2 home", 15, "Z2")
    ],
    { warm: 12, cool: 10 }
  ),
  preset(
    "cyc_gran_fondo_sim",
    "Cycling",
    "Gran fondo sim \xB7 50\u2032 Z2 + 3\xD78\u2032 salita",
    "Volume lungo + blocchi salita separati da recuperi profondi.",
    "aerobic_base",
    "build",
    ["gran_fondo", "endurance", "climbing", "long"],
    115,
    88,
    [
      st("Z2 volume", 50, "Z2"),
      rec(6),
      st("Salita 1", 8, "Z4"),
      rec(6),
      st("Salita 2", 8, "Z4"),
      rec(6),
      st("Salita 3", 8, "Z4")
    ],
    { warm: 12, cool: 12 }
  ),
  preset(
    "cyc_crit_sim",
    "Cycling",
    "Crit sim \xB7 6\xD7(2\u2032 Z5 / 3\u2032 Z2)",
    "Simulazione criterium \u2014 ripetute intense con recupero attivo.",
    "vo2max",
    "build",
    ["crit", "race", "vo2", "intervals"],
    78,
    86,
    [
      st("Z2 priming", 15, "Z2"),
      iv("6\xD7 crit effort", 6, 120, 180, "Z5", "Z2"),
      st("Z2 flush", 10, "Z2")
    ],
    { warm: 12, cool: 10 }
  ),
  preset(
    "cyc_reverse_pyramid_vo2",
    "Cycling",
    "Piramide inversa VO\u2082 \xB7 6\u2032\u21921\u2032",
    "Piramide decrescente a watt target \u2014 blocco pyramid unico.",
    "vo2max",
    "build",
    ["pyramid", "vo2", "descending"],
    75,
    82,
    [
      py("Piramide inversa", 6, 120, Math.round(FTP2 * 1.05), Math.round(FTP2 * 0.78), "6 scalini decrescenti"),
      st("Z2 flush", 10, "Z2")
    ],
    { warm: 12, cool: 10 }
  ),
  preset(
    "cyc_tempo_sandwich",
    "Cycling",
    "Tempo sandwich \xB7 Z2\u2013Z3\u2013Z2",
    "Pane Z2, ripieno tempo Z3 \u2014 struttura a tre atti.",
    "lactate_clearance",
    "build",
    ["tempo", "z3", "sandwich", "endurance"],
    85,
    76,
    [st("Z2 apertura", 18, "Z2"), st("Tempo centrale", 22, "Z3"), st("Z2 chiusura", 18, "Z2")],
    { warm: 12, cool: 10 }
  ),
  preset(
    "cyc_4x8_ftp",
    "Cycling",
    "FTP \xB7 4\xD78\u2032 Z4",
    "Quattro blocchi da 8\u2032 a soglia \u2014 recupero medio.",
    "lactate_tolerance",
    "build",
    ["ftp", "threshold", "z4", "intervals"],
    88,
    92,
    [
      st("FTP 1", 8, "Z4"),
      rec(4),
      st("FTP 2", 8, "Z4"),
      rec(4),
      st("FTP 3", 8, "Z4"),
      rec(4),
      st("FTP 4", 8, "Z4")
    ],
    { warm: 12, cool: 10 }
  ),
  preset(
    "cyc_hour_of_power_style",
    "Cycling",
    "Hour of power \xB7 3\xD712\u2032 Z4",
    "Tre blocchi da 12\u2032 \u2014 tolleranza soglia tipo Hour of Power.",
    "lactate_tolerance",
    "build",
    ["threshold", "z4", "hour_of_power"],
    90,
    95,
    [st("Block 1", 12, "Z4"), rec(6), st("Block 2", 12, "Z4"), rec(6), st("Block 3", 12, "Z4")],
    { warm: 15, cool: 12 }
  ),
  preset(
    "cyc_heat_acclimation_tier",
    "Cycling",
    "Caldo tier \xB7 Z2 + 3\xD78\u2032 Z3",
    "Volume Z2 poi tier tempo in caldo simulato.",
    "aerobic_base",
    "peak",
    ["heat", "temperature", "z2", "z3", "tier"],
    95,
    68,
    [st("Z2 caldo", 40, "Z2"), rec(5), st("Tempo 1", 8, "Z3"), rec(4), st("Tempo 2", 8, "Z3"), rec(4), st("Tempo 3", 8, "Z3")],
    { warm: 12, cool: 10 }
  ),
  preset(
    "cyc_hypoxic_tier_4x6",
    "Cycling",
    "Ipossico tier \xB7 2\xD7(4\xD76\u2032 Z3)",
    "Doppia serie blocchi Z3 con 10\u2032 tra tier.",
    "aerobic_base",
    "build",
    ["hypoxic", "z3", "tier", "simulation"],
    100,
    78,
    [
      iv("Serie A 4\xD76\u2032", 4, 360, 180, "Z3", "Z1"),
      rec(10),
      iv("Serie B 4\xD76\u2032", 4, 360, 180, "Z3", "Z1")
    ],
    { warm: 12, cool: 10 }
  ),
  preset(
    "cyc_vo2_40_20_x10",
    "Cycling",
    "VO\u2082 \xB7 10\xD740\u2033/20\u2033",
    "Formato 40-20 denso \u2014 alta frequenza neuromuscolare aerobica.",
    "vo2max",
    "build",
    ["vo2", "40-20", "hit"],
    58,
    72,
    [st("Z2 priming", 12, "Z2"), iv("10\xD740\u2033/20\u2033", 10, 40, 20, "Z5", "Z1"), rec(5), st("Z2 flush", 8, "Z2")],
    { warm: 10, cool: 8 }
  ),
  preset(
    "cyc_endurance_embedded_tempo",
    "Cycling",
    "Endurance \xB7 3\xD710\u2032 Z3 in Z2",
    "Guscio Z2 con tre tempi embedded \u2014 variabilit\xE0 senza giornata quality pura.",
    "aerobic_base",
    "build",
    ["endurance", "z2", "tempo", "embedded"],
    100,
    70,
    [
      st("Z2", 20, "Z2"),
      st("Tempo 1", 10, "Z3"),
      rec(4, "Z2"),
      st("Z2", 8, "Z2"),
      st("Tempo 2", 10, "Z3"),
      rec(4, "Z2"),
      st("Z2", 8, "Z2"),
      st("Tempo 3", 10, "Z3"),
      st("Z2", 12, "Z2")
    ],
    { warm: 12, cool: 10 }
  ),
  preset(
    "cyc_ramp_test_style",
    "Cycling",
    "Rampa test \xB7 20\u2032 Z2\u2192Z6",
    "Rampa lunga progressiva \u2014 profilo continuo fino VO\u2082.",
    "vo2max",
    "build",
    ["ramp", "test", "progressive", "vo2"],
    70,
    75,
    [rm("Rampa progressiva", 20, "Z2", "Z6"), st("Z2 flush", 12, "Z2")],
    { warm: 12, cool: 10 }
  ),
  preset(
    "cyc_tte_2x16",
    "Cycling",
    "TTE \xB7 2\xD716\u2032 Z4",
    "Time-to-exhaustion style \u2014 due blocchi soglia lunghi.",
    "lactate_tolerance",
    "build",
    ["tte", "threshold", "z4"],
    88,
    96,
    [st("TTE 1", 16, "Z4"), rec(10), st("TTE 2", 16, "Z4")],
    { warm: 15, cool: 12 }
  ),
  preset(
    "cyc_micro_bursts_20x30",
    "Cycling",
    "Micro-burst \xB7 20\xD730\u2033/30\u2033",
    "Serie 30-30 estesa dopo Z2 \u2014 densit\xE0 polarizzata.",
    "vo2max",
    "build",
    ["30-30", "micro", "vo2", "polarized"],
    72,
    80,
    [st("Z2 priming", 25, "Z2"), rec(3), iv("20\xD730\u2033/30\u2033", 20, 30, 30, "Z5", "Z1"), st("Z2 flush", 10, "Z2")],
    { warm: 12, cool: 10 }
  ),
  preset(
    "cyc_alpe_climb_tier",
    "Cycling",
    "Salita tier \xB7 3\xD712\u2032 Z4",
    "Tre blocchi salita lunghi \u2014 recupero generoso (stile Alp climb).",
    "lactate_clearance",
    "build",
    ["climbing", "alpe", "z4", "tier"],
    95,
    98,
    [st("Climb 1", 12, "Z4"), rec(8), st("Climb 2", 12, "Z4"), rec(8), st("Climb 3", 12, "Z4")],
    { warm: 15, cool: 12 }
  ),
  preset(
    "cyc_2x30_tempo",
    "Cycling",
    "Tempo lungo \xB7 2\xD730\u2032 Z3",
    "Due tempi da mezz'ora \u2014 endurance quality.",
    "lactate_clearance",
    "build",
    ["tempo", "long", "z3", "endurance"],
    105,
    82,
    [st("Tempo 1", 30, "Z3"), rec(8), st("Tempo 2", 30, "Z3")],
    { warm: 15, cool: 12 }
  ),
  preset(
    "cyc_sprint_ladder_finish",
    "Cycling",
    "Endurance + ladder sprint",
    "Z2 lungo poi scaletta sprint 30\u2033\u219215\u2033\u219210\u2033.",
    "neuromuscular",
    "build",
    ["sprint", "ladder", "endurance", "neuromuscular"],
    85,
    78,
    [
      st("Z2 volume", 45, "Z2"),
      rec(5),
      iv("6\xD730\u2033", 6, 30, 90, "Z6", "Z1"),
      rec(4),
      iv("6\xD715\u2033", 6, 15, 75, "Z6", "Z1"),
      rec(4),
      iv("4\xD710\u2033", 4, 10, 60, "Z6", "Z1")
    ],
    { warm: 12, cool: 10 }
  ),
  preset(
    "cyc_over_under_triple",
    "Cycling",
    "OU triple \xB7 3 blocchi interval3",
    "Tre blocchi over-under separati da 6\u2032 rec.",
    "lactate_tolerance",
    "build",
    ["over-under", "interval3", "lactate"],
    85,
    88,
    [
      i3("OU 1", 4, 120, 60, 120, "Z4", "Z3", "Z4"),
      rec(6),
      i3("OU 2", 4, 120, 60, 120, "Z4", "Z3", "Z4"),
      rec(6),
      i3("OU 3", 4, 120, 60, 120, "Z4", "Z3", "Z4")
    ],
    { warm: 12, cool: 10 }
  ),
  preset(
    "cyc_norwegian_5x5_z4",
    "Cycling",
    "Norvegese \xB7 5\xD75\u2032 Z4 (3\u2032 rec)",
    "Cinque blocchi da 5\u2032 a soglia \u2014 formato nordico classico.",
    "lactate_tolerance",
    "build",
    ["norwegian", "z4", "threshold"],
    80,
    90,
    [iv("5\xD75\u2032 Z4", 5, 300, 180, "Z4", "Z1"), st("Z2 flush", 8, "Z2")],
    { warm: 12, cool: 10 }
  ),
  // —— Running ——
  preset(
    "run_ascending_3_8",
    "Running",
    "Ascendente \xB7 3\u2032-8\u2032 Z4",
    "Intervalli crescenti in salita/piano \u2014 progressione lavoro.",
    "lactate_tolerance",
    "build",
    ["running", "ascending", "threshold"],
    75,
    80,
    [
      st("3\u2032 Z4", 3, "Z4"),
      rec(3),
      st("5\u2032 Z4", 5, "Z4"),
      rec(4),
      st("6\u2032 Z4", 6, "Z4"),
      rec(4),
      st("8\u2032 Z4", 8, "Z4"),
      st("Z2 easy", 10, "Z2")
    ],
    { warm: 12, cool: 10 }
  ),
  preset(
    "run_progression_30_20_10",
    "Running",
    "Progression \xB7 30\u2032-20\u2032-10\u2032",
    "Tre blocchi decrescenti in durata, intensit\xE0 crescente.",
    "aerobic_base",
    "build",
    ["running", "progressive", "long"],
    90,
    75,
    [st("30\u2032 Z2", 30, "Z2"), rm("Rampa", 10, "Z2", "Z3"), st("20\u2032 Z3", 20, "Z3"), rec(5), st("10\u2032 Z4", 10, "Z4")],
    { warm: 10, cool: 10 }
  ),
  preset(
    "run_tempo_strides",
    "Running",
    "Tempo + strides \xB7 2\xD712\u2032 + 6\xD720\u2033",
    "Tempo doppio poi accelerazioni neuromuscolari.",
    "lactate_clearance",
    "build",
    ["running", "tempo", "strides", "neuromuscular"],
    70,
    72,
    [
      st("Tempo 1", 12, "Z3"),
      rec(4),
      st("Tempo 2", 12, "Z3"),
      rec(6),
      iv("6\xD720\u2033 stride", 6, 20, 60, "Z6", "Z1"),
      st("Z2 easy", 8, "Z2")
    ],
    { warm: 12, cool: 10 }
  ),
  preset(
    "run_10x400",
    "Running",
    "10\xD7400 m \xB7 90\u2033 rec",
    "Ripetute 400 m a VO\u2082 \u2014 classico pista.",
    "vo2max",
    "build",
    ["running", "vo2", "400m", "track"],
    65,
    78,
    [iv("10\xD7400 m", 10, 90, 90, "Z5", "Z1"), st("Z2 easy", 10, "Z2")],
    { warm: 12, cool: 10 }
  ),
  preset(
    "run_kenyan_1_1",
    "Running",
    "Kenyan \xB7 8\xD71\u2032 Z5 / 1\u2032 Z1",
    "Micro-intervalli 1 on 1 off \u2014 densit\xE0 aerobica alta.",
    "vo2max",
    "build",
    ["running", "kenyan", "vo2", "intervals"],
    55,
    70,
    [st("Z2 priming", 15, "Z2"), iv("8\xD71\u2032/1\u2032", 8, 60, 60, "Z5", "Z1"), st("Z2 easy", 10, "Z2")],
    { warm: 12, cool: 8 }
  ),
  preset(
    "run_long_mp_embedded",
    "Running",
    "Long \xB7 60\u2032 Z2 + 2\xD715\u2032 MP",
    "Uscita lunga con blocchi maratona embedded.",
    "aerobic_base",
    "peak",
    ["running", "long", "marathon", "embedded"],
    110,
    78,
    [st("Z2 easy", 45, "Z2"), rec(5), st("MP 1", 15, "Z3"), rec(5), st("MP 2", 15, "Z3"), st("Z2 easy", 10, "Z2")],
    { warm: 12, cool: 10 }
  ),
  preset(
    "run_fartlek_tier",
    "Running",
    "Fartlek tier \xB7 3\xD7(3\u2032 Z4 / 5\u2032 Z2)",
    "Tre tier fartlek strutturati \u2014 non libero.",
    "aerobic_base",
    "build",
    ["running", "fartlek", "tier", "z4"],
    65,
    68,
    [
      iv("Tier 1", 3, 180, 300, "Z4", "Z2"),
      rec(4),
      iv("Tier 2", 3, 180, 300, "Z4", "Z2"),
      rec(4),
      iv("Tier 3", 3, 180, 300, "Z4", "Z2"),
      st("Z2 home", 10, "Z2")
    ],
    { warm: 12, cool: 10 }
  ),
  preset(
    "run_cruise_intervals_3x10",
    "Running",
    "Cruise \xB7 3\xD710\u2032 Z3",
    "Tre cruise da 10\u2032 \u2014 mezza maratona.",
    "lactate_clearance",
    "build",
    ["running", "cruise", "tempo", "z3"],
    75,
    74,
    [st("Cruise 1", 10, "Z3"), rec(4), st("Cruise 2", 10, "Z3"), rec(4), st("Cruise 3", 10, "Z3")],
    { warm: 12, cool: 10 }
  ),
  // —— Swimming ——
  preset(
    "swm_broken_200",
    "Swimming",
    "Broken 200 \xB7 4\xD750 + 100",
    "200 m spezzato \u2014 variet\xE0 ritmo in un solo lavoro logico.",
    "lactate_clearance",
    "build",
    ["swimming", "broken", "intervals"],
    48,
    44,
    [
      iv("4\xD750 m", 4, 45, 15, "Z4", "Z1"),
      rec(2),
      st("100 m steady", 4, "Z3"),
      rec(2),
      iv("4\xD750 m", 4, 45, 15, "Z4", "Z1")
    ],
    { warm: 10, cool: 8 }
  ),
  preset(
    "swm_ladder_50_75_100",
    "Swimming",
    "Ladder \xB7 50-75-100-75-50",
    "Scaletta distanze \u2014 ogni ripetuta diversa.",
    "lactate_clearance",
    "build",
    ["swimming", "ladder", "intervals"],
    55,
    50,
    [
      st("50 m", 1, "Z4"),
      rec(1),
      st("75 m", 2, "Z4"),
      rec(1),
      st("100 m", 3, "Z4"),
      rec(2),
      st("75 m", 2, "Z4"),
      rec(1),
      st("50 m", 1, "Z4")
    ],
    { warm: 10, cool: 8 }
  ),
  preset(
    "swm_css_6x200",
    "Swimming",
    "CSS \xB7 6\xD7200 m",
    "Soglia nuoto \u2014 200 m on / 30 s off.",
    "lactate_tolerance",
    "build",
    ["swimming", "css", "threshold", "z4"],
    58,
    54,
    [iv("6\xD7200 m", 6, 180, 30, "Z4", "Z1")],
    { warm: 10, cool: 8 }
  ),
  preset(
    "swm_vo2_tier_50s",
    "Swimming",
    "VO\u2082 tier \xB7 8\xD750 + 6\u2032 + 6\xD750",
    "Due tier 50 m fast con recupero profondo.",
    "vo2max",
    "build",
    ["swimming", "vo2", "tier"],
    52,
    50,
    [iv("Tier A 8\xD750", 8, 45, 25, "Z5", "Z1"), rec(6), iv("Tier B 6\xD750", 6, 45, 25, "Z5", "Z1")],
    { warm: 10, cool: 8 }
  ),
  preset(
    "swm_pull_kick_threshold",
    "Swimming",
    "Pull/Kick \xB7 4\xD7(200 pull + 100 kick)",
    "Blocchi tecnici a soglia \u2014 variet\xE0 stroke.",
    "lactate_clearance",
    "build",
    ["swimming", "pull", "kick", "technique"],
    60,
    48,
    [
      st("200 pull Z3", 6, "Z3"),
      rec(2),
      st("100 kick Z4", 3, "Z4"),
      rec(3),
      st("200 pull Z3", 6, "Z3"),
      rec(2),
      st("100 kick Z4", 3, "Z4"),
      rec(3),
      st("200 pull Z3", 6, "Z3"),
      rec(2),
      st("100 kick Z4", 3, "Z4"),
      rec(3),
      st("200 pull Z3", 6, "Z3"),
      rec(2),
      st("100 kick Z4", 3, "Z4")
    ],
    { warm: 10, cool: 8 }
  ),
  // —— Canoe ——
  preset(
    "can_tempo_paddle_tier",
    "Canoe",
    "Tempo paddle \xB7 3\xD712\u2032 Z3",
    "Tre blocchi tempo canoa con recupero.",
    "lactate_clearance",
    "build",
    ["canoe", "tempo", "tier", "z3"],
    75,
    70,
    [st("Tempo 1", 12, "Z3"), rec(5), st("Tempo 2", 12, "Z3"), rec(5), st("Tempo 3", 12, "Z3")],
    { warm: 12, cool: 10 }
  ),
  preset(
    "can_endurance_surge",
    "Canoe",
    "Endurance \xB7 Z2 + 6\xD71\u2032 Z4",
    "Paddle lungo con surge incorporate.",
    "aerobic_base",
    "build",
    ["canoe", "endurance", "surges", "z2"],
    85,
    62,
    [st("Z2 paddle", 50, "Z2"), iv("6\xD71\u2032 surge", 6, 60, 120, "Z4", "Z2"), st("Z2 home", 10, "Z2")],
    { warm: 12, cool: 10 }
  ),
  preset(
    "can_power_4x5",
    "Canoe",
    "Power \xB7 4\xD75\u2032 Z4",
    "Quattro blocchi potenza paddle \u2014 recupero medio.",
    "lactate_tolerance",
    "build",
    ["canoe", "power", "z4", "intervals"],
    70,
    75,
    [st("Power 1", 5, "Z4"), rec(4), st("Power 2", 5, "Z4"), rec(4), st("Power 3", 5, "Z4"), rec(4), st("Power 4", 5, "Z4")],
    { warm: 12, cool: 10 }
  )
];

// apps/web/lib/training/library/starter-pack-aerobic-catalog-xcski.ts
var D = "XC Ski";
var XC_SKI_CATALOG_PRESETS = [
  preset("xcs_endurance_z2_90", D, "Endurance \xB7 90\u2032 Z2", "Volume aerobico sci fondo \u2014 base polarizzata.", "aerobic_base", "base", ["xc_ski", "z2", "endurance", "nordic"], 90, 52, [st("Z2 continuo", 66, "Z2")], { warm: 12, cool: 12 }),
  preset("xcs_long_z2_120", D, "Long \xB7 120\u2032 Z2", "Uscita lunga fondo \u2014 densit\xE0 mitocondriale.", "aerobic_base", "base", ["xc_ski", "z2", "long"], 120, 68, [st("Z2 lungo", 90, "Z2")], { warm: 15, cool: 15 }),
  preset("xcs_dp_interval_6x4", D, "DP \xB7 6\xD74\u2032 Z4", "Intervalli double pole a soglia \u2014 tecnica DP.", "lactate_tolerance", "build", ["xc_ski", "double_pole", "z4", "intervals"], 78, 85, [iv("6\xD74\u2032 DP", 6, 240, 180, "Z4", "Z1")], { warm: 15, cool: 12 }),
  preset("xcs_dp_tier_4x4x2", D, "DP tier \xB7 4\xD74\u2032 \xD72", "Doppia serie DP 4\xD74 con 10\u2032 tra blocchi.", "vo2max", "build", ["xc_ski", "double_pole", "norwegian", "tier"], 100, 102, [iv("Serie A 4\xD74\u2032", 4, 240, 240, "Z5", "Z1"), rec(10), iv("Serie B 4\xD74\u2032", 4, 240, 240, "Z5", "Z1")], { warm: 15, cool: 12 }),
  preset("xcs_skate_5x5", D, "Skate \xB7 5\xD75\u2032 Z4", "Tecnica skate \u2014 intervalli medio-lunghi.", "lactate_tolerance", "build", ["xc_ski", "skate", "z4"], 75, 82, [iv("5\xD75\u2032 skate", 5, 300, 180, "Z4", "Z1")], { warm: 12, cool: 10 }),
  preset("xcs_classic_strides_8x3", D, "Classic \xB7 8\xD73\u2032 Z3", "Passo classico \u2014 resistenza specifica.", "lactate_clearance", "build", ["xc_ski", "classic", "z3"], 70, 72, [iv("8\xD73\u2032 classic", 8, 180, 120, "Z3", "Z1")], { warm: 12, cool: 10 }),
  preset("xcs_vo2_30_30_x16", D, "VO\u2082 \xB7 30\u2033/30\u2033 \xD716", "Micro-intervalli nordici \u2014 capacit\xE0 aerobica alta.", "vo2max", "build", ["xc_ski", "vo2", "30-30"], 58, 76, [st("Z2 priming", 15, "Z2"), iv("16\xD730\u2033/30\u2033", 16, 30, 30, "Z5", "Z1"), st("Z2 flush", 8, "Z2")], { warm: 12, cool: 8 }),
  preset("xcs_l4_capacity_3x12", D, "L4 \xB7 3\xD712\u2032 capacit\xE0", "Blocchi L4/soglia alta \u2014 modello capacit\xE0.", "lactate_tolerance", "build", ["xc_ski", "l4", "capacity", "z4"], 88, 92, [st("L4 1", 12, "Z4"), rec(6), st("L4 2", 12, "Z4"), rec(6), st("L4 3", 12, "Z4")], { warm: 15, cool: 12 }),
  preset("xcs_polarized_80_20", D, "Polarizzato \xB7 70\u2032 Z2 + 4\xD74\u2032", "80/20 nordico \u2014 volume + qualit\xE0 separati.", "aerobic_base", "build", ["xc_ski", "polarized", "z2", "vo2"], 105, 88, [st("Z2 volume", 70, "Z2"), rec(5), iv("4\xD74\u2032 Z5", 4, 240, 240, "Z5", "Z1")], { warm: 12, cool: 12 }),
  preset("xcs_hill_dp_repeats", D, "Salita DP \xB7 5\xD76\u2032", "Ripetute in salita double pole.", "lactate_clearance", "build", ["xc_ski", "double_pole", "hill", "force"], 82, 88, [st("Salita 1", 6, "Z4"), rec(4), st("Salita 2", 6, "Z4"), rec(4), st("Salita 3", 6, "Z4"), rec(4), st("Salita 4", 6, "Z4"), rec(4), st("Salita 5", 6, "Z4")], { warm: 15, cool: 10 }),
  preset("xcs_sprint_diagonal_10x1", D, "Sprint \xB7 10\xD71\u2032 Z6", "Sprint diagonal technique \u2014 neuromuscolare.", "neuromuscular", "build", ["xc_ski", "sprint", "diagonal"], 55, 68, [iv("10\xD71\u2032 max", 10, 60, 180, "Z6", "Z1")], { warm: 12, cool: 8 }),
  preset("xcs_ramp_z2_z4", D, "Rampa \xB7 20\u2032 Z2\u2192Z4", "Progressione continua pre-gara.", "lactate_clearance", "build", ["xc_ski", "ramp", "progressive"], 68, 74, [rm("Rampa", 20, "Z2", "Z4"), st("Z2 flush", 10, "Z2")], { warm: 12, cool: 10 }),
  preset("xcs_pyramid_dp", D, "Piramide DP \xB7 5 scalini", "Piramide intensit\xE0 double pole.", "vo2max", "build", ["xc_ski", "pyramid", "double_pole"], 72, 78, [py("DP pyramid", 5, 180, 140, 220, "5\xD73\u2032"), st("Z2 flush", 10, "Z2")], { warm: 12, cool: 10 }),
  preset("xcs_skiathlon_sim", D, "Skiathlon sim \xB7 classic + skate", "Due tecniche nello stesso file.", "lactate_tolerance", "build", ["xc_ski", "skiathlon", "classic", "skate"], 85, 86, [st("Classic block", 25, "Z3"), rec(8), st("Skate block", 20, "Z4"), st("Z2 flush", 12, "Z2")], { warm: 15, cool: 12 }),
  preset("xcs_altitude_z3_blocks", D, "Quota \xB7 3\xD78\u2032 Z3", "Simulazione quota \u2014 blocchi tempo sostenuti.", "aerobic_base", "build", ["xc_ski", "altitude", "z3"], 80, 70, [st("Z3 1", 8, "Z3"), rec(5), st("Z3 2", 8, "Z3"), rec(5), st("Z3 3", 8, "Z3")], { warm: 12, cool: 10 }),
  preset("xcs_over_under_dp", D, "OU DP \xB7 3\xD7(2\u2032Z4/1\u2032Z3/2\u2032Z4)", "Over-under tecnica DP.", "lactate_tolerance", "build", ["xc_ski", "over-under", "double_pole"], 75, 80, [i3("OU DP", 3, 120, 60, 120, "Z4", "Z3", "Z4"), rec(5), i3("OU DP 2", 3, 120, 60, 120, "Z4", "Z3", "Z4")], { warm: 12, cool: 10 }),
  preset("xcs_taper_openers", D, "Taper \xB7 openers Z5", "Aperture pre-gara \u2014 volume ridotto.", "neuromuscular", "peak", ["xc_ski", "openers", "taper", "race"], 55, 58, [st("Z2 easy", 25, "Z2"), iv("4\xD72\u2032 Z5", 4, 120, 180, "Z5", "Z1"), st("Z2 home", 8, "Z2")], { warm: 10, cool: 8 }),
  preset("xcs_recovery_spin", D, "Recovery \xB7 50\u2032 Z1-Z2", "Recupero attivo sci fondo.", "recovery", "base", ["xc_ski", "recovery"], 50, 32, [st("Z1-Z2 spin", 32, "Z1")], { warm: 10, cool: 8 }),
  preset("xcs_billat_dp", D, "Billat DP \xB7 30\u2033/30\u2033 \xD714", "Densit\xE0 aerobica DP breve.", "vo2max", "build", ["xc_ski", "billat", "double_pole", "hit"], 62, 74, [st("Z2 priming", 12, "Z2"), iv("14\xD730\u2033/30\u2033", 14, 30, 30, "Z5", "Z1"), rec(5)], { warm: 10, cool: 8 }),
  preset("xcs_tempo_2x20", D, "Tempo \xB7 2\xD720\u2032 Z3", "Tempo nordico lungo \u2014 mezza distanza.", "lactate_clearance", "build", ["xc_ski", "tempo", "z3"], 88, 78, [st("Tempo 1", 20, "Z3"), rec(6), st("Tempo 2", 20, "Z3")], { warm: 15, cool: 12 }),
  preset("xcs_descending_6_1", D, "Decrescente \xB7 6\u2032\u21921\u2032 Z5", "Scaletta decrescente velocit\xE0.", "vo2max", "build", ["xc_ski", "descending", "vo2"], 70, 76, [st("6\u2032 Z5", 6, "Z5"), rec(3), st("5\u2032 Z5", 5, "Z5"), rec(3), st("4\u2032 Z5", 4, "Z5"), rec(3), st("3\u2032 Z5", 3, "Z5"), rec(2), st("2\u2032 Z5", 2, "Z5"), rec(2), st("1\u2032 Z5", 1, "Z5")], { warm: 12, cool: 10 }),
  preset("xcs_mixed_technique_day", D, "Mista \xB7 Z2 + DP + skate", "Giornata multi-tecnica.", "vo2max", "build", ["xc_ski", "mixed", "double_pole", "skate"], 95, 90, [st("Z2", 30, "Z2"), rec(5), iv("4\xD73\u2032 DP", 4, 180, 150, "Z4", "Z1"), rec(8), iv("4\xD72\u2032 skate", 4, 120, 120, "Z5", "Z1")], { warm: 15, cool: 12 }),
  preset("xcs_heat_acclimation", D, "Caldo \xB7 Z2 + 3\xD76\u2032 Z3", "Acclimatamento termico su neve/roller.", "aerobic_base", "peak", ["xc_ski", "heat", "temperature"], 85, 62, [st("Z2", 45, "Z2"), rec(4), iv("3\xD76\u2032 Z3", 3, 360, 180, "Z3", "Z1")], { warm: 12, cool: 10 }),
  preset("xcs_norwegian_5x3", D, "Norvegese \xB7 5\xD73\u2032 Z4", "Formato norvegese su fondo.", "lactate_tolerance", "build", ["xc_ski", "norwegian", "z4"], 72, 84, [iv("5\xD73\u2032 Z4", 5, 180, 120, "Z4", "Z1")], { warm: 12, cool: 10 }),
  preset("xcs_cruise_4x10", D, "Cruise \xB7 4\xD710\u2032 Z3", "Intervalli cruise \u2014 mezzo fondo.", "lactate_clearance", "build", ["xc_ski", "cruise", "z3"], 82, 76, [st("Cruise 1", 10, "Z3"), rec(4), st("Cruise 2", 10, "Z3"), rec(4), st("Cruise 3", 10, "Z3"), rec(4), st("Cruise 4", 10, "Z3")], { warm: 12, cool: 10 }),
  preset("xcs_z2_surges", D, "Z2 + 10\xD71\u2032 Z4", "Endurance con surge DP/skate.", "aerobic_base", "build", ["xc_ski", "z2", "surges"], 95, 68, [st("Z2", 50, "Z2"), iv("10\xD71\u2032 surge", 10, 60, 120, "Z4", "Z2"), st("Z2 home", 12, "Z2")], { warm: 12, cool: 10 }),
  preset("xcs_threshold_2x15", D, "Soglia \xB7 2\xD715\u2032 Z4", "Due blocchi soglia lunghi fondo.", "lactate_tolerance", "build", ["xc_ski", "threshold", "z4"], 82, 90, [st("Soglia 1", 15, "Z4"), rec(10), st("Soglia 2", 15, "Z4")], { warm: 15, cool: 12 }),
  preset("xcs_micro_burst_skate", D, "Micro-burst skate \xB7 16\xD730\u2033", "16\xD730\u2033/30\u2033 tecnica skate.", "vo2max", "build", ["xc_ski", "skate", "micro", "vo2"], 65, 72, [st("Z2", 20, "Z2"), iv("16\xD730\u2033/30\u2033", 16, 30, 30, "Z5", "Z1"), st("Z2 flush", 8, "Z2")], { warm: 12, cool: 8 }),
  preset("xcs_deload_z1", D, "Deload \xB7 45\u2032 Z1", "Scarico volume minimo.", "recovery", "deload", ["xc_ski", "recovery", "deload"], 45, 28, [st("Z1 easy", 28, "Z1")], { warm: 10, cool: 8 }),
  preset("xcs_race_pace_3x8", D, "Race pace \xB7 3\xD78\u2032 Z4", "Ritmo gara 10-15 km sim.", "lactate_tolerance", "peak", ["xc_ski", "race", "z4"], 70, 82, [st("RP 1", 8, "Z4"), rec(5), st("RP 2", 8, "Z4"), rec(5), st("RP 3", 8, "Z4")], { warm: 12, cool: 10 }),
  preset("xcs_double_day_am_z2", D, "Double \xB7 AM Z2 60\u2032", "Prima sessione giornata doppia (AM volume).", "aerobic_base", "build", ["xc_ski", "double_day", "z2"], 60, 42, [st("AM Z2", 42, "Z2")], { warm: 10, cool: 8 }),
  preset("xcs_double_day_pm_quality", D, "Double \xB7 PM 4\xD73\u2032 Z5", "Seconda sessione PM qualit\xE0 breve.", "vo2max", "build", ["xc_ski", "double_day", "vo2"], 48, 55, [st("Z2 priming", 12, "Z2"), iv("4\xD73\u2032 Z5", 4, 180, 180, "Z5", "Z1")], { warm: 10, cool: 8 }),
  preset("xcs_roller_ski_sim", D, "Roller ski \xB7 tempo 25\u2032", "Simulazione roller ski tempo continuo.", "lactate_clearance", "build", ["xc_ski", "roller", "tempo"], 65, 68, [st("Tempo roller", 25, "Z3"), st("Z2 flush", 12, "Z2")], { warm: 12, cool: 10 }),
  preset("xcs_capacity_4x5", D, "Capacit\xE0 \xB7 4\xD75\u2032 Z4", "Blocchi capacit\xE0 medio-corti.", "lactate_tolerance", "build", ["xc_ski", "capacity", "intervals"], 68, 78, [iv("4\xD75\u2032 Z4", 4, 300, 150, "Z4", "Z1")], { warm: 12, cool: 10 }),
  preset("xcs_progressive_long", D, "Long progressive \xB7 Z2\u2192Z3\u2192Z4", "Uscita lunga progressiva fondo.", "aerobic_base", "build", ["xc_ski", "progressive", "long"], 100, 72, [st("Z2", 40, "Z2"), rm("Rampa Z2\u2192Z3", 15, "Z2", "Z3"), st("Z3", 12, "Z3"), st("Z4 finish", 8, "Z4")], { warm: 12, cool: 10 }),
  preset("xcs_hypoxic_sim", D, "Ipossico sim \xB7 3\xD77\u2032 Z3", "Blocchi densit\xE0 moderata (letteratura altitudine sim).", "aerobic_base", "build", ["xc_ski", "hypoxic", "simulation"], 75, 64, [iv("3\xD77\u2032 Z3", 3, 420, 180, "Z3", "Z1")], { warm: 12, cool: 10 }),
  preset("xcs_technique_z2_drills", D, "Tecnica \xB7 Z2 + drills", "Z2 con blocchi tecnici accelerati.", "aerobic_base", "base", ["xc_ski", "technique", "z2"], 75, 55, [st("Z2", 30, "Z2"), iv("6\xD71\u2032 tech", 6, 60, 90, "Z3", "Z2"), st("Z2", 20, "Z2")], { warm: 12, cool: 10 })
];

// apps/web/lib/training/library/starter-pack-aerobic-catalog-trail.ts
var D2 = "Trail Running";
var TRAIL_RUNNING_CATALOG_PRESETS = [
  preset("trl_endurance_z2_90", D2, "Trail Z2 \xB7 90\u2032", "Volume trail aerobico \u2014 base verticale.", "aerobic_base", "base", ["trail", "z2", "endurance"], 90, 50, [st("Z2 trail", 66, "Z2")], { warm: 12, cool: 12 }),
  preset("trl_long_z2_150", D2, "Long trail \xB7 150\u2032 Z2", "Uscita lunga ultra \u2014 preparazione verticale.", "aerobic_base", "base", ["trail", "long", "ultra"], 150, 72, [st("Z2 long", 115, "Z2")], { warm: 15, cool: 15 }),
  preset("trl_vertical_km_prep", D2, "VK prep \xB7 6\xD75\u2032 uphill Z4", "Ripetute vertical kilometer \u2014 D+ specifico.", "lactate_tolerance", "build", ["trail", "vertical", "uphill", "vk"], 75, 82, [iv("6\xD75\u2032 uphill", 6, 300, 180, "Z4", "Z1")], { warm: 12, cool: 10 }),
  preset("trl_uphill_tier_4x4", D2, "Uphill tier \xB7 4\xD74\u2032 \xD72", "Doppia serie salita 4\xD74 con 10\u2032 rec.", "vo2max", "build", ["trail", "uphill", "tier", "vertical"], 95, 95, [iv("Serie A 4\xD74\u2032", 4, 240, 240, "Z5", "Z1"), rec(10), iv("Serie B 4\xD74\u2032", 4, 240, 240, "Z5", "Z1")], { warm: 12, cool: 10 }),
  preset("trl_downhill_technique", D2, "Downhill \xB7 Z2 + 6\xD72\u2032 legs", "Tecnica discesa \u2014 carico eccentrico controllato.", "aerobic_base", "build", ["trail", "downhill", "technique"], 80, 58, [st("Z2 trail", 40, "Z2"), iv("6\xD72\u2032 downhill", 6, 120, 180, "Z3", "Z2"), st("Z2 home", 15, "Z2")], { warm: 12, cool: 10 }),
  preset("trl_mgt_3x25", D2, "MGT \xB7 3\xD725\u2032 Z3", "Medium-long trail tempo \u2014 skyrunning MGT.", "lactate_clearance", "build", ["trail", "mgt", "tempo", "skyrunning"], 100, 78, [st("MGT 1", 25, "Z3"), rec(6), st("MGT 2", 25, "Z3"), rec(6), st("MGT 3", 25, "Z3")], { warm: 15, cool: 12 }),
  preset("trl_wolf_pack_hills", D2, "Wolf pack \xB7 8\xD73\u2032 Z4", "Ripetute corte in salita \u2014 densit\xE0 verticale.", "lactate_tolerance", "build", ["trail", "hill", "intervals"], 70, 78, [iv("8\xD73\u2032 hill", 8, 180, 120, "Z4", "Z1")], { warm: 12, cool: 10 }),
  preset("trl_skyrunning_30_15_5", D2, "Skyrunning \xB7 30-15-5", "Progressione 30\u2032-15\u2032-5\u2032 intensit\xE0 crescente.", "vo2max", "build", ["trail", "skyrunning", "progressive"], 85, 80, [st("30\u2032 Z2", 30, "Z2"), st("15\u2032 Z3", 15, "Z3"), rec(5), st("5\u2032 Z4", 5, "Z4")], { warm: 12, cool: 10 }),
  preset("trl_fartlek_vertical", D2, "Fartlek verticale \xB7 tier", "3 tier salita/discesa percezione.", "aerobic_base", "build", ["trail", "fartlek", "vertical"], 65, 68, [iv("Tier 1", 4, 180, 240, "Z4", "Z2"), rec(5), iv("Tier 2", 3, 180, 240, "Z4", "Z2"), rec(5), iv("Tier 3", 3, 120, 180, "Z5", "Z1")], { warm: 12, cool: 10 }),
  preset("trl_technical_trail_z2_z4", D2, "Tecnico \xB7 Z2 + 5\xD74\u2032 Z4", "Trail tecnico con blocchi soglia.", "lactate_tolerance", "build", ["trail", "technical", "z4"], 88, 82, [st("Z2 technical", 35, "Z2"), rec(6), iv("5\xD74\u2032 Z4", 5, 240, 180, "Z4", "Z1"), st("Z2 home", 12, "Z2")], { warm: 12, cool: 10 }),
  preset("trl_ultra_back_to_back", D2, "Ultra sim \xB7 70\u2032 + 50\u2032 Z2", "Simulazione doppia giornata volume (tier).", "aerobic_base", "build", ["trail", "ultra", "tier", "long"], 130, 75, [st("Block AM", 70, "Z2"), rec(10), st("Block PM style", 50, "Z2")], { warm: 15, cool: 15 }),
  preset("trl_poles_hike_z1_z2", D2, "Hike \xB7 poles Z1-Z2 100\u2032", "Camminata con bastoncini \u2014 volume verticale low intensity.", "aerobic_base", "base", ["trail", "hike", "poles", "vertical"], 100, 48, [st("Hike Z1-Z2", 76, "Z2")], { warm: 12, cool: 12 }),
  preset("trl_heat_trail", D2, "Caldo trail \xB7 Z2 + 3\xD78\u2032 Z3", "Trail estivo \u2014 gestione termica.", "aerobic_base", "peak", ["trail", "heat", "temperature"], 90, 58, [st("Z2", 50, "Z2"), rec(5), iv("3\xD78\u2032 Z3", 3, 480, 180, "Z3", "Z1")], { warm: 12, cool: 10 }),
  preset("trl_night_trail_z2", D2, "Night trail \xB7 75\u2032 Z2", "Volume Z2 notturno \u2014 focus tecnico.", "aerobic_base", "build", ["trail", "night", "technique"], 75, 52, [st("Z2 night", 53, "Z2")], { warm: 12, cool: 10 }),
  preset("trl_vo2_hill_5x3", D2, "VO\u2082 hill \xB7 5\xD73\u2032 Z5", "Intervalli corti in salita \u2014 potenza verticale.", "vo2max", "build", ["trail", "vo2", "uphill"], 68, 76, [iv("5\xD73\u2032 uphill", 5, 180, 180, "Z5", "Z1"), st("Z2 easy", 10, "Z2")], { warm: 12, cool: 10 }),
  preset("trl_tempo_ridge_2x18", D2, "Ridge tempo \xB7 2\xD718\u2032 Z3", "Due tempi su crinale \u2014 skyrunning.", "lactate_clearance", "build", ["trail", "tempo", "ridge"], 82, 74, [st("Ridge 1", 18, "Z3"), rec(6), st("Ridge 2", 18, "Z3")], { warm: 12, cool: 10 }),
  preset("trl_pyramid_uphill", D2, "Piramide uphill \xB7 5 step", "Piramide salita progressiva.", "vo2max", "build", ["trail", "pyramid", "uphill"], 72, 76, [py("Uphill pyramid", 5, 180, 150, 210, "5\xD73\u2032 climb"), st("Z2 flush", 10, "Z2")], { warm: 12, cool: 10 }),
  preset("trl_over_under_trail", D2, "OU trail \xB7 3\xD7(3\u2032Z4/2\u2032Z3/3\u2032Z4)", "Over-under su sentiero.", "lactate_tolerance", "build", ["trail", "over-under"], 78, 80, [i3("OU trail", 3, 180, 120, 180, "Z4", "Z3", "Z4"), rec(6), i3("OU 2", 3, 180, 120, 180, "Z4", "Z3", "Z4")], { warm: 12, cool: 10 }),
  preset("trl_descending_5_1", D2, "Decrescente trail \xB7 5\u2032\u21921\u2032 Z5", "Scaletta decrescente in salita.", "vo2max", "build", ["trail", "descending", "vo2"], 68, 74, [st("5\u2032 Z5", 5, "Z5"), rec(3), st("4\u2032 Z5", 4, "Z5"), rec(3), st("3\u2032 Z5", 3, "Z5"), rec(2), st("2\u2032 Z5", 2, "Z5"), rec(2), st("1\u2032 Z5", 1, "Z5")], { warm: 12, cool: 10 }),
  preset("trl_polarized_trail", D2, "Polarizzato trail \xB7 80\u2032 Z2 + 4\xD74\u2032", "Polarizzato su trail \u2014 volume verticale.", "aerobic_base", "build", ["trail", "polarized", "z2"], 110, 82, [st("Z2 trail", 80, "Z2"), rec(5), iv("4\xD74\u2032 Z5", 4, 240, 240, "Z5", "Z1")], { warm: 12, cool: 12 }),
  preset("trl_strength_hike_load", D2, "Strength hike \xB7 4\xD712\u2032 Z3", "Camminata carico \u2014 forza specifica trail.", "lactate_clearance", "build", ["trail", "strength", "hike", "force"], 85, 72, [st("Hike 1", 12, "Z3"), rec(4), st("Hike 2", 12, "Z3"), rec(4), st("Hike 3", 12, "Z3"), rec(4), st("Hike 4", 12, "Z3")], { warm: 12, cool: 10 }),
  preset("trl_recovery_trail_50", D2, "Recovery trail \xB7 50\u2032 Z1", "Recupero sentiero morbido.", "recovery", "base", ["trail", "recovery"], 50, 30, [st("Z1 trail", 32, "Z1")], { warm: 10, cool: 8 }),
  preset("trl_race_sim_vertical", D2, "Race sim \xB7 3\xD710\u2032 Z4 uphill", "Simulazione gara skyrunning \u2014 blocchi ritmo.", "lactate_tolerance", "peak", ["trail", "race", "vertical"], 75, 85, [st("Uphill 1", 10, "Z4"), rec(6), st("Uphill 2", 10, "Z4"), rec(6), st("Uphill 3", 10, "Z4")], { warm: 12, cool: 10 }),
  preset("trl_z2_surges_climb", D2, "Z2 + 12\xD71\u2032 climb", "Endurance trail con surge in salita.", "aerobic_base", "build", ["trail", "z2", "surges", "uphill"], 95, 65, [st("Z2", 48, "Z2"), iv("12\xD71\u2032 climb", 12, 60, 90, "Z4", "Z2"), st("Z2 home", 15, "Z2")], { warm: 12, cool: 10 }),
  preset("trl_billat_trail", D2, "Billat trail \xB7 20\xD730\u2033/30\u2033", "Micro-intervalli trail ripido.", "vo2max", "build", ["trail", "billat", "hit"], 58, 70, [st("Z2 priming", 15, "Z2"), iv("20\xD730\u2033/30\u2033", 20, 30, 30, "Z5", "Z1")], { warm: 10, cool: 8 }),
  preset("trl_mixed_dplus_day", D2, "D+ mista \xB7 tempo + VO\u2082 + downhill", "Giornata verticale completa.", "vo2max", "build", ["trail", "mixed", "vertical", "d+"], 100, 88, [st("Tempo Z3", 20, "Z3"), rec(8), iv("4\xD73\u2032 VO\u2082", 4, 180, 180, "Z5", "Z1"), rec(8), st("Downhill 15\u2032 Z2", 15, "Z2")], { warm: 12, cool: 10 }),
  preset("trl_cruise_uphill_3x12", D2, "Cruise uphill \xB7 3\xD712\u2032 Z3", "Cruise in salita \u2014 mezza verticale.", "lactate_clearance", "build", ["trail", "cruise", "uphill"], 78, 74, [st("Cruise 1", 12, "Z3"), rec(5), st("Cruise 2", 12, "Z3"), rec(5), st("Cruise 3", 12, "Z3")], { warm: 12, cool: 10 }),
  preset("trl_ramp_z2_z4_trail", D2, "Rampa trail \xB7 18\u2032 Z2\u2192Z4", "Progressione continua in salita.", "lactate_clearance", "build", ["trail", "ramp", "progressive"], 65, 72, [rm("Rampa climb", 18, "Z2", "Z4"), st("Z2 flush", 10, "Z2")], { warm: 12, cool: 10 }),
  preset("trl_threshold_2x20", D2, "Soglia trail \xB7 2\xD720\u2032 Z4", "Due blocchi soglia trail lunghi.", "lactate_tolerance", "build", ["trail", "threshold", "z4"], 85, 88, [st("Soglia 1", 20, "Z4"), rec(12), st("Soglia 2", 20, "Z4")], { warm: 15, cool: 12 }),
  preset("trl_deload_z1_z2", D2, "Deload trail \xB7 40\u2032 Z1", "Scarico trail leggero.", "recovery", "deload", ["trail", "recovery", "deload"], 40, 24, [st("Z1 easy", 24, "Z1")], { warm: 10, cool: 8 }),
  preset("trl_30_30_trail", D2, "30\u2033/30\u2033 trail \xB7 \xD718", "30-30 su trail tecnico.", "vo2max", "build", ["trail", "30-30", "vo2"], 62, 74, [st("Z2", 18, "Z2"), iv("18\xD730\u2033/30\u2033", 18, 30, 30, "Z5", "Z1"), st("Z2 flush", 8, "Z2")], { warm: 12, cool: 8 }),
  preset("trl_norwegian_trail_4x4", D2, "Norvegese trail \xB7 4\xD74\u2032", "4\xD74 in salita \u2014 formato nordico.", "vo2max", "build", ["trail", "norwegian", "vo2"], 72, 80, [iv("4\xD74\u2032 uphill", 4, 240, 240, "Z5", "Z1")], { warm: 12, cool: 10 }),
  preset("trl_altitude_block", D2, "Quota \xB7 2\xD725\u2032 Z3", "Blocchi quota simulata \u2014 trail alto.", "aerobic_base", "build", ["trail", "altitude", "z3"], 88, 68, [st("Z3 1", 25, "Z3"), rec(8), st("Z3 2", 25, "Z3")], { warm: 12, cool: 10 }),
  preset("trl_taper_vertical_openers", D2, "Taper \xB7 3\xD72\u2032 Z5 uphill", "Aperture verticali pre-gara.", "neuromuscular", "peak", ["trail", "taper", "openers", "race"], 52, 58, [st("Z2 easy", 22, "Z2"), iv("3\xD72\u2032 Z5", 3, 120, 180, "Z5", "Z1")], { warm: 10, cool: 8 }),
  preset("trl_power_hike_repeats", D2, "Power hike \xB7 6\xD74\u2032 Z4", "Power hiking ripetuto \u2014 UTMB style.", "lactate_tolerance", "build", ["trail", "power_hike", "ultra", "uphill"], 78, 84, [iv("6\xD74\u2032 power hike", 6, 240, 180, "Z4", "Z1")], { warm: 12, cool: 10 }),
  preset("trl_eccentric_downhill", D2, "Eccentric \xB7 4\xD78\u2032 downhill Z3", "Blocco discesa eccentrica controllata.", "aerobic_base", "build", ["trail", "downhill", "eccentric"], 75, 62, [st("Downhill 1", 8, "Z3"), rec(5), st("Downhill 2", 8, "Z3"), rec(5), st("Downhill 3", 8, "Z3"), rec(5), st("Downhill 4", 8, "Z3")], { warm: 12, cool: 10 }),
  preset("trl_kenyan_trail", D2, "Kenyan trail \xB7 10\xD71\u2032/1\u2032", "1\u2032 on 1\u2032 off su trail.", "vo2max", "build", ["trail", "kenyan", "intervals"], 58, 68, [st("Z2", 15, "Z2"), iv("10\xD71\u2032/1\u2032", 10, 60, 60, "Z5", "Z1")], { warm: 12, cool: 8 })
];

// apps/web/lib/training/library/starter-pack-aerobic-catalog-wave3-multisport.ts
var WAVE3_MULTISPORT_PRESETS = [
  // Cycling (+22)
  preset("cyc_block_periodization_z4", "Cycling", "Block period \xB7 3\xD715\u2032 Z4", "Periodizzazione a blocchi \u2014 concentrato soglia.", "lactate_tolerance", "build", ["block_periodization", "z4", "cycling"], 92, 98, [st("Z4 1", 15, "Z4"), rec(8), st("Z4 2", 15, "Z4"), rec(8), st("Z4 3", 15, "Z4")], { warm: 15, cool: 12 }),
  preset("cyc_hiit_8x2", "Cycling", "HIIT \xB7 8\xD72\u2032 Z5", "HIIT breve \u2014 letteratura miglioramento VO\u2082.", "vo2max", "build", ["hit", "hiit", "vo2", "cycling"], 58, 76, [iv("8\xD72\u2032 Z5", 8, 120, 120, "Z5", "Z1")], { warm: 12, cool: 8 }),
  preset("cyc_zone2_hiit_combo", "Cycling", "Z2 45\u2032 + HIIT 6\xD71\u2032", "Combinato polarizzato giornaliero.", "vo2max", "build", ["polarized", "hiit", "z2"], 75, 78, [st("Z2", 45, "Z2"), rec(5), iv("6\xD71\u2032 Z5", 6, 60, 120, "Z5", "Z1")], { warm: 12, cool: 10 }),
  preset("cyc_attia_longevity_z2", "Cycling", "Longevity Z2 \xB7 100\u2032", "Volume Z2 alto \u2014 salute / base aerobica.", "aerobic_base", "base", ["longevity", "z2", "health"], 100, 58, [st("Z2 steady", 76, "Z2")], { warm: 12, cool: 12 }),
  preset("cyc_seiler_4x8", "Cycling", "Seiler \xB7 4\xD78\u2032 Z4", "Formato 4\xD78 soglia \u2014 evidenza interval training.", "lactate_tolerance", "build", ["seiler", "z4", "intervals"], 85, 92, [iv("4\xD78\u2032 Z4", 4, 480, 180, "Z4", "Z1")], { warm: 15, cool: 12 }),
  preset("cyc_vo2_short_12x1", "Cycling", "VO\u2082 short \xB7 12\xD71\u2032", "12\xD71\u2032 on/off \u2014 alta frequenza.", "vo2max", "build", ["vo2", "short", "intervals"], 55, 74, [iv("12\xD71\u2032", 12, 60, 60, "Z5", "Z1")], { warm: 12, cool: 8 }),
  preset("cyc_gravel_over_under", "Cycling", "Gravel OU \xB7 4\xD7(3\u2032Z4/2\u2032Z3)", "Over-under gravel \u2014 variabilit\xE0 terreno.", "lactate_tolerance", "build", ["gravel", "over-under", "cycling"], 78, 82, [i3("Gravel OU", 4, 180, 120, 180, "Z4", "Z3", "Z4"), rec(6)], { warm: 12, cool: 10 }),
  preset("cyc_mtb_burst", "Cycling", "MTB burst \xB7 10\xD745\u2033 Z6", "Burst MTB \u2014 neuromuscolare.", "neuromuscular", "build", ["mtb", "sprint", "cycling"], 58, 68, [st("Z2", 20, "Z2"), iv("10\xD745\u2033", 10, 45, 135, "Z6", "Z1")], { warm: 12, cool: 8 }),
  preset("cyc_triathlon_brick_bike", "Cycling", "Brick bike \xB7 tempo 25\u2032", "Gamba bici post-corsa \u2014 brick sim.", "lactate_clearance", "peak", ["triathlon", "brick", "tempo"], 65, 72, [st("Brick tempo", 25, "Z3"), st("Z2 flush", 10, "Z2")], { warm: 12, cool: 10 }),
  preset("cyc_cooper_12min_test_prep", "Cycling", "Cooper prep \xB7 3\xD75\u2032 Z5", "Preparazione test \u2014 blocchi 5\u2032.", "vo2max", "build", ["test", "cooper", "vo2"], 62, 70, [iv("3\xD75\u2032 Z5", 3, 300, 240, "Z5", "Z1")], { warm: 12, cool: 10 }),
  preset("cyc_fasted_z2_75", "Cycling", "Fasted Z2 \xB7 75\u2032", "Z2 digiuno leggero \u2014 metabolismo (nota coach).", "aerobic_base", "base", ["fasted", "z2", "metabolic"], 75, 48, [st("Z2 fasted", 53, "Z2", "Opzionale digiuno \u2014 idratazione")], { warm: 10, cool: 10 }),
  preset("cyc_reverse_blocks", "Cycling", "Reverse \xB7 Z5 poi Z2", "Qualit\xE0 prima, volume dopo \u2014 giornata invertita.", "vo2max", "build", ["reverse", "polarized"], 95, 82, [iv("4\xD74\u2032 Z5", 4, 240, 240, "Z5", "Z1"), rec(8), st("Z2 volume", 35, "Z2")], { warm: 12, cool: 12 }),
  preset("cyc_low_cadence_force_3x10", "Cycling", "Low cadence \xB7 3\xD710\u2032 Z3", "Forza pedaling bassa cadenza.", "lactate_clearance", "build", ["force", "low_cadence", "cycling"], 75, 76, [st("LC 1", 10, "Z3"), rec(4), st("LC 2", 10, "Z3"), rec(4), st("LC 3", 10, "Z3")], { warm: 12, cool: 10 }),
  preset("cyc_2x20_sweet_peak", "Cycling", "Sweet peak \xB7 2\xD720\u2032 Z3", "Sweet spot gara \u2014 due blocchi.", "lactate_clearance", "peak", ["sweet_spot", "peak"], 88, 84, [st("SS 1", 20, "Z3"), rec(6), st("SS 2", 20, "Z3")], { warm: 15, cool: 12 }),
  preset("cyc_wingate_prep", "Cycling", "Wingate prep \xB7 6\xD730\u2033", "Preparazione potenza anaerobica breve.", "neuromuscular", "build", ["anaerobic", "wingate", "power"], 50, 62, [iv("6\xD730\u2033 max", 6, 30, 150, "Z6", "Z1")], { warm: 12, cool: 8 }),
  preset("cyc_endurance_neuromuscular", "Cycling", "Endurance + NM \xB7 Z2 + 8\xD715\u2033", "Z2 con tocchi neuromuscolari.", "aerobic_base", "build", ["endurance", "neuromuscular", "z2"], 90, 65, [st("Z2", 50, "Z2"), iv("8\xD715\u2033", 8, 15, 75, "Z6", "Z1"), st("Z2", 12, "Z2")], { warm: 12, cool: 10 }),
  preset("cyc_kolie_4x5", "Cycling", "Kolie style \xB7 4\xD75\u2032 Z5", "Intervalli 5\u2032 VO\u2082 \u2014 ricerca Kolie/Sandvik.", "vo2max", "build", ["vo2", "kolie", "intervals"], 68, 82, [iv("4\xD75\u2032 Z5", 4, 300, 180, "Z5", "Z1")], { warm: 12, cool: 10 }),
  preset("cyc_taper_volume_cut", "Cycling", "Taper \xB7 40\u2032 Z2 + 3\xD72\u2032", "Volume ridotto pre-evento.", "neuromuscular", "peak", ["taper", "race", "openers"], 52, 48, [st("Z2", 28, "Z2"), iv("3\xD72\u2032 Z5", 3, 120, 180, "Z5", "Z1")], { warm: 10, cool: 8 }),
  preset("cyc_ftp_ramp_test_style", "Cycling", "FTP ramp \xB7 18\u2032 progressivo", "Rampa test soglia \u2014 profilo continuo.", "lactate_clearance", "build", ["ftp", "ramp", "test"], 58, 68, [rm("FTP ramp", 18, "Z2", "Z4")], { warm: 12, cool: 10 }),
  preset("cyc_group_ride_surge", "Cycling", "Group ride \xB7 6\xD72\u2032 surge", "Simulazione gruppo \u2014 surge Z4.", "lactate_tolerance", "build", ["group_ride", "surges", "cycling"], 80, 72, [st("Z2", 35, "Z2"), iv("6\xD72\u2032 surge", 6, 120, 180, "Z4", "Z2"), st("Z2", 15, "Z2")], { warm: 12, cool: 10 }),
  preset("cyc_ultra_endurance_4h", "Cycling", "Ultra \xB7 180\u2032 Z2", "Simulazione 3h+ ultra cycling.", "aerobic_base", "build", ["ultra", "long", "z2"], 180, 95, [st("Z2 ultra", 150, "Z2")], { warm: 15, cool: 15 }),
  // Running (+20)
  preset("run_daniels_r", "Running", "Daniels R \xB7 6\xD73\u2032 Z5", "Repetition workouts \u2014 Daniels R.", "vo2max", "build", ["running", "daniels", "vo2"], 62, 74, [iv("6\xD73\u2032 R", 6, 180, 120, "Z5", "Z1")], { warm: 12, cool: 10 }),
  preset("run_daniels_i", "Running", "Daniels I \xB7 4\xD75\u2032 Z4", "Interval workouts \u2014 Daniels I.", "lactate_tolerance", "build", ["running", "daniels", "threshold"], 68, 78, [iv("4\xD75\u2032 I", 4, 300, 150, "Z4", "Z1")], { warm: 12, cool: 10 }),
  preset("run_daniels_t", "Running", "Daniels T \xB7 25\u2032 Z3", "Threshold continuo \u2014 Daniels T.", "lactate_clearance", "build", ["running", "daniels", "tempo"], 65, 72, [st("T pace 25\u2032", 25, "Z3")], { warm: 12, cool: 10 }),
  preset("run_pfitzinger_lt", "Running", "Pfitz LT \xB7 2\xD718\u2032 Z4", "Lactate threshold \u2014 piano maratona.", "lactate_tolerance", "build", ["running", "pfitzinger", "marathon"], 82, 86, [st("LT 1", 18, "Z4"), rec(6), st("LT 2", 18, "Z4")], { warm: 12, cool: 10 }),
  preset("run_hanson_tempo", "Running", "Hanson tempo \xB7 8\u2032 Z3", "Tempo cumulativo stile Hanson.", "lactate_clearance", "build", ["running", "hanson", "tempo"], 55, 58, [st("Tempo 8\u2032", 8, "Z3"), st("Z2 easy", 25, "Z2")], { warm: 12, cool: 10 }),
  preset("run_lydiard_aerobic", "Running", "Lydiard aerobic \xB7 110\u2032 Z2", "Base Lydiard \u2014 volume alto.", "aerobic_base", "base", ["running", "lydiard", "z2", "long"], 110, 68, [st("Aerobic 110\u2032", 86, "Z2")], { warm: 12, cool: 12 }),
  preset("run_interval_fartlek_7x3", "Running", "Fartlek 7\xD73\u2032", "Fartlek strutturato 7 ripetute.", "vo2max", "build", ["running", "fartlek", "intervals"], 62, 70, [iv("7\xD73\u2032", 7, 180, 120, "Z4", "Z2")], { warm: 12, cool: 10 }),
  preset("run_hill_sprints_10x12", "Running", "Hill sprint \xB7 10\xD712\u2033", "Sprint in salita \u2014 forza/run.", "neuromuscular", "build", ["running", "hill", "sprint"], 48, 55, [st("Z2", 15, "Z2"), iv("10\xD712\u2033", 10, 12, 90, "Z6", "Z1")], { warm: 12, cool: 8 }),
  preset("run_marathon_pace_3x5", "Running", "MP \xB7 3\xD75 km equiv.", "3\xD75\u2032 Z3 ritmo maratona (equiv).", "lactate_clearance", "peak", ["running", "marathon", "race"], 78, 76, [st("MP 1", 22, "Z3"), rec(4), st("MP 2", 22, "Z3"), rec(4), st("MP 3", 22, "Z3")], { warm: 12, cool: 10 }),
  preset("run_5k_pace_6x1k", "Running", "5K pace \xB7 6\xD71\u2032 Z5", "Ritmo 5K \u2014 intervalli brevi.", "vo2max", "build", ["running", "5k", "vo2", "race"], 58, 72, [iv("6\xD71\u2032 5k", 6, 60, 120, "Z5", "Z1")], { warm: 12, cool: 10 }),
  preset("run_half_marathon_pace", "Running", "HM pace \xB7 2\xD725\u2032 Z3", "Ritmo mezza maratona.", "lactate_clearance", "peak", ["running", "half_marathon", "race"], 88, 80, [st("HM 1", 25, "Z3"), rec(6), st("HM 2", 25, "Z3")], { warm: 12, cool: 10 }),
  preset("run_strides_post_easy", "Running", "Easy + strides \xB7 8\xD720\u2033", "Corsa facile + strides.", "neuromuscular", "base", ["running", "strides", "recovery"], 50, 42, [st("Easy 35\u2032", 35, "Z2"), iv("8\xD720\u2033", 8, 20, 60, "Z6", "Z1")], { warm: 10, cool: 8 }),
  preset("run_cutdown_5_4_3_2", "Running", "Cutdown \xB7 5-4-3-2\u2032 Z5", "Cutdown intervals \u2014 densit\xE0 decrescente.", "vo2max", "build", ["running", "cutdown", "vo2"], 65, 74, [st("5\u2032 Z5", 5, "Z5"), rec(2), st("4\u2032 Z5", 4, "Z5"), rec(2), st("3\u2032 Z5", 3, "Z5"), rec(2), st("2\u2032 Z5", 2, "Z5")], { warm: 12, cool: 10 }),
  preset("run_ultra_back_to_back_long", "Running", "Ultra B2B \xB7 90\u2032 + 60\u2032", "Back-to-back long \u2014 ultra prep.", "aerobic_base", "build", ["running", "ultra", "tier"], 160, 82, [st("Day sim AM", 90, "Z2"), rec(12), st("Day sim PM", 60, "Z2")], { warm: 15, cool: 15 }),
  preset("run_heat_adaptation", "Running", "Heat run \xB7 50\u2032 Z2 + tempo", "Adattamento caldo corsa.", "aerobic_base", "peak", ["running", "heat", "temperature"], 75, 58, [st("Z2 hot", 50, "Z2"), st("Tempo 12\u2032", 12, "Z3")], { warm: 12, cool: 10 }),
  preset("run_altitude_z2", "Running", "Altitude Z2 \xB7 80\u2032", "Corsa quota Z2 \u2014 base altitudine.", "aerobic_base", "build", ["running", "altitude", "z2"], 80, 52, [st("Z2 altitude", 58, "Z2")], { warm: 12, cool: 10 }),
  preset("run_pyramid_1_5", "Running", "Pyramid \xB7 1-5\u2032 Z5", "Piramide minuti VO\u2082.", "vo2max", "build", ["running", "pyramid", "vo2"], 68, 76, [st("1\u2032 Z5", 1, "Z5"), rec(1), st("2\u2032 Z5", 2, "Z5"), rec(2), st("3\u2032 Z5", 3, "Z5"), rec(2), st("4\u2032 Z5", 4, "Z5"), rec(2), st("5\u2032 Z5", 5, "Z5")], { warm: 12, cool: 10 }),
  preset("run_recovery_shake", "Running", "Recovery shake \xB7 35\u2032 Z1", "Recupero attivo molto leggero.", "recovery", "deload", ["running", "recovery"], 35, 22, [st("Z1 shake", 22, "Z1")], { warm: 8, cool: 8 }),
  preset("run_cruise_intervals_2x15", "Running", "Cruise 2\xD715\u2032", "Due cruise lunghi.", "lactate_clearance", "build", ["running", "cruise", "z3"], 72, 70, [st("Cruise 1", 15, "Z3"), rec(5), st("Cruise 2", 15, "Z3")], { warm: 12, cool: 10 }),
  preset("run_bilbao_tempo_hills", "Running", "Tempo hills \xB7 3\xD78\u2032 Z4", "Tempo in salita \u2014 trail/road.", "lactate_tolerance", "build", ["running", "hill", "tempo"], 70, 76, [iv("3\xD78\u2032 hill", 3, 480, 180, "Z4", "Z1")], { warm: 12, cool: 10 }),
  preset("run_maffetone_maf", "Running", "MAF \xB7 70\u2032 Z2", "Max aerobic function \u2014 bassa intensit\xE0.", "aerobic_base", "base", ["running", "maffetone", "maf", "z2"], 70, 48, [st("MAF pace", 48, "Z2", "HR sotto MAF se noto")], { warm: 10, cool: 10 }),
  // Swimming (+14)
  preset("swm_css_test_400", "Swimming", "CSS test \xB7 400+200", "Test critico swim pace.", "lactate_tolerance", "build", ["swimming", "css", "test"], 55, 52, [st("400 m", 8, "Z4"), rec(5), st("200 m", 4, "Z5")], { warm: 10, cool: 8 }),
  preset("swm_aerobic_pace_1500", "Swimming", "Aerobic \xB7 1500 m equiv.", "1500 m continuo aerobico.", "aerobic_base", "base", ["swimming", "aerobic", "endurance"], 60, 45, [st("1500 m pace", 45, "Z2")], { warm: 10, cool: 8 }),
  preset("swm_vo2_25s", "Swimming", "VO\u2082 \xB7 16\xD725 m", "25 m max \u2014 VO\u2082 pool.", "vo2max", "build", ["swimming", "vo2", "sprint"], 45, 48, [iv("16\xD725 m", 16, 20, 40, "Z6", "Z1")], { warm: 10, cool: 8 }),
  preset("swm_threshold_50s", "Swimming", "Threshold \xB7 12\xD750 m", "50 m a CSS.", "lactate_clearance", "build", ["swimming", "threshold", "css"], 48, 46, [iv("12\xD750 m", 12, 45, 20, "Z4", "Z1")], { warm: 10, cool: 8 }),
  preset("swm_recovery_800", "Swimming", "Recovery \xB7 800 m Z1", "Recupero vasca leggero.", "recovery", "base", ["swimming", "recovery"], 35, 28, [st("800 easy", 22, "Z1")], { warm: 10, cool: 8 }),
  preset("swm_kick_set_8x100", "Swimming", "Kick \xB7 8\xD7100 m", "Serie gambe \u2014 tecnica.", "lactate_clearance", "build", ["swimming", "kick", "technique"], 52, 48, [iv("8\xD7100 kick", 8, 90, 30, "Z3", "Z1")], { warm: 10, cool: 8 }),
  preset("swm_pull_paddles_6x200", "Swimming", "Pull \xB7 6\xD7200 m", "Pull con palette \u2014 forza.", "lactate_tolerance", "build", ["swimming", "pull", "force"], 58, 52, [iv("6\xD7200 pull", 6, 180, 30, "Z4", "Z1")], { warm: 10, cool: 8 }),
  preset("swm_descend_100_4_1", "Swimming", "Descend \xB7 4\xD7100 m", "100 m decrescenti per tempo.", "vo2max", "build", ["swimming", "descending", "intervals"], 50, 50, [st("100 1", 2, "Z4"), rec(1), st("100 2", 2, "Z4"), rec(1), st("100 3", 2, "Z5"), rec(1), st("100 4", 1, "Z5")], { warm: 10, cool: 8 }),
  preset("swm_over_under_75", "Swimming", "OU \xB7 6\xD775 m", "Over-under 75 m percepito.", "lactate_tolerance", "build", ["swimming", "over-under"], 48, 46, [i3("OU 75", 6, 45, 30, 45, "Z4", "Z3", "Z4")], { warm: 10, cool: 8 }),
  preset("swm_long_rest_vo2", "Swimming", "VO\u2082 long rec \xB7 5\xD7100", "100 m Z5 con 1\u2032 rec.", "vo2max", "build", ["swimming", "vo2"], 50, 52, [iv("5\xD7100 m", 5, 90, 60, "Z5", "Z1")], { warm: 10, cool: 8 }),
  preset("swm_technique_drills", "Swimming", "Technique \xB7 drills 30\u2032", "Drills tecnici aerobici.", "aerobic_base", "base", ["swimming", "technique", "drills"], 45, 35, [st("Drills Z2", 28, "Z2")], { warm: 12, cool: 8 }),
  preset("swm_open_water_sim", "Swimming", "OW sim \xB7 40\u2032 steady", "Simulazione acque libere continuo.", "aerobic_base", "build", ["swimming", "open_water", "endurance"], 50, 42, [st("OW steady", 32, "Z2")], { warm: 10, cool: 8 }),
  preset("swm_sprint_set_20x25", "Swimming", "Sprint \xB7 20\xD725 m", "Serie sprint tecnica.", "neuromuscular", "build", ["swimming", "sprint"], 48, 46, [iv("20\xD725 m", 20, 18, 42, "Z6", "Z1")], { warm: 10, cool: 8 }),
  preset("swm_mixed_strokes", "Swimming", "Mixed \xB7 200 free/back/breast", "Tre stili \u2014 variet\xE0 neuromuscolare.", "aerobic_base", "build", ["swimming", "mixed", "technique"], 55, 44, [st("Free 200", 6, "Z2"), rec(2), st("Back 200", 7, "Z2"), rec(2), st("Breast 200", 8, "Z3")], { warm: 10, cool: 8 }),
  // Canoe (+10)
  preset("can_marathon_paddle", "Canoe", "Marathon \xB7 2\xD730\u2032 Z3", "Ritmo maratona canoa.", "lactate_clearance", "peak", ["canoe", "marathon", "race"], 95, 78, [st("MP 1", 30, "Z3"), rec(6), st("MP 2", 30, "Z3")], { warm: 12, cool: 10 }),
  preset("can_vo2_4x4", "Canoe", "VO\u2082 \xB7 4\xD74\u2032 paddle", "4\xD74 canoa \u2014 capacit\xE0 aerobica.", "vo2max", "build", ["canoe", "vo2", "4x4"], 68, 74, [iv("4\xD74\u2032", 4, 240, 180, "Z5", "Z1")], { warm: 12, cool: 10 }),
  preset("can_technique_z2", "Canoe", "Technique \xB7 Z2 + drills", "Tecnica pagaia in Z2.", "aerobic_base", "base", ["canoe", "technique", "z2"], 75, 50, [st("Z2", 35, "Z2"), st("Drills", 15, "Z2"), st("Z2", 15, "Z2")], { warm: 12, cool: 10 }),
  preset("can_power_surge_8", "Canoe", "Power \xB7 8\xD71\u2032 Z4", "Surge potenza \u2014 sprint canoe.", "lactate_tolerance", "build", ["canoe", "power", "surges"], 70, 72, [st("Z2", 30, "Z2"), iv("8\xD71\u2032", 8, 60, 120, "Z4", "Z2")], { warm: 12, cool: 10 }),
  preset("can_long_z2_120", "Canoe", "Long Z2 \xB7 120\u2032", "Volume lungo acqua piatta.", "aerobic_base", "base", ["canoe", "z2", "long"], 120, 58, [st("Z2 paddle", 92, "Z2")], { warm: 15, cool: 12 }),
  preset("can_race_pace_3x10", "Canoe", "Race pace \xB7 3\xD710\u2032 Z4", "Ritmo gara sprint distance.", "lactate_tolerance", "peak", ["canoe", "race", "z4"], 72, 80, [st("RP 1", 10, "Z4"), rec(5), st("RP 2", 10, "Z4"), rec(5), st("RP 3", 10, "Z4")], { warm: 12, cool: 10 }),
  preset("can_polarized_paddle", "Canoe", "Polarized \xB7 60\u2032 Z2 + 4\xD73\u2032", "Polarizzato canoa.", "aerobic_base", "build", ["canoe", "polarized", "z2"], 88, 68, [st("Z2", 60, "Z2"), rec(4), iv("4\xD73\u2032 Z5", 4, 180, 120, "Z5", "Z1")], { warm: 12, cool: 10 }),
  preset("can_upwind_sim", "Canoe", "Upwind \xB7 4\xD78\u2032 Z3", "Simulazione controvento \u2014 forza.", "lactate_clearance", "build", ["canoe", "upwind", "force"], 78, 72, [st("Upwind 1", 8, "Z3"), rec(4), st("Upwind 2", 8, "Z3"), rec(4), st("Upwind 3", 8, "Z3"), rec(4), st("Upwind 4", 8, "Z3")], { warm: 12, cool: 10 }),
  preset("can_recovery_paddle", "Canoe", "Recovery \xB7 45\u2032 Z1", "Recupero leggero.", "recovery", "base", ["canoe", "recovery"], 45, 28, [st("Z1 paddle", 28, "Z1")], { warm: 10, cool: 8 }),
  preset("can_billat_paddle", "Canoe", "Billat \xB7 12\xD730\u2033/30\u2033", "Micro-interval canoe.", "vo2max", "build", ["canoe", "billat", "hit"], 55, 65, [iv("12\xD730\u2033/30\u2033", 12, 30, 30, "Z5", "Z1")], { warm: 10, cool: 8 })
];

// apps/web/lib/training/library/starter-pack-aerobic-catalog-endurance-matrix.ts
var PHASE_META = {
  base: { label: "Base", zone: "Z2", adaptation: "aerobic_base", tssFactor: 0.72, tags: ["endurance", "z2", "base_phase"] },
  build: {
    label: "Build",
    zone: "Z2",
    adaptation: "aerobic_base",
    tssFactor: 0.88,
    tags: ["endurance", "z2", "build_phase", "volume"]
  },
  peak: { label: "Peak", zone: "Z2", adaptation: "aerobic_base", tssFactor: 0.78, tags: ["endurance", "z2", "peak_phase", "taper_volume"] },
  deload: {
    label: "Deload",
    zone: "Z1",
    adaptation: "recovery",
    tssFactor: 0.48,
    tags: ["endurance", "recovery", "deload", "deload_phase"]
  }
};
var DURATION_BANDS = [
  { suffix: "45", minutes: 45, scale: 0.72 },
  { suffix: "60", minutes: 60, scale: 0.88 },
  { suffix: "90", minutes: 90, scale: 1 },
  { suffix: "120", minutes: 120, scale: 1.18 }
];
function buildEnduranceMatrix() {
  const out = [];
  const disciplines = [
    DISCIPLINE_SCALES.cycling,
    DISCIPLINE_SCALES.running,
    DISCIPLINE_SCALES.swimming,
    DISCIPLINE_SCALES.canoe,
    DISCIPLINE_SCALES.xcSki,
    DISCIPLINE_SCALES.trailRunning
  ];
  for (const d of disciplines) {
    for (const phase of Object.keys(PHASE_META)) {
      const meta = PHASE_META[phase];
      for (const band of DURATION_BANDS) {
        const plannedMinutes = Math.max(30, Math.round(band.minutes * d.durationScale));
        const mainMin = Math.max(18, Math.round((plannedMinutes - 24) * band.scale));
        const tss = Math.max(12, Math.round(plannedMinutes * 0.62 * meta.tssFactor * d.tssScale));
        const presetId = `${d.slug}_phase_${phase}_z2_${band.suffix}`;
        out.push(
          preset(
            presetId,
            d.discipline,
            `${meta.label} ${d.discipline} \xB7 ${band.suffix}\u2032`,
            `Volume ${meta.zone} fase ${phase} \u2014 matrice catalogo (crescita controllata).`,
            meta.adaptation,
            phase === "deload" ? "deload" : phase,
            [...meta.tags, d.slug],
            plannedMinutes,
            tss,
            [st(`Steady ${meta.zone}`, mainMin, meta.zone)],
            { warm: phase === "deload" ? 8 : 12, cool: phase === "deload" ? 8 : 10 }
          )
        );
      }
    }
  }
  return out;
}
var ENDURANCE_MATRIX_PRESETS = buildEnduranceMatrix();

// apps/web/lib/training/library/starter-pack-aerobic-catalog-wave4.ts
var FTP3 = DEFAULT_STARTER_RENDER.ftpW;
function buildWave4Multidiscipline() {
  const templates = [
    {
      baseId: "w4_cruise_3x10",
      build: (discipline) => ({
        title: `Cruise \xB7 3\xD710\u2032 Z3 \xB7 ${discipline}`,
        description: "Tre blocchi tempo sostenuto \u2014 recupero visibile tra i lavori.",
        adaptationTarget: "lactate_clearance",
        phase: "build",
        tags: ["cruise", "tempo", "z3", "tier"],
        plannedMinutes: 72,
        tss: 68,
        blocks: [st("Cruise 1", 10, "Z3"), rec(3), st("Cruise 2", 10, "Z3"), rec(3), st("Cruise 3", 10, "Z3")]
      })
    },
    {
      baseId: "w4_threshold_5x4",
      build: (discipline) => ({
        title: `Soglia \xB7 5\xD74\u2032 Z4 \xB7 ${discipline}`,
        description: "Serie soglia classica \u2014 2\u2032 recupero attivo.",
        adaptationTarget: "lactate_tolerance",
        phase: "build",
        tags: ["threshold", "z4", "intervals", "norwegian"],
        plannedMinutes: 68,
        tss: 82,
        viryaWeekObjective: "quality",
        blocks: [iv("5\xD74\u2032 Z4", 5, 240, 120, "Z4", "Z1")]
      })
    },
    {
      baseId: "w4_vo2_double_tier",
      build: (discipline) => ({
        title: `VO\u2082 doppio tier \xB7 ${discipline}`,
        description: "3\xD73\u2032 Z5, recupero 8\u2032, poi 2\xD75\u2032 Z5 \u2014 separazione qualit\xE0.",
        adaptationTarget: "vo2max",
        phase: "build",
        tags: ["vo2", "tier", "intervals", "quality"],
        plannedMinutes: 78,
        tss: 88,
        blocks: [iv("Tier A \xB7 3\xD73\u2032", 3, 180, 120, "Z5", "Z1"), rec(8), iv("Tier B \xB7 2\xD75\u2032", 2, 300, 240, "Z5", "Z1")]
      })
    },
    {
      baseId: "w4_ladder_z4",
      build: (discipline) => ({
        title: `Ladder Z4 \xB7 3-6\u2032 \xB7 ${discipline}`,
        description: "Scala crescente a soglia \u2014 ogni blocco diverso.",
        adaptationTarget: "lactate_tolerance",
        phase: "build",
        tags: ["ladder", "ascending", "z4", "threshold"],
        plannedMinutes: 75,
        tss: 86,
        blocks: [
          st("3\u2032 Z4", 3, "Z4"),
          rec(2),
          st("4\u2032 Z4", 4, "Z4"),
          rec(3),
          st("5\u2032 Z4", 5, "Z4"),
          rec(3),
          st("6\u2032 Z4", 6, "Z4")
        ]
      })
    },
    {
      baseId: "w4_pyramid_vo2_5",
      build: (discipline) => ({
        title: `Pyramid VO\u2082 \xB7 5 step \xB7 ${discipline}`,
        description: "Piramide watt \u2014 salita e discesa controllata.",
        adaptationTarget: "vo2max",
        phase: "build",
        tags: ["pyramid", "vo2", "structured"],
        plannedMinutes: 65,
        tss: 78,
        blocks: [py("Pyramid Z4\u2192Z5", 5, 180, Math.round(FTP3 * 0.88), Math.round(FTP3 * 1.08))]
      })
    },
    {
      baseId: "w4_ou_double",
      build: (discipline) => ({
        title: `Over-under \xB7 2\xD7(3\xD7OU) \xB7 ${discipline}`,
        description: "Due blocchi over-under interval3 \u2014 6\u2032 tra i blocchi.",
        adaptationTarget: "lactate_tolerance",
        phase: "build",
        tags: ["over_under", "interval3", "z4", "z3"],
        plannedMinutes: 80,
        tss: 84,
        blocks: [
          i3("OU A", 3, 120, 60, 120, "Z4", "Z3", "Z4"),
          rec(6),
          i3("OU B", 3, 120, 60, 120, "Z4", "Z3", "Z4")
        ]
      })
    },
    {
      baseId: "w4_polarized_insert",
      build: (discipline) => ({
        title: `Polarizzato insert \xB7 ${discipline}`,
        description: "Z2 lungo, tier 4\xD74\u2032 Z5, chiusura Z2.",
        adaptationTarget: "aerobic_base",
        phase: "build",
        tags: ["polarized", "z2", "vo2"],
        plannedMinutes: 95,
        tss: 76,
        blocks: [st("Z2 volume", 40, "Z2"), rec(5), iv("4\xD74\u2032 Z5", 4, 240, 240, "Z5", "Z1"), st("Z2 flush", 15, "Z2")]
      })
    },
    {
      baseId: "w4_tempo_ramp_finish",
      build: (discipline) => ({
        title: `Z2\u2192tempo ramp \xB7 ${discipline}`,
        description: "Base Z2, rampa progressiva, chiusura tempo Z3.",
        adaptationTarget: "aerobic_base",
        phase: "build",
        tags: ["progressive", "ramp", "z3", "z2"],
        plannedMinutes: 88,
        tss: 62,
        blocks: [st("Z2 base", 25, "Z2"), rm("Rampa Z2\u2192Z3", 12, "Z2", "Z3"), st("Tempo finish", 12, "Z3")]
      })
    },
    {
      baseId: "w4_micro_30_30_24",
      build: (discipline) => ({
        title: `30\u2033/30\u2033 \xD724 \xB7 ${discipline}`,
        description: "Micro-intervalli estesi \u2014 polarizzato / Seiler-style touch.",
        adaptationTarget: "vo2max",
        phase: "build",
        tags: ["30-30", "micro", "vo2", "polarized"],
        plannedMinutes: 58,
        tss: 74,
        blocks: [iv("30\u2033/30\u2033 \xD724", 24, 30, 30, "Z5", "Z1")]
      })
    },
    {
      baseId: "w4_sweet_2x18",
      build: (discipline) => ({
        title: `Sweet spot \xB7 2\xD718\u2032 \xB7 ${discipline}`,
        description: "Due blocchi Z3 alto \u2014 recupero 5\u2032 tra i lavori.",
        adaptationTarget: "lactate_clearance",
        phase: "build",
        tags: ["sweet_spot", "z3", "threshold"],
        plannedMinutes: 82,
        tss: 80,
        blocks: [st("Sweet 1", 18, "Z3"), rec(5), st("Sweet 2", 18, "Z3")]
      })
    },
    {
      baseId: "w4_anaerobic_tier",
      build: (discipline) => ({
        title: `Anaerobic tier \xB7 ${discipline}`,
        description: "6\xD745\u2033 Z6, recupero 5\u2032, poi 4\xD730\u2033 Z6.",
        adaptationTarget: "neuromuscular",
        phase: "build",
        tags: ["anaerobic", "tier", "z6", "hit"],
        plannedMinutes: 55,
        tss: 68,
        blocks: [iv("Tier A \xB7 6\xD745\u2033", 6, 45, 120, "Z6", "Z1"), rec(5), iv("Tier B \xB7 4\xD730\u2033", 4, 30, 90, "Z6", "Z1")]
      })
    }
  ];
  const out = [];
  for (const tpl of templates) {
    out.push(
      ...presetForDisciplines(tpl.baseId, ALL_DISCIPLINES, (discipline, durationScale, tssScale) => {
        const base = tpl.build(discipline);
        return {
          ...base,
          plannedMinutes: Math.max(28, Math.round(base.plannedMinutes * durationScale)),
          tss: Math.max(18, Math.round(base.tss * tssScale))
        };
      })
    );
  }
  return out;
}
var WAVE4_CYCLING = [
  preset("cyc_w4_crit_3x8", "Cycling", "Crit \xB7 3\xD78\u2032 Z5", "Simulazione criterium \u2014 blocchi VO\u2082 lunghi.", "vo2max", "peak", ["cycling", "crit", "race", "vo2"], 72, 86, [iv("3\xD78\u2032 Z5", 3, 480, 300, "Z5", "Z1")], { warm: 12, cool: 10 }),
  preset("cyc_w4_ttt_progressive", "Cycling", "TTT progressive \xB7 40\u2032", "Rampa Z3\u2192Z4 continua \u2014 time trial.", "lactate_tolerance", "peak", ["cycling", "tt", "time_trial", "ramp"], 68, 82, [rm("TT ramp", 40, "Z3", "Z4")], { warm: 15, cool: 12 }),
  preset("cyc_w4_vo3max_6x3", "Cycling", "vVO\u2082 \xB7 6\xD73\u2032", "Intervalli a vVO\u2082 \u2014 recupero 1:1.", "vo2max", "build", ["cycling", "vo2", "vvo2"], 62, 78, [iv("6\xD73\u2032 Z5", 6, 180, 180, "Z5", "Z1")], { warm: 12, cool: 10 }),
  preset("cyc_w4_climb_surge_5", "Cycling", "Climb surge \xB7 5\xD7(4\u2032Z4+1\u2032Z6)", "Salita con picco neuromuscolare.", "lactate_tolerance", "build", ["cycling", "climbing", "surges"], 78, 84, [i3("Climb surge", 5, 240, 60, 60, "Z4", "Z3", "Z6"), rec(4)], { warm: 12, cool: 10 }),
  preset("cyc_w4_endurance_neuromuscular_12", "Cycling", "Z2 + 12\xD720\u2033 NM", "Endurance con tocchi neuromuscolari frequenti.", "aerobic_base", "build", ["cycling", "endurance", "neuromuscular", "z2"], 92, 68, [st("Z2", 48, "Z2"), iv("12\xD720\u2033", 12, 20, 70, "Z6", "Z1"), st("Z2", 14, "Z2")], { warm: 12, cool: 10 }),
  preset("cyc_w4_billat_30_30_20", "Cycling", "Billat \xB7 20\xD730\u2033/30\u2033", "Serie Billat estesa.", "vo2max", "build", ["cycling", "billat", "hit"], 58, 76, [iv("20\xD730\u2033/30\u2033", 20, 30, 30, "Z5", "Z1")], { warm: 12, cool: 8 }),
  preset("cyc_w4_taper_openers_5x2", "Cycling", "Taper openers \xB7 5\xD72\u2032", "Pre-gara \u2014 volume ridotto + openers.", "neuromuscular", "peak", ["cycling", "taper", "openers", "race"], 50, 46, [st("Z2", 22, "Z2"), iv("5\xD72\u2032 Z5", 5, 120, 180, "Z5", "Z1")], { warm: 10, cool: 8 }),
  preset("cyc_w4_gravel_over_under_long", "Cycling", "Gravel OU long \xB7 3\xD7(5\u2032Z4/3\u2032Z3)", "Over-under gravel \u2014 blocchi lunghi.", "lactate_tolerance", "build", ["cycling", "gravel", "over-under"], 88, 86, [i3("Gravel OU", 3, 300, 180, 300, "Z4", "Z3", "Z4"), rec(8)], { warm: 12, cool: 10 }),
  preset("cyc_w4_ftp_blocks_2x20", "Cycling", "FTP \xB7 2\xD720\u2032 Z4", "Due blocchi FTP \u2014 recupero 8\u2032.", "lactate_tolerance", "build", ["cycling", "ftp", "z4"], 85, 92, [st("FTP 1", 20, "Z4"), rec(8), st("FTP 2", 20, "Z4")], { warm: 15, cool: 12 }),
  preset("cyc_w4_z2_z5_brick", "Cycling", "Brick Z2\u2192Z5 \xB7 50+4\xD73\u2032", "Volume poi qualit\xE0 \u2014 simulazione brick.", "vo2max", "peak", ["cycling", "brick", "triathlon"], 78, 80, [st("Z2 brick", 50, "Z2"), rec(6), iv("4\xD73\u2032 Z5", 4, 180, 180, "Z5", "Z1")], { warm: 12, cool: 10 }),
  preset("cyc_w4_cadence_pyramid", "Cycling", "Cadence pyramid \xB7 5 step", "Piramide cadenza/potenza su Z3.", "lactate_clearance", "build", ["cycling", "cadence", "pyramid"], 70, 72, [py("Cadence pyramid", 5, 150, Math.round(FTP3 * 0.75), Math.round(FTP3 * 0.95))], { warm: 12, cool: 10 }),
  preset("cyc_w4_recovery_spin_50", "Cycling", "Recovery spin \xB7 50\u2032 Z1", "Giorno recupero attivo leggero.", "recovery", "deload", ["cycling", "recovery", "deload"], 50, 26, [st("Z1 spin", 32, "Z1")], { warm: 10, cool: 8 }),
  preset("cyc_w4_race_sim_3x12", "Cycling", "Race sim \xB7 3\xD712\u2032 Z4", "Tre blocchi ritmo gara.", "lactate_tolerance", "peak", ["cycling", "race", "simulation"], 82, 88, [st("Race 1", 12, "Z4"), rec(5), st("Race 2", 12, "Z4"), rec(5), st("Race 3", 12, "Z4")], { warm: 15, cool: 12 }),
  preset("cyc_w4_hypoxic_touch_5x5", "Cycling", "Hypoxic touch \xB7 5\xD75\u2032 Z3", "Blocchi Z3 densi \u2014 simulazione ipossia.", "aerobic_base", "build", ["cycling", "hypoxic", "z3"], 72, 64, [iv("5\xD75\u2032 Z3", 5, 300, 180, "Z3", "Z1", "Stimolo ipossico simulato")], { warm: 12, cool: 10 }),
  preset("cyc_w4_sprint_neuromuscular_8x12", "Cycling", "Sprint \xB7 8\xD712\u2033 max", "Accelerazioni max \u2014 recupero pieno.", "neuromuscular", "build", ["cycling", "sprint", "neuromuscular"], 48, 54, [iv("8\xD712\u2033", 8, 12, 150, "Z6", "Z1")], { warm: 12, cool: 8 }),
  preset("cyc_w4_mixed_quality_day", "Cycling", "Mixed quality \xB7 threshold+VO\u2082", "Soglia breve poi VO\u2082 \u2014 giornata mista.", "vo2max", "build", ["cycling", "mixed", "threshold", "vo2"], 90, 94, [iv("4\xD75\u2032 Z4", 4, 300, 120, "Z4", "Z1"), rec(10), iv("3\xD74\u2032 Z5", 3, 240, 240, "Z5", "Z1")], { warm: 12, cool: 10 }),
  preset("cyc_w4_endurance_pickups_6", "Cycling", "Endurance pickups \xB7 6\xD790\u2033", "Z2 con pickup Z4 incorporati.", "aerobic_base", "build", ["cycling", "endurance", "pickups", "z2"], 88, 70, [st("Z2", 42, "Z2"), iv("6\xD790\u2033 pickup", 6, 90, 210, "Z4", "Z2"), st("Z2", 16, "Z2")], { warm: 12, cool: 10 }),
  preset("cyc_w4_norwegian_3x9", "Cycling", "Norwegian \xB7 3\xD79\u2032 Z4", "Blocchi soglia lunghi norvegesi.", "lactate_tolerance", "build", ["cycling", "norwegian", "z4"], 78, 86, [st("9\u2032 Z4", 9, "Z4"), rec(4), st("9\u2032 Z4", 9, "Z4"), rec(4), st("9\u2032 Z4", 9, "Z4")], { warm: 12, cool: 10 }),
  preset("cyc_w4_vo2_3x7", "Cycling", "VO\u2082 \xB7 3\xD77\u2032 Z5", "Intervalli VO\u2082 medi \u2014 recupero 3\u2032.", "vo2max", "build", ["cycling", "vo2", "intervals"], 68, 82, [iv("3\xD77\u2032 Z5", 3, 420, 180, "Z5", "Z1")], { warm: 12, cool: 10 }),
  preset("cyc_w4_gran_fondo_sim_140", "Cycling", "Gran fondo sim \xB7 140\u2032", "Uscita lunga con surge finali.", "aerobic_base", "build", ["cycling", "gran_fondo", "long", "z2"], 140, 88, [st("Z2 GF", 110, "Z2"), iv("6\xD72\u2032 surge", 6, 120, 180, "Z4", "Z2"), st("Z2 home", 12, "Z2")], { warm: 15, cool: 12 }),
  preset("cyc_w4_coffee_ride_z2", "Cycling", "Coffee ride \xB7 65\u2032 Z2", "Uscita sociale aerobica \u2014 densit\xE0 bassa.", "aerobic_base", "base", ["cycling", "z2", "social", "endurance"], 65, 42, [st("Z2 social", 45, "Z2")], { warm: 10, cool: 10 }),
  preset("cyc_w4_indoor_trainer_vo2", "Cycling", "Trainer \xB7 4\xD75\u2032 Z5", "File indoor \u2014 intervalli VO\u2082 puliti.", "vo2max", "build", ["cycling", "indoor", "trainer", "vo2"], 62, 76, [iv("4\xD75\u2032 Z5", 4, 300, 180, "Z5", "Z1")], { warm: 12, cool: 8 }),
  preset("cyc_w4_over_gear_4x12", "Cycling", "Over gear \xB7 4\xD712\u2032 Z3", "Forza \u2014 rapporto pesante bassa cadenza.", "lactate_clearance", "build", ["cycling", "force", "low_cadence"], 82, 78, [st("OG 1", 12, "Z3"), rec(4), st("OG 2", 12, "Z3"), rec(4), st("OG 3", 12, "Z3"), rec(4), st("OG 4", 12, "Z3")], { warm: 12, cool: 10 }),
  preset("cyc_w4_race_openers_90", "Cycling", "Race openers \xB7 90\u2032", "Z2 + 4\xD73\u2032 Z5 + Z2 \u2014 openers pre-evento.", "neuromuscular", "peak", ["cycling", "openers", "race"], 90, 72, [st("Z2", 50, "Z2"), rec(6), iv("4\xD73\u2032 Z5", 4, 180, 240, "Z5", "Z1"), st("Z2 spin", 12, "Z2")], { warm: 12, cool: 10 }),
  preset("cyc_w4_tte_3x12", "Cycling", "TTE \xB7 3\xD712\u2032 Z4", "Time-to-exhaustion style \u2014 soglia sostenuta.", "lactate_tolerance", "build", ["cycling", "tte", "z4"], 80, 88, [st("TTE 1", 12, "Z4"), rec(5), st("TTE 2", 12, "Z4"), rec(5), st("TTE 3", 12, "Z4")], { warm: 12, cool: 10 }),
  preset("cyc_w4_zwift_race_prep", "Cycling", "Zwift race prep \xB7 mixed", "Warm Z2 + OU + sprint touch.", "lactate_tolerance", "peak", ["cycling", "zwift", "race", "simulation"], 75, 78, [st("Z2", 25, "Z2"), i3("OU touch", 2, 120, 60, 120, "Z4", "Z3", "Z4"), rec(5), iv("4\xD730\u2033 sprint", 4, 30, 90, "Z6", "Z1")], { warm: 12, cool: 10 }),
  preset("cyc_w4_deload_quality_cut", "Cycling", "Deload quality \xB7 2\xD75\u2032 Z4", "Settimana scarico \u2014 qualit\xE0 ridotta.", "recovery", "deload", ["cycling", "deload", "quality"], 55, 48, [st("Z2", 30, "Z2"), iv("2\xD75\u2032 Z4", 2, 300, 180, "Z4", "Z1")], { warm: 10, cool: 8 }),
  preset("cyc_w4_emtb_burst_z2", "Cycling", "eMTB \xB7 Z2 + bursts", "Trail e-bike \u2014 Z2 con burst Z5.", "vo2max", "build", ["cycling", "emtb", "mtb", "bursts"], 85, 72, [st("Z2 trail", 50, "Z2"), iv("8\xD740\u2033 burst", 8, 40, 100, "Z5", "Z2"), st("Z2", 15, "Z2")], { warm: 12, cool: 10 })
];
var WAVE4_RUNNING = [
  preset("run_w4_progression_6mi", "Running", "Progression \xB7 6 mi equiv.", "Ultimi 20\u2032 progressivi Z3\u2192Z4.", "lactate_clearance", "build", ["running", "progression", "tempo"], 72, 68, [st("Easy", 35, "Z2"), rm("Progression", 20, "Z3", "Z4")], { warm: 12, cool: 10 }),
  preset("run_w4_800_repeats", "Running", "800 m repeats \xB7 5\xD7", "Ripetute 800 m \u2014 ritmo 5K/10K.", "vo2max", "build", ["running", "track", "vo2"], 58, 72, [iv("5\xD7800 m", 5, 180, 120, "Z5", "Z1")], { warm: 12, cool: 10 }),
  preset("run_w4_mile_repeats_3", "Running", "Mile repeats \xB7 3\xD7", "3\xD71600 m \u2014 soglia alta.", "lactate_tolerance", "build", ["running", "mile", "threshold"], 68, 78, [st("Mile 1", 8, "Z4"), rec(4), st("Mile 2", 8, "Z4"), rec(4), st("Mile 3", 8, "Z4")], { warm: 12, cool: 10 }),
  preset("run_w4_cutback_long", "Running", "Cutback long \xB7 100\u2032", "Long run con ultimi 15\u2032 Z3.", "aerobic_base", "build", ["running", "long", "cutback"], 100, 72, [st("Z2 long", 75, "Z2"), st("Cutback Z3", 15, "Z3")], { warm: 12, cool: 12 }),
  preset("run_w4_float_recovery", "Running", "Float \xB7 6\xD73\u2032 Z4 / 2\u2032 float", "Recupero float tra intervalli.", "lactate_tolerance", "build", ["running", "float", "threshold"], 65, 74, [iv("6\xD73\u2032 float", 6, 180, 120, "Z4", "Z2")], { warm: 12, cool: 10 }),
  preset("run_w4_kenyan_fartlek", "Running", "Kenyan fartlek \xB7 50\u2032", "Fartlek libero strutturato in Z2.", "aerobic_base", "build", ["running", "fartlek", "kenyan"], 50, 52, [st("Z2", 20, "Z2"), iv("Fartlek surges", 8, 90, 90, "Z4", "Z2"), st("Z2", 12, "Z2")], { warm: 12, cool: 10 }),
  preset("run_w4_hill_tempo_3x6", "Running", "Hill tempo \xB7 3\xD76\u2032", "Tempo in salita \u2014 forza specifica.", "lactate_tolerance", "build", ["running", "hill", "tempo"], 62, 70, [iv("3\xD76\u2032 hill", 3, 360, 180, "Z4", "Z1")], { warm: 12, cool: 10 }),
  preset("run_w4_10k_pace_4x2", "Running", "10K pace \xB7 4\xD72\u2032", "Ritmo 10K \u2014 intervalli brevi densi.", "vo2max", "peak", ["running", "10k", "race"], 55, 66, [iv("4\xD72\u2032 10k", 4, 120, 120, "Z5", "Z1")], { warm: 12, cool: 10 }),
  preset("run_w4_recovery_jog_40", "Running", "Recovery jog \xB7 40\u2032 Z1", "Recupero molto leggero.", "recovery", "deload", ["running", "recovery"], 40, 24, [st("Z1 jog", 26, "Z1")], { warm: 8, cool: 8 }),
  preset("run_w4_marathon_specific_2x8", "Running", "Marathon specific \xB7 2\xD78 mi", "Due blocchi ritmo maratona (equiv).", "lactate_clearance", "peak", ["running", "marathon", "race"], 95, 82, [st("MP block 1", 32, "Z3"), rec(6), st("MP block 2", 32, "Z3")], { warm: 12, cool: 10 })
];
var WAVE4_TRAIL = [
  preset("trl_w4_vertical_4x5", "Trail Running", "Vertical \xB7 4\xD75\u2032 Z4", "Ripetute vertical gain \u2014 trail power.", "lactate_tolerance", "build", ["trail", "vertical", "hill", "z4"], 68, 74, [iv("4\xD75\u2032 uphill", 4, 300, 180, "Z4", "Z1")], { warm: 12, cool: 10 }),
  preset("trl_w4_technical_z2_90", "Trail Running", "Technical Z2 \xB7 90\u2032", "Z2 su sentiero tecnico \u2014 coordinazione.", "aerobic_base", "base", ["trail", "technical", "z2"], 90, 52, [st("Technical Z2", 66, "Z2")], { warm: 12, cool: 12 }),
  preset("trl_w4_downhill_neuromuscular", "Trail Running", "Downhill NM \xB7 8\xD730\u2033", "Neuromuscolare discesa controllata.", "neuromuscular", "build", ["trail", "downhill", "neuromuscular"], 55, 58, [st("Z2 approach", 25, "Z2"), iv("8\xD730\u2033 downhill", 8, 30, 90, "Z6", "Z1")], { warm: 12, cool: 10 }),
  preset("trl_w4_sky_race_sim", "Trail Running", "Skyrace sim \xB7 tier Z3/Z4", "Simulazione skyrace \u2014 due tier.", "lactate_tolerance", "peak", ["trail", "skyrace", "race"], 85, 80, [st("Climb Z3", 25, "Z3"), rec(6), iv("4\xD74\u2032 Z4", 4, 240, 120, "Z4", "Z1")], { warm: 12, cool: 10 }),
  preset("trl_w4_power_hiking", "Trail Running", "Power hiking \xB7 5\xD78\u2032 Z3", "Camminata potente in salita.", "lactate_clearance", "build", ["trail", "power_hiking", "vertical"], 75, 68, [st("Hike 1", 8, "Z3"), rec(3), st("Hike 2", 8, "Z3"), rec(3), st("Hike 3", 8, "Z3"), rec(3), st("Hike 4", 8, "Z3"), rec(3), st("Hike 5", 8, "Z3")], { warm: 12, cool: 10 }),
  preset("trl_w4_ultra_backoff", "Trail Running", "Ultra backoff \xB7 120\u2032 Z2", "Volume ultra trail \u2014 densit\xE0 bassa.", "aerobic_base", "build", ["trail", "ultra", "long", "z2"], 120, 68, [st("Z2 trail", 92, "Z2")], { warm: 15, cool: 12 }),
  preset("trl_w4_fartlek_trail", "Trail Running", "Trail fartlek \xB7 55\u2032", "Fartlek su trail \u2014 variabilit\xE0 terreno.", "aerobic_base", "build", ["trail", "fartlek"], 55, 54, [st("Z2", 18, "Z2"), iv("6\xD72\u2032 surge", 6, 120, 120, "Z4", "Z2"), st("Z2", 12, "Z2")], { warm: 12, cool: 10 }),
  preset("trl_w4_vo2_hill_5x3", "Trail Running", "VO\u2082 hill \xB7 5\xD73\u2032", "VO\u2082 in salita \u2014 trail intervals.", "vo2max", "build", ["trail", "vo2", "hill"], 62, 72, [iv("5\xD73\u2032 hill VO\u2082", 5, 180, 120, "Z5", "Z1")], { warm: 12, cool: 10 }),
  preset("trl_w4_race_pace_down", "Trail Running", "Race pace \xB7 3\xD712\u2032 Z3", "Ritmo gara trail \u2014 blocchi sostenuti.", "lactate_clearance", "peak", ["trail", "race", "z3"], 78, 76, [st("RP 1", 12, "Z3"), rec(5), st("RP 2", 12, "Z3"), rec(5), st("RP 3", 12, "Z3")], { warm: 12, cool: 10 }),
  preset("trl_w4_taper_trail_50", "Trail Running", "Taper trail \xB7 50\u2032 + openers", "Taper pre-gara trail.", "neuromuscular", "peak", ["trail", "taper", "openers"], 50, 44, [st("Z2", 32, "Z2"), iv("4\xD71\u2032 Z5", 4, 60, 120, "Z5", "Z1")], { warm: 10, cool: 8 })
];
var WAVE4_SWIMMING = [
  preset("swm_w4_css_5x200", "Swimming", "CSS \xB7 5\xD7200 m", "200 m a CSS \u2014 soglia nuoto.", "lactate_tolerance", "build", ["swimming", "css", "threshold"], 52, 50, [iv("5\xD7200 m", 5, 180, 30, "Z4", "Z1")], { warm: 10, cool: 8 }),
  preset("swm_w4_vo2_8x100", "Swimming", "VO\u2082 \xB7 8\xD7100 m", "100 m VO\u2082 \u2014 recupero 20\u2033.", "vo2max", "build", ["swimming", "vo2"], 48, 52, [iv("8\xD7100 m", 8, 90, 20, "Z5", "Z1")], { warm: 10, cool: 8 }),
  preset("swm_w4_endurance_3x500", "Swimming", "Endurance \xB7 3\xD7500 m", "Serie aerobiche lunghe.", "aerobic_base", "build", ["swimming", "endurance", "z2"], 65, 48, [st("500 1", 10, "Z2"), rec(2), st("500 2", 10, "Z2"), rec(2), st("500 3", 10, "Z2")], { warm: 10, cool: 8 }),
  preset("swm_w4_broken_800", "Swimming", "Broken 800 \xB7 4\xD7200", "800 m spezzato \u2014 ritmo gara.", "lactate_clearance", "peak", ["swimming", "broken", "race"], 50, 48, [st("200 1", 3, "Z4"), rec(1), st("200 2", 3, "Z4"), rec(1), st("200 3", 3, "Z4"), rec(1), st("200 4", 3, "Z4")], { warm: 10, cool: 8 }),
  preset("swm_w4_ladder_50_100", "Swimming", "Ladder \xB7 50-100 m", "Scala distanze \u2014 variet\xE0.", "vo2max", "build", ["swimming", "ladder"], 48, 46, [st("50 m", 1, "Z5"), rec(1), st("100 m", 2, "Z5"), rec(2), st("100 m", 2, "Z5"), rec(2), st("50 m", 1, "Z5")], { warm: 10, cool: 8 }),
  preset("swm_w4_kick_pull_combo", "Swimming", "Kick+pull \xB7 6\xD7150", "Combinato tecnica/forza.", "lactate_clearance", "build", ["swimming", "kick", "pull"], 52, 46, [iv("6\xD7150 m", 6, 120, 30, "Z3", "Z1")], { warm: 10, cool: 8 }),
  preset("swm_w4_recovery_swim", "Swimming", "Recovery swim \xB7 30\u2032 Z1", "Recupero vasca leggero.", "recovery", "deload", ["swimming", "recovery"], 30, 22, [st("Easy swim", 18, "Z1")], { warm: 10, cool: 8 }),
  preset("swm_w4_open_water_buoy", "Swimming", "OW buoy turns \xB7 40\u2032", "Simulazione boe \u2014 surge.", "aerobic_base", "peak", ["swimming", "open_water", "race"], 48, 44, [st("OW steady", 28, "Z2"), iv("6\xD720\u2033 surge", 6, 20, 60, "Z5", "Z2")], { warm: 10, cool: 8 }),
  preset("swm_w4_threshold_ladder", "Swimming", "Threshold ladder \xB7 4-6\u2032", "Scala soglia 4\u21926\u2032.", "lactate_tolerance", "build", ["swimming", "threshold", "ladder"], 50, 52, [st("4\u2032 Z4", 4, "Z4"), rec(2), st("5\u2032 Z4", 5, "Z4"), rec(2), st("6\u2032 Z4", 6, "Z4")], { warm: 10, cool: 8 }),
  preset("swm_w4_sprint_race_prep", "Swimming", "Sprint prep \xB7 10\xD725 m", "Pre-gara sprint \u2014 neuromuscolare.", "neuromuscular", "peak", ["swimming", "sprint", "race"], 42, 42, [iv("10\xD725 m", 10, 18, 50, "Z6", "Z1")], { warm: 10, cool: 8 })
];
var WAVE4_CANOE = [
  preset("can_w4_sprint_intervals_10x1", "Canoe", "Sprint \xB7 10\xD71\u2032 Z5", "Intervalli sprint canoa.", "vo2max", "build", ["canoe", "sprint", "vo2"], 62, 70, [iv("10\xD71\u2032 Z5", 10, 60, 90, "Z5", "Z1")], { warm: 12, cool: 10 }),
  preset("can_w4_endurance_race_2h", "Canoe", "Race prep \xB7 2\xD725\u2032 Z3", "Due blocchi ritmo gara.", "lactate_clearance", "peak", ["canoe", "race", "marathon"], 88, 76, [st("Race 1", 25, "Z3"), rec(6), st("Race 2", 25, "Z3")], { warm: 12, cool: 10 }),
  preset("can_w4_technique_drills_z2", "Canoe", "Technique \xB7 Z2 drills 60\u2032", "Tecnica in volume aerobico.", "aerobic_base", "base", ["canoe", "technique", "z2"], 60, 44, [st("Z2 paddle", 28, "Z2"), st("Drills", 12, "Z2"), st("Z2", 16, "Z2")], { warm: 12, cool: 10 }),
  preset("can_w4_power_paddle_6x3", "Canoe", "Power \xB7 6\xD73\u2032 Z4", "Potenza pagaia \u2014 recupero 2\u2032.", "lactate_tolerance", "build", ["canoe", "power", "z4"], 68, 74, [iv("6\xD73\u2032 Z4", 6, 180, 120, "Z4", "Z1")], { warm: 12, cool: 10 }),
  preset("can_w4_recovery_paddle_40", "Canoe", "Recovery \xB7 40\u2032 Z1", "Recupero acqua piatta.", "recovery", "deload", ["canoe", "recovery"], 40, 24, [st("Z1 paddle", 24, "Z1")], { warm: 10, cool: 8 }),
  preset("can_w4_polarized_long", "Canoe", "Polarized \xB7 80\u2032 Z2 + tier", "Volume Z2 + tier VO\u2082.", "aerobic_base", "build", ["canoe", "polarized", "long"], 95, 70, [st("Z2", 70, "Z2"), rec(5), iv("4\xD73\u2032 Z5", 4, 180, 120, "Z5", "Z1")], { warm: 12, cool: 10 }),
  preset("can_w4_upwind_force_4x6", "Canoe", "Upwind force \xB7 4\xD76\u2032 Z3", "Controvento \u2014 forza specifica.", "lactate_clearance", "build", ["canoe", "upwind", "force"], 72, 68, [st("Upwind 1", 6, "Z3"), rec(3), st("Upwind 2", 6, "Z3"), rec(3), st("Upwind 3", 6, "Z3"), rec(3), st("Upwind 4", 6, "Z3")], { warm: 12, cool: 10 }),
  preset("can_w4_billat_extended", "Canoe", "Billat \xB7 16\xD730\u2033/30\u2033", "Micro-interval esteso canoe.", "vo2max", "build", ["canoe", "billat", "hit"], 58, 68, [iv("16\xD730\u2033/30\u2033", 16, 30, 30, "Z5", "Z1")], { warm: 10, cool: 8 })
];
var WAVE4_CATALOG_PRESETS = [
  ...buildWave4Multidiscipline(),
  ...WAVE4_CYCLING,
  ...WAVE4_RUNNING,
  ...WAVE4_TRAIL,
  ...WAVE4_SWIMMING,
  ...WAVE4_CANOE
];

// apps/web/lib/training/library/starter-pack-aerobic-catalog.ts
function z2Endurance75(discipline) {
  return {
    title: `Endurance Z2 \xB7 75\u2032 \xB7 ${discipline}`,
    description: "Volume aerobico puro \u2014 densit\xE0 ossidativa.",
    adaptationTarget: "aerobic_base",
    phase: "base",
    tags: ["endurance", "z2", "aerobic"],
    plannedMinutes: 75,
    tss: 48,
    viryaWeekObjective: "volume",
    blocks: [st("Steady Z2", 51, "Z2")]
  };
}
function z2Endurance105(discipline) {
  return {
    title: `Long Z2 \xB7 105\u2032 \xB7 ${discipline}`,
    description: "Uscita lunga ossidativa \u2014 preparazione gara endurance.",
    adaptationTarget: "aerobic_base",
    phase: "base",
    tags: ["endurance", "z2", "long"],
    plannedMinutes: 105,
    tss: 68,
    viryaWeekObjective: "long",
    blocks: [st("Steady Z2", 78, "Z2")]
  };
}
function z3Tempo2x12(discipline) {
  return {
    title: `Tempo Z3 \xB7 2\xD712\u2032 \xB7 ${discipline}`,
    description: "Soglia aerobica bassa / tempo sostenuto \u2014 recupero visibile tra blocchi.",
    adaptationTarget: "lactate_clearance",
    phase: "build",
    tags: ["tempo", "z3", "quality"],
    plannedMinutes: 70,
    tss: 62,
    blocks: [st("Tempo 1", 12, "Z3"), rec(4), st("Tempo 2", 12, "Z3")]
  };
}
function z3Progressive(discipline) {
  return {
    title: `Z2\u2192Z3 progressivo \xB7 90\u2032 \xB7 ${discipline}`,
    description: "Progressione aerobica: Z2 lungo, rampa, chiusura Z3.",
    adaptationTarget: "aerobic_base",
    phase: "build",
    tags: ["z2", "z3", "progressive", "ramp"],
    plannedMinutes: 90,
    tss: 58,
    blocks: [st("Z2 base", 30, "Z2"), rm("Rampa Z2\u2192Z3", 15, "Z2", "Z3"), st("Z3 mod", 15, "Z3")]
  };
}
function norwegianThreshold5x3(discipline) {
  return {
    title: `Norvegese \xB7 5\xD73\u2032 Z4 \xB7 ${discipline}`,
    description: "Metodo norvegese \u2014 blocchi soglia aerobica Z4, recupero breve.",
    adaptationTarget: "lactate_clearance",
    phase: "build",
    tags: ["norwegian", "threshold", "z4", "quality"],
    plannedMinutes: 75,
    tss: 88,
    viryaWeekObjective: "quality",
    blocks: [iv("Serie soglia Z4", 5, 180, 120, "Z4", "Z1", "Norwegian threshold blocks")]
  };
}
function norwegianDouble4x4(discipline) {
  return {
    title: `Norvegese \xB7 2\xD7(4\xD74\u2032) \xB7 ${discipline}`,
    description: "Doppia serie 4\xD74\u2032 con 10\u2032 Z1 tra blocchi \u2014 formato nordico completo.",
    adaptationTarget: "vo2max",
    phase: "build",
    tags: ["norwegian", "vo2", "4x4", "quality"],
    plannedMinutes: 105,
    tss: 108,
    blocks: [iv("Serie A 4\xD74\u2032", 4, 240, 240, "Z5", "Z1"), rec(10), iv("Serie B 4\xD74\u2032", 4, 240, 240, "Z5", "Z1")]
  };
}
function interval30x30x20(discipline) {
  return {
    title: `30\u2033/30\u2033 \xB7 20 rep \xB7 ${discipline}`,
    description: "Micro-intervalli 30-30 \u2014 polarizzato / VO\u2082 touch.",
    adaptationTarget: "vo2max",
    phase: "build",
    tags: ["30-30", "intervals", "polarized", "vo2"],
    plannedMinutes: 55,
    tss: 72,
    blocks: [iv("30\u2033/30\u2033", 20, 30, 30, "Z5", "Z1", "30-30 format")]
  };
}
function interval20x40x12(discipline) {
  return {
    title: `20\u2033/40\u2033 \xB7 12 rep \xB7 ${discipline}`,
    description: "Stimolo anaerobico breve con recupero attivo 40\u2033.",
    adaptationTarget: "neuromuscular",
    phase: "build",
    tags: ["20-40", "anaerobic", "intervals"],
    plannedMinutes: 50,
    tss: 58,
    blocks: [iv("20\u2033/40\u2033", 12, 20, 40, "Z6", "Z1")]
  };
}
function polarized9015(discipline) {
  return {
    title: `Polarizzato \xB7 90\u2032 \xB7 ${discipline}`,
    description: "Volume Z2 isolato, poi tier VO\u2082 separato da recupero profondo.",
    adaptationTarget: "aerobic_base",
    phase: "build",
    tags: ["polarized", "z2", "vo2", "quality"],
    plannedMinutes: 90,
    tss: 78,
    viryaWeekObjective: "quality",
    blocks: [st("Volume Z2", 50, "Z2"), rec(5), iv("Quality Z5", 4, 240, 240, "Z5", "Z1"), st("Flush Z2", 8, "Z2")]
  };
}
function polarized120(discipline) {
  return {
    title: `Polarizzato long \xB7 120\u2032 \xB7 ${discipline}`,
    description: "Long Z2 + tier VO\u2082 3\xD75\u2032 con 8\u2032 rec tra volume e qualit\xE0.",
    adaptationTarget: "aerobic_base",
    phase: "build",
    tags: ["polarized", "long", "z2", "vo2"],
    plannedMinutes: 120,
    tss: 92,
    viryaWeekObjective: "long",
    blocks: [st("Volume Z2", 70, "Z2"), rec(8), iv("Z5 blocks", 3, 300, 300, "Z5", "Z1"), st("Cool flush", 10, "Z2")]
  };
}
function lactateTolerance2x15(discipline) {
  return {
    title: `Lattacido \xB7 2\xD715\u2032 Z4 \xB7 ${discipline}`,
    description: "Due blocchi soglia lunghi \u2014 12\u2032 recupero profondo tra i lavori.",
    adaptationTarget: "lactate_clearance",
    phase: "build",
    tags: ["lactate", "threshold", "z4"],
    plannedMinutes: 85,
    tss: 90,
    blocks: [st("Blocco 1", 15, "Z4"), rec(12), st("Blocco 2", 15, "Z4")]
  };
}
function lactate6x5(discipline) {
  return {
    title: `Lattacido \xB7 6\xD75\u2032 Z4 \xB7 ${discipline}`,
    description: "Serie da 5\u2032 a soglia \u2014 accumulo lattato controllato.",
    adaptationTarget: "lactate_clearance",
    phase: "build",
    tags: ["lactate", "intervals", "z4"],
    plannedMinutes: 75,
    tss: 84,
    blocks: [iv("6\xD75\u2032 Z4", 6, 300, 150, "Z4", "Z1")]
  };
}
function vo2_5x5(discipline) {
  return {
    title: `VO\u2082 tier \xB7 3\xD75\u2032 + 8\u2032 + 2\xD75\u2032 \xB7 ${discipline}`,
    description: "VO\u2082max in due tier separati da recupero profondo 8\u2032.",
    adaptationTarget: "vo2max",
    phase: "build",
    tags: ["vo2", "intervals", "quality", "tier"],
    plannedMinutes: 95,
    tss: 98,
    viryaWeekObjective: "quality",
    blocks: [
      iv("Tier A \xB7 3\xD75\u2032", 3, 300, 180, "Z5", "Z1"),
      rec(8),
      iv("Tier B \xB7 2\xD75\u2032", 2, 300, 240, "Z5", "Z1"),
      st("Z2 flush", 10, "Z2")
    ]
  };
}
function vo2_30x30x16(discipline) {
  return {
    title: `VO\u2082 \xB7 30\u2033/30\u2033 \xD716 \xB7 ${discipline}`,
    description: "Serie estesa 30-30 per capacit\xE0 aerobica alta.",
    adaptationTarget: "vo2max",
    phase: "build",
    tags: ["vo2", "30-30", "intervals"],
    plannedMinutes: 60,
    tss: 76,
    blocks: [iv("30\u2033/30\u2033 \xD716", 16, 30, 30, "Z5", "Z1")]
  };
}
function anaerobic8x45(discipline) {
  return {
    title: `Anaerobico \xB7 8\xD745\u2033 \xB7 ${discipline}`,
    description: "Potenza anaerobica \u2014 recupero lungo tra rep.",
    adaptationTarget: "neuromuscular",
    phase: "build",
    tags: ["anaerobic", "z6", "intervals"],
    plannedMinutes: 55,
    tss: 65,
    blocks: [iv("8\xD745\u2033 Z6", 8, 45, 180, "Z6", "Z1")]
  };
}
function hitTabata(discipline) {
  return {
    title: `HIT \xB7 Tabata + flush \xB7 ${discipline}`,
    description: "Tabata 8\xD7(20\u2033/10\u2033) poi Z2 flush \u2014 densit\xE0 HIT isolata.",
    adaptationTarget: "vo2max",
    phase: "build",
    tags: ["hit", "tabata", "intervals"],
    plannedMinutes: 50,
    tss: 58,
    blocks: [st("Priming Z2", 12, "Z2"), iv("Tabata", 8, 20, 10, "Z6", "Z1", "HIT Tabata"), rec(5), st("Z2 flush", 8, "Z2")]
  };
}
function hit12x1(discipline) {
  return {
    title: `HIT \xB7 12\xD71\u2032 \xB7 ${discipline}`,
    description: "HIT \u2014 1\u2032 massimale / 1\u2032 recupero.",
    adaptationTarget: "vo2max",
    phase: "build",
    tags: ["hit", "intervals", "z5"],
    plannedMinutes: 55,
    tss: 78,
    blocks: [iv("12\xD71\u2032", 12, 60, 60, "Z5", "Z1")]
  };
}
function hit40x20x8(discipline) {
  return {
    title: `HIT \xB7 40\u2033/20\u2033 \xD78 \xB7 ${discipline}`,
    description: "Formato 40-20 \u2014 stimolo ipossico-like ad alta densit\xE0.",
    adaptationTarget: "vo2max",
    phase: "build",
    tags: ["hit", "40-20", "hypoxic"],
    plannedMinutes: 48,
    tss: 62,
    blocks: [iv("40\u2033/20\u2033", 8, 40, 20, "Z5", "Z1", "Alta densit\xE0 \u2014 simula stress ipossico")]
  };
}
function hypoxicSim4x6(discipline) {
  return {
    title: `Ipossico sim \xB7 4\xD76\u2032 Z3 \xB7 ${discipline}`,
    description: "Simulazione ipossia \u2014 blocchi Z3 sostenuti (nota coach).",
    adaptationTarget: "aerobic_base",
    phase: "build",
    tags: ["hypoxic", "z3", "simulation"],
    plannedMinutes: 70,
    tss: 64,
    blocks: [iv("4\xD76\u2032 Z3", 4, 360, 180, "Z3", "Z1", "Stimolo ipossico simulato")]
  };
}
function heatEndurance90(discipline) {
  return {
    title: `Caldo \xB7 endurance Z2 \xB7 90\u2032 \xB7 ${discipline}`,
    description: "Acclimatamento termico \u2014 Z2 in condizioni calde.",
    adaptationTarget: "aerobic_base",
    phase: "peak",
    tags: ["heat", "temperature", "z2", "endurance"],
    plannedMinutes: 90,
    tss: 52,
    blocks: [st("Z2 caldo", 63, "Z2", "Ambiente caldo controllato / idratazione")]
  };
}
function heatTempo60(discipline) {
  return {
    title: `Caldo \xB7 tempo Z3 \xB7 60\u2032 \xB7 ${discipline}`,
    description: "Tempo Z3 in caldo \u2014 adattamento gare estive.",
    adaptationTarget: "lactate_clearance",
    phase: "peak",
    tags: ["heat", "temperature", "z3", "tempo"],
    plannedMinutes: 60,
    tss: 58,
    blocks: [st("Tempo Z3 caldo", 30, "Z3", "Monitoraggio temperatura")]
  };
}
function tt2x20(discipline) {
  return {
    title: `Time trial \xB7 2\xD720\u2032 \xB7 ${discipline}`,
    description: "Simulazione ritmo gara TT \u2014 due blocchi a Z4.",
    adaptationTarget: "lactate_clearance",
    phase: "peak",
    tags: ["time_trial", "tt", "z4", "race"],
    plannedMinutes: 85,
    tss: 96,
    viryaWeekObjective: "quality",
    blocks: [st("TT block 1", 20, "Z4"), st("Recupero", 8, "Z1"), st("TT block 2", 20, "Z4")]
  };
}
function tt40kSim(discipline) {
  return {
    title: `Time trial \xB7 sim 40k \xB7 ${discipline}`,
    description: "Warm Z2 + blocco TT 35\u2032 \u2014 simulazione 40 km.",
    adaptationTarget: "lactate_clearance",
    phase: "peak",
    tags: ["time_trial", "tt", "race"],
    plannedMinutes: 75,
    tss: 88,
    blocks: [st("Z2 priming", 15, "Z2"), st("TT effort", 35, "Z4")]
  };
}
function sprint10x15(discipline) {
  return {
    title: `Sprint \xB7 10\xD715\u2033 \xB7 ${discipline}`,
    description: "Neuromuscolare sprinter \u2014 max power breve.",
    adaptationTarget: "neuromuscular",
    phase: "build",
    tags: ["sprint", "neuromuscular", "sprinter"],
    plannedMinutes: 50,
    tss: 52,
    blocks: [iv("10\xD715\u2033 sprint", 10, 15, 120, "Z6", "Z1")]
  };
}
function sprint6x30(discipline) {
  return {
    title: `Sprint \xB7 6\xD730\u2033 \xB7 ${discipline}`,
    description: "Accelerazioni sprinter \u2014 full recovery.",
    adaptationTarget: "neuromuscular",
    phase: "build",
    tags: ["sprint", "neuromuscular", "sprinter"],
    plannedMinutes: 52,
    tss: 54,
    blocks: [iv("6\xD730\u2033", 6, 30, 150, "Z6", "Z1")]
  };
}
function forceLowCadence4x8(discipline) {
  return {
    title: `Forza \xB7 4\xD78\u2032 low cadence \xB7 ${discipline}`,
    description: "Lavoro di forza aerobica \u2014 cadenza bassa / resistenza.",
    adaptationTarget: "lactate_clearance",
    phase: "build",
    tags: ["force", "strength", "low_cadence"],
    plannedMinutes: 70,
    tss: 72,
    blocks: [
      st("Force 1", 8, "Z3", "Cadenza bassa / resistenza"),
      st("Recupero", 4, "Z1"),
      st("Force 2", 8, "Z3"),
      st("Recupero", 4, "Z1"),
      st("Force 3", 8, "Z3"),
      st("Recupero", 4, "Z1"),
      st("Force 4", 8, "Z3")
    ]
  };
}
function sweetSpot3x15(discipline) {
  return {
    title: `Sweet spot \xB7 3\xD715\u2032 \xB7 ${discipline}`,
    description: "Z3 alto \u2014 miglioramento soglia aerobica senza Z4 pieno.",
    adaptationTarget: "lactate_clearance",
    phase: "build",
    tags: ["sweet_spot", "z3", "threshold"],
    plannedMinutes: 85,
    tss: 86,
    blocks: [
      st("SS 1", 15, "Z3"),
      st("Rec", 5, "Z1"),
      st("SS 2", 15, "Z3"),
      st("Rec", 5, "Z1"),
      st("SS 3", 15, "Z3")
    ]
  };
}
function overUnderNorwegian(discipline) {
  return {
    title: `Over-under \xB7 3\xD7(2\u2032Z4/1\u2032Z3/2\u2032Z4) \xB7 ${discipline}`,
    description: "Oscillazioni sopra/sotto soglia \u2014 interval3 con recupero tra blocchi.",
    adaptationTarget: "lactate_clearance",
    phase: "build",
    tags: ["over_under", "norwegian", "z4", "z3"],
    plannedMinutes: 78,
    tss: 82,
    blocks: [
      i3("OU block 1", 3, 120, 60, 120, "Z4", "Z3", "Z4"),
      rec(5),
      i3("OU block 2", 3, 120, 60, 120, "Z4", "Z3", "Z4")
    ]
  };
}
var SIMPLE_MULTI_TEMPLATES = [
  { baseId: "endurance_z2_75", build: z2Endurance75 },
  { baseId: "long_z2_105", build: z2Endurance105 },
  { baseId: "heat_z2_90", build: heatEndurance90 }
];
var CYCLING_QUALITY_TEMPLATES = [
  { baseId: "tempo_z3_2x12", build: z3Tempo2x12 },
  { baseId: "z2_z3_progressive_90", build: z3Progressive },
  { baseId: "norwegian_5x3_z4", build: norwegianThreshold5x3 },
  { baseId: "norwegian_2x4x4", build: norwegianDouble4x4 },
  { baseId: "interval_30_30_x20", build: interval30x30x20 },
  { baseId: "interval_20_40_x12", build: interval20x40x12 },
  { baseId: "polarized_90", build: polarized9015 },
  { baseId: "polarized_120", build: polarized120 },
  { baseId: "lactate_2x15_z4", build: lactateTolerance2x15 },
  { baseId: "lactate_6x5_z4", build: lactate6x5 },
  { baseId: "vo2_5x5", build: vo2_5x5 },
  { baseId: "vo2_30_30_x16", build: vo2_30x30x16 },
  { baseId: "anaerobic_8x45", build: anaerobic8x45 },
  { baseId: "hit_tabata", build: hitTabata },
  { baseId: "hit_12x1", build: hit12x1 },
  { baseId: "hit_40_20_x8", build: hit40x20x8 },
  { baseId: "hypoxic_sim_4x6", build: hypoxicSim4x6 },
  { baseId: "heat_z3_60", build: heatTempo60 },
  { baseId: "tt_2x20", build: tt2x20 },
  { baseId: "tt_40k_sim", build: tt40kSim },
  { baseId: "sprint_10x15", build: sprint10x15 },
  { baseId: "sprint_6x30", build: sprint6x30 },
  { baseId: "force_4x8", build: forceLowCadence4x8 },
  { baseId: "sweet_spot_3x15", build: sweetSpot3x15 },
  { baseId: "over_under_norwegian", build: overUnderNorwegian }
];
function buildMultiDisciplinePresets() {
  const out = [];
  for (const tpl of SIMPLE_MULTI_TEMPLATES) {
    out.push(
      ...presetForDisciplines(tpl.baseId, ALL_DISCIPLINES, (discipline, durationScale) => {
        const base = tpl.build(discipline);
        const scaledMain = base.blocks.map((b) => ({
          ...b,
          durationMinutes: Math.max(1, Math.round(b.durationMinutes * durationScale))
        }));
        return { ...base, blocks: scaledMain };
      })
    );
  }
  for (const tpl of CYCLING_QUALITY_TEMPLATES) {
    out.push(
      ...presetForDisciplines(tpl.baseId, [DISCIPLINE_SCALES.cycling], (discipline) => tpl.build(discipline))
    );
  }
  return out;
}
var CYCLING_ONLY = [
  preset(
    "cyc_climb_force_5x6",
    "Cycling",
    "Climb force \xB7 5\xD76\u2032 Z4",
    "Simulazione salita forzata \u2014 cadenza bassa.",
    "lactate_clearance",
    "build",
    ["climbing", "force", "cycling"],
    80,
    88,
    [
      st("Climb 1", 6, "Z4"),
      st("Rec", 3, "Z1"),
      st("Climb 2", 6, "Z4"),
      st("Rec", 3, "Z1"),
      st("Climb 3", 6, "Z4"),
      st("Rec", 3, "Z1"),
      st("Climb 4", 6, "Z4"),
      st("Rec", 3, "Z1"),
      st("Climb 5", 6, "Z4")
    ]
  ),
  preset(
    "cyc_cadence_z2_drills",
    "Cycling",
    "Z2 + cadenza \xB7 drills",
    "Endurance con blocchi cadenza 100+ rpm.",
    "aerobic_base",
    "base",
    ["cadence", "cycling", "z2"],
    80,
    58,
    [st("Z2", 30, "Z2"), st("Cadence drill", 6, "Z2", "100+ rpm"), st("Z2", 22, "Z2")]
  ),
  preset(
    "cyc_sprint_leadout",
    "Cycling",
    "Sprint lead-out \xB7 4\xD7(30\u2033+2\u2032)",
    "Simulazione volata \u2014 2\u2032 Z4 + 30\u2033 sprint.",
    "neuromuscular",
    "peak",
    ["sprint", "sprinter", "cycling", "race"],
    65,
    70,
    [iv("Lead-out + sprint", 4, 150, 180, "Z6", "Z1", "2\u2032 Z4 + 30\u2033 max"), st("Z2 flush", 10, "Z2")]
  )
];
var SWIMMING_ONLY = [
  preset(
    "swm_aerobic_200s",
    "Swimming",
    "Aerobic \xB7 8\xD7200 m",
    "Serie aerobiche pool \u2014 Z2/Z3 per 200 m.",
    "aerobic_base",
    "base",
    ["swimming", "z2", "intervals"],
    55,
    42,
    [iv("8\xD7200 m", 8, 180, 30, "Z2", "Z1", "Pace aerobica pool")],
    { warm: 10, cool: 8 }
  ),
  preset(
    "swm_threshold_100s",
    "Swimming",
    "Threshold \xB7 10\xD7100 m",
    "Soglia nuoto \u2014 100 m on / 20 s off.",
    "lactate_clearance",
    "build",
    ["swimming", "threshold", "z4"],
    50,
    48,
    [iv("10\xD7100 m", 10, 90, 20, "Z4", "Z1")],
    { warm: 10, cool: 8 }
  ),
  preset(
    "swm_vo2_50s",
    "Swimming",
    "VO\u2082 \xB7 12\xD750 m",
    "Intervalli VO\u2082 pool \u2014 50 m fast.",
    "vo2max",
    "build",
    ["swimming", "vo2", "intervals"],
    48,
    46,
    [iv("12\xD750 m", 12, 45, 25, "Z5", "Z1")],
    { warm: 10, cool: 8 }
  ),
  preset(
    "swm_sprint_25s",
    "Swimming",
    "Sprint \xB7 8\xD725 m",
    "Neuromuscolare vasca \u2014 25 m max.",
    "neuromuscular",
    "build",
    ["swimming", "sprint", "neuromuscular"],
    40,
    38,
    [iv("8\xD725 m", 8, 20, 60, "Z6", "Z1")],
    { warm: 10, cool: 8 }
  )
];
var RUNNING_ONLY = [
  preset(
    "run_fartlek_60",
    "Running",
    "Fartlek \xB7 60\u2032",
    "Fartlek libero \u2014 alternanza Z2/Z4 per percezione.",
    "aerobic_base",
    "build",
    ["running", "fartlek", "z2", "z4"],
    60,
    55,
    [st("Z2 base", 20, "Z2"), iv("Fartlek", 6, 120, 120, "Z4", "Z2"), st("Z2 home", 12, "Z2")]
  ),
  preset(
    "run_hill_repeats",
    "Running",
    "Hill repeats \xB7 6\xD73\u2032",
    "Forza specifica running \u2014 ripetute in salita.",
    "lactate_clearance",
    "build",
    ["running", "force", "hill"],
    55,
    58,
    [iv("6\xD73\u2032 hill", 6, 180, 120, "Z4", "Z1")]
  ),
  preset(
    "run_marathon_pace",
    "Running",
    "Marathon pace \xB7 2\xD720\u2032",
    "Ritmo gara maratona \u2014 Z3 sostenuto.",
    "lactate_clearance",
    "peak",
    ["running", "marathon", "race", "z3"],
    75,
    72,
    [st("MP 1", 20, "Z3"), st("Rec", 5, "Z1"), st("MP 2", 20, "Z3")]
  )
];
var CANOE_ONLY = [
  preset(
    "can_endurance_paddle_90",
    "Canoe",
    "Endurance paddle \xB7 90\u2032 Z2",
    "Volume aerobico canoa \u2014 ritmo sostenuto acqua piatta.",
    "aerobic_base",
    "base",
    ["canoe", "z2", "endurance"],
    90,
    52,
    [st("Paddle Z2", 66, "Z2")]
  ),
  preset(
    "can_vo2_3min",
    "Canoe",
    "VO\u2082 \xB7 5\xD73\u2032 paddle",
    "Intervalli VO\u2082 canoa \u2014 3\u2032 on / 2\u2032 off.",
    "vo2max",
    "build",
    ["canoe", "vo2", "intervals"],
    65,
    68,
    [iv("5\xD73\u2032 paddle", 5, 180, 120, "Z5", "Z1")]
  ),
  preset(
    "can_sprint_starts",
    "Canoe",
    "Sprint starts \xB7 8\xD720\u2033",
    "Partenze e neuromuscolare canoa.",
    "neuromuscular",
    "build",
    ["canoe", "sprint", "neuromuscular"],
    50,
    48,
    [iv("8\xD720\u2033 start", 8, 20, 120, "Z6", "Z1")]
  )
];
var AEROBIC_CATALOG_EXTENSION_PRESETS = [
  ...buildMultiDisciplinePresets(),
  ...STRUCTURE_RICH_PRESETS,
  ...STRUCTURE_RICH_PRESETS_EXT,
  ...XC_SKI_CATALOG_PRESETS,
  ...TRAIL_RUNNING_CATALOG_PRESETS,
  ...WAVE3_MULTISPORT_PRESETS,
  ...ENDURANCE_MATRIX_PRESETS,
  ...WAVE4_CATALOG_PRESETS,
  ...CYCLING_ONLY,
  ...SWIMMING_ONLY,
  ...RUNNING_ONLY,
  ...CANOE_ONLY
];

// apps/web/lib/training/library/starter-pack-aerobic.ts
var LEGACY_CYCLING_PRESETS = [
  {
    presetId: "recovery_45_z1",
    title: "Recovery \xB7 45\u2032 Z1",
    description: "Spin leggero post-gara o giorno molto stanco.",
    discipline: "Cycling",
    adaptationTarget: "recovery",
    phase: "base",
    tags: ["recovery", "base"],
    plannedMinutes: 45,
    tss: 28,
    blocks: shell(10, 8, [{ label: "Volume Z1", kind: "steady", durationMinutes: 27, intensityCue: "Z1" }])
  },
  {
    presetId: "recovery_60_z1",
    title: "Recovery \xB7 60\u2032 Z1",
    description: "Recupero attivo lungo, densit\xE0 neuromuscolare bassa.",
    discipline: "Cycling",
    adaptationTarget: "recovery",
    phase: "base",
    tags: ["recovery"],
    plannedMinutes: 60,
    tss: 36,
    blocks: shell(12, 10, [{ label: "Volume Z1", kind: "steady", durationMinutes: 38, intensityCue: "Z1" }])
  },
  {
    presetId: "endurance_90_z2",
    title: "Endurance \xB7 90\u2032 Z2",
    description: "Base aerobica classica.",
    discipline: "Cycling",
    adaptationTarget: "aerobic_base",
    phase: "base",
    viryaWeekObjective: "volume",
    tags: ["endurance", "base"],
    plannedMinutes: 90,
    tss: 55,
    blocks: shell(15, 12, [{ label: "Steady Z2", kind: "steady", durationMinutes: 63, intensityCue: "Z2" }])
  },
  {
    presetId: "endurance_120_z2",
    title: "Long steady \xB7 120\u2032 Z2",
    description: "Long ride endurance \u2014 oxidativo.",
    discipline: "Cycling",
    adaptationTarget: "aerobic_base",
    phase: "base",
    viryaWeekObjective: "long",
    tags: ["endurance", "long"],
    plannedMinutes: 120,
    tss: 72,
    blocks: shell(18, 15, [{ label: "Steady Z2", kind: "steady", durationMinutes: 87, intensityCue: "Z2" }])
  },
  {
    presetId: "tempo_2x15_z3",
    title: "Tempo \xB7 2\xD715\u2032 Z3",
    description: "Soglia bassa / tempo continuo.",
    discipline: "Cycling",
    adaptationTarget: "lactate_clearance",
    phase: "build",
    tags: ["tempo", "quality"],
    plannedMinutes: 75,
    tss: 68,
    blocks: shell(15, 10, [
      { label: "Tempo 1", kind: "steady", durationMinutes: 15, intensityCue: "Z3" },
      { label: "Recupero attivo", kind: "steady", durationMinutes: 5, intensityCue: "Z1" },
      { label: "Tempo 2", kind: "steady", durationMinutes: 15, intensityCue: "Z3" }
    ])
  },
  {
    presetId: "sweet_spot_2x20",
    title: "Sweet spot \xB7 2\xD720\u2032",
    description: "88\u201393% FTP equivalente (Z3 alto).",
    discipline: "Cycling",
    adaptationTarget: "lactate_clearance",
    phase: "build",
    viryaWeekObjective: "quality",
    tags: ["sweet_spot", "threshold"],
    plannedMinutes: 80,
    tss: 82,
    blocks: shell(15, 10, [
      { label: "Sweet spot 1", kind: "steady", durationMinutes: 20, intensityCue: "Z3" },
      { label: "Recupero", kind: "steady", durationMinutes: 5, intensityCue: "Z1" },
      { label: "Sweet spot 2", kind: "steady", durationMinutes: 20, intensityCue: "Z3" }
    ])
  },
  {
    presetId: "sweet_spot_3x12",
    title: "Sweet spot \xB7 3\xD712\u2032",
    description: "Blocchi SS pi\xF9 corti, aderenza alta.",
    discipline: "Cycling",
    adaptationTarget: "lactate_clearance",
    phase: "build",
    tags: ["sweet_spot"],
    plannedMinutes: 70,
    tss: 74,
    blocks: shell(12, 10, [
      { label: "Sweet spot 1", kind: "steady", durationMinutes: 12, intensityCue: "Z3" },
      { label: "Recupero", kind: "steady", durationMinutes: 4, intensityCue: "Z1" },
      { label: "Sweet spot 2", kind: "steady", durationMinutes: 12, intensityCue: "Z3" },
      { label: "Recupero", kind: "steady", durationMinutes: 4, intensityCue: "Z1" },
      { label: "Sweet spot 3", kind: "steady", durationMinutes: 12, intensityCue: "Z3" }
    ])
  },
  {
    presetId: "threshold_2x20_ftp",
    title: "Threshold \xB7 2\xD720\u2032 FTP",
    description: "Soglia funzionale \u2014 qualit\xE0 centrale.",
    discipline: "Cycling",
    adaptationTarget: "lactate_clearance",
    phase: "build",
    viryaWeekObjective: "quality",
    tags: ["threshold", "ftp"],
    plannedMinutes: 85,
    tss: 95,
    blocks: shell(15, 10, [
      { label: "Soglia 1", kind: "steady", durationMinutes: 20, intensityCue: "Z4" },
      { label: "Recupero", kind: "steady", durationMinutes: 8, intensityCue: "Z1" },
      { label: "Soglia 2", kind: "steady", durationMinutes: 20, intensityCue: "Z4" }
    ])
  },
  {
    presetId: "threshold_3x12",
    title: "Threshold \xB7 3\xD712\u2032",
    description: "Soglia frazionata.",
    discipline: "Cycling",
    adaptationTarget: "lactate_clearance",
    phase: "build",
    tags: ["threshold"],
    plannedMinutes: 75,
    tss: 88,
    blocks: shell(12, 10, [
      { label: "Soglia 1", kind: "interval2", durationMinutes: 12, intensityCue: "Z4/Z1", intensity2: "Z1", repeats: 1, workSeconds: 720, recoverSeconds: 240 },
      { label: "Recupero", kind: "steady", durationMinutes: 4, intensityCue: "Z1" },
      { label: "Soglia 2", kind: "steady", durationMinutes: 12, intensityCue: "Z4" },
      { label: "Recupero", kind: "steady", durationMinutes: 4, intensityCue: "Z1" },
      { label: "Soglia 3", kind: "steady", durationMinutes: 12, intensityCue: "Z4" }
    ])
  },
  {
    presetId: "vo2_5x3",
    title: "VO\u2082 \xB7 5\xD73\u2032",
    description: "Intervalli brevi sopra soglia.",
    discipline: "Cycling",
    adaptationTarget: "vo2max",
    phase: "build",
    viryaWeekObjective: "quality",
    tags: ["vo2", "intervals"],
    plannedMinutes: 65,
    tss: 78,
    blocks: shell(15, 10, [
      {
        label: "Serie VO\u2082",
        kind: "interval2",
        durationMinutes: 30,
        intensityCue: "Z5/Z1",
        intensity2: "Z1",
        repeats: 5,
        workSeconds: 180,
        recoverSeconds: 180
      }
    ])
  },
  {
    presetId: "vo2_4x4",
    title: "VO\u2082 \xB7 4\xD74\u2032",
    description: "Classico 4\xD74 nordico.",
    discipline: "Cycling",
    adaptationTarget: "vo2max",
    phase: "build",
    tags: ["vo2"],
    plannedMinutes: 70,
    tss: 82,
    blocks: shell(15, 10, [
      {
        label: "Serie VO\u2082",
        kind: "interval2",
        durationMinutes: 32,
        intensityCue: "Z5/Z1",
        intensity2: "Z1",
        repeats: 4,
        workSeconds: 240,
        recoverSeconds: 240
      }
    ])
  },
  {
    presetId: "over_under_3x8",
    title: "Over-unders \xB7 3\xD78\u2032",
    description: "Oscillazioni sopra/sotto FTP.",
    discipline: "Cycling",
    adaptationTarget: "lactate_clearance",
    phase: "build",
    tags: ["over_under", "threshold"],
    plannedMinutes: 70,
    tss: 76,
    blocks: shell(15, 10, [
      { label: "OU block 1", kind: "steady", durationMinutes: 8, intensityCue: "Z4/Z3" },
      { label: "Recupero", kind: "steady", durationMinutes: 4, intensityCue: "Z1" },
      { label: "OU block 2", kind: "steady", durationMinutes: 8, intensityCue: "Z4/Z3" },
      { label: "Recupero", kind: "steady", durationMinutes: 4, intensityCue: "Z1" },
      { label: "OU block 3", kind: "steady", durationMinutes: 8, intensityCue: "Z4/Z3" }
    ])
  },
  {
    presetId: "pyramid_z4",
    title: "Pyramid \xB7 7 scalini Z2\u2192Z5\u2192Z2",
    description: "Piramide watt progressiva e regressiva \u2014 variabilit\xE0 continua nel grafico.",
    discipline: "Cycling",
    adaptationTarget: "lactate_clearance",
    phase: "build",
    tags: ["pyramid", "quality", "progressive"],
    plannedMinutes: 75,
    tss: 82,
    blocks: shell(15, 10, [
      {
        label: "Piramide soglia-VO\u2082",
        kind: "pyramid",
        durationMinutes: 21,
        intensityCue: "Z2\u2192Z5\u2192Z2",
        pyramidSteps: 7,
        pyramidStepSeconds: 180,
        pyramidStartTarget: 175,
        pyramidEndTarget: 265
      },
      { label: "Flush Z2", kind: "steady", durationMinutes: 8, intensityCue: "Z2" }
    ])
  },
  {
    presetId: "long_z2_150",
    title: "Long \xB7 150\u2032 Z2",
    description: "Uscita lunga preparazione gara.",
    discipline: "Cycling",
    adaptationTarget: "aerobic_base",
    phase: "peak",
    viryaWeekObjective: "long",
    tags: ["long", "endurance"],
    plannedMinutes: 150,
    tss: 95,
    blocks: shell(20, 15, [{ label: "Steady Z2", kind: "steady", durationMinutes: 115, intensityCue: "Z2" }])
  },
  {
    presetId: "race_openers_60",
    title: "Race openers \xB7 60\u2032",
    description: "Attivazione pre-gara (non fatigue).",
    discipline: "Cycling",
    adaptationTarget: "neuromuscular",
    phase: "peak",
    tags: ["openers", "race"],
    plannedMinutes: 60,
    tss: 52,
    blocks: shell(15, 10, [
      { label: "Z2 volume", kind: "steady", durationMinutes: 20, intensityCue: "Z2" },
      { label: "Opener 1", kind: "steady", durationMinutes: 2, intensityCue: "Z5" },
      { label: "Recupero", kind: "steady", durationMinutes: 3, intensityCue: "Z1" },
      { label: "Opener 2", kind: "steady", durationMinutes: 2, intensityCue: "Z5" }
    ])
  },
  {
    presetId: "active_recovery_30",
    title: "Active recovery \xB7 30\u2032",
    description: "Micro-sessione tra quality days.",
    discipline: "Cycling",
    adaptationTarget: "recovery",
    phase: "build",
    tags: ["recovery", "micro"],
    plannedMinutes: 30,
    tss: 18,
    blocks: shell(8, 6, [{ label: "Spin Z1", kind: "steady", durationMinutes: 16, intensityCue: "Z1" }])
  },
  {
    presetId: "endurance_pickups",
    title: "Endurance + pickups",
    description: "Z2 con 4 accelerazioni brevi.",
    discipline: "Cycling",
    adaptationTarget: "aerobic_base",
    phase: "base",
    tags: ["endurance", "pickups"],
    plannedMinutes: 90,
    tss: 62,
    blocks: shell(15, 12, [
      { label: "Steady Z2", kind: "steady", durationMinutes: 45, intensityCue: "Z2" },
      { label: "Pickups", kind: "interval2", durationMinutes: 12, intensityCue: "Z4/Z2", intensity2: "Z2", repeats: 4, workSeconds: 60, recoverSeconds: 120 },
      { label: "Z2 flush", kind: "steady", durationMinutes: 6, intensityCue: "Z2" }
    ])
  },
  {
    presetId: "climbing_blocks",
    title: "Climbing sim \xB7 3\xD710\u2032",
    description: "Simulazione salita Z3\u2013Z4.",
    discipline: "Cycling",
    adaptationTarget: "lactate_clearance",
    phase: "build",
    tags: ["climbing", "force"],
    plannedMinutes: 80,
    tss: 85,
    blocks: shell(15, 10, [
      { label: "Climb 1", kind: "steady", durationMinutes: 10, intensityCue: "Z4" },
      { label: "Recupero", kind: "steady", durationMinutes: 5, intensityCue: "Z1" },
      { label: "Climb 2", kind: "steady", durationMinutes: 10, intensityCue: "Z4" },
      { label: "Recupero", kind: "steady", durationMinutes: 5, intensityCue: "Z1" },
      { label: "Climb 3", kind: "steady", durationMinutes: 10, intensityCue: "Z4" }
    ])
  },
  {
    presetId: "neuromuscular_sprints",
    title: "Neuromuscular \xB7 8\xD730\u2033",
    description: "Sprint brevi, full recovery.",
    discipline: "Cycling",
    adaptationTarget: "neuromuscular",
    phase: "build",
    tags: ["sprint", "neuromuscular"],
    plannedMinutes: 55,
    tss: 48,
    blocks: shell(15, 10, [
      {
        label: "Sprint series",
        kind: "interval2",
        durationMinutes: 18,
        intensityCue: "Z6/Z1",
        intensity2: "Z1",
        repeats: 8,
        workSeconds: 30,
        recoverSeconds: 150
      }
    ])
  },
  {
    presetId: "base_cadence_drills",
    title: "Base + cadence drills",
    description: "Z2 con blocchi cadenza alta.",
    discipline: "Cycling",
    adaptationTarget: "aerobic_base",
    phase: "base",
    tags: ["cadence", "base"],
    plannedMinutes: 75,
    tss: 58,
    blocks: shell(12, 10, [
      { label: "Steady Z2", kind: "steady", durationMinutes: 25, intensityCue: "Z2" },
      { label: "Cadence drill", kind: "steady", durationMinutes: 8, intensityCue: "Z2" },
      { label: "Steady Z2", kind: "steady", durationMinutes: 20, intensityCue: "Z2" }
    ])
  }
];
var AEROBIC_STARTER_PRESETS = [
  ...LEGACY_CYCLING_PRESETS,
  ...AEROBIC_CATALOG_EXTENSION_PRESETS
];
var STARTER_PACK_TEMPLATE_COUNT = AEROBIC_STARTER_PRESETS.length;

// apps/web/lib/training/library/starter-pack-aerobic-db-core.ts
var TABLE = "aerobic_starter_presets";
async function loadAerobicStarterPresetsWithClient(client) {
  try {
    const { data, error } = await client.from(TABLE).select("data").order("sort_order", { ascending: true });
    if (error) throw new Error(error.message);
    const rows = data ?? [];
    if (rows.length === 0) return AEROBIC_STARTER_PRESETS;
    return rows.map((row) => row.data);
  } catch {
    return AEROBIC_STARTER_PRESETS;
  }
}

// apps/web/lib/training/l2/load-builder-engine-catalogs.ts
function unifiedExerciseToBuilderCatalogRow(ex) {
  const taxonomy = describeBlock1Taxonomy(ex);
  return {
    id: ex.id,
    name: ex.name,
    muscleGroup: ex.muscleGroups.join(", "),
    catalogCategory: taxonomy.catalogCategory,
    primaryDistrict: taxonomy.primaryDistrict,
    equipmentClass: taxonomy.equipmentClass,
    exerciseKind: taxonomy.exerciseKind,
    equipment: ex.equipment.join(", "),
    difficulty: ex.difficulty,
    mediaUrl: resolveExerciseMediaUrl(ex),
    movementPattern: ex.movementPattern,
    sportTags: ex.sportTags
  };
}
async function loadBuilderEngineCatalogs(client, args) {
  const aerobicPresets = await loadAerobicStarterPresetsWithClient(client);
  let gymCatalogRows = [];
  if (args.includeGym) {
    const catalog = await loadUnifiedExerciseCatalogWithClient(client);
    const sportTag = disciplineToBlock1SportTag(args.discipline);
    gymCatalogRows = selectExercises(catalog, { sportTag, limit: 400 }).map(
      unifiedExerciseToBuilderCatalogRow
    );
  }
  return { aerobicPresets, gymCatalogRows };
}

// apps/web/lib/training/builder/pro2-gym-manual-plan.ts
init_tss_estimate();
init_src();
init_pro2_intensity();

// apps/web/lib/training/builder/pro2-gym-library-filters.ts
var PRO2_GYM_CONTRACTION_LABELS = {
  standard: "Standard",
  eccentric: "Eccentrica",
  isometric: "Isometrica",
  plyometric: "Pliometrica"
};

// apps/web/lib/training/builder/pro2-gym-manual-plan.ts
function newRowId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `g-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
function defaultPro2GymManualRow(partial) {
  return {
    id: partial?.id ?? newRowId(),
    exerciseId: partial?.exerciseId ?? "",
    name: partial?.name ?? "Nuovo esercizio",
    sets: partial?.sets ?? 3,
    reps: partial?.reps ?? "8",
    loadKg: partial?.loadKg ?? null,
    restSec: partial?.restSec ?? 90,
    executionStyle: partial?.executionStyle ?? "",
    pct1Rm: partial?.pct1Rm ?? null,
    contractionEmphasis: partial?.contractionEmphasis ?? "",
    chainLabel: partial?.chainLabel ?? "",
    quickIncomplete: partial?.quickIncomplete ?? false,
    technique: partial?.technique ?? "",
    notes: partial?.notes ?? "",
    mediaUrl: partial?.mediaUrl
  };
}
function formatPro2GymRowCue(row) {
  const rx = `${Math.max(1, row.sets)}\xD7${row.reps.trim() || "\u2014"}`;
  const load = row.loadKg != null && row.loadKg > 0 ? ` @ ${row.loadKg} kg` : "";
  const pct1 = row.pct1Rm ?? null;
  const pct = pct1 != null && pct1 > 0 ? ` \xB7 ~${pct1}% 1RM` : "";
  const ceKey = row.contractionEmphasis ?? "";
  const ce = ceKey && ceKey !== "standard" ? ` \xB7 ${PRO2_GYM_CONTRACTION_LABELS[ceKey] ?? ceKey}` : "";
  const chainRaw = (row.chainLabel ?? "").trim();
  const chain = chainRaw ? ` \xB7 gruppo ${chainRaw}` : "";
  const q = row.quickIncomplete ? " \xB7 [scheda rapida]" : "";
  const exe = row.executionStyle.trim() ? ` \xB7 ${row.executionStyle.trim()}` : "";
  const rest = row.restSec > 0 ? ` \xB7 recupero ${row.restSec}s` : "";
  const tech = row.technique.trim() ? ` \xB7 ${row.technique.trim()}` : "";
  return `${rx}${load}${pct}${ce}${chain}${q}${exe}${rest}${tech}`.trim();
}
function estimateGymRowDurationMinutes(row) {
  const sets = Math.max(1, row.sets);
  const restMin = Math.max(0, row.restSec) / 60;
  const workMinPerSet = 0.75;
  return Math.max(3, Math.min(28, Math.round(sets * (workMinPerSet + restMin))));
}
function gymManualRowsToChartSegments(rows) {
  let order = 1;
  const out = [];
  for (const row of rows) {
    const dm = estimateGymRowDurationMinutes(row);
    const sec = Math.max(120, dm * 60);
    out.push({
      id: row.id,
      order: order++,
      label: row.name,
      durationSeconds: sec,
      intensityLabel: "Z3",
      intensityScore: intensityScore("Z3")
    });
  }
  return out;
}
function summarizeGymRowsForContract(rows) {
  const segs = gymManualRowsToChartSegments(rows);
  const durationSec = segs.reduce((s, x) => s + x.durationSeconds, 0);
  const tss = estimateTssFromSegments(segs);
  const avgPowerW = durationSec > 0 ? Math.round(150 * durationSec / durationSec) : 0;
  const kj = Math.round(avgPowerW * durationSec / 1e3);
  const kcal = metabolicKcalFromMechanicalKj(kj);
  return { durationSec, tss, kcal, kj, avgPowerW };
}
function buildPro2GymSchedaSessionContract(input) {
  const summary = summarizeGymRowsForContract(input.rows);
  const blocks = input.rows.map((row) => {
    const dm = estimateGymRowDurationMinutes(row);
    const cue = formatPro2GymRowCue(row);
    const pct1 = row.pct1Rm ?? null;
    const ceKey = row.contractionEmphasis ?? "";
    const chainRaw = (row.chainLabel ?? "").trim();
    return {
      id: row.id,
      label: row.name,
      kind: "gym_exercise",
      durationMinutes: dm,
      intensityCue: cue,
      notes: row.notes.trim() || void 0,
      gymRx: {
        catalogExerciseId: row.exerciseId.trim() || void 0,
        exerciseName: row.name.trim() || void 0,
        sets: row.sets,
        reps: row.reps.trim() || void 0,
        weightKg: row.loadKg,
        executionStyle: row.executionStyle.trim() || void 0,
        pct1Rm: pct1 != null && pct1 > 0 ? pct1 : void 0,
        contractionEmphasis: ceKey || void 0,
        chainLabel: chainRaw || void 0,
        quickIncomplete: row.quickIncomplete || void 0
      }
    };
  });
  return {
    version: 1,
    source: "builder",
    family: "strength",
    discipline: input.discipline.trim() || "Gym",
    sessionName: input.sessionName.trim() || "Scheda Pro 2",
    adaptationTarget: input.adaptationTarget,
    phase: input.phase,
    plannedSessionDurationMinutes: input.plannedSessionDurationMinutes != null && input.plannedSessionDurationMinutes > 0 ? Math.round(input.plannedSessionDurationMinutes) : void 0,
    scheduledTime: input.scheduledTime,
    summary,
    renderProfile: input.renderProfile,
    blocks
  };
}

// apps/web/lib/training/builder/pro2-gym-catalog-plan.ts
function strengthGenerationProfile(adaptation) {
  switch (adaptation) {
    case "max_strength":
      return {
        categories: ["strength_foundation", "sport_specific_skill"],
        technicalScope: "",
        exerciseCount: 5
      };
    case "power_output":
      return {
        categories: ["sport_specific_skill", "strength_foundation", "mixed_modal_conditioning"],
        technicalScope: "",
        exerciseCount: 5
      };
    case "skill_transfer":
      return {
        categories: ["sport_specific_skill", "strength_foundation"],
        technicalScope: "sport_specific",
        exerciseCount: 5
      };
    case "movement_quality":
    case "mobility_capacity":
      return {
        categories: ["trunk_stability", "strength_accessory", "sport_specific_skill"],
        technicalScope: "",
        exerciseCount: 4
      };
    case "recovery":
      return {
        categories: ["trunk_stability", "strength_accessory", "mixed_modal_conditioning"],
        technicalScope: "generic",
        exerciseCount: 4
      };
    default:
      return {
        categories: ["mixed_modal_conditioning", "strength_foundation", "strength_accessory"],
        technicalScope: "",
        exerciseCount: 5
      };
  }
}
function normalizeExerciseName(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}
function normalizeDistrictLabel(value) {
  return value.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "").replace(/[^a-z0-9]+/g, " ").trim();
}
var VIRYA_DISTRICT_MATCH_TOKENS = {
  petto: ["petto", "chest", "pec"],
  spalle: ["spalle", "shoulder", "delt"],
  dorsali: ["dorsal", "lats", "latissimus", "gran dorsale"],
  schiena: ["schiena", "back", "trapez", "upper back"],
  addominali: ["addomin", "core", "abs", "oblique"],
  gambe: ["gambe", "leg", "quadricip", "femor", "glute", "polpacc", "lower"],
  polpacci: ["polpacc", "calf", "calves"],
  glutei: ["glute"],
  femorali: ["femor", "hamstring"],
  quadricipiti: ["quadricip", "quad"],
  braccia: ["bicip", "tricip", "bracc", "arm"],
  avambracci: ["avambr", "forearm", "grip"],
  "full body": ["full body", "total body"],
  "total body": ["full body", "total body"]
};
function viryaDistrictSearchTokens(label) {
  const n = normalizeDistrictLabel(label);
  const fromMap = VIRYA_DISTRICT_MATCH_TOKENS[n] ?? [];
  return Array.from(/* @__PURE__ */ new Set([n, ...fromMap]));
}
function catalogRowMatchesViryaDistricts(row, targetDistrictLabels) {
  const targets = targetDistrictLabels.map((t) => t.trim()).filter(Boolean);
  if (!targets.length) return true;
  const fullBodyOnly = targets.length > 0 && targets.every((t) => {
    const n = normalizeDistrictLabel(t);
    return n.includes("full body") || n.includes("total body");
  });
  if (fullBodyOnly) return true;
  const rowHaystack = normalizeDistrictLabel(
    [row.primaryDistrict, row.muscleGroup, row.name].filter(Boolean).join(" ")
  );
  if (!rowHaystack) return false;
  return targets.some((label) => {
    const tokens = viryaDistrictSearchTokens(label);
    return tokens.some((tok) => tok.length >= 3 && rowHaystack.includes(tok));
  });
}
function scoreCatalogRow(row, profile, activeSportTag, adaptation) {
  let score = 0;
  const cat = row.catalogCategory ?? "";
  if (profile.categories.includes(cat)) score += 7;
  const tags = (row.sportTags ?? []).map((t) => t.toLowerCase());
  const tag = activeSportTag.toLowerCase();
  if (tags.includes(tag)) score += 5;
  if (tags.some((t) => t.includes(tag) || tag.includes(t))) score += 2;
  if (profile.technicalScope === "sport_specific" && tags.length) score += 2;
  if ((row.primaryDistrict ?? "").trim()) score += 1;
  const mp = (row.movementPattern ?? "").toLowerCase();
  if (adaptation === "max_strength" && (mp.includes("squat") || mp.includes("press") || mp.includes("pull") || mp.includes("hinge")))
    score += 2;
  if (adaptation === "power_output" && (mp.includes("jump") || mp.includes("plyo") || mp.includes("olympic"))) score += 2;
  return score;
}
function prescriptionForStrengthSlot(adaptation, slotIndex, category) {
  const isPrimary = slotIndex === 0 || category === "strength_foundation" || category === "sport_specific_skill";
  switch (adaptation) {
    case "max_strength":
      return {
        sets: isPrimary ? 5 : 4,
        reps: isPrimary ? "3-5" : "5-6",
        restSec: isPrimary ? 180 : 120,
        technique: isPrimary ? "Forza neurale \xB7 esecuzione pulita" : "Back-off strength \xB7 controllo eccentrico"
      };
    case "power_output":
      return {
        sets: 4,
        reps: isPrimary ? "3-4" : "4-6",
        restSec: isPrimary ? 150 : 105,
        technique: isPrimary ? "Esplosivo \xB7 massima intenzione" : "Power accessory \xB7 velocit\xE0 costante"
      };
    case "movement_quality":
    case "mobility_capacity":
      return {
        sets: 3,
        reps: "8-12",
        restSec: 60,
        technique: "Qualit\xE0 del gesto \xB7 range controllato"
      };
    case "recovery":
      return {
        sets: 2,
        reps: "12-15",
        restSec: 45,
        technique: "Recovery flow \xB7 bassa fatica sistemica"
      };
    case "skill_transfer":
      return {
        sets: 4,
        reps: isPrimary ? "3-5" : "5-8",
        restSec: isPrimary ? 120 : 75,
        technique: "Transfer tecnico \xB7 precisione e timing"
      };
    default:
      return {
        sets: 4,
        reps: isPrimary ? "6-8" : "8-12",
        restSec: isPrimary ? 90 : 60,
        technique: "Builder strength \xB7 densit\xE0 adattativa"
      };
  }
}
function buildPro2GymRowsFromCatalog(input) {
  const profile = strengthGenerationProfile(input.adaptation);
  const districtTargets = (input.targetDistrictLabels ?? []).map((t) => t.trim()).filter(Boolean);
  const nonFullBodyDistricts = districtTargets.filter((t) => {
    const n = normalizeDistrictLabel(t);
    return !n.includes("full body") && !n.includes("total body");
  });
  const exerciseCap = Math.min(
    10,
    profile.exerciseCount + Math.max(0, nonFullBodyDistricts.length > 1 ? nonFullBodyDistricts.length : 0)
  );
  const preferred = (input.preferredExerciseNames ?? []).map(normalizeExerciseName).filter(Boolean);
  const ranked = input.sourceRows.map((row) => {
    const normalizedRowName = normalizeExerciseName(row.name);
    const preferredBoost = preferred.some(
      (name) => normalizedRowName === name || normalizedRowName.includes(name) || name.includes(normalizedRowName)
    ) ? 100 : 0;
    return {
      row,
      score: scoreCatalogRow(row, profile, input.activeSportTag, input.adaptation) + preferredBoost
    };
  }).sort((a, b) => b.score - a.score || a.row.name.localeCompare(b.row.name));
  const usedDistricts = /* @__PURE__ */ new Map();
  const selected = [];
  const usedIds = /* @__PURE__ */ new Set();
  const style = input.executionStyle.trim() || "Standard";
  for (const { row } of ranked) {
    if (selected.length >= exerciseCap) break;
    if (usedIds.has(row.id)) continue;
    if (districtTargets.length && !catalogRowMatchesViryaDistricts(row, districtTargets)) continue;
    const districtKey = (row.primaryDistrict ?? row.muscleGroup ?? "general").trim() || "general";
    const currentDistrictCount = usedDistricts.get(districtKey) ?? 0;
    if (currentDistrictCount >= 2) continue;
    const prescription = prescriptionForStrengthSlot(input.adaptation, selected.length, row.catalogCategory);
    const technique = `${style} \xB7 ${prescription.technique}`;
    const notes = [`equipment=${row.equipment || row.equipmentClass || "\u2014"}`, `category=${row.catalogCategory ?? "\u2014"}`].join(
      " \xB7 "
    );
    selected.push(
      defaultPro2GymManualRow({
        exerciseId: row.id,
        name: row.name,
        sets: prescription.sets,
        reps: prescription.reps,
        restSec: prescription.restSec,
        loadKg: null,
        executionStyle: style,
        technique,
        notes,
        mediaUrl: row.mediaUrl || void 0
      })
    );
    usedIds.add(row.id);
    usedDistricts.set(districtKey, currentDistrictCount + 1);
  }
  return selected;
}

// apps/web/lib/training/builder/build-pro2-gym-rows-from-engine.ts
function buildPro2GymRowsCatalogOnly(input) {
  return buildPro2GymRowsFromCatalog({
    sourceRows: input.catalogRows,
    activeSportTag: input.sportTag,
    adaptation: input.adaptation,
    executionStyle: input.executionStyle
  });
}

// apps/web/lib/training/planned/notes-size-guard.ts
init_pro2_session_contract();
var PLANNED_NOTES_MAX_CHARS = 3e4;
function compressPro2ContractForNotes(contract) {
  const blocks = contract.blocks?.map((block) => {
    const { notes: _notes, mediaUrl: _mediaUrl, ...rest } = block;
    if (rest.lifestyleRx?.mediaUrl) {
      const { mediaUrl: _lifestyleMedia, ...lifestyleRx } = rest.lifestyleRx;
      return { ...rest, lifestyleRx };
    }
    return rest;
  });
  const sessionInterpretation = contract.sessionInterpretation ? { ...contract.sessionInterpretation, coachPrompts: [], facilitationHints: [] } : void 0;
  return {
    ...contract,
    ...blocks ? { blocks } : {},
    ...sessionInterpretation ? { sessionInterpretation } : {}
  };
}
function decodeSerializedContract(serialized) {
  if (!serialized.startsWith(BUILDER_SESSION_JSON_TAG)) return null;
  try {
    const json = JSON.parse(
      decodeURIComponent(serialized.slice(BUILDER_SESSION_JSON_TAG.length))
    );
    if (!json || typeof json !== "object") return null;
    return json;
  } catch {
    return null;
  }
}
function buildPlannedNotesWithSizeGuard(input) {
  const serialized = serializePro2BuilderSessionContract(input.contract);
  const fullNotes = `${input.metaLine}
${serialized}`;
  if (fullNotes.length <= PLANNED_NOTES_MAX_CHARS) {
    return { ok: true, notes: fullNotes, compressed: false };
  }
  const prepared = decodeSerializedContract(serialized);
  if (prepared) {
    const compressed = compressPro2ContractForNotes(prepared);
    const compressedLine = `${BUILDER_SESSION_JSON_TAG}${encodeURIComponent(JSON.stringify(compressed))}`;
    const compressedNotes = `${input.metaLine}
${compressedLine}`;
    if (compressedNotes.length <= PLANNED_NOTES_MAX_CHARS) {
      return { ok: true, notes: compressedNotes, compressed: true };
    }
    return { ok: false, error: "contract_too_large", length: compressedNotes.length };
  }
  return { ok: false, error: "contract_too_large", length: fullNotes.length };
}

// apps/web/lib/training/plan/plan-skeleton-types.ts
var ADAPTATION_TARGETS = [
  "hypertrophy_mixed",
  "hypertrophy_myofibrillar",
  "hypertrophy_sarcoplasmic",
  "lactate_clearance",
  "lactate_tolerance",
  "max_strength",
  "mitochondrial_density",
  "mobility_capacity",
  "movement_quality",
  "neuromuscular_adaptation",
  "power_output",
  "recovery",
  "skill_transfer",
  "vo2_max_support"
];
var PLAN_PHASES = [
  "base",
  "build",
  "refine",
  "peak",
  "deload",
  "second_peak"
];
var PLAN_STATUSES = [
  "draft",
  "approved",
  "active",
  "archived"
];

// apps/web/lib/training/plan/plan-skeleton-mappers.ts
var WEEK_OBJECTIVE_KEY_TO_TARGET = {
  forza: "max_strength",
  // blueprint B (forza→max_strength)
  aerobico: "mitochondrial_density",
  // blueprint B (aerobico→mitochondrial_density)
  anaerobico: "vo2_max_support",
  // lavoro anaerobico/VO2 (lattato ha già lactate_tolerance)
  lattato: "lactate_tolerance",
  // blueprint B (lattato→lactate_tolerance)
  sprint_agilita: "neuromuscular_adaptation",
  // blueprint B (sprint_agilita→neuromuscular_adaptation)
  neuromotorio: "movement_quality",
  // controllo/qualità del movimento
  tecnico_tattico: "skill_transfer",
  // trasferimento tecnico-tattico
  recupero: "recovery"
  // blueprint B (recupero→recovery)
};
var PHASE_DEFAULT_STIMULUS = {
  base: {
    primary: "mitochondrial_density",
    secondary: "movement_quality",
    maintenance: ["max_strength"],
    avoid: ["lactate_tolerance"]
  },
  build: {
    primary: "lactate_clearance",
    secondary: "vo2_max_support",
    maintenance: ["mitochondrial_density", "max_strength"],
    avoid: []
  },
  refine: {
    primary: "vo2_max_support",
    secondary: "lactate_tolerance",
    maintenance: ["mitochondrial_density"],
    avoid: []
  },
  peak: {
    primary: "neuromuscular_adaptation",
    secondary: "power_output",
    maintenance: ["vo2_max_support"],
    avoid: ["hypertrophy_mixed"]
  },
  deload: {
    primary: "recovery",
    secondary: null,
    maintenance: ["mobility_capacity"],
    avoid: ["max_strength", "lactate_tolerance"]
  },
  second_peak: {
    primary: "neuromuscular_adaptation",
    secondary: "power_output",
    maintenance: ["vo2_max_support"],
    avoid: ["hypertrophy_mixed"]
  }
};
var ADAPTATION_TARGET_SET = new Set(ADAPTATION_TARGETS);
var PLAN_PHASE_SET = new Set(PLAN_PHASES);
var PLAN_STATUS_SET = new Set(PLAN_STATUSES);
function isAdaptationTarget2(value) {
  return typeof value === "string" && ADAPTATION_TARGET_SET.has(value);
}
function coercePhase(value) {
  return typeof value === "string" && PLAN_PHASE_SET.has(value) ? value : "base";
}
function asNumber(value, fallback) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}
function isPlainObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function asObject(value) {
  if (isPlainObject(value)) return value;
  if (typeof value === "string" && value.length > 0) {
    try {
      const parsed = JSON.parse(value);
      return isPlainObject(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }
  return null;
}
function coerceTargetList(value, cap) {
  if (!Array.isArray(value)) return [];
  const out = [];
  for (const item of value) {
    if (isAdaptationTarget2(item) && !out.includes(item)) out.push(item);
  }
  return typeof cap === "number" ? out.slice(0, cap) : out;
}
function weekObjectivesFromJson(raw, phase) {
  const fallback = PHASE_DEFAULT_STIMULUS[phase];
  const obj = asObject(raw);
  if (!obj || !isAdaptationTarget2(obj.primary)) {
    return {
      primary: fallback.primary,
      secondary: fallback.secondary,
      maintenance: [...fallback.maintenance],
      avoid: [...fallback.avoid]
    };
  }
  return {
    primary: obj.primary,
    secondary: isAdaptationTarget2(obj.secondary) ? obj.secondary : null,
    maintenance: coerceTargetList(obj.maintenance, 2),
    avoid: coerceTargetList(obj.avoid)
  };
}
function familyMixFromJson(raw) {
  const obj = asObject(raw);
  if (!obj) return { aerobicPct: 100, gymPct: 0 };
  return {
    aerobicPct: asNumber(obj.aerobic_pct, 100),
    gymPct: asNumber(obj.gym_pct, 0)
  };
}

// apps/web/lib/training/engine/aerobic-session-archetypes.ts
var BASE_ARCHETYPES = [
  {
    id: "base_z2_volume",
    labelIt: "Volume Z2 aerobico",
    adaptationTarget: "mitochondrial_density",
    intensityHint: "PRESET_POLARIZED_LONG Z2 continui 55\u201390 min effettivi; ingresso/uscita Z1; polarized base.",
    objectiveDetail: "archetype=base_z2_volume",
    durationScale: 1.28,
    tssScale: 0.88
  },
  {
    id: "base_z3_sweet",
    labelIt: "Z2\u2013Z3 dolce / fondo",
    adaptationTarget: "mitochondrial_density",
    intensityHint: "PRESET_Z3_GLICOLITICO Z3 moderata continua 30\u201350 min sotto MLSS con testa Z2 iniziale e finale.",
    objectiveDetail: "archetype=base_z3_sweet",
    durationScale: 1.05,
    tssScale: 0.98
  },
  {
    id: "base_torque_z3_neuro",
    labelIt: "Torque / SFR aerobio (Z3 corti + Z2)",
    adaptationTarget: "lactate_tolerance",
    intensityHint: "PRESET_ON_OFF Z3 6 min on / Z2 attivo 9 min off; sequenza tipo SFR su bici senza saltare a Z6.",
    objectiveDetail: "archetype=base_torque_sfr_style",
    durationScale: 1,
    tssScale: 1.02
  },
  {
    id: "base_threshold_intro",
    labelIt: "Intro soglia corta",
    adaptationTarget: "lactate_tolerance",
    intensityHint: "PRESET_LADDER Z4 4\u20136 min con recupero attivo Z2 2\u20133 min; volume a soglia contenuto in base.",
    objectiveDetail: "archetype=base_threshold_intro",
    durationScale: 0.82,
    tssScale: 1.05
  }
];
var BUILD_ARCHETYPES = [
  {
    id: "build_z3_glycolytic_long",
    labelIt: "Z3 glicolitica prolungata",
    adaptationTarget: "mitochondrial_density",
    intensityHint: "PRESET_Z3_GLICOLITICO Z3 / sotto-soglia medio-alta continuativa; stress GLUT/PFK senza picchi Z6.",
    objectiveDetail: "archetype=build_z3_glycolytic_long",
    durationScale: 1.18,
    tssScale: 1.06
  },
  {
    id: "build_norwegian_z4",
    labelIt: "Norvegese Z4",
    adaptationTarget: "lactate_tolerance",
    intensityHint: "PRESET_NORWEGIAN Z4 8\u201312 min intervallati con recuperi brevi Z1\u2013Z2 (rapporto lavoro:recupero ~1:0.25\u20130.33).",
    objectiveDetail: "archetype=build_norwegian_z4",
    durationScale: 1.05,
    tssScale: 1.12
  },
  {
    id: "build_vo2_interval",
    labelIt: "VO2 intervallato",
    adaptationTarget: "vo2_max_support",
    intensityHint: "PRESET_VO2_Z5 Z5 intervallato recuperi brevi 1:1; volume centrale VO2max senza prolungare troppo la seduta.",
    objectiveDetail: "archetype=build_vo2_interval",
    durationScale: 0.72,
    tssScale: 1.18
  },
  {
    id: "build_lactate_z6_dense",
    labelIt: "Lattato Z6 denso",
    adaptationTarget: "lactate_tolerance",
    intensityHint: "PRESET_LACTATE_MAX Z6 breve ripetuto; recuperi corti; densit\xE0 glicolitica e buffer H+.",
    objectiveDetail: "archetype=build_lactate_z6_dense",
    durationScale: 0.62,
    tssScale: 1.22
  }
];
var REFINE_ARCHETYPES = [
  {
    id: "refine_polarized_z2",
    labelIt: "Polarized Z2",
    adaptationTarget: "mitochondrial_density",
    intensityHint: "PRESET_POLARIZED_LONG Z2 distesi 25\u201345 min; Z1 tra micro-blocchi; mantenere bassa glicolisi.",
    objectiveDetail: "archetype=refine_polarized_z2",
    durationScale: 1.12,
    tssScale: 0.9
  },
  {
    id: "refine_vo2_z5",
    labelIt: "VO2 Z5",
    adaptationTarget: "vo2_max_support",
    intensityHint: "PRESET_VO2_Z5 Z5 intervallato recuperi brevi 1:1\u20131:1.5; stimolo VO2max classico.",
    objectiveDetail: "archetype=refine_vo2_z5",
    durationScale: 0.78,
    tssScale: 1.14
  },
  {
    id: "refine_sprint_z6_z7",
    labelIt: "Sprint neuromuscolare Z6\u2013Z7",
    adaptationTarget: "vo2_max_support",
    intensityHint: "PRESET_SPRINT Z6\u2013Z7 micro-intervalli 15\u201325 s con recuperi lunghi Z1\u2013Z2; intento velocit\xE0 / RFD aerobio.",
    objectiveDetail: "archetype=refine_sprint_z6_z7",
    durationScale: 0.58,
    tssScale: 1.08
  },
  {
    id: "refine_lactate_max",
    labelIt: "Lattato massimale",
    adaptationTarget: "lactate_tolerance",
    intensityHint: "PRESET_LACTATE_MAX Z6 molto breve con recuperi corti; tolleranza H+ e glicolisi massimale.",
    objectiveDetail: "archetype=refine_lactate_max",
    durationScale: 0.65,
    tssScale: 1.2
  }
];
var PEAK_ARCHETYPES = [
  {
    id: "peak_openers_z2",
    labelIt: "Aperture Z2 pre-gara",
    adaptationTarget: "mitochondrial_density",
    intensityHint: "PRESET_POLARIZED_LONG Z2 18\u201332 min; polarizzazione; tenere freschezza neuromuscolare.",
    objectiveDetail: "archetype=peak_openers_z2",
    durationScale: 0.95,
    tssScale: 0.82
  },
  {
    id: "peak_vo2_z6",
    labelIt: "VO2 / Z6 qualit\xE0",
    adaptationTarget: "vo2_max_support",
    intensityHint: "PRESET_VO2_Z6 Z6 breve / Z5\u2013Z6 intervallato recuperi brevi 1:1\u20131:1.2; qualit\xE0 alta volume ridotto.",
    objectiveDetail: "archetype=peak_vo2_z6",
    durationScale: 0.68,
    tssScale: 1.16
  },
  {
    id: "peak_sprint_touch",
    labelIt: "Touch neuromuscolare sprint",
    adaptationTarget: "vo2_max_support",
    intensityHint: "PRESET_SPRINT Z6\u2013Z7 micro-serie; recuperi completi; non cumulare volume glicolitico.",
    objectiveDetail: "archetype=peak_sprint_touch",
    durationScale: 0.52,
    tssScale: 0.95
  },
  {
    id: "peak_lactate_race_pace",
    labelIt: "Lattato gara / race pace",
    adaptationTarget: "lactate_tolerance",
    intensityHint: "PRESET_LADDER Z4 3\u20135 min con recuperi attivi brevi; simulazione ritmo gara corta.",
    objectiveDetail: "archetype=peak_lactate_race_pace",
    durationScale: 0.7,
    tssScale: 1.1
  }
];
var DELOAD_ARCHETYPES = [
  {
    id: "deload_spin_z1_z2",
    labelIt: "Spin attivo Z1\u2013Z2",
    adaptationTarget: "recovery",
    intensityHint: "Z1\u2013Z2 dominante; respirazione guidata; nessun blocco Z4.",
    objectiveDetail: "archetype=deload_spin",
    durationScale: 0.85,
    tssScale: 0.55
  },
  {
    id: "deload_endurance_flush",
    labelIt: "Defaticamento endurance",
    adaptationTarget: "recovery",
    intensityHint: "Z2 molto leggero continuo; eventuali tocchi Z3 brevissimi sotto 6 min totali.",
    objectiveDetail: "archetype=deload_flush",
    durationScale: 0.92,
    tssScale: 0.62
  },
  {
    id: "deload_connective",
    labelIt: "Mobilit\xE0 connettivo / pedalare",
    adaptationTarget: "recovery",
    intensityHint: "Z1 prevalente con micro-accelerazioni Z2; priorit\xE0 tessuto e autonomico.",
    objectiveDetail: "archetype=deload_connective",
    durationScale: 0.78,
    tssScale: 0.5
  },
  {
    id: "deload_active_rest",
    labelIt: "Riposo attivo",
    adaptationTarget: "recovery",
    intensityHint: "Z1 continuo; durata contenuta; nessuna densit\xE0 lattacida.",
    objectiveDetail: "archetype=deload_active_rest",
    durationScale: 0.65,
    tssScale: 0.45
  }
];
function archetypesForPhase(phase) {
  if (phase === "deload") return DELOAD_ARCHETYPES;
  if (phase === "base") return BASE_ARCHETYPES;
  if (phase === "build") return BUILD_ARCHETYPES;
  if (phase === "refine") return REFINE_ARCHETYPES;
  if (phase === "peak" || phase === "second_peak") return PEAK_ARCHETYPES;
  return BASE_ARCHETYPES;
}
function pickAerobicSessionArchetype(input) {
  const has = (id) => input.weekObjectives.some((o) => o === id);
  const sessions = Math.max(1, input.sessionsInWeek);
  const slot = (input.sessionIndexInWeek % sessions + sessions) % sessions;
  if (has("recupero") || input.viryaPhase === "deload") {
    return DELOAD_ARCHETYPES[slot % DELOAD_ARCHETYPES.length];
  }
  const list = archetypesForPhase(input.viryaPhase);
  const pickFromPool = (pool) => pool[slot % pool.length] ?? list[0];
  if (has("sprint_agilita") || has("neuromotorio")) {
    const pool = list.filter((a) => /sprint/i.test(a.id));
    if (pool.length >= 2) return pickFromPool(pool);
    if (pool.length === 1) return pickFromPool(list);
  } else if (has("lattato") || has("anaerobico")) {
    const pool = list.filter((a) => /lactate|norwegian|ladder|vo2_z6|vo2_z5/i.test(a.id));
    if (pool.length >= 2) return pickFromPool(pool);
    if (pool.length === 1) return pickFromPool(list);
  } else if (has("aerobico")) {
    const pool = list.filter((a) => /z2_volume|polarized|sweet|torque|z3|glycolytic/i.test(a.id));
    if (pool.length >= 2) return pickFromPool(pool);
    if (pool.length === 1) return pickFromPool(list);
  }
  return pickFromPool(list);
}

// apps/web/lib/training/engine/aerobic-virya-prescription.ts
function goalOverrides(goalSummary) {
  const g = goalSummary.toLowerCase();
  if (g.includes("recovery") || g.includes("recuper")) {
    return {
      adaptationTarget: "recovery",
      intensityHint: "Z1\u2013Z2 attivo; volume basso; priorit\xE0 autonomico e tessuto.",
      objectiveDetail: "override_goal=recovery",
      archetypeId: "goal_override_recovery",
      archetypeLabelIt: "Recupero (obiettivo piano)",
      durationScale: 1,
      tssScale: 1
    };
  }
  if (/\bvo2\b|vo2max|z5|z6/i.test(g)) {
    return {
      adaptationTarget: "vo2_max_support",
      intensityHint: "PRESET_VO2_Z5 Z5\u2013Z6 intervallato recuperi brevi 1:1\u20131:1.5; stimolo VO2max e glicolisi rapida (da obiettivo piano).",
      objectiveDetail: "override_goal=vo2",
      archetypeId: "goal_override_vo2",
      archetypeLabelIt: "VO2 (obiettivo piano)",
      durationScale: 1,
      tssScale: 1
    };
  }
  if (/\blactat|lattat|\bsoglia\b|threshold/i.test(g)) {
    return {
      adaptationTarget: "lactate_tolerance",
      intensityHint: "PRESET_NORWEGIAN Z4 8\u201312 min con recuperi brevi Z1\u2013Z2 (da obiettivo piano soglia / lattato).",
      objectiveDetail: "override_goal=threshold",
      archetypeId: "goal_override_threshold",
      archetypeLabelIt: "Soglia (obiettivo piano)",
      durationScale: 1,
      tssScale: 1
    };
  }
  return null;
}
function resolveAerobicViryaPrescription(input) {
  const override = goalOverrides(input.goalSummary);
  if (override) return override;
  const arch = pickAerobicSessionArchetype({
    viryaPhase: input.viryaPhase,
    sessionIndexInWeek: input.sessionIndexInWeek,
    sessionsInWeek: input.sessionsInWeek,
    weekObjectives: input.weekObjectives
  });
  return {
    adaptationTarget: arch.adaptationTarget,
    intensityHint: arch.intensityHint,
    objectiveDetail: `${arch.objectiveDetail} \xB7 archetypeId=${arch.id}`,
    archetypeId: arch.id,
    archetypeLabelIt: arch.labelIt,
    durationScale: arch.durationScale,
    tssScale: arch.tssScale
  };
}

// apps/web/lib/training/virya/gym-day-modules.ts
function gymModuleDistricts(m) {
  if (Array.isArray(m.districts) && m.districts.length) return m.districts.filter(Boolean);
  const legacy = (m.district ?? "").trim();
  return legacy ? [legacy] : ["Gambe"];
}
function formatGymDistrictsLabel(m) {
  return gymModuleDistricts(m).join(" + ");
}

// apps/web/lib/training/virya/derive-virya-builder-instructions.ts
init_src();
var WEEKDAY_LABELS = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];
function weekdayLabel(offset) {
  return WEEKDAY_LABELS[Math.max(0, Math.min(6, Math.round(offset)))] ?? "\u2014";
}
function kcalFromLoadTarget(load, durationMinutes = 60, ftpW = 250) {
  const tss = Math.max(0, load);
  const sec = Math.max(60, Math.round(durationMinutes) * 60);
  const hours = sec / 3600;
  const ifN = hours > 0 ? Math.sqrt(Math.max(0, tss) / (hours * 100)) : 0;
  const powerW = Math.round(ifN * Math.max(40, ftpW));
  const kj = mechanicalKjFromAvgPower(powerW, sec);
  return metabolicKcalFromMechanicalKj(kj);
}
function gymDurationMinutesForBrief(role, gymPrimaryGoal) {
  const goal = (gymPrimaryGoal ?? "").toLowerCase();
  if (role === "recovery") return 45;
  if (role === "quality") {
    if (/(potenza|rapid)/.test(goal)) return 55;
    if (/forza/.test(goal)) return 65;
    return 60;
  }
  if (/massa/.test(goal)) return 75;
  if (/definiz/.test(goal)) return 58;
  return 68;
}
function deriveStrengthAdaptationForRole(module, role, gymPrimaryGoal) {
  const objectiveText = `${gymPrimaryGoal ?? ""} ${module.districtObjective} ${module.methodology}`.toLowerCase();
  if (role === "volume") {
    if (/(definiz|circuit|resist)/.test(objectiveText)) return "lactate_clearance";
    if (/(massa|iper)/.test(objectiveText)) return "hypertrophy_sarcoplasmic";
    return "hypertrophy_mixed";
  }
  if (role === "recovery") return "recovery";
  if (/(potenza|rapid)/.test(objectiveText)) return "power_output";
  if (/(mobil|stretch|postural)/.test(objectiveText)) return "mobility_capacity";
  return "max_strength";
}
function deriveTechnicalAdaptation(module, role) {
  const objectiveText = module.objectives.join(" ").toLowerCase();
  if (role === "volume") return "skill_transfer";
  if (objectiveText.includes("recupero")) return "recovery";
  if (objectiveText.includes("aerobico")) return "mitochondrial_density";
  if (objectiveText.includes("anaerobico")) return "lactate_tolerance";
  if (objectiveText.includes("velocita")) return "power_output";
  return "lactate_tolerance";
}
function deriveLifestyleAdaptation(module) {
  const objectiveText = `${module.objective} ${module.practiceType}`.toLowerCase();
  if (/(recupero|stress|respir|medit)/.test(objectiveText)) return "recovery";
  if (/(mobil|flessibil)/.test(objectiveText)) return "mobility_capacity";
  return "movement_quality";
}
function viryaDomainForSession(family, discipline) {
  if (family === "strength") return "gym";
  if (family === "lifestyle") return "mind_body";
  if (family === "technical") {
    return ["Boxe", "Karate", "Judo", "Muay Thai"].includes(discipline) ? "combat" : "team_sport";
  }
  return "endurance";
}
function aerobicRoleScale(role) {
  if (role === "quality") return { durationScale: 1.05, tssScale: 1.22 };
  if (role === "recovery") return { durationScale: 0.88, tssScale: 0.72 };
  return { durationScale: 1, tssScale: 0.58 };
}
function deriveViryaBuilderInstructions(input) {
  const { brief } = input;
  const tss = Math.max(1, Math.round(brief.loadTarget));
  const kcal = kcalFromLoadTarget(tss);
  const weekObjectives = brief.weekObjectives ?? [];
  const roleTag = `slot_role=${brief.sessionRole}`;
  const dayTag = `weekday=${weekdayLabel(brief.weekdayOffset)}`;
  if (brief.family === "strength" && input.gymModule) {
    const gymDay = input.gymModule;
    const adaptationTarget = deriveStrengthAdaptationForRole(
      gymDay,
      brief.sessionRole,
      brief.gymPrimaryGoal
    );
    const sessionMinutes2 = gymDurationMinutesForBrief(brief.sessionRole, brief.gymPrimaryGoal);
    const roleHint = brief.sessionRole === "quality" ? "Seduta qualit\xE0 \xB7 carico neuromuscolare / forza" : brief.sessionRole === "recovery" ? "Recupero attivo \xB7 volume ridotto" : "Seduta volume \xB7 ipertrofia / lavoro accessorio";
    return {
      adaptationTarget,
      domain: "gym",
      intensityHint: `${roleHint} \xB7 ${gymDay.methodology} \xB7 ${gymDay.districtObjective}`,
      objectiveDetail: `${formatGymDistrictsLabel(gymDay)} / ${gymDay.exerciseType} \xB7 ${roleTag} \xB7 ${dayTag}`,
      sessionMinutes: sessionMinutes2,
      tss,
      kcal
    };
  }
  if (brief.family === "technical" && input.technicalModule) {
    const technicalDay = input.technicalModule;
    const sessionMinutes2 = brief.sessionRole === "quality" ? 90 : brief.sessionRole === "recovery" ? 50 : 70;
    return {
      adaptationTarget: deriveTechnicalAdaptation(technicalDay, brief.sessionRole),
      domain: viryaDomainForSession("technical", brief.discipline),
      intensityHint: `${technicalDay.intensity} \xB7 ${technicalDay.methodology} \xB7 ${roleTag}`,
      objectiveDetail: `${technicalDay.objectives.join(" > ")} \xB7 ${dayTag}`,
      sessionMinutes: sessionMinutes2,
      tss,
      kcal
    };
  }
  if (brief.family === "lifestyle" && input.lifestyleModule) {
    const lifestyleDay = input.lifestyleModule;
    return {
      adaptationTarget: deriveLifestyleAdaptation(lifestyleDay),
      domain: "mind_body",
      intensityHint: `RPE ${lifestyleDay.intensityRpe} \xB7 ${lifestyleDay.breathingCadence}`,
      objectiveDetail: `${lifestyleDay.practiceType} \xB7 ${lifestyleDay.objective} \xB7 ${dayTag}`,
      sessionMinutes: 50,
      tss: Math.max(8, Math.round(tss * 0.85)),
      kcal: kcalFromLoadTarget(Math.max(8, Math.round(tss * 0.85)))
    };
  }
  const preset2 = resolveAerobicViryaPrescription({
    viryaPhase: brief.phase,
    goalSummary: brief.objective ?? "",
    weekObjectives,
    sessionIndexInWeek: brief.slotIndex,
    sessionsInWeek: brief.sessionsInWeek
  });
  const roleScale = aerobicRoleScale(brief.sessionRole);
  const scaledPrescription = {
    ...preset2,
    durationScale: preset2.durationScale * roleScale.durationScale,
    tssScale: preset2.tssScale * roleScale.tssScale,
    objectiveDetail: `${preset2.objectiveDetail} \xB7 ${roleTag} \xB7 ${dayTag}`
  };
  const baseMinutes = Math.max(28, Math.round(tss / 0.9 * 1.1));
  const sessionMinutes = Math.max(28, Math.round(baseMinutes * scaledPrescription.durationScale));
  const adjustedTss = Math.max(12, Math.round(tss * scaledPrescription.tssScale));
  return {
    adaptationTarget: scaledPrescription.adaptationTarget,
    domain: "endurance",
    intensityHint: scaledPrescription.intensityHint,
    objectiveDetail: [
      brief.objective ?? brief.methodology ?? "periodized endurance",
      scaledPrescription.objectiveDetail,
      scaledPrescription.archetypeLabelIt ? `model=${scaledPrescription.archetypeLabelIt}` : ""
    ].filter(Boolean).join(" \xB7 "),
    sessionMinutes,
    tss: adjustedTss,
    kcal: kcalFromLoadTarget(adjustedTss),
    aerobicPrescription: scaledPrescription
  };
}

// apps/web/lib/training/virya/materialize-virya-aerobic-from-catalog.ts
init_pro2_session_contract();
init_pro2_session_interpretation();

// apps/web/lib/training/library/scale-library-contract.ts
function clampScale(scale, opts) {
  const min = opts?.clampMin ?? 0.35;
  const max = opts?.clampMax ?? 1.05;
  return Math.max(min, Math.min(max, scale));
}
function scaleRounded(value, scale, minimum = 1) {
  if (!Number.isFinite(value) || value <= 0) return minimum;
  return Math.max(minimum, Math.round(value * scale));
}
function scaleChart(chart, scale, sessionLengthMode) {
  const lengthMode = chart.lengthMode ?? sessionLengthMode ?? "time";
  const scaledDistanceKm = lengthMode === "distance" && chart.distanceKm > 0 ? Math.max(0.1, Math.round(chart.distanceKm * scale * 100) / 100) : chart.distanceKm;
  return {
    ...chart,
    minutes: chart.minutes > 0 ? scaleRounded(chart.minutes, scale, 0) : 0,
    seconds: chart.seconds > 0 ? scaleRounded(chart.seconds, scale, 0) : 0,
    workSeconds: chart.workSeconds > 0 ? scaleRounded(chart.workSeconds, scale, 1) : 0,
    recoverSeconds: chart.recoverSeconds > 0 ? scaleRounded(chart.recoverSeconds, scale, 1) : 0,
    step1Seconds: chart.step1Seconds > 0 ? scaleRounded(chart.step1Seconds, scale, 1) : 0,
    step2Seconds: chart.step2Seconds > 0 ? scaleRounded(chart.step2Seconds, scale, 1) : 0,
    step3Seconds: chart.step3Seconds > 0 ? scaleRounded(chart.step3Seconds, scale, 1) : 0,
    pyramidStepSeconds: chart.pyramidStepSeconds > 0 ? scaleRounded(chart.pyramidStepSeconds, scale, 1) : 0,
    distanceKm: scaledDistanceKm
  };
}
function scaleLibraryContract(contract, loadScaleRaw, opts) {
  const loadScale = clampScale(loadScaleRaw, opts);
  if (loadScale >= 0.999 && loadScale <= 1.001) {
    return contract;
  }
  const blocks = (contract.blocks ?? []).map((block) => {
    const chart = block.chart ? scaleChart(block.chart, loadScale, contract.renderProfile?.lengthMode) : block.chart;
    return {
      ...block,
      durationMinutes: scaleRounded(Number(block.durationMinutes ?? 0) || 10, loadScale, 1),
      chart
    };
  });
  const summary = contract.summary ? {
    ...contract.summary,
    durationSec: scaleRounded(contract.summary.durationSec ?? 3600, loadScale, 60),
    tss: scaleRounded(contract.summary.tss ?? 0, loadScale, 0),
    kcal: contract.summary.kcal != null && contract.summary.kcal > 0 ? scaleRounded(contract.summary.kcal, loadScale, 0) : contract.summary.kcal,
    kj: contract.summary.kj != null && contract.summary.kj > 0 ? scaleRounded(contract.summary.kj, loadScale, 0) : contract.summary.kj
  } : contract.summary;
  const plannedSessionDurationMinutes = contract.plannedSessionDurationMinutes != null && contract.plannedSessionDurationMinutes > 0 ? scaleRounded(contract.plannedSessionDurationMinutes, loadScale, 1) : summary?.durationSec != null ? Math.max(1, Math.round(summary.durationSec / 60)) : contract.plannedSessionDurationMinutes;
  return {
    ...contract,
    blocks,
    summary,
    plannedSessionDurationMinutes
  };
}

// apps/web/lib/training/virya/virya-catalog-discipline.ts
var VIRYA_TO_CATALOG = {
  ciclismo: "Cycling",
  cycling: "Cycling",
  mtb: "Cycling",
  gravel: "Cycling",
  triathlon: "Cycling",
  bici: "Cycling",
  running: "Running",
  corsa: "Running",
  trail: "Trail Running",
  "trail running": "Trail Running",
  skyrunning: "Trail Running",
  "xc ski": "XC Ski",
  xcski: "XC Ski",
  "sci di fondo": "XC Ski",
  "sci fondo": "XC Ski",
  nordic: "XC Ski",
  "sci nordico": "XC Ski",
  nuoto: "Swimming",
  swimming: "Swimming",
  swim: "Swimming",
  canoa: "Canoe",
  canoe: "Canoe",
  kayak: "Canoe",
  alpinismo: "Trail Running"
};
function viryaDisciplineToCatalogDiscipline(discipline) {
  const key = discipline.trim().toLowerCase();
  return VIRYA_TO_CATALOG[key] ?? "Cycling";
}
function catalogDisciplineSlug(catalogDiscipline) {
  switch (catalogDiscipline) {
    case "Running":
      return "run";
    case "Swimming":
      return "swm";
    case "Canoe":
      return "can";
    case "XC Ski":
      return "xcs";
    case "Trail Running":
      return "trl";
    default:
      return "cyc";
  }
}

// apps/web/lib/training/virya/virya-catalog-preset-resolver.ts
var VIRYA_ARCHETYPE_CATALOG_MATCH = {
  base_z2_volume: {
    presetIds: [
      "endurance_z2_75",
      "endurance_90_z2",
      "xcs_endurance_z2_90",
      "trl_endurance_z2_90",
      "cyc_z2_surges_8x1",
      "cyc_gran_fondo_sim",
      "long_z2_105"
    ],
    tagsAny: ["endurance", "z2", "long", "gran_fondo", "embedded", "xc_ski", "trail"]
  },
  base_z3_sweet: {
    presetIds: ["sweet_spot_2x20", "sweet_spot_3x12", "cyc_sweetspot_tier_3x15", "tempo_z3_2x12", "tempo_2x15_z3", "w4_sweet_2x18"],
    tagsAny: ["sweet_spot", "tempo", "z3", "cruise"]
  },
  base_torque_z3_neuro: {
    presetIds: ["force_4x8", "cyc_climb_force_5x6", "over_under_norwegian", "cyc_over_under_i3", "climbing_blocks"],
    tagsAny: ["force", "over_under", "climbing"]
  },
  base_threshold_intro: {
    presetIds: ["norwegian_5x3_z4", "threshold_3x12", "lactate_6x5_z4", "cyc_ramp_lt2_25"],
    tagsAny: ["norwegian", "threshold", "lactate", "ramp"]
  },
  build_z3_glycolytic_long: {
    presetIds: ["tempo_2x15_z3", "cyc_cruise_3x12", "z2_z3_progressive_90", "sweet_spot_3x12"],
    tagsAny: ["tempo", "cruise", "z3", "progressive"]
  },
  build_norwegian_z4: {
    presetIds: [
      "cyc_norwegian_tier_4x4",
      "cyc_norwegian_5x5_z4",
      "norwegian_2x4x4",
      "cyc_4x8_ftp",
      "cyc_tte_2x16",
      "cyc_lactate_2x20_deep",
      "w4_threshold_5x4",
      "cyc_w4_ftp_blocks_2x20"
    ],
    tagsAny: ["norwegian", "z4", "lactate", "ftp", "tte", "ladder"]
  },
  build_vo2_interval: {
    presetIds: [
      "cyc_vo2_tiered_5x5",
      "cyc_threshold_vo2_combo",
      "cyc_vo2_40_20_x10",
      "cyc_crit_sim",
      "vo2_5x5",
      "vo2_4x4",
      "interval_30_30_x20",
      "w4_vo2_double_tier",
      "cyc_w4_vo3max_6x3",
      "w4_micro_30_30_24"
    ],
    tagsAny: ["vo2", "intervals", "tier", "crit", "40-20", "30-30"]
  },
  build_lactate_z6_dense: {
    presetIds: [
      "cyc_billat_progression",
      "cyc_micro_bursts_20x30",
      "hit_tabata",
      "hit_40_20_x8",
      "anaerobic_8x45"
    ],
    tagsAny: ["hit", "billat", "anaerobic", "tabata", "micro"]
  },
  refine_polarized_z2: {
    presetIds: ["polarized_90", "cyc_polarized_split", "polarized_120", "w4_polarized_insert"],
    tagsAny: ["polarized"]
  },
  refine_vo2_z5: {
    presetIds: ["cyc_vo2_tiered_5x5", "vo2_5x5", "vo2_4x4", "interval_30_30_x20"],
    tagsAny: ["vo2"]
  },
  refine_sprint_z6_z7: {
    presetIds: ["sprint_6x30", "sprint_10x15", "neuromuscular_sprints", "cyc_sprint_leadout"],
    tagsAny: ["sprint", "neuromuscular"]
  },
  refine_lactate_max: {
    presetIds: ["cyc_descending_5_4_3_2_1", "lactate_2x15_z4", "cyc_mixed_quality_day"],
    tagsAny: ["lactate", "descending", "mixed"]
  },
  peak_openers_z2: {
    presetIds: ["race_openers_60", "cyc_ramp_openers", "endurance_pickups"],
    tagsAny: ["openers", "race", "ramp"]
  },
  peak_vo2_z6: {
    presetIds: ["vo2_4x4", "cyc_vo2_tiered_5x5", "vo2_5x3", "interval_20_40_x12"],
    tagsAny: ["vo2"]
  },
  peak_sprint_touch: {
    presetIds: ["sprint_6x30", "neuromuscular_sprints", "cyc_sprint_leadout"],
    tagsAny: ["sprint"]
  },
  peak_lactate_race_pace: {
    presetIds: ["tt_2x20", "tt_40k_sim", "run_marathon_pace", "threshold_2x20_ftp"],
    tagsAny: ["time_trial", "marathon", "threshold", "tt"]
  },
  deload_spin_z1_z2: {
    presetIds: ["recovery_45_z1", "xcs_deload_z1", "trl_deload_z1_z2", "active_recovery_30"],
    tagsAny: ["recovery", "deload"]
  },
  deload_endurance_flush: {
    presetIds: ["recovery_60_z1", "endurance_z2_75", "active_recovery_30"],
    tagsAny: ["recovery", "endurance"]
  },
  deload_connective: {
    presetIds: ["recovery_45_z1", "active_recovery_30"],
    tagsAny: ["recovery"]
  },
  deload_active_rest: {
    presetIds: ["active_recovery_30", "recovery_45_z1"],
    tagsAny: ["recovery", "micro"]
  },
  goal_override_recovery: {
    presetIds: ["recovery_45_z1", "recovery_60_z1", "active_recovery_30"],
    tagsAny: ["recovery"]
  },
  goal_override_vo2: {
    presetIds: ["cyc_vo2_tiered_5x5", "vo2_5x5", "vo2_4x4"],
    tagsAny: ["vo2"]
  },
  goal_override_threshold: {
    presetIds: ["norwegian_2x4x4", "cyc_norwegian_tier_4x4", "threshold_2x20_ftp"],
    tagsAny: ["norwegian", "threshold"]
  }
};
function expandPresetIdCandidates(baseId, catalogDiscipline) {
  const slug = catalogDisciplineSlug(catalogDiscipline);
  const ids = /* @__PURE__ */ new Set([baseId, `${slug}_${baseId}`]);
  if (baseId.startsWith(`${slug}_`)) ids.add(baseId.slice(slug.length + 1));
  return [...ids];
}
function presetMatchesDiscipline(preset2, catalogDiscipline) {
  return preset2.discipline === catalogDiscipline;
}
function scorePreset(preset2, rule, catalogDiscipline) {
  if (!presetMatchesDiscipline(preset2, catalogDiscipline)) return -1;
  let score = 0;
  const tags = new Set(preset2.tags.map((t) => t.toLowerCase()));
  if (rule.excludeTags?.some((t) => tags.has(t.toLowerCase()))) return -1;
  if (rule.presetIds?.length) {
    const wanted = /* @__PURE__ */ new Set();
    for (const id of rule.presetIds) {
      for (const candidate of expandPresetIdCandidates(id, catalogDiscipline)) {
        wanted.add(candidate);
      }
    }
    if (wanted.has(preset2.presetId)) score += 100;
  }
  if (rule.tagsAll?.length) {
    if (!rule.tagsAll.every((t) => tags.has(t.toLowerCase()))) return -1;
    score += rule.tagsAll.length * 8;
  }
  if (rule.tagsAny?.length) {
    const hits = rule.tagsAny.filter((t) => tags.has(t.toLowerCase())).length;
    if (hits === 0 && !(rule.presetIds?.length && score >= 100)) return -1;
    score += hits * 12;
  }
  return score;
}
function presetsByCatalogDiscipline(catalogDiscipline, presets = AEROBIC_STARTER_PRESETS) {
  return presets.filter((p) => presetMatchesDiscipline(p, catalogDiscipline));
}
function resolveViryaCatalogPreset(input, presets = AEROBIC_STARTER_PRESETS, rules = VIRYA_ARCHETYPE_CATALOG_MATCH) {
  const catalogDiscipline = viryaDisciplineToCatalogDiscipline(input.discipline);
  const rule = rules[input.archetypeId] ?? rules.base_z2_volume ?? VIRYA_ARCHETYPE_CATALOG_MATCH.base_z2_volume;
  const pool = presetsByCatalogDiscipline(catalogDiscipline, presets);
  if (!pool.length) return null;
  const ranked = pool.map((preset2) => ({ preset: preset2, score: scorePreset(preset2, rule, catalogDiscipline) })).filter((row) => row.score >= 0).sort((a, b) => b.score - a.score || a.preset.presetId.localeCompare(b.preset.presetId));
  if (!ranked.length) {
    const fallback = pool[input.sessionIndexInWeek % pool.length];
    return fallback ?? null;
  }
  const topScore = ranked[0].score;
  const topTier = ranked.filter((r) => r.score >= topScore - 5);
  const pick = topTier[input.sessionIndexInWeek % topTier.length];
  return pick?.preset ?? ranked[0].preset;
}

// apps/web/lib/training/virya/materialize-virya-aerobic-from-catalog.ts
init_planned_session_metrics();
function computeViryaSlotLoadScale(contract, targetMinutes, targetTss) {
  const baseMinutes = contract.plannedSessionDurationMinutes ?? (contract.summary?.durationSec ? Math.max(1, Math.round(contract.summary.durationSec / 60)) : 60);
  const baseTss = Math.max(12, contract.summary?.tss ?? 50);
  const durScale = targetMinutes / Math.max(15, baseMinutes);
  const tssScale = targetTss / baseTss;
  return durScale * 0.72 + tssScale * 0.28;
}
function scaleCatalogContractForViryaSlot(contract, targetMinutes, targetTss, targetKcal) {
  const loadScaleRaw = computeViryaSlotLoadScale(contract, targetMinutes, targetTss);
  const scaled = scaleLibraryContract(contract, loadScaleRaw, { clampMin: 0.5, clampMax: 1.55 });
  const durationSec = Math.max(60, targetMinutes * 60);
  const draft = {
    ...scaled,
    plannedSessionDurationMinutes: targetMinutes,
    summary: scaled.summary ? {
      ...scaled.summary,
      durationSec,
      tss: targetTss,
      kcal: targetKcal,
      kj: scaled.summary.kj,
      avgPowerW: scaled.summary.avgPowerW > 0 ? Math.max(80, Math.round(targetTss * 1e3 / Math.max(durationSec / 3600, 0.25) / 36)) : scaled.summary.avgPowerW
    } : scaled.summary
  };
  const metrics = resolvePlannedSessionMetrics({
    contract: draft,
    durationMinutesDb: targetMinutes,
    tssTargetDb: targetTss,
    kcalTargetDb: targetKcal,
    athleteFtpWatts: draft.renderProfile?.ftpW
  });
  return {
    ...draft,
    summary: draft.summary ? {
      ...draft.summary,
      durationSec,
      tss: metrics.tss > 0 ? metrics.tss : targetTss,
      kcal: metrics.kcal > 0 ? metrics.kcal : targetKcal,
      kj: metrics.kj > 0 ? metrics.kj : draft.summary.kj,
      avgPowerW: metrics.avgPowerW ?? draft.summary.avgPowerW
    } : draft.summary
  };
}

// apps/web/lib/training/virya/virya-load-normalize.ts
function rolesElasticAt(index, total) {
  return index % 2 === 1 || index === total - 1;
}
function normalizeWeeklyLoad(loads, targetBudget) {
  const target = Math.max(0, Math.round(targetBudget));
  if (!loads.length) return [];
  if (target <= 0) return loads.map(() => 0);
  let out = [...loads];
  let sum = out.reduce((a, b) => a + b, 0);
  if (sum === 0) {
    const each = Math.max(1, Math.round(target / out.length));
    out = out.map(() => each);
    sum = out.reduce((a, b) => a + b, 0);
  }
  const tolerance = Math.max(3, Math.round(target * 0.03));
  let guard = 0;
  while (Math.abs(sum - target) > tolerance && guard < 48) {
    guard += 1;
    const delta = target - sum;
    const elasticIdx = [];
    for (let i = 0; i < out.length; i += 1) {
      if (rolesElasticAt(i, out.length)) elasticIdx.push(i);
    }
    const idx = elasticIdx.length > 0 ? elasticIdx[guard % elasticIdx.length] : guard % out.length;
    const next = out[idx] + (delta > 0 ? 1 : -1);
    if (next < 1) continue;
    out[idx] = next;
    sum = out.reduce((a, b) => a + b, 0);
  }
  return out;
}

// apps/web/lib/training/l2/materialize-week-builder-engine.ts
var PRO2_BUILDER_PLAN_NOTES_PREFIX = "[PRO2_BUILDER_PLAN]";
var PRO2_BUILDER_PLAN_TYPE_BY_FAMILY = {
  aerobic: "pro2_builder_aerobic",
  strength: "pro2_builder_strength"
};
function addDaysIsoUtc(iso, days) {
  const d = /* @__PURE__ */ new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}
function clampInt(v, min, max) {
  return Math.max(min, Math.min(max, Math.round(v)));
}
function patternIdForCount(n) {
  if (n <= 3) return "3d";
  if (n === 4) return "4d";
  if (n === 5) return "5d";
  return "6d";
}
var TARGET_TO_WEEK_OBJECTIVE_CHIP = (() => {
  const out = {};
  for (const [chip, target] of Object.entries(WEEK_OBJECTIVE_KEY_TO_TARGET)) {
    out[target] = chip;
  }
  return out;
})();
function weekObjectiveChipsFromStimulus(stimulus) {
  const targets = [stimulus.primary, stimulus.secondary, ...stimulus.maintenance].filter(
    (t) => Boolean(t)
  );
  const chips = [];
  for (const target of targets) {
    const chip = TARGET_TO_WEEK_OBJECTIVE_CHIP[target];
    if (chip && !chips.includes(chip)) chips.push(chip);
  }
  return chips;
}
function sanitizeAvailableDays(days) {
  return [...new Set(days.map((d) => Math.round(d)).filter((d) => d >= 0 && d <= 6))].sort(
    (a, b) => a - b
  );
}
function pickTrainingDays(availableDays, n, config) {
  const pattern = config.weekdayPatterns[patternIdForCount(n)] ?? [];
  if (!availableDays.length) {
    const out = [...new Set(pattern)].slice(0, n);
    for (let d = 0; d <= 6 && out.length < n; d += 1) {
      if (!out.includes(d)) out.push(d);
    }
    return out.sort((a, b) => a - b);
  }
  if (availableDays.length <= n) return [...availableDays];
  const chosen = availableDays.filter((d) => pattern.includes(d)).slice(0, n);
  const remaining = availableDays.filter((d) => !chosen.includes(d));
  while (chosen.length < n && remaining.length) {
    let bestIdx = 0;
    let bestScore = -1;
    for (let i = 0; i < remaining.length; i += 1) {
      const d = remaining[i];
      const score = chosen.length ? Math.min(...chosen.map((c) => Math.abs(c - d))) : 7;
      if (score > bestScore) {
        bestScore = score;
        bestIdx = i;
      }
    }
    chosen.push(remaining.splice(bestIdx, 1)[0]);
  }
  return chosen.sort((a, b) => a - b);
}
function isSessionRole(v) {
  return v === "quality" || v === "volume" || v === "recovery";
}
function rolesForWeek(n, phase, config) {
  const fromDb = (config.roleSequences[n] ?? []).filter(isSessionRole);
  const roles = fromDb.length >= n ? fromDb.slice(0, n) : Array.from({ length: n }, (_, i) => i % 2 === 0 ? "quality" : "volume");
  if (phase === "deload") {
    return roles.map((_, i) => i % 2 === 1 ? "recovery" : "volume");
  }
  return roles;
}
function spreadQualityRoles(days, roles) {
  const out = [...roles];
  for (let i = 1; i < out.length; i += 1) {
    if (out[i] !== "quality" || out[i - 1] !== "quality") continue;
    if ((days[i] ?? 0) - (days[i - 1] ?? 0) !== 1) continue;
    for (let j = i + 1; j < out.length; j += 1) {
      if (out[j] !== "quality") {
        const tmp = out[i];
        out[i] = out[j];
        out[j] = tmp;
        break;
      }
    }
  }
  return out;
}
function hasAdjacentQuality(days, roles) {
  for (let i = 1; i < roles.length; i += 1) {
    if (roles[i] === "quality" && roles[i - 1] === "quality" && days[i] - days[i - 1] === 1) {
      return true;
    }
  }
  return false;
}
function distributeLoadFromConfig(roles, phase, budget, config) {
  if (!roles.length) return [];
  const weights = roles.map((role) => {
    const w = config.roleWeights[`${role}|${phase}`];
    return Number.isFinite(w) && w > 0 ? w : 1;
  });
  const sumW = weights.reduce((a, b) => a + b, 0) || 1;
  const raw = weights.map((w) => Math.max(0, budget) * w / sumW);
  return normalizeWeeklyLoad(raw.map((x) => Math.max(1, Math.round(x))), budget);
}
function moveLongSessionToWeekend(days, roles, loads) {
  const weekendIdx = days.map((d, i) => d >= 5 ? i : -1).filter((i) => i >= 0);
  if (!weekendIdx.length) return { roles, loads };
  let longIdx = -1;
  for (let i = 0; i < roles.length; i += 1) {
    if (roles[i] !== "volume") continue;
    if (longIdx === -1 || (loads[i] ?? 0) >= (loads[longIdx] ?? 0)) longIdx = i;
  }
  if (longIdx === -1 || weekendIdx.includes(longIdx)) return { roles, loads };
  const target = weekendIdx[weekendIdx.length - 1];
  const nextRoles = [...roles];
  const nextLoads = [...loads];
  [nextRoles[longIdx], nextRoles[target]] = [nextRoles[target], nextRoles[longIdx]];
  [nextLoads[longIdx], nextLoads[target]] = [nextLoads[target], nextLoads[longIdx]];
  if (hasAdjacentQuality(days, nextRoles)) return { roles, loads };
  return { roles: nextRoles, loads: nextLoads };
}
var STRENGTH_LIKE_TARGETS = /* @__PURE__ */ new Set([
  "max_strength",
  "hypertrophy_mixed",
  "hypertrophy_myofibrillar",
  "hypertrophy_sarcoplasmic",
  "power_output",
  "neuromuscular_adaptation"
]);
function assignFamilies(slots, familyMix, stimulus) {
  const n = slots.length;
  const gymPct = clampInt(Number(familyMix.gymPct) || 0, 0, 100);
  const gymCount = clampInt(n * gymPct / 100, 0, n);
  const families = Array.from({ length: n }, () => "aerobic");
  if (gymCount <= 0) return families;
  const primaryIsStrength = STRENGTH_LIKE_TARGETS.has(stimulus.primary);
  if (primaryIsStrength) {
    const order = [
      ...slots.map((s, i) => s.role === "quality" ? i : -1).filter((i) => i >= 0),
      ...slots.map((s, i) => s.role !== "quality" ? i : -1).filter((i) => i >= 0)
    ];
    for (const idx of order.slice(0, gymCount)) families[idx] = "strength";
  } else {
    for (let k = 0; k < gymCount; k += 1) families[n - 1 - k] = "strength";
  }
  return families;
}
function planBuilderWeekSlots(args) {
  const { week, config } = args;
  const errors = [];
  const requested = clampInt(Number(week.sessionsTarget) || 1, 1, 7);
  const available = sanitizeAvailableDays(week.availableDays);
  const n = available.length ? Math.min(requested, available.length) : requested;
  const days = pickTrainingDays(available, n, config);
  let roles = spreadQualityRoles(days, rolesForWeek(days.length, week.phase, config));
  let loads = distributeLoadFromConfig(roles, week.phase, Math.max(0, Math.round(week.loadTarget)), config);
  ({ roles, loads } = moveLongSessionToWeekend(days, roles, loads));
  const families = assignFamilies(roles.map((role) => ({ role })), week.familyMix, week.stimulus);
  const seenDays = /* @__PURE__ */ new Set();
  const slots = [];
  days.forEach((dayOffset, i) => {
    const date = addDaysIsoUtc(week.weekStart, dayOffset);
    if (seenDays.has(dayOffset)) {
      errors.push({ date, dayOffset, error: "duplicate_day_slot" });
      return;
    }
    seenDays.add(dayOffset);
    slots.push({
      slotSeq: slots.length,
      dayOffset,
      date,
      role: roles[i] ?? "volume",
      family: families[i] ?? "aerobic",
      loadTarget: loads[i] ?? Math.max(1, Math.round(week.loadTarget / Math.max(1, days.length)))
    });
  });
  return { slots, errors };
}
function capMinutes(minutes, maxSessionMinutes) {
  const m = Math.max(20, Math.round(minutes));
  if (maxSessionMinutes != null && maxSessionMinutes >= 20) return Math.min(m, maxSessionMinutes);
  return m;
}
function resolveCatalogDiscipline(discipline, config) {
  const fromDb = config.disciplineMap?.[discipline.trim().toLowerCase()];
  return fromDb ?? viryaDisciplineToCatalogDiscipline(discipline);
}
function buildRowFromContract(args) {
  const { input, slot, family, contract } = args;
  const metaLine = `${PRO2_BUILDER_PLAN_NOTES_PREFIX}${JSON.stringify({
    v: 1,
    family,
    discipline: contract.discipline,
    sessionName: contract.sessionName,
    planId: input.planId,
    weekStart: input.week.weekStart,
    slotSeq: slot.slotSeq
  })}`;
  const guarded = buildPlannedNotesWithSizeGuard({ metaLine, contract });
  if (!guarded.ok) return { ok: false, error: "contract_too_large" };
  const kj = contract.summary?.kj;
  return {
    ok: true,
    row: {
      athlete_id: input.athleteId,
      date: slot.date,
      type: PRO2_BUILDER_PLAN_TYPE_BY_FAMILY[family],
      duration_minutes: contract.plannedSessionDurationMinutes ?? args.fallbackMinutes,
      tss_target: Math.max(0, Math.round(contract.summary?.tss ?? slot.loadTarget)),
      kcal_target: contract.summary?.kcal != null && Number.isFinite(contract.summary.kcal) ? Math.round(contract.summary.kcal) : null,
      kj_target: kj != null && Number.isFinite(kj) && kj > 0 ? Math.round(kj) : null,
      plan_id: input.planId,
      notes: guarded.notes
    }
  };
}
function deriveAerobicInstructionsForSlot(args) {
  const { input, slot, sessionsInWeek, chips } = args;
  const avoid = new Set(input.week.stimulus.avoid);
  let first = null;
  for (const weekObjectives of [chips, []]) {
    for (let attempt = 0; attempt <= sessionsInWeek + 1; attempt += 1) {
      const brief = {
        version: 1,
        weekStart: input.week.weekStart,
        weekdayOffset: slot.dayOffset,
        slotIndex: slot.slotSeq + attempt,
        sessionsInWeek,
        weeklyBudgetLoad: Math.max(0, Math.round(input.week.loadTarget)),
        loadTarget: slot.loadTarget,
        sessionRole: slot.role,
        phase: input.week.phase,
        family: "aerobic",
        discipline: input.discipline,
        planName: "",
        phaseLabel: input.week.phase,
        sessionName: "",
        weekObjectives,
        weekdayPatternId: patternIdForCount(sessionsInWeek)
      };
      const derived = deriveViryaBuilderInstructions({ brief });
      first ??= derived;
      if (!avoid.has(derived.adaptationTarget)) return derived;
    }
  }
  return first;
}
function materializeAerobicSlot(input, slot, sessionsInWeek, chips, weekScale) {
  const derived = deriveAerobicInstructionsForSlot({ input, slot, sessionsInWeek, chips });
  const ftpW = input.profile.renderProfile.ftpW;
  const scaledMinutes = Math.max(10, Math.round(derived.sessionMinutes * weekScale));
  const minutes = capMinutes(scaledMinutes, input.profile.maxSessionMinutes);
  const tss = minutes !== derived.sessionMinutes ? Math.max(10, Math.round(derived.tss * (minutes / Math.max(1, derived.sessionMinutes)))) : derived.tss;
  const kcal = kcalFromLoadTarget(tss, minutes, ftpW);
  const catalogDiscipline = resolveCatalogDiscipline(input.discipline, input.config);
  const archetypeId = derived.aerobicPrescription?.archetypeId ?? "base_z2_volume";
  const preset2 = resolveViryaCatalogPreset(
    { archetypeId, discipline: catalogDiscipline, sessionIndexInWeek: slot.slotSeq },
    input.catalogs.aerobicPresets,
    input.config.archetypeRules ?? void 0
  );
  if (!preset2) return { ok: false, error: "aerobic_preset_not_found" };
  const sessionName = preset2.title;
  let contract = buildStarterContractFromPreset({
    ...preset2,
    title: sessionName,
    discipline: catalogDiscipline,
    phase: input.week.phase
  });
  contract = {
    ...contract,
    renderProfile: {
      ...contract.renderProfile ?? DEFAULT_STARTER_RENDER,
      ftpW,
      hrMax: input.profile.renderProfile.hrMax
    }
  };
  contract = scaleCatalogContractForViryaSlot(contract, minutes, tss, kcal);
  const scheduledTime = input.profile.preferredTimeByOffset[slot.dayOffset];
  const structureMeta = [
    `l2=plan:${input.planId};week:${input.week.weekStart};slot:${slot.slotSeq};role:${slot.role}`,
    `catalogPreset=${preset2.presetId}`,
    `archetype=${archetypeId}`,
    "origin=l2_builder"
  ].join(" \xB7 ");
  contract = {
    ...contract,
    sessionName,
    phase: input.week.phase,
    discipline: catalogDiscipline,
    adaptationTarget: derived.adaptationTarget,
    ...scheduledTime ? { scheduledTime } : {},
    blocks: (contract.blocks ?? []).map(
      (b, i) => i === 0 ? { ...b, notes: [structureMeta, b.notes].filter(Boolean).join(" | ") } : b
    )
  };
  return buildRowFromContract({ input, slot, family: "aerobic", contract, fallbackMinutes: minutes });
}
var GYM_ADAPTATION_LABEL_IT = {
  max_strength: "Forza massima",
  hypertrophy_mixed: "Ipertrofia",
  hypertrophy_sarcoplasmic: "Ipertrofia \xB7 volume",
  hypertrophy_myofibrillar: "Ipertrofia \xB7 densit\xE0",
  power_output: "Potenza",
  neuromuscular_adaptation: "Neuromuscolare",
  mobility_capacity: "Mobilit\xE0",
  movement_quality: "Qualit\xE0 del movimento",
  recovery: "Recupero attivo",
  lactate_clearance: "Resistenza muscolare"
};
function gymAdaptationForSlot(stimulus, role) {
  const avoid = new Set(stimulus.avoid);
  const declared = [stimulus.primary, stimulus.secondary, ...stimulus.maintenance].filter(
    (t) => Boolean(t)
  );
  for (const target of declared) {
    if (STRENGTH_LIKE_TARGETS.has(target) && !avoid.has(target)) {
      return target;
    }
  }
  const defaults = role === "quality" ? ["max_strength", "power_output", "hypertrophy_mixed"] : role === "recovery" ? ["mobility_capacity", "movement_quality", "recovery"] : ["hypertrophy_mixed", "movement_quality", "max_strength"];
  for (const target of defaults) {
    if (!avoid.has(target)) return target;
  }
  return defaults[0];
}
function materializeGymSlot(input, slot, weekScale) {
  const adaptation = gymAdaptationForSlot(input.week.stimulus, slot.role);
  const minutes = capMinutes(
    Math.max(10, Math.round(gymDurationMinutesForBrief(slot.role, void 0) * weekScale)),
    input.profile.maxSessionMinutes
  );
  const tss = Math.max(1, Math.round(slot.loadTarget));
  const kcal = kcalFromLoadTarget(tss, minutes, input.profile.renderProfile.ftpW);
  const sportTag = disciplineToBlock1SportTag(input.discipline);
  const pickedRows = buildPro2GymRowsCatalogOnly({
    catalogRows: input.catalogs.gymCatalogRows,
    sportTag,
    adaptation,
    executionStyle: "Lento controllato"
  });
  if (!pickedRows.length) return { ok: false, error: "gym_catalog_empty" };
  const rows = pickedRows.map((row, i) => ({ ...row, id: `l2-gym-${slot.slotSeq}-${i + 1}` }));
  const scheduledTime = input.profile.preferredTimeByOffset[slot.dayOffset];
  const sessionName = `Palestra \xB7 ${GYM_ADAPTATION_LABEL_IT[adaptation] ?? adaptation}`;
  const scheda = buildPro2GymSchedaSessionContract({
    rows,
    renderProfile: input.profile.renderProfile,
    discipline: input.discipline.trim() || "Gym",
    sessionName,
    adaptationTarget: adaptation,
    phase: input.week.phase,
    plannedSessionDurationMinutes: minutes,
    scheduledTime
  });
  const contract = {
    ...scheda,
    summary: {
      ...scheda.summary,
      tss,
      kcal: Math.max(0, Math.round(kcal)),
      kj: Math.max(0, Math.round(kcal * 4.184))
    }
  };
  return buildRowFromContract({ input, slot, family: "strength", contract, fallbackMinutes: minutes });
}
function computeWeekHoursScale(input, slots, chips) {
  const hours = input.week.hoursTarget;
  if (hours == null || !Number.isFinite(hours) || hours <= 0 || slots.length === 0) return 1;
  let naturalTotal = 0;
  for (const slot of slots) {
    naturalTotal += slot.family === "strength" ? gymDurationMinutesForBrief(slot.role, void 0) : deriveAerobicInstructionsForSlot({ input, slot, sessionsInWeek: slots.length, chips }).sessionMinutes;
  }
  if (naturalTotal <= 0) return 1;
  return Math.min(1.6, Math.max(0.5, hours * 60 / naturalTotal));
}
function materializeWeekWithBuilderEngine(input) {
  const { slots, errors } = planBuilderWeekSlots({ week: input.week, config: input.config });
  const chips = weekObjectiveChipsFromStimulus(input.week.stimulus);
  const weekScale = computeWeekHoursScale(input, slots, chips);
  const rows = [];
  for (const slot of slots) {
    const outcome = slot.family === "strength" ? materializeGymSlot(input, slot, weekScale) : materializeAerobicSlot(input, slot, slots.length, chips, weekScale);
    if (outcome.ok) {
      rows.push(outcome.row);
    } else {
      errors.push({ date: slot.date, dayOffset: slot.dayOffset, error: outcome.error });
    }
  }
  return { rows, slots, errors };
}

// apps/web/lib/training/l2/resolve-training-l2-engine.ts
function resolveTrainingL2Engine(athleteId, env = process.env) {
  const globalFlag = (env.TRAINING_L2_ENGINE ?? "").trim().toLowerCase();
  if (globalFlag === "builder") return "builder";
  const allowlist = (env.TRAINING_L2_BUILDER_ATHLETES ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  if (allowlist.includes(athleteId.trim().toLowerCase())) return "builder";
  return "db";
}

// apps/web/lib/training/l2/virya-db-config.ts
function asIntArray(value) {
  if (!Array.isArray(value)) return [];
  return value.map((v) => Math.round(Number(v))).filter((n) => Number.isFinite(n) && n >= 0 && n <= 6);
}
function asStringArray(value) {
  if (!Array.isArray(value)) return [];
  return value.map((v) => String(v ?? "").trim()).filter(Boolean);
}
async function loadViryaConfigFromDb(client) {
  const [patternRes, sequenceRes, weightRes, archetypeRes, disciplineRes] = await Promise.all([
    client.from("virya_weekday_pattern").select("pattern_id, offsets"),
    client.from("virya_role_sequence").select("session_count, roles"),
    client.from("virya_role_weight").select("role, phase, weight"),
    client.from("virya_archetype_catalog_match").select("archetype_id, preset_ids, tags_any"),
    client.from("virya_discipline_map").select("virya_label, catalog_discipline")
  ]);
  if (patternRes.error) throw new Error(`virya_weekday_pattern: ${patternRes.error.message}`);
  if (sequenceRes.error) throw new Error(`virya_role_sequence: ${sequenceRes.error.message}`);
  if (weightRes.error) throw new Error(`virya_role_weight: ${weightRes.error.message}`);
  const weekdayPatterns = {};
  for (const row of patternRes.data ?? []) {
    const id = String(row.pattern_id ?? "").trim();
    const offsets = asIntArray(row.offsets);
    if (id && offsets.length) weekdayPatterns[id] = offsets;
  }
  const roleSequences = {};
  for (const row of sequenceRes.data ?? []) {
    const count = Math.round(Number(row.session_count));
    const roles = asStringArray(row.roles);
    if (Number.isFinite(count) && count >= 1 && roles.length) roleSequences[count] = roles;
  }
  const roleWeights = {};
  for (const row of weightRes.data ?? []) {
    const role = String(row.role ?? "").trim();
    const phase = String(row.phase ?? "").trim();
    const weight = Number(row.weight);
    if (role && phase && Number.isFinite(weight) && weight > 0) {
      roleWeights[`${role}|${phase}`] = weight;
    }
  }
  if (!Object.keys(weekdayPatterns).length) throw new Error("virya_weekday_pattern vuota: config L2 assente");
  if (!Object.keys(roleSequences).length) throw new Error("virya_role_sequence vuota: config L2 assente");
  if (!Object.keys(roleWeights).length) throw new Error("virya_role_weight vuota: config L2 assente");
  let archetypeRules = null;
  if (!archetypeRes.error) {
    const rules = {};
    for (const row of archetypeRes.data ?? []) {
      const id = String(row.archetype_id ?? "").trim();
      if (!id) continue;
      rules[id] = {
        presetIds: asStringArray(row.preset_ids),
        tagsAny: asStringArray(row.tags_any)
      };
    }
    if (Object.keys(rules).length) archetypeRules = rules;
  }
  let disciplineMap = null;
  if (!disciplineRes.error) {
    const map = {};
    for (const row of disciplineRes.data ?? []) {
      const label = String(row.virya_label ?? "").trim().toLowerCase();
      const catalog = String(row.catalog_discipline ?? "").trim();
      if (label && catalog) map[label] = catalog;
    }
    if (Object.keys(map).length) disciplineMap = map;
  }
  return { weekdayPatterns, roleSequences, roleWeights, archetypeRules, disciplineMap };
}

// apps/web/lib/training/propose-training-macro.ts
function isoUTC(d) {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}
function addDaysIso(iso, days) {
  const d = /* @__PURE__ */ new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return isoUTC(d);
}

// apps/web/lib/training/materialize-training-macro.ts
function selectWeekStartsToMaterialize(allWeekStarts, mode, todayIso) {
  const sorted = [...new Set(allWeekStarts.map((s) => s.slice(0, 10)))].sort();
  if (mode.mode === "all") return { selected: sorted, skipped: [] };
  if (mode.mode === "explicit") {
    const wanted = new Set(mode.weekStarts.map((s) => s.slice(0, 10)));
    const selected2 = sorted.filter((s) => wanted.has(s));
    return { selected: selected2, skipped: sorted.filter((s) => !wanted.has(s)) };
  }
  const minFuture = Math.max(1, Math.round(mode.minFutureWeeks ?? 3));
  const horizon = addDaysIso(todayIso.slice(0, 10), minFuture * 7);
  const selected = sorted.filter(
    (s) => addDaysIso(s, 6) >= todayIso.slice(0, 10) && s <= horizon
  );
  return { selected, skipped: sorted.filter((s) => !selected.includes(s)) };
}
var DB_ENGINE_NOTES_ILIKE = `%${DB_ENGINE_NOTES_TAG}%`;
async function purgeWeekBeforeInsert(db, args) {
  const { planId, athleteId, weekStart, weekEnd } = args;
  const planScoped = await db.from("planned_workouts").delete().eq("athlete_id", athleteId).eq("plan_id", planId).gte("date", weekStart).lte("date", weekEnd);
  if (planScoped.error) throw new Error(`purge piano: ${planScoped.error.message}`);
  for (const marker of [VIRYA_NOTES_ILIKE_MARKER, DB_ENGINE_NOTES_ILIKE]) {
    const legacy = await db.from("planned_workouts").delete().eq("athlete_id", athleteId).is("plan_id", null).ilike("notes", marker).gte("date", weekStart).lte("date", weekEnd);
    if (legacy.error) throw new Error(`purge legacy: ${legacy.error.message}`);
  }
}
async function loadCoachBusyDates(db, args) {
  const { data, error } = await db.from("planned_workouts").select("date").eq("athlete_id", args.athleteId).is("plan_id", null).ilike("type", "pro2\\_builder%").gte("date", args.weekStart).lte("date", args.weekEnd);
  if (error) throw new Error(`lettura giorni coach: ${error.message}`);
  return new Set(
    (data ?? []).map((r) => String(r.date ?? "").slice(0, 10)).filter(Boolean)
  );
}
async function materializeTrainingMacro(db, args) {
  const planId = args.planId.trim();
  if (!planId) return { ok: false, error: "materializeTrainingMacro: planId mancante" };
  const todayIso = (args.todayIso ?? (/* @__PURE__ */ new Date()).toISOString()).slice(0, 10);
  const { data: planRow, error: planErr } = await db.from("training_plan").select("id, athlete_id, discipline, status").eq("id", planId).maybeSingle();
  if (planErr) return { ok: false, error: `lettura piano: ${planErr.message}` };
  if (!planRow) return { ok: false, error: "plan_not_found" };
  const plan = planRow;
  if (plan.status !== "approved" && plan.status !== "active") {
    return { ok: false, error: "plan_not_approved" };
  }
  const { data: weekRowsRaw, error: weekErr } = await db.from("training_plan_week").select("id, week_start, phase, budget_tss, sessions, hours_target, objectives, family_mix").eq("plan_id", planId).order("week_start", { ascending: true });
  if (weekErr) return { ok: false, error: `lettura settimane: ${weekErr.message}` };
  const weekRows = (weekRowsRaw ?? []).filter(
    (w) => /^\d{4}-\d{2}-\d{2}/.test(String(w.week_start ?? ""))
  );
  const byWeekStart = new Map(weekRows.map((w) => [String(w.week_start).slice(0, 10), w]));
  const { selected, skipped } = selectWeekStartsToMaterialize(
    weekRows.map((w) => String(w.week_start).slice(0, 10)),
    args.weeks,
    todayIso
  );
  const errors = [];
  if (args.weeks.mode === "explicit") {
    for (const requested of args.weeks.weekStarts) {
      const key = requested.slice(0, 10);
      if (!byWeekStart.has(key)) errors.push({ weekStart: key, error: "week_not_in_skeleton" });
    }
  }
  const engine = args.engine ?? resolveTrainingL2Engine(plan.athlete_id);
  if (engine === "builder") {
    const builder = await materializeSelectedWeeksWithBuilderEngine(db, {
      planId,
      athleteId: plan.athlete_id,
      discipline: plan.discipline ?? "cycling",
      selected,
      byWeekStart,
      errors
    });
    return {
      ok: true,
      planId,
      materialized: builder.materialized,
      skipped,
      errors,
      publishedCount: builder.publishedCount
    };
  }
  const { data: profileRow } = await db.from("athlete_profiles").select("goals").eq("id", plan.athlete_id).maybeSingle();
  const goals = Array.isArray(profileRow?.goals) ? profileRow.goals.filter((g) => typeof g === "string") : [];
  const goalText = goals.join(", ");
  const materialized = [];
  let publishedCount = 0;
  for (const weekStart of selected) {
    const week = byWeekStart.get(weekStart);
    if (!week) continue;
    const weekEnd = addDaysIso(weekStart, 6);
    try {
      await purgeWeekBeforeInsert(db, { planId, athleteId: plan.athlete_id, weekStart, weekEnd });
      const coachBusyDates = await loadCoachBusyDates(db, { athleteId: plan.athlete_id, weekStart, weekEnd });
      const { data: rpcData, error: rpcErr } = await db.rpc("generate_training_week", {
        p_athlete_id: plan.athlete_id,
        p_week_start: weekStart,
        p_discipline: plan.discipline ?? "cycling",
        p_sessions: Math.max(1, Math.round(Number(week.sessions) || 1)),
        p_weekly_tss: Math.max(0, Math.round(Number(week.budget_tss) || 0)),
        p_phase: String(week.phase ?? "base"),
        p_family: "aerobic",
        p_chips: [],
        p_goal_text: goalText
      });
      if (rpcErr) throw new Error(`generate_training_week: ${rpcErr.message}`);
      const workoutIds = extractWorkoutIds(rpcData);
      if (workoutIds.length === 0) throw new Error("generate_training_week non ha restituito workout");
      const details = await readDbEngineWorkouts(db, workoutIds);
      const publishable = details.filter((d) => !coachBusyDates.has(d.workout.date));
      const publish = await publishDbWorkoutsToCalendar(db, publishable, { planId });
      publishedCount += publish.publishedIds.length;
      materialized.push(weekStart);
      const { error: countErr } = await db.from("training_plan_week").update({ workout_count: publish.publishedIds.length }).eq("id", week.id);
      if (countErr) errors.push({ weekStart, error: `workout_count: ${countErr.message}` });
    } catch (e) {
      errors.push({ weekStart, error: e instanceof Error ? e.message : String(e) });
    }
  }
  return { ok: true, planId, materialized, skipped, errors, publishedCount };
}
function asFiniteOrNull(value) {
  const n = typeof value === "string" ? Number(value) : value;
  return typeof n === "number" && Number.isFinite(n) ? n : null;
}
async function materializeSelectedWeeksWithBuilderEngine(db, args) {
  const { planId, athleteId, discipline, selected, byWeekStart, errors } = args;
  const materialized = [];
  let publishedCount = 0;
  if (!selected.length) return { materialized, publishedCount };
  let shared;
  try {
    const [config, profile] = await Promise.all([
      loadViryaConfigFromDb(db),
      loadAthleteRenderProfile(db, athleteId)
    ]);
    const includeGym = selected.some((weekStart) => {
      const week = byWeekStart.get(weekStart);
      return week ? familyMixFromJson(week.family_mix).gymPct > 0 : false;
    });
    const catalogs = await loadBuilderEngineCatalogs(db, { discipline, includeGym });
    shared = { config, profile, catalogs };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    for (const weekStart of selected) {
      errors.push({ weekStart, error: `builder_engine_setup: ${message}` });
    }
    return { materialized, publishedCount };
  }
  for (const weekStart of selected) {
    const week = byWeekStart.get(weekStart);
    if (!week) continue;
    const weekEnd = addDaysIso(weekStart, 6);
    try {
      await purgeWeekBeforeInsert(db, { planId, athleteId, weekStart, weekEnd });
      const coachBusyDates = await loadCoachBusyDates(db, { athleteId, weekStart, weekEnd });
      const phase = coercePhase(week.phase);
      const skeletonWeek = {
        weekStart,
        phase,
        loadTarget: Math.max(0, Math.round(Number(week.budget_tss) || 0)),
        sessionsTarget: Math.max(1, Math.round(Number(week.sessions) || 1)),
        hoursTarget: asFiniteOrNull(week.hours_target),
        // Edit coach dello scheletro: stimoli espliciti (o derivati dalla fase se
        // '{}') e quota famiglie — stessi mapper difensivi del contratto L1.
        stimulus: weekObjectivesFromJson(week.objectives, phase),
        familyMix: familyMixFromJson(week.family_mix),
        // Disponibilità LIVE dalla routine (fonte unica, mai snapshot): riletta a
        // ogni giro dal loader profilo.
        availableDays: shared.profile.availableDays
      };
      const result = materializeWeekWithBuilderEngine({
        planId,
        athleteId,
        discipline,
        week: skeletonWeek,
        profile: shared.profile,
        config: shared.config,
        catalogs: shared.catalogs
      });
      for (const slotError of result.errors) {
        errors.push({ weekStart, error: `${slotError.date}: ${slotError.error}` });
      }
      const publishable = result.rows.filter((row) => !coachBusyDates.has(row.date));
      const inserted = await insertPlannedWorkoutRows(db, publishable);
      publishedCount += inserted.ids.length;
      materialized.push(weekStart);
      const { error: countErr } = await db.from("training_plan_week").update({ workout_count: inserted.ids.length }).eq("id", week.id);
      if (countErr) errors.push({ weekStart, error: `workout_count: ${countErr.message}` });
    } catch (e) {
      errors.push({ weekStart, error: e instanceof Error ? e.message : String(e) });
    }
  }
  return { materialized, publishedCount };
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
  canAccessAthleteData,
  materializeTrainingMacro
};
