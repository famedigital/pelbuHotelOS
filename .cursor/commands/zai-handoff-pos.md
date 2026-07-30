# Handoff brief for z.ai (POS modernization UI)

Paste into a **new chat** with model **`GLM-5.2`**. Attach `@AGENTS.md` and `@.cursor/rules/zai-implementer.mdc`.

You are the **implementer**. Do **not** rewrite this brief. **Do not ask clarifying questions.** If something is ambiguous, use the **Locked defaults** below and keep coding. **Edit the allowed files only.**

**Do not send chain-of-thought / long thinking.** Reply with code changes only. Ask a short question only when truly stuck.

## Context (do not re-do — Cursor already shipped)

Schema + money path are **done**:

- Migrations: `dining_tables`, `menu_modifier_groups`, `menu_modifier_options`, `order_tenders`, `pos_voids` + extensions on `orders` / `order_items` / `menu_items`
- Actions in `web/src/app/actions/erp-pos.ts` (do not edit):
  - `createDeskOrder` — accepts `table_id`, `covers`, `course_count`, `server_staff_id`, `is_parked`, cart lines with `modifiers`, `courseNo`, `seatNo`, `lineNotes`
  - `parkOrder` / `unparkOrder`
  - `voidOrder` / `voidOrderItem` (reason_code + optional `manager_pin`)
  - `splitSettle` (JSON `tenders` array)
  - `recallOrder` / `updateTableStatus`
  - Existing: `updateOrderKotStatus`, `postOrderToBookingFolio`, `postGuestServiceCharge`
- Loaders / types in `web/src/lib/pos.ts` + `loadMenuByOutlets` (now returns `is_popular`, `prep_station`, `image_src`)
- Live refresh: `DeskLiveRefresh` + `/api/erp/kot-version` already fingerprint park/void/settle

Your job is **presentational POS UI only**. Wire forms to the existing actions via `useActionState` / form `action={...}`. No new money math — import `calculateOrderTotals` / `formatBtn` from `@/lib/pricing` for display only.

## Task

Rebuild `/erp/pos` into a modern 3-pane hotel POS:

1. Left: category rail + search
2. Center: visual menu tile grid (Cloudinary `image_src`, monogram fallback)
3. Right: ticket header + cart + settle / send

Plus open-tickets drawer, modifier dialog, void dialog, guest-service aside (keep existing `GuestServiceForm` or restyle lightly).

## Locked defaults (no questions)

- Layout: desktop 3-pane (`grid` with categories ~160px, menu `1fr`, cart ~360px). Mobile: menu full width, cart in bottom `Sheet`.
- Visual tiles: square-ish cards, image cover, name + price, GST badge, popular flag. Missing image → monogram from first letter on muted bg (no grey placeholders that look broken).
- Touch targets ≥ 44px. Spacing scale 4/8/12/16/24/32/48/64/96.
- Brand: ivory/cream bg, espresso text, maroon accent, gold/citrus CTA. No purple gradients, no card-soup, no pill-stat clutter.
- Reuse existing UI primitives only: `Button`, `Dialog`, `Sheet`, `Tabs`, `Input`, `Badge`, `Skeleton`, `HoverCard`, `Label`, `Textarea`, `Select`, `Checkbox`, `Alert`. **No new UI primitives.**
- Keep `GuestServiceForm` on the page (aside or secondary tab) — do not delete guest-service posting.
- Keep desk auth gate on the page (existing redirect pattern).
- After successful `createDeskOrder`: show success strip with order id + total + buttons New ticket / Order board (same idea as current success state).
- Cart JSON field name must stay `cart` (hidden input). Each line shape:

```ts
{
  menuItemId: string;
  qty: number;
  modifiers?: { groupId: string; optionId: string; qty?: number }[];
  courseNo?: number; // default 1
  seatNo?: number;
  lineNotes?: string;
}
```

