import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const metadata = { title: "Audit", robots: { index: false, follow: false } };

export default async function AuditPage() {
  let rows: Array<{
    id: string;
    action: string;
    actor_email: string | null;
    created_at: string;
  }> = [];
  try {
    const admin = createSupabaseAdminClient();
    const { data } = await admin
      .from("platform_audit_events")
      .select("id, action, actor_email, created_at")
      .order("created_at", { ascending: false })
      .limit(100);
    rows = (data as typeof rows) ?? [];
  } catch {
    rows = [];
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Audit log</h1>
        <p className="text-sm text-muted-foreground">
          Platform actions: onboard, support enter, royalty, leads.
        </p>
      </div>
      <ul className="space-y-2 text-sm">
        {rows.length === 0 ? (
          <li className="text-muted-foreground">No events yet.</li>
        ) : (
          rows.map((r) => (
            <li key={r.id} className="rounded-lg border px-3 py-2">
              <span className="font-medium">{r.action}</span> · {r.actor_email} ·{" "}
              {new Date(r.created_at).toLocaleString()}
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
