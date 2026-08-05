# Nutrition — come funziona oggi

**Data della fotografia:** 5 agosto 2026 · **Metodo:** 14 agenti (7 mappatori + 7 verificatori
avversariali) su repo e DB di produzione, 1.361 chiamate a strumenti. Ogni leva è stata tracciata
dalla UI fino al motore; i verificatori hanno riaperto i file e corretto gli stati sbagliati.
**Dati grezzi:** [`nutrition-leve-mappate.csv`](./nutrition-leve-mappate.csv) — tutte e 295 le leve.

Questo documento descrive **l'esistente**, non una proposta. Serve come termine di paragone
scritto per il ridisegno di Nutrition.

> **Affidabilità.** Dove scrivo «verificato» ho aperto io il file o interrogato io il DB. Dove il
> dato viene solo dagli agenti l'ho segnalato. Tre affermazioni degli agenti sono risultate false
> in verifiche precedenti di questa stessa sessione: prendere il CSV come indizio forte, non come
> vangelo, e ricontrollare prima di cancellare codice.

---

## 1. Il fatto che viene prima di tutti gli altri

**Sul server, la nutrizione non sa chi è l'atleta.**

Quattro `.select()` su `athlete_profiles` chiedono due colonne che **non esistono**:
`ftp_watts` e `lifestyle_activity_class`.

```
apps/web/lib/nutrition/intelligent-meal-plan-route-prep.ts:68   ← il percorso principale
apps/web/lib/nutrition/reintegration-run.ts:33                  ← reintegro post-allenamento
apps/web/lib/nutrition/reduction-run.ts:83                      ← riduzione del giorno
apps/web/lib/nutrition/weekly-tdee-correction.ts:40             ← correzione TDEE settimanale
```

*Verificato da me:* `information_schema.columns` su `athlete_profiles` non contiene nessuna delle
due. `ftp_watts` esiste solo su `physiological_profiles`; `lifestyle_activity_class` non esiste su
nessuna tabella — vive dentro il JSON `routine_config`. In PostgREST nominare una colonna
inesistente fa fallire **l'intera query** con 42703: `data` torna `null`, e il codice a valle fa
`row ?? {}` senza accorgersene.

Le conseguenze, ognuna verificata nel codice:

| dove | cosa succede davvero |
|---|---|
| `route-prep.ts:216-217` | ripiega su **`ftp = 250`** e **`weightKg = 70`** cablati nel codice |
| `route-prep.ts:212` | `dietDay` risolto da `null` → tutti i default: 4 pasti, 100%, split di fabbrica |
| `reconcile-meal-plan-slots-with-diet.ts:52-58` | esce subito e restituisce gli slot **del client** |
| loop adattivo (3 file) | reintegro, riduzione e correzione TDEE partono da un profilo **vuoto** |

Secondo il verificatore la stringa rotta è presente **anche nel bundle live** della Edge Function
`generate-meal-plan` (letto con `get_edge_function`). Non l'ho riconfermato personalmente.

### Perché questo cambia tutto

Il file `reconcile-meal-plan-slots-with-diet.ts` dichiara nei suoi primi commenti che i target
«devono seguire Profile → Diet (DB), non un payload client obsoleto». **È esattamente ciò che oggi
non accade.** L'autorità sui numeri del piano non è il server: è il browser.

Il piano riflette le impostazioni del coach **solo se un browser apre la pagina Nutrizione con
quel profilo caricato** e ricalcola. Dove il browser non c'è — cron notturni, generazione
automatica al D3, loop adattivo — il motore lavora su un atleta di 70 kg con 250 W di soglia.

Questa è la ragione tecnica per cui molte leve risultano **parziali** invece che vive: funzionano
dalla pagina, non funzionano in automatico.

---

## 2. I numeri

**295 leve** mappate e verificate.

| stato | quante | significato |
|---|---:|---|
| **viva** | 103 | il valore arriva al motore e ne cambia l'output |
| **parziale** | 82 | funziona su un ramo solo (quasi sempre: dal browser sì, dal server no) |
| **inerte** | 110 | si può impostare, ma nessuno la legge |

**Più di un terzo delle manopole di Nutrition non fa niente.**

