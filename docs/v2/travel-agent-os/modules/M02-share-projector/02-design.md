# M02 — Design (pure domain)

**Status:** APPROVED 2026-11-13 (PM cycle — proceed Implement)  
**Package:** `v2/packages/domain/src/agency/`  
**Tests:** `v2/packages/domain/src/agency/*.test.ts`

---

## 1. Files to create

```
v2/packages/domain/src/agency/
  types.ts
  money.ts          # tripMargin, sumBudgetCosts
  project-share-tier.ts
  project-share-tier.test.ts
  money.test.ts
  index.ts
```

Re-export from `v2/packages/domain/src/index.ts` (or existing barrel).

---

## 2. Types (`types.ts`)

```ts
export type ShareTier = "agency" | "guest" | "guide" | "driver" | "hotel";

export type BudgetLineKind =
  | "sdf"
  | "hotel"
  | "guide"
  | "vehicle"
  | "entry"
  | "misc"
  | "sell";

export type BudgetLine = {
  id: string;
  kind: BudgetLineKind;
  label: string;
  qty: number;          // integer >= 0
  unitChh: number;      // integer chhetrum
  amountChh: number;    // integer; for non-sell kinds, prefer qty*unitChh validated
  isClientVisible: boolean;
};

export type TripStaySlice = {
  id: string;
  propertyId: string;
  propertyName: string;
  roomTypeName: string;
  roomNumbers: string[];
  checkIn: string;      // YYYY-MM-DD
  checkOut: string;
  mealPlan: "EP" | "CP" | "MAP" | "AP" | string;
  nightlyNetRateChh: number | null;
};

export type TripDaySlice = {
  dayIndex: number;
  date: string;
  title: string;
  narrative: string;
  overnightDzongkhag: string | null;
};

export type TripStaffSlice = {
  guideName: string | null;
  guidePhone: string | null;
  driverName: string | null;
  driverPhone: string | null;
  vehiclePlate: string | null;
};

export type AgencyTripRecord = {
  id: string;
  code: string;
  clientName: string;
  paxAdults: number;
  paxChildren: number;
  dietaryNotes: string | null;
  arrivalFlight: string | null;
  days: TripDaySlice[];
  stays: TripStaySlice[];
  staff: TripStaffSlice;
  budgetLines: BudgetLine[];
  /** Convenience denorm; projector must recompute from lines if present */
  clientGrossSellChh: number | null;
  sdfTotalChh: number | null;
  passportDocUrls: string[];
};

export type ProjectShareOptions = {
  hideRates?: boolean;           // hotel default true
  propertyIdFilter?: string;     // hotel tier: only this property stays
};
```

---

## 3. Money (`money.ts`)

### `sumBudgetCosts(lines: BudgetLine[]): number`

Sum `amountChh` for kinds **except** `sell`. Reject if any `amountChh` is not a finite integer (throw `INVALID_MONEY`).

### `sumSell(lines: BudgetLine[]): number`

Sum `amountChh` where `kind === "sell"`. If zero lines, fall back to 0.

### `tripMargin(input: { lines: BudgetLine[]; sellChh?: number })`

```ts
costChh = sumBudgetCosts(lines)
sellChh = input.sellChh ?? sumSell(lines)
marginChh = sellChh - costChh
marginBps = sellChh === 0 ? 0 : Math.trunc((marginChh * 10000) / sellChh)
return { costChh, sellChh, marginChh, marginBps }
```

**Rules:** integer only; no floats; no rounding libraries.

---

## 4. Projector (`project-share-tier.ts`)

```ts
export function projectShareTier(
  trip: AgencyTripRecord,
  tier: ShareTier,
  options?: ProjectShareOptions,
): Record<string, unknown>
```

### Fail closed

```ts
if (!SHARE_TIERS.includes(tier)) throw new Error("INVALID_SHARE_TIER");
```

### Allowlists by tier

