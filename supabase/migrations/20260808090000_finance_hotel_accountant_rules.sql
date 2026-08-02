-- Hotel accountant: walk-in POS, agent AR, payroll payout, AP bill/pay posting rules.

insert into accounting_posting_rules (
  property_id, event_type, debit_system_key, credit_system_key, department_code
)
select p.id, v.event_type, v.debit_system_key, v.credit_system_key, v.department_code
from properties p
cross join (
  values
    ('pos.walk_in.cash', 'cash', 'rev_fb', 'FB'),
    ('pos.walk_in.bank', 'bank', 'rev_fb', 'FB'),
    ('pos.walk_in.card', 'card_clearing', 'rev_fb', 'FB'),
    ('folio_line.room.agent', 'ar_agent', 'rev_rooms', 'ROOMS'),
    ('folio_line.order.agent', 'ar_agent', 'rev_fb', 'FB'),
    ('folio_line.service.agent', 'ar_agent', 'rev_spa', 'SPA'),
    ('folio_line.guest_service.agent', 'ar_agent', 'rev_services', 'SVC'),
    ('folio_line.other.agent', 'ar_agent', 'rev_other', 'ADMIN'),
    ('payroll.payout', 'payroll_payable', 'bank', 'ADMIN'),
    ('ap.bill', 'exp_other', 'ap', 'ADMIN'),
    ('ap.pay', 'ap', 'bank', 'ADMIN'),
    ('expense.rent', 'exp_other', 'bank', 'ADMIN'),
    ('folio_line.comp', 'exp_other', 'ar_guest', 'ADMIN')
) as v(event_type, debit_system_key, credit_system_key, department_code)
on conflict (property_id, event_type) do nothing;

