-- Wave 1 Channel: allow dedicated rates outbox rows (restrictions still carry
-- min_stay / stop_sell; Channex POST /restrictions accepts rate + restrictions).

alter table ari_queue drop constraint if exists ari_queue_kind_check;

alter table ari_queue
  add constraint ari_queue_kind_check
  check (kind = any (array[
    'availability'::text,
    'rates'::text,
    'restrictions'::text,
    'full_sync'::text
  ]));

comment on table ari_queue is
  'Channex ARI outbox: availability, rates, restrictions (min_stay/stop_sell), full_sync placeholders.';