Return **only** keys listed. Strip `passportDocUrls` for all non-agency.

#### `agency`

Full trip + `{ margin: tripMargin({ lines: trip.budgetLines, sellChh: trip.clientGrossSellChh ?? undefined }) }`.

#### `guest`

```
code, clientName (or lead display), paxAdults, paxChildren,
days: [{ dayIndex, date, title, narrative }],
stays: [{ propertyName, roomTypeName, checkIn, checkOut, mealPlan }],  // no roomNumbers, no nightlyNetRate
staff: { guideName },  // no phones
dietaryNotes (optional short),
arrivalFlight
```

No budget, margin, sdfTotal, passport.

#### `guide`

```
code, clientName, paxAdults, paxChildren, dietaryNotes, arrivalFlight,
days: full titles/narratives,
stays: [{ propertyName, roomTypeName, roomNumbers, checkIn, checkOut, mealPlan }],
staff: { guideName, guidePhone, driverName, driverPhone, vehiclePlate }
```

No rates, sell, margin, budget, sdfTotal, passport.

#### `driver`

```
code, paxAdults, paxChildren, arrivalFlight,
stays: [{ propertyName, checkIn, checkOut }],
staff: { driverName, driverPhone, vehiclePlate, guideName, guidePhone },
days: [{ dayIndex, date, title }]  // no long narrative required — title only
```

No rates/money/passport/dietary (unless Design later adds “allergy flag” boolean — not in M02).

#### `hotel`

Filter stays where `propertyId === options.propertyIdFilter` if provided; else all stays (M10 should always pass filter).

```
code, clientName, paxAdults, paxChildren, dietaryNotes,
stays: [{ propertyName, roomTypeName, roomNumbers, checkIn, checkOut, mealPlan,
          nightlyNetRateChh: hideRates ? omitted : value }],
staff: { guideName, guidePhone }
```

`hideRates` default **true**. Never include clientGrossSell, margin, budget, sdfTotal, passport, full day tourism narrative.

---

## 5. Field matrix (test oracle)

| Field | agency | guest | guide | driver | hotel+hide |
|-------|:------:|:-----:|:-----:|:------:|:----------:|
| budgetLines | Y | N | N | N | N |
| margin | Y | N | N | N | N |
| clientGrossSellChh | Y | N | N | N | N |
| sdfTotalChh | Y | N | N | N | N |
| nightlyNetRateChh | Y | N | N | N | N |
| passportDocUrls | Y | N | N | N | N |
| days.narrative | Y | Y | Y | N | N |
| stays.roomNumbers | Y | N | Y | N | Y |
| guidePhone | Y | N | Y | Y | Y |

---

## 6. Unit tests (mandatory names)

### money.test.ts

- `sum_budget_costs_excludes_sell`
- `sum_budget_costs_rejects_non_integer`
- `trip_margin_happy_50_percent` (100k cost, 150k sell → marginBps 5000)
- `trip_margin_zero_sell_bps_zero`
- `trip_margin_uses_sell_lines_when_sellChh_omitted`

### project-share-tier.test.ts

- `rejects_invalid_tier`
- `agency_includes_margin_and_budget`
- `guest_strips_rates_and_phones_and_rooms`
- `guide_strips_money_keeps_rooms_and_dietary`
- `driver_strips_narrative_and_money`
- `hotel_hide_rates_default_strips_net`
- `hotel_property_filter_drops_other_hotels`
- `strips_passport_for_all_non_agency`
- `unknown_input_keys_not_copied_to_output`

Fixture: one shared `FIXTURE_TRIP` constant in test file.

---

## 7. Implement notes

- No migration.  
- No API route.  
- After green tests, CATALOG → mark M02 PRODUCTION when merged (domain-only “production” = shipped in domain package on droplet with next API deploy).

## 8. Non-goals

- PDF  
- Token hashing  
- i18n of narratives  
