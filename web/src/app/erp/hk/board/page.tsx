import { isDeskAuthenticated } from "@/lib/desk-auth";
import { requireDeskPropertyId } from "@/lib/desk-property";
import { thimphuToday, fmtDate } from "@/lib/erp-lists";
import { loadProperty } from "@/lib/property-context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  GlanceableHousekeepingBoard,
  type HkRoomCardData,
} from "@/components/erp/hk/GlanceableHousekeepingBoard";
import { redirect } from "next/navigation";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Housekeeping Floor Wallboard | Hotel OS Bhutan",
  description: "Touch-friendly HK command wallboard, room turnover, and 1-tap clean status",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function ErpHkBoardPage() {
  if (!(await isDeskAuthenticated())) {
    redirect("/erp/login");
  }

  const admin = createSupabaseAdminClient();
  const propertyId = await requireDeskPropertyId();
  const today = thimphuToday();

  const [unitsRes, staysRes, property] = await Promise.all([
    admin
      .from("room_units")
      .select("id, label, hk_status, service_requested_at")
      .eq("property_id", propertyId)
      .order("label"),
    admin
      .from("bookings")
      .select(`
        id,
        contact_name,
        check_in,
        check_out,
        status,
        room_assignments (room_unit_id)
      `)
      .eq("property_id", propertyId)
      .or(`status.eq.checked_in,and(check_in.lte.${today},check_out.gte.${today})`),
    loadProperty(admin, propertyId),
  ]);

  const units = unitsRes.data ?? [];
  const stays = staysRes.data ?? [];

  // Map stay to roomUnitId
  const stayByRoom = new Map<string, (typeof stays)[0]>();
  for (const s of stays) {
    for (const a of s.room_assignments ?? []) {
      if (a.room_unit_id) {
        stayByRoom.set(a.room_unit_id, s);
      }
    }
  }

  const rooms: HkRoomCardData[] = units.map((u) => {
    const stay = stayByRoom.get(u.id);
    let occupancy: HkRoomCardData["occupancyStatus"] = "vacant";
    let checkoutTime: string | null = null;
    let arrivalEta: string | null = null;

    if (stay) {
      if (stay.status === "checked_in") {
        if (stay.check_out === today) {
          occupancy = "departing";
          checkoutTime = "11:00 AM";
        } else {
          occupancy = "occupied";
        }
      } else if (stay.check_in === today) {
        occupancy = "arriving";
        arrivalEta = "14:00 PM";
      }
    }

    return {
      id: u.id,
      label: `Room ${u.label}`,
      hkStatus: (u.hk_status as HkRoomCardData["hkStatus"]) || "dirty",
      occupancyStatus: occupancy,
      guestName: stay?.contact_name || null,
      checkoutTime,
      arrivalEta,
      notes: u.service_requested_at ? "Front Desk requested priority tidy" : null,
    };
  });

  return (
    <div className="container mx-auto px-4 py-6 max-w-7xl">
      <GlanceableHousekeepingBoard
        rooms={rooms}
        propertyTitle={property?.name || "Hotel OS Bhutan"}
        todayDate={fmtDate(today)}
      />
    </div>
  );
}
