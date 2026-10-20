import { RoomsBoard, type RoomBoardUnit } from "@/components/erp/RoomsBoard";
import { FrontDeskLiveRefresh } from "@/components/erp/FrontDeskLiveRefresh";
import { RoomsHub } from "@/components/erp/rooms/RoomsHub";
import { isDeskAuthenticated } from "@/lib/desk-auth";
import { resolveActivePropertyId } from "@/lib/property-context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Rooms HK",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const HK_ORDER = ["dirty", "inspect", "occupied", "clean", "ooo"] as const;

export default async function ErpRoomsPage({
  searchParams,
}: {
  searchParams?: Promise<{ focus?: string; hk?: string }>;
}) {
  if (!(await isDeskAuthenticated())) redirect("/erp/login");

  const sp = searchParams ? await searchParams : {};
  const focusLabels = (sp.focus ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const dirtyOnly = (sp.hk ?? "").toLowerCase() === "dirty";

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
    <RoomsHub headerAside={<FrontDeskLiveRefresh />}>
      <div className="mb-3 flex flex-wrap gap-2 text-xs text-foreground">
        {HK_ORDER.map((s) => (
          <span
            key={s}
            className="inline-flex items-center gap-2 rounded-md border bg-card px-3 py-1.5"
          >
            <span className="font-medium tracking-wide text-accent uppercase">
              {s}
            </span>
            <span className="tabular-nums">{counts[s] ?? 0}</span>
          </span>
        ))}
      </div>

      <RoomsBoard
        units={boardUnits}
        focusLabels={focusLabels}
        dirtyOnly={dirtyOnly}
      />

      {boardUnits.length === 0 ? (
        <p className="text-sm text-muted-foreground">No room units seeded yet.</p>
      ) : null}
    </RoomsHub>
  );
}
