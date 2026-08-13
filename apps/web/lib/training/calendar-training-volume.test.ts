import test from "node:test";
import assert from "node:assert/strict";
import { addIsoDays } from "@/lib/dates/iso-day-arithmetic";
import {
  CALENDAR_VOLUME_WINDOW_WEEKS,
  observeCalendarTrainingVolume,
  type PlannedWorkoutVolumeRow,
} from "./calendar-training-volume";
import { deriveTrainingWeekParams } from "./generate-training-week-headless";

/**
 * Test PURI (nessun DB) sulla FONTE 3 del volume — le sedute che il coach ha già messo in
 * calendario — e sulla precedenza fra le tre fonti dentro `deriveTrainingWeekParams`.
 *
 * Ancora fissa: giovedì 2026-08-13 → finestra [lun 2026-08-10, lun 2026-09-07).
 * L'ancora è di GIOVEDÌ apposta: serve a dimostrare che le sedute di lunedì e martedì
 * (già passate) contano lo stesso, perché si osservano settimane ISO intere.
 */
const ANCHOR = "2026-08-13";

function row(date: string, duration_minutes: number | null = 90): PlannedWorkoutVolumeRow {
  return { date, duration_minutes };
}

/* ── la finestra ── */

test("finestra: 4 settimane ISO intere a partire dal lunedì dell'ancora", () => {
  const v = observeCalendarTrainingVolume([row("2026-08-10")], ANCHOR);
  assert.ok(v);
  assert.equal(v.windowStart, "2026-08-10");
  assert.equal(v.windowEndExclusive, "2026-09-07");
  assert.equal(CALENDAR_VOLUME_WINDOW_WEEKS, 4);
});

test("le sedute già passate della settimana in corso contano (ancora di giovedì)", () => {
  // Lunedì e martedì sono prima dell'ancora: se contassimo «da oggi in poi» sparirebbero.
  const v = observeCalendarTrainingVolume([row("2026-08-10"), row("2026-08-11"), row("2026-08-15")], ANCHOR);
  assert.equal(v?.daysPerWeek, 3);
});

test("fuori finestra: settimana precedente e quinta settimana ignorate", () => {
  const v = observeCalendarTrainingVolume(
    [row("2026-08-09"), row("2026-09-07"), row("2026-08-12")],
    ANCHOR,
  );
  assert.equal(v?.sessionCount, 1);
  assert.equal(v?.daysPerWeek, 1);
});

test("nessuna seduta nella finestra → null (calendario muto, non «zero allenamenti»)", () => {
  assert.equal(observeCalendarTrainingVolume([], ANCHOR), null);
  assert.equal(observeCalendarTrainingVolume(null, ANCHOR), null);
  assert.equal(observeCalendarTrainingVolume([row("2026-08-09")], ANCHOR), null);
});

/* ── i conteggi ── */

test("due sedute lo stesso giorno contano 1 giorno, non 2", () => {
  const v = observeCalendarTrainingVolume(
    [row("2026-08-12", 60), row("2026-08-12", 45), row("2026-08-14", 80)],
    ANCHOR,
  );
  assert.equal(v?.sessionCount, 3);
  assert.equal(v?.daysPerWeek, 2);
});

test("coach che programma 3 settimane avanti: la finestra le vede tutte", () => {
  const v = observeCalendarTrainingVolume(
    [row("2026-08-24"), row("2026-08-26"), row("2026-08-28"), row("2026-09-01")],
    ANCHOR,
  );
  assert.equal(v?.weeksWithSessions, 2);
  assert.equal(v?.daysPerWeek, 3);
});

test("settimana di scarico: il massimo non viene abbassato dalla settimana leggera", () => {
  const v = observeCalendarTrainingVolume(
    [
      // settimana piena: 5 giorni
      row("2026-08-10"), row("2026-08-11"), row("2026-08-13"), row("2026-08-14"), row("2026-08-16"),
      // scarico: 2 giorni soltanto
      row("2026-08-18"), row("2026-08-20"),
    ],
    ANCHOR,
  );
  assert.equal(v?.daysPerWeek, 5);
  assert.equal(v?.weeksWithSessions, 2);
});

