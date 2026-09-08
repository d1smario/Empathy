import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { catalogRowMatchesViryaDistricts } from "@/lib/training/builder/pro2-gym-catalog-plan";
import type { BuilderCatalogExerciseRow } from "@/modules/training/services/training-builder-catalog-api";

function row(partial: Partial<BuilderCatalogExerciseRow>): BuilderCatalogExerciseRow {
  return {
    id: "1",
    name: "Test",
    muscleGroup: "",
    equipment: "",
    equipmentClass: "",
    primaryDistrict: "",
    catalogCategory: "strength_foundation",
    sportTags: [],
    mediaUrl: "",
    movementPattern: "",
    ...partial,
  };
}

describe("catalogRowMatchesViryaDistricts", () => {
  it("matches Italian district labels on primaryDistrict", () => {
    const r = row({ primaryDistrict: "Petto", muscleGroup: "upper" });
    assert.equal(catalogRowMatchesViryaDistricts(r, ["Petto"]), true);
    assert.equal(catalogRowMatchesViryaDistricts(r, ["Gambe"]), false);
  });

  it("allows all rows for full body only selection", () => {
    const r = row({ primaryDistrict: "Gambe" });
    assert.equal(catalogRowMatchesViryaDistricts(r, ["Full body"]), true);
  });

  it("matches any of multiple VIRYA districts", () => {
    const petto = row({ primaryDistrict: "Petto" });
    const gambe = row({ primaryDistrict: "Quadricipiti", muscleGroup: "legs" });
    assert.equal(catalogRowMatchesViryaDistricts(petto, ["Petto", "Gambe"]), true);
    assert.equal(catalogRowMatchesViryaDistricts(gambe, ["Petto", "Gambe"]), true);
  });

  it("matches Gambe label to quadricipiti catalog row", () => {
    const r = row({ primaryDistrict: "Quadricipiti" });
    assert.equal(catalogRowMatchesViryaDistricts(r, ["Gambe"]), true);
  });
});
