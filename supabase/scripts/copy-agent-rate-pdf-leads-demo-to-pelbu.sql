-- One-shot: copy agent_rate_pdf_leads (+ events) from demo-hotel → Pelbu.
-- Run on the droplet DB after rate-downloads uses resolveActivePropertyId.
-- Skips email+phone pairs already present on the target property.
--
-- Target slug preference: pelbu-olakha (live), else pelbu-suites-olakha.

begin;

with ids as (
  select
    (select id from public.properties where slug = 'demo-hotel' limit 1) as demo_id,
    coalesce(
      (select id from public.properties where slug = 'pelbu-olakha' limit 1),
      (select id from public.properties where slug = 'pelbu-suites-olakha' limit 1)
    ) as target_id
),
copied as (
  insert into public.agent_rate_pdf_leads (
    property_id,
    email,
    phone,
    full_name,
    download_count,
    first_download_at,
    last_download_at,
    last_user_agent,
    created_at,
    updated_at
  )
  select
    i.target_id,
    l.email,
    l.phone,
    l.full_name,
    l.download_count,
    l.first_download_at,
    l.last_download_at,
    l.last_user_agent,
    l.created_at,
    l.updated_at
  from public.agent_rate_pdf_leads l
  cross join ids i
  where i.demo_id is not null
    and i.target_id is not null
    and l.property_id = i.demo_id
    and not exists (
      select 1
      from public.agent_rate_pdf_leads t
      where t.property_id = i.target_id
        and t.email = l.email
        and t.phone = l.phone
    )
  returning id, email, phone, property_id
)
insert into public.agent_rate_pdf_events (
  property_id,
  lead_id,
  email,
  phone,
  full_name,
  user_agent,
  created_at
)
select
  i.target_id,
  c.id,
  e.email,
  e.phone,
  e.full_name,
  e.user_agent,
  e.created_at
from public.agent_rate_pdf_events e
cross join ids i
join copied c
  on c.email = e.email
 and c.phone = e.phone
 and c.property_id = i.target_id
where i.demo_id is not null
  and i.target_id is not null
  and e.property_id = i.demo_id;

-- Preview counts (run SELECT after commit, or use a separate session):
-- select p.slug, count(*) from agent_rate_pdf_leads l
-- join properties p on p.id = l.property_id
-- where p.slug in ('demo-hotel','pelbu-olakha','pelbu-suites-olakha')
-- group by 1;

commit;
