# Task 4 review package
diff --git a/web/src/components/erp/RoomDayBoard.tsx b/web/src/components/erp/RoomDayBoard.tsx
index 2e300bf..22132fa 100644
--- a/web/src/components/erp/RoomDayBoard.tsx
+++ b/web/src/components/erp/RoomDayBoard.tsx
@@ -390,17 +390,17 @@ export function RoomDayBoard({
               r.status === "arrival" ||
               r.status === "depart",
           ).length;
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
                     occupied > 0 ? `${occupied} occupied` : null,
                     dueOut > 0 ? `${dueOut} due out` : null,
                     dirty > 0 ? `${dirty} dirty` : null,
diff --git a/web/src/components/erp/stay-hub/StayHubCashierDock.tsx b/web/src/components/erp/stay-hub/StayHubCashierDock.tsx
index 84a3108..850ee99 100644
--- a/web/src/components/erp/stay-hub/StayHubCashierDock.tsx
+++ b/web/src/components/erp/stay-hub/StayHubCashierDock.tsx
@@ -76,20 +76,30 @@ export function StayHubCashierDock({
       onMoneyChanged();
       onCheckedOut?.();
     });
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
               "font-semibold tabular-nums",
               clear
                 ? "text-[color:var(--color-mint)]"
