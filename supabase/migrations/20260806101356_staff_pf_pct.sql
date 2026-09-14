-- Per-staff NPPF rates as % of basic salary (like HC).
-- NULL = inherit property payroll_rule_sets (default 5% + 5%).

alter table staff_private_profiles
  add column if not exists pf_employee_pct numeric(5, 2)
    check (
      pf_employee_pct is null
      or (pf_employee_pct >= 0 and pf_employee_pct <= 100)
    ),
  add column if not exists pf_employer_pct numeric(5, 2)
    check (
      pf_employer_pct is null
      or (pf_employer_pct >= 0 and pf_employer_pct <= 100)
    );

comment on column staff_private_profiles.pf_employee_pct is
  'Employee NPPF contribution as percent of base_wage_btn (0–100). NULL = use property payroll_rule_sets.pf_employee_rate.';

comment on column staff_private_profiles.pf_employer_pct is
  'Employer NPPF contribution as percent of base_wage_btn (0–100). NULL = use property payroll_rule_sets.pf_employer_rate.';