test("durata: massimo osservato, valori nulli o ≤ 0 ignorati", () => {
  const v = observeCalendarTrainingVolume(
    [row("2026-08-10", null), row("2026-08-11", 0), row("2026-08-12", 150), row("2026-08-13", 95)],
    ANCHOR,
  );
  assert.equal(v?.maxSessionMinutes, 150);
  assert.equal(v?.daysPerWeek, 4); // le sedute senza durata restano giorni di allenamento
  // Media SOLO sui giorni con durata utile: (150+95)/2. I due giorni muti non fanno da zeri.
  assert.equal(v?.avgDayMinutes, 123);
});

test("nessuna durata utile su nessuna seduta → maxSessionMinutes e media null", () => {
  const v = observeCalendarTrainingVolume([row("2026-08-10", null), row("2026-08-12", null)], ANCHOR);
  assert.equal(v?.maxSessionMinutes, null);
  assert.equal(v?.avgDayMinutes, null);
  assert.equal(v?.daysPerWeek, 2);
});

test("media per giorno: la doppia seduta somma i minuti, il giorno resta uno", () => {
  const v = observeCalendarTrainingVolume(
    [row("2026-08-12", 60), row("2026-08-12", 45), row("2026-08-14", 105)],
    ANCHOR,
  );
  assert.equal(v?.daysPerWeek, 2);
  assert.equal(v?.maxSessionMinutes, 105); // picco = la SEDUTA più lunga
  assert.equal(v?.avgDayMinutes, 105); // media = (105 + 105) / 2 giorni
});

test("picco e media sono grandezze diverse: un outlier alza il primo, non la seconda", () => {
  // È il caso reale di 1a0a63b8 in miniatura: una seduta lunghissima fra tante corte.
  const v = observeCalendarTrainingVolume(
    [row("2026-08-10", 316), row("2026-08-11", 60), row("2026-08-12", 60), row("2026-08-13", 60)],
    ANCHOR,
  );
  assert.equal(v?.maxSessionMinutes, 316);
  assert.equal(v?.avgDayMinutes, 124); // (316+60+60+60)/4
});

test("righe malformate (data assente o vuota) semplicemente non contano", () => {
  const v = observeCalendarTrainingVolume(
    [{ date: null, duration_minutes: 90 }, { date: "  ", duration_minutes: 90 }, row("2026-08-12")],
    ANCHOR,
  );
  assert.equal(v?.sessionCount, 1);
});

/* ── la legge che combina le tre fonti: il calendario AGGIUNGE, non toglie ── */

const PROFILO_DICHIARATO = { training_days_per_week: 3, training_max_session_minutes: 90 };

test("zero sedute in calendario → si ricade sul profilo dichiarato", () => {
  const d = deriveTrainingWeekParams(PROFILO_DICHIARATO, "2026-08-10", { calendar: null });
  assert.equal(d.sessions, 3);
  assert.equal(d.hoursTarget, 4.5); // 3 × 90′
});

test("il calendario più carico del dichiarato ALZA sessioni e monte-ore", () => {
  const calendario = observeCalendarTrainingVolume(
    [row("2026-08-10", 60), row("2026-08-11", 60), row("2026-08-12", 60),
     row("2026-08-13", 60), row("2026-08-14", 60)],
    "2026-08-10",
  );
  const d = deriveTrainingWeekParams(PROFILO_DICHIARATO, "2026-08-10", { calendar: calendario });
  assert.equal(d.sessions, 5); // il profilo ne dichiarava 3: il fatto del coach vale di più
  assert.equal(d.weeklyTss, 475);
  assert.equal(d.hoursTarget, 5); // 5 × 60′ osservati, contro i 4,5 h dichiarati
});

