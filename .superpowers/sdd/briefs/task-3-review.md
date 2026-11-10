# Task 3 review — candy-track wells

**Spec:** ✅  
All five brief targets implemented; snippets match (FoMetricCard, Agent figures, setup `pct`/violet, StayHub binary strip, Occ popover thresholds). Rack timeline cells unchanged (`tone.bar` ~660); `neo-well` only ~2207. No commits. Step 6 visual verify not done.

**Quality:** Approved with changes  
Run `pnpm --dir web run typecheck` and manual spot-check (`/erp/day`, StayHub, FO metrics, agent cockpit) before merge.

**Critical:** None — no money/auth changes; no `backdrop-filter` on rack/POS/dense rows; `.neo-well` is inset shadow only.

**Important:**
- **Verification gap:** typecheck and browser checks were skipped in report; treat as merge gate.
- **Clean rooms bar:** fill width = % clean but track is always coral — full bar reads “warn” while state is healthy; brief-mapped but desk may misread (consider mint fill + coral only when dirty>0, or invert metric).
- **StayHub strip:** `aria-hidden` hides settled/due from AT; amount is still in guest-stream text — optional `role="img"` + label if parity matters.
- **Occ popover:** threshold gradients replace `tone.bar` — intentional per brief; popover card/value tones still from `occupancyTone`.
