import { RoomHkButtons } from "@/components/erp/OpsForms";
import { DeskHeader } from "@/components/erp/DeskHeader";
import { isDeskAuthenticated } from "@/lib/desk-auth";
import { PELBU_PROPERTY_SLUG } from "@/lib/property";
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
  const { data: property } = await admin
    .from("properties")
    .select("id")
    .eq("slug", PELBU_PROPERTY_SLUG)
    .single();
  const propertyId = property?.id as string | undefined;
  if (!propertyId) {
    return (
      <div className="min-h-screen bg-ivory">
        <DeskHeader title="Rooms" />
        <main className="mx-auto max-w-[1200px] px-6 py-10">
          <p className="text-sm text-maroon">Property not configured.</p>
        </main>
      </div>
    );
  }

  const { data: units } = await admin
    .from("room_units")
    .select(
      "id, label, hk_status, floor_label, notes, updated_at, room_types(code, name, inventory_kind)",
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

  return (
    <div className="min-h-screen bg-ivory">
      <DeskHeader title="Rooms" />
      <main className="mx-auto max-w-[1200px] space-y-10 px-6 py-10 md:px-8">
        <section>
          <h2 className="text-xs font-semibold tracking-[0.22em] text-gold uppercase">
            Housekeeping board
          </h2>
          <p className="mt-2 text-sm text-muted">
            Physical units from room inventory — guest vs guide/driver stay separate for ADR.
          </p>
          <div className="mt-4 flex flex-wrap gap-3 text-xs text-espresso">
            {HK_ORDER.map((s) => (
              <span key={s} className="border border-espresso/15 bg-white px-3 py-2">
                <span className="font-medium uppercase tracking-wide text-gold">{s}</span>{" "}
                <span className="tabular-nums">{counts[s] ?? 0}</span>
              </span>
            ))}
          </div>
        </section>

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {(units ?? []).map((u) => {
            const rt = u.room_types as {
              code?: string;
              name?: string;
              inventory_kind?: string;
            } | null;
            const kind = rt?.inventory_kind ?? "";
            const isComp = kind === "guide_comp" || kind === "driver_comp";
            return (
              <article
                key={u.id as string}
                className="border border-espresso/10 bg-white p-4"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <h3 className="font-mono text-sm font-medium text-espresso">
                    {u.label as string}
                  </h3>
                  <span className="text-[10px] font-semibold tracking-[0.14em] text-gold uppercase">
                    {u.hk_status as string}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted">
                  {rt?.name ?? rt?.code ?? "Room"}
                  {isComp ? " · comp" : ""}
                </p>
                <RoomHkButtons
                  unitId={u.id as string}
                  current={u.hk_status as string}
                />
              </article>
            );
          })}
        </section>

        {(units ?? []).length === 0 ? (
          <p className="text-sm text-muted">No room units seeded yet.</p>
        ) : null}
      </main>
    </div>
  );
}