test("REGRESSIONE: una singola seduta sparsa non fa collassare il regime dell'atleta", () => {
  // Il caso che rendeva pericolosa la fonte 3: questi parametri sono il seed dell'INTERO
  // macrociclo, non della settimana osservata. Una seduta in 4 settimane è indistinguibile
  // da un calendario che il coach non ha ancora finito di compilare.
  const profilo = {
    training_days_per_week: 6,
    training_max_session_minutes: 95,
    routine_config: {
      week_plan: {
        Mon: { has_training: true }, Tue: { has_training: true }, Wed: { has_training: true },
        Thu: { has_training: true }, Fri: { has_training: true }, Sat: { has_training: true },
        Sun: { has_training: false },
      },
    },
  };
  const senza = deriveTrainingWeekParams(profilo, "2026-08-10");
  const calendario = observeCalendarTrainingVolume([row("2026-08-30", 65)], ANCHOR);
  const con = deriveTrainingWeekParams(profilo, "2026-08-10", { calendar: calendario });
  assert.equal(senza.sessions, 6);
  assert.equal(con.sessions, 6, "6 → 1 sarebbe stato il collasso");
  assert.equal(con.weeklyTss, senza.weeklyTss);
  assert.equal(con.hoursTarget, senza.hoursTarget);
});

test("REGRESSIONE: nessun profilo può regredire rispetto al comportamento senza calendario", () => {
  // Proprietà generale della legge «il calendario aggiunge»: qualunque calendario, il
  // risultato è ≥ di quello a calendario muto. Vale su tutte le combinazioni qui sotto.
  const profili = [
    null,
    { training_days_per_week: 1, training_max_session_minutes: 240 },
    { training_days_per_week: 7, training_max_session_minutes: 30 },
    PROFILO_DICHIARATO,
  ];
  const calendari = [
    [row("2026-08-10", 45)],
    [row("2026-08-10", 45), row("2026-08-30", 20)],
    [row("2026-08-10", 300), row("2026-08-11", 300), row("2026-08-12", 300)],
  ];
  for (const p of profili) {
    const base = deriveTrainingWeekParams(p, "2026-08-10");
    for (const righe of calendari) {
      const d = deriveTrainingWeekParams(p, "2026-08-10", {
        calendar: observeCalendarTrainingVolume(righe, ANCHOR),
      });
      assert.ok(d.sessions >= base.sessions, `sessions ${d.sessions} < ${base.sessions}`);
      assert.ok(d.weeklyTss >= base.weeklyTss);
      assert.ok((d.hoursTarget ?? 0) >= (base.hoursTarget ?? 0), `ore ${d.hoursTarget} < ${base.hoursTarget}`);
    }
  }
});

test("il calendario si confronta anche con la routine week_plan (fonte 2)", () => {
  const profilo = {
    ...PROFILO_DICHIARATO,
    routine_config: {
      week_plan: {
        Mon: { has_training: true }, Tue: { has_training: true }, Wed: { has_training: true },
        Thu: { has_training: true }, Fri: { has_training: true }, Sat: { has_training: false },
        Sun: { has_training: false },
      },
    },
  };
  // Senza calendario comanda il week_plan: 5 giorni (il campo aggregato dice 3).
  assert.equal(deriveTrainingWeekParams(profilo, "2026-08-10").sessions, 5);
  // Calendario più magro del week_plan → il week_plan regge (non è prova che siano 4).
  const magro = observeCalendarTrainingVolume(
    [row("2026-08-10"), row("2026-08-11"), row("2026-08-13"), row("2026-08-15")],
    "2026-08-10",
  );
  assert.equal(deriveTrainingWeekParams(profilo, "2026-08-10", { calendar: magro }).sessions, 5);
  // Calendario più carico → vince lui: 6 giorni scritti dal coach sono 6 giorni.
  const carico = observeCalendarTrainingVolume(
    [row("2026-08-10"), row("2026-08-11"), row("2026-08-12"),
     row("2026-08-13"), row("2026-08-14"), row("2026-08-15")],
    "2026-08-10",
  );
  assert.equal(deriveTrainingWeekParams(profilo, "2026-08-10", { calendar: carico }).sessions, 6);
});

