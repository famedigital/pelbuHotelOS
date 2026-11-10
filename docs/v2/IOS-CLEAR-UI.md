# Glacier v2 — iOS Clear UI

**Direction:** Apple HIG–inspired clear UI for phone, tablet, and desktop. Opaque grouped surfaces, system blue, large titles, inset cards, edge tab bar. Replaces heavy Glacier mesh/glow chrome while keeping hotel semantic colors (emerald / ruby / brass) for status only.

## Breakpoints

| Band | Width | Chrome |
|------|-------|--------|
| Phone | &lt;768 | Large titles · edge tab bar (5) · sheets |
| Tablet | 768–1023 | Compact nav bar · icon rail · master–detail |
| Desktop | ≥1024 | Sidebar · inline titles · zero-scroll panes |

## Tokens (source of truth)

`v2/packages/ui/src/tokens.css` — `--hos-*` remapped to iOS system palette. All desk modules inherit via existing class names (`hos-cell`, `hos-glass-card`, `ModuleFrame`, dock).

## Non-goals

- Native Swift rewrite
- Claiming Finance Postgres depth
- Restoring mesh blobs / specular glow as default
