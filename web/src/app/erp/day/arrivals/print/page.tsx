import { PassPrintBar } from "@/components/erp/day-desk/PassPrintBar";
import { isDeskAuthenticated } from "@/lib/desk-auth";
import { requireDeskPropertyId } from "@/lib/desk-property";
import { loadDayOpsBoard, type DayOpsRow } from "@/lib/erp/day-ops-board";
import { addIsoDays } from "@/lib/erp/occupancy-nights";
import { fmtDate, thimphuToday } from "@/lib/erp-lists";
import { loadProperty } from "@/lib/property-context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

function mealWords(code: string): string {
  const plan = code.trim().toUpperCase();
  if (plan === "MAP") return "Breakfast and dinner";
  if (plan === "AP") return "All meals";
  if (plan === "BB" || plan === "CP") return "Breakfast";
  return "";
}

function doors(row: DayOpsRow): string[] {
  return (row.room_labels ?? "")
    .split(/[,\s]+/)
    .map((part) => part.trim())
    .filter((part) => /^\d{2,4}$/.test(part) || /^[A-Z]+-\d+$/i.test(part));
}

export default async function ArrivalWorksheet({
  searchParams,
}: {
  searchParams: Promise<{ when?: string }>;
}) {
  if (!(await isDeskAuthenticated())) redirect("/erp/login");
  const sp = await searchParams;
  const admin = createSupabaseAdminClient();
  const propertyId = await requireDeskPropertyId();
  const today = thimphuToday();
  const day = sp.when === "today" ? today : addIsoDays(today, 1);
  const [property, board] = await Promise.all([
    loadProperty(admin, propertyId),
    loadDayOpsBoard(admin, propertyId, day, { slices: ["arrivals"] }),
  ]);
  const ids = board.arrivals.map((row) => row.id);
  const { data: guests } = ids.length
    ? await admin.from("booking_guests").select("booking_id, nationality").in("booking_id", ids)
    : { data: [] };
  const nationality = new Map<string, string>();
  for (const guest of guests ?? []) {
    const name = (guest.nationality as string | null)?.trim();
    if (!name || nationality.has(guest.booking_id as string)) continue;
    nationality.set(guest.booking_id as string, name);
  }
  const hotel = property?.name?.trim() || "Hotel";
  const whatsapp = `https://wa.me/?text=${encodeURIComponent(
    `${hotel} arrivals ${fmtDate(day)}. ${board.arrivals.length} stays.`,
  )}`;

  return (
    <main className="mx-auto max-w-[210mm] bg-white p-6 text-black print:p-0">
      <p className="text-sm print:hidden">
        <a className="underline" href={sp.when === "today" ? "/erp/day/arrivals/print" : "/erp/day/arrivals/print?when=today"}>
          {sp.when === "today" ? "Show tomorrow" : "Show today"}
        </a>
      </p>
      <p className="text-sm">{hotel}</p>
      <h1 className="text-3xl font-bold">Arrivals</h1>
      <p className="text-lg">{fmtDate(day)}</p>
      <p className="mt-1 text-sm">Write in the empty boxes. {board.arrivals.length} stays.</p>
      <table className="mt-4 w-full border-collapse text-sm">
        <thead>
          <tr className="border-b-2 border-black text-left">
            <th className="py-1 pr-2">Room</th>
            <th className="py-1 pr-2">Guest</th>
            <th className="py-1 pr-2">People</th>
            <th className="py-1 pr-2">Country</th>
            <th className="py-1 pr-2">Meal</th>
            <th className="py-1 pr-2">Guide</th>
            <th className="py-1">Passport</th>
          </tr>
        </thead>
        <tbody>
          {board.arrivals.length ? (
            board.arrivals.map((row) => {
              const rooms = doors(row);
              const country = nationality.get(row.id) || "";
              const meal = mealWords(row.meal_plan_code);
              const guide = [row.guide_name, row.guide_phone || row.guide_number].filter(Boolean).join(" · ");
              return (
                <tr key={row.id} className="border-b border-black align-top">
                  <td className="py-2 pr-2">
                    {rooms.length ? (
                      <span className="text-lg font-bold">{rooms.join(", ")}</span>
                    ) : (
                      <span className="inline-block min-h-8 min-w-16 border border-black" />
                    )}
                  </td>
                  <td className="py-2 pr-2 font-medium">{row.contact_name?.trim() || "Guest"}</td>
                  <td className="py-2 pr-2 text-lg font-bold tabular-nums">{row.pax}</td>
                  <td className="py-2 pr-2">
                    {country || <span className="inline-block min-h-8 min-w-16 border border-black" />}
                  </td>
                  <td className="py-2 pr-2">
                    {meal || <span className="inline-block min-h-8 min-w-16 border border-black" />}
                  </td>
                  <td className="py-2 pr-2">
                    {guide || <span className="inline-block min-h-8 min-w-24 border border-black" />}
                  </td>
                  <td className="py-2">
                    <span className="inline-block min-h-8 min-w-20 border border-black" />
                  </td>
                </tr>
              );
            })
          ) : (
            <tr>
              <td colSpan={7} className="py-6">
                No arrivals on this day.
              </td>
            </tr>
          )}
        </tbody>
      </table>
      <PassPrintBar whatsapp={whatsapp} />
    </main>
  );
}
