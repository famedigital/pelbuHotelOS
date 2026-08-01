"use client";

import {
  assignLaundryOrder,
} from "@/app/actions/erp-laundry";
import { LaundryBagPrepareForm } from "@/components/laundry/LaundryBagPrepareForm";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  LAUNDRY_STATUS_LABEL,
  type LaundryBag,
  type LaundryOrder,
} from "@/lib/laundry";
import { formatBtn } from "@/lib/pricing";
import { usePendingFeedback } from "@/hooks/use-pending-feedback";
import { LayoutGridIcon, ListIcon, PrinterIcon } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useFormStatus } from "react-dom";

type StaffOption = { id: string; name: string };

function matchesSearch(order: LaundryOrder, query: string): boolean {
  if (!query.trim()) return true;
  const q = query.trim().toLowerCase();
  const haystack = [
    order.guest_name,
    order.guest_phone ?? "",
    order.room_label_snapshot,
    order.id,
    order.id.slice(0, 8),
    ...order.laundry_order_items.map((item) => item.name_snapshot),
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(q);
}

export function LaundryBoardPanel({
  orders,
  bagsByOrder,
  staff,
}: {
  orders: LaundryOrder[];
  bagsByOrder: Record<string, LaundryBag[]>;
  staff: StaffOption[];
}) {
  const [view, setView] = useState<"table" | "cards">("table");
  const [query, setQuery] = useState("");

  const filtered = useMemo(
    () => orders.filter((order) => matchesSearch(order, query)),
    [orders, query],
  );

  if (!orders.length) {
    return (
      <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
        No laundry orders yet.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search name, phone, room, order id…"
          className="max-w-sm"
          aria-label="Search laundry orders"
        />
        <div className="ml-auto flex rounded-lg border p-0.5">
          <Button
            type="button"
            size="sm"
            variant={view === "table" ? "secondary" : "ghost"}
            onClick={() => setView("table")}
            aria-pressed={view === "table"}
          >
            <ListIcon className="size-4" />
            Table
          </Button>
          <Button
            type="button"
            size="sm"
            variant={view === "cards" ? "secondary" : "ghost"}
            onClick={() => setView("cards")}
            aria-pressed={view === "cards"}
          >
            <LayoutGridIcon className="size-4" />
            Cards
          </Button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          No orders match &ldquo;{query.trim()}&rdquo;.
        </p>
      ) : view === "table" ? (
        <div className="overflow-x-auto rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Room</TableHead>
                <TableHead>Guest</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Items</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="w-[200px]">Assigned</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((order) => {
                const bags = bagsByOrder[order.id] ?? [];
                return (
                  <TableRow key={order.id} className="align-top">
                    <TableCell className="font-medium">
                      {order.room_label_snapshot}
                      <p className="font-mono text-[10px] text-muted-foreground">
                        {order.id.slice(0, 8).toUpperCase()}
                      </p>
                    </TableCell>
                    <TableCell>
                      <p>{order.guest_name}</p>
                      {order.guest_phone ? (
                        <p className="text-xs text-muted-foreground">
                          {order.guest_phone}
                        </p>
                      ) : null}
                      <p className="text-[10px] uppercase text-muted-foreground">
                        {order.source.replace("_", " ")}
                      </p>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          order.status === "exception"
                            ? "destructive"
                            : "outline"
                        }
                      >
                        {LAUNDRY_STATUS_LABEL[order.status]}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-[220px] text-xs text-muted-foreground">
                      {order.laundry_order_items
                        .map(
                          (item) =>
                            `${item.confirmed_qty ?? item.requested_qty}× ${item.name_snapshot}`,
                        )
                        .join(", ")}
                      {bags.length ? (
                        <span className="mt-1 block">
                          {bags.length} bag{bags.length === 1 ? "" : "s"}
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {order.total_btn == null
                        ? "—"
                        : formatBtn(order.total_btn)}
                    </TableCell>
                    <TableCell>
                      <AssignmentForm
                        orderId={order.id}
                        assignedStaffId={order.assigned_staff_id}
                        staff={staff}
                        compact
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/erp/laundry/orders/${order.id}/labels`}>
                          <PrinterIcon className="size-3.5" />
                          Labels
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((order) => (
            <LaundryCompactCard
              key={order.id}
              order={order}
              bags={bagsByOrder[order.id] ?? []}
              staff={staff}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function LaundryCompactCard({
  order,
  bags,
  staff,
}: {
  order: LaundryOrder;
  bags: LaundryBag[];
  staff: StaffOption[];
}) {
  return (
    <article className="rounded-lg border bg-card p-3 text-sm shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-semibold">
            {order.room_label_snapshot} · {order.guest_name}
          </p>
          <p className="text-xs text-muted-foreground">
            {order.source.replace("_", " ")}
            {order.guest_phone ? ` · ${order.guest_phone}` : ""}
          </p>
        </div>
        <Badge
          variant={order.status === "exception" ? "destructive" : "outline"}
          className="shrink-0 text-[10px]"
        >
          {LAUNDRY_STATUS_LABEL[order.status]}
        </Badge>
      </div>
      <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">
        {order.laundry_order_items
          .map(
            (item) =>
              `${item.confirmed_qty ?? item.requested_qty}× ${item.name_snapshot}`,
          )
          .join(", ")}
      </p>
      <div className="mt-3 flex items-center justify-between gap-2 border-t pt-2">
        <p className="font-mono text-[10px] text-muted-foreground">
          {order.id.slice(0, 8).toUpperCase()}
        </p>
        <p className="text-xs font-semibold tabular-nums">
          {order.total_btn == null ? "Pending" : formatBtn(order.total_btn)}
        </p>
      </div>
      <div className="mt-2">
        <AssignmentForm
          orderId={order.id}
          assignedStaffId={order.assigned_staff_id}
          staff={staff}
          compact
        />
      </div>
      <div className="mt-2">
        <Button asChild size="sm" variant="outline" className="h-8">
          <Link href={`/erp/laundry/orders/${order.id}/labels`}>
            <PrinterIcon className="size-3.5" />
            Labels
          </Link>
        </Button>
      </div>
      {order.status !== "delivered" && order.status !== "cancelled" ? (
        <details className="mt-2 rounded border px-2 py-1">
          <summary className="cursor-pointer text-[10px] font-medium text-muted-foreground">
            Split bags
          </summary>
          <div className="mt-2">
            <LaundryBagPrepareForm
              orderId={order.id}
              items={order.laundry_order_items}
              existingBags={bags}
              mode="desk"
              staffOptions={staff}
            />
          </div>
        </details>
      ) : null}
    </article>
  );
}

function AssignmentForm({
  orderId,
  assignedStaffId,
  staff,
  compact,
}: {
  orderId: string;
  assignedStaffId: string | null;
  staff: StaffOption[];
  compact?: boolean;
}) {
  const [value, setValue] = useState(assignedStaffId ?? "__unassigned__");

  return (
    <form action={assignLaundryOrder} className="min-w-0">
      <input type="hidden" name="order_id" value={orderId} />
      <input type="hidden" name="staff_id" value={value} />
      {!compact ? (
        <Label className="mb-1 block text-xs">Assigned to</Label>
      ) : null}
      <div className="flex gap-1">
        <Select value={value} onValueChange={setValue}>
          <SelectTrigger className={compact ? "h-8 text-xs" : "w-full"}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__unassigned__">Unassigned</SelectItem>
            {staff.map((member) => (
              <SelectItem key={member.id} value={member.id}>
                {member.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <AssignSaveButton compact={compact} />
      </div>
    </form>
  );
}

function AssignSaveButton({ compact }: { compact?: boolean }) {
  const { pending } = useFormStatus();
  usePendingFeedback(pending, "Assigning laundry…");
  return (
    <Button
      type="submit"
      variant="outline"
      size="sm"
      className={compact ? "h-8 shrink-0 px-2" : undefined}
      disabled={pending}
    >
      {pending ? "…" : "Save"}
    </Button>
  );
}
