"use client";

import { Button } from "@/components/ui/button";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { formatBtn } from "@/lib/pricing";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { useMemo, useState } from "react";
import { toast } from "sonner";

export type InvoiceDeskRow = {
  id: string;
  docNo: string;
  status: string;
  issuedAt: string | null;
  issueDate: string;
  folioId: string | null;
  label: string;
  bookingId: string | null;
  agentName: string | null;
  guestName: string | null;
  guideNumber: string | null;
  mealPlan: string | null;
  roomsLabel: string | null;
  total: number;
  balance: number;
  unpaid: boolean;
};

function groupByDate(rows: InvoiceDeskRow[]) {
  const map = new Map<string, InvoiceDeskRow[]>();
  for (const row of rows) {
    const key = row.issueDate || "Unknown";
    const list = map.get(key) ?? [];
    list.push(row);
    map.set(key, list);
  }
  return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]));
}

export function InvoicesDesk({
  rows,
  fromDefault,
  toDefault,
}: {
  rows: InvoiceDeskRow[];
  fromDefault?: string;
  toDefault?: string;
}) {
  const [q, setQ] = useState("");
  const [from, setFrom] = useState(fromDefault ?? "");
  const [to, setTo] = useState(toDefault ?? "");
  const [status, setStatus] = useState<"all" | "issued" | "superseded">("all");

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (status !== "all" && r.status !== status) return false;
      if (from && r.issueDate && r.issueDate < from) return false;
      if (to && r.issueDate && r.issueDate > to) return false;
      if (!needle) return true;
      const hay = [
        r.docNo,
        r.label,
        r.agentName,
        r.guestName,
        r.guideNumber,
        r.mealPlan,
        r.roomsLabel,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(needle);
    });
  }, [rows, q, from, to, status]);

  const groups = groupByDate(filtered);

  if (rows.length === 0) {
    return (
      <EmptyState
        title="No tax invoices yet"
        description="Issue an INV-… from a folio when the guest or agent needs a tax invoice."
        action={
          <Button asChild size="sm">
            <Link href="/erp/bills?tab=stay">Find a stay</Link>
          </Button>
        }
      />
    );
  }

  return (
    <div className="space-y-3">
      <form
        className="flex flex-wrap items-end gap-2 rounded-md border bg-muted/20 p-2"
        onSubmit={(e) => e.preventDefault()}
      >
        <label className="space-y-0.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
          From
          <Input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="h-8 w-[9.5rem] text-xs"
          />
        </label>
        <label className="space-y-0.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
          To
          <Input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="h-8 w-[9.5rem] text-xs"
          />
        </label>
        <label className="space-y-0.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
          Status
          <select
            value={status}
            onChange={(e) =>
              setStatus(e.target.value as "all" | "issued" | "superseded")
            }
            className="flex h-8 w-[8.5rem] rounded-md border border-input bg-transparent px-2 text-xs"
          >
            <option value="all">All</option>
            <option value="issued">Issued</option>
            <option value="superseded">Superseded</option>
          </select>
        </label>
        <label className="min-w-[12rem] flex-1 space-y-0.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
          Search
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="INV, guest, agent, guide…"
            className="h-8 text-xs"
          />
        </label>
        <p className="pb-1 text-[11px] text-muted-foreground">
          {filtered.length} of {rows.length} · right-click a row
        </p>
      </form>

      {groups.length === 0 ? (
        <EmptyState
          title="No invoices match"
          description="Widen the date range or clear search."
        />
      ) : (
        groups.map(([date, dayRows]) => (
          <div key={date} className="overflow-hidden rounded-md border">
            <div className="flex items-center justify-between border-b bg-muted/40 px-3 py-1.5">
              <p className="text-xs font-semibold tracking-tight">{date}</p>
              <p className="text-[11px] text-muted-foreground tabular-nums">
                {dayRows.length} INV ·{" "}
                {formatBtn(dayRows.reduce((s, r) => s + r.total, 0))}
              </p>
            </div>
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="h-8 text-[11px]">Invoice</TableHead>
                  <TableHead className="h-8 text-[11px]">Guest / agent</TableHead>
                  <TableHead className="h-8 text-[11px]">Meal</TableHead>
                  <TableHead className="h-8 text-[11px]">Rooms</TableHead>
                  <TableHead className="h-8 text-right text-[11px]">Total</TableHead>
                  <TableHead className="h-8 text-[11px]">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dayRows.map((inv) => (
                  <InvoiceRow key={inv.id} inv={inv} />
                ))}
              </TableBody>
            </Table>
          </div>
        ))
      )}
    </div>
  );
}

