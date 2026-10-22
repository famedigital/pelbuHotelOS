---
name: pelbu-design-system
description: >-
  Hotel OS UI direction — desk ivory/espresso/gold/brass, public Himalayan Dusk,
  short motion. Use when editing marketing pages, desk chrome, or visual polish.
---

# Pelbu design system

Tokens live in `web/src/app/globals.css`. Do not restore Sky & Citrus.

- UI kit: Tailwind + shadcn/ui. Motion is short (opacity and transform, under 200ms) and honors `prefers-reduced-motion`.
- **Desk:** ivory, espresso, gold, and brass already declared in that file (`.erp` and `.fo-command`). StayHub (`.stay-hub-card`) is the ivory card. Dirty, due, and unpaid stay loud and separate from the brand metals.
- **Public:** Himalayan Dusk, photography-led. `/book` stays a clear date-and-room funnel. Desk rack stays a room-by-date timeline.
- Mobile desk: footer tabs, not hamburger-first.
- Do not invent a new purple-gradient kit, and do not add a second cream-and-terracotta theme on top of the desk tokens.
- Prefer real room and place photography over abstract decoration on public pages.