test("durata: il TETTO dichiarato resta in piedi anche se il coach scrive sedute più lunghe", () => {
  // L'atleta dice «oltre 90′ non riesco»; il coach gli mette 5 giorni da 213′.
  const calendario = observeCalendarTrainingVolume(
    [row("2026-08-10", 213), row("2026-08-11", 213), row("2026-08-12", 213),
     row("2026-08-13", 213), row("2026-08-14", 213)],
    "2026-08-10",
  );
  const d = deriveTrainingWeekParams(PROFILO_DICHIARATO, "2026-08-10", { calendar: calendario });
  assert.equal(d.sessions, 5); // i GIORNI del coach valgono…
  assert.equal(d.hoursTarget, 7.5); // …ma le ore sono 5 × 90′, non 5 × 213′ (= 17,8 h)
});

test("durata: un calendario più leggero del dichiarato non abbassa il tetto", () => {
  // Costo accettato della legge «solo aggiunge»: 45′ osservati non smentiscono i 240′
  // dichiarati dall'atleta, che restano il suo ripiego finché non li cambia lui.
  const calendario = observeCalendarTrainingVolume([row("2026-08-10", 45)], "2026-08-10");
  const d = deriveTrainingWeekParams(
    { training_days_per_week: 1, training_max_session_minutes: 240 },
    "2026-08-10",
    { calendar: calendario },
  );
  assert.equal(d.sessions, 1);
  assert.equal(d.hoursTarget, 4); // 1 × 240′ dichiarati, non 1 × 45′
});

test("durata: solo calendario (campo profilo vuoto) → media per giorno, clamp a 240′", () => {
  const calendario = observeCalendarTrainingVolume(
    [row("2026-08-10", 300), row("2026-08-12", 120)],
    "2026-08-10",
  );
  const d = deriveTrainingWeekParams({ training_days_per_week: null }, "2026-08-10", {
    calendar: calendario,
  });
  assert.equal(d.sessions, 4); // 2 osservati < 4 di default → resta il default
  assert.equal(d.hoursTarget, 7); // 2 × 210′ (media) = 420′; il picco 300′ avrebbe dato 8 h
});

test("né profilo né calendario: restano i default storici (4 sedute × 75′)", () => {
  const d = deriveTrainingWeekParams(null, "2026-08-10");
  assert.equal(d.sessions, 4);
  assert.equal(d.hoursTarget, 5); // 4 × 75′
  assert.equal(d.weeklyTss, 380);
});

test("il caso dell'atleta 04968274: calendario pieno, due campi di profilo vuoti", () => {
  // Sedute reali lette su prod nella settimana del 2026-08-10 (919′ in totale su 5 giorni).
  const calendario = observeCalendarTrainingVolume(
    [row("2026-08-10", 230), row("2026-08-12", 231), row("2026-08-13", 150), row("2026-08-14", 95), row("2026-08-15", 213)],
    ANCHOR,
  );
  const d = deriveTrainingWeekParams({ goals: ["performance"] }, "2026-08-10", { calendar: calendario });
  assert.equal(d.sessions, 5); // prima erano 4 «di default», ora sono i suoi giorni veri
  // 5 × 184′ (media per giorno) = 920′ ≈ le 15,3 h davvero in calendario.
  // Col picco (231′) sarebbero state 19,3 h: +26% di monte-ore inventato.
  assert.equal(d.hoursTarget, 15.3);
});

test("REGRESSIONE 1a0a63b8: il monte-ore non supera il calendario che deve onorare", () => {
  // Fotografia da prod: 7 giorni, 1125′ programmati, con un outlier da 316′.
  // Il picco clampato a 240′ avrebbe dato 7 × 240′ = 28,0 h contro le 18,8 h reali (+49%),
  // e materialize-week-builder-engine SCALA le durate delle sedute su hoursTarget.
  const minuti = [316, 60, 240, 120, 180, 120, 89];
  const calendario = observeCalendarTrainingVolume(
    minuti.map((m, i) => row(addIsoDays("2026-08-10", i), m)),
    ANCHOR,
  );
  assert.equal(calendario?.daysPerWeek, 7);
  assert.equal(calendario?.maxSessionMinutes, 316);
  const d = deriveTrainingWeekParams({ goals: [] }, "2026-08-10", { calendar: calendario });
  assert.equal(d.sessions, 7);
  const oreVere = minuti.reduce((a, b) => a + b, 0) / 60;
  assert.ok(
    Math.abs((d.hoursTarget ?? 0) - oreVere) <= 0.2,
    `hoursTarget ${d.hoursTarget} lontano dalle ${oreVere.toFixed(1)} h in calendario`,
  );
});

