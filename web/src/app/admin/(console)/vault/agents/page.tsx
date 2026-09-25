import {
  markAgentMouSigned,
  verifyVaultAgent,
} from "@/app/actions/platform-vault";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import Link from "next/link";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Vault · Agents",
  robots: { index: false, follow: false },
};

export default async function AdminVaultAgentsPage() {
  const admin = createSupabaseAdminClient();
  const [{ data: queue }, { data: agents }, { data: properties }] =
    await Promise.all([
      admin
        .from("platform_verification_queue")
        .select("id, entity_id, property_id, payload, created_at, submitted_by")
        .eq("entity_type", "agent")
        .eq("status", "open")
        .order("created_at", { ascending: false })
        .limit(100),
      admin
        .from("agents")
        .select(
          "id, company_name, market, status, contact_phone, contact_email, dzongkhag, created_at",
        )
        .order("company_name", { ascending: true })
        .limit(400),
      admin.from("properties").select("id, name, hotel_code").order("name").limit(200),
    ]);

  const openIds = new Set((queue ?? []).map((q) => q.entity_id as string));

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Agent vault</h1>
        <p className="text-sm text-muted-foreground">
          Innora maintains the national travel-agent directory. Hotels get verified
          listings automatically. Partner portal rates &amp; inventory require a
          signed MoU per hotel.
        </p>
        <Link href="/admin/vault/guides" className="text-sm underline">
          Guide vault →
        </Link>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">
          Pending verification ({queue?.length ?? 0})
        </h2>
        {(queue ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">No open agent reviews.</p>
        ) : (
          <ul className="space-y-3">
            {(queue ?? []).map((item) => {
              const payload = (item.payload ?? {}) as Record<string, unknown>;
              const agent = (agents ?? []).find((a) => a.id === item.entity_id);
              return (
                <li
                  key={item.id}
                  className="rounded-xl border p-4 text-sm space-y-2"
                >
                  <p className="font-medium">
                    {agent?.company_name ??
                      String(payload.companyName ?? "Unknown")}
                  </p>
                  <p className="text-muted-foreground">
                    {String(payload.contactName ?? agent?.contact_phone ?? "—")} ·{" "}
                    {String(payload.licenseNo ?? "no license on file")} · from{" "}
                    {item.submitted_by ?? "—"}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <form action={verifyVaultAgent}>
                      <input type="hidden" name="agent_id" value={item.entity_id} />
                      <input type="hidden" name="status" value="directory" />
                      <button
                        type="submit"
                        className="rounded-md bg-primary px-3 py-1.5 text-primary-foreground"
                      >
                        Verify (directory)
                      </button>
                    </form>
                    <form action={verifyVaultAgent}>
                      <input type="hidden" name="agent_id" value={item.entity_id} />
                      <input type="hidden" name="status" value="approved" />
                      <button
                        type="submit"
                        className="rounded-md border px-3 py-1.5"
                      >
                        Verify + trade (approved)
                      </button>
                    </form>
                    <form action={verifyVaultAgent}>
                      <input type="hidden" name="agent_id" value={item.entity_id} />
                      <input type="hidden" name="status" value="rejected" />
                      <button
                        type="submit"
                        className="rounded-md border border-destructive/40 px-3 py-1.5 text-destructive"
                      >
                        Reject
                      </button>
                    </form>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Mark MoU signed</h2>
        <form action={markAgentMouSigned} className="grid gap-2 rounded-xl border p-4 sm:grid-cols-3">
          <select name="agent_id" required className="rounded-md border px-3 py-2 text-sm">
            <option value="">Agent…</option>
            {(agents ?? [])
              .filter((a) => a.status !== "rejected")
              .map((a) => (
                <option key={a.id} value={a.id}>
                  {a.company_name}
                </option>
              ))}
          </select>
          <select name="property_id" required className="rounded-md border px-3 py-2 text-sm">
            <option value="">Hotel…</option>
            {(properties ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.hotel_code ?? "—"})
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground"
          >
            Record MoU
          </button>
        </form>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Directory ({agents?.length ?? 0})</h2>
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full text-left text-sm">
            <thead className="border-b bg-muted/40">
              <tr>
                <th className="px-3 py-2">Company</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Market</th>
                <th className="px-3 py-2">Contact</th>
              </tr>
            </thead>
            <tbody>
              {(agents ?? []).map((a) => (
                <tr key={a.id} className="border-b last:border-0">
                  <td className="px-3 py-2">
                    {a.company_name}
                    {openIds.has(a.id) ? (
                      <span className="ml-2 text-xs text-amber-700">pending</span>
                    ) : null}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">{a.status}</td>
                  <td className="px-3 py-2">{a.market}</td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {a.contact_phone ?? a.contact_email ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
