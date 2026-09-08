-- Polar sonno/nightly-recharge: `external_event_id` era ricavato dalla sola data (`sleep:2026-08-04`).
-- L'indice unico `uq_device_sync_exports_provider_event` è su `(provider, external_event_id)` e NON
-- contiene `athlete_id`: due atleti con la stessa notte si contendevano la stessa riga.
-- Il runner ora scrive `<kind>:<athlete_id>:<data>`; qui si riallineano le righe già scritte,
-- altrimenti resterebbero orfane e congelate alla loro prima versione.
update public.device_sync_exports
set
  external_event_id = split_part(external_event_id, ':', 1) || ':' || athlete_id::text || ':' || split_part(external_event_id, ':', 2),
  external_ref = split_part(external_event_id, ':', 1) || ':' || athlete_id::text || ':' || split_part(external_event_id, ':', 2),
  updated_at = now()
where provider = 'polar'
  and external_event_id ~ '^(sleep|recharge):[0-9]{4}-[0-9]{2}-[0-9]{2}$';
