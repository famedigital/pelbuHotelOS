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
- `web/src/app/dine/page.tsx` (same — see STREAMS note below)
- `web/src/app/cafe/page.tsx` (same)
- `web/src/components/media/MediaGallery.tsx`
- `web/src/components/site/MenuSections.tsx`
- `web/src/components/site/ConversionShell.tsx` (spacing/visual only — no data)

## Reference (read-only — do not edit unless listed above)
- `web/src/app/cafe/page.tsx` — primary F&B conversion tone
- `web/src/app/bar/page.tsx` — outlet + menu + gallery wiring pattern
- `web/src/app/rooms/page.tsx` — ConversionShell + list section tone
- Do not mirror `restaurant/page.tsx` blindly; use cafe/rooms as the visual north star.

## Do not touch
- `supabase/migrations/**`
- `web/src/lib/cms.ts`, `web/src/lib/cloudinary.ts`, `web/src/lib/menu-loader.ts`
- `web/src/app/actions/**`
- Auth / RLS / payments
- `.env*`
- Do not invent menu prices or hours — CMS/seed only
- Do not change Cloudinary public_id seeding

## Contracts (must preserve)
- `MenuSections` props shape: `{ byCategory: Map<string, MenuItem[]>; emptyMessage?: string }` — do not break callers that pass `groupMenuByCategory(...)`.
- `ConversionShell` prop contract (`eyebrow`, `title`, `body`, `children`, `aside?`) — **do not change**. Other routes (rooms, book, etc.) depend on it. Spacing/visual class tweaks only.

## STREAMS on `/dine` (explicit)
`dine/page.tsx` has an in-file `STREAMS` array (href/title/body). That is the current source of truth for the three outlet links — **not** CMS.

- You may polish layout around `STREAMS` (spacing, hierarchy, CTA styling).
- You may lightly edit `STREAMS` body copy for clarity/tone if it still matches cafe/restaurant/bar reality.
- Do **not** invent a CMS `page.streams` column or invent new outlets/hrefs.
- Do **not** remove the three streams (`/cafe`, `/restaurant`, `/bar`).
- Hero/eyebrow/title/hours/CTAs still come from `loadCmsPage("dine")` — keep those loaders.

## Patterns to copy
- Brand tokens: `web/src/app/globals.css` (`ivory` / `espresso` / `maroon` / `gold` / `muted`)
- Production tone: read-only references above (not `design/mockups/` — that folder has no image assets yet)

## Acceptance checks
- [ ] `npm run build` in `web/` passes
- [ ] Pages still load menus when DB has rows
- [ ] Gallery gracefully hides when `src` is null
- [ ] Mobile-first, 44px CTAs
- [ ] `/dine` still lists cafe / restaurant / bar via `STREAMS` (or equivalent same three links)
- [ ] Reply: what changed / how to test (`/restaurant` `/bar` `/dine` `/cafe`)

## Unlocked by Cursor (this chunk)
- `cms_pages` + `cms_media` tables + restaurant/bar menu seed
- Cloudinary URL helper via `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`
- Data-wired restaurant/bar/dine/cafe pages

## Done means
Cursor reviews the diff; z.ai does not merge unless asked.
