-- Supervisors see only direct reports; HR/payroll/owners retain property scope.

drop policy if exists "employee read own leave" on staff_leave;
create policy "employee read own leave" on staff_leave
  for select to authenticated
  using (
    staff_id = (select private.current_staff_id())
    or (
      property_id = (select private.current_staff_property_id())
      and (select private.current_staff_access_level()) in
        ('hr_admin', 'payroll_admin', 'owner')
    )
    or (
      property_id = (select private.current_staff_property_id())
      and (select private.current_staff_access_level()) = 'supervisor'
      and exists (
        select 1
        from staff_members team_member
        where team_member.id = staff_leave.staff_id
          and team_member.manager_id = (select private.current_staff_id())
      )
    )
  );

drop policy if exists "staff read own leave attachments" on hr_leave_attachments;
create policy "staff read own leave attachments" on hr_leave_attachments
  for select to authenticated
  using (
    staff_id = (select private.current_staff_id())
    or (
      property_id = (select private.current_staff_property_id())
      and (select private.current_staff_access_level()) in
        ('hr_admin', 'payroll_admin', 'owner')
    )
    or (
      property_id = (select private.current_staff_property_id())
      and (select private.current_staff_access_level()) = 'supervisor'
      and exists (
        select 1
        from staff_members team_member
        where team_member.id = hr_leave_attachments.staff_id
          and team_member.manager_id = (select private.current_staff_id())
      )
    )
  );

drop policy if exists "staff read own leave ledger" on hr_leave_ledger;
create policy "staff read own leave ledger" on hr_leave_ledger
  for select to authenticated
  using (
    staff_id = (select private.current_staff_id())
    or (
      property_id = (select private.current_staff_property_id())
      and (select private.current_staff_access_level()) in
        ('hr_admin', 'payroll_admin', 'owner')
    )
    or (
      property_id = (select private.current_staff_property_id())
      and (select private.current_staff_access_level()) = 'supervisor'
      and exists (
        select 1
        from staff_members team_member
        where team_member.id = hr_leave_ledger.staff_id
          and team_member.manager_id = (select private.current_staff_id())
      )
    )
  );

drop policy if exists "staff read own leave balances" on hr_leave_balances;
create policy "staff read own leave balances" on hr_leave_balances
  for select to authenticated
  using (
    staff_id = (select private.current_staff_id())
    or (
      property_id = (select private.current_staff_property_id())
      and (select private.current_staff_access_level()) in
        ('hr_admin', 'payroll_admin', 'owner')
    )
    or (
      property_id = (select private.current_staff_property_id())
      and (select private.current_staff_access_level()) = 'supervisor'
      and exists (
        select 1
        from staff_members team_member
        where team_member.id = hr_leave_balances.staff_id
          and team_member.manager_id = (select private.current_staff_id())
      )
    )
  );
