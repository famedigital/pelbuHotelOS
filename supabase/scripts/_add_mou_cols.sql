alter table public.agent_property_links
  add column if not exists mou_signed_at timestamptz;

do $$
begin
  if to_regclass('public.agent_documents') is not null then
    begin
      alter table public.agent_property_links
        add column if not exists mou_document_id uuid references public.agent_documents(id) on delete set null;
    exception when others then
      alter table public.agent_property_links
        add column if not exists mou_document_id uuid;
    end;
  else
    alter table public.agent_property_links
      add column if not exists mou_document_id uuid;
  end if;
end $$;

create index if not exists agent_property_links_mou_idx
  on public.agent_property_links (property_id, status)
  where mou_signed_at is not null;

comment on column public.agent_property_links.mou_signed_at is
  'When set, agent may view that hotel rates and inventory in the partner portal.';

select column_name
from information_schema.columns
where table_name = 'agent_property_links'
  and column_name in ('mou_signed_at', 'mou_document_id');
