# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: fo-ops-matrix.spec.ts >> FO ops matrix · agent / walk-in / partner >> Case 1 · Group agent · POS room A + laundry room B
- Location: e2e\fo-ops-matrix.spec.ts:212:3

# Error details

```
Error: expect(received).toBeGreaterThan(expected)

Expected: > 0
Received:   0

Call Log:
- Timeout 60000ms exceeded while waiting on the predicate
```

# Page snapshot

```yaml
- generic:
  - generic:
    - generic:
      - generic:
        - generic:
          - banner [aria-hidden]:
            - generic:
              - generic:
                - button: «
                - button:
                  - generic:
                    - generic:
                      - strong: Demo Hotel
                      - generic: ★★★★
                    - paragraph: demo-hotel · sovereign desk
              - button:
                - generic: "Search reservation, guest, room #"
                - generic: ⌘K
              - generic:
                - generic:
                  - generic: 09 Nov
                  - generic: · S1
                - button:
                  - generic: Audit
                  - generic: 75%
                - generic:
                  - generic: Live
                  - generic:
                    - generic:
                      - generic: Nu.
                      - generic: 48,250
                      - generic: ".00"
                - button
                - button
                - button:
                  - generic: Fast Book
                  - generic: ⌘B
                - button
                - button:
                  - generic: KD
                  - generic: Karma
          - generic [aria-hidden]:
            - navigation:
              - link:
                - /url: /
                - generic: PIN Gateway
              - generic:
                - heading [level=3]: Front Office
                - link:
                  - /url: /desk
                  - generic: Desk (Today)
                  - generic: "2"
                - link:
                  - /url: /reservations
                  - generic: Reservations
                - link:
                  - /url: /stayview
                  - generic: StayView
                  - generic: 4%
                - link:
                  - /url: /groups
                  - generic: Groups
                - link:
                  - /url: /guests
                  - generic: Guests
                - link:
                  - /url: /telegram
                  - generic: Hermes Telegram
                - link:
                  - /url: /night-audit
                  - generic: Night Audit
              - generic:
                - heading [level=3]: Rooms
                - link:
                  - /url: /housekeeping
                  - generic: Housekeeping
                  - generic: "3"
                - link:
                  - /url: /laundry
                  - generic: Laundry
                - link:
                  - /url: /floormap
                  - generic: Floor Map
              - generic:
                - heading [level=3]: F&B
                - link:
                  - /url: /pos
                  - generic: POS
                - link:
                  - /url: /kds
                  - generic: KDS
              - generic:
                - heading [level=3]: Field companions
                - link:
                  - /url: /ecosystem/guide
                  - generic: Guide Companion
                - link:
                  - /url: /ecosystem/driver
                  - generic: Driver Companion
              - generic:
                - heading [level=3]: Sales
                - link:
                  - /url: /rates
                  - generic: Rates
                - link:
                  - /url: /agents
                  - generic: Agents
                - link:
                  - /url: /partner
                  - generic: Partner Portal
                - link:
                  - /url: /channel
                  - generic: Channel
                - link:
                  - /url: /loyalty
                  - generic: Loyalty
                - link:
                  - /url: /registry
                  - generic: Guides & Fleet
              - generic:
                - heading [level=3]: Finance
                - link:
                  - /url: /finance
                  - generic: Finance
                - link:
                  - /url: /purchases
                  - generic: Purchases
                - link:
                  - /url: /stock
                  - generic: Stock
                - link:
                  - /url: /bank-recon
                  - generic: Bank recon
                - link:
                  - /url: /compliance
                  - generic: Compliance
              - generic:
                - heading [level=3]: Ops plant
                - link:
                  - /url: /utilities
                  - generic: Utilities
                - link:
                  - /url: /amc
                  - generic: AMC
              - generic:
                - heading [level=3]: People
                - link:
                  - /url: /hr
                  - generic: HR
                - link:
                  - /url: /staff-portal
                  - generic: Staff Portal
              - generic:
                - heading [level=3]: Insights
                - link:
                  - /url: /reports
                  - generic: Reports
                - link:
                  - /url: /owner
                  - generic: Owner
              - generic:
                - heading [level=3]: Platform
                - link:
                  - /url: /settings
                  - generic: Settings
                - link:
                  - /url: /superadmin
                  - generic: Super-admin
                - link:
                  - /url: /cms
                  - generic: CMS
                - link:
                  - /url: /marketing
                  - generic: Marketing
                - link:
                  - /url: /innora-ai
                  - generic: Innora AI
              - generic:
                - heading [level=3]: Experiences
                - link:
                  - /url: /services
                  - generic: Services
                - link:
                  - /url: /events
                  - generic: Events & Banquets
                - link:
                  - /url: /website
                  - generic: Website notes
            - main:
              - generic:
                - generic:
                  - generic:
                    - heading [level=1]: DeskMonday, 09 Nov 2026
                    - button:
                      - generic: Audit
                      - generic: 75%
                  - generic:
                    - generic:
                      - generic:
                        - generic: Occupancy
                        - generic: ↑ 12.4%
                      - generic:
                        - generic: 4%
                        - generic: 1/24
                    - generic:
                      - generic: RevPAR
                      - generic: Nu. 4,235
                      - paragraph: ADR Nu. 3,500 · 10% SC in
                    - generic:
                      - generic: Arrivals
                      - generic:
                        - generic: "2"
                        - generic: ⚠ 2 unassigned
                    - generic:
                      - generic: Departures
                      - generic:
                        - generic: "0"
                        - generic: 0 checked-out
                    - generic:
                      - generic: Housekeeping
                      - generic:
                        - generic: "13"
                        - generic: "7"
                        - generic: "3"
                        - generic: "1"
                  - generic:
                    - generic: Floors
                    - generic:
                      - generic:
                        - generic: F1
                        - button: "101"
                        - button: "102"
                        - button: "103"
                        - button: "104"
                        - button: "105"
                        - button: "106"
                        - button: "107"
                        - button: "108"
                      - generic:
                        - generic: F2
                        - button: "201"
                        - button: "202"
                        - button: "203"
                        - button: "204"
                        - button: "205"
                        - button: "206"
                        - button: "207"
                        - button: "208"
                      - generic:
                        - generic: F3
                        - button: "301"
                        - button: "302"
                        - button: "303"
                        - button: "304"
                        - button: "305"
                        - button: "306"
                        - button: "307"
                        - button: "308"
                  - generic:
                    - generic:
                      - tablist:
                        - tab [selected]:
                          - generic:
                            - text: Arrivals
                            - generic: "2"
                        - tab:
                          - generic:
                            - text: In-House
                            - generic: "1"
                        - tab:
                          - generic:
                            - text: Departures
                            - generic: "0"
                        - tab:
                          - generic:
                            - text: Tomorrow
                            - generic: "0"
                      - generic:
                        - generic:
                          - searchbox
                        - button: VIP
                        - button: Auto-assign
                      - generic:
                        - generic:
                          - generic:
                            - generic: OG
                            - generic:
                              - generic:
                                - strong: OpsMtx Group mw8scj4n
                                - generic: 🇺🇸 USA
                              - paragraph: DH-2026-00005·Unassigned·1N · MAP·Yangphel Adventure Travel
                            - generic:
                              - generic:
                                - generic:
                                  - generic: Nu.
                                  - generic: 7,865
                                  - generic: ".00"
                              - text: Agency Nu. 7,865
                          - generic:
                            - button [disabled]: Check in
                            - button: Folio
                        - generic:
                          - generic:
                            - generic: OG
                            - generic:
                              - generic:
                                - strong: "OpsMtx Group mw8scj4n · #2"
                                - generic: 🇺🇸 USA
                              - paragraph: DH-2026-00006·Unassigned·1N · MAP·Yangphel Adventure Travel
                            - generic:
                              - generic:
                                - generic:
                                  - generic: Nu.
                                  - generic: 7,865
                                  - generic: ".00"
                              - text: Agency Nu. 7,865
                          - generic:
                            - button [disabled]: Check in
                            - button: Folio
                    - generic:
                      - generic:
                        - generic:
                          - generic:
                            - strong: Daily meal board
                            - paragraph: FO / F&B · mission control · agents see this for guest stay nights
                          - button: Post / edit
                        - paragraph: No menu for 2026-11-09 yet
                      - generic:
                        - generic:
                          - strong: VIP in-house
                          - generic: "0"
                        - paragraph: No VIPs in-house
                      - generic:
                        - generic:
                          - strong: Groups
                          - generic: "0"
                        - paragraph: No groups in-house
                      - generic:
                        - generic:
                          - strong: Till
                          - generic: Open
                        - generic: Nu. 48,250
                        - paragraph: Opening Nu. 10,000
                        - generic:
                          - button: + Cash Advance
                          - button: − Till Drop
                      - generic:
                        - strong: Shift checklist
                        - list:
                          - listitem: Arrivals assigned
                          - listitem: VIP keycards
                          - listitem: Till float counted
                          - listitem: Immigration manifest
          - region "Notifications alt+T"
  - dialog "Group StayHub" [ref=e2]:
    - banner [ref=e3]:
      - generic [ref=e4]:
        - generic [ref=e5]:
          - heading "Group StayHub" [level=2] [ref=e6]
          - paragraph [ref=e7]: Yangphel Adventure Travel · 2 rooms · Yangphel Adventure Travel
          - generic [ref=e8]:
            - generic [ref=e9]:
              - strong [ref=e10]: Yangphel Adventure Travel
              - generic [ref=e11]: 2 rooms
            - paragraph [ref=e12]: Focus OpsMtx Group mw8scj4n·Unassigned·confirmed
        - button "Close StayHub" [ref=e13]:
          - generic [aria-hidden] [ref=e14]: ×
    - generic [ref=e16]:
      - generic [ref=e17]:
        - button "Agency · 2 rooms Nu. 15,730 This room Nu. 7,865" [ref=e18]:
          - generic [ref=e19]: Agency · 2 rooms
          - generic [ref=e20]: Nu. 15,730
          - generic [ref=e21]: This room Nu. 7,865
        - button "Guest extras · room Nu. 0" [ref=e22]:
          - generic [ref=e23]: Guest extras · room
          - generic [ref=e24]: Nu. 0
      - generic [ref=e25]:
        - button "Rooms2" [active] [ref=e26]
        - button "Guests & Docs" [ref=e28]
        - button "Folio" [ref=e29]
        - button "This room" [ref=e30]
        - button "Notes" [ref=e31]
        - button "Audit" [ref=e32]
      - generic [ref=e33]:
        - generic [ref=e34]:
          - generic [ref=e35]:
            - generic [ref=e36]:
              - paragraph [ref=e37]: One agency bill
              - strong [ref=e38]: Yangphel Adventure Travel
              - paragraph [ref=e39]:
                - text: All rooms’
                - strong [ref=e40]: room + meals
                - text: on this master. Food, laundry, minibar stay on each
                - strong [ref=e41]: guest
                - text: folio.
              - paragraph [ref=e42]: 2 rooms · 0 luggage · MAP
            - button "Groups" [ref=e43]
          - generic [ref=e44]:
            - button "Agency master · all rooms Nu. 15,730 2 × room+meals · this room Nu. 7,865 Open group bill →" [ref=e45]:
              - generic [ref=e46]: Agency master · all rooms
              - generic [ref=e47]: Nu. 15,730
              - generic [ref=e48]: 2 × room+meals · this room Nu. 7,865
              - generic [ref=e49]: Open group bill →
            - generic [ref=e50]:
              - generic [ref=e51]: Guest extras · all rooms
              - generic [ref=e52]: Nu. 0
              - generic [ref=e53]: This room Nu. 0 · collect per room
        - generic [ref=e54]:
          - paragraph [ref=e55]: Menus served (read-only)
          - paragraph [ref=e56]: Posted on Desk mission control by FO / F&B — also shown to the agent
          - list [ref=e57]:
            - listitem [ref=e58]:
              - strong [ref=e59]: 2026-11-09
              - paragraph [ref=e60]: Not posted yet on Desk
        - generic [ref=e61]:
          - paragraph [ref=e62]: Apply meal to all rooms
          - generic [ref=e63]:
            - button "EP" [ref=e64]
            - button "CP" [ref=e65]
            - button "MAP" [ref=e66]
            - button "AP" [ref=e67]
        - generic [ref=e68]:
          - generic [ref=e69]:
            - paragraph [ref=e70]: Uniform party rate · despite category
            - generic [ref=e71]: Uniform · Nu. 6,200/n · all types
          - paragraph [ref=e72]: One EP room net on every peer (EXE, DLX, …). Meals stay on the meal control above.
          - generic [ref=e73]:
            - spinbutton "Party room net EP" [ref=e74]: "6200"
            - button "Apply to all rooms" [ref=e75]
        - generic [ref=e76]:
          - button "Check in party" [ref=e77]
          - button "Cancel all rooms" [ref=e78]
          - button "Print agency bill" [ref=e79]
          - button "Settle agency" [ref=e80]
        - generic [ref=e81]:
          - generic [ref=e82]: Peers · 2 · assign here
          - list [ref=e83]:
            - listitem [ref=e84]:
              - generic [ref=e85]:
                - button "— OpsMtx Group mw8scj4n· EXE-K" [ref=e86]:
                  - text: — OpsMtx Group mw8scj4n
                  - generic [ref=e87]: · EXE-K
                - generic [ref=e88]: ID deferred
                - generic [ref=e89]: Nu. 0
                - button "Cancel" [ref=e90]
              - generic [ref=e91]:
                - combobox [ref=e92] [cursor=pointer]:
                  - option "Select EXE-K…" [selected]
                  - option "301 · Executive King · clean"
                  - option "302 · Executive King · inspected"
                  - option "305 · Executive King · clean"
                  - option "306 · Executive King · clean"
                  - option "308 · Executive Suite · clean"
                - button "Upgrades" [ref=e93]
                - button "Assign" [disabled]
                - button "Luggage" [ref=e94]
                - button "Guests & Docs" [ref=e95]
            - listitem [ref=e96]:
              - generic [ref=e97]:
                - 'button "— OpsMtx Group mw8scj4n · #2· DLX-T" [ref=e98]':
                  - text: "— OpsMtx Group mw8scj4n · #2"
                  - generic [ref=e99]: · DLX-T
                - generic [ref=e100]: ID deferred
                - generic [ref=e101]: Nu. 0
                - button "Cancel" [ref=e102]
              - generic [ref=e103]:
                - combobox [ref=e104] [cursor=pointer]:
                  - option "Select DLX-T…" [selected]
                  - option "106 · Deluxe Twin · clean"
                - button "Upgrades" [ref=e105]
                - button "Assign" [disabled]
                - button "Luggage" [ref=e106]
                - button "Guests & Docs" [ref=e107]
    - contentinfo [ref=e108]:
      - generic [ref=e109]:
        - button "Assign rooms" [ref=e110]
        - button "Party check-in" [ref=e111]
        - button "Agency bill" [ref=e112]
        - button "Bill" [ref=e113]
```

