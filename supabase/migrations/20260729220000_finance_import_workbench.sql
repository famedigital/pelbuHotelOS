-- Finance Import Workbench: private storage, parser scripts, import batches,
-- staged rows, expense attachments, and atomic commit RPCs.

-- ---------------------------------------------------------------------------
-- Storage bucket (private finance documents)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'finance-private',
  'finance-private',
  false,
  26214400, -- 25 MB
  array[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'text/x-python',
    'application/x-python-code',
    'text/plain'
  ]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Service-role only access to finance-private objects
drop policy if exists "service_role finance-private" on storage.objects;
create policy "service_role finance-private" on storage.objects
  for all to service_role
  using (bucket_id = 'finance-private')
  with check (bucket_id = 'finance-private');

-- ---------------------------------------------------------------------------
-- Parser scripts (logical) + immutable versions
-- ---------------------------------------------------------------------------
create table if not exists finance_parser_scripts (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  kind text not null check (kind = any (array['receipt'::text, 'bank'::text])),
  bank_code text check (
    bank_code is null
    or bank_code = any (array['bob'::text, 'bnb'::text, 'tbank'::text, 'drukpnb'::text, 'other'::text])
  ),
  name text not null,
  description text,
  is_builtin boolean not null default false,
  default_for_kind boolean not null default false,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint finance_parser_bank_kind check (
    (kind = 'bank' and bank_code is not null)
    or (kind = 'receipt' and bank_code is null)
  )
);

create unique index if not exists finance_parser_scripts_name_uidx
  on finance_parser_scripts (property_id, kind, coalesce(bank_code, ''), name);

create index if not exists finance_parser_scripts_property_idx
  on finance_parser_scripts (property_id, kind, bank_code);

alter table finance_parser_scripts enable row level security;
drop policy if exists "service_role full finance_parser_scripts" on finance_parser_scripts;
create policy "service_role full finance_parser_scripts" on finance_parser_scripts
  for all to service_role using (true) with check (true);

create table if not exists finance_parser_versions (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  script_id uuid not null references finance_parser_scripts(id) on delete cascade,
  version_label text not null,
  version_no int not null check (version_no > 0),
  sha256 text not null,
  storage_path text not null,
  file_name text not null,
  byte_size int not null check (byte_size > 0),
  requires_gemini boolean not null default false,
  gemini_model text,
  contract_kind text not null default 'table_v1'
    check (contract_kind = any (array['table_v1'::text])),
  requirements jsonb not null default '[]'::jsonb,
  status text not null default 'draft'
    check (status = any (array[
      'draft'::text,
      'tested'::text,
      'approved'::text,
      'retired'::text
    ])),
  test_result jsonb,
  tested_at timestamptz,
  approved_at timestamptz,
  approved_by text,
  retired_at timestamptz,
  notes text,
  created_by text,
  created_at timestamptz not null default now(),
  unique (script_id, version_no),
  unique (script_id, sha256)
);

create index if not exists finance_parser_versions_status_idx
  on finance_parser_versions (property_id, status, created_at desc);

alter table finance_parser_versions enable row level security;
drop policy if exists "service_role full finance_parser_versions" on finance_parser_versions;
create policy "service_role full finance_parser_versions" on finance_parser_versions
  for all to service_role using (true) with check (true);

-- Property defaults: which approved version to use for receipt / bank
create table if not exists finance_parser_defaults (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  kind text not null check (kind = any (array['receipt'::text, 'bank'::text])),
  bank_code text,
  script_id uuid not null references finance_parser_scripts(id) on delete cascade,
  version_id uuid not null references finance_parser_versions(id) on delete cascade,
  updated_at timestamptz not null default now()
);

create unique index if not exists finance_parser_defaults_uidx
  on finance_parser_defaults (property_id, kind, coalesce(bank_code, ''));

