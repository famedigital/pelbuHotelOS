import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LaundryBagLabelPrinter } from "@/components/laundry/LaundryBagLabelPrinter";
import { Button } from "@/components/ui/button";
import { isDeskAuthenticated } from "@/lib/desk-auth";
import { resolveActivePropertyId } from "@/lib/property-context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { loadLaundryBagsForOrder } from "@/app/actions/laundry-bags";

export const metadata: Metadata = {
  title: "Laundry bag labels | Pelbu OS",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function LaundryOrderLabelsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!(await isDeskAuthenticated())) redirect("/erp/login");
  const { id: orderId } = await params;
  const admin = createSupabaseAdminClient();
  const propertyId = await resolveActivePropertyId(admin);
  const [{ data: order }, bags, { data: staff }] = await Promise.all([
    admin
      .from("laundry_orders")
      .select("id, guest_name, room_label_snapshot, status")
      .eq("id", orderId)
      .eq("property_id", propertyId)
      .maybeSingle(),
    loadLaundryBagsForOrder(propertyId, orderId),
    admin
      .from("staff_members")
      .select("id, full_name, role_label, department, access_level")
      .eq("property_id", propertyId)
      .in("status", ["active", "on_leave"])
      .order("full_name"),
  ]);
  if (!order) redirect("/erp/laundry");

  const staffOptions = (staff ?? [])
    .filter((member) => {
      const dept = String(member.department ?? "").toLowerCase();
      const role = String(member.role_label ?? "").toLowerCase();
      return (
        ["laundry", "housekeeping"].includes(dept) ||
        ["laundry", "housekeeping", "laundry maid"].includes(role) ||
        ["supervisor", "hr_admin", "owner"].includes(String(member.access_level))
      );
    })
    .map((member) => ({
      id: member.id as string,
      name: member.full_name as string,
    }));

  return (
    <div className="erp mx-auto w-full max-w-[1000px] space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3 print:hidden">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
            Bag custody
          </p>
          <h1 className="mt-1 text-3xl font-semibold">
            Print bag labels · Room {order.room_label_snapshot as string}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Stickers show room and bag number only. Staff login is required to
            see guest, garments, and folio charges after scanning.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/erp/laundry">Back to laundry</Link>
        </Button>
      </div>

      <section className="rounded-xl border bg-card p-4 print:hidden">
        <p className="text-sm">
          <span className="font-semibold">{bags.length}</span> active bag
          {bags.length === 1 ? "" : "s"} · Order{" "}
          <span className="font-mono">
            {orderId.slice(0, 8).toUpperCase()}
          </span>
        </p>
        {bags.length ? (
          <ul className="mt-3 space-y-2 text-sm">
            {bags.map((bag) => (
              <li
                key={bag.id}
                className="flex items-center justify-between rounded-lg border px-3 py-2"
              >
                <span>
                  Bag {bag.bag_seq} · {bag.public_code}
                </span>
                <span className="text-muted-foreground">
                  {bag.garment_count} pcs · {bag.status}
                </span>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <LaundryBagLabelPrinter
        orderId={orderId}
        roomLabel={order.room_label_snapshot as string}
        bags={bags}
        mode="desk"
        staffOptions={staffOptions}
      />
    </div>
  );
}
