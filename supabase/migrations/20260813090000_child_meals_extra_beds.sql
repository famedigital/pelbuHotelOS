-- Child meal rates, booking pax (children / extra beds), property extra-bed sell rate.
-- Expands folio_lines source_type for meal_plan / extra_bed and other desk charges already used in app.

-- ---------------------------------------------------------------------------
-- Meal plans: per-child rate (null = free for children when plan is active)
-- ---------------------------------------------------------------------------
alter table meal_plans
  add column if not exists amount_btn_per_child_night numeric(12, 2)
    check (
      amount_btn_per_child_night is null
      or amount_btn_per_child_night >= 0
    );

comment on column meal_plans.amount_btn_per_child_night is
  'Nu per child per night. Null = no child meal charge (free for kids when plan active). Set a price to charge for children.';

-- ---------------------------------------------------------------------------
-- Bookings: children, extra beds + stay-total snapshot (mirrors meal_plan_amount_btn)
-- ---------------------------------------------------------------------------
alter table bookings
  add column if not exists children int not null default 0
    check (children >= 0),
  add column if not exists extra_beds int not null default 0
    check (extra_beds >= 0 and extra_beds <= 2),
  add column if not exists extra_bed_amount_btn numeric(14, 2) not null default 0
    check (extra_bed_amount_btn >= 0);

comment on column bookings.children is
  'Number of children on the stay (meal child rate × children × nights when priced).';
comment on column bookings.extra_beds is
  'Extra beds sold on booking (0–2). Selling snapshot in extra_bed_amount_btn.';
comment on column bookings.extra_bed_amount_btn is
  'Snapshot of extra-bed add-on total for the stay (rate × qty × nights).';

comment on column bookings.meal_plan_amount_btn is
  'Snapshot of meal-plan add-on for the stay: adult rate × adults × nights + child rate × children × nights (child null → 0).';

-- ---------------------------------------------------------------------------
-- Property policy: sellable extra bed rate
-- ---------------------------------------------------------------------------
alter table property_policies
  add column if not exists extra_bed_rate_btn numeric(12, 2)
    check (extra_bed_rate_btn is null or extra_bed_rate_btn >= 0),
  add column if not exists extra_bed_active boolean not null default false;

comment on column property_policies.extra_bed_rate_btn is
  'Nu per extra bed per night when extra_bed_active. Null/inactive = not sold on book.';
comment on column property_policies.extra_bed_active is
  'When true and rate is set, public/desk booking can sell extra beds.';

-- Seed flagship with inactive extra bed (desk sets real price)
update property_policies pp
set
  extra_bed_rate_btn = coalesce(pp.extra_bed_rate_btn, 800),
  extra_bed_active = coalesce(pp.extra_bed_active, false)
from properties p
where pp.property_id = p.id
  and p.slug = 'pelbu-suites-olakha';

-- ---------------------------------------------------------------------------
-- Folio source types used by desk money paths (meal_plan was missing live)
-- ---------------------------------------------------------------------------
alter table folio_lines drop constraint if exists folio_lines_source_type_check;

alter table folio_lines
  add constraint folio_lines_source_type_check
  check (source_type = any (array[
    'room'::text,
    'order'::text,
    'service'::text,
    'guest_service'::text,
    'payment'::text,
    'adjustment'::text,
    'comp'::text,
    'deposit'::text,
    'meal_plan'::text,
    'extra_bed'::text,
    'cancel_fee'::text,
    'no_show_fee'::text,
    'damage'::text,
    'laundry'::text
  ]));