# Test source

```ts
  47  |   await page.waitForTimeout(800);
  48  | }
  49  | 
  50  | function farDates(offsetDays: number, nights = 1) {
  51  |   const start = new Date();
  52  |   start.setUTCDate(start.getUTCDate() + offsetDays);
  53  |   const end = new Date(start);
  54  |   end.setUTCDate(end.getUTCDate() + nights);
  55  |   const ymd = (d: Date) => d.toISOString().slice(0, 10);
  56  |   return { in: ymd(start), out: ymd(end) };
  57  | }
  58  | 
  59  | async function dismissToasts(page: Page) {
  60  |   await page
  61  |     .locator("[data-sonner-toast]")
  62  |     .first()
  63  |     .waitFor({ state: "hidden", timeout: 6_000 })
  64  |     .catch(() => undefined);
  65  | }
  66  | 
  67  | async function completeDocGate(page: Page, docId: string) {
  68  |   const docPanel = page.getByTestId("stayhub-doc-capture");
  69  |   const legacyId = page.getByRole("textbox", { name: /Passport or CID/i });
  70  |   if (await docPanel.isVisible().catch(() => false)) {
  71  |     const docIdField = page.getByTestId("stayhub-doc-id");
  72  |     await docIdField.click();
  73  |     await docIdField.fill("");
  74  |     await docIdField.pressSequentially(docId, { delay: 10 });
  75  |     await page.getByTestId("stayhub-doc-nat").fill("International");
  76  |     await page.getByTestId("stayhub-doc-confirm").click({ force: true });
  77  |     return;
  78  |   }
  79  |   if (await legacyId.isVisible().catch(() => false)) {
  80  |     await legacyId.fill(docId);
  81  |     const nat = page.getByRole("textbox", { name: /^Nationality$/i }).first();
  82  |     if (await nat.isVisible().catch(() => false)) await nat.fill("International");
  83  |     const save = page.getByRole("button", { name: /Save & check in/i });
  84  |     if (await save.isVisible().catch(() => false)) {
  85  |       await save.evaluate((el: HTMLElement) => el.click());
  86  |     }
  87  |   }
  88  | }
  89  | 
  90  | async function assignBestAndCheckIn(page: Page, docId: string) {
  91  |   const assignCta = page.getByRole("button", { name: /^Assign room$/ });
  92  |   if (await assignCta.isVisible().catch(() => false)) {
  93  |     await assignCta.evaluate((el: HTMLElement) => el.click());
  94  |     const best = page.getByRole("button", { name: /Best/i }).first();
  95  |     await expect(best).toBeVisible({ timeout: 15_000 });
  96  |     await best.evaluate((el: HTMLElement) => el.click());
  97  |     await expect(
  98  |       page.locator("[data-sonner-toast]").filter({ hasText: /Assigned · Rm/i }),
  99  |     ).toBeVisible({ timeout: 20_000 });
  100 |     await page.waitForTimeout(600);
  101 |   }
  102 | 
  103 |   /* Group StayHub uses Party check-in; single stays use stayhub-check-in. */
  104 |   const partyBtn = page.getByRole("button", { name: /Party check-in|Check in party/i }).first();
  105 |   const checkInBtn = page.getByTestId("stayhub-check-in").first();
  106 |   if (await partyBtn.isVisible().catch(() => false)) {
  107 |     await partyBtn.evaluate((el: HTMLElement) => el.click());
  108 |     await completeDocGate(page, docId);
  109 |     /* Peer rooms may each open a doc gate — fill up to 3 times. */
  110 |     for (let i = 0; i < 3; i++) {
  111 |       const gate = page.getByText(/Capture passport|passport \/ CID before check-in/i);
  112 |       if (!(await gate.isVisible().catch(() => false))) break;
  113 |       await completeDocGate(page, `${docId}-${i}`);
  114 |       const saveCi = page.getByRole("button", { name: /Save & check in/i });
  115 |       if (await saveCi.isVisible().catch(() => false)) {
  116 |         await saveCi.evaluate((el: HTMLElement) => el.click());
  117 |         await page.waitForTimeout(800);
  118 |       }
  119 |     }
  120 |     const stillParty = page.getByRole("button", { name: /Check in party/i });
  121 |     if (await stillParty.isVisible().catch(() => false)) {
  122 |       await stillParty.evaluate((el: HTMLElement) => el.click());
  123 |       await completeDocGate(page, `${docId}-party`);
  124 |     }
  125 |   } else {
  126 |     await expect(checkInBtn).toBeEnabled({ timeout: 30_000 });
  127 |     await checkInBtn.evaluate((el: HTMLElement) => el.click());
  128 |     await completeDocGate(page, docId);
  129 |   }
  130 | 
  131 |   await expect
  132 |     .poll(
  133 |       async () => {
  134 |         const hub = page.getByRole("dialog", { name: /StayHub|Group StayHub/i });
  135 |         const toast = await page
  136 |           .locator("[data-sonner-toast]")
  137 |           .filter({ hasText: /Checked in/i })
  138 |           .count();
  139 |         const status = await hub.getByText(/checked in/i).count();
  140 |         const collect = await hub.getByRole("button", { name: /^Collect/i }).count();
  141 |         const checkOut = await hub.getByTestId("stayhub-check-out").count();
  142 |         const inHouseTab = await page.getByRole("tab", { name: /In-house [1-9]/i }).count();
  143 |         return toast + status + collect + checkOut + inHouseTab;
  144 |       },
  145 |       { timeout: 60_000 },
  146 |     )
> 147 |     .toBeGreaterThan(0);
      |      ^ Error: expect(received).toBeGreaterThan(expected)
  148 | }
  149 | 
  150 | async function postLaundryOnOpenStay(page: Page, amount: string, desc: string) {
  151 |   await page.getByRole("button", { name: /^Room$/ }).click({ force: true }).catch(() => undefined);
  152 |   await page.waitForTimeout(300);
  153 |   await expect(page.getByTestId("stayhub-guest-bill-post")).toBeVisible({
  154 |     timeout: 15_000,
  155 |   });
  156 |   await page.getByRole("button", { name: /^Laundry$/ }).click({ force: true });
  157 |   await page.getByTestId("stayhub-guest-bill-desc").fill(desc);
  158 |   await page.getByTestId("stayhub-guest-bill-net").fill(amount);
  159 |   await page.getByTestId("stayhub-guest-bill-post").click({ force: true });
  160 |   await expect(
  161 |     page.locator("[data-sonner-toast]").filter({ hasText: /Laundry|posted|personal/i }),
  162 |   ).toBeVisible({ timeout: 20_000 });
  163 | }
  164 | 
  165 | async function posRoomCharge(page: Page, guestHint: string) {
  166 |   await page.goto("/pos");
  167 |   await expect(page.getByText(/Touch POS|Outlet/i).first()).toBeVisible({
  168 |     timeout: 20_000,
  169 |   });
  170 |   const openShift = page.getByRole("button", { name: /Open shift/i });
  171 |   if (await openShift.isVisible().catch(() => false)) {
  172 |     await openShift.click();
  173 |     await page.waitForTimeout(800);
  174 |   }
  175 |   const menuTile = page.locator("button").filter({ hasText: /Nu\./ }).first();
  176 |   await expect(menuTile).toBeVisible({ timeout: 15_000 });
  177 |   await menuTile.click();
  178 |   await page.waitForTimeout(400);
  179 | 
  180 |   const roomSelect = page.locator("label").filter({ hasText: /Room charge guest/i }).locator("select");
  181 |   await expect(roomSelect).toBeVisible({ timeout: 10_000 });
  182 |   const options = await roomSelect.locator("option").allTextContents();
  183 |   const match = options.find((o) => o.toLowerCase().includes(guestHint.toLowerCase().slice(0, 12)));
  184 |   expect(match, `in-house option for ${guestHint}: ${options.join(" | ")}`).toBeTruthy();
  185 |   const value = await roomSelect
  186 |     .locator("option")
  187 |     .filter({ hasText: match! })
  188 |     .first()
  189 |     .getAttribute("value");
  190 |   await roomSelect.selectOption(value!);
  191 | 
  192 |   const settle = page.getByRole("button", { name: /Settle|Pay|Charge/i }).first();
  193 |   if (await settle.isVisible().catch(() => false)) {
  194 |     await settle.click();
  195 |   } else {
  196 |     await page.getByRole("button", { name: /Check out|Fire|Send/i }).first().click().catch(() => undefined);
  197 |   }
  198 |   const roomCharge = page.getByRole("button", { name: /Room charge/i }).first();
  199 |   await expect(roomCharge).toBeVisible({ timeout: 15_000 });
  200 |   await roomCharge.click();
  201 |   await expect(
  202 |     page.locator("[data-sonner-toast]").filter({ hasText: /settled|Folio|Rm/i }),
  203 |   ).toBeVisible({ timeout: 30_000 });
  204 | }
  205 | 
  206 | test.describe.serial("FO ops matrix · agent / walk-in / partner", () => {
  207 |   test("API health", async ({ request }) => {
  208 |     const res = await request.get(`${API}/health`);
  209 |     expect(res.ok()).toBeTruthy();
  210 |   });
  211 | 
  212 |   test("Case 1 · Group agent · POS room A + laundry room B", async ({ page }) => {
  213 |     test.setTimeout(240_000);
  214 |     await unlockKarma(page);
  215 |     /* Same-day arrival so party CI lands in-house for POS room charge. */
  216 |     const dates = farDates(0, 1);
  217 | 
  218 |     await page.getByRole("button", { name: /Fast Book/i }).first().click();
  219 |     await expect(page.getByTestId("fast-book-guest-name")).toBeVisible();
  220 |     await page.getByRole("button", { name: /^Agent$/ }).click();
  221 |     await page.getByTestId("fast-book-guest-name").fill(GROUP_GUEST);
  222 |     await page.getByLabel("Check-in").fill(dates.in);
  223 |     await page.getByLabel("Check-out").fill(dates.out);
  224 |     await page.getByRole("button", { name: "Increase Rooms" }).click();
  225 |     await page.getByRole("button", { name: /Executive King/i }).first().click();
  226 |     await page.getByTestId("fast-book-submit").click();
  227 | 
  228 |     const bookToast = page
  229 |       .locator("[data-sonner-toast]")
  230 |       .filter({ hasText: /Booking confirmed|Hold reserved|API offline|cannot create/i })
  231 |       .first();
  232 |     await expect(bookToast).toBeVisible({ timeout: 45_000 });
  233 |     expect((await bookToast.innerText()).replace(/\s+/g, " ")).toMatch(
  234 |       /Booking confirmed|Hold reserved/i,
  235 |     );
  236 | 
  237 |     await expect(page.getByRole("dialog", { name: /Group StayHub|StayHub/i })).toBeVisible({
  238 |       timeout: 20_000,
  239 |     });
  240 | 
  241 |     /* Check in peer rooms via Rooms tab when group hub. */
  242 |     const roomsTab = page.getByRole("button", { name: /^Rooms/i }).first();
  243 |     if (await roomsTab.isVisible().catch(() => false)) {
  244 |       await roomsTab.click();
  245 |     }
  246 | 
  247 |     const openRoomBtns = page.getByRole("button", { name: /Open|Assign|Check in/i });
```