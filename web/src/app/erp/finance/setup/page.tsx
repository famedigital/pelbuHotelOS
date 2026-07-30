import {
  ensureCloseChecklist,
} from "@/app/actions/erp-accounting";
import {
  FinanceShell,
} from "@/components/erp/finance/FinanceShell";
import {
  CloseChecklistForm,
  OpeningBalanceForm,
} from "@/components/erp/finance/SetupForms";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { isDeskAuthenticated } from "@/lib/desk-auth";
import { resolveActivePropertyId } from "@/lib/property-context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Finance · Setup | Pelbu OS",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

export default async function FinanceSetupPage() {
  if (!(await isDeskAuthenticated())) redirect("/erp/login");
  const admin = createSupabaseAdminClient();
  const propertyId = await resolveActivePropertyId(admin);
  const today = new Date().toISOString().slice(0, 10);

  const [
    { data: accounts },
    { data: opening },
    { data: period },
    postingErrorsRes,
  ] = await Promise.all([
    admin
      .from("accounting_accounts")
      .select("id, code, name, account_type")
      .eq("property_id", propertyId)
      .eq("is_active", true)
      .order("code"),
    admin
      .from("accounting_opening_balances")
      .select("id, effective_date, status")
      .eq("property_id", propertyId)
      .maybeSingle(),
    admin
      .from("accounting_periods")
      .select("id, label, status")
      .eq("property_id", propertyId)
      .lte("starts_on", today)
      .gte("ends_on", today)
      .maybeSingle(),
    admin
      .from("accounting_posting_events")
      .select("id", { count: "exact", head: true })
      .eq("property_id", propertyId)
      .eq("status", "error"),
  ]);

  let openingLines: Record<string, { debit: string; credit: string }> = {};
  if (opening?.id) {
    const { data: lines } = await admin
      .from("accounting_opening_balance_lines")
      .select("account_id, debit_btn, credit_btn")
      .eq("opening_balance_id", opening.id);
    openingLines = Object.fromEntries(
      (lines ?? []).map((line) => [
        line.account_id as string,
        {
          debit: Number(line.debit_btn) ? String(line.debit_btn) : "",
          credit: Number(line.credit_btn) ? String(line.credit_btn) : "",
        },
      ]),
    );
  }

  let checklist: { item_key: string; label: string; is_done: boolean }[] = [];
  if (period?.id) {
    await ensureCloseChecklist(period.id as string);
    const { data } = await admin
      .from("accounting_close_checklists")
      .select("item_key, label, is_done")
      .eq("period_id", period.id)
      .order("item_key");
    checklist = (data ?? []).map((item) => ({
      item_key: item.item_key as string,
      label: item.label as string,
      is_done: Boolean(item.is_done),
    }));
  }

  const canClose =
    checklist.length > 0 &&
    checklist.every((item) => item.is_done) &&
    (postingErrorsRes.count ?? 0) === 0 &&
    period?.status !== "closed";

  return (
    <FinanceShell
      title="Finance setup"
      description="Opening balances, chart of accounts, posting diagnostics, and period close."
    >
      <div className="grid gap-6 lg:grid-cols-2">
        <OpeningBalanceForm
          accounts={(accounts ?? []).map((a) => ({
            id: a.id as string,
            code: a.code as string,
            name: a.name as string,
          }))}
          effectiveDate={
            (opening?.effective_date as string | undefined) ?? today
          }
          lines={openingLines}
          status={(opening?.status as string | null) ?? null}
        />

        {period?.id ? (
          <CloseChecklistForm
            periodId={period.id as string}
            items={checklist}
            canClose={Boolean(canClose)}
          />
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Period close</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              No open fiscal period found for today. Seed runs on property
              create — check accounting_periods.
            </CardContent>
          </Card>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Chart of accounts</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="py-2 pr-3">Code</th>
                <th className="py-2 pr-3">Name</th>
                <th className="py-2">Type</th>
              </tr>
            </thead>
            <tbody>
              {(accounts ?? []).map((a) => (
                <tr key={a.id as string} className="border-b last:border-0">
                  <td className="py-2 pr-3 font-mono text-xs">{a.code as string}</td>
                  <td className="py-2 pr-3">{a.name as string}</td>
                  <td className="py-2">{a.account_type as string}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Diagnostics</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          <p>Opening status: {(opening?.status as string) ?? "not started"}</p>
          <p>Current period: {(period?.label as string) ?? "—"} ({(period?.status as string) ?? "n/a"})</p>
          <p>Posting errors: {postingErrorsRes.count ?? 0}</p>
        </CardContent>
      </Card>
    </FinanceShell>
  );
}
