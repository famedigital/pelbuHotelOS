# Hotel OS v2 — UX guardrails (lazy-proof / fool-proof)

> Canonical UX rules from Claude plan §11. Checked in every UI review via .cursor/skills/v2-ux-guardrails.
> Related: [DESIGN-SYSTEM.md](./DESIGN-SYSTEM.md) · [MODULES.md](./MODULES.md)
## 11. "Smart, lazy-proof, fool-proof" UX rules (apply to every module)

The goal: staff do the **fewest taps possible**, the system **does the obvious things itself**, and **mistakes are hard to make and easy to undo**.

### 11.1 The system does it for you (automation)
| Automation | Module |
|---|---|
| **Auto-assign rooms** on confirm (type, floor and view preference, groups placed together, cleanest/inspected first); staff only fix exceptions | StayView |
| **Passport/CID scan** with the camera: MRZ read fills name, nationality, doc no., DOB, expiry; no typing | Guests, Desk, Agent portal, Website pre-arrival |
| **Smart prefill**: returning guest → last preferences; agent → their tier, usual meal plan, usual guide; walk-in → today's best available rate | Reservations |
| **Auto night audit** at the set time if pre-checks pass; otherwise it pings the FO Manager with a fix list | Night Audit |
| **Auto housekeeping tasks** from departures/stayovers, auto-balanced across attendants | Housekeeping |
| **Auto messages**: confirmation, pre-arrival (D-2) with the document link, thank-you + review | Marketing |
| **Auto agent statements** monthly + overdue reminders | Agents |
| **Auto reorder suggestions** from par levels and recipe usage | Purchases |
| **Auto SDF/GST** lines and returns ready at month end | Finance, Compliance |
| **Auto backups** and integrity checks nightly | Platform |

### 11.2 One box does everything
- **Smart command bar (`Ctrl+K`, or tap the search pill on mobile)** accepts plain language:
  - `2 deluxe 12-15 dec soul trips MAP` opens Fast Book prefilled. The parse is shown as editable chips, and nothing saves without a confirm.
  - `room 104` opens the stay. `pema` lists matching guests, staff and agents (fuzzy, typo-tolerant). `dirty rooms` jumps to filtered HK. `cash today` shows the cashier report.
- This is powered by Innora AI (module 29), with a deterministic parser as the first layer, so common commands work offline and instantly.

### 11.3 Fool-proof guardrails
- **Impossible is invisible or disabled with a reason.** For example: "Check-in disabled: room 104 is dirty. [Mark inspected] [Pick another room]". Every block offers the fix as a button.
- **Undo, not "Are you sure?"**, for non-money actions: a 10-second undo toast (room move, status change, edit).
- **Money actions:**
  - a confirm card showing the exact amounts
  - the manager PIN where policy requires it
  - the result shown as a printed number (PSBN/INV)
  - never optimistic
- **Smart validation while typing:** rate below floor (amber + approval route), duplicate booking for the same guest and dates, passport expiring before departure, agent over credit limit, guest balance not paid at checkout.
- **No dead ends:** every empty state has one primary action. Every error says what happened, why, and gives a button to fix it.
- **Same pattern everywhere:** every list uses one table component with search, filters, saved views, group-by, multi-select, bulk actions, and export (XLSX/PDF/print). Learn it once, use it in all 29 modules.

### 11.4 Right amount of screen for each person
- **Role landing + "My day"**: each role opens on a to-do queue, e.g. FO gets "3 arrivals unassigned, 2 balances due, 1 change request".
- **Simple / Pro mode** per user. Simple hides advanced fields (rate overrides, GL codes); Pro shows everything plus keyboard shortcuts.
- **Next-best-action chips** on StayHub: "Collect Nu. 3,200", "Upload 2 passports", "Assign room".
- **Smart alerts** (AI-assisted anomaly checks): large discount, void spike, cash variance, rate far below floor, duplicate guest, no-show risk. These go to Owner/GM with one-tap drill-down.

### 11.5 Learn-free onboarding
- Seeded `demo-hotel` with sample data and a **training mode** per user (POS training reused), where nothing posts to the real ledger.
- An onboarding checklist in Settings: rooms → rates → tax → staff → printers → go live.
- Inline 1-line tips on first use; a `?` key opens a shortcut sheet and short GIF how-tos per screen.

---


