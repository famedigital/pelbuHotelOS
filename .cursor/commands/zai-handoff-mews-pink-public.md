# Handoff brief for z.ai — Round 1: Pelbu-pink marketing + Airbnb `/book`

Paste into a **new chat** with model **`GLM-5.2`**.  
Attach `@AGENTS.md` and `@.cursor/rules/zai-implementer.mdc`.  
Optional context: `@docs/PLATFORM.md` (section **UX north stars**).  
Branch: `zai/mews-pink-public` (from latest `main`).

You are the **implementer**. Do **not** rewrite this brief. **Do not ask clarifying questions.** If ambiguous, use **Locked defaults** and keep coding. **Edit allowed files only.**

## Important (read once)
- We are **not** installing the Mews design system. We use **Tailwind + shadcn/ui + Framer Motion**.
- We **ditto Mews craft** (mega-menu, pill CTA, pink accent, motion) with **Pelbu** branding.
- Do **not** copy Mews wordmark, “M” symbol, or Soehne fonts.

## Context (do not re-do)
- ERP Timeline / DeskHeader / FastBook / check-in / finance / channel = **Round 2** — **do not touch**
- Phases E–H (payments webhooks, guest portal, RMS, APIs) = **out of scope**
- Do not invent schema, RLS, env vars, or new server actions
- Extend existing `web/src/components/ui/*` — do not switch to styled-components

## Task (Round 1 only)

### 1) Design notes
Write short READMEs from Locked tokens (no scrape):
- `design/marketing-mews/README.md` — Pelbu-pink tokens, mega-menu, motion
- `design/book-airbnb/README.md` — dates → rooms → guest → confirm + sticky summary

### 2) Tokens + motion
- Retoken `web/src/app/globals.css` to **Pelbu-pink** (`:root` + `.erp` accent `#ff83da`)
- Add **`framer-motion`** to `web/` if missing
- Add shadcn primitives if missing: `table`, `checkbox`, `radio-group`, `scroll-area`, `avatar` (match existing `cn()` patterns)

### 3) Marketing shells (Mews craft)
- `SiteHeader` — sticky white nav, mega-menu (feature left rail + link columns), **Bubblegum pill CTA** “Book” → `/book`
- `SiteFooter` — quiet, lots of whitespace
- `ConversionShell` — max-width ~1280px, section gap ~64–80px

### 4) Home
- `HomeHero`, `HomeStreams`, `HomeCtaBand` — Pelbu-pink + 2–3 Framer `whileInView` reveals
- Brand-first (Pelbu logo/name strong in first viewport)
- No PowerPoint eyebrows / brass hairlines / paper-card soup
- Keep real CMS/image props — never invent menus/prices/hours

### 5) Airbnb `/book`
Reskin wizard to Airbnb shape (same actions):
1. Dates — reuse `StayDatesField`
2. Room cards — image, name, price from `previewStayCost`
3. Guest/contact
4. Review/confirm
- Sticky summary: desktop right rail; mobile sticky bar or `Sheet`
- shadcn: `Card`, `Button`, `Input`, `Label`, `Sheet` as needed
- **Keep all form field names + `createBooking` / `previewStayCost`**

## Locked defaults

### Colours (CSS variables)
| Role | Hex |
|------|-----|
| Primary CTA / accent | `#ff83da` |
| Soft / blush | `#ffc5ee` / `#f7e1f7` |
| Ice / lime (sparse) | `#d2f4ff` / `#e8ff5b` |
| Ink / charcoal | `#000000` / `#333333` |
| Cream / canvas | `#fffcf6` / `#ffffff` |
| `.erp` accent | `#ff83da` |

### Shape / type / motion
- Pill CTA: `rounded-full`, Bubblegum fill
- Cards ~4–8px radius; inputs ~8px
- Font: **Inter** (Fraunces only if already in layout) — no Soehne
- Mega-menu 150–250ms; home 2–3 reveals; honor `prefers-reduced-motion`

### Book contracts (unchanged)
- `check_in`, `check_out`, `adults`, `rooms`, `quoted_total_btn`, `room_type_code`
- `contact_name`, `contact_phone`, `contact_email`, `guide_number`, `notes`
- Import existing actions only — **do not edit** `web/src/app/actions/**`

## Allowed files
- `design/marketing-mews/README.md` (new)
- `design/book-airbnb/README.md` (new)
- `web/package.json`, `web/package-lock.json` (framer-motion + shadcn deps only)
- `web/src/app/globals.css`
- `web/src/app/layout.tsx` (fonts/providers only if needed)
- `web/src/app/page.tsx`
- `web/src/app/book/page.tsx`
- `web/src/components/site/SiteHeader.tsx`
- `web/src/components/site/SiteFooter.tsx`
- `web/src/components/site/ConversionShell.tsx`
- `web/src/components/site/Reveal.tsx`
- `web/src/components/home/HomeHero.tsx`
- `web/src/components/home/HomeStreams.tsx`
- `web/src/components/home/HomeCtaBand.tsx`
- `web/src/components/book/BookingWizard.tsx`
- `web/src/components/book/BookingStepStay.tsx`
- `web/src/components/book/BookingStepRoom.tsx`
- `web/src/components/book/BookingStepContact.tsx`
- `web/src/components/book/BookingSummary.tsx`
- `web/src/components/ui/**` (listed primitives only)
- New if needed: `web/src/components/site/MegaMenu.tsx`, `web/src/components/book/BookingStepReview.tsx`

## Do not touch
- `web/src/app/actions/**`, `supabase/**`, auth, middleware, `.env*`
- Any `/erp/**` or `web/src/components/erp/**`
- Order / agents / contact / spa / cafe pages
- `scripts/**`, Channex, payments providers
- Do not delete `design/brand/**`

## Acceptance
- [ ] `npm run build` in `web/` passes
- [ ] `/` — Pelbu-pink pill CTA + mega-menu; no Mews trademarks
- [ ] `/book` — booking still saves via existing action; same field names
- [ ] Totals from `previewStayCost` only (no hardcoded Nu)
- [ ] Mobile sticky summary usable; targets ≥44px
- [ ] Reply: files changed + how to test `/` and `/book`

## Done means
Cursor reviews the diff; you do not merge unless asked. **Start implementing now.**
