import { RoomsBoard, type RoomBoardUnit } from "@/components/erp/RoomsBoard";
import { FrontDeskLiveRefresh } from "@/components/erp/FrontDeskLiveRefresh";
import { isDeskAuthenticated } from "@/lib/desk-auth";
import { resolveActivePropertyId } from "@/lib/property-context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Rooms HK | Pelbu OS",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const HK_ORDER = ["dirty", "inspect", "occupied", "clean", "ooo"] as const;

export default async function ErpRoomsPage() {
  if (!(await isDeskAuthenticated())) redirect("/erp/login");

  const admin = createSupabaseAdminClient();
  const propertyId = await resolveActivePropertyId(admin);

  const { data: units } = await admin
    .from("room_units")
    .select(
      "id, label, hk_status, floor_label, notes, updated_at, service_requested_at, room_types(code, name, inventory_kind)",
    )
    .eq("property_id", propertyId)
    .order("label")
    .limit(200);

  const counts = Object.fromEntries(HK_ORDER.map((s) => [s, 0])) as Record<
    string,
    number
  >;
  for (const u of units ?? []) {
    const st = u.hk_status as string;
    counts[st] = (counts[st] ?? 0) + 1;
  }

  const boardUnits: RoomBoardUnit[] = (units ?? []).map((u) => {
    const rt = u.room_types as {
      code?: string;
      name?: string;
      inventory_kind?: string;
    } | null;
    const kind = rt?.inventory_kind ?? "";
    return {
      id: u.id as string,
      label: u.label as string,
      hk_status: u.hk_status as string,
      floor_label: (u.floor_label as string | null) ?? null,
      notes: (u.notes as string | null) ?? null,
      room_type_name: rt?.name ?? rt?.code ?? "Room",
      is_comp: kind === "guide_comp" || kind === "driver_comp",
      service_requested_at: (u.service_requested_at as string | null) ?? null,
    };
  });

  return (
    <div className="erp mx-auto w-full max-w-[1200px] space-y-10 p-4 md:p-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1.5">
          <p className="text-[11px] font-semibold tracking-[0.2em] text-accent uppercase">
            Rooms
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Housekeeping board
          </h1>
          <p className="max-w-prose text-sm text-muted-foreground">
            Toggle table or cards · multi-select bulk Request service. Checkout
            marks rooms dirty automatically.
          </p>
        </div>
        <FrontDeskLiveRefresh />
      </header>

      <section>
        <div className="flex flex-wrap gap-3 text-xs text-foreground">
          {HK_ORDER.map((s) => (
            <span
              key={s}
              className="inline-flex items-center gap-2 rounded-md border bg-card px-3 py-2"
            >
              <span className="font-medium tracking-wide text-accent uppercase">
                {s}
              </span>
              <span className="tabular-nums">{counts[s] ?? 0}</span>
            </span>
          ))}
        </div>
      </section>

      <RoomsBoard units={boardUnits} />

      {boardUnits.length === 0 ? (
        <p className="text-sm text-muted-foreground">No room units seeded yet.</p>
      ) : null}
    </div>
  );
}
