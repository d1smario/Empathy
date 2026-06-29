import { test } from "node:test";
import assert from "node:assert/strict";
import {
  getMobileMenuSections,
  isMobileAppPath,
  stripMobileAppPrefix,
  toDesktopPath,
  toMobilePath,
} from "./mobile-module-registry";

test("toMobilePath: dashboard e training session", () => {
  assert.equal(toMobilePath("/dashboard"), "/m/dashboard");
  assert.equal(toMobilePath("/training/calendar"), "/m/training/calendar");
  assert.equal(toMobilePath("/training/session/2026-06-03"), "/m/training/session/2026-06-03");
  assert.equal(toMobilePath("/nutrition/diary"), "/m/nutrition/diary");
  assert.equal(toMobilePath("/nutrition/meal-plan"), "/m/nutrition/meal-plan");
  assert.equal(toMobilePath("/health"), "/m/health");
  assert.equal(toMobilePath("/physiology"), "/m/physiology");
  assert.equal(toMobilePath("/bioenergetics"), "/m/bioenergetics");
  assert.equal(toMobilePath("/longevity"), "/m/longevity");
});

test("toMobilePath: builder e coach restano null", () => {
  assert.equal(toMobilePath("/training/builder"), null);
  assert.equal(toMobilePath("/athletes"), null);
  assert.equal(toMobilePath("/admin"), null);
});

test("drawer per ruolo, derivato dalla sidebar desktop", () => {
  // Atleta: account (dashboard) + moduli, IDENTICO al desktop; niente voci extra.
  const athleteKeys = getMobileMenuSections("private").flatMap((s) => s.items.map((i) => i.key));
  assert.ok(athleteKeys.includes("dashboard"));
  assert.ok(athleteKeys.includes("health"));
  assert.ok(athleteKeys.includes("aerodynamics"));
  assert.ok(!athleteKeys.includes("athletes")); // voce coach
  assert.ok(!athleteKeys.includes("desktop")); // niente "Versione desktop"

  // Coach: account con home mobile reale; i moduli atleta NON sono nella nav globale.
  const coachKeys = getMobileMenuSections("coach").flatMap((s) => s.items.map((i) => i.key));
  assert.ok(coachKeys.includes("athletes"));
  assert.ok(coachKeys.includes("commissioni"));
  assert.ok(!coachKeys.includes("health"));
});

test("stripMobileAppPrefix e toDesktopPath roundtrip", () => {
  assert.equal(stripMobileAppPrefix("/m/training/calendar"), "/training/calendar");
  assert.equal(toDesktopPath("/m/nutrition/diary"), "/nutrition/diary");
  assert.equal(isMobileAppPath("/m/dashboard"), true);
  assert.equal(isMobileAppPath("/dashboard"), false);
});
