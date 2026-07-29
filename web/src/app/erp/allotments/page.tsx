import { AllotmentCreateForm } from "@/components/erp/P9OpsForms";
import {
  DeskListShell,
  DeskTable,
  StatusPill,
} from "@/components/erp/DeskListShell";
import { isDeskAuthenticated } from "@/lib/desk-auth";
import { fmtDate, requireDeskPropertyId } from "@/lib/erp-lists";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";

export const metadata = {
  title: "Allotments | Pelbu OS",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

export default async function AllotmentsPage() {
  if (!(await isDeskAuthenticated())) redirect("/erp/login");
  const admin = createSupabaseAdminClient();
  const propertyId = await requireDeskPropertyId();

  const [{ data: agents }, { data: roomTypes }, { data: rows }] =
    await Promise.all([
      admin
        .from("agents")
        .select("id, company_name")
        .eq("status", "approved")
        .order("company_name")
        .limit(80),
      admin
        .from("room_types")
        .select("id, name, code")
        .eq("property_id", propertyId)
        .eq("inventory_kind", "sellable_guest")
        .order("code")
        .limit(40),
      admin
        .from("agent_allotments")
        .select(
          "id, season_kind, rooms_per_week, valid_from, valid_to, notes, agents(company_name), room_types(name, code)",
        )
        .eq("property_id", propertyId)
        .order("valid_from", { ascending: false })
        .limit(100),
    ]);

  return (
    <DeskListShell
      title="Allotments"
      eyebrow="Contracts"
      heading="Agent allotments"
      blurb="Seasonal room blocks per agent (rooms/week). Enforcement against inventory can come later — this is the contract ledger."
    >
      <AllotmentCreateForm
        agents={(agents ?? []).map((a) => ({
          id: a.id as string,
          company_name: a.company_name as string,
        }))}
        roomTypes={(roomTypes ?? []).map((r) => ({
          id: r.id as string,
          name: `${r.name as string} (${r.code as string})`,
        }))}
      />

      <DeskTable
        caption="Allotments"
        headers={["Agent", "Room", "Season", "Rooms/wk", "Window", "Notes"]}
      >
        {(rows ?? []).length === 0 ? (
          <tr>
            <td colSpan={6} className="px-3 py-6 text-muted-foreground">
              No allotments yet.
            </td>
          </tr>
        ) : (
          (rows ?? []).map((r) => {
            const agent = r.agents as
              | { company_name?: string }
              | { company_name?: string }[]
              | null;
            const rt = r.room_types as
              | { name?: string; code?: string }
              | { name?: string; code?: string }[]
              | null;
            const agentName = Array.isArray(agent)
              ? agent[0]?.company_name
              : agent?.company_name;
            const room = Array.isArray(rt) ? rt[0] : rt;
            return (
              <tr key={r.id as string} className="border-t border-espresso/10">
                <td className="px-3 py-2.5 font-medium">{agentName ?? "—"}</td>
                <td className="px-3 py-2.5 text-sm">
                  {room?.name ?? room?.code ?? "—"}
                </td>
                <td className="px-3 py-2.5">
                  <StatusPill value={r.season_kind as string} />
                </td>
                <td className="px-3 py-2.5 tabular-nums">
                  {r.rooms_per_week as number}
                </td>
                <td className="px-3 py-2.5 text-sm">
                  {fmtDate(r.valid_from as string)} → {fmtDate(r.valid_to as string)}
                </td>
                <td className="px-3 py-2.5 text-sm text-muted-foreground">
                  {(r.notes as string) ?? "—"}
                </td>
              </tr>
            );
          })
        )}
      </DeskTable>
    </DeskListShell>
  );
}
