-- Owner/GM schedules agent call campaigns; front desk works items with outcome + remarks.
create table if not exists public.agent_call_tasks (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties (id) on delete cascade,
  title text not null,
  due_date date not null,
  notes text,
  status text not null default 'open'
    check (status = any (array['open'::text, 'done'::text, 'cancelled'::text])),
  created_by_staff_id uuid references public.staff_members (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists agent_call_tasks_property_due_idx
  on public.agent_call_tasks (property_id, due_date, status);

comment on table public.agent_call_tasks is
  'FO call campaigns to agents (migration / reconfirm). Owner/GM create; FO execute.';

create table if not exists public.agent_call_task_items (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.agent_call_tasks (id) on delete cascade,
  property_id uuid not null references public.properties (id) on delete cascade,
  agent_id uuid not null references public.agents (id) on delete cascade,
  company_name_snapshot text not null,
  contact_phone_snapshot text,
  contact_email_snapshot text,
  booking_count int not null default 0,
  rooms_sold int not null default 0,
  sort_order int not null default 0,
  call_status text not null default 'pending'
    check (call_status = any (array['pending'::text, 'completed'::text])),
  outcome text
    check (
      outcome is null
      or outcome = any (array['confirm'::text, 'cancel'::text, 'void'::text])
    ),
  remarks text,
  called_at timestamptz,
  called_by_staff_id uuid references public.staff_members (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (task_id, agent_id)
);

create index if not exists agent_call_task_items_task_status_idx
  on public.agent_call_task_items (task_id, call_status);

create index if not exists agent_call_task_items_property_pending_idx
  on public.agent_call_task_items (property_id, call_status)
  where call_status = 'pending';

comment on table public.agent_call_task_items is
  'Per-agent call line: FO ticks with confirm|cancel|void + remarks.';

alter table public.agent_call_tasks enable row level security;
alter table public.agent_call_task_items enable row level security;

drop policy if exists "service_role full agent_call_tasks" on public.agent_call_tasks;
create policy "service_role full agent_call_tasks" on public.agent_call_tasks
  for all to service_role using (true) with check (true);

drop policy if exists "service_role full agent_call_task_items" on public.agent_call_task_items;
create policy "service_role full agent_call_task_items" on public.agent_call_task_items
  for all to service_role using (true) with check (true);
