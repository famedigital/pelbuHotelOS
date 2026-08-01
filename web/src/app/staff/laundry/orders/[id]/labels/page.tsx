import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { loadLaundryBagsForOrder } from "@/app/actions/laundry-bags";
import { StaffAppShell } from "@/components/erp/StaffAppShell";
import { LaundryBagLabelPrinter } from "@/components/laundry/LaundryBagLabelPrinter";
import { LaundryLabelBagActions } from "@/components/laundry/LaundryLabelBagActions";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { canWorkLaundry } from "@/lib/laundry";
import { getStaffSession } from "@/lib/staff-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const metadata: Metadata = {
  title: "Print laundry bags | Pelbu Staff",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function StaffLaundryLabelsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getStaffSession();
  if (!session) redirect("/staff/login");
  if (!canWorkLaundry(session)) {
    return (
      <StaffAppShell session={session}>
        <Alert variant="destructive">
          <AlertTitle>Laundry access required</AlertTitle>
          <AlertDescription>
            Only laundry or housekeeping staff can print bag labels.
          </AlertDescription>
        </Alert>
      </StaffAppShell>
    );
  }
  const { id: orderId } = await params;
  const admin = createSupabaseAdminClient();
  const [{ data: order }, bags] = await Promise.all([
    admin
      .from("laundry_orders")
      .select("id, room_label_snapshot")
      .eq("id", orderId)
      .eq("property_id", session.propertyId)
      .maybeSingle(),
    loadLaundryBagsForOrder(session.propertyId, orderId),
  ]);
  if (!order) redirect("/staff/laundry");

  return (
    <StaffAppShell session={session}>
      <div className="space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-3 print:hidden">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
              Bag labels
            </p>
            <h1 className="mt-1 font-display text-2xl">
              Room {order.room_label_snapshot as string}
            </h1>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href="/staff/laundry">Back</Link>
          </Button>
        </div>
        <LaundryLabelBagActions bags={bags} mode="staff" />

        <LaundryBagLabelPrinter
          orderId={orderId}
          roomLabel={order.room_label_snapshot as string}
          bags={bags}
          mode="staff"
        />
      </div>
    </StaffAppShell>
  );
}
