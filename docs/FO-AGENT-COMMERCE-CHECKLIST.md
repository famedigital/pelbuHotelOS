# FO / agent commerce — production & competitive gap checklist

**Date:** 2026-08-09 · **Docs re-sync:** 2026-08-10 (with full FEATURES/WHITEBOARD pass after `fc23144`)  
**Comparators:** eZee Absolute (hotel PMS FO) · Yanolja / Cloudbeds-class mid-market PMS (channel + multi-property patterns where public).  
**Scope:** Front office stay money, agents, Bhutan practice — not full Opera parity.

---

## A. Just shipped / in progress (this pass)

| ID | Item | Status |
|----|------|--------|
| P0 | StayHub: in-house opens **Folio**, not Checkout; rail click does not snap back from `?step=check_out` | **Fixed 2026-08-09** |
| P0 | Domain “current” tracks **active panel** (`forceCurrent`) | **Fixed** |
| P0b | Checkout with open Due → primary **Collect payment first** (local pay-at-end) | **Shipped** (label + path) |
| PLAN | Full agent commerce (guide photo, seal email, room cap, soft 30%) | **P1–P3 shipped 2026-08-09** (soft advance fields available; no hard 30% wall) |
| P0c | Folio POS always visible + guest F&B / charge agent AR / agent tab | **Shipped 2026-08-09** |
| P0d | Stay confirmation **`PS-YYYY-#####`** + RES/Ctrl+K search | **Shipped 2026-08-10** |

### Agent leave + FO email (product)

1. Print settlement pack → guide signs **ink**  
2. Staff attach evidence: **phone camera** **or** **scanner / PC file** (Drive/desktop)  
3. Status photo/waived → **guests may leave** (`confirmCheckOut` gated for agent stays)  
4. After leave: FO **Seal pack** + **Email agent** + dossier Money tab lists packs  

Evidence inputs are both `capture` camera and plain file pick (PDF/image).

### UAT retest (Simon / departures deep link)

- [ ] Open `…/erp/departures?booking=<id>&step=check_out` → lands Checkout (OK for explicit step)  
- [ ] Click **Folio** → stays on Folio Bill; URL becomes `step=stay_money`  
- [ ] Click Checkout again → leave panel  
- [ ] Open same booking without step → lands **Folio** even if balance 0  
- [ ] Open Due → Checkout footer “Collect payment first” → Collect tab  

---

## B. Process by guest type (target product — plan)

| Type | Book → stay | Pay | Leave evidence |
|------|-------------|-----|----------------|
| **Local ~90%** | Soft confirm | **Pay at checkout** (cash/QR/bank) | No guide pack |
| **Regional direct** | Soft / optional deposit | Often balance at leave | Same as local |
| **International direct** | Docs gate; optional deposit link | Partial prepay + leave | SDF/docs |
| **Agent tour** | Soft confirm; optional paper 30% | Guest part + **agent AR** | **Print + guide ink + photo + seal email** |
| **Agent control** | open room cap 10–20, not Nu 50k | AR dossier posted/paid/balance | Pack per stay |

---

## C. vs eZee Absolute (FO / money)

**Full external map:** [competitive/ezee-absolute-full-map.md](competitive/ezee-absolute-full-map.md) · **Desk hang-card:** [ops/fo-ezee-to-pelbu-hang-card.md](ops/fo-ezee-to-pelbu-hang-card.md) · **Pay-at-end UAT:** [ops/fo-pay-at-end-and-room-cap-uat.md](ops/fo-pay-at-end-and-room-cap-uat.md)

