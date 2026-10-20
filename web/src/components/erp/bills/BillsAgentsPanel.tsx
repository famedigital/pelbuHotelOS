import { BillsOwesPanel } from "@/components/erp/bills/BillsOwesPanel";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { requireDeskPropertyId } from "@/lib/desk-property";
import { thimphuToday } from "@/lib/erp-lists";
import { formatBtn } from "@/lib/pricing";
import { loadAgentArReport } from "@/lib/reports/catalog";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import Link from "next/link";

/** Agents tab: AR aging summary + unpaid agent balances. */
export async function BillsAgentsPanel() {
  const admin = createSupabaseAdminClient();
  const propertyId = await requireDeskPropertyId();
  const today = thimphuToday();
  const from = `${today.slice(0, 4)}-01-01`;
  const rows = await loadAgentArReport(admin, {
    propertyId,
    from,
    to: today,
    today,
  });
  const withDue = rows.filter((r) => Math.abs(r.outstanding) > 0.5);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
            Agent AR aging
          </p>
          <Button asChild variant="ghost" size="sm" className="h-7 text-xs">
            <Link href="/erp/reports/agent-ar">Full agent AR report</Link>
          </Button>
        </div>
        {withDue.length === 0 ? (
          <p className="rounded-md border border-dashed px-3 py-6 text-sm text-muted-foreground">
            No outstanding agent balances for this property.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Agent</TableHead>
                  <TableHead className="text-right">Outstanding</TableHead>
                  <TableHead className="text-right">Credit used</TableHead>
                  <TableHead>Habit</TableHead>
                  <TableHead className="text-right">Open</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {withDue.slice(0, 40).map((r) => (
                  <TableRow key={r.agent_id} className="h-11">
                    <TableCell className="font-medium">
                      {r.company_name}
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-medium text-destructive">
                      {formatBtn(r.outstanding)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {formatBtn(r.credit_used)}
                      {r.credit_limit > 0
                        ? ` / ${formatBtn(r.credit_limit)}`
                        : ""}
                    </TableCell>
                    <TableCell className="max-w-[14rem] truncate text-xs text-muted-foreground">
                      {r.habit}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button asChild variant="ghost" size="sm" className="h-8">
                        <Link href={`/erp/agents/${r.agent_id}`}>Dossier</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <div>
        <p className="mb-2 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
          Open agent bills
        </p>
        <BillsOwesPanel forceAgents />
      </div>
    </div>
  );
}
