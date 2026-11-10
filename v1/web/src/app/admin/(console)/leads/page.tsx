import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { assignLeadDistributor } from "@/app/actions/platform-admin";

export const dynamic = "force-dynamic";
export const metadata = { title: "Leads", robots: { index: false, follow: false } };

export default async function AdminLeadsPage() {
  let leads: Array<{
    id: string;
    name: string;
    phone: string;
    segment: string;
    status: string;
    dzongkhag: string | null;
    rooms: number | null;
  }> = [];
  let distributors: Array<{ id: string; name: string }> = [];
  try {
    const admin = createSupabaseAdminClient();
    const [l, d] = await Promise.all([
      admin
        .from("sales_leads")
        .select("id, name, phone, segment, status, dzongkhag, rooms")
        .order("created_at", { ascending: false })
        .limit(100),
      admin.from("distributors").select("id, name").eq("status", "active"),
    ]);
    leads = (l.data as typeof leads) ?? [];
    distributors = d.data ?? [];
  } catch {
    /* empty */
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Leads</h1>
        <p className="text-sm text-muted-foreground">From /demo marketing form.</p>
      </div>
      <div className="space-y-4">
        {leads.length === 0 ? (
          <p className="text-sm text-muted-foreground">No leads yet.</p>
        ) : (
          leads.map((lead) => (
            <div key={lead.id} className="rounded-xl border p-4 text-sm">
              <p className="font-medium">
                {lead.name} · {lead.phone}
              </p>
              <p className="text-muted-foreground">
                {lead.segment} · {lead.rooms ?? "?"} rooms · {lead.dzongkhag ?? "—"} ·{" "}
                {lead.status}
              </p>
              <form action={assignLeadDistributor} className="mt-2 flex flex-wrap gap-2">
                <input type="hidden" name="lead_id" value={lead.id} />
                <select name="distributor_id" className="rounded border px-2 py-1 text-xs">
                  <option value="">Unassigned / Fame</option>
                  {distributors.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
                <button type="submit" className="text-xs underline">
                  Assign
                </button>
              </form>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
