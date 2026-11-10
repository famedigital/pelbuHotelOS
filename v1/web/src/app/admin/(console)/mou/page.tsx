import Link from "next/link";
import { EmptyState } from "@/components/ui/empty-state";
import { formatBtn } from "@/lib/pricing-catalog";
import { loadMouRegistry } from "@/lib/platform/admin-data";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "MoU Registry",
  robots: { index: false, follow: false },
};

export default async function AdminMouRegistryPage() {
  const { rows, error } = await loadMouRegistry();
  const active = rows.filter((r) => r.status === "active").length;
  const pending = rows.filter((r) =>
    ["pending_counterparty", "pending_mou_signature", "draft"].includes(r.status),
  ).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">MoU Registry</h1>
          <p className="text-sm text-muted-foreground">
            Cross-tenant hotel↔agent commercial links. Rich propose/accept UX lives on desk Partner
            Portal; this page is national oversight.
          </p>
        </div>
        <div className="flex gap-2 text-sm">
          <span className="rounded-lg border px-3 py-1.5">Active {active}</span>
          <span className="rounded-lg border px-3 py-1.5">Pending {pending}</span>
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        Deep-link desk surfaces:{" "}
        <Link href="/admin/partner" className="underline">
          B2B / Partner ops
        </Link>{" "}
        ·{" "}
        <Link href="/admin/vault/agents" className="underline">
          Vault verify
        </Link>
      </p>

      {error ? (
        <EmptyState title="Could not load MoUs" description={error} />
      ) : rows.length === 0 ? (
        <EmptyState
          title="No MoU links yet"
          description="Approve an agent–hotel link in Vault or activate MoU from the Partner Portal."
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full text-left text-sm">
            <thead className="border-b bg-muted/40">
              <tr>
                <th className="px-3 py-2">Agency</th>
                <th className="px-3 py-2">Hotel</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Credit</th>
                <th className="px-3 py-2">Signed</th>
                <th className="px-3 py-2">Source</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b last:border-0">
                  <td className="px-3 py-2">
                    <div className="font-medium">{r.agentName}</div>
                    <div className="font-mono text-[10px] text-muted-foreground">
                      {r.agentId.slice(0, 8)}
                    </div>
                  </td>
                  <td className="px-3 py-2">{r.propertyName}</td>
                  <td className="px-3 py-2">
                    <span className="rounded-full border px-2 py-0.5 font-mono text-[11px]">
                      {r.status}
                    </span>
                  </td>
                  <td className="px-3 py-2 tabular-nums text-xs">
                    {formatBtn(r.creditUsed)} / {formatBtn(r.creditLimit)}
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {r.mouSignedAt
                      ? new Date(r.mouSignedAt).toLocaleDateString()
                      : "—"}
                  </td>
                  <td className="px-3 py-2 font-mono text-[10px] text-muted-foreground">
                    {r.source}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
