# Task 3 review package
 web/src/components/erp/AgentCockpitBoard.tsx             |  7 +++++--
 web/src/components/erp/FoCommandDesk.tsx                 | 15 +++++++++------
 web/src/components/erp/RoomRackGrid.tsx                  | 11 +++++++++--
 web/src/components/erp/setup/PropertySetupModalShell.tsx |  4 ++--
 web/src/components/erp/stay-hub/StayHubCashierDock.tsx   | 10 ++++++++++
 5 files changed, 35 insertions(+), 12 deletions(-)

## Diffs

diff --git a/web/src/components/erp/AgentCockpitBoard.tsx b/web/src/components/erp/AgentCockpitBoard.tsx
index 29180a9..b0d445d 100644
--- a/web/src/components/erp/AgentCockpitBoard.tsx
+++ b/web/src/components/erp/AgentCockpitBoard.tsx
@@ -178,15 +178,18 @@ export function AgentCockpitBoard({
               )}
             >
               {figure.value}
             </p>
             <p className="mt-1 text-xs text-muted-foreground">{figure.hint}</p>
             {figure.bar != null ? (
-              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-secondary">
+              <div className="neo-well mt-2 h-1.5">
                 <div
-                  className={cn("h-full rounded-full", figure.warn ? "bg-destructive" : "bg-primary")}
+                  className={cn(
+                    "h-full rounded-full",
+                    figure.warn ? "track-gradient-coral" : "track-gradient-mint",
+                  )}
                   style={{ width: `${figure.bar}%` }}
                 />
               </div>
             ) : null}
           </Link>
         ))}
diff --git a/web/src/components/erp/FoCommandDesk.tsx b/web/src/components/erp/FoCommandDesk.tsx
index c0c9ce1..f7b8ccf 100644
--- a/web/src/components/erp/FoCommandDesk.tsx
+++ b/web/src/components/erp/FoCommandDesk.tsx
@@ -57,15 +57,18 @@ export function FoMetricCard({
         <span className="font-mono text-2xl font-bold text-white">{value}</span>
         {hint ? (
           <span className="text-right text-[11px] text-slate-400">{hint}</span>
         ) : null}
       </div>
       {percent != null ? (
-        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-800">
+        <div className="neo-well mt-3 h-1.5">
           <div
-            className={cn("h-full rounded-full bg-sky-500", barClassName)}
+            className={cn(
+              "h-full rounded-full",
+              barClassName ?? "track-gradient-mint",
+            )}
             style={{ width: `${percent}%` }}
           />
         </div>
       ) : null}
     </>
   );
@@ -109,41 +112,41 @@ export function FoStayMetrics({
       />
       <FoMetricCard
         label="Occupancy"
         value={occBase ? `${pct(occCount, occBase)}%` : "—"}
         hint={occBase ? `${occCount} / ${occBase} rooms` : "No sellable rooms"}
         percent={pct(occCount, occBase)}
-        barClassName="bg-emerald-500"
+        barClassName="track-gradient-mint"
         onClick={() => onOpen("inhouse")}
       />
       <FoMetricCard
         label="Clean rooms"
         value={String(pulse.roomsClean)}
         hint={
           pulse.roomsDirty
             ? `${pulse.roomsDirty} dirty or inspect`
             : "Ready for assignment"
         }
         percent={pct(pulse.roomsClean, Math.max(pulse.roomsTotal, 1))}
-        barClassName="bg-amber-400"
+        barClassName="track-gradient-coral"
         onClick={() => onOpen("empty")}
       />
       <FoMetricCard
         label="Departures"
         value={String(departures)}
         hint="Still on the board"
         percent={pct(departures, house)}
-        barClassName="bg-amber-500"
+        barClassName="track-gradient-coral"
         onClick={() => onOpen("checkout")}
       />
       <FoMetricCard
         label="Tomorrow checkout"
         value={String(snap.tomorrowDepartureRows?.length ?? 0)}
         hint="Print the bills for the guide"
         percent={pct(snap.tomorrowDepartureRows?.length ?? 0, house)}
-        barClassName="bg-amber-500"
+        barClassName="track-gradient-coral"
         onClick={() => onOpen("tomorrow")}
       />
     </div>
   );
 }
 
diff --git a/web/src/components/erp/RoomRackGrid.tsx b/web/src/components/erp/RoomRackGrid.tsx
index d840a85..31ddf84 100644
--- a/web/src/components/erp/RoomRackGrid.tsx
+++ b/web/src/components/erp/RoomRackGrid.tsx
@@ -2201,15 +2201,22 @@ export function RoomRackGrid({
                       </span>
                     </div>
                     <div className="mt-0.5 flex gap-2 text-[11px] tabular-nums text-muted-foreground">
                       <span>B {stat.booked}</span>
                       <span>E {stat.empty}</span>
                     </div>
-                    <div className="absolute inset-x-0 bottom-0 h-0.5 bg-black/5">
+                    <div className="neo-well absolute inset-x-0 bottom-0 h-0.5 rounded-none">
                       <div
-                        className={cn("h-full", tone.bar)}
+                        className={cn(
+                          "h-full",
+                          stat.percent >= 80
+                            ? "track-gradient-coral"
+                            : stat.percent >= 50
+                              ? "track-gradient-violet"
+                              : "track-gradient-mint",
+                        )}
                         style={{ width: `${stat.percent}%` }}
                       />
                     </div>
                   </div>
                 );
               })}
