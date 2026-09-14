-- Party FO: defer SDF/docs at bulk check-in; group document vault.
alter table public.booking_groups
  add column if not exists docs_deferred boolean not null default false;

create table if not exists public.booking_group_documents (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.booking_groups (id) on delete cascade,
  property_id uuid not null references public.properties (id) on delete cascade,
  kind text not null
    check (kind = any (array[
      'sdf_pack'::text,
      'voucher'::text,
      'reg'::text,
      'other'::text
    ])),
  title text,
  storage_public_id text,
  file_url text,
  notes text,
  uploaded_by uuid,
  created_at timestamptz not null default now()
);

create index if not exists booking_group_documents_group_idx
  on public.booking_group_documents (group_id, created_at desc);

alter table public.booking_group_documents enable row level security;

-- Desk uses service role / admin client; keep RLS on for anon denial.
drop policy if exists booking_group_documents_deny_anon on public.booking_group_documents;
create policy booking_group_documents_deny_anon
  on public.booking_group_documents
  for all
  to anon, authenticated
  using (false)
  with check (false);
