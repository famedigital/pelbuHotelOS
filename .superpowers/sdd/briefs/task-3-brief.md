### Task 3: Wire candy-track wells on desk gauges

**Files:**
- Modify: `web/src/components/erp/FoCommandDesk.tsx` (~lines 62–67 `FoMetricCard` bar)
- Modify: `web/src/components/erp/AgentCockpitBoard.tsx` (~lines 183–189 figure bars)
- Modify: `web/src/components/erp/setup/PropertySetupModalShell.tsx` (~line 81 progress bar)
- Modify: `web/src/components/erp/stay-hub/StayHubCashierDock.tsx` (add folio due gauge above settle row)
- Modify: `web/src/components/erp/RoomRackGrid.tsx` occupancy popover fill only (~2207–2211) — chrome popover, not rack cells

**Interfaces:**
- Consumes: `.neo-well`, `.track-gradient-coral|mint|violet`
- Produces: gauge markup using those classes; coral = warn/unpaid/high stress, mint = healthy/settled, violet = VIP/audit-ish secondary

- [ ] **Step 1: FoCommandDesk metric bar**

Replace the percent track in `FoMetricCard`:

```tsx
      {percent != null ? (
        <div className="neo-well mt-3 h-1.5">
          <div
            className={cn(
              "h-full rounded-full",
              barClassName ?? "track-gradient-mint",
            )}
            style={{ width: `${percent}%` }}
          />
        </div>
      ) : null}
```

Where callers pass warn/dirty tones, pass `barClassName="track-gradient-coral"`; occupancy healthy stays mint; group/VIP hints use violet.

- [ ] **Step 2: AgentCockpitBoard figure bars**

```tsx
            {figure.bar != null ? (
              <div className="neo-well mt-2 h-1.5">
                <div
                  className={cn(
                    "h-full rounded-full",
                    figure.warn ? "track-gradient-coral" : "track-gradient-mint",
                  )}
                  style={{ width: `${figure.bar}%` }}
                />
              </div>
            ) : null}
```

- [ ] **Step 3: PropertySetupModalShell progress**

```tsx
            <div className="neo-well mb-3 h-1.5">
              <div
                className="h-full rounded-full track-gradient-violet"
                style={{ width: `${percent}%` }}
              />
            </div>
```

(Use the existing percent variable name in that file.)

- [ ] **Step 4: StayHubCashierDock folio due well**

Above the guest-stream row, add a settled/due track (0–100 clamped from clear vs due — when clear show full mint; when due show coral fill at `Math.min(100, …)` or a simple 100% coral bar when unpaid):

```tsx
      <div className="neo-well h-1.5" aria-hidden>
        <div
          className={cn(
            "h-full rounded-full",
            clear ? "track-gradient-mint" : "track-gradient-coral",
          )}
          style={{ width: clear ? "100%" : "100%" }}
        />
      </div>
```

(Full-width status track is intentional: binary clear vs due, not a fake %)

- [ ] **Step 5: Room rack Occ popover fill only**

In the month-stat popover bottom strip (~2207), keep card opaque; only the fill uses tracks:

```tsx
                    <div className="neo-well absolute inset-x-0 bottom-0 h-0.5 rounded-none">
                      <div
                        className={cn(
                          "h-full",
                          stat.percent >= 80
                            ? "track-gradient-coral"
                            : stat.percent >= 50
                              ? "track-gradient-violet"
                              : "track-gradient-mint",
                        )}
                        style={{ width: `${stat.percent}%` }}
                      />
                    </div>
```

Do **not** add blur/neo-card to rack timeline cells.

- [ ] **Step 6: Visual verify**

Browse `/erp/day`, open StayHub on an in-house stay, `/erp` FO home if FoCommand path, Agent cockpit if available. Confirm wells glow; rack grid cells remain flat opaque.

- [ ] **Step 7: Commit only if user asked**

Do not commit unless the user explicitly requests a commit.