diff --git a/web/src/components/erp/setup/PropertySetupModalShell.tsx b/web/src/components/erp/setup/PropertySetupModalShell.tsx
index 673be23..8972797 100644
--- a/web/src/components/erp/setup/PropertySetupModalShell.tsx
+++ b/web/src/components/erp/setup/PropertySetupModalShell.tsx
@@ -75,21 +75,21 @@ export function PropertySetupModalShell({
           </div>
 
           <p className="mb-4 text-sm text-muted-foreground">{blurb}</p>
 
           {/* Track */}
           <div
-            className="mb-3 h-1.5 overflow-hidden rounded-full bg-muted"
+            className="neo-well mb-3 h-1.5"
             role="progressbar"
             aria-valuenow={pct}
             aria-valuemin={0}
             aria-valuemax={100}
             aria-label={`Setup ${pct}% complete`}
           >
             <div
-              className="h-full rounded-full bg-foreground transition-[width] duration-300 ease-out"
+              className="h-full rounded-full track-gradient-violet transition-[width] duration-300 ease-out"
               style={{ width: `${pct}%` }}
             />
           </div>
 
           {/* Step chips */}
           <nav
diff --git a/web/src/components/erp/stay-hub/StayHubCashierDock.tsx b/web/src/components/erp/stay-hub/StayHubCashierDock.tsx
index 84a3108..e7be54c 100644
--- a/web/src/components/erp/stay-hub/StayHubCashierDock.tsx
+++ b/web/src/components/erp/stay-hub/StayHubCashierDock.tsx
@@ -82,12 +82,22 @@ export function StayHubCashierDock({
     <div
       className={cn(
         "erp-cold-glass glass-happy-card sticky bottom-0 z-20 space-y-2 border-t px-3 py-2.5",
         className,
       )}
     >
+      <div className="neo-well h-1.5" aria-hidden>
+        <div
+          className={cn(
+            "h-full rounded-full",
+            clear ? "track-gradient-mint" : "track-gradient-coral",
+          )}
+          style={{ width: clear ? "100%" : "100%" }}
+        />
+      </div>
+
       <div className="flex flex-wrap items-center justify-between gap-2">
         <p className="text-xs text-muted-foreground">
           Guest stream{" "}
           <span
             className={cn(
               "font-semibold tabular-nums",
