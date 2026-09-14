"use client";

import {
  markGstReturnFiled,
  saveGstReturnPack,
  type ErpFinanceState,
} from "@/app/actions/erp-finance";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useActionToast } from "@/hooks/use-action-toast";
import { bitsCopyLines, type BitsGstPack } from "@/lib/gst/bits-pack-shared";
import { formatBtn } from "@/lib/pricing";
import { useActionState, useMemo } from "react";

const initial: ErpFinanceState = { ok: false };

function CopyButton({ text, label }: { text: string; label: string }) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="h-8"
      onClick={() => void navigator.clipboard.writeText(text)}
    >
      Copy {label}
    </Button>
  );
}

export function GstBitsPackPanel({
  pack,
  savedStatus,
  bankStatements,
}: {
  pack: BitsGstPack;
  savedStatus: string | null;
  bankStatements: { id: string; label: string }[];
}) {
  const [saveState, saveAction, savePending] = useActionState(saveGstReturnPack, initial);
  const [filedState, filedAction, filedPending] = useActionState(markGstReturnFiled, initial);
  useActionToast(saveState, { successMessage: "Pack saved" });
  useActionToast(filedState, { successMessage: "Marked filed" });

  const copyAll = useMemo(() => bitsCopyLines(pack).join("\n"), [pack]);

  const fields = [
    { key: "A", label: "Taxable sales", value: pack.fieldA, name: "field_a" },
    { key: "B", label: "GST output", value: pack.fieldB, name: "field_b" },
    { key: "C", label: "Taxable purchases", value: pack.fieldC, name: "field_c" },
    { key: "D", label: "GST input credit", value: pack.fieldD, name: "field_d" },
    { key: "E", label: "Net payable", value: pack.fieldE, name: "field_e" },
  ] as const;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        <CopyButton text={copyAll} label="A–E" />
        {fields.map((f) => (
          <CopyButton
            key={f.key}
            text={String(f.value)}
            label={f.key}
          />
        ))}
        {savedStatus === "filed" ? (
          <span className="inline-flex h-8 items-center rounded-md border border-citrus/40 bg-citrus-tint/60 px-3 text-xs font-semibold uppercase text-citrus">
            Filed
          </span>
        ) : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-5">
        {fields.map((f) => (
          <div key={f.key} className="rounded-xl border bg-card px-4 py-3">
            <p className="text-[10px] font-semibold tracking-[0.18em] text-accent uppercase">
              {f.key} · {f.label}
            </p>
            <p className="mt-2 text-lg font-semibold tabular-nums">{formatBtn(f.value)}</p>
          </div>
        ))}
      </div>

      <form action={saveAction} className="space-y-3 rounded-lg border bg-card p-4">
        <input type="hidden" name="period_month" value={pack.periodMonth} />
        {fields.map((f) => (
          <input key={f.name} type="hidden" name={f.name} value={String(f.value)} />
        ))}
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="bank_statement_id">Bank statement (Step 4 upload)</Label>
            <select
              id="bank_statement_id"
              name="bank_statement_id"
              className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
              defaultValue=""
            >
              <option value="">— None linked —</option>
              {bankStatements.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pack_notes">Notes</Label>
            <Input id="pack_notes" name="notes" placeholder="Optional" />
          </div>
        </div>
        <Button type="submit" variant="outline" disabled={savePending} className="h-9">
          {savePending ? "Saving…" : "Save month pack"}
        </Button>
      </form>

      <form action={filedAction} className="flex flex-wrap items-end gap-2 rounded-lg border bg-card p-4">
        <input type="hidden" name="period_month" value={pack.periodMonth} />
        <div className="min-w-[200px] flex-1 space-y-1.5">
          <Label htmlFor="filed_confirmation_url">BITS confirmation URL / ref</Label>
          <Input id="filed_confirmation_url" name="filed_confirmation_url" placeholder="Portal receipt ref" />
        </div>
        <Button type="submit" disabled={filedPending || savedStatus === "filed"} className="h-9">
          {filedPending ? "Saving…" : "Mark filed"}
        </Button>
      </form>

      <div className="grid gap-6 lg:grid-cols-2">
        <ScheduleTable
          title="Income schedule"
          rows={pack.incomeSchedule.map((r) => ({
            date: r.date,
            col2: r.description,
            base: r.taxableBase,
            gst: r.gst,
            total: r.total,
          }))}
        />
        <ScheduleTable
          title="Expense schedule"
          rows={pack.expenseSchedule.map((r) => ({
            date: r.date,
            col2: `${r.vendor}${r.tpn ? ` · TPN ${r.tpn}` : ""}`,
            base: r.taxableBase,
            gst: r.gst,
            total: r.total,
          }))}
        />
      </div>
    </div>
  );
}

function ScheduleTable({
  title,
  rows,
}: {
  title: string;
  rows: { date: string; col2: string; base: number; gst: number; total: number }[];
}) {
  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <p className="border-b px-3 py-2 text-sm font-semibold">{title}</p>
      {rows.length === 0 ? (
        <p className="px-3 py-6 text-sm text-muted-foreground">No rows this month.</p>
      ) : (
        <div className="max-h-80 overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-muted/80">
              <tr>
                {["Date", "Detail", "Base", "GST", "Total"].map((h) => (
                  <th key={h} className="px-2 py-2 text-left font-semibold uppercase">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 100).map((r, i) => (
                <tr key={i} className="border-t">
                  <td className="px-2 py-1.5">{r.date}</td>
                  <td className="max-w-[140px] truncate px-2 py-1.5">{r.col2}</td>
                  <td className="px-2 py-1.5 tabular-nums">{formatBtn(r.base)}</td>
                  <td className="px-2 py-1.5 tabular-nums">{formatBtn(r.gst)}</td>
                  <td className="px-2 py-1.5 tabular-nums">{formatBtn(r.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
