-- Property BYOK Gemini for desk Assist (draft-only; human Confirm before writes).
create table if not exists public.property_ai_settings (
  property_id uuid primary key references public.properties (id) on delete cascade,
  gemini_api_key_enc text,
  gemini_model text not null default 'gemini-2.0-flash',
  enabled boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by text
);

comment on table public.property_ai_settings is
  'Per-hotel Gemini BYOK. Key is encrypted at rest; Assist never mutates money without Confirm.';

alter table public.property_ai_settings enable row level security;

-- Desk uses service role from Next server actions; no anon policies required.
