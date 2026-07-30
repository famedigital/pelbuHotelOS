-- Support phone-shot video (and richer media metadata) in the public CMS
-- media library. Delivery uses Cloudinary adaptive HLS; this table only
-- stores the public_id and enough metadata to choose image vs video UI.

alter table public.cms_media
  add column if not exists resource_type text not null default 'image',
  add column if not exists poster_public_id text,
  add column if not exists duration_sec numeric,
  add column if not exists bytes bigint,
  add column if not exists width integer,
  add column if not exists height integer,
  add column if not exists format text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'cms_media_resource_type_check'
      and conrelid = 'public.cms_media'::regclass
  ) then
    alter table public.cms_media
      add constraint cms_media_resource_type_check
      check (resource_type in ('image', 'video'));
  end if;
end $$;

comment on column public.cms_media.resource_type is
  'Cloudinary resource type: image or video. Video delivery uses sp_auto HLS.';
comment on column public.cms_media.poster_public_id is
  'Optional Cloudinary image public_id used as the video poster frame.';
