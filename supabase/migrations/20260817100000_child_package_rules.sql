-- Document child meal package rule: blank child rate → auto 50% of adult (ages 6–12);
-- ages under 6 free and not counted as bookings.children.

comment on column meal_plans.amount_btn_per_child_night is
  'Nu per child (ages 6–12) per night. Null = auto 50% of adult meal rate. Set 0 to force free for 6–12. Ages 0–6 are free and must not be entered as children on bookings.';

comment on column bookings.children is
  'Chargeable children ages 6–12 (meal child package × children × nights; blank child plan rate → 50% of adult). Ages 0–6 free — do not count here.';
