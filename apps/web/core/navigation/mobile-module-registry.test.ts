import { test } from "node:test";
import assert from "node:assert/strict";
import {
  getMobileBottomNav,
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

test("nav per ruolo: coach = account-nav, atleta = moduli", () => {
  const coachKeys = getMobileBottomNav("coach").map((i) => i.key);
  assert.ok(coachKeys.includes("athletes"));
  assert.ok(coachKeys.includes("commissioni"));
  assert.ok(!coachKeys.includes("today"));

  const athleteKeys = getMobileBottomNav("private").map((i) => i.key);
  assert.ok(athleteKeys.includes("today"));
  assert.ok(!athleteKeys.includes("athletes"));

  // Drawer coach: voci account, NON le schede modulo atleta (vivono nella barra contestuale).
  const coachDrawerKeys = getMobileMenuSections("coach").flatMap((s) => s.items.map((i) => i.key));
  assert.ok(coachDrawerKeys.includes("athletes"));
  assert.ok(!coachDrawerKeys.includes("health"));
});

test("stripMobileAppPrefix e toDesktopPath roundtrip", () => {
  assert.equal(stripMobileAppPrefix("/m/training/calendar"), "/training/calendar");
  assert.equal(toDesktopPath("/m/nutrition/diary"), "/nutrition/diary");
  assert.equal(isMobileAppPath("/m/dashboard"), true);
  assert.equal(isMobileAppPath("/dashboard"), false);
});
