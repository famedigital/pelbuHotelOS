# Handoff brief for z.ai (READY)

Paste into a **new chat** with model **`GLM-5.2`**. Attach `@AGENTS.md` and `@.cursor/rules/zai-implementer.mdc`.

You are the **implementer**. Do **not** rewrite this brief. **Edit the allowed files only.**

## Task
Polish Restaurant / Bar / Dine / Cafe conversion UI — layout, typography, gallery presentation — while keeping CMS/menu data loaders intact.

## Goal
F&B pages feel flagship (not stub): clear hierarchy, gallery rhythm, strong CTAs. Menus and hours stay from DB.

## Allowed files
- `web/src/app/restaurant/page.tsx` (layout/copy structure only — keep `loadCmsPage` / `loadMenuByOutlets` / `loadCmsGallery`)
- `web/src/app/bar/page.tsx` (same)
- `web/src/app/dine/page.tsx` (same)
- `web/src/app/cafe/page.tsx` (same)
- `web/src/components/media/MediaGallery.tsx`
- `web/src/components/site/MenuSections.tsx`
- `web/src/components/site/ConversionShell.tsx` (spacing/visual only — no data)

## Do not touch
- `supabase/migrations/**`
- `web/src/lib/cms.ts`, `web/src/lib/cloudinary.ts`, `web/src/lib/menu-loader.ts`
- `web/src/app/actions/**`
- Auth / RLS / payments
- `.env*`
- Do not invent menu prices or hours — CMS/seed only
- Do not change Cloudinary public_id seeding

## Patterns to copy
- Brand tokens: `web/src/app/globals.css`
- Mockups: `design/mockups/`
- Existing cafe/rooms production tone

## Acceptance checks
- [ ] `npm run build` in `web/` passes
- [ ] Pages still load menus when DB has rows
- [ ] Gallery gracefully hides when `src` is null
- [ ] Mobile-first, 44px CTAs
- [ ] Reply: what changed / how to test (`/restaurant` `/bar` `/dine` `/cafe`)

## Unlocked by Cursor (this chunk)
- `cms_pages` + `cms_media` tables + restaurant/bar menu seed
- Cloudinary URL helper via `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`
- Data-wired restaurant/bar/dine/cafe pages

## Done means
Cursor reviews the diff; z.ai does not merge unless asked.
