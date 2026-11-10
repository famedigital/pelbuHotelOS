# CURSOR COMPOSER: ENTERPRISE PUBLIC HOMEPAGE (INNORA / HOTEL OS V2)

> **Specification Reference:** `docs/v2/PUBLIC-HOMEPAGE-ENTERPRISE-SPEC.md`  
> **Target File:** `v2/apps/web/src/app/page.tsx` & `v2/apps/web/src/app/layout.tsx`  

---

```markdown
# MISSION BRIEF: BUILD THE COMMANDING ENTERPRISE PUBLIC HOMEPAGE FOR INNORA

Build the complete, authoritative, enterprise-grade public marketing homepage in `v2/apps/web/src/app/page.tsx` following the exact narrative, problem space, and design architecture defined in `docs/v2/PUBLIC-HOMEPAGE-ENTERPRISE-SPEC.md`.

## 1. Core Visual & Aesthetic Standard
- **Design Tone:** Apple VisionOS Spatial Glass × Linear Command Density × Aman / Six Senses Himalayan Luxury.
- **Typography:** Load and enforce `Plus Jakarta Sans` for display/headings and `JetBrains Mono` for all tabular figures, currencies (`Nu.`), dates, and room codes.
- **Color & Lighting:** Deep obsidian canvas `#070b12` with atmospheric sapphire (`rgba(59,130,246,0.14)`) and warm Himalayan brass (`rgba(245,158,11,0.08)`) radial mesh cones. Layered glass cards with 20px blur and specular top rim highlights (`inset 0 1px 0 rgba(255,255,255,0.18)`).
- **Mobile First Priority:** Flawless ergonomics on mobile (<768px) with 48px touch targets, sticky bottom action bar, and zero horizontal overflow.

---

## 2. Page Sections to Implement

### Section 1: Frosted Glass Executive Navbar
- Floating pill header with brand crest (👑 `Innora` by Pelbu · Hotel OS v2).
- Dropdown links: The Ecosystem (Guide, Driver, Desk, Agent), The Broken Relay, Bhutan DRC Engine, ROI Calculator.
- Right array: Live mountain telemetry chip (`✈️ PBH Flight Radar · Thimphu 14°C`), Sign In button, and primary CTA `[Launch Cockpit 🚀]`.

### Section 2: Commanding Hero Section
- **Headline:** *"The Sovereign Operating System for Himalayan Hospitality."*
- **Subhead:** *"Uniting Hotel Receptions, Tour Guides, Fleet Drivers, Travel Agents, and Kitchens into one real-time, zero-latency ecosystem. Built for the rugged operational realities of Bhutan."*
- **CTAs:** `[Experience Interactive Demo →]` (links to `/desk`) and `[Watch 2-Minute Ecosystem Film ▶]`.
- **Interactive 3D Bento Chassis Preview:** Displays real-time live telemetry flowing between Guide Sangay, the Kitchen KDS, Driver Tashi (Dorm Bed B-02), and the Front Desk Cockpit.

### Section 3: "The Broken Relay" — Real-Life Friction Matrix
Interactive high-contrast bento cards capturing real-world Bhutanese hospitality pain vs. Innora's synchronized solution:
1. **The Reception Phone & WhatsApp Black Hole:** Front desk phones ringing while 14 box breakfasts for Tiger's Nest hike are forgotten in unread WhatsApp voice notes vs. Guide's 1-tap mobile box order arriving directly on the Kitchen KDS at 4 PM.
2. **Driver Neglect, Coaster Parking & Dorm Bed Scramble:** 22-seater coaster bus blocked on narrow roads, exhausted driver wandering the lobby with no dorm bed vs. Auto-reserved bus parking bay and assigned clean Driver Dorm Bed B-02 + 1-tap till fuel advance.
3. **Late Information & Frantic Housekeeping Radio Calls:** Voucher rollaway bed request sitting unread in email inbox while guests wait in lobby vs. Voucher parsed on booking and Housekeeping Hallway Mode preparing Room 204 with extra bed 3 hours early.
4. **Agent Allotment Blindspot & Competitor Leakage:** Waiting 24 hours for room confirmation during Paro Tshechu festival vs. 24/7 B2B Partner Portal with live inventory and competitor masking ("Occupied · Tour Group").
5. **Dual-Folio Incidentals Dispute:** Guest departs without settling Nu. 4,500 personal bar/laundry bill vs. Dual-Folio Settlement Gate strictly blocking checkout if Personal Balance > Nu. 0.50.

### Section 4: The 5-Way Synchronized Ecosystem (Interactive Tabs)
Tabbed interactive showcase of the 5 role-based workspaces:
- **🏨 The Hotelier 100vh Mission Control:** Zero-scroll desktop cockpit, cashier till vault, 1-click autonomous night audit.
- **🧭 The Tour Guide Companion (Mobile PWA):** 1-tap group arrival check-in with passport OCR in transit, dietary matrix (pure veg, gluten-free), box breakfast order dispatcher.
- **🚗 The Fleet Driver Hub (Mobile PWA):** Assigned driver dorm bed, coaster bus parking bay, 1-tap fuel/market till advance.
- **💼 The B2B Travel Agent Portal:** Real-time masked inventory, 48-hr allotment blocker, contracted MoU rates, digital voucher upload.
- **👑 The Sovereign Guest Experience:** 8-second check-in, pre-encoded keycards, stay preferences remembered across visits (Cordyceps tea, quiet top floor).

### Section 5: Bhutan Sovereign Fiscal & Regulatory Engine
- Automated DRC Form BST-3 Tax Return (10% BST vs 10% SC tip pool).
- 10% Service Charge Tip Pool Distribution Matrix prorated by biometric attendance days.
- Biometric ZKTeco Push Terminal Integration (`POST /iclock/cdata?table=ATTLOG`).
- Daily Royal Bhutan Police (RBP) & Department of Immigration Manifest 1-click exporter.

### Section 6: Interactive Operations ROI Value Calculator
- Sliders for Room Count (12 to 80 rooms) and Average Occupancy (30% to 90%).
- Live calculated metrics: Hours saved per month on front-desk admin, eliminated folio incidentals leakage in Nu., average check-in speed reduction (12m → 8s), and zero DRC tax errors.

### Section 7: Authority Testimonials, Regulatory Badges & Grand CTA Footer
- Quotes from senior Bhutanese tour guides (Yangphel), hoteliers (Pelbu Suites), and travel agents.
- Compliance badges: DRC Bhutan, RMA Gateway, DoT Star Standards, RBP Immigration.
- High-impact closing banner: *"Replace the telephone chaos. Commission your sovereign hotel in 10 minutes."* with `[Launch Free Hotel Onboarding]` and `[Schedule Executive Walkthrough]`.

---

## 3. Verification & Quality Gates
1. Run `cd v2 && pnpm --filter @hos-v2/web build` (Next.js production build must compile with 0 errors).
2. Verify responsive layout at 390px (mobile priority), 768px (tablet), and 1920px (desktop).
3. Ensure zero superficial placeholder text or generic lorem ipsum.
```