| chi la imposta | viva | parziale | inerte | totale |
|---|---:|---:|---:|---:|
| atleta | 31 | 33 | 37 | **101** |
| sistema | 24 | 17 | 23 | **64** |
| admin | 25 | 10 | 28 | **63** |
| coach | 19 | 16 | 7 | **42** |
| nessuno | 4 | 6 | 15 | **25** |

Le 25 leve «nessuno» sono campi che esistono nei tipi o nel DB e che **nessuna UI** permette di
impostare.

---

## 3. Chi decide cosa, oggi

Questa è la tabella da mettere accanto al documento del modello nuovo: una riga per ogni grandezza
che compone un piano.

| grandezza del piano | chi la decide oggi | come | stato |
|---|---|---|---|
| **kcal del giorno** | sistema (+ atleta) | BMR + lifestyle + allenamento, × `day_type_pct` | viva |
| **segno calorico** (ipo/normo/iper) | **atleta** | `day_type_pct`, numero libero 0-130, per giorno | viva ma **mai usata** |
| **ripartizione macro CHO/PRO/FAT** | **coach** | `daily_macros` per giorno | **viva** |
| **macro del singolo pasto** | **coach** | `meal_macro_custom` | parziale |
| **numero dei pasti** | **atleta** | `meal_count_mode` (3-6, digiuno, 8-16…) | viva |
| **% kcal per pasto** | **coach** | `caloric_distribution` | viva |
| **orari dei pasti** | atleta | `routine_config.week_plan[gg]` | parziale |
| **tipo di giorno** (training/recovery/gara) | atleta | `routine_config.day_mode` | parziale |
| **peso, età, sesso, altezza** | atleta | colonne di `athlete_profiles` | viva |
| **costo energetico dell'allenamento** | **coach** | `planned_workouts.kcal_target` / `tss_target` | **viva** |
| **scelta degli alimenti** | sistema | pool `nutrition_menu_foods` + rotazione | viva |
| **grammature** | sistema | solver porzioni sui target macro dello slot | viva |
| **cosa NON mangia** | atleta | `diet_type` + esclusioni + intolleranze | parziale |
| **idratazione** | sistema | `max(2200, peso × 33)` + extra allenamento | parziale |
| **fueling attorno alla seduta** | sistema | substrati da %FTP, split pre/intra/post | parziale |
| **integratori** | — | `supplement_config` scritto, **mai letto** dal motore | inerte |

Le tre righe in grassetto nella colonna «chi» sono le leve del coach che il modello nuovo vuole
togliere. Due sono vive davvero. La terza — il costo energetico dell'allenamento — **non è dentro
Nutrizione**: è il calendario.

---

## 4. Le leve del coach (42)

Il coach ha **meno manopole di quante sembri**, ma quelle che ha sono le più pesanti.

### Vive, e contano

- **`daily_macros` — i rapporti CHO/PRO/FAT del giorno.** È la manopola citata a voce come «i
  rapporti dei grassi». Converte le kcal di ogni slot in grammi (`carbs = kcal × cho% / 4`,
  `fat = kcal × fat% / 9`), e quei grammi sono **l'unico target** che il solver porzioni insegue
  quando sceglie alimenti e quantità. Toccarla cambia il piano davvero.
- **`caloric_distribution` — quanto pesa la colazione rispetto alla cena.** Primo taglio del
  budget giornaliero.
- **La seduta a calendario** (`planned_workouts.duration_minutes`, `tss_target`, `kcal_target`).
  È la leva coach **più potente sulla nutrizione, e non vive dentro Nutrizione**: la spesa
  energetica entra nel fabbisogno, nella quota pasti e nel fueling. Se il modello nuovo toglie
  manopole al coach dentro Nutrizione ma lascia questa, il coach continua a governare le calorie
  dell'atleta — dal calendario.
- **Peso corporeo** — l'input singolo più pesante: BMR, kcal di ogni pasto, target g/kg, idratazione.

### Parziali (funzionano dalla pagina, non in automatico)

`day_type_pct`, `caloric_distribution`, `daily_macros` e `meal_macro_custom` compaiono **due
volte** in questa mappa: come vive quando il browser ricalcola, come parziali quando il piano lo
genera il server. È la conseguenza diretta della §1.

### Inerti (si impostano, non fanno nulla)

