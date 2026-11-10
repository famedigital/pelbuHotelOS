# Final whole-branch Neo-Glass review package
Branch: cursor/desk-neo-glass
Merge-base note: work is uncommitted on branch; package is working-tree diff vs HEAD for Neo-Glass files only.
 web/src/app/globals.css                            | 132 ++++++++++++++++++++-
 web/src/components/erp/AgentCockpitBoard.tsx       |   7 +-
 web/src/components/erp/FoCommandDesk.tsx           |  15 ++-
 web/src/components/erp/RoomDayBoard.tsx            |   2 +-
 web/src/components/erp/RoomRackGrid.tsx            |  11 +-
 .../erp/setup/PropertySetupModalShell.tsx          |   4 +-
 .../components/erp/stay-hub/StayHubCashierDock.tsx |  12 +-
 web/src/components/ui/button.tsx                   |   1 +
 8 files changed, 166 insertions(+), 18 deletions(-)

## Full diff

diff --git a/web/src/app/globals.css b/web/src/app/globals.css
index e96e019..e767b1d 100644
--- a/web/src/app/globals.css
+++ b/web/src/app/globals.css
@@ -1810,10 +1810,115 @@ html[data-desk-print] #desk-print-mount {
 }
 .stripe-violet {
   box-shadow: inset 3px 0 0 0 var(--color-violet);
 }
 
