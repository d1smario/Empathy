import test from "node:test";
import assert from "node:assert/strict";

import { resolveVo2maxFromEvents } from "./canonical-vo2max";

const METABOLIC = { createdAt: "2026-06-01T10:00:00.000Z", value: 62.61 };
const LAB_NEWER = { createdAt: "2026-07-01T10:00:00.000Z", value: 66 };
const LAB_OLDER = { createdAt: "2026-05-01T10:00:00.000Z", value: 66 };

test("senza laboratorio vince il run metabolico (comportamento storico)", () => {
  assert.equal(resolveVo2maxFromEvents({ metabolic: METABOLIC, lab: null }), 62.61);
});

test("senza run metabolico vince il laboratorio", () => {
  assert.equal(resolveVo2maxFromEvents({ metabolic: null, lab: LAB_NEWER }), 66);
});

test("nessuno dei due → null: il chiamante prosegue su colonna e max_oxidate", () => {
  assert.equal(resolveVo2maxFromEvents({ metabolic: null, lab: null }), null);
});

test("il laboratorio più RECENTE vince sul run metabolico — è il disallineamento che si chiude", () => {
  assert.equal(resolveVo2maxFromEvents({ metabolic: METABOLIC, lab: LAB_NEWER }), 66);
});

test("il laboratorio più VECCHIO non sovrascrive il run metabolico", () => {
  assert.equal(resolveVo2maxFromEvents({ metabolic: METABOLIC, lab: LAB_OLDER }), 62.61);
});

test("a parità di istante resta la fonte storica (run metabolico)", () => {
  assert.equal(
    resolveVo2maxFromEvents({
      metabolic: METABOLIC,
      lab: { createdAt: METABOLIC.createdAt, value: 66 },
    }),
    62.61,
  );
});

test("DELETE del laboratorio (value null) non azzera: si ricade sul run metabolico", () => {
  assert.equal(
    resolveVo2maxFromEvents({ metabolic: METABOLIC, lab: { createdAt: "2026-07-01T10:00:00.000Z", value: null } }),
    62.61,
  );
});

test("DELETE del laboratorio senza run metabolico → null (nessun valore da run)", () => {
  assert.equal(
    resolveVo2maxFromEvents({ metabolic: null, lab: { createdAt: "2026-07-01T10:00:00.000Z", value: null } }),
    null,
  );
});

test("date assenti o illeggibili → si tiene il run metabolico, mai un ordine inventato", () => {
  assert.equal(resolveVo2maxFromEvents({ metabolic: { createdAt: null, value: 62.61 }, lab: LAB_NEWER }), 62.61);
  assert.equal(
    resolveVo2maxFromEvents({ metabolic: METABOLIC, lab: { createdAt: "non-una-data", value: 66 } }),
    62.61,
  );
});

test("run metabolico senza VO₂max + laboratorio valido → vale il laboratorio", () => {
  assert.equal(
    resolveVo2maxFromEvents({ metabolic: { createdAt: "2026-08-01T10:00:00.000Z", value: null }, lab: LAB_OLDER }),
    66,
  );
});
