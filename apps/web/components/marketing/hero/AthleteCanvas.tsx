"use client";

import React, { useEffect, useRef, useState } from "react";

type Vec2 = { x: number; y: number };
type Sport = "cyclist" | "runner" | "soccer" | "skier" | "lifter";

// Solo le animazioni rifinite restano in rotazione (runner/soccer ancora da rifare).
const SPORTS: Sport[] = ["cyclist", "lifter", "skier"];
const SPORT_LABELS: Record<Sport, string> = {
  cyclist: "Ciclismo",
  runner: "Running",
  soccer: "Calcio",
  skier: "Sci",
  lifter: "Pesistica",
};

const SPORT_DURATION = 6000;
/** Cross-sport SHAPE MORPH duration (seconds). Only used right after a switch. */
const MORPH_TIME = 0.7;

/* ------------------------------------------------------------------ */
/*  Canonical point budget                                             */
/*                                                                     */
/*  Every generator returns EXACTLY POINT_COUNT points and fills the   */
/*  SAME index ranges with the SAME conceptual body part. This kills   */
/*  slice() truncation + duplicate padding and makes the cross-sport   */
/*  morph coherent. All figure generation is DETERMINISTIC: positions  */
/*  come only from joint geometry and golden-angle fills, never RNG.   */
/* ------------------------------------------------------------------ */

const BUDGET = {
  head: 28,
  neck: 8,
  torso: 44,
  upperArmL: 14,
  lowerArmL: 14,
  upperArmR: 14,
  lowerArmR: 14,
  thighL: 18,
  shankL: 16,
  footL: 10,
  thighR: 18,
  shankR: 16,
  footR: 10,
  equip: 96,
} as const;

const BODY_TOTAL =
  BUDGET.head +
  BUDGET.neck +
  BUDGET.torso +
  BUDGET.upperArmL +
  BUDGET.lowerArmL +
  BUDGET.upperArmR +
  BUDGET.lowerArmR +
  BUDGET.thighL +
  BUDGET.shankL +
  BUDGET.footL +
  BUDGET.thighR +
  BUDGET.shankR +
  BUDGET.footR; // 224

const POINT_COUNT = BODY_TOTAL + BUDGET.equip; // 320

/* Human-proportioned bone lengths (local units). */
const UP_LEG = 28;
const LO_LEG = 30;
const UP_ARM = 22;
const LO_ARM = 20;

