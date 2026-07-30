import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { loadLaundryBagsByOrders } from "@/app/actions/laundry-bags";
import { LaundryDesk, type LaundryBookingOption } from "@/components/laundry/LaundryDesk";
import { DeskPageTitle } from "@/components/erp/DeskShell";
import { isDeskAuthenticated } from "@/lib/desk-auth";
import type {
  LaundryCatalogItem,
  LaundryOrder,
} from "@/lib/laundry";
import { resolveActivePropertyId } from "@/lib/property-context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const metadata: Metadata = {
  title: "Laundry | Pelbu OS",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function ErpLaundryPage() {
  if (!(await isDeskAuthenticated())) redirect("/erp/login");
  const admin = createSupabaseAdminClient();
  const propertyId = await resolveActivePropertyId(admin);
  const [{ data: catalog }, { data: orders }, { data: bookings }, { data: staff }] =
    await Promise.all([
      admin
        .from("laundry_catalog_items")
        .select(
          "id, name, category, unit_label, price_btn, gst_applicable, turnaround_hours, is_active, sort_order",
        )
        .eq("property_id", propertyId)
        .order("sort_order")
        .order("name"),
      admin
        .from("laundry_orders")
        .select(
          "id, booking_id, room_unit_id, guest_name, room_label_snapshot, source, status, assigned_staff_id, requested_notes, condition_notes, exception_notes, intake_photo_public_ids, completion_photo_public_ids, total_btn, requested_at, received_at, ready_at, delivered_at, billed_at, laundry_order_items(id, catalog_item_id, name_snapshot, unit_label_snapshot, requested_qty, confirmed_qty, unit_price_btn, line_total_btn)",
        )
        .eq("property_id", propertyId)
        .order("requested_at", { ascending: false })
        .limit(100),
      admin
        .from("bookings")
        .select(
          "id, contact_name, status, booking_guests(id, full_name), room_assignments(room_unit_id, room_units(id, label))",
        )
        .eq("property_id", propertyId)
        .eq("status", "checked_in")
        .order("check_out"),
      admin
        .from("staff_members")
        .select("id, full_name, role_label, department, access_level")
        .eq("property_id", propertyId)
        .in("status", ["active", "on_leave"])
        .order("full_name"),
    ]);

  const catalogRows = (catalog ?? []).map((row) => ({
    ...row,
    price_btn: Number(row.price_btn),
    turnaround_hours: Number(row.turnaround_hours),
  })) as LaundryCatalogItem[];
  const orderRows = (orders ?? []).map((row) => ({
    ...row,
    total_btn: row.total_btn == null ? null : Number(row.total_btn),
    intake_photo_public_ids:
      (row.intake_photo_public_ids as string[] | null) ?? [],
    completion_photo_public_ids:
      (row.completion_photo_public_ids as string[] | null) ?? [],
    laundry_order_items: (
      (row.laundry_order_items as LaundryOrder["laundry_order_items"]) ?? []
    ).map((item) => ({
      ...item,
      unit_price_btn:
        item.unit_price_btn == null ? null : Number(item.unit_price_btn),
      line_total_btn:
        item.line_total_btn == null ? null : Number(item.line_total_btn),
    })),
  })) as LaundryOrder[];
  const bagsByOrder = await loadLaundryBagsByOrders(
    propertyId,
    orderRows.map((order) => order.id),
  );
  const bookingOptions: LaundryBookingOption[] = (bookings ?? []).map((row) => {
    const contactName = (row.contact_name as string | null) ?? "Guest";
    const guestNames = [
      contactName,
      ...(
        (row.booking_guests as { full_name: string }[] | null) ?? []
      ).map((guest) => guest.full_name),
    ].filter((name, index, all) => name && all.indexOf(name) === index);
    const rooms = (
      (row.room_assignments as
        | {
            room_unit_id: string;
            room_units:
              | { id: string; label: string }
              | { id: string; label: string }[]
              | null;
          }[]
        | null) ?? []
    ).flatMap((assignment) => {
      const room = Array.isArray(assignment.room_units)
        ? assignment.room_units[0]
        : assignment.room_units;
      return room
        ? [{ id: room.id ?? assignment.room_unit_id, label: room.label }]
        : [];
    });
    return {
      id: row.id as string,
      contactName,
      rooms,
      guests: guestNames,
    };
  });
  const laundryStaff = (staff ?? [])
    .filter((member) => {
      const dept = String(member.department ?? "").toLowerCase();
      const role = String(member.role_label ?? "").toLowerCase();
      return (
        ["laundry", "housekeeping"].includes(dept) ||
        ["laundry", "housekeeping", "laundry maid"].includes(role) ||
        ["supervisor", "hr_admin", "owner"].includes(
          String(member.access_level),
        )
      );
    })
    .map((member) => ({
      id: member.id as string,
      name: member.full_name as string,
    }));

  return (
    <div className="erp mx-auto w-full max-w-[1280px] space-y-6 p-4 md:p-6">
      <DeskPageTitle
        eyebrow="Guest service"
        title="Laundry"
        description="Reception intake, bag labels, garment photos, live processing, folio charges, and delivery tracking."
      />
      <LaundryDesk
        catalog={catalogRows}
        orders={orderRows}
        bagsByOrder={bagsByOrder}
        bookings={bookingOptions}
        staff={laundryStaff}
      />
    </div>
  );
}