-- Keep property seed in sync for new hotels
create or replace function accounting_seed_property(p_property_id uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  fy_id uuid;
  fy_start date;
  fy_end date;
  month_start date;
  i int;
begin
  insert into accounting_departments (property_id, code, name, kind, sort_order)
  values
    (p_property_id, 'ROOMS', 'Rooms', 'rooms', 10),
    (p_property_id, 'FB', 'Food & Beverage', 'fb', 20),
    (p_property_id, 'SPA', 'Spa & Wellness', 'spa', 30),
    (p_property_id, 'SVC', 'Guest Services', 'services', 40),
    (p_property_id, 'ADMIN', 'Administration', 'admin', 50)
  on conflict (property_id, code) do nothing;

  insert into accounting_accounts (
    property_id, code, name, account_type, normal_balance, is_system, system_key
  ) values
    (p_property_id, '1000', 'Cash on Hand', 'asset', 'debit', true, 'cash'),
    (p_property_id, '1010', 'Bank — Operating', 'asset', 'debit', true, 'bank'),
    (p_property_id, '1020', 'Card Clearing', 'asset', 'debit', true, 'card_clearing'),
    (p_property_id, '1100', 'Accounts Receivable — Guests', 'asset', 'debit', true, 'ar_guest'),
    (p_property_id, '1110', 'Accounts Receivable — Agents', 'asset', 'debit', true, 'ar_agent'),
    (p_property_id, '1200', 'Inventory', 'asset', 'debit', true, 'inventory'),
    (p_property_id, '1300', 'GST Input Credit', 'asset', 'debit', true, 'gst_input'),
    (p_property_id, '1500', 'Fixed Assets', 'asset', 'debit', true, 'fixed_assets'),
    (p_property_id, '1510', 'Accumulated Depreciation', 'asset', 'credit', true, 'accum_depr'),
    (p_property_id, '2000', 'Accounts Payable', 'liability', 'credit', true, 'ap'),
    (p_property_id, '2100', 'Guest Deposits', 'liability', 'credit', true, 'deposits'),
    (p_property_id, '2200', 'GST Output Payable', 'liability', 'credit', true, 'gst_output'),
    (p_property_id, '2300', 'Payroll Payable', 'liability', 'credit', true, 'payroll_payable'),
    (p_property_id, '2310', 'PF Payable', 'liability', 'credit', true, 'pf_payable'),
    (p_property_id, '2320', 'PIT Payable', 'liability', 'credit', true, 'pit_payable'),
    (p_property_id, '3000', 'Owner Equity', 'equity', 'credit', true, 'equity'),
    (p_property_id, '3100', 'Retained Earnings', 'equity', 'credit', true, 'retained_earnings'),
    (p_property_id, '3200', 'Opening Balance Equity', 'equity', 'credit', true, 'opening_equity'),
    (p_property_id, '4000', 'Room Revenue', 'revenue', 'credit', true, 'rev_rooms'),
    (p_property_id, '4100', 'F&B Revenue', 'revenue', 'credit', true, 'rev_fb'),
    (p_property_id, '4200', 'Spa Revenue', 'revenue', 'credit', true, 'rev_spa'),
    (p_property_id, '4300', 'Guest Services Revenue', 'revenue', 'credit', true, 'rev_services'),
    (p_property_id, '4400', 'Other Revenue', 'revenue', 'credit', true, 'rev_other'),
    (p_property_id, '5000', 'Cost of Goods Sold', 'cogs', 'debit', true, 'cogs'),
    (p_property_id, '6000', 'Supplies Expense', 'expense', 'debit', true, 'exp_supplies'),
    (p_property_id, '6100', 'Utilities Expense', 'expense', 'debit', true, 'exp_utilities'),
    (p_property_id, '6200', 'Payroll Expense', 'expense', 'debit', true, 'exp_payroll'),
    (p_property_id, '6300', 'Maintenance Expense', 'expense', 'debit', true, 'exp_maintenance'),
    (p_property_id, '6400', 'Marketing Expense', 'expense', 'debit', true, 'exp_marketing'),
    (p_property_id, '6500', 'Tax Expense', 'expense', 'debit', true, 'exp_tax'),
    (p_property_id, '6600', 'Bank Fees', 'expense', 'debit', true, 'exp_bank_fee'),
    (p_property_id, '6700', 'Depreciation Expense', 'expense', 'debit', true, 'exp_depreciation'),
    (p_property_id, '6900', 'Other Expense', 'expense', 'debit', true, 'exp_other')
  on conflict (property_id, code) do nothing;

  insert into accounting_posting_rules (property_id, event_type, debit_system_key, credit_system_key, department_code)
  values
    (p_property_id, 'folio_line.room', 'ar_guest', 'rev_rooms', 'ROOMS'),
    (p_property_id, 'folio_line.order', 'ar_guest', 'rev_fb', 'FB'),
    (p_property_id, 'folio_line.service', 'ar_guest', 'rev_spa', 'SPA'),
    (p_property_id, 'folio_line.guest_service', 'ar_guest', 'rev_services', 'SVC'),
    (p_property_id, 'folio_line.other', 'ar_guest', 'rev_other', 'ADMIN'),
    (p_property_id, 'folio_line.room.agent', 'ar_agent', 'rev_rooms', 'ROOMS'),
    (p_property_id, 'folio_line.order.agent', 'ar_agent', 'rev_fb', 'FB'),
    (p_property_id, 'folio_line.service.agent', 'ar_agent', 'rev_spa', 'SPA'),
    (p_property_id, 'folio_line.guest_service.agent', 'ar_agent', 'rev_services', 'SVC'),
    (p_property_id, 'folio_line.other.agent', 'ar_agent', 'rev_other', 'ADMIN'),
    (p_property_id, 'folio_line.comp', 'exp_other', 'ar_guest', 'ADMIN'),
    (p_property_id, 'payment.cash', 'cash', 'ar_guest', null),
    (p_property_id, 'payment.bank', 'bank', 'ar_guest', null),
    (p_property_id, 'payment.card', 'card_clearing', 'ar_guest', null),
    (p_property_id, 'payment.agent_credit', 'ar_agent', 'ar_guest', null),
    (p_property_id, 'payment.deposit', 'bank', 'deposits', null),
    (p_property_id, 'payment.refund', 'ar_guest', 'bank', null),
    (p_property_id, 'pos.walk_in.cash', 'cash', 'rev_fb', 'FB'),
    (p_property_id, 'pos.walk_in.bank', 'bank', 'rev_fb', 'FB'),
    (p_property_id, 'pos.walk_in.card', 'card_clearing', 'rev_fb', 'FB'),
    (p_property_id, 'expense.supplies', 'exp_supplies', 'bank', 'ADMIN'),
    (p_property_id, 'expense.utilities', 'exp_utilities', 'bank', 'ADMIN'),
    (p_property_id, 'expense.payroll', 'exp_payroll', 'payroll_payable', 'ADMIN'),
    (p_property_id, 'expense.maintenance', 'exp_maintenance', 'bank', 'ADMIN'),
    (p_property_id, 'expense.marketing', 'exp_marketing', 'bank', 'ADMIN'),
    (p_property_id, 'expense.tax', 'exp_tax', 'bank', 'ADMIN'),
    (p_property_id, 'expense.bank_fee', 'exp_bank_fee', 'bank', 'ADMIN'),
    (p_property_id, 'expense.other', 'exp_other', 'bank', 'ADMIN'),
    (p_property_id, 'expense.rent', 'exp_other', 'bank', 'ADMIN'),
    (p_property_id, 'inventory.receive', 'inventory', 'ap', null),
    (p_property_id, 'inventory.issue', 'cogs', 'inventory', 'FB'),
    (p_property_id, 'payroll.finalize', 'exp_payroll', 'payroll_payable', 'ADMIN'),
    (p_property_id, 'payroll.payout', 'payroll_payable', 'bank', 'ADMIN'),
    (p_property_id, 'ap.bill', 'exp_other', 'ap', 'ADMIN'),
    (p_property_id, 'ap.pay', 'ap', 'bank', 'ADMIN')
  on conflict (property_id, event_type) do nothing;

  fy_start := date_trunc('year', current_date)::date;
  fy_end := (fy_start + interval '1 year' - interval '1 day')::date;

  insert into accounting_fiscal_years (property_id, label, starts_on, ends_on)
  values (p_property_id, to_char(fy_start, 'YYYY'), fy_start, fy_end)
  on conflict (property_id, label) do nothing
  returning id into fy_id;

  if fy_id is null then
    select id into fy_id
    from accounting_fiscal_years
    where property_id = p_property_id and label = to_char(fy_start, 'YYYY');
  end if;

  for i in 0..11 loop
    month_start := (fy_start + (i || ' months')::interval)::date;
    insert into accounting_periods (
      property_id, fiscal_year_id, label, period_index, starts_on, ends_on
    ) values (
      p_property_id,
      fy_id,
      to_char(month_start, 'Mon YYYY'),
      i + 1,
      month_start,
      (month_start + interval '1 month' - interval '1 day')::date
    )
    on conflict (property_id, fiscal_year_id, period_index) do nothing;
  end loop;
end;
$$;
