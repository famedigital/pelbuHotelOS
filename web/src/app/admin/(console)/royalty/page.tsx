import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { markRoyaltyPaid } from "@/app/actions/platform-admin";
import { formatBtn } from "@/lib/pricing-catalog";

export const dynamic = "force-dynamic";
export const metadata = { title: "Royalty", robots: { index: false, follow: false } };

export default async function RoyaltyPage() {
  let rows: Array<{
    id: string;
    amount_btn: number;
    status: string;
    bank_ref: string | null;
    distributor_id: string;
  }> = [];
  try {
    const admin = createSupabaseAdminClient();
    const { data } = await admin
      .from("royalty_invoices")
      .select("id, amount_btn, status, bank_ref, distributor_id")
      .order("created_at", { ascending: false })
      .limit(100);
    rows = (data as typeof rows) ?? [];
  } catch {
    rows = [];
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Royalty</h1>
        <p className="text-sm text-muted-foreground">
          Distributor → Fame settlements (bank). Create rows via ops/SQL for MVP.
        </p>
      </div>
      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full text-left text-sm">
          <thead className="border-b bg-muted/40">
            <tr>
              <th className="px-3 py-2">Amount</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Bank ref</th>
              <th className="px-3 py-2">Mark paid</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-muted-foreground">
                  No royalty invoices yet.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="border-b">
                  <td className="px-3 py-2">{formatBtn(Number(r.amount_btn))}</td>
                  <td className="px-3 py-2">{r.status}</td>
                  <td className="px-3 py-2">{r.bank_ref ?? "—"}</td>
                  <td className="px-3 py-2">
                    {r.status !== "paid" ? (
                      <form action={markRoyaltyPaid} className="flex gap-2">
                        <input type="hidden" name="invoice_id" value={r.id} />
                        <input
                          name="bank_ref"
                          placeholder="Bank ref"
                          className="rounded border px-2 py-1 text-xs"
                        />
                        <button type="submit" className="text-xs underline">
                          Paid
                        </button>
                      </form>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
