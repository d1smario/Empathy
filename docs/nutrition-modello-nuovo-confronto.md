# Nutrition — confronto fra sistema attuale e modello nuovo

**Termine di paragone:** [`nutrition-sistema-attuale.md`](./nutrition-sistema-attuale.md) (fotografia
dell'esistente, 295 leve mappate) · [`nutrition-leve-mappate.csv`](./nutrition-leve-mappate.csv).
**Fonte del modello nuovo:** *EMPATHY — Modifiche al generativo Nutrition & Fueling*, v1.0, 4 agosto
2026, più le precisazioni di Mario Rovaletti del 5 agosto.
**Data:** 5 agosto 2026.

Questo documento mette i due modelli uno accanto all'altro. Non è un piano di lavoro: è la base su
cui deciderlo.

---

## 1. Il principio che cambia

| | oggi | modello nuovo |
|---|---|---|
| **chi decide i numeri** | il coach, a mano, per giorno della settimana | il generativo, ogni giorno |
| **cosa dice l'atleta** | dieta, numero pasti, orari, %, macro | **routine** (orari) e **cosa non mangia** |
| **cosa dice il coach** | rapporti macro, distribuzione, target, override | **ipo / normo / ipercalorico** |
| **da cosa nasce il piano** | percentuali salvate in profilo | **consumo energetico della giornata** |

La differenza di fondo: oggi il piano nasce da una configurazione, domani da una misura.

---

## 2. Decisioni già prese (5 agosto)

Queste non sono più in discussione e vanno trattate come vincoli.

| tema | decisione | conseguenza tecnica |
|---|---|---|
| **Formula BMR** | **Katch-McArdle** (`370 + 21,6 × massa magra`) — scelta di Mario | oggi il codice usa Cunningham (`500 + 22 × magra`), che dà l'11% in più. Va cambiata la costante in `daily-energy-solver.ts` |
| **Base della classificazione** | **il consumo stimato**, non il device | il device serve solo alla correzione post-allenamento. Se l'atleta dimentica l'orologio o lo indossa a metà, il piano non ne risente |
| **Confini delle classi** | Recupero `< 1,55` · Leggero `1,55–2,15` · Pesante `≥ 2,15` | chiude le due fasce scoperte, che sui dati veri lasciavano **144 giornate su 909 senza piano** |
| **Quote su massa magra** | sì, non sul peso corporeo | il BMR lo fa già; le quote macro no |
| **Dente di sega dei grassi** | **voluto**, non è una svista | serve ad alternare giornate a spinta glucidica e giornate a prevalenza lipidica per la risposta ormonale |
| **Tetto della classe Pesante** | **4,0** — deciso da Mario il 6 ago | l'interpolazione Pesante corre su `2,15 → 4,0`. Assunzione da esplicitare in codice: sopra 4,0 le quote restano al massimo (clamp), non si estrapolano |
| **Salto al confine 1,55** | **voluto**, nessun margine di stabilità | il confine coincide col passaggio riposo → allenamento: il cambio dei pasti (3 → 4-5) è il comportamento desiderato, non un artefatto da smussare |
| **Validazione** | il coach valida tutto | i protocolli restrittivi passano da lui |
| **Piano = lettura, non ricalcolo** | deciso dal proprietario l'8 ago | la pagina Nutrizione legge SEMPRE il piano persistito dal DB; la generazione è un evento (prima volta, ripianificazione settimanale, azioni esplicite), mai un effetto collaterale dell'apertura. Stessa pagina al mattino e alla sera, e apertura più veloce |

### La tabella di Mario, verificata

Interpolando linearmente dentro le fasce appena decise, su un atleta con 62 kg di massa magra
(BMR Katch = 1.709 kcal), le quote producono questo:

| carico | classe | kcal | PRO g | FAT g | CHO g | **grassi %** | **carbo %** |
|---|---|---:|---:|---:|---:|---:|---:|
| 1,10 × | Recupero | 1.880 | 81 | 81 | 199 | **39%** | 43% |
| 1,50 × | Recupero | 2.564 | 108 | 108 | 280 | 38% | 45% |
| 1,90 × | Leggero | 3.247 | 133 | 106 | 426 | 29% | 54% |
| 2,80 × | Pesante | 4.786 | 188 | 138 | 677 | 26% | 58% |
| 4,00 × | Pesante | 6.837 | 248 | 186 | 1.011 | **24%** | **61%** |

L'alternanza funziona: scarico al 39% di grassi, giornata dura al 61% di carboidrati. Nessun
carboidrato negativo in tutta la fascia. **La regola regge.**

---

## 3. Capitolo per capitolo

| § del documento | cosa esiste già | cosa manca davvero |
|---|---|---|
| **1** togliere «Dieta» | tutte le leve hanno un default; `day_type_pct` vale 100 su tutte e 175 le righe-giorno | **niente da migrare**: nessun piano esistente cambia |
| **2.1** ipo/normo/iper | `day_type_pct` **funziona già** e scala il fabbisogno | spostarla dall'atleta al coach e ridurla a 3 preset |
| **2.2** strategie speciali | nulla | **il pezzo più nuovo** — vedi §4 qui sotto |
| **3** classificazione | consumo e BMR già calcolati | la classe si deduce oggi da una **regex sul testo** delle righe allenamento: va sostituito l'input |
| **4** macro in g/kg | `STRATEGY_TEMPLATES` ha già la struttura `proGPerKg` / `fatGPerKg` / `choMin-MaxGPerKg` | cambiare le costanti, applicarle alla **massa magra**, e **ricollegare l'output** |
| **5** pasti e distribuzione | `meal_count_mode` e `caloric_distribution` vivi e usati; la soppressione degli slot esiste già | l'innesco: oggi sopprime per finestra di allenamento, domani anche per classe |
| **6** librerie alimenti | `MEAL_SLOT_ASSEMBLY` + pool per slot: già così | quasi nulla |
| **7** sequenza decisionale | passi 1-2, 4, 8-10 esistono | passi 3, 6, 7 (classificazione e inversione macro) |
| **8** output | il motore produce già provenance e razionali | esporli nella UI |

### Il modello pasti, come l'ha risolto Mario

> «prima avevamo il numero dei pasti in dieta, adesso lo decide la classe; in profilo si mettono gli
> eventuali orari — colazione alle 7, spuntino alle 10, pranzo alle 13 — e se la classe non prevede
> lo spuntino viene saltato.»

Pulito, e si innesta su un meccanismo che **esiste già**: il motore sopprime gli slot che cadono
nella finestra di allenamento. Cambia solo cosa fa scattare la soppressione.

**Divisione dei ruoli:** la classe decide *quali* slot esistono, la routine decide *a che ora*.

---

## 4. La parte davvero nuova: i regimi

Il §2.2 non è un elenco di varianti: introduce protocolli che **cambiano l'aritmetica**, non solo i
numeri. Il §4 dice che i carboidrati sono il residuo; la chetogenica dice che sono un tetto — e
allora il residuo diventano i grassi.

Un regime deve quindi definire tre cose:

| regime | energia | macro fissati | chi assorbe il residuo |
|---|---|---|---|
| **standard** | consumo × strategia calorica | PRO e FAT dalla classe, g/kg magra, interpolati | **carboidrati** |
| **chetogenica** | 85-90% del fabbisogno | CHO tetto < 50 g · PRO dalla classe | **grassi** |
| **rigenerazione** | quota bassa, in **grammi assoluti** | PRO e CHO bassi, assoluti | **grassi** |

*Work High Carb / Recovery Low Carb* **non è un regime**: è una regola che sceglie fra standard e
chetogenica giorno per giorno secondo la classe. Modellarlo così toglie un pezzo invece di aggiungerlo.

### Perché la rigenerazione va in grammi assoluti

Il protocollo prevede il 20-30% del BMR: per il nostro atleta sono 342-513 kcal. Ma le quote minime
della classe Recupero (PRO 1,2 e FAT 1,2 g/kg di magra) fanno **629 kcal da sole**: i carboidrati
uscirebbero negativi.

Non è solo un problema aritmetico. Il protocollo punta a limitare lo stimolo insulinico e favorire
l'autofagia: lì **le proteine basse sono parte del meccanismo**, non un compromesso. Un pavimento di
1,2 g/kg lavorerebbe contro lo scopo dichiarato del protocollo.

**Come cablarlo.** Il campo `regime` esplicito, con `standard` come default, e la tabella delle
classi che gira **solo dentro `standard`**. Non il contrario. La differenza si vede il giorno in cui
c'è un bug: così un errore fa uscire il piano normale; al contrario farebbe uscire quello
restrittivo. Vale anche un pavimento assoluto in kcal sotto il quale il motore si ferma e chiede
conferma — su un atleta con 40 kg di magra il 20% del BMR fa **247 kcal**, un numero che non ha
scelto nessuno.

---

## 5. I tre blocchi da sistemare prima

Nessuno dei tre è nel documento di Mario, perché sono difetti dell'esistente. Ma tutti e tre
impediscono al modello nuovo di funzionare.

### 5.1 Sul server la nutrizione non sa chi è l'atleta

Cinque `.select()` su `athlete_profiles` chiedono due colonne **che non esistono** — `ftp_watts` e
`lifestyle_activity_class`:

```
intelligent-meal-plan-route-prep.ts:71     ← percorso principale (route Next E Edge Function)
generate-meal-plan-v2-headless.ts:63       ← generazione automatica
reintegration-run.ts:33 · reduction-run.ts:83 · weekly-tdee-correction.ts:40   ← loop adattivo
```

PostgREST risponde `42703` e l'intera query fallisce; il codice fa `?? {}` senza accorgersene. Il
profilo arriva vuoto, `deriveBmr` cade nel ramo proxy, e `computeWeightProxyBmr` senza peso ritorna
`null` → **`bmrKcal = 0`**.

Qualunque regola che divida per il BMR darebbe `Infinity`. Oggi non esplode solo perché
`compose-meal-plan-v2.ts:378` fa `void requirements` e butta via il modello prima che serva.

**È il pavimento del modello nuovo, e va sistemato comunque:** è la ragione per cui il loop adattivo,
già scritto e completo, è inerte.

### 5.2 Due moltiplicatori lifestyle in conflitto

`LIFESTYLE_PCT` nel solver (moderate = +20%) e `PAL_BY_LIFESTYLE` nel V2 (moderate = 1,40), che
ricalcola tutto per conto suo. Sui **834 giorni valutabili la classe cambia nel 50% dei casi** a
seconda di quale si usa.

Finché convivono, metà delle giornate ha due risposte. Il modello nuovo classifica per rapporto
energetico: **il rapporto deve avere una definizione sola.**

### 5.3 Il modello calcolato viene buttato

`compose-meal-plan-v2.ts:378` — `void requirements`. Il compositore riceve energia, substrati,
fueling e strategia, e compone solo sui budget di slot che arrivano dal browser.

Togliere quella riga è il passo che trasforma il motore da «esegue le percentuali ricevute» a
«decide». Senza, tutto il §3 e il §4 girerebbero a vuoto.

---

## 6. Ancora aperto

| punto | perché serve una risposta |
|---|---|
| **Massa grassa mancante** | serve alle quote g/kg. Sui 29 atleti attivi, **15 ce l'hanno**; 8 hanno il peso ma non la composizione. Va resa obbligatoria in onboarding, o si definisce il ripiego |
| **Confine fueling / pasti** | nel modello di Mario una fetta dei carboidrati va nel fueling (430 g su 778 nel suo esempio). Oggi il fueling si calcola dai substrati bruciati: sono due strade allo stesso numero, da riconciliare per non contarlo due volte |
| **Riduzione di 0,1-0,2 g/kg** | proposta di Mario, perché il fueling fa anche recovery. Da quantificare |

---

## 7. Ordine dei lavori proposto

1. **Il pavimento** — le cinque `.select()`, il conflitto lifestyle, `void requirements`. Dovuto a
   prescindere dal ridisegno: senza, il loop adattivo resta inerte e ogni automatismo nuovo nasce
   cieco.
2. **La taratura** — Katch-McArdle al posto di Cunningham, quote sulla massa magra, confini contigui.
3. **Il generativo** — classificazione per rapporto energetico, quote interpolate, carboidrati
   residui. È qui che il documento di Mario diventa codice.
4. **I regimi** — standard, chetogenica, rigenerazione, con il gate di validazione.
5. **La UI** — via «Dieta», dentro «Strategia nutrizionale», leva calorica al coach.

Il grosso dei passi 2 e 3 non è costruzione: è **ricollegare e ritarare** cose che esistono già.
Il lavoro vero, nel senso di codice nuovo, sono i regimi del passo 4.