+/* --- Desk Neo-Glass (tactile neumorphism + frosted specular) --- */
+.erp {
+  --neo-fill: rgba(255, 255, 255, 0.82);
+  --neo-rim: rgba(255, 255, 255, 0.72);
+  --neo-text: var(--foreground);
+  --neo-shadow-out:
+    6px 6px 14px rgba(26, 20, 16, 0.1),
+    -4px -4px 12px rgba(255, 255, 255, 0.85);
+  --neo-shadow-in:
+    inset 4px 4px 10px rgba(26, 20, 16, 0.12),
+    inset -3px -3px 8px rgba(255, 255, 255, 0.75);
+  --neo-specular: inset 0 1px 1px rgba(255, 255, 255, 0.9);
+  --neo-blur: 14px;
+}
+
+.dark .erp,
+.erp.dark,
+.fo-command {
+  --neo-fill: rgba(18, 22, 28, 0.78);
+  --neo-rim: rgba(255, 255, 255, 0.12);
+  --neo-shadow-out:
+    6px 6px 16px rgba(0, 0, 0, 0.45),
+    -3px -3px 10px rgba(255, 255, 255, 0.04);
+  --neo-shadow-in:
+    inset 4px 4px 12px rgba(0, 0, 0, 0.55),
+    inset -2px -2px 8px rgba(255, 255, 255, 0.06);
+  --neo-specular: inset 0 1px 1px rgba(255, 255, 255, 0.18);
+}
+
+.neo-card {
+  background: var(--neo-fill);
+  color: var(--neo-text);
+  border: 1px solid var(--neo-rim);
+  border-radius: 1.125rem;
+  box-shadow: var(--neo-specular), var(--neo-shadow-out);
+  backdrop-filter: blur(var(--neo-blur)) saturate(160%);
+  -webkit-backdrop-filter: blur(var(--neo-blur)) saturate(160%);
+  transform: translateZ(0);
+  font-weight: 500;
+}
+
+.neo-btn {
+  box-shadow: var(--neo-specular), var(--neo-shadow-out);
+  border-color: color-mix(in oklab, var(--neo-rim) 80%, transparent);
+  transform: translateZ(0);
+  transition:
+    box-shadow 0.15s ease,
+    transform 0.12s cubic-bezier(0.16, 1, 0.3, 1);
+}
+
+.neo-btn:active,
+.neo-btn[data-pressed="true"] {
+  box-shadow: var(--neo-shadow-in);
+  transform: translateY(1px) translateZ(0);
+}
+
+.neo-well {
+  overflow: hidden;
+  border-radius: 9999px;
+  background: color-mix(in oklab, var(--neo-fill) 55%, rgba(26, 20, 16, 0.08));
+  box-shadow: var(--neo-shadow-in);
+  transform: translateZ(0);
+}
+
+.track-gradient-coral {
+  background: linear-gradient(90deg, #fb7185 0%, #ef4444 55%, #f59e0b 100%);
+  box-shadow: 0 0 10px rgba(239, 68, 68, 0.35);
+}
+
+.track-gradient-mint {
+  background: linear-gradient(90deg, #34d399 0%, #10b981 55%, #2dd4bf 100%);
+  box-shadow: 0 0 10px rgba(16, 185, 129, 0.35);
+}
+
+.track-gradient-violet {
+  background: linear-gradient(90deg, #a78bfa 0%, #8b5cf6 50%, #6366f1 100%);
+  box-shadow: 0 0 10px rgba(139, 92, 246, 0.35);
+}
+
+/* Soft remap: desk cards / non-flat buttons pick up Neo-Glass */
+.erp [data-slot="card"]:not([data-neo="off"]) {
+  background: var(--neo-fill);
+  color: var(--neo-text);
+  border: 1px solid var(--neo-rim);
+  box-shadow: var(--neo-specular), var(--neo-shadow-out);
+  backdrop-filter: blur(var(--neo-blur)) saturate(160%);
+  -webkit-backdrop-filter: blur(var(--neo-blur)) saturate(160%);
+  transform: translateZ(0);
+}
+
+.erp [data-slot="button"]:not([data-variant="ghost"]):not([data-variant="link"]):not([data-neo="off"]) {
+  box-shadow: var(--neo-specular), var(--neo-shadow-out);
+  transform: translateZ(0);
+  transition:
+    box-shadow 0.15s ease,
+    transform 0.12s cubic-bezier(0.16, 1, 0.3, 1),
+    background-color 0.15s ease,
+    color 0.15s ease;
+}
+
+.erp [data-slot="button"]:not([data-variant="ghost"]):not([data-variant="link"]):not([data-neo="off"]):active {
+  box-shadow: var(--neo-shadow-in);
+  transform: translateY(1px) translateZ(0);
+}
+
 /* Floating 3D glass bottom dock — thumb zone (phone / small tablet) */
 .glass-dock-mobile {
   position: fixed;
   bottom: calc(0.75rem + env(safe-area-inset-bottom, 0px));
   left: 50%;
@@ -1856,14 +1961,17 @@ html[data-desk-print] #desk-print-mount {
 .touch-press:active {
   transform: scale(0.94);
   opacity: 0.85;
 }
 
-.pb-safe-dock {
-  padding-bottom: calc(
-    var(--mobile-dock-height) + 1.5rem + env(safe-area-inset-bottom, 0px)
-  );
+/* Mobile dock clearance only — scoped so it cannot override md:pb-* utilities. */
+@media (max-width: 767px) {
+  .pb-safe-dock {
+    padding-bottom: calc(
+      var(--mobile-dock-height) + 1.5rem + env(safe-area-inset-bottom, 0px)
+    );
+  }
 }
 
 /* Rack OCC footer clearance on mobile */
 .rack-scroll-clearance {
   padding-bottom: calc(32px + env(safe-area-inset-bottom, 0px));
@@ -1893,10 +2001,17 @@ html[data-desk-print] #desk-print-mount {
   .dark .glass-happy-card,
   .dark .glass-happy-modal,
   .dark .glass-happy-table-container {
     background: var(--paper-0, #0f172a) !important;
   }
+
+  .neo-card,
+  .erp [data-slot="card"]:not([data-neo="off"]) {
+    backdrop-filter: none !important;
+    -webkit-backdrop-filter: none !important;
+    background: var(--paper-0, #fff) !important;
+  }
 }
 
 @media (prefers-reduced-motion: reduce) {
   .glass-card,
   .glass-elevated {
@@ -1908,6 +2023,15 @@ html[data-desk-print] #desk-print-mount {
   .touch-press,
   .touch-press:active {
     transition: none !important;
     transform: none !important;
   }
+
+  .neo-btn,
+  .erp [data-slot="button"]:not([data-variant="ghost"]):not([data-variant="link"]) {
+    transition: none !important;
+  }
+  .neo-btn:active,
+  .erp [data-slot="button"]:not([data-variant="ghost"]):not([data-variant="link"]):active {
+    transform: none !important;
+  }
 }
diff --git a/web/src/components/erp/AgentCockpitBoard.tsx b/web/src/components/erp/AgentCockpitBoard.tsx
index 29180a9..b0d445d 100644
--- a/web/src/components/erp/AgentCockpitBoard.tsx
+++ b/web/src/components/erp/AgentCockpitBoard.tsx
@@ -179,13 +179,16 @@ export function AgentCockpitBoard({
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
diff --git a/web/src/components/erp/FoCommandDesk.tsx b/web/src/components/erp/FoCommandDesk.tsx
index c0c9ce1..8a6b93e 100644
--- a/web/src/components/erp/FoCommandDesk.tsx
+++ b/web/src/components/erp/FoCommandDesk.tsx
@@ -58,13 +58,16 @@ export function FoMetricCard({
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
@@ -110,11 +113,11 @@ export function FoStayMetrics({
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
@@ -122,27 +125,27 @@ export function FoStayMetrics({
           pulse.roomsDirty
             ? `${pulse.roomsDirty} dirty or inspect`
             : "Ready for assignment"
         }
         percent={pct(pulse.roomsClean, Math.max(pulse.roomsTotal, 1))}
-        barClassName="bg-amber-400"
+        barClassName="track-gradient-mint"
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
diff --git a/web/src/components/erp/RoomDayBoard.tsx b/web/src/components/erp/RoomDayBoard.tsx
index 2e300bf..22132fa 100644
--- a/web/src/components/erp/RoomDayBoard.tsx
+++ b/web/src/components/erp/RoomDayBoard.tsx
@@ -393,11 +393,11 @@ export function RoomDayBoard({
           const dueOut = rows.filter((r) => r.status === "depart").length;
           const dirty = rows.filter((r) => r.status === "dirty").length;
 
           return (
             <section key={group.name} className="mb-3">
-              <div className="glass-card mb-2 px-3 py-2.5">
+              <div className="glass-card neo-card mb-2 px-3 py-2.5">
                 <h2 className="text-sm font-semibold tracking-tight text-foreground">
                   {group.name}
                 </h2>
                 <p className="mt-0.5 text-[11px] text-muted-foreground">
                   {[
diff --git a/web/src/components/erp/RoomRackGrid.tsx b/web/src/components/erp/RoomRackGrid.tsx
index d840a85..31ddf84 100644
--- a/web/src/components/erp/RoomRackGrid.tsx
+++ b/web/src/components/erp/RoomRackGrid.tsx
@@ -2202,13 +2202,20 @@ export function RoomRackGrid({
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
diff --git a/web/src/components/erp/setup/PropertySetupModalShell.tsx b/web/src/components/erp/setup/PropertySetupModalShell.tsx
index 673be23..8972797 100644
--- a/web/src/components/erp/setup/PropertySetupModalShell.tsx
+++ b/web/src/components/erp/setup/PropertySetupModalShell.tsx
@@ -76,19 +76,19 @@ export function PropertySetupModalShell({
 
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
diff --git a/web/src/components/erp/stay-hub/StayHubCashierDock.tsx b/web/src/components/erp/stay-hub/StayHubCashierDock.tsx
index 84a3108..850ee99 100644
--- a/web/src/components/erp/stay-hub/StayHubCashierDock.tsx
+++ b/web/src/components/erp/stay-hub/StayHubCashierDock.tsx
@@ -79,14 +79,24 @@ export function StayHubCashierDock({
   }
 
   return (
     <div
       className={cn(
-        "erp-cold-glass glass-happy-card sticky bottom-0 z-20 space-y-2 border-t px-3 py-2.5",
+        "erp-cold-glass glass-happy-card neo-card sticky bottom-0 z-20 space-y-2 border-t px-3 py-2.5",
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
diff --git a/web/src/components/ui/button.tsx b/web/src/components/ui/button.tsx
index 09351f3..b6a40f2 100644
--- a/web/src/components/ui/button.tsx
+++ b/web/src/components/ui/button.tsx
@@ -53,10 +53,11 @@ function Button({
   const Comp = asChild ? Slot : "button";
 
   return (
     <Comp
       data-slot="button"
+      data-variant={variant ?? "default"}
       className={cn(buttonVariants({ variant, size, className }))}
       {...props}
     />
   );
 }
