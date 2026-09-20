-- Sell-ready POS: per-head set meals + ticket-level GST on/off.

alter table properties
  add column if not exists gst_default_on boolean not null default true;

comment on column properties.gst_default_on is
  'When true, new POS tickets apply GST by default. Staff can still switch GST off per bill.';

alter table orders
  add column if not exists gst_applied boolean not null default true,
  add column if not exists gst_reason text;

comment on column orders.gst_applied is
  'Ticket-level GST switch. False zeros gst_btn even when line items are GST-flagged.';
comment on column orders.gst_reason is
  'Audit note when GST is waived on a POS ticket.';

create table if not exists pos_set_meals (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  outlet text,
  name text not null,
  price_btn numeric(12,2) not null check (price_btn >= 0),
  gst_applicable boolean not null default true,
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table pos_set_meals is
  'Per-head set meal offers for POS (Lunch 600 / 650). Charged as covers × price plus a la carte dishes.';

create index if not exists pos_set_meals_property_idx
  on pos_set_meals (property_id, is_active, sort_order);

alter table pos_set_meals enable row level security;

drop policy if exists "service_role full pos_set_meals" on pos_set_meals;
create policy "service_role full pos_set_meals" on pos_set_meals
  for all to service_role using (true) with check (true);

alter table order_items
  add column if not exists line_kind text not null default 'item';

alter table order_items
  drop constraint if exists order_items_line_kind_check;
alter table order_items
  add constraint order_items_line_kind_check
  check (line_kind = any (array['item'::text, 'set_meal'::text]));

alter table order_items
  add column if not exists set_meal_id uuid references pos_set_meals(id) on delete set null;

comment on column order_items.line_kind is
  'item = catalog dish; set_meal = per-head meal offer (qty = covers).';

insert into pos_set_meals (
  property_id, outlet, name, price_btn, gst_applicable, is_active, sort_order
)
select p.id, 'restaurant', v.name, v.price_btn, true, true, v.sort_order
from properties p
cross join (
  values
    ('Lunch 600', 600::numeric, 10),
    ('Lunch 650', 650::numeric, 20)
) as v(name, price_btn, sort_order)
where p.slug = 'pelbu-suites-olakha'
  and not exists (
    select 1
    from pos_set_meals s
    where s.property_id = p.id
      and s.name = v.name
  );
