-- Hotel business date — advances when night audit completes for a day.
alter table properties
  add column if not exists current_business_date date;

comment on column properties.current_business_date is
  'Open hotel business day (YYYY-MM-DD, property timezone). Night audit for prior day advances this.';

-- Seed existing properties to today (Asia/Thimphu calendar date at migration time).
update properties
set current_business_date = (timezone('Asia/Thimphu', now()))::date
where current_business_date is null;

alter table properties
  alter column current_business_date set default (timezone('Asia/Thimphu', now()))::date;
