-- nutrition_plan · colonne basis_*: il TARGET del motore diventa interrogabile.
--
-- CONTESTO (la trappola). Sulla schermata del Piano convivono piu' "energie
-- della giornata" e nessuna legge le altre. Il target che il motore ha davvero
-- usato viveva finora SOLO dentro response_payload -> 'solverBasis' -> 'slots',
-- quindi non era interrogabile: nessuna query poteva chiedere "quanto avevi
-- deciso di servire?".
-- Peggio: le colonne che si chiamano *_target (kcal_target, carbs_g_target,
-- protein_g_target, fat_g_target) NON contengono il target ma il SERVITO
-- (Sigma dei meal_item del piano: verificato su tutti i 721 piani con voci,
-- zero scarti oltre 3 kcal). Ogni "aderenza" calcolata confrontando i *_target
-- con i meal_item confronta quindi un numero con se stesso.
--
-- Queste colonne basis_* estraggono il target del motore in campi numerici.
-- Da qui in avanti: basis_* = TARGET (cosa il motore voleva servire),
--                   *_target = SERVITO (cosa il motore ha effettivamente messo
--                   nel piatto, nonostante il nome).
-- Sono due cose legittimamente diverse e vanno lette entrambe: la differenza
-- fra le due e' la misura di quanto il motore rispetta i propri budget.
--
-- NULLABLE per scelta: sui piani vecchi senza response_payload il target non e'
-- ricostruibile, e NULL e' la risposta onesta (meglio di uno zero o di una
-- copia del servito, che rimetterebbe in piedi lo stesso equivoco).

alter table public.nutrition_plan
  add column if not exists basis_kcal      numeric,
  add column if not exists basis_carbs_g   numeric,
  add column if not exists basis_protein_g numeric,
  add column if not exists basis_fat_g     numeric,
  add column if not exists basis_source    text;

-- Solo i due valori che il codice sa davvero distinguere.
alter table public.nutrition_plan
  drop constraint if exists nutrition_plan_basis_source_check;

alter table public.nutrition_plan
  add constraint nutrition_plan_basis_source_check
  check (basis_source is null or basis_source in ('day_engine', 'diet_slots'));

comment on column public.nutrition_plan.basis_kcal is
  'TARGET del motore: somma di response_payload->solverBasis->slots[].targetKcal, cioe'' le kcal che il solver si era prefissato di servire. NON confondere con kcal_target che, malgrado il nome, contiene il SERVITO (somma di meal_item.kcal). NULL sui piani senza response_payload: il target non e'' ricostruibile.';

comment on column public.nutrition_plan.basis_carbs_g is
  'TARGET del motore: somma di response_payload->solverBasis->slots[].targetCarbsG. NON confondere con carbs_g_target che, malgrado il nome, contiene il SERVITO (somma di meal_item.carbs_g). NULL sui piani senza response_payload.';

comment on column public.nutrition_plan.basis_protein_g is
  'TARGET del motore: somma di response_payload->solverBasis->slots[].targetProteinG. NON confondere con protein_g_target che, malgrado il nome, contiene il SERVITO (somma di meal_item.protein_g). NULL sui piani senza response_payload.';

comment on column public.nutrition_plan.basis_fat_g is
  'TARGET del motore: somma di response_payload->solverBasis->slots[].targetFatG. NON confondere con fat_g_target che, malgrado il nome, contiene il SERVITO (somma di meal_item.fat_g). NULL sui piani senza response_payload.';

comment on column public.nutrition_plan.basis_source is
  'Come e'' stato costruito il TARGET delle colonne basis_*: ''day_engine'' quando inputs_provenance->day_engine->>applied e'' true (budget calcolato dal motore giornaliero), ''diet_slots'' altrimenti (ripartizione della dieta sugli slot). Solo questi due valori: sono gli unici che il codice sa distinguere. NULL sui piani senza response_payload, dove basis_* sono a loro volta NULL.';

-- Contro-comment sulle colonne *_target: la trappola va segnalata anche dal lato
-- in cui il prossimo lettore ci cade, cioe' leggendo il nome della colonna.
comment on column public.nutrition_plan.kcal_target is
  'ATTENZIONE, il nome mente: contiene il SERVITO, cioe'' la somma di meal_item.kcal del piano, non il target. Il TARGET del motore e'' in basis_kcal.';

comment on column public.nutrition_plan.carbs_g_target is
  'ATTENZIONE, il nome mente: contiene il SERVITO (somma di meal_item.carbs_g), non il target. Il TARGET del motore e'' in basis_carbs_g.';

comment on column public.nutrition_plan.protein_g_target is
  'ATTENZIONE, il nome mente: contiene il SERVITO (somma di meal_item.protein_g), non il target. Il TARGET del motore e'' in basis_protein_g.';

comment on column public.nutrition_plan.fat_g_target is
  'ATTENZIONE, il nome mente: contiene il SERVITO (somma di meal_item.fat_g), non il target. Il TARGET del motore e'' in basis_fat_g.';

-- Backfill dei piani esistenti: basis_* = somma degli slot del payload.
-- Idempotente (riparte solo dalle righe ancora NULL) e volutamente ristretto ai
-- piani che hanno davvero un array di slot: gli altri restano NULL.
update public.nutrition_plan p
set basis_kcal      = b.kcal,
    basis_carbs_g   = b.carbs,
    basis_protein_g = b.protein,
    basis_fat_g     = b.fat,
    basis_source    = case
                        when p.inputs_provenance -> 'day_engine' ->> 'applied' = 'true'
                          then 'day_engine'
                        else 'diet_slots'
                      end
from (
  select np.id,
         round(sum((s.slot ->> 'targetKcal')::numeric), 2)     as kcal,
         round(sum((s.slot ->> 'targetCarbsG')::numeric), 2)   as carbs,
         round(sum((s.slot ->> 'targetProteinG')::numeric), 2) as protein,
         round(sum((s.slot ->> 'targetFatG')::numeric), 2)     as fat
  from public.nutrition_plan np
  cross join lateral jsonb_array_elements(np.response_payload -> 'solverBasis' -> 'slots') s(slot)
  where jsonb_typeof(np.response_payload -> 'solverBasis' -> 'slots') = 'array'
  group by np.id
) b
where b.id = p.id
  and p.basis_kcal is null;
