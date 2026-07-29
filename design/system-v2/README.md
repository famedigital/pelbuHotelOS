# Pelbu Suites — design system v2 brief

> Status: **signed off — Direction B “Ink & Brass”** (Fraunces + Inter).
> See `sign-off.md`. Phase 0–2b of the shadcn/ui adoption plan are shipped.
>
> Owner: designer (or Claude art-directing on a `claude/*` branch).
> Reviewer: Cursor (token + implementation feasibility) + property owner.

---

## 1. Why we're here

The current public site reads as **"generic AI-generated"** — correct but
lifeless. Symptoms:

- Default Geist Sans + a flat 5-colour palette (ivory / espresso / maroon /
  gold / muted brown) → no rhythm, no surprise.
- Every section is the same card-on-ivory grid → templated feel.
- No motion, no imagery hierarchy, no display type → nothing to *look at*.
- Mockups in `design/mockups/` always looked richer than the shipped UI; we
  never closed that gap.

shadcn/ui is now in place (`web/src/components/ui/*`) but **adopting shadcn
badly makes the problem worse** — default zinc theme + default Inter + generic
dashboard cards = peak "Claude vibe". The token bridge in
`web/src/app/globals.css` already skins shadcn to the brand palette; this brief
decides how to *evolve* that palette and the surrounding system so the site
reads as designed.

**The soul stays**: Bhutanese-modern, warm, restrained, conversion-focused.
We're lifting the execution, not changing the identity.

---

## 2. Anchors (do not change)

These are load-bearing — any direction must respect them.

- **Brand colours**: ivory `#f7f3ec`, espresso `#1c1612`, maroon `#7a1f1f`,
  gold `#b8892c`. They can be *refined* (slight hue/temperature shift) but not
  replaced. The shadcn token scale in `globals.css` derives from these.
- **Property**: Pelbu Suites Olakha, Thimphu — a real 3-star hotel with cafe,
  pastry, restaurant, bar, spa, meeting rooms. Copy must stay truthful; no
  invented luxury claims.
- **Conversion goal**: the public site exists to drive room bookings
  (`/book`), cafe orders (`/order`), and agent applications (`/agents`).
  Direction must not bury CTAs under art.
- **Constraints**: Next.js 16 / React 19 / Tailwind v4. Imagery via Cloudinary
  (assets in repo). PWA. Mobile-first. Spacing scale 4–96.
- **Anti-patterns**: stock-photo clichés of Bhutan (monks, prayer flags,
  generic dzongs), gradient blobs, glassmorphism, neon, AI-generated
  illustrated mascots.

---

## 3. Three proposed directions

Pick one (or blend two). Each keeps the anchors and changes the *neutrals*,
*typography*, and *surface treatment*.

### Direction A — "Warm Paper" (safest evolution)

- **Neutrals**: introduce a 5-step warm-paper scale alongside ivory — `#fbf8f2`
  → `#f3ece0` → `#e8dec9` → `#d9ccb2` → `#c4b495`. Shadcn `--secondary` /
  `--muted` / `--border` already pull from this family; formalise it.
- **Accent refinement**: keep gold `#b8892c` but add a *brass* lighter tone
  `#d4a852` (already a token) for hover/highlight states so gold doesn't read
  flat.
- **Type**: **Fraunces** (display serif, soft optical sizes) for headings +
  **Inter** for UI/body. Fraunces gives editorial warmth without going
  heritage-kitsch.
- **Surfaces**: paper-grain texture (very subtle, ~3% opacity) on the ivory
  background; cards stay flat with a 1px warm border, no shadow except on
  interactive lift.
- **Motion**: gentle — hero image settles in (translateY 12px → 0, 600ms),
  section content fades up on scroll (IntersectionObserver, 400ms).
- **Reads as**: a refined boutique-hotel brochure. Low risk, high polish.

### Direction B — "Ink & Brass" (more confident, editorial)

- **Neutrals**: lead with **espresso ink** as the primary surface on key
  sections (hero, booking wizard aside, agents CTA) — `#1c1612` with the
  warm-paper scale for the rest. High contrast, magazine-like.
