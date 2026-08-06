-- Health contribution (HC) as % of basic salary.
-- amount column kept as cached Nu for display/legacy; payroll prefers pct × basic.

alter table staff_private_profiles
  add column if not exists health_contribution_pct numeric(5, 2)
    check (
      health_contribution_pct is null
      or (
        health_contribution_pct >= 0
        and health_contribution_pct <= 100
      )
    );

comment on column staff_private_profiles.health_contribution_pct is
  'Monthly health contribution rate as percent of base_wage_btn (0–100). Source of truth for HC; Nu amount recalculated on save and at payroll.';

comment on column staff_private_profiles.health_contribution_btn is
  'Cached monthly HC deduction in Nu (= base_wage_btn × health_contribution_pct / 100 when pct is set).';

-- Reverse-fill pct from existing fixed Nu where basic exists.
update staff_private_profiles
set health_contribution_pct = round(
  (health_contribution_btn / nullif(base_wage_btn, 0)) * 100,
  2
)
where health_contribution_pct is null
  and health_contribution_btn is not null
  and health_contribution_btn > 0
  and base_wage_btn is not null
  and base_wage_btn > 0;
