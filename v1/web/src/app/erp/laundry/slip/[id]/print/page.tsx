import { isDeskAuthenticated } from "@/lib/desk-auth";
import { formatBtn } from "@/lib/pricing";
import { requireDeskPropertyId } from "@/lib/desk-property";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { notFound, redirect } from "next/navigation";
import { PassPrintBar } from "@/components/erp/day-desk/PassPrintBar";

export const dynamic = "force-dynamic";

export default async function LaundrySlipPrint({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!(await isDeskAuthenticated())) redirect("/erp/login");
  const { id } = await params;
  const admin = createSupabaseAdminClient();
  const propertyId = await requireDeskPropertyId();
  const { data: order } = await admin
    .from("laundry_orders")
    .select("guest_name, room_label_snapshot, requested_notes, total_btn, requested_at")
    .eq("id", id)
    .eq("property_id", propertyId)
    .maybeSingle();
  if (!order) notFound();
  const when = order.requested_at
    ? new Date(order.requested_at as string).toLocaleDateString("en-GB", { timeZone: "Asia/Thimphu" })
    : "";
  return (
    <main className="mx-auto max-w-[190mm] bg-white p-8 text-black">
      <p className="text-sm">Pelbu Suites Olakha</p>
      <h1 className="mt-2 text-lg">Laundry</h1>
      <p className="mt-2 text-sm">
        {order.guest_name as string} · Room {order.room_label_snapshot as string} · {when}
      </p>
      <p className="mt-4 whitespace-pre-wrap text-sm">{order.requested_notes as string}</p>
      <p className="mt-6 text-sm">Grand total {formatBtn(Number(order.total_btn ?? 0))}</p>
      <p className="mt-10 text-sm">Signature ______________________________</p>
      <PassPrintBar whatsapp={`https://wa.me/?text=${encodeURIComponent(`Laundry room ${order.room_label_snapshot}`)}`} />
    </main>
  );
}
