import { ManualJournalForm } from "@/components/erp/finance/ManualJournalForm";
import {
  ExportButtons,
  FinanceKpi,
  FinanceShell,
} from "@/components/erp/finance/FinanceShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { isDeskAuthenticated } from "@/lib/desk-auth";
import { resolveActivePropertyId } from "@/lib/property-context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Finance · Accounting",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

function monthStart() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

export default async function FinanceAccountingPage() {
  if (!(await isDeskAuthenticated())) redirect("/erp/login");
  const admin = createSupabaseAdminClient();
  const propertyId = await resolveActivePropertyId(admin);
  const from = monthStart();
  const to = new Date().toISOString().slice(0, 10);

  const [{ data: accounts }, { data: journals }, { data: events }] =
    await Promise.all([
      admin
        .from("accounting_accounts")
        .select("id, code, name, account_type, is_postable, is_active")
        .eq("property_id", propertyId)
        .eq("is_active", true)
        .eq("is_postable", true)
        .order("code"),
      admin
        .from("accounting_journals")
        .select(
          "id, journal_no, journal_date, journal_kind, status, memo, posted_at",
        )
        .eq("property_id", propertyId)
        .order("journal_date", { ascending: false })
        .limit(80),
      admin
        .from("accounting_posting_events")
        .select("id, source_table, event_type, status, error_message, created_at")
        .eq("property_id", propertyId)
        .in("status", ["error", "pending"])
        .order("created_at", { ascending: false })
        .limit(40),
    ]);

  const posted = (journals ?? []).filter((j) => j.status === "posted").length;
  const errors = (events ?? []).filter((e) => e.status === "error").length;

  return (
    <FinanceShell
      title="Journals (books)"
      description="Drill-down only — day-to-day money stays on Hotel account, Income, and Expenses. Reverse mistakes here with reason."
      actions={<ExportButtons report="journals" from={from} to={to} />}
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <FinanceKpi label="Posted journals" value={String(posted)} />
        <FinanceKpi label="Postable accounts" value={String((accounts ?? []).length)} />
        <FinanceKpi label="Queue issues" value={String(errors)} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <ManualJournalForm
          accounts={(accounts ?? []).map((a) => ({
            id: a.id as string,
            code: a.code as string,
            name: a.name as string,
          }))}
        />
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Posting queue</CardTitle>
          </CardHeader>
          <CardContent>
            {(events ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No pending or failed posting events.
              </p>
            ) : (
              <ul className="divide-y text-sm">
                {(events ?? []).map((e) => (
                  <li key={e.id as string} className="py-2">
                    <p className="font-medium">
                      {e.event_type as string} · {e.status as string}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {e.source_table as string} ·{" "}
                      {(e.error_message as string | null) ?? "waiting"}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Recent journals</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="py-2 pr-3">No</th>
                <th className="py-2 pr-3">Date</th>
                <th className="py-2 pr-3">Kind</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2">Memo</th>
              </tr>
            </thead>
            <tbody>
              {(journals ?? []).map((j) => (
                <tr key={j.id as string} className="border-b last:border-0">
                  <td className="py-2 pr-3 font-mono text-xs">
                    {j.journal_no as string}
                  </td>
                  <td className="py-2 pr-3 tabular-nums">
                    {j.journal_date as string}
                  </td>
                  <td className="py-2 pr-3">{j.journal_kind as string}</td>
                  <td className="py-2 pr-3">{j.status as string}</td>
                  <td className="py-2">{(j.memo as string | null) ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </FinanceShell>
  );
}
