import { PassPrintBar } from "@/components/erp/day-desk/PassPrintBar";
import { isDeskAuthenticated } from "@/lib/desk-auth";
import { loadDayOpsBoard } from "@/lib/erp/day-ops-board";
import { addIsoDays } from "@/lib/erp/occupancy-nights";
import { fmtDate, thimphuToday } from "@/lib/erp-lists";
import { requireDeskPropertyId } from "@/lib/desk-property";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { notFound, redirect } from "next/navigation";

export const dynamic = "force-dynamic";

const TITLES: Record<string, string> = {
  hk: "Housekeeping",
  kitchen: "Kitchen",
  fnb: "F&B",
  fo: "Front office",
};

export default async function DepartmentPassPrint({
  params,
}: {
  params: Promise<{ dept: string }>;
}) {
  if (!(await isDeskAuthenticated())) redirect("/erp/login");
  const { dept } = await params;
  const title = TITLES[dept];
  if (!title) notFound();
  const admin = createSupabaseAdminClient();
  const propertyId = await requireDeskPropertyId();
  const today = thimphuToday();
  const board = await loadDayOpsBoard(admin, propertyId, today);
  const tomorrow = await loadDayOpsBoard(admin, propertyId, addIsoDays(today, 1), {
    slices: ["departures", "arrivals"],
  });

  const lines: { room: string; detail: string }[] = [];
  if (dept === "hk" || dept === "fo") {
    for (const row of board.departures) {
      lines.push({
        room: row.room_labels ?? "—",
        detail: `Clean after ${row.contact_name ?? "guest"} leaves. Laundry ${row.open_laundry_count}.`,
      });
    }
    for (const row of board.arrivals) {
      lines.push({
        room: row.room_labels ?? "Unassigned",
        detail: `Prepare for ${row.contact_name ?? "guest"}, ${row.meal_plan_code}.`,
      });
    }
  }
  if (dept === "kitchen" || dept === "fnb" || dept === "fo") {
    for (const row of [...board.inHouse, ...board.arrivals]) {
      lines.push({
        room: row.room_labels ?? "—",
        detail: `${row.contact_name ?? "Guest"} · ${row.pax} heads · ${row.meal_plan_code} · ${row.guest_origin ?? ""}`,
      });
    }
  }
  if (dept === "fo") {
    for (const row of tomorrow.departures) {
      lines.push({
        room: row.room_labels ?? "—",
        detail: `Tomorrow checkout ${row.contact_name ?? "guest"} · guide ${row.guide_phone || row.guide_number || "not written"}`,
      });
    }
  }
  if (dept === "hk") {
    for (const row of tomorrow.arrivals) {
      lines.push({
        room: row.room_labels ?? "Unassigned",
        detail: `Tomorrow arrival ${row.contact_name ?? "guest"}, ${row.meal_plan_code}.`,
      });
    }
  }

  const whatsapp = `https://wa.me/?text=${encodeURIComponent(
    `${title} pass-out ${fmtDate(today)}. ${lines.length} lines. Print this page and attach the PDF.`,
  )}`;

  return (
    <main className="mx-auto max-w-[190mm] bg-white p-6 text-black">
      <p className="text-sm">Pelbu Suites Olakha · {fmtDate(today)} · {title}</p>
      <table className="mt-4 w-full border-collapse text-sm">
        <thead>
          <tr>
            <th className="border-b py-1 text-left">Room</th>
            <th className="border-b py-1 text-left">Detail</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line, index) => (
            <tr key={`${line.room}-${index}`}>
              <td className="border-b py-1 align-top">{line.room}</td>
              <td className="border-b py-1">{line.detail}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <PassPrintBar whatsapp={whatsapp} />
    </main>
  );
}