- **`meal_macro_custom`** su un ramo — macro per singolo pasto: 12 campi nella UI.
- **Predictor what-if + «Salva configurazione»** — le chiavi salvate le rilegge solo la pagina
  stessa per ripopolarsi. Sul piano: nulla.
- **`supplement_config`** — 25 atleti su 41 lo hanno valorizzato. Il motore lo **seleziona** nella
  query e non lo usa mai.
- **Approvazione/rifiuto delle azioni (`manual_actions`)** — produce parole chiave di focus, non
  tocca il cibo.
- **`day_type`** (digiuno/severo/catabolico/normocalorico/anabolico) — è solo un'etichetta che
  precompila `day_type_pct`. In produzione esiste già una riga con `day_type='anabolic-101-130'` e
  `day_type_pct=100`: preset e valore reale sono **già scollegati**.

---

## 5. La leva che il modello nuovo cerca esiste già

`day_type_pct` **è** ipo/normo/ipercalorico. Moltiplica il fabbisogno del giorno prima di
ripartirlo sui pasti (`daily-energy-solver.ts:319-336`). Il codice è corretto e funziona.

Ha tre problemi, tutti risolvibili senza scrivere un motore nuovo:

1. **È esposta all'attore sbagliato.** Oggi la muove l'atleta dal proprio profilo. Il modello
   nuovo la vuole al coach.
2. **È un numero libero 0-130** invece di tre scelte.
3. **Non l'ha mai toccata nessuno**: in produzione vale `100` su **tutte e 175** le righe-giorno
   esistenti.

L'ultimo punto è la notizia migliore di tutta la mappa: **oggi ogni atleta della piattaforma è
normocalorico**, perché nessuno ha mai mosso la leva. Portarla al coach come tre bottoni non
cambia nemmeno un piano esistente — non c'è niente da migrare.

---

## 6. Cosa il sistema calcola già da solo

Molto più di quanto sembri. Il problema non è che manchi l'automatismo: è che **una parte finisce
nel vuoto**.

### Funziona

- **Fabbisogno energetico**: BMR (Mifflin, o Katch-McArdle con massa grassa) + lifestyle + allenamento.
- **Calibrazione atletica del BMR** da VO₂max e FTP, +0…+5% — *ma solo nel ramo Mifflin: chi
  inserisce la massa grassa la perde senza saperlo.*
- **TDEE osservato dal device**: quando c'è, il fabbisogno smette di essere stima e diventa
  BMR + kcal attive reali.
- **Fueling da substrati**: RER stimato dal %FTP (0,82 sotto il 60%, fino a 1,02 sopra il 95%),
  grammi di CHO e grassi bruciati, rimpiazzo orale con split pre/intra/post modulato dal recupero.
- **Idratazione**: `max(2200 ml, peso × 33)` + extra allenamento.
- **Giorno gara**: pre-gara e recupero post-gara con composizioni dedicate, orari riscritti,
  spuntini soppressi.
- **Rotazione alimenti**: memoria settimanale per famiglia, penalità sui ripetuti.

### Calcolato e buttato via

- **`functionalFoodGroups`, `foodCandidates`, `functionalTargets`** — costruiti, filtrati due
  volte, **mai letti** dal compositore V2. Sopravvivono solo come testo nelle note.
- **`contextLines`** (diario, twin, recovery, direttive coach, playbook) — nessun compositore li
  legge, e non vengono nemmeno rimessi nella risposta.
- **Il modello `DailyNutritionRequirementsV2` completo** (energia, substrati, fueling, strategia)
  arriva al compositore che lo **scarta**: `compose-meal-plan-v2.ts:378` fa `void requirements` e
  compone solo sui budget di slot.
- **Loop adattivo** (reintegro, riduzione, correzione TDEE settimanale) — costruito, mai
  alimentato: parte dai profili vuoti della §1.

### Due formule per la stessa cosa

Il lifestyle è calcolato **due volte con risultati diversi**: il V1 lo stima come percentuale del
BMR, il V2 come `BMR × (PAL − 1)`. Su `moderate` il V1 dà +20%, il PAL +40% — *stesso atleta,
stesso giorno, numero doppio*. Il codice stampa entrambi affiancati nella provenance
(`daily-nutrition-requirements.ts:168`).

---

## 7. Il cimitero: 110 leve inerti

Raggruppate per tipo, con il motivo:

| gruppo | esempi | perché sono inerti |
|---|---|---|
| **Contesto generato e mai letto** | `contextLines`, `pathwayTimingLines`, `aggregateInhibitors`, `integrationLeverLines`, playbook | il compositore V2 non li consuma |
| **Candidati alimentari V1** | `foodCandidates`, `functionalFoodGroups`, `functionalTargets` | in V2 gli alimenti li sceglie il pool del catalogo |
| **Preset ed etichette** | `day_type`, strategia nutrizionale | scrivono un altro campo, o sono solo testo |
| **Config salvate e mai rilette** | `supplement_config`, predictor/fueling what-if | selezionate e ignorate |
| **Campi fantasma** | `prep_time_minutes`, `cooking_skill`, `home_*` | nessun lettore |
| **Dieta oltre i 4 valori** | paleo, chetogenica, low-FODMAP, carnivora, senza glutine | cadono su `omnivore` senza avviso |

Su `diet_type` il dettaglio conta: dei 10 valori selezionabili **solo 4 fanno qualcosa**
(vegano, vegetariano, pescetariano e l'implicito onnivoro). Gli altri 6 non filtrano nulla, in
silenzio. In produzione: 25 atleti su `omnivore`, 16 a `null`. **Nessuno ha mai scelto un valore
che facesse qualcosa** — quindi la leva oggi è un no-op totale.

---

## 8. Cosa significa per il ridisegno

Tre osservazioni che nascono dai dati, non da un'opinione.

**Il modello nuovo è più vicino di quanto sembri.** «Il coach dice solo ipo/normo/iper» è
`day_type_pct` spostata di attore e ridotta a tre valori: la matematica esiste ed è giusta.
«L'atleta dice solo routine ed esclusioni» conserva `meal_count_mode` e gli orari, che sono già
vivi e già usati (22 atleti su 4 pasti, 6 su 6, 2 su 5). Il grosso del lavoro non è costruire:
è **togliere e spostare**.

**Ma il prerequisito non è nella lista delle leve.** Un sistema «automatico» è un sistema che
decide **sul server**. Oggi il server è cieco: quattro query rotte gli impediscono di leggere il
profilo dell'atleta, e i valori scendono su 70 kg / 250 W. Finché non si aggiusta quello,
qualunque automatismo nuovo nascerà con gli stessi default di fabbrica del loop adattivo — che
infatti è già scritto e già inerte. **Questo va fatto per primo, e vale la pena farlo comunque,
indipendentemente dal ridisegno.**

**La domanda vera da porsi leva per leva.** Per ogni manopola del coach che sparisce, la domanda
non è «si può togliere» ma «chi decide al suo posto». Per il segno calorico la risposta c'è. Per i
rapporti CHO/PRO/FAT — la manopola più viva che il coach abbia — oggi **non c'è nessuna regola nel
motore che li decida**: li decide un umano perché il codice non sa farlo. Togliere quella manopola
significa scrivere quella regola. È lì che sta il lavoro vero, ed è bene saperlo prima.

---

## Appendice — dove vive cosa

| pezzo | percorso |
|---|---|
| Motore V2 | `apps/web/lib/nutrition/v2/` |
| Stesso motore in Edge Function | `supabase/functions/generate-meal-plan/` (bundle separato: **può divergere**) |
| Solver energetico | `apps/web/lib/nutrition/daily-energy-solver.ts`, `v2/daily-nutrition-requirements.ts` |
| Preparazione request | `intelligent-meal-plan-route-prep.ts`, `intelligent-meal-plan-request-builder.ts` |
| Filtro dieta a flag (**quello vero**) | `v2/fdc-staple-registry.ts:477` `filterMenuFoodsByDiet` |
| Filtro dieta a etichette (secondario, obsoleto) | `meal-plan-profile-food-filter.ts` |
| Risoluzione giorno Diet | `resolve-nutrition-diet-day.ts` |
| Loop adattivo | `reintegration-run.ts`, `reduction-run.ts`, `weekly-tdee-correction.ts` |
| Viste | `apps/web/modules/nutrition/` |
| Preferenze atleta | `athlete_profiles.nutrition_config`, `.routine_config`, `.supplement_config` |
| Catalogo alimenti | `nutrition_menu_foods` (+ `nutrition_fdc_foods`, `nutrition_ciqual_foods`) |
