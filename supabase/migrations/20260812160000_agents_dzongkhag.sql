-- Office dzongkhag for TCB / Bhutan agent directory (e.g. Thimphu, Paro).
alter table public.agents
  add column if not exists dzongkhag text;

comment on column public.agents.dzongkhag is
  'Office dzongkhag from TCB directory (e.g. Thimphu). Null for non-TCB or unknown.';

create index if not exists agents_dzongkhag_lower_idx
  on public.agents (lower(trim(dzongkhag)))
  where dzongkhag is not null;