alter table finance_parser_defaults enable row level security;
drop policy if exists "service_role full finance_parser_defaults" on finance_parser_defaults;
create policy "service_role full finance_parser_defaults" on finance_parser_defaults
  for all to service_role using (true) with check (true);

-- ---------------------------------------------------------------------------
-- Import batches
-- ---------------------------------------------------------------------------
create table if not exists finance_import_batches (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  kind text not null check (kind = any (array['receipt'::text, 'bank'::text])),
  bank_code text,
  account_label text,
  source_filename text not null,
  source_mime text not null,
  source_sha256 text not null,
  source_storage_path text not null,
  source_byte_size int not null check (source_byte_size > 0),
  parser_script_id uuid references finance_parser_scripts(id) on delete set null,
  parser_version_id uuid references finance_parser_versions(id) on delete set null,
  parser_sha256 text,
  parser_label text,
  status text not null default 'uploaded'
    check (status = any (array[
      'uploaded'::text,
      'queued'::text,
      'processing'::text,
      'review'::text,
      'committed'::text,
      'error'::text,
      'cancelled'::text
    ])),
  gemini_model text,
  worker_id text,
  attempt_count int not null default 0,
  max_attempts int not null default 3,
  error_message text,
  logs text,
  raw_output_path text,
  raw_output jsonb,
  row_count int not null default 0,
  selected_count int not null default 0,
  committed_count int not null default 0,
  totals jsonb not null default '{}'::jsonb,
  bank_statement_id uuid references bank_statements(id) on delete set null,
  claimed_at timestamptz,
  started_at timestamptz,
  finished_at timestamptz,
  committed_at timestamptz,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists finance_import_batches_sha_uidx
  on finance_import_batches (property_id, kind, source_sha256)
  where status <> 'cancelled';

create index if not exists finance_import_batches_queue_idx
  on finance_import_batches (status, created_at)
  where status in ('queued', 'processing');

create index if not exists finance_import_batches_property_idx
  on finance_import_batches (property_id, kind, created_at desc);

alter table finance_import_batches enable row level security;
drop policy if exists "service_role full finance_import_batches" on finance_import_batches;
create policy "service_role full finance_import_batches" on finance_import_batches
  for all to service_role using (true) with check (true);

-- ---------------------------------------------------------------------------
-- Staged receipt rows
-- ---------------------------------------------------------------------------
create table if not exists finance_staged_receipt_rows (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  batch_id uuid not null references finance_import_batches(id) on delete cascade,
  row_no int not null check (row_no > 0),
  selected boolean not null default true,
  bill_no text,
  vendor text,
  tpn text,
  expense_date date,
  category text,
  description text,
  payment_method text default 'bank',
  amount_btn numeric(14,2) not null default 0 check (amount_btn >= 0),
  gst_btn numeric(14,2) not null default 0 check (gst_btn >= 0),
  net_btn numeric(14,2) not null default 0 check (net_btn >= 0),
  currency text not null default 'BTN',
  page_no int,
  confidence numeric(5,4),
  warnings jsonb not null default '[]'::jsonb,
  raw jsonb not null default '{}'::jsonb,
  is_duplicate boolean not null default false,
  duplicate_of uuid references finance_staged_receipt_rows(id) on delete set null,
  validation_errors jsonb not null default '[]'::jsonb,
  expense_id uuid references expenses(id) on delete set null,
  attachment_storage_path text,
  edited_by text,
  edited_at timestamptz,
  created_at timestamptz not null default now(),
  unique (batch_id, row_no)
);

create index if not exists finance_staged_receipt_rows_batch_idx
  on finance_staged_receipt_rows (batch_id, selected, row_no);

alter table finance_staged_receipt_rows enable row level security;
drop policy if exists "service_role full finance_staged_receipt_rows" on finance_staged_receipt_rows;
create policy "service_role full finance_staged_receipt_rows" on finance_staged_receipt_rows
  for all to service_role using (true) with check (true);

-- ---------------------------------------------------------------------------
-- Staged bank rows
-- ---------------------------------------------------------------------------
create table if not exists finance_staged_bank_rows (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  batch_id uuid not null references finance_import_batches(id) on delete cascade,
  row_no int not null check (row_no > 0),
  selected boolean not null default true,
  txn_date date,
  value_date date,
  description text,
  debit_btn numeric(14,2) not null default 0 check (debit_btn >= 0),
  credit_btn numeric(14,2) not null default 0 check (credit_btn >= 0),
  balance_btn numeric(14,2),
  reference text,
  account_no text,
  payment_mode text,
  category text,
  merchant text,
  fingerprint text,
  confidence numeric(5,4),
  warnings jsonb not null default '[]'::jsonb,
  raw jsonb not null default '{}'::jsonb,
  is_duplicate boolean not null default false,
  validation_errors jsonb not null default '[]'::jsonb,
  bank_transaction_id uuid references bank_transactions(id) on delete set null,
  edited_by text,
  edited_at timestamptz,
  created_at timestamptz not null default now(),
  unique (batch_id, row_no),
  constraint finance_staged_bank_amount_xor check (
    (debit_btn > 0 and credit_btn = 0)
    or (credit_btn > 0 and debit_btn = 0)
    or (debit_btn = 0 and credit_btn = 0)
  )
);

create index if not exists finance_staged_bank_rows_batch_idx
  on finance_staged_bank_rows (batch_id, selected, row_no);

alter table finance_staged_bank_rows enable row level security;
drop policy if exists "service_role full finance_staged_bank_rows" on finance_staged_bank_rows;
create policy "service_role full finance_staged_bank_rows" on finance_staged_bank_rows
  for all to service_role using (true) with check (true);

-- ---------------------------------------------------------------------------
-- Expense attachments (camera / upload / PDF page)
-- ---------------------------------------------------------------------------
create table if not exists expense_attachments (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  expense_id uuid references expenses(id) on delete cascade,
  batch_id uuid references finance_import_batches(id) on delete set null,
  staged_row_id uuid references finance_staged_receipt_rows(id) on delete set null,
  storage_path text not null,
  file_name text not null,
  mime_type text not null,
  byte_size int not null check (byte_size > 0),
  sha256 text not null,
  page_no int,
  sort_order int not null default 0,
  created_by text,
  created_at timestamptz not null default now()
);

create index if not exists expense_attachments_expense_idx
  on expense_attachments (expense_id, sort_order);
create index if not exists expense_attachments_sha_idx
  on expense_attachments (property_id, sha256);

alter table expense_attachments enable row level security;
drop policy if exists "service_role full expense_attachments" on expense_attachments;
create policy "service_role full expense_attachments" on expense_attachments
  for all to service_role using (true) with check (true);

-- Extra expense fields for spreadsheet workbench
alter table expenses
  add column if not exists tpn text,
  add column if not exists bill_no text,
  add column if not exists gross_btn numeric(14,2),
  add column if not exists import_batch_id uuid references finance_import_batches(id) on delete set null;

alter table bank_statements
  add column if not exists storage_path text,
  add column if not exists parser_version_id uuid references finance_parser_versions(id) on delete set null,
  add column if not exists import_batch_id uuid references finance_import_batches(id) on delete set null;

-- ---------------------------------------------------------------------------
-- Queue: claim next batch for worker
-- ---------------------------------------------------------------------------
create or replace function finance_claim_import_batch(
  p_worker_id text,
  p_kinds text[] default array['receipt', 'bank']
)
returns finance_import_batches
language plpgsql
security definer
set search_path = public
as $$
declare
  claimed finance_import_batches;
begin
  if coalesce(trim(p_worker_id), '') = '' then
    raise exception 'worker_id required';
  end if;

  update finance_import_batches b
  set
    status = 'processing',
    worker_id = p_worker_id,
    claimed_at = now(),
    started_at = coalesce(b.started_at, now()),
    attempt_count = b.attempt_count + 1,
    updated_at = now()
  where b.id = (
    select id
    from finance_import_batches
    where status = 'queued'
      and kind = any (p_kinds)
      and attempt_count < max_attempts
    order by created_at
    for update skip locked
    limit 1
  )
  returning * into claimed;

  return claimed;
end;
$$;

revoke all on function finance_claim_import_batch(text, text[]) from public, anon, authenticated;
grant execute on function finance_claim_import_batch(text, text[]) to service_role;

-- ---------------------------------------------------------------------------
-- Atomic commit: selected staged receipt rows → expenses (+ attachments)
-- Ledger posting remains in application layer after this RPC succeeds.
-- ---------------------------------------------------------------------------
create or replace function finance_commit_receipt_batch(
  p_batch_id uuid,
  p_property_id uuid,
  p_as_draft boolean default false,
  p_actor text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  batch finance_import_batches;
  r finance_staged_receipt_rows;
  new_expense_id uuid;
  committed int := 0;
  expense_ids uuid[] := array[]::uuid[];
  cat text;
  pay text;
  amt numeric(14,2);
  gst numeric(14,2);
  net numeric(14,2);
begin
  select * into batch
  from finance_import_batches
  where id = p_batch_id and property_id = p_property_id
  for update;

  if not found then
    raise exception 'Batch not found';
  end if;
  if batch.kind <> 'receipt' then
    raise exception 'Batch is not a receipt import';
  end if;
  if batch.status = 'committed' then
    return jsonb_build_object(
      'ok', true,
      'idempotent', true,
      'committed_count', batch.committed_count,
      'expense_ids', '[]'::jsonb
    );
  end if;
  if batch.status <> 'review' then
    raise exception 'Batch must be in review status (got %)', batch.status;
  end if;

  for r in
    select *
    from finance_staged_receipt_rows
    where batch_id = p_batch_id
      and property_id = p_property_id
      and selected = true
      and expense_id is null
    order by row_no
    for update
  loop
    if r.expense_date is null then
      raise exception 'Row % missing expense date', r.row_no;
    end if;

    amt := coalesce(nullif(r.amount_btn, 0), r.net_btn + r.gst_btn, 0);
    if amt <= 0 then
      raise exception 'Row % amount must be positive', r.row_no;
    end if;

    gst := coalesce(r.gst_btn, 0);
    net := coalesce(nullif(r.net_btn, 0), amt - gst);
    cat := lower(coalesce(nullif(trim(r.category), ''), 'other'));
    if cat not in ('supplies','utilities','payroll','maintenance','marketing','tax','bank_fee','other') then
      cat := 'other';
    end if;
    pay := lower(coalesce(nullif(trim(r.payment_method), ''), 'bank'));
    if pay not in ('cash','bank','card') then
      pay := 'bank';
    end if;

    insert into expenses (
      property_id,
      category,
      description,
      amount_btn,
      gst_btn,
      expense_date,
      vendor,
      payment_method,
      reference,
      notes,
      tpn,
      bill_no,
      gross_btn,
      import_batch_id,
      status
    ) values (
      p_property_id,
      cat,
      coalesce(nullif(trim(r.description), ''), coalesce(r.vendor, 'Receipt') || ' expense'),
      round(amt, 2),
      round(gst, 2),
      r.expense_date,
      nullif(trim(r.vendor), ''),
      pay,
      nullif(trim(r.bill_no), ''),
      case
        when jsonb_array_length(coalesce(r.warnings, '[]'::jsonb)) > 0
          then left(r.warnings::text, 500)
        else null
      end,
      nullif(trim(r.tpn), ''),
      nullif(trim(r.bill_no), ''),
      round(amt, 2),
      p_batch_id,
      case when p_as_draft then 'draft' else 'posted' end
    )
    returning id into new_expense_id;

    update finance_staged_receipt_rows
    set expense_id = new_expense_id, edited_at = now(), edited_by = p_actor
    where id = r.id;

    if r.attachment_storage_path is not null then
      insert into expense_attachments (
        property_id,
        expense_id,
        batch_id,
        staged_row_id,
        storage_path,
        file_name,
        mime_type,
        byte_size,
        sha256,
        page_no,
        sort_order,
        created_by
      ) values (
        p_property_id,
        new_expense_id,
        p_batch_id,
        r.id,
        r.attachment_storage_path,
        coalesce(batch.source_filename, 'receipt') || coalesce('-p' || r.page_no::text, ''),
        batch.source_mime,
        greatest(batch.source_byte_size, 1),
        batch.source_sha256,
        r.page_no,
        0,
        p_actor
      );
    end if;

    expense_ids := array_append(expense_ids, new_expense_id);
    committed := committed + 1;
  end loop;

  if committed = 0 then
    raise exception 'No selected staged rows to commit';
  end if;

  update finance_import_batches
  set
    status = 'committed',
    committed_count = committed,
    selected_count = committed,
    committed_at = now(),
    updated_at = now()
  where id = p_batch_id;

  return jsonb_build_object(
    'ok', true,
    'idempotent', false,
    'committed_count', committed,
    'expense_ids', to_jsonb(expense_ids),
    'as_draft', p_as_draft
  );
end;
$$;

revoke all on function finance_commit_receipt_batch(uuid, uuid, boolean, text) from public, anon, authenticated;
grant execute on function finance_commit_receipt_batch(uuid, uuid, boolean, text) to service_role;

-- ---------------------------------------------------------------------------
-- Atomic commit: selected staged bank rows → statement + transactions
-- ---------------------------------------------------------------------------
create or replace function finance_commit_bank_batch(
  p_batch_id uuid,
  p_property_id uuid,
  p_actor text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  batch finance_import_batches;
  r finance_staged_bank_rows;
  statement_id uuid;
  bank text;
  committed int := 0;
  period_start date;
  period_end date;
  fp text;
  new_txn_id uuid;
  txn_ids uuid[] := array[]::uuid[];
begin
  select * into batch
  from finance_import_batches
  where id = p_batch_id and property_id = p_property_id
  for update;

  if not found then
    raise exception 'Batch not found';
  end if;
  if batch.kind <> 'bank' then
    raise exception 'Batch is not a bank import';
  end if;
  if batch.status = 'committed' and batch.bank_statement_id is not null then
    return jsonb_build_object(
      'ok', true,
      'idempotent', true,
      'committed_count', batch.committed_count,
      'bank_statement_id', batch.bank_statement_id
    );
  end if;
  if batch.status <> 'review' then
    raise exception 'Batch must be in review status (got %)', batch.status;
  end if;

  bank := lower(coalesce(batch.bank_code, ''));
  if bank not in ('bob','bnb','tbank','drukpnb') then
    raise exception 'Invalid bank_code on batch';
  end if;

  select min(txn_date), max(txn_date)
    into period_start, period_end
  from finance_staged_bank_rows
  where batch_id = p_batch_id and selected = true;

  insert into bank_statements (
    property_id,
    bank_code,
    account_label,
    period_start,
    period_end,
    source_filename,
    source_sha256,
    status,
    parsed_at,
    storage_path,
    parser_version_id,
    import_batch_id
  ) values (
    p_property_id,
    bank,
    batch.account_label,
    period_start,
    period_end,
    batch.source_filename,
    batch.source_sha256,
    'parsed',
    now(),
    batch.source_storage_path,
    batch.parser_version_id,
    p_batch_id
  )
  returning id into statement_id;

  for r in
    select *
    from finance_staged_bank_rows
    where batch_id = p_batch_id
      and property_id = p_property_id
      and selected = true
      and bank_transaction_id is null
    order by row_no
    for update
  loop
    if r.txn_date is null then
      raise exception 'Row % missing txn_date', r.row_no;
    end if;
    if coalesce(nullif(trim(r.description), ''), '') = '' then
      raise exception 'Row % missing description', r.row_no;
    end if;

    fp := coalesce(
      nullif(trim(r.fingerprint), ''),
      encode(
        digest(
          concat_ws(
            '|',
            bank,
            r.txn_date::text,
            lower(trim(r.description)),
            to_char(coalesce(r.debit_btn, 0), 'FM9999999990.00'),
            to_char(coalesce(r.credit_btn, 0), 'FM9999999990.00'),
            lower(coalesce(r.reference, ''))
          ),
          'sha256'
        ),
        'hex'
      )
    );
    fp := left(fp, 40);

    insert into bank_transactions (
      statement_id,
      property_id,
      bank_code,
      txn_date,
      value_date,
      description,
      debit_btn,
      credit_btn,
      balance_btn,
      reference,
      raw_line,
      fingerprint,
      match_status
    ) values (
      statement_id,
      p_property_id,
      bank,
      r.txn_date,
      r.value_date,
      trim(r.description),
      round(coalesce(r.debit_btn, 0), 2),
      round(coalesce(r.credit_btn, 0), 2),
      r.balance_btn,
      nullif(trim(r.reference), ''),
      left(coalesce(r.raw::text, ''), 2000),
      fp,
      'unmatched'
    )
    on conflict (statement_id, fingerprint) do nothing
    returning id into new_txn_id;

    if new_txn_id is not null then
      update finance_staged_bank_rows
      set bank_transaction_id = new_txn_id, edited_at = now(), edited_by = p_actor
      where id = r.id;
      txn_ids := array_append(txn_ids, new_txn_id);
      committed := committed + 1;
    end if;
  end loop;

  if committed = 0 then
    delete from bank_statements where id = statement_id;
    raise exception 'No selected staged bank rows to commit';
  end if;

  update finance_import_batches
  set
    status = 'committed',
    bank_statement_id = statement_id,
    committed_count = committed,
    selected_count = committed,
    committed_at = now(),
    updated_at = now()
  where id = p_batch_id;

  return jsonb_build_object(
    'ok', true,
    'idempotent', false,
    'committed_count', committed,
    'bank_statement_id', statement_id,
    'transaction_ids', to_jsonb(txn_ids)
  );
end;
$$;

revoke all on function finance_commit_bank_batch(uuid, uuid, text) from public, anon, authenticated;
grant execute on function finance_commit_bank_batch(uuid, uuid, text) to service_role;

-- Seed built-in parser script placeholders (versions point at worker built-ins)
create extension if not exists pgcrypto;

insert into finance_parser_scripts (property_id, kind, bank_code, name, description, is_builtin, default_for_kind, created_by)
select p.id, 'receipt', null, 'Built-in Gemini receipt extractor',
  'Default receipt PDF extractor using Gemini structured output (runs in finance-parser-worker).',
  true, true, 'system'
from properties p
where not exists (
  select 1 from finance_parser_scripts s
  where s.property_id = p.id and s.kind = 'receipt' and s.name = 'Built-in Gemini receipt extractor'
);

insert into finance_parser_scripts (property_id, kind, bank_code, name, description, is_builtin, default_for_kind, created_by)
select p.id, 'bank', b.code, 'Built-in ' || upper(b.code) || ' parser',
  'Built-in bank statement parser adapted from scripts/bank-recon (runs in finance-parser-worker).',
  true, true, 'system'
from properties p
cross join (values ('bob'), ('bnb'), ('tbank'), ('drukpnb')) as b(code)
where not exists (
  select 1 from finance_parser_scripts s
  where s.property_id = p.id and s.kind = 'bank' and s.bank_code = b.code
    and s.name = 'Built-in ' || upper(b.code) || ' parser'
);
