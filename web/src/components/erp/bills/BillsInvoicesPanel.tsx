import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { requireDeskPropertyId } from "@/lib/desk-property";
import {
  guestVisibleBalanceLines,
  netFolioBalance,
} from "@/lib/folio/balance";
import { formatBtn } from "@/lib/pricing";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import Link from "next/link";

export async function BillsInvoicesPanel() {
  const admin = createSupabaseAdminClient();
  const propertyId = await requireDeskPropertyId();
  const { data: docs } = await admin
    .from("fiscal_documents")
    .select(
      "id, doc_no, issued_at, folio_id, folios(id, label, status, folio_lines(id, total_btn, gst_btn, status, source_type, reverses_line_id))",
    )
    .eq("property_id", propertyId)
    .eq("doc_kind", "invoice")
    .eq("status", "issued")
    .order("issued_at", { ascending: false })
    .limit(60);

  const rows = (docs ?? []).map((doc) => {
    const rawFolio = doc.folios;
    const folio = (Array.isArray(rawFolio) ? rawFolio[0] : rawFolio) as {
      id: string;
      label: string;
      status: string;
      folio_lines: {
        id?: string;
        total_btn: number;
        gst_btn: number;
        status: string;
        source_type?: string;
        reverses_line_id?: string | null;
      }[] | null;
    } | null;
    const lines = folio?.folio_lines ?? [];
    const visible = guestVisibleBalanceLines(
      lines.map((l, i) => ({
        ...l,
        id: l.id ?? String(i),
      })),
    );
    const charges = visible.filter((l) => {
      const source = (l.source_type ?? "").toLowerCase();
      return source !== "payment" && source !== "deposit";
    });
    const total = charges.reduce((s, l) => s + Number(l.total_btn), 0);
    const balance = netFolioBalance(
      lines.map((l, i) => ({
        id: l.id ?? String(i),
        status: l.status,
        total_btn: Number(l.total_btn),
        reverses_line_id: l.reverses_line_id ?? null,
      })),
    );
    return {
      id: doc.id as string,
      docNo: (doc.doc_no as string) ?? "—",
      issuedAt: doc.issued_at as string | null,
      folioId: (doc.folio_id as string) ?? folio?.id ?? null,
      label: folio?.label ?? "—",
      total,
      unpaid: folio?.status === "open" && Math.abs(balance) > 0.009,
    };
  });

  if (rows.length === 0) {
    return (
      <EmptyState
        title="No tax invoices yet"
        description="Issue an INV-… from a folio bill when the guest or agent needs a tax invoice."
        action={
          <Button asChild size="sm">
            <Link href="/erp/bills?tab=stay">Find a stay</Link>
          </Button>
        }
      />
    );
  }

  return (
    <div className="overflow-x-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Invoice</TableHead>
            <TableHead>Bill</TableHead>
            <TableHead className="text-right">Total</TableHead>
            <TableHead>Issued</TableHead>
            <TableHead className="text-right">Open</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((inv) => (
            <TableRow key={inv.id} className="h-11">
              <TableCell className="font-medium">{inv.docNo}</TableCell>
              <TableCell className="max-w-[12rem] truncate text-sm text-muted-foreground">
                {inv.label}
                {inv.unpaid ? (
                  <span className="ml-1 text-destructive">· due</span>
                ) : null}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {formatBtn(inv.total)}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {inv.issuedAt
                  ? new Date(inv.issuedAt).toLocaleDateString()
                  : "—"}
              </TableCell>
              <TableCell className="text-right">
                <Button asChild variant="ghost" size="sm" className="h-8">
                  <Link href={`/erp/invoices/${inv.id}`}>View</Link>
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <p className="mt-2 px-1 text-xs text-muted-foreground">
        Full list with search:{" "}
        <Link href="/erp/invoices" className="text-accent underline-offset-4 hover:underline">
          Invoices
        </Link>
      </p>
    </div>
  );
}