- **Accent refinement**: gold becomes *brass* — shift slightly warmer/cooler
  toward `#c19548` and use it as a thin hairline rule + small caps labels,
  not as a fill. Maroon stays for destructive/error states only.
- **Type**: **GT Sectra** or **Canela** (if licensed) for display, **Söhne** or
  **General Sans** for UI. If licensing is a blocker: Fraunces + Inter is the
  fallback (same as Direction A).
- **Surfaces**: ink panels with brass hairlines; paper panels with deep
  espresso type. No card shadows — hierarchy via contrast and rule weight.
- **Motion**: more deliberate — sections cross-fade rather than slide; the
  booking wizard step transitions use a 200ms horizontal shift.
- **Reads as**: a Monocle-style travel feature. Higher effort, distinctive.

### Direction C — "Heritage Maroon" (most Bhutanese, most opinionated)

- **Neutrals**: warm-paper scale (Direction A) as the base, but **maroon
  `#7a1f1f` becomes a structural colour** — used for the site header band,
  section dividers, and the booking aside, not just CTAs.
- **Accent refinement**: gold stays as the highlight on maroon; introduce a
  *jade* secondary `#3d5c4f` (Bhutanese prayer-flag green, desaturated) for
  tertiary accents (cafe/spa tags).
- **Type**: **Boska** or **Tobias** (warm display serif with personality) +
  **Mona Sans** for UI. Fallback: Fraunces + Inter.
- **Surfaces**: maroon header with gold wordmark; paper body; one full-bleed
  maroon "quote" section per long page (guest testimonial / owner note).
- **Motion**: slow, confident — full-bleed images parallax slightly on
  scroll; the maroon band slides in over the hero on scroll-down.
- **Reads as**: a Bhutanese heritage hotel that happens to be modern. Most
  on-brand, most opinionated, most polarising.

---

## 4. Typography — concrete proposal (applies to all directions)

Today: Geist Sans only (`--font-geist-sans`), loaded via `next/font/google` in
`web/src/app/layout.tsx`.

Proposed:

| Role        | Primary choice     | Fallback (no licence) | Size scale (rem)     |
| ----------- | ------------------ | --------------------- | -------------------- |
| Display H1  | Fraunces 600/ops72 | Fraunces (free)       | clamp(2.5, 5vw, 4)   |
| Heading H2  | Fraunces 500/ops36 | Fraunces              | clamp(1.75, 3vw, 2.5)|
| Heading H3  | Inter 600          | Inter                 | 1.25                 |
| Body / UI   | Inter 400/500      | Inter                 | 1 / 0.875            |
| Eyebrow     | Inter 500, tracked | Inter                 | 0.75, letter-spacing 0.2em |
| Numeric     | Inter tabular-nums | Inter                 | inherit              |

- Load Fraunces + Inter via `next/font/google` (both free). Replace the single
  Geist load in `layout.tsx` with both, exposing `--font-display` and
  `--font-sans`.
- Map in `globals.css`: `--font-display: var(--font-fraunces)` (new),
  `--font-sans: var(--font-inter)` (replaces geist).
- Headings use `font-family: var(--font-display)`; everything else inherits
  `--font-sans`.

---

## 5. Motion — concrete proposal