| Capability | eZee (typical) | Pelbu today | Gap severity | Action |
|------------|----------------|-------------|--------------|--------|
| Single stay hub | Multi screens / more menu depth | StayHub modal (dense shell shipped) | Pelbu simpler — **feature** | Density residual only if UAT red |
| Business working date | Status bar always | Header **Biz MM-DD** → night audit | **Done** (2026-08-10) | — |
| Net locks / concurrent | Hard room lock | Soft multi-tab lock banner | **L** | Done soft; server lock later if needed |
| Stay View right-click | CI / amend / folio | Rack context: CI · Folio · CO · details | **Done** | — |
| Universal search | Guest/room/res/folio | Ctrl+K + conf/phone/folio labels | **Done** | — |
| Folio multi-bill (room / F&B / master) | Strong | Bill tabs + Advanced master link + full folio attach | **M** residual group CI | Advanced section points to master tools |
| Deposit / advance at confirm | Common | Soft confirm + advance badges | **L** soft | Soft pay train doc |
| Agent city ledger / AR | Cashiering Center | Collect → Charge agent AR + dossier + open room cap | **Done** core | Soft train |
| Settlement print for agent/guide | Print bills | Print pack + guide ink + photo/file + sealed email | **Done** (Bhutan pack) |
| Email bill to agent | Yes | Sealed pack email (Resend) + fiscal email | **Done** pack; fiscal separate |
| Confirmation search | Ref # | **`PS-YYYY-#####`** RES/Ctrl+K | **Done** |
| Pay at checkout FO path | Standard | Folio Collect; P0b Collect CTA | **L** after P0b | UAT locals |
| Cancel / no-show fees | Config + reason | Policies + lifecycle dialogs | **Done** | — |
| Folio F&B visible + agent tab | Split bills | POS strip + agent AR options | **Done** |
| Night audit | Deep | Audited close + blockers | **L** residual | Ops discipline |
| OTA / Channex | eZee channel | Channex queue; **cert open** | **H** for OTA hotels | CHANNEX-CERT |
| Rate plans / dynamic | Deep | Packages + agreed rate + tiers | **M** enterprise | Accept boutique scope |
| Housekeeping status sync | Full suite | Rooms HK + dirty on CO | **L–M** | OK for boutique |
| Reports pack | Heavy | Named catalog + flash | **M** | Add unsecured agent exposure |
| Multi-property chain | eZee SaaS | Property context + group lite | **H** for BTCL | Later tenant wave |
| Mobile FO app | Dedicated apps | PWA desk | **M** phone Collect is fine | Guide photo PWA-first |

---

## D. vs Yanolja / Cloudbeds-class (ops SaaS)

| Capability | Competitor pattern | Pelbu | Gap |
|------------|-------------------|-------|-----|
| Self-service agent portal | Some mid-market | None (email + desk dossier) | **L** Day-1 OK; portal later |
| Marketplace / OTA heavy | Yanolja core | Direct + agents + Channex | Intentional |
| Instant messaging to guest | Often | CallMeBot / WA patterns | **L** |
| Revenue management UI | Central | Manual rates | Boutique OK |
| Multi-language staff UI | Often | English FO | **L** for some staff |

---

## E. Production issues / money integrity (ops risk)

| Risk | Severity | Notes |
|------|----------|-------|
| Agent directory can book but not credit | Operational | Promote Journey DMC before AR collects |
| Nu credit_limit vs room reality | Product | Prefer room-cap; don’t train Nu 50k |
| Void/reverse agent credit integrity | Money | Audit ledger on every void of agent_credit tender |
| Double-pay / webhook | Mitigated | Idempotency keys (audit) |
| Night audit with open folios | Ops | Blockers; force-close with note |
| Guide signed paper missing → agent dispute | **H** process | Build P1; until then paper folder SOP |
| Live Pay.bt / e-invoice DRC | **M–H** | Desk-confirm until merchant/DRC live |
| Channex live cert | **H** if relying on OTAs | Track CHANNEX-CERT |
| Staff class-12 UX density | **H** train | One path: Folio money, Checkout leave |

---

## F. Ranked backlog (after P0)

1. **P1 guide pack + camera photo** (agent payment evidence)  
2. **P1b seal + email agent + dossier Open pack**  
3. **P2b open-room capacity** (primary credit control)  
4. Soft 30% banners (P2)  
5. Agent book polish + room open/paid totals (P3)  
6. Group folio CI depth  
7. Channel cert  

---

## G. Honest score (Boutique Olakha, not chain)

| Area | vs eZee FO boutique | Notes |
|------|---------------------|-------|
| Bhutan ops (guide/SDF/agents) | **Ahead if pack ships** | eZee weaker on tour guide paper culture |
| Classic FO depth | Behind multi-folio/group | Accept; StayHub simplicity is strategy |
| Money path integrity | Competitive if audited | Keep journals + sequences |
| Channel / SaaS scale | Behind | Not Day-1 flagship risk for single hotel |

---

## H. Done when (acceptance)

- [x] Folio click never snap-back from departures `step=check_out`  
- [ ] Local pay-at-end UAT green on 3 stays — print [ops/wave-a-desk-drills.md](ops/wave-a-desk-drills.md)  
- [ ] Agent: photo + email pack on 1 live Checkout  
- [ ] Agent dossier shows posted/paid + pack link  
- [ ] Room-cap gate on CI for heavy agent  
- [x] Hang-card + UAT sheets ready for FO shift drills  
- [x] StayHub in-hub bill split / extras folio / master tools (Wave B1)  
- [x] Party board bulk check-in + master collect (Wave B2)  
- [x] Agent production + commission reports linked from dossier (Wave B3)  
- [x] DB stay lease + guest WA templates + ID photo on CI + NA FO flash (Wave C)  
- [x] Agent AR void + trust docs (Wave D process for Pay.bt / support rota)  

Competitive map (except channel): [competitive/ezee-absolute-full-map.md](competitive/ezee-absolute-full-map.md).  
Channel remains explicit next wave — [CHANNEX-CERT.md](CHANNEX-CERT.md). 