/* ------------------------------------------------------------------ */
/*  Math helpers                                                       */
/* ------------------------------------------------------------------ */

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function lerpVec(a: Vec2, b: Vec2, t: number): Vec2 {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

function hexToRgb(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

const C1 = hexToRgb("#a855f7");
const C2 = hexToRgb("#ec4899");
const C3 = hexToRgb("#f97316");

function pointColor(x: number, width: number) {
  const t = Math.max(0, Math.min(1, x / width));
  let r: number, g: number, b: number;
  if (t < 0.5) {
    const k = t * 2;
    r = lerp(C1.r, C2.r, k);
    g = lerp(C1.g, C2.g, k);
    b = lerp(C1.b, C2.b, k);
  } else {
    const k = (t - 0.5) * 2;
    r = lerp(C2.r, C3.r, k);
    g = lerp(C2.g, C3.g, k);
    b = lerp(C2.b, C3.b, k);
  }
  return `rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`;
}

/* ------------------------------------------------------------------ */
/*  DETERMINISTIC geometry samplers                                    */
/*                                                                     */
/*  Each pushes EXACTLY `count` points derived only from the loop      */
/*  index (no Math.random), so a fixed input always yields the same    */
/*  output and the cloud never "boils". A rotation arg lets discs and  */
/*  rings spin so the bike wheels visibly rotate.                      */
/* ------------------------------------------------------------------ */

const GOLDEN = Math.PI * (3 - Math.sqrt(5)); // ~2.399963 rad (golden angle)

/** Filled disc via golden-angle sunflower. Even, gap-free, deterministic. */
function fillDisc(out: Vec2[], cx: number, cy: number, r: number, count: number, rot = 0) {
  for (let i = 0; i < count; i++) {
    const rad = r * Math.sqrt((i + 0.5) / count);
    const ang = i * GOLDEN + rot;
    out.push({ x: cx + Math.cos(ang) * rad, y: cy + Math.sin(ang) * rad });
  }
}

/** Filled ellipse via golden-angle sunflower, optionally tilted. Deterministic. */
function fillEllipse(
  out: Vec2[],
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  count: number,
  tilt = 0,
) {
  const ct = Math.cos(tilt);
  const st = Math.sin(tilt);
  for (let i = 0; i < count; i++) {
    const k = Math.sqrt((i + 0.5) / count);
    const ang = i * GOLDEN;
    const lx = Math.cos(ang) * rx * k;
    const ly = Math.sin(ang) * ry * k;
    out.push({ x: cx + lx * ct - ly * st, y: cy + lx * st + ly * ct });
  }
}

/** Wheel: rim ring + 4 radial spokes, all rotated by `rot` so spin reads. */
function fillWheel(out: Vec2[], cx: number, cy: number, r: number, count: number, rot: number) {
  const rimCount = Math.floor(count * 0.66);
  const spokeCount = count - rimCount;
  for (let i = 0; i < rimCount; i++) {
    const a = (i / rimCount) * Math.PI * 2 + rot;
    out.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
  }
  const spokes = 4;
  const perSpoke = Math.max(1, Math.ceil(spokeCount / spokes));
  for (let i = 0; i < spokeCount; i++) {
    const spoke = i % spokes;
    const step = Math.floor(i / spokes);
    const a = (spoke / spokes) * Math.PI * 2 + rot;
    const k = (step + 1) / (perSpoke + 1);
    out.push({ x: cx + Math.cos(a) * r * k, y: cy + Math.sin(a) * r * k });
  }
}

/**
 * Thick limb segment: distribute EXACTLY `count` points as parallel rows along
 * the bone a->b. Row count derives from `thickness` so limbs read as volume.
 * Deterministic; emits exactly `count` regardless of bone length.
 */
function fillBone(out: Vec2[], a: Vec2, b: Vec2, count: number, thickness: number) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const rows = thickness >= 6 ? 3 : thickness >= 3 ? 2 : 1;
  const cols = Math.max(1, Math.ceil(count / rows));
  let pushed = 0;
  for (let c = 0; c < cols && pushed < count; c++) {
    const t = cols <= 1 ? 0.5 : c / (cols - 1);
    const px = lerp(a.x, b.x, t);
    const py = lerp(a.y, b.y, t);
    for (let row = 0; row < rows && pushed < count; row++) {
      const off = rows === 1 ? 0 : (row / (rows - 1) - 0.5) * thickness;
      out.push({ x: px + nx * off, y: py + ny * off });
      pushed++;
    }
  }
  // Exact-count safety (cols*rows >= count, so this never adds duplicates).
  while (pushed < count) {
    out.push({ x: b.x, y: b.y });
    pushed++;
  }
}

/** A shoe: small tilted ellipse seated at the foot joint, toe forward (+x). */
function fillShoe(out: Vec2[], foot: Vec2, count: number) {
  fillEllipse(out, foot.x + 3, foot.y + 2, 7, 3.5, count);
}

/* ------------------------------------------------------------------ */
/*  Skeleton — named joints in local, origin-centred space.            */
/*  Faces +x (right). Feet near y=+52, head near y=-54.                */
/*  Shoulders/hips carry a small bilateral offset so the two arms and  */
/*  two legs never originate from one coincident point.                */
/* ------------------------------------------------------------------ */

interface Skeleton {
  head: Vec2;
  neck: Vec2;
  shoulderL: Vec2;
  shoulderR: Vec2;
  hipL: Vec2;
  hipR: Vec2;
  torsoTop: Vec2;
  torsoBot: Vec2;
  elbowL: Vec2;
  handL: Vec2;
  elbowR: Vec2;
  handR: Vec2;
  kneeL: Vec2;
  footL: Vec2;
  kneeR: Vec2;
  footR: Vec2;
  headR: number;
  /** Per-sport equipment painter. Must push EXACTLY BUDGET.equip points. */
  equip: (out: Vec2[]) => void;
}

/**
 * Two-bone IK with conserved bone lengths (law of cosines). The joint is placed
 * at the correct distance from `root` for fixed-length bones `l1`,`l2`; if the
 * target is out of reach the distance is clamped a few % below l1+l2 so the
 * limb keeps a slight bend instead of snapping dead-straight. `dir` selects the
 * bend side (+1 / -1).
 */
function solveJoint(root: Vec2, end: Vec2, l1: number, l2: number, dir: number): Vec2 {
  const dx = end.x - root.x;
  const dy = end.y - root.y;
  let d = Math.sqrt(dx * dx + dy * dy);
  const maxD = (l1 + l2) * 0.97; // keep a residual bend; never fully locked
  if (d > maxD) d = maxD;
  if (d < 0.001) d = 0.001;
  const a = (l1 * l1 - l2 * l2 + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
  const ux = dx / d;
  const uy = dy / d;
  const nx = -uy * dir;
  const ny = ux * dir;
  return { x: root.x + ux * a + nx * h, y: root.y + uy * a + ny * h };
}

/* ------------------------- Sport skeletons ------------------------ */

function skelCyclist(t: number): Skeleton {
  const pedalPhase = t * 3.4;
  const wheelPhase = pedalPhase * 1.6; // wheels spin, tied to pedaling
  const crankR = 15;
  const bb: Vec2 = { x: 4, y: 30 }; // bottom bracket / crank centre
  const rear: Vec2 = { x: -48, y: 34 };
  const front: Vec2 = { x: 52, y: 34 };
  const wheelR = 22;

  const hip: Vec2 = { x: -14, y: 4 };
  const shoulder: Vec2 = { x: 26, y: -16 };
  const neck: Vec2 = { x: 32, y: -26 };
  const head: Vec2 = { x: 40, y: -34 };
  // Two hands on the bars, slightly apart so both arms stay distinct.
  const handL: Vec2 = { x: 49, y: 5 };
  const handR: Vec2 = { x: 51, y: 3 };

  // Aero bent arms reaching to the bars (two separate arms, opposite bend).
  const shoulderL: Vec2 = { x: shoulder.x - 1, y: shoulder.y + 1 };
  const shoulderR: Vec2 = { x: shoulder.x + 1, y: shoulder.y - 1 };
  const elbowL = solveJoint(shoulderL, handL, UP_ARM, LO_ARM, 1);
  const elbowR = solveJoint(shoulderR, handR, UP_ARM, LO_ARM, -1);

  // Pedaling legs: each foot rides the crank circle, 180deg out of phase.
  const pedalL: Vec2 = {
    x: bb.x + Math.cos(pedalPhase) * crankR,
    y: bb.y + Math.sin(pedalPhase) * crankR,
  };
  const pedalR: Vec2 = {
    x: bb.x + Math.cos(pedalPhase + Math.PI) * crankR,
    y: bb.y + Math.sin(pedalPhase + Math.PI) * crankR,
  };
  const hipL: Vec2 = { x: hip.x, y: hip.y + 1 };
  const hipR: Vec2 = { x: hip.x, y: hip.y - 1 };
  // dir=-1 keeps the knee forward/up (never buckling behind the hip).
  const kneeL = solveJoint(hipL, pedalL, UP_LEG, LO_LEG, -1);
  const kneeR = solveJoint(hipR, pedalR, UP_LEG, LO_LEG, -1);

  return {
    head,
    neck,
    shoulderL,
    shoulderR,
    hipL,
    hipR,
    torsoTop: shoulder,
    torsoBot: hip,
    elbowL,
    handL,
    elbowR,
    handR,
    kneeL,
    footL: pedalL,
    kneeR,
    footR: pedalR,
    headR: 10,
    equip(out) {
      // 96 = wheel(30) + wheel(30) + frame(10 + 10 + 8 + 8 = 36).
      fillWheel(out, rear.x, rear.y, wheelR, 30, wheelPhase);
      fillWheel(out, front.x, front.y, wheelR, 30, wheelPhase);
      const seat: Vec2 = { x: -20, y: 0 };
      fillBone(out, seat, bb, 10, 3);
      fillBone(out, bb, handR, 10, 3);
      fillBone(out, rear, bb, 8, 2);
      fillBone(out, front, bb, 8, 2);
    },
  };
}

function skelRunner(t: number): Skeleton {
  const phase = t * 4.2;
  const bob = Math.sin(phase * 2) * 2.5;
  const lean = 8; // forward lean offset on the upper body

  const hip: Vec2 = { x: 0, y: 2 + bob * 0.3 };
  const shoulder: Vec2 = { x: lean, y: -28 + bob * 0.6 };
  const neck: Vec2 = { x: lean + 2, y: -42 + bob };
  const head: Vec2 = { x: lean + 4, y: -54 + bob };

  const hipL: Vec2 = { x: hip.x - 2, y: hip.y };
  const hipR: Vec2 = { x: hip.x + 2, y: hip.y };
  const shoulderL: Vec2 = { x: shoulder.x - 2, y: shoulder.y + 1 };
  const shoulderR: Vec2 = { x: shoulder.x + 2, y: shoulder.y - 1 };

  // Legs: clear opposite-phase stride. Foot swings fore/aft and lifts; the
  // knee is IK-solved between hip and foot so the bones keep fixed length.
  const stride = (root: Vec2, p: number) => {
    const s = Math.sin(p);
    const lift = Math.max(0, Math.cos(p)) * 18;
    const foot: Vec2 = { x: hip.x + s * 18, y: 52 - lift };
    const knee = solveJoint(root, foot, UP_LEG, LO_LEG, 1);
    return { knee, foot };
  };
  const L = stride(hipL, phase);
  const Rg = stride(hipR, phase + Math.PI);

  // Bent arms pumping opposite the legs; elbow IK-solved (fixed bones).
  const arm = (root: Vec2, p: number) => {
    const s = Math.sin(p);
    const hand: Vec2 = { x: root.x + 8 + s * 12, y: root.y + 24 - Math.max(0, s) * 10 };
    const elbow = solveJoint(root, hand, UP_ARM, LO_ARM, 1);
    return { elbow, hand };
  };
  const aL = arm(shoulderL, phase);
  const aR = arm(shoulderR, phase + Math.PI);

  return {
    head,
    neck,
    shoulderL,
    shoulderR,
    hipL,
    hipR,
    torsoTop: shoulder,
    torsoBot: hip,
    elbowL: aL.elbow,
    handL: aL.hand,
    elbowR: aR.elbow,
    handR: aR.hand,
    kneeL: L.knee,
    footL: L.foot,
    kneeR: Rg.knee,
    footR: Rg.foot,
    headR: 11,
    equip(out) {
      // 96 = shoes(18 + 18) + a deterministic ground speed trail(60).
      fillShoe(out, L.foot, 18);
      fillShoe(out, Rg.foot, 18);
      const baseY = 54;
      for (let i = 0; i < 60; i++) {
        const lane = i % 4;
        const k = Math.floor(i / 4);
        const x = -22 - k * 4 - lane * 1.5;
        const y = baseY - lane * 4 + Math.sin(i * 0.9 + phase) * 1.2;
        out.push({ x, y });
      }
    },
  };
}

function skelSoccer(t: number): Skeleton {
  const phase = t * 2.4;
  const kick = Math.sin(phase); // >0 = swinging through the ball
  const swing = Math.max(0, kick); // forward swing only

  const hip: Vec2 = { x: 0, y: 2 };
  const shoulder: Vec2 = { x: 2, y: -28 };
  const neck: Vec2 = { x: 3, y: -42 };
  const head: Vec2 = { x: 4, y: -54 };

  const hipL: Vec2 = { x: hip.x + 2, y: hip.y };
  const hipR: Vec2 = { x: hip.x - 2, y: hip.y };
  const shoulderL: Vec2 = { x: shoulder.x - 2, y: shoulder.y + 1 };
  const shoulderR: Vec2 = { x: shoulder.x + 2, y: shoulder.y - 1 };

  // Planted support leg (left, slightly forward and stable).
  const footL: Vec2 = { x: 14, y: 52 };
  const kneeL = solveJoint(hipL, footL, UP_LEG, LO_LEG, 1);

  // Kicking leg (right) swings forward THROUGH the ball on the ground.
  const footR: Vec2 = { x: -20 + swing * 30, y: 50 - swing * 6 };
  const kneeR = solveJoint(hipR, footR, UP_LEG, LO_LEG, 1);

  // Arms out for balance (opposite sway), elbows IK-solved.
  const handL: Vec2 = { x: 30, y: -10 + Math.sin(phase) * 4 };
  const handR: Vec2 = { x: -26, y: -14 - Math.sin(phase) * 4 };
  const elbowL = solveJoint(shoulderL, handL, UP_ARM, LO_ARM, 1);
  const elbowR = solveJoint(shoulderR, handR, UP_ARM, LO_ARM, -1);

  // Ball rests on the ground in the foot's forward arc; once the foot reaches
  // it (swing > ~0.6) the ball launches forward and slightly up.
  const launched = swing > 0.6 ? (swing - 0.6) / 0.4 : 0;
  const ball: Vec2 = { x: 4 + launched * 30, y: 54 - launched * 10 };

  return {
    head,
    neck,
    shoulderL,
    shoulderR,
    hipL,
    hipR,
    torsoTop: shoulder,
    torsoBot: hip,
    elbowL,
    handL,
    elbowR,
    handR,
    kneeL,
    footL,
    kneeR,
    footR,
    headR: 11,
    equip(out) {
      // 96 = ball(72) + ground line(16) + motion streaks(8).
      fillDisc(out, ball.x, ball.y, 9, 72, phase);
      for (let i = 0; i < 16; i++) out.push({ x: -38 + i * 5, y: 60 });
      for (let i = 0; i < 8; i++) {
        const dxx = launched > 0 ? (i % 4) * 5 * launched : (i % 4) * 1.2;
        out.push({ x: ball.x - 12 - dxx, y: ball.y - 4 + Math.floor(i / 4) * 8 });
      }
    },
  };
}

function skelSkier(t: number): Skeleton {
  const phase = t * 1.8;
  // Oscillazione (così non sembra un fermo-immagine): le gambe "pompano" su/giu'
  // + un leggero spostamento avanti/indietro. I piedi/sci restano a terra: il
  // corpo sale e scende e le ginocchia si flettono di conseguenza (IK).
  const pump = Math.sin(phase);
  const rock = Math.sin(phase * 0.5);
  const dy = pump * 7; // corpo che si abbassa/rialza (flessione/estensione gambe)
  const dx = rock * 4; // leggero spostamento avanti/indietro (cambio di carico)

  // PROFILE tuck facing +x (descending to the right): hips back & low, torso
  // leaning forward over the bent knees, head/helmet forward.
  const hip: Vec2 = { x: -6 + dx, y: 12 + dy };
  const shoulder: Vec2 = { x: 14 + dx, y: -8 + dy * 0.9 };
  const neck: Vec2 = { x: 20 + dx, y: -16 + dy * 0.85 };
  const head: Vec2 = { x: 26 + dx + rock * 2, y: -22 + dy * 0.8 };

  const hipL: Vec2 = { x: hip.x - 1, y: hip.y + 1 };
  const hipR: Vec2 = { x: hip.x + 1, y: hip.y - 1 };
  const shoulderL: Vec2 = { x: shoulder.x - 1, y: shoulder.y + 1 };
  const shoulderR: Vec2 = { x: shoulder.x + 1, y: shoulder.y - 1 };

  // Feet/skis PLANTED (fixed) — il corpo pompa sopra di essi, quindi le ginocchia
  // si flettono ed estendono in modo visibile via IK.
  const footL: Vec2 = { x: 2, y: 51 };
  const footR: Vec2 = { x: 12, y: 50 };
  const kneeL = solveJoint(hipL, footL, UP_LEG, LO_LEG, -1);
  const kneeR = solveJoint(hipR, footR, UP_LEG, LO_LEG, -1);

  // Bent arms forward (hands in front of the chest), moving with the torso.
  const handL: Vec2 = { x: 27 + dx, y: -2 + dy * 0.85 };
  const handR: Vec2 = { x: 30 + dx, y: -4 + dy * 0.85 };
  const elbowL = solveJoint(shoulderL, handL, UP_ARM, LO_ARM, 1);
  const elbowR = solveJoint(shoulderR, handR, UP_ARM, LO_ARM, 1);

  return {
    head,
    neck,
    shoulderL,
    shoulderR,
    hipL,
    hipR,
    torsoTop: shoulder,
    torsoBot: hip,
    elbowL,
    handL,
    elbowR,
    handR,
    kneeL,
    footL,
    kneeR,
    footR,
    headR: 10,
    equip(out) {
      // 96 = ski(40) + ski2(16) + tip(8) + poleL(16) + poleR(16).
      // One long ski under the feet (tail behind, tip up & forward), tilted a
      // touch downhill (front lower) to read as descending; a 2nd offset ski
      // line gives it volume in profile.
      const skiBack: Vec2 = { x: -26, y: 50 };
      const skiFront: Vec2 = { x: 44, y: 57 };
      fillBone(out, skiBack, skiFront, 40, 3);
      fillBone(out, { x: -22, y: 52 }, { x: 48, y: 59 }, 16, 2);
      fillDisc(out, skiFront.x, skiFront.y - 4, 4, 8); // upturned tip
      // Poles swept BACK from the hands to tips behind the hip (aero tuck).
      fillBone(out, handL, { x: -18, y: 6 }, 16, 1);
      fillBone(out, handR, { x: -14, y: 9 }, 16, 1);
    },
  };
}

function skelLifter(t: number): Skeleton {
  const phase = t * 1.7;
  const lift = (Math.sin(phase) + 1) / 2; // 0 = racked at chest, 1 = locked overhead

  const hip: Vec2 = { x: 0, y: 6 };
  const shoulder: Vec2 = { x: 0, y: -26 };
  const neck: Vec2 = { x: 0, y: -40 };
  const head: Vec2 = { x: 0, y: -52 };

  // Feet planted ~shoulder-width; knees dip at the rack and straighten on lock-out.
  const dip = (1 - lift) * 5;
  const footL: Vec2 = { x: -12, y: 52 };
  const footR: Vec2 = { x: 12, y: 52 };
  const hipL: Vec2 = { x: hip.x - 3, y: hip.y };
  const hipR: Vec2 = { x: hip.x + 3, y: hip.y };
  const kneeL = solveJoint(hipL, footL, UP_LEG, LO_LEG, -1);
  const kneeR = solveJoint(hipR, footR, UP_LEG, LO_LEG, 1);
  kneeL.y += dip;
  kneeR.y += dip;

  // Longer arms (this skeleton only) so the bar locks WELL ABOVE the head.
  const armUp = 27;
  const armLo = 25;
  // Hands kept ~shoulder-width => arms go straight UP (not out to a "T"). The bar
  // travels from the front rack (chest ~ -22) to a high overhead lock-out
  // (~ -75, just within reach so the forearms never detach).
  const barY = lerp(-22, -75, lift);
  const handL: Vec2 = { x: -12, y: barY };
  const handR: Vec2 = { x: 12, y: barY };
  const shoulderL: Vec2 = { x: shoulder.x - 5, y: shoulder.y };
  const shoulderR: Vec2 = { x: shoulder.x + 5, y: shoulder.y };
  // Elbows bow outward when bent, near-straight at the overhead lock-out.
  const elbowL = solveJoint(shoulderL, handL, armUp, armLo, -1);
  const elbowR = solveJoint(shoulderR, handR, armUp, armLo, 1);

  return {
    head,
    neck,
    shoulderL,
    shoulderR,
    hipL,
    hipR,
    torsoTop: shoulder,
    torsoBot: hip,
    elbowL,
    handL,
    elbowR,
    handR,
    kneeL,
    footL,
    kneeR,
    footR,
    headR: 11,
    equip(out) {
      // 96 = bar(16) + plateL(26) + hubL(14) + plateR(26) + hubR(14).
      fillBone(out, { x: -42, y: barY }, { x: 42, y: barY }, 16, 2);
      fillEllipse(out, -36, barY, 6, 12, 26); // outer plate L (tall, narrow)
      fillDisc(out, -36, barY, 4, 14); // hub L
      fillEllipse(out, 36, barY, 6, 12, 26); // outer plate R
      fillDisc(out, 36, barY, 4, 14); // hub R
    },
  };
}

function skeletonFor(sport: Sport, t: number): Skeleton {
  switch (sport) {
    case "cyclist":
      return skelCyclist(t);
    case "runner":
      return skelRunner(t);
    case "soccer":
      return skelSoccer(t);
    case "skier":
      return skelSkier(t);
    case "lifter":
      return skelLifter(t);
  }
}

/* ------------------------------------------------------------------ */
/*  Skeleton -> point cloud (EXACTLY POINT_COUNT, deterministic)       */
/*  Index ranges are identical across every sport, in BUDGET order.    */
/* ------------------------------------------------------------------ */

function buildPoints(sport: Sport, t: number): Vec2[] {
  const s = skeletonFor(sport, t);
  const out: Vec2[] = [];

  // head
  fillDisc(out, s.head.x, s.head.y, s.headR, BUDGET.head);
  // neck
  fillBone(out, s.neck, s.torsoTop, BUDGET.neck, 4);
  // torso — ellipse spanning shoulder->hip, TILTED along that axis so it lies
  // along the spine (e.g. the cyclist's aero lean), not as an upright blob.
  const torsoC: Vec2 = {
    x: (s.torsoTop.x + s.torsoBot.x) / 2,
    y: (s.torsoTop.y + s.torsoBot.y) / 2,
  };
  const tdx = s.torsoBot.x - s.torsoTop.x;
  const tdy = s.torsoBot.y - s.torsoTop.y;
  const torsoH = Math.max(18, Math.sqrt(tdx * tdx + tdy * tdy) / 2 + 8);
  const tilt = Math.atan2(tdy, tdx) - Math.PI / 2;
  fillEllipse(out, torsoC.x, torsoC.y, 12, torsoH, BUDGET.torso, tilt);
  // arms (two distinct arms from bilaterally offset shoulders)
  fillBone(out, s.shoulderL, s.elbowL, BUDGET.upperArmL, 6);
  fillBone(out, s.elbowL, s.handL, BUDGET.lowerArmL, 5);
  fillBone(out, s.shoulderR, s.elbowR, BUDGET.upperArmR, 6);
  fillBone(out, s.elbowR, s.handR, BUDGET.lowerArmR, 5);
  // legs (two distinct legs from bilaterally offset hips)
  fillBone(out, s.hipL, s.kneeL, BUDGET.thighL, 7);
  fillBone(out, s.kneeL, s.footL, BUDGET.shankL, 6);
  fillBone(out, s.hipR, s.kneeR, BUDGET.thighR, 7);
  fillBone(out, s.kneeR, s.footR, BUDGET.shankR, 6);
  // feet (shoes)
  fillShoe(out, s.footL, BUDGET.footL);
  fillShoe(out, s.footR, BUDGET.footR);
  // equipment (fixed trailing slot — each painter sums to exactly BUDGET.equip)
  s.equip(out);

  return out; // exactly POINT_COUNT
}

/* ------------------------------------------------------------------ */
/*  Per-sport framing: normalize so all five share centre + height.    */
/*  Computed ONCE per sport from a stable sampled bounding box, NOT     */
/*  per frame, so the figure never "breathes"/zooms as limbs swing.    */
/* ------------------------------------------------------------------ */

interface Frame {
  cx: number;
  cy: number;
  scale: number;
}

const TARGET_HEIGHT = 132; // local units; every sport normalized to this height

function computeFrame(sport: Sport): Frame {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  // Sample several phases so the box covers the full motion range once.
  for (let k = 0; k < 12; k++) {
    const pts = buildPoints(sport, k * 0.37);
    for (const p of pts) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }
  }
  const h = maxY - minY || 1;
  return { cx: (minX + maxX) / 2, cy: (minY + maxY) / 2, scale: TARGET_HEIGHT / h };
}

const FRAMES: Record<Sport, Frame> = {
  cyclist: computeFrame("cyclist"),
  runner: computeFrame("runner"),
  soccer: computeFrame("soccer"),
  skier: computeFrame("skier"),
  lifter: computeFrame("lifter"),
};

/** Normalized pose (centred + uniformly scaled) in local space. */
function buildNormalizedPose(sport: Sport, t: number): Vec2[] {
  const f = FRAMES[sport];
  const pts = buildPoints(sport, t);
  for (let i = 0; i < pts.length; i++) {
    pts[i] = { x: (pts[i].x - f.cx) * f.scale, y: (pts[i].y - f.cy) * f.scale };
  }
  return pts;
}

/* ------------------------------------------------------------------ */
/*  Background data streams (the ONLY place randomness is allowed)     */
/* ------------------------------------------------------------------ */

interface Stream {
  x: number;
  y: number;
  length: number;
  speed: number;
}

function initStreams(height: number): Stream[] {
  const streams: Stream[] = [];
  for (let i = 0; i < 10; i++) {
    streams.push({
      x: Math.random() * 600 - 200,
      y: 30 + (i / 10) * (height - 60),
      length: 40 + Math.random() * 80,
      speed: 0.8 + Math.random() * 1.5,
    });
  }
  return streams;
}

/* ------------------------------------------------------------------ */
/*  Spatial-grid proximity mesh — replaces the O(n^2) double loop.     */
/* ------------------------------------------------------------------ */

function drawMesh(ctx: CanvasRenderingContext2D, pts: Vec2[], threshold: number) {
  const cell = threshold || 1;
  const grid = new Map<string, number[]>();
  const key = (cx: number, cy: number) => cx + "," + cy;
  for (let i = 0; i < pts.length; i++) {
    const cx = Math.floor(pts[i].x / cell);
    const cy = Math.floor(pts[i].y / cell);
    const k = key(cx, cy);
    const arr = grid.get(k);
    if (arr) arr.push(i);
    else grid.set(k, [i]);
  }
  const thr2 = threshold * threshold;
  ctx.lineWidth = 0.8;
  for (let i = 0; i < pts.length; i++) {
    const cx = Math.floor(pts[i].x / cell);
    const cy = Math.floor(pts[i].y / cell);
    for (let gx = cx - 1; gx <= cx + 1; gx++) {
      for (let gy = cy - 1; gy <= cy + 1; gy++) {
        const arr = grid.get(key(gx, gy));
        if (!arr) continue;
        for (const j of arr) {
          if (j <= i) continue;
          const dx = pts[i].x - pts[j].x;
          const dy = pts[i].y - pts[j].y;
          const d2 = dx * dx + dy * dy;
          if (d2 < thr2) {
            const dist = Math.sqrt(d2);
            const alpha = (1 - dist / threshold) * 0.15;
            ctx.strokeStyle = `rgba(160, 160, 180, ${alpha})`;
            ctx.beginPath();
            ctx.moveTo(pts[i].x, pts[i].y);
            ctx.lineTo(pts[j].x, pts[j].y);
            ctx.stroke();
          }
        }
      }
    }
  }
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function AthleteCanvas({
  onMetrics,
}: {
  /** Emette le metriche live (così l'orologio mostra gli STESSI valori). */
  onMetrics?: (m: { hr: number; pwr: number; cad: number; spd: number }) => void;
} = {}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [sportIndex, setSportIndex] = useState(0);
  const [metrics, setMetrics] = useState({ hr: 142, pwr: 312, cad: 89, spd: 38.2 });
  const onMetricsRef = useRef(onMetrics);
  useEffect(() => {
    onMetricsRef.current = onMetrics;
  }, [onMetrics]);

  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const cvs = canvas;
    const context = ctx;

    let animId = 0;
    let lastT = performance.now();
    let idx = 0;
    let sportTimer = 0;
    // Per-sport clock: reset to 0 on every switch so each sport enters at its
    // canonical neutral phase (separates SHAPE MORPH from POSE ANIMATION).
    let sportTime = 0;

    // Morph state: prevPose is the FROZEN settled pose of the OUTGOING sport;
    // morphT runs 0->1 only during the ~MORPH_TIME after a switch. WITHIN a
    // sport we draw the LIVE animated pose directly, so limb cycling is crisp.
    let morphT = 1;
    let prevPose: Vec2[] = buildNormalizedPose(SPORTS[idx], 0);

    // Screen-space cloud actually drawn each frame.
    const screenPts: Vec2[] = Array.from({ length: POINT_COUNT }, () => ({ x: 0, y: 0 }));

    let streams: Stream[] = [];
    let scanY = 0;

    function centre(w: number, h: number) {
      return { x: w / 2, y: h / 2 - 6 };
    }

    function resize() {
      const rect = cvs.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      cvs.width = rect.width * dpr;
      cvs.height = rect.height * dpr;
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (streams.length === 0) {
        streams = initStreams(rect.height);
      }
    }
    resize();
    window.addEventListener("resize", resize);

    function render() {
      // LIVE deterministic pose for the active sport at its own clock.
      const livePose = buildNormalizedPose(SPORTS[idx], sportTime);

      const w = cvs.clientWidth;
      const h = cvs.clientHeight;
      const c = centre(w, h);
      const scale = Math.min(w, h) / 200;

      // Eased SHAPE MORPH factor (smoothstep). =1 once settled -> live pose.
      const e = morphT < 1 ? morphT * morphT * (3 - 2 * morphT) : 1;
      for (let i = 0; i < POINT_COUNT; i++) {
        const local = e >= 1 ? livePose[i] : lerpVec(prevPose[i], livePose[i], e);
        screenPts[i].x = c.x + local.x * scale;
        screenPts[i].y = c.y + local.y * scale;
      }

      // Fade trail verso il TRASPARENTE (non verso il nero): la scia dei punti
      // svanisce lasciando vedere lo sfondo dietro -> niente riquadro nero/stacco.
      // Alza l'alpha = scia piu' corta; abbassa = scia piu' lunga (ghosting).
      context.globalCompositeOperation = "destination-out";
      context.fillStyle = "rgba(0, 0, 0, 0.22)";
      context.fillRect(0, 0, w, h);
      context.globalCompositeOperation = "source-over";

      // Proximity mesh (scale-relative threshold via spatial grid).
      drawMesh(context, screenPts, 22 * scale);

      // Scanline.
      context.strokeStyle = "rgba(168, 85, 247, 0.06)";
      context.lineWidth = 1;
      context.beginPath();
      context.moveTo(0, scanY);
      context.lineTo(w, scanY);
      context.stroke();

      // Data streams (flow across the canvas; light up over the figure).
      for (const s of streams) {
        let active = false;
        for (let i = 0; i < POINT_COUNT; i++) {
          const py = screenPts[i].y;
          const px = screenPts[i].x;
          if (Math.abs(py - s.y) < 22 && px >= s.x - 10 && px <= s.x + s.length + 10) {
            active = true;
            break;
          }
        }

        if (active) {
          const grad = context.createLinearGradient(s.x, s.y, s.x + s.length, s.y);
          grad.addColorStop(0, "rgba(168,85,247,0.35)");
          grad.addColorStop(0.5, "rgba(236,72,153,0.45)");
          grad.addColorStop(1, "rgba(249,115,22,0.35)");
          context.strokeStyle = grad;
          context.lineWidth = 1.5;
          context.shadowBlur = 6;
          context.shadowColor = "rgba(168,85,247,0.3)";
        } else {
          context.strokeStyle = "rgba(255,255,255,0.04)";
          context.lineWidth = 0.6;
          context.shadowBlur = 0;
        }
        context.beginPath();
        context.moveTo(s.x, s.y);
        context.lineTo(s.x + s.length, s.y);
        context.stroke();
        context.shadowBlur = 0;
      }

      // Glowing brand-gradient points.
      for (let i = 0; i < POINT_COUNT; i++) {
        const p = screenPts[i];
        const col = pointColor(p.x, w);
        context.fillStyle = col;
        context.shadowBlur = 10;
        context.shadowColor = col;
        context.beginPath();
        context.arc(p.x, p.y, 2.2, 0, Math.PI * 2);
        context.fill();
        context.shadowBlur = 0;

        context.fillStyle = "rgba(255,255,255,0.85)";
        context.beginPath();
        context.arc(p.x, p.y, 0.9, 0, Math.PI * 2);
        context.fill();
      }
    }

    function step(now: number) {
      const dt = Math.min((now - lastT) / 1000, 0.05);
      lastT = now;
      sportTime += dt;
      sportTimer += dt * 1000;

      if (sportTimer > SPORT_DURATION) {
        sportTimer = 0;
        // Freeze the settled pose of the sport we are leaving, then morph in.
        prevPose = buildNormalizedPose(SPORTS[idx], sportTime);
        idx = (idx + 1) % SPORTS.length;
        sportTime = 0; // new sport enters at its canonical neutral phase
        morphT = 0;
        setSportIndex(idx);
      }

      if (morphT < 1) morphT = Math.min(1, morphT + dt / MORPH_TIME);

      scanY += 0.5;
      if (scanY > cvs.clientHeight) scanY = 0;

      render();

      animId = requestAnimationFrame(step);
    }

    if (reduceMotion) {
      // Static but recognizable pose; no animation, no flashing.
      // A mid-cycle phase makes the chosen sport read as a clear athlete.
      sportTime = 0.6;
      morphT = 1;
      render();
    } else {
      animId = requestAnimationFrame(step);
    }

    const metricInterval = reduceMotion
      ? null
      : setInterval(() => {
          const m = {
            hr: 128 + Math.floor(Math.random() * 45),
            pwr: 180 + Math.floor(Math.random() * 240),
            cad: 70 + Math.floor(Math.random() * 35),
            spd: +(25 + Math.random() * 22).toFixed(1),
          };
          setMetrics(m);
          onMetricsRef.current?.(m);
        }, 1200);

    return () => {
      cancelAnimationFrame(animId);
      if (metricInterval) clearInterval(metricInterval);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <div className="relative w-full aspect-[4/3] max-w-3xl mx-auto">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
        aria-label="Animazione atleta costruito da flussi di dati"
      />

      {/* Sport label */}
      <div className="absolute left-1/2 top-4 z-10 -translate-x-1/2">
        <span className="rounded-full border border-white/10 bg-black/50 px-4 py-1.5 font-mono text-xs uppercase tracking-[0.2em] text-white backdrop-blur-md">
          {SPORT_LABELS[SPORTS[sportIndex]]}
        </span>
      </div>

      {/* HUD overlays */}
      <div className="absolute top-4 left-4 rounded-lg border border-purple-500/20 bg-black/50 px-3 py-2 backdrop-blur-md">
        <p className="font-mono text-[0.6rem] uppercase tracking-wider text-purple-300">HR</p>
        <p className="font-mono text-sm font-bold text-white">{metrics.hr} <span className="text-[0.6rem] font-normal text-gray-400">bpm</span></p>
      </div>
      <div className="absolute top-4 right-4 rounded-lg border border-pink-500/20 bg-black/50 px-3 py-2 backdrop-blur-md">
        <p className="font-mono text-[0.6rem] uppercase tracking-wider text-pink-300">PWR</p>
        <p className="font-mono text-sm font-bold text-white">{metrics.pwr} <span className="text-[0.6rem] font-normal text-gray-400">W</span></p>
      </div>
      <div className="absolute bottom-4 left-4 rounded-lg border border-cyan-500/20 bg-black/50 px-3 py-2 backdrop-blur-md">
        <p className="font-mono text-[0.6rem] uppercase tracking-wider text-cyan-300">CAD</p>
        <p className="font-mono text-sm font-bold text-white">{metrics.cad} <span className="text-[0.6rem] font-normal text-gray-400">rpm</span></p>
      </div>
      <div className="absolute bottom-4 right-4 rounded-lg border border-orange-500/20 bg-black/50 px-3 py-2 backdrop-blur-md">
        <p className="font-mono text-[0.6rem] uppercase tracking-wider text-orange-300">SPD</p>
        <p className="font-mono text-sm font-bold text-white">{metrics.spd} <span className="text-[0.6rem] font-normal text-gray-400">km/h</span></p>
      </div>

      {/* Dots indicator */}
      <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-2">
        {SPORTS.map((_, i) => (
          <div
            key={i}
            className={`h-1.5 rounded-full transition-all duration-500 ${
              i === sportIndex ? "w-6 bg-gradient-to-r from-purple-400 to-pink-400" : "w-1.5 bg-white/20"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
