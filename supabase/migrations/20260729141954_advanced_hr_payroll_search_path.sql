-- Harden payroll helper functions against search_path injection.
create or replace function set_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace function payroll_guard_finalized_run()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'DELETE' then
    if old.status = 'finalized' then
      raise exception 'Finalized payroll runs are immutable and cannot be deleted.';
    end if;
    return old;
  end if;
  if old.status = 'finalized' and new.status = 'finalized' then
    if new.gross_total_btn is distinct from old.gross_total_btn
      or new.net_total_btn is distinct from old.net_total_btn
      or new.pit_total_btn is distinct from old.pit_total_btn
      or new.employee_pf_total_btn is distinct from old.employee_pf_total_btn
      or new.employer_pf_total_btn is distinct from old.employer_pf_total_btn
      or new.rule_snapshot is distinct from old.rule_snapshot
      or new.headcount is distinct from old.headcount then
      raise exception 'Finalized payroll run totals are immutable.';
    end if;
  end if;
  return new;
end;
$$;

create or replace function payroll_guard_finalized_item()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  run_status text;
begin
  select status into run_status
  from payroll_runs
  where id = coalesce(new.run_id, old.run_id);

  if run_status = 'finalized' then
    if tg_op = 'DELETE' then
      raise exception 'Cannot delete items from a finalized payroll run.';
    end if;
    if new.gross_btn is distinct from old.gross_btn
      or new.net_btn is distinct from old.net_btn
      or new.pit_btn is distinct from old.pit_btn
      or new.employee_pf_btn is distinct from old.employee_pf_btn
      or new.employer_pf_btn is distinct from old.employer_pf_btn
      or new.lines is distinct from old.lines
      or new.inputs is distinct from old.inputs then
      raise exception 'Finalized payslip amounts are immutable.';
    end if;
  end if;
  return coalesce(new, old);
end;
$$;