- Extra create fields (hidden or inputs): `outlet`, `settle_mode` (`cash` | `room_charge`), `booking_id`, `customer_name`, `phone`, `notes`, `table_id`, `covers`, `course_count`, `server_staff_id`, `is_parked` (`1`/`0`), `service_charge_applied`, `service_charge_rate`, `service_charge_reason`
- Void: `reason_code` one of `guest_change|kitchen_error|wrong_item|comp|manager_comp|duplicate|training|other`; show `manager_pin` when amount ≥ 500 or reason is `comp` / `manager_comp`
- Split settle: hidden `tenders` JSON `[{ method, amountBtn, reference?, bookingId? }]` methods: `cash|bank|card|agent_credit|bank_qr|pay_bt|deposit|room_charge`. Sum must equal order total.
- Cash quick denominations for Bhutan: 100, 500, 1000 Nu buttons that add to cash tender amount.
- Include `<DeskLiveRefresh />` in the open-tickets header.

## Allowed files

- `web/src/app/erp/pos/page.tsx` (rewrite layout + loaders)
- `web/src/components/erp/pos/PosLayout.tsx` (**new**)
- `web/src/components/erp/pos/MenuGrid.tsx` (**new**)
- `web/src/components/erp/pos/MenuTile.tsx` (**new**)
- `web/src/components/erp/pos/ModifierDialog.tsx` (**new**)
- `web/src/components/erp/pos/CartPanel.tsx` (**new**)
- `web/src/components/erp/pos/TicketHeader.tsx` (**new**)
- `web/src/components/erp/pos/OpenTicketsDrawer.tsx` (**new**)
- `web/src/components/erp/pos/SettlePanel.tsx` (**new**)
- `web/src/components/erp/pos/VoidReasonDialog.tsx` (**new**)
- `web/src/components/erp/pos/PosSearch.tsx` (**new**)
- `web/src/components/erp/pos/KitchenTicketStrip.tsx` (**new**)
- `web/src/components/erp/GuestServiceForm.tsx` (light restyle only if needed)
- `web/src/components/erp/DeskPosForm.tsx` — **prefer leave unused / thin re-export**; new UI lives under `components/erp/pos/`. Do not delete until Cursor confirms.

## Do not touch

- `web/src/app/actions/**` (especially `erp-pos.ts`)
- `web/src/lib/pricing.ts`, `web/src/lib/pos.ts`, `web/src/lib/accounting/**`
- `supabase/**`, auth, RLS, middleware, `.env*`
- `/erp/finance/**`, `/erp/channel/**`, `/erp/hr/**`, night audit, payments core
- New shadcn primitives / new npm packages

## Page loader contract (`pos/page.tsx`)

Server component should load (via existing helpers):

```ts
import { loadMenuByOutlets } from "@/lib/menu-loader";
import {
  loadDiningTables,
  loadModifierGroupsForItems,
  loadOpenPosTickets,
} from "@/lib/pos";
```

Pass into client shell:

- `items` (menu)
- `modifierGroups` (from `loadModifierGroupsForItems(items.map(i => i.id))`)
- `tables` (`loadDiningTables`)
- `openTickets` (`loadOpenPosTickets`)
- `bookings` (same query pattern as current page — in-house / confirmed)
- `gstRate`, `serviceChargeRate`, `serviceChargeDefaultOn` from property

## Patterns to copy

- Desk forms: `DeskPosForm.tsx` (cart + `useActionState` + toast)
- Shell spacing: `DeskShell` / other ERP pages under `/erp/calendar`
- Dialogs: existing `CalendarReservationDialog.tsx` style
- Tokens: `web/src/app/globals.css` + design system (ivory/espresso/maroon/gold)

## Acceptance

- [ ] `npm run build` in `web/` passes
- [ ] Can add items with modifiers, notes, course/seat; send ticket via `createDeskOrder`
- [ ] Can park / unpark / void (with reason) / split-settle using existing actions
- [ ] Visual tiles with monogram fallback; search + category filter work
- [ ] Open-tickets drawer lists parked + active; live badge present
- [ ] No new money formulas; no new schema; no new UI primitive packages
- [ ] Reply only: files changed + how to test `/erp/pos`

## Cursor review checklist (after your PR — do not do this yourself)

- [ ] Money stays in `erp-pos.ts` / `pricing.ts` only
- [ ] No new UI primitives or deps
- [ ] Design tokens honored
- [ ] Form field contracts match actions above

## Done means

Cursor reviews the diff; you do not merge unless asked. **Start implementing now.**
