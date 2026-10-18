# Desk Killer — hardened plan (WOW / smart / fast)

**Status:** HARDENED · layout **MIX** · 2026-10-18  
**Bar:** Beat eZee on FO speed; win Bhutan on agents / SDF-later / dinner covers.

---

## Non-negotiables

| # | Rule |
|---|------|
| 1 | Phone ask answered in **≤5s** (free / held / rate) |
| 2 | Hold or walk-in CI in **≤20s** |
| 3 | FO never hunts a maze of modules — **Board · Ask · Reserve · More** only |
| 4 | **One rate sheet** (owner + reservation pre-build). FO **selects**, does not invent |
| 5 | **Custom rate** exists, but is an escape hatch (PIN / GM) — not the default path |
| 6 | Gemini BYOK = **smart draft → Confirm** — never silent money |
| 7 | Assign room **later** by default (HK prep). Auto-assign is opt-in |
| 8 | Instant CI = name/agent + room; docs later |

If any of these fail UAT, we do not launch.

---

## Visual language — MIX (locked)

| Surface | Style |
|---------|--------|
| Login dept · HK rooms | **T** big tiles |
| FO board · Ask · Reserve · F&B · Kitchen | **W** fat rows + sticky CTAs |

---

## Rates — one sheet, select, optional custom

### Who builds rates
**Owner + reservation** agree seasons / room types / tiers **before** the busy season.  
That becomes **the** property rate sheet (rows already in `room_rates` + seasons).

### What FO sees (not confusing)

On Ask and Reserve, **one control**:

```
Rate:  [ Public ▼ ]  [ Agents ▼ ]  [ Friends ]  [ Custom… ]
```

Rules:

1. **Default**
   - Walk-in / no agent → **Public**
   - Agent on booking → that agent’s sheet tier (**Agents** / MOU / special) — auto from agent profile, FO can override to Public if needed
2. **Selecting a sheet line** fills nightly Nu automatically (by room type + season + dates)
3. **No tax-toggle wall** on FO — tax follows property settings
4. **Custom…**
   - Opens Nu field + reason
   - Requires **manager PIN** (or GM session) unless within tiny tolerance later
   - Logged in audit

### What FO must never see
- Multiple competing pickers (sheet tier + personal + MOU + friends + pickup + tax mode all at once)
- Live “rebuild rate sheet” while on a call
- Empty rates with no guidance

### Admin / reservation home
Separate **Rate sheet** editor (GM only): seasons × types × Public / Agents / Friends / MOU.  
FO only **consumes** it.

---

## Smart + fast — how Assist fits

**FO Assist** is one bar (not 10 panels).

| Input | Smart does | Confirm |
|-------|------------|---------|
| `/` + `3 rooms 22 oct 3n` | Parse → free/held + **sheet rates** | Enter → Reserve |
| Paste WhatsApp | Stay draft (who/when/qty/agent) | Hold / CI |
| “Check in Tashi 305” | Name + room + docs deferred | Confirm CI |
| “Invoice this stay” | Notes + pick open folio | Confirm **Issue INV** |

Gemini is optional sugar for messy paste.  
**Ask parser + rate sheet lookup must work without Gemini** (offline-feel / key missing).

---

## FO shell (declutter)

```
[ Board ]  [ Ask / ]  [ Reserve ]  [ More ▾ ]
```

**More** = rack, night audit, advanced DeskBook, settings, training, …  
Dept login lands FO here — not the full ERP catalog.

---

## Screens (final map)

| # | Screen | Job |
|---|--------|-----|
| 1–3 | Login | Hotel → dept tiles → staff + PIN |
| 4 | Board | Pax / dinner / clean · Coming / In / Leaving |
| 4b | **Ask /** | Free · Held · In · **Rate from sheet** · YES/NO |
| 5 | **20s Reserve** | Who · When · What · **Rate select** · Hold / CI |
| 6 | Update guest | Docs later |
| 7–9 | HK / Kitchen / F&B | One home each |
| 10 | Admin | Rate sheet editor · night close · money · Assist invoices |

---

## 20s Reserve fields (only these visible)

1. Who (guest **or** agent)  
2. When (Tonight / Tomorrow / Custom + nights)  
3. What (Assign later **or** type × qty)  
4. **Rate** (sheet dropdown — one list)  

Footer: **Hold** | **Check in now**  
Collapsed More: meal plan, custom Nu+PIN, backdate PIN, guide  

Prefill from Ask.

---

## Keyboard (speed path)

| Key | Action |
|-----|--------|
| `/` or F2 | Ask |
| N | Reserve |
| I | Instant CI |
| In Ask: Enter | Reserve prefilled |
| In Reserve: Ctrl+Enter | Hold |
| Ctrl+Shift+Enter | CI now |
| On Rate: ↑↓ | Change sheet tier |

---

## Success (UAT gate)

- [ ] “3 rooms 22 Oct 3n?” → YES/NO + sheet rate in ≤5s  
- [ ] Same → Hold in ≤20s with rate = Agents (or Public) from sheet  
- [ ] Custom rate blocked without PIN  
- [ ] Instant CI without CID  
- [ ] FO nav only Board / Ask / Reserve / More  
- [ ] Gemini paste → Confirm Hold works with BYOK key  

---

## Build order (hardened)

1. **Declutter FO nav** → Board / Ask / Reserve / More  
2. **One rate select UX** on Ask + Reserve (consume `room_rates`, kill FO pickup maze)  
3. **Ask /** fast RPC (free/held + sheet rate) — no Gemini required  
4. **20s Reserve** as FO default (DeskBook → Advanced in More)  
5. Wire **Assist Confirm** → Reserve / CI / Issue invoice  
6. Login tiles · HK · Kitchen · F&B homes  
7. Speed pass (no fat calendar on Ask/Reserve)

---

## Explicitly out until after WOW

RocketChat · full offline LAN · rewriting Postgres · marketing/3D on desk · more sidebar modules