/* ── la settimana più carica, non la media incrociata ── */

test("maxWeeklyMinutes è il totale della settimana più carica, non la somma della finestra", () => {
  const v = observeCalendarTrainingVolume(
    [
      row("2026-08-10", 60),
      row("2026-08-11", 60),
      row("2026-08-17", 180),
      row("2026-08-24", 180),
    ],
    ANCHOR,
  );
  assert.equal(v?.maxWeeklyMinutes, 180); // 08-17 e 08-24 valgono 180 ciascuna; 08-10 vale 120
});

test("doppia seduta nello stesso giorno: i minuti si sommano dentro la settimana", () => {
  const v = observeCalendarTrainingVolume(
    [row("2026-08-10", 60), row("2026-08-10", 45), row("2026-08-12", 30)],
    ANCHOR,
  );
  assert.equal(v?.daysPerWeek, 2);
  assert.equal(v?.maxWeeklyMinutes, 135);
});

test("nessuna durata utile → maxWeeklyMinutes null, si ricade sul dichiarato", () => {
  const v = observeCalendarTrainingVolume([row("2026-08-10", null), row("2026-08-12", null)], ANCHOR);
  assert.equal(v?.maxWeeklyMinutes, null);
  const d = deriveTrainingWeekParams({ goals: [] }, "2026-08-10", { calendar: v });
  assert.equal(d.hoursTarget, 5.0); // 4 sessioni × 75′ di default: identico a calendario muto
});

test("REGRESSIONE prodotto incrociato: settimana fitta + lunghi sparsi non gonfiano il monte-ore", () => {
  // La forma tipica di un coach: dettaglia la settimana vicina (6 giorni da 60′) e mette
  // avanti solo le uscite lunghe (un 180′ in ciascuna delle 3 settimane successive).
  // `daysPerWeek × avgDayMinutes` dava 6 × 100′ = 10,0 h contro le 6,0 h della settimana
  // davvero più carica: +67% su un monte-ore che fa da seme a TUTTE le settimane del macro.
  const righe: PlannedWorkoutVolumeRow[] = [];
  for (let i = 0; i < 6; i += 1) righe.push(row(addIsoDays("2026-08-10", i), 60));
  righe.push(row("2026-08-17", 180), row("2026-08-24", 180), row("2026-08-31", 180));

  const v = observeCalendarTrainingVolume(righe, ANCHOR);
  assert.equal(v?.daysPerWeek, 6);
  assert.equal(v?.avgDayMinutes, 100); // la media di finestra resta 100′: è proprio il tranello
  assert.equal(v?.maxWeeklyMinutes, 360);

  const d = deriveTrainingWeekParams({ goals: [] }, "2026-08-10", { calendar: v });
  assert.equal(d.sessions, 6);
  assert.equal(d.hoursTarget, 6.0, "il monte-ore deve essere la settimana vera, non il prodotto incrociato");
});

test("il tetto dichiarato morde anche sul monte-ore osservato", () => {
  // 5 giorni da 150′ in calendario (750′), ma l'atleta dichiara di non superare i 60′.
  const righe: PlannedWorkoutVolumeRow[] = [];
  for (let i = 0; i < 5; i += 1) righe.push(row(addIsoDays("2026-08-10", i), 150));
  const v = observeCalendarTrainingVolume(righe, ANCHOR);
  assert.equal(v?.maxWeeklyMinutes, 750);

  const d = deriveTrainingWeekParams(
    { goals: [], training_max_session_minutes: 60 },
    "2026-08-10",
    { calendar: v },
  );
  assert.equal(d.sessions, 5);
  assert.equal(d.hoursTarget, 5.0, "5 × 60′, non 750′: il cap dell'atleta resta un cap");
});
