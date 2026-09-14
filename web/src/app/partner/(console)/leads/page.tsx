import { getDistributorSession } from "@/lib/platform-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function PartnerLeadsPage() {
  const session = await getDistributorSession();
  if (!session) redirect("/partner/login");

  let leads: Array<{
    id: string;
    name: string;
    phone: string;
    segment: string;
    status: string;
  }> = [];
  try {
    const admin = createSupabaseAdminClient();
    const { data } = await admin
      .from("sales_leads")
      .select("id, name, phone, segment, status")
      .eq("distributor_id", session.distributorId)
      .order("created_at", { ascending: false });
    leads = (data as typeof leads) ?? [];
  } catch {
    leads = [];
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">My leads</h1>
      <ul className="space-y-2 text-sm">
        {leads.length === 0 ? (
          <li className="text-muted-foreground">No assigned leads.</li>
        ) : (
          leads.map((l) => (
            <li key={l.id} className="rounded-lg border px-3 py-2">
              {l.name} · {l.phone} · {l.segment} · {l.status}
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
