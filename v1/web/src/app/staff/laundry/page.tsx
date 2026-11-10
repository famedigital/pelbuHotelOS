import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { loadLaundryBagsByOrders } from "@/app/actions/laundry-bags";
import { loadLaundryStaffOrders } from "@/app/actions/staff-laundry";
import { StaffAppShell } from "@/components/erp/StaffAppShell";
import { LaundryStaffBoard } from "@/components/laundry/LaundryStaffBoard";
import { LaundryLiveRefresh } from "@/components/laundry/LaundryLiveRefresh";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { canWorkLaundry } from "@/lib/laundry";
import { getStaffSession } from "@/lib/staff-auth";

export const metadata: Metadata = {
  title: "Laundry | Pelbu Staff",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function StaffLaundryPage() {
  const session = await getStaffSession();
  if (!session) redirect("/staff/login");
  const allowed = canWorkLaundry(session);
  const orders = allowed ? await loadLaundryStaffOrders(session) : [];
  const bagsByOrder = allowed
    ? await loadLaundryBagsByOrders(
        session.propertyId,
        orders.map((order) => order.id),
      )
    : {};
  return (
    <StaffAppShell session={session}>
      <div className="space-y-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
              Guest service
            </p>
            <h1 className="mt-1 font-display text-3xl">Laundry workboard</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Collect, confirm, process, quality-check, and return every bag.
            </p>
          </div>
          {allowed ? <LaundryLiveRefresh /> : null}
        </div>
        {!allowed ? (
          <Alert variant="destructive">
            <AlertTitle>Access not assigned</AlertTitle>
            <AlertDescription>
              Ask a supervisor to set your department or role to housekeeping
              or laundry.
            </AlertDescription>
          </Alert>
        ) : (
          <LaundryStaffBoard
            orders={orders}
            bagsByOrder={bagsByOrder}
            staffId={session.staffId}
          />
        )}
      </div>
    </StaffAppShell>
  );
}