New dep: **`framer-motion`** (already listed in the plan's package.json gains).
Restricted to 3 purposeful motions — no decorative animation.

1. **Hero settle** — hero image + headline translate-up 12px + fade, 600ms
   ease-out, on mount only.
2. **Scroll reveal** — section bodies fade-up 8px, 400ms, triggered by
   IntersectionObserver at `threshold: 0.15`. One direction, no stagger spam.
3. **CTA affordance** — primary buttons lift `-2px` + shadow on hover, 150ms;
   gold buttons also shift `brightness(1.08)`.

Page transitions: none for now (Next.js App Router partial prerender makes
this risky). Revisit after the rebuild.

Respect `prefers-reduced-motion`: all three motions disable to instant.

---

## 6. Per-screen deltas vs mockups

Mockups live in `design/mockups/` (`01-home-desktop.png` … `05-erp-checkin.png`).
The desk (ERP) side is already rebuilt via Phase 1; this section covers the
**public** pages only.

### 6.1 Home (`/` — `web/src/app/page.tsx` + `HomeHero`, `HomeStreams`)

- **Hero**: full-bleed image of the Olakha building (Cloudinary), espresso
  overlay 35%, display H1 in ivory, gold eyebrow, single primary CTA "Book a
  stay" + ghost "Explore rooms". Matches mockup `01-home-desktop.png`.
- **Streams row**: 4 tiles (Stay / Dine / Spa / Meet) — shadcn `Card` with
  image top, label bottom, brass hairline on hover. Currently flat links.
- **New section — "Why Pelbu"**: 3 value props (location, F&B, ops quality)
  with icon + 1-line proof. Not in mockup, add it.
- **New section — guest quote**: one full-bleed maroon (Direction C) or
  espresso (Direction B) panel with a real testimonial once we have one.
- **CTA band**: gold-on-espresso "Reserve your stay" → `/book`.

### 6.2 Rooms + book (`/rooms`, `/book`)

- **Rooms**: room-type cards with image, capacity, from-price (BTN), "Details"
  expands an Accordion (shadcn) with amenities. Currently a flat list.
- **Book wizard**: already shipped (`BookingWizard.tsx`, 3 steps). Skin to
  match the chosen direction — step indicator with brass hairline, summary
  aside on espresso (Direction B) or ivory (A/C).

### 6.3 Cafe + order (`/cafe`, `/order`)

- **Cafe**: menu sections (shadcn `Accordion` or `Tabs`), real dish imagery
  from Cloudinary, price in BTN.
- **Order**: sticky cart bar at the bottom on mobile (shadcn `Sheet`
  `side="bottom"`), full cart on desktop right rail. Currently the cart is
  inline and scrolls away.

### 6.4 Agents (`/agents`)

- Hero with the agent value prop, 3-step "how it works", application form
  (already `AgentApplyForm`). Skin to match. Add a subtle texture or
  background image of Thimphu.

### 6.5 Contact + services (`/contact`, `/services/*`)

- Contact: map embed (already?), form via shadcn primitives, hours + phone in
  a sidebar Card.
- Services (spa, meeting, etc.): each gets a hero image + rate card +
  "Enquire" CTA that pre-fills the contact form.

---

## 7. Imagery direction

- **Use**: real photos of the Olakha building, rooms, cafe dishes, spa.
  Cloudinary assets are in the repo (`design/brand/` has the building logo;
  the media migration `202607280013_media_menu_rooms.sql` wired room/menu
  images). Prioritise authentic over polished.
- **Treatment**: very mild warm-grade (temperature +200, tint +10) for
  consistency; no filters, no vignette. 16:9 for heroes, 4:3 for cards.
- **Avoid**: stock Bhutan clichés (monks, tiger's nest, prayer flags) unless
  the property genuinely has them on-site. Pelbu is a *modern* hotel, not a
  resort.

---

## 8. What Cursor needs from the designer

1. **Pick a direction** (A / B / C / blend) — section 3.
2. **Confirm type pairing** — section 4 (or propose alternatives + licensing).
3. **Sign off the 3 motions** — section 5 (or trim/add).
4. **Provide or approve imagery list** — section 7 (which Cloudinary assets go
   where).
5. **Mark up 2 mockups** — pick `01-home-desktop.png` and `03-rooms-book.png`,
   annotate with the chosen direction's tokens so the z.ai build has a visual
   target.

Output: a comment on this file, or a `design/system-v2/sign-off.md` noting the
choices. Once that exists, Cursor unlocks Phase 2b.

---

## 9. Implementation handoff (for z.ai, post-sign-off)

Once the direction is locked, Phase 2b proceeds in this order (each is a todo
in the plan):

1. **P2b.1** — Update `globals.css` + `layout.tsx` with the evolved tokens +
   the two font variables. Cursor does this (it's the contract).
2. **P2b.2** — Refresh `ConversionShell`, `SiteHeader`, `SiteFooter`. Cursor.
3. **P2b.3–6** — Rebuild home, rooms+book, cafe+order, agents+contact+services.
   These are z.ai briefs (`.cursor/commands/zai-handoff-*.md`) under the
   locked system; Cursor reviews each diff.

Every public page must stay production-quality per
`.cursor/rules/production-quality.mdc` — real copy, real CTAs, no placeholders.