function InvoiceRow({ inv }: { inv: InvoiceDeskRow }) {
  const folioHref = inv.folioId ? `/erp/folios/${inv.folioId}` : null;
  const printBase = `/erp/invoices/${inv.id}/print`;
  const stayHref = inv.bookingId
    ? `/erp/calendar?booking=${inv.bookingId}`
    : null;

  const copyInv = async () => {
    try {
      await navigator.clipboard.writeText(inv.docNo);
      toast.success(`Copied ${inv.docNo}`);
    } catch {
      toast.error("Could not copy");
    }
  };

  return (
    <ContextMenu>
      <HoverCard openDelay={200} closeDelay={100}>
        <ContextMenuTrigger asChild>
          <HoverCardTrigger asChild>
            <TableRow
              className={cn(
                "h-10 cursor-context-menu",
                inv.unpaid && "bg-destructive/5",
              )}
            >
              <TableCell className="font-mono text-xs font-medium">
                {folioHref ? (
                  <Link
                    href={folioHref}
                    className="text-accent underline-offset-2 hover:underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {inv.docNo}
                  </Link>
                ) : (
                  inv.docNo
                )}
              </TableCell>
              <TableCell className="max-w-[14rem] truncate text-xs">
                <span className="text-foreground">
                  {inv.guestName ?? inv.label}
                </span>
                {inv.agentName ? (
                  <span className="block truncate text-[10px] text-muted-foreground">
                    {inv.agentName}
                    {inv.guideNumber ? ` · G# ${inv.guideNumber}` : ""}
                  </span>
                ) : inv.guideNumber ? (
                  <span className="block text-[10px] text-muted-foreground">
                    G# {inv.guideNumber}
                  </span>
                ) : null}
              </TableCell>
              <TableCell className="text-xs text-muted-foreground">
                {inv.mealPlan ?? "—"}
              </TableCell>
              <TableCell className="max-w-[8rem] truncate text-xs text-muted-foreground">
                {inv.roomsLabel ?? "—"}
              </TableCell>
              <TableCell className="text-right text-xs tabular-nums">
                {formatBtn(inv.total)}
                {inv.unpaid ? (
                  <span className="ml-1 text-[10px] text-destructive">due</span>
                ) : null}
              </TableCell>
              <TableCell className="text-[11px] capitalize text-muted-foreground">
                {inv.status}
              </TableCell>
            </TableRow>
          </HoverCardTrigger>
        </ContextMenuTrigger>
        <HoverCardContent align="start" className="w-80 space-y-2 text-xs">
          <div>
            <p className="font-mono text-sm font-semibold">{inv.docNo}</p>
            <p className="text-muted-foreground">{inv.label}</p>
          </div>
          <dl className="grid grid-cols-[5.5rem_1fr] gap-x-2 gap-y-1">
            <dt className="text-muted-foreground">Guest</dt>
            <dd>{inv.guestName ?? "—"}</dd>
            <dt className="text-muted-foreground">Agent</dt>
            <dd>{inv.agentName ?? "—"}</dd>
            <dt className="text-muted-foreground">Guide</dt>
            <dd>{inv.guideNumber ?? "—"}</dd>
            <dt className="text-muted-foreground">Meal</dt>
            <dd>{inv.mealPlan ?? "—"}</dd>
            <dt className="text-muted-foreground">Rooms</dt>
            <dd>{inv.roomsLabel ?? "—"}</dd>
            <dt className="text-muted-foreground">Total</dt>
            <dd className="tabular-nums">{formatBtn(inv.total)}</dd>
            <dt className="text-muted-foreground">Balance</dt>
            <dd className="tabular-nums">{formatBtn(inv.balance)}</dd>
          </dl>
          <div className="flex flex-wrap gap-2 border-t pt-2">
            <Link
              href={`${printBase}?bill=master`}
              className="text-accent underline-offset-2 hover:underline"
            >
              Master
            </Link>
            <Link
              href={`${printBase}?bill=room`}
              className="text-accent underline-offset-2 hover:underline"
            >
              Room
            </Link>
            <Link
              href={`${printBase}?bill=fnb`}
              className="text-accent underline-offset-2 hover:underline"
            >
              F&amp;B
            </Link>
            {folioHref ? (
              <Link
                href={folioHref}
                className="text-accent underline-offset-2 hover:underline"
              >
                Folio
              </Link>
            ) : null}
          </div>
        </HoverCardContent>
      </HoverCard>
      <ContextMenuContent className="w-52">
        {folioHref ? (
          <ContextMenuItem asChild>
            <Link href={folioHref}>Open folio</Link>
          </ContextMenuItem>
        ) : null}
        {stayHref ? (
          <ContextMenuItem asChild>
            <Link href={stayHref}>Open on rack</Link>
          </ContextMenuItem>
        ) : null}
        <ContextMenuSeparator />
        <ContextMenuItem asChild>
          <Link href={`${printBase}?bill=master`}>Print master bill</Link>
        </ContextMenuItem>
        <ContextMenuItem asChild>
          <Link href={`${printBase}?bill=room`}>Print room bill</Link>
        </ContextMenuItem>
        <ContextMenuItem asChild>
          <Link href={`${printBase}?bill=fnb`}>Print F&amp;B bill</Link>
        </ContextMenuItem>
        <ContextMenuSeparator />
        {folioHref ? (
          <>
            <ContextMenuItem asChild>
              <Link href={`${folioHref}#folio-invoice`}>
                Supersede / reissue / meal plan
              </Link>
            </ContextMenuItem>
            <ContextMenuItem asChild>
              <Link href={folioHref}>Collect payment</Link>
            </ContextMenuItem>
          </>
        ) : null}
        <ContextMenuSeparator />
        <ContextMenuItem onSelect={() => void copyInv()}>
          Copy INV number
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
