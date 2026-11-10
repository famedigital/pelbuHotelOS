"use client";

import {
  ReversePaymentForm,
  TransferLineForm,
  VoidLineButton,
  CorrectLineForm,
} from "@/components/erp/FolioOpsForms";
import { formatBtn, roundBtn } from "@/lib/pricing";
import { cn } from "@/lib/utils";
import { Fragment, useState } from "react";

export type FolioActivityLine = {
  id: string;
  description: string;
  total_btn: number;
  gst_btn: number;
  service_charge_btn?: number;
  source_type: string;
  source_id?: string | null;
  status: string;
  business_date?: string | null;
  bill_to?: string | null;
  is_comp?: boolean;
  void_reason?: string | null;
};

function isPayment(sourceType: string) {
  return sourceType === "payment" || sourceType === "deposit";
}

function typeLabel(sourceType: string) {
  const map: Record<string, string> = {
    room: "Room",
    meal_plan: "Meal",
    extra_bed: "Extra bed",
    payment: "Payment",
    deposit: "Deposit",
    pos: "F&B",
    order: "F&B",
    laundry: "Laundry",
    adjustment: "Adjustment",
    comp: "Comp",
  };
  return map[sourceType] ?? sourceType.replace(/_/g, " ");
}

function sheetDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const day = iso.slice(0, 10);
  const date = new Date(`${day}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return day;
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

function sheetRoom(description: string): string {
  const match = description.match(/\bRoom\s+(\d+[A-Za-z0-9-]*)/i);
  return match?.[1] ?? "";
}

function sheetWhat(description: string, sourceType: string): string {
  let text = description.trim();
  text = text.replace(/^Room\s+\d+[A-Za-z0-9-]*\s*·\s*/i, "");
  text = text.replace(/\b\d{4}-\d{2}-\d{2}\b/g, "");
  text = text.replace(/^[\s·-]+|[\s·-]+$/g, "").replace(/\s{2,}/g, " ").trim();
  if (!text) return typeLabel(sourceType);
  return text;
}

function moneyOrBlank(amount: number, show: boolean): string {
  if (!show) return "—";
  if (Math.abs(amount) < 0.005) return "—";
  return formatBtn(amount);
}

const headCell =
  "border border-border bg-muted px-2 py-1.5 text-left text-xs font-semibold text-foreground";
const bodyCell = "border border-border px-2 py-1 align-middle";

export function FolioActivityTable({
  lines,
  isOpen,
  transferTargets,
  balance,
}: {
  lines: FolioActivityLine[];
  isOpen: boolean;
  transferTargets: { id: string; label: string }[];
  gstRate?: number;
  balance: number;
}) {
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const visible = lines.filter((line) => !line.id.startsWith("skip"));
  const ordered = [...visible].sort((a, b) => {
    const aDay = a.business_date ?? "";
    const bDay = b.business_date ?? "";
    if (aDay !== bDay) return aDay.localeCompare(bDay);
    return a.id.localeCompare(b.id);
  });

  let running = 0;
  const rows = ordered.map((line) => {
    const voided = line.status === "voided";
    if (!voided) running = roundBtn(running + Number(line.total_btn));
    return { line, running: voided ? null : running };
  });

  const postedCharges = ordered.filter(
    (line) => line.status !== "voided" && !isPayment(line.source_type),
  );
  const net = roundBtn(
    postedCharges.reduce((sum, line) => {
      const total = Number(line.total_btn);
      const gst = Number(line.gst_btn ?? 0);
      const sc = Number(line.service_charge_btn ?? 0);
      return sum + Math.max(0, total - gst - sc);
    }, 0),
  );
  const sc = roundBtn(
    postedCharges.reduce(
      (sum, line) => sum + Number(line.service_charge_btn ?? 0),
      0,
    ),
  );
  const gst = roundBtn(
    postedCharges.reduce((sum, line) => sum + Number(line.gst_btn ?? 0), 0),
  );
  const amountTotal = roundBtn(
    ordered
      .filter((line) => line.status !== "voided")
      .reduce((sum, line) => sum + Number(line.total_btn), 0),
  );

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[52rem] border-collapse text-left text-sm">
        <thead>
          <tr>
            <th className={headCell}>Date</th>
            <th className={headCell}>Room</th>
            <th className={headCell}>What</th>
            <th className={cn(headCell, "text-right")}>Net</th>
            <th className={cn(headCell, "text-right")}>Service</th>
            <th className={cn(headCell, "text-right")}>GST</th>
            <th className={cn(headCell, "text-right")}>Amount</th>
            <th className={cn(headCell, "text-right")}>Running due</th>
            <th className={cn(headCell, "w-10")} />
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td
                colSpan={9}
                className={cn(bodyCell, "px-3 py-8 text-muted-foreground")}
              >
                No lines yet. Add a charge to start the bill.
              </td>
            </tr>
          ) : (
            rows.map(({ line, running: runningDue }) => {
              const voided = line.status === "voided";
              const payment = isPayment(line.source_type);
              const total = Number(line.total_btn);
              const gstBtn = Number(line.gst_btn ?? 0);
              const scBtn = Number(line.service_charge_btn ?? 0);
              const netBtn = roundBtn(Math.max(0, total - gstBtn - scBtn));
              const menuOpen = openMenuId === line.id;
              const canEdit = isOpen && !voided;
              return (
                <Fragment key={line.id}>
                  <tr
                    className={cn(
                      voided && "text-muted-foreground line-through",
                      payment && !voided && "bg-muted/40",
                    )}
                  >
                    <td className={cn(bodyCell, "whitespace-nowrap tabular-nums")}>
                      {sheetDate(line.business_date)}
                    </td>
                    <td className={cn(bodyCell, "tabular-nums")}>
                      {sheetRoom(line.description) || "—"}
                    </td>
                    <td className={bodyCell}>
                      {sheetWhat(line.description, line.source_type)}
                      {line.bill_to === "agent" && !payment ? (
                        <span className="ml-1 text-xs text-muted-foreground">
                          · Agent
                        </span>
                      ) : null}
                    </td>
                    <td className={cn(bodyCell, "text-right tabular-nums")}>
                      {moneyOrBlank(netBtn, !payment)}
                    </td>
                    <td className={cn(bodyCell, "text-right tabular-nums")}>
                      {moneyOrBlank(scBtn, !payment)}
                    </td>
                    <td className={cn(bodyCell, "text-right tabular-nums")}>
                      {moneyOrBlank(gstBtn, !payment)}
                    </td>
                    <td className={cn(bodyCell, "text-right tabular-nums")}>
                      {formatBtn(total)}
                    </td>
                    <td className={cn(bodyCell, "text-right font-medium tabular-nums")}>
                      {runningDue == null ? "—" : formatBtn(runningDue)}
                    </td>
                    <td className={cn(bodyCell, "text-center")}>
                      {canEdit ? (
                        <button
                          type="button"
                          className="h-7 rounded px-1.5 text-xs text-muted-foreground hover:bg-muted"
                          aria-expanded={menuOpen}
                          aria-label={`Edit ${sheetWhat(line.description, line.source_type)}`}
                          onClick={() =>
                            setOpenMenuId(menuOpen ? null : line.id)
                          }
                        >
                          ···
                        </button>
                      ) : null}
                    </td>
                  </tr>
                  {menuOpen && canEdit ? (
                    <tr>
                      <td colSpan={9} className={cn(bodyCell, "bg-muted/30")}>
                        {payment && line.source_id ? (
                          <ReversePaymentForm
                            paymentId={line.source_id}
                            amountLabel={formatBtn(total)}
                            collapsed={false}
                          />
                        ) : (
                          <div className="flex flex-col gap-2">
                            <VoidLineButton
                              lineId={line.id}
                              description={line.description}
                            />
                            <CorrectLineForm
                              lineId={line.id}
                              description={line.description}
                              amount={Math.abs(total)}
                            />
                            <TransferLineForm
                              lineId={line.id}
                              siblingFolios={transferTargets}
                            />
                          </div>
                        )}
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              );
            })
          )}
        </tbody>
        <tfoot>
          <tr className="font-semibold">
            <td className={cn(bodyCell, "bg-muted")} colSpan={3}>
              Total
            </td>
            <td className={cn(bodyCell, "bg-muted text-right tabular-nums")}>
              {moneyOrBlank(net, postedCharges.length > 0)}
            </td>
            <td className={cn(bodyCell, "bg-muted text-right tabular-nums")}>
              {moneyOrBlank(sc, postedCharges.length > 0)}
            </td>
            <td className={cn(bodyCell, "bg-muted text-right tabular-nums")}>
              {moneyOrBlank(gst, postedCharges.length > 0)}
            </td>
            <td className={cn(bodyCell, "bg-muted text-right tabular-nums")}>
              {formatBtn(amountTotal)}
            </td>
            <td className={cn(bodyCell, "bg-muted text-right tabular-nums")}>
              {formatBtn(balance)}
            </td>
            <td className={cn(bodyCell, "bg-muted")} />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
