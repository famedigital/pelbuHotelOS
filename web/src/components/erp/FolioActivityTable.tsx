"use client";

import {
  ReversePaymentForm,
  TransferLineForm,
  VoidLineButton,
  CorrectLineForm,
} from "@/components/erp/FolioOpsForms";
import { formatBtn, roundBtn } from "@/lib/pricing";
import { cn } from "@/lib/utils";
import { useState } from "react";

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

export function FolioActivityTable({
  lines,
  isOpen,
  transferTargets,
  gstRate,
  balance,
}: {
  lines: FolioActivityLine[];
  isOpen: boolean;
  transferTargets: { id: string; label: string }[];
  gstRate: number;
  balance: number;
}) {
  const [advanced, setAdvanced] = useState(false);
  const visible = lines.filter((line) => !line.id.startsWith("skip"));
  const postedCharges = visible.filter(
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
    postedCharges.reduce((sum, line) => sum + Number(line.service_charge_btn ?? 0), 0),
  );
  const gst = roundBtn(
    postedCharges.reduce((sum, line) => sum + Number(line.gst_btn ?? 0), 0),
  );

  return (
    <div>
      <div className="flex items-center justify-end gap-1 border-b px-4 py-2 sm:px-5">
        <button
          type="button"
          onClick={() => setAdvanced(false)}
          className={cn(
            "h-7 rounded-full px-2.5 text-[11px] font-semibold",
            !advanced ? "bg-foreground text-background" : "text-muted-foreground",
          )}
        >
          Simple
        </button>
        <button
          type="button"
          onClick={() => setAdvanced(true)}
          className={cn(
            "h-7 rounded-full px-2.5 text-[11px] font-semibold",
            advanced ? "bg-foreground text-background" : "text-muted-foreground",
          )}
        >
          Advanced
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[28rem] text-left text-sm">
          <thead className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
            <tr>
              <th className="px-4 py-2 sm:px-5">Date</th>
              <th className="px-2 py-2">Description</th>
              {advanced ? (
                <>
                  <th className="px-2 py-2 text-right">Room net</th>
                  <th className="px-2 py-2 text-right">SC</th>
                  <th className="px-2 py-2 text-right">GST</th>
                  <th className="px-2 py-2">Bill to</th>
                  <th className="px-2 py-2">Type</th>
                </>
              ) : null}
              <th className="px-4 py-2 text-right sm:px-5">Amount</th>
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 ? (
              <tr>
                <td
                  colSpan={advanced ? 8 : 3}
                  className="px-4 py-8 text-sm text-muted-foreground sm:px-5"
                >
                  No lines yet. Check-in posts the first room night.
                </td>
              </tr>
            ) : (
              visible.map((line) => {
                const voided = line.status === "voided";
                const payment = isPayment(line.source_type);
                const total = Number(line.total_btn);
                const gstBtn = Number(line.gst_btn ?? 0);
                const scBtn = Number(line.service_charge_btn ?? 0);
                const netBtn = roundBtn(Math.max(0, total - gstBtn - scBtn));
                return (
                  <tr
                    key={line.id}
                    className={cn(
                      "border-t",
                      voided && "text-muted-foreground line-through",
                      payment && !voided && "text-sky-900 dark:text-sky-100",
                    )}
                  >
                    <td className="whitespace-nowrap px-4 py-2 tabular-nums text-muted-foreground sm:px-5">
                      {line.business_date ?? "—"}
                    </td>
                    <td className="px-2 py-2">
                      <p>{line.description}</p>
                      {isOpen && !voided && !payment ? (
                        <div className="mt-1 space-y-1 font-normal no-underline">
                          <VoidLineButton lineId={line.id} description={line.description} />
                          <CorrectLineForm
                            lineId={line.id}
                            description={line.description}
                            amount={Number(line.total_btn)}
                          />
                          <TransferLineForm
                            lineId={line.id}
                            siblingFolios={transferTargets}
                          />
                        </div>
                      ) : null}
                      {isOpen &&
                      !voided &&
                      payment &&
                      line.source_id ? (
                        <div className="mt-1 font-normal no-underline">
                          <ReversePaymentForm
                            paymentId={line.source_id}
                            amountLabel={formatBtn(total)}
                          />
                        </div>
                      ) : null}
                    </td>
                    {advanced ? (
                      <>
                        <td className="px-2 py-2 text-right tabular-nums">
                          {payment ? "—" : formatBtn(netBtn)}
                        </td>
                        <td className="px-2 py-2 text-right tabular-nums">
                          {payment ? "—" : scBtn > 0 ? formatBtn(scBtn) : "Nil"}
                        </td>
                        <td className="px-2 py-2 text-right tabular-nums">
                          {payment ? "—" : gstBtn > 0 ? formatBtn(gstBtn) : "Nil"}
                        </td>
                        <td className="px-2 py-2 text-xs text-muted-foreground">
                          {payment ? "—" : line.bill_to === "agent" ? "Agent" : "Guest"}
                        </td>
                        <td className="px-2 py-2 text-xs">{typeLabel(line.source_type)}</td>
                      </>
                    ) : null}
                    <td
                      className={cn(
                        "px-4 py-2 text-right tabular-nums sm:px-5",
                        payment && !voided && "text-sky-800 dark:text-sky-100",
                      )}
                    >
                      {formatBtn(total)}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      <div className="grid gap-1 border-t px-4 py-3 text-sm sm:px-5">
        <div className="flex justify-between gap-3">
          <span className="text-muted-foreground">Net</span>
          <span className="tabular-nums">{formatBtn(net)}</span>
        </div>
        <div className="flex justify-between gap-3">
          <span className="text-muted-foreground">Service charge</span>
          <span className="tabular-nums">{sc > 0 ? formatBtn(sc) : "Nil"}</span>
        </div>
        <div className="flex justify-between gap-3">
          <span className="text-muted-foreground">GST</span>
          <span className="tabular-nums">
            {gstRate <= 0 && gst <= 0 ? "Nil" : gst > 0 ? formatBtn(gst) : "Nil"}
          </span>
        </div>
        <div className="flex justify-between gap-3 border-t pt-1 font-semibold">
          <span>Balance</span>
          <span
            className={cn(
              "tabular-nums",
              balance > 0.5 && "text-amber-900 dark:text-amber-100",
            )}
          >
            {formatBtn(balance)}
          </span>
        </div>
      </div>
    </div>
  );
}
