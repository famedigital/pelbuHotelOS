"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MinusIcon, PlusIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { MenuItem } from "@/lib/menu";
import type { ModifierGroup } from "@/lib/pos";
import type { CartLine } from "./types";

type Target =
  | { mode: "add"; menuItemId: string }
  | { mode: "edit"; lineKey: string }
  | null;

type Props = {
  target: Target;
  onOpenChange: (open: boolean) => void;
  items: MenuItem[];
  groupsByItem: Map<string, ModifierGroup[]>;
  cart: CartLine[];
  onUpsert: (line: CartLine) => void;
  onRemove: (key: string) => void;
};

type Selection = Record<
  string, // groupId
  Record<string, number> // optionId -> qty
>;

function buildLineKey(args: {
  menuItemId: string;
  mods: { groupId: string; optionId: string; qty: number }[];
  courseNo: number;
  seatNo?: number;
  lineNotes?: string;
}): string {
  const modPart = args.mods.length
    ? args.mods
        .map((m) => `${m.groupId}:${m.optionId}:${m.qty}`)
        .sort()
        .join("|")
    : "";
  return [
    args.menuItemId,
    modPart,
    `c${args.courseNo}`,
    args.seatNo ? `s${args.seatNo}` : "s0",
    `n:${(args.lineNotes ?? "").trim().toLowerCase().slice(0, 60)}`,
  ].join("::");
}

export function ModifierDialog({
  target,
  onOpenChange,
  items,
  groupsByItem,
  cart,
  onUpsert,
  onRemove,
}: Props) {
  const open = target !== null;

  // Resolve the active line/item for this dialog
  const { item, initialLine } = useMemo(() => {
    if (!target) return { item: null, initialLine: null };
    if (target.mode === "add") {
      const it = items.find((m) => m.id === target.menuItemId) ?? null;
      return { item: it, initialLine: null };
    }
    const line = cart.find((l) => l.key === target.lineKey) ?? null;
    const it = line ? items.find((m) => m.id === line.menuItemId) ?? null : null;
    return { item: it, initialLine: line };
  }, [target, items, cart]);

  const groups = item ? groupsByItem.get(item.id) ?? [] : [];

  const [qty, setQty] = useState(1);
  const [courseNo, setCourseNo] = useState(1);
  const [seatNo, setSeatNo] = useState<string>("");
  const [lineNotes, setLineNotes] = useState<string>("");
  const [selection, setSelection] = useState<Selection>({});

  // Reset internal state whenever the target changes
  useEffect(() => {
    if (!target || !item) return;
    if (target.mode === "add") {
      setQty(1);
      setCourseNo(1);
      setSeatNo("");
      setLineNotes("");
      const init: Selection = {};
      for (const g of groups) {
        for (const opt of g.options) {
          if (opt.is_default) {
            init[g.id] = { ...(init[g.id] ?? {}), [opt.id]: 1 };
          }
        }
      }
      setSelection(init);
    } else if (initialLine) {
      setQty(initialLine.qty);
      setCourseNo(initialLine.courseNo);
      setSeatNo(initialLine.seatNo ? String(initialLine.seatNo) : "");
      setLineNotes(initialLine.lineNotes ?? "");
      const init: Selection = {};
      for (const m of initialLine.modifiers) {
        init[m.groupId] = {
          ...(init[m.groupId] ?? {}),
          [m.optionId]: m.qty,
        };
      }
      setSelection(init);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, item?.id]);

  if (!target || !item) return null;

  function setOptionQty(groupId: string, optionId: string, next: number) {
    setSelection((prev) => {
      const groupSel = { ...(prev[groupId] ?? {}) };
      if (next <= 0) {
        delete groupSel[optionId];
      } else {
        groupSel[optionId] = Math.min(20, next);
      }
      const copy = { ...prev };
      if (Object.keys(groupSel).length === 0) {
        delete copy[groupId];
      } else {
        copy[groupId] = groupSel;
      }
      return copy;
    });
  }

  function optionQty(groupId: string, optionId: string): number {
    return selection[groupId]?.[optionId] ?? 0;
  }

  function groupCount(groupId: string): number {
    return Object.values(selection[groupId] ?? {}).reduce((a, b) => a + b, 0);
  }

  // Build the canonical modifier snapshots from current selection
  function buildSnapshots() {
    const mods: {
      groupId: string;
      optionId: string;
      qty: number;
    }[] = [];
    const snapshots: CartLine["modifierSnapshots"] = [];
    for (const g of groups) {
      const sel = selection[g.id] ?? {};
      for (const opt of g.options) {
        const q = sel[opt.id] ?? 0;
        if (q > 0) {
          mods.push({ groupId: g.id, optionId: opt.id, qty: q });
          snapshots.push({
            groupId: g.id,
            optionId: opt.id,
            name: opt.name,
            priceBtn: opt.price_btn,
            gstApplicable: opt.gst_applicable,
            qty: q,
          });
        }
      }
    }
    return { mods, snapshots };
  }

  function handleConfirm() {
    const { mods, snapshots } = buildSnapshots();

    // Validate required groups
    for (const g of groups) {
      const count = groupCount(g.id);
      if (g.is_required || g.min_sel > 0) {
        if (count < g.min_sel || count > g.max_sel) {
          return;
        }
      } else if (count > g.max_sel) {
        return;
      }
    }

    const seat = seatNo.trim() ? Number(seatNo) : undefined;
    const line: CartLine = {
      key: "",
      menuItemId: item!.id,
      name: item!.name,
      unitPriceBtn: item!.price_btn,
      gstApplicable: item!.gst_applicable,
      qty: Math.max(1, qty),
      modifiers: mods,
      modifierSnapshots: snapshots,
      courseNo: Math.max(1, courseNo),
      seatNo: seat,
      lineNotes: lineNotes.trim() ? lineNotes.trim().slice(0, 280) : undefined,
      prepStation: item!.prep_station ?? "kitchen",
    };
    line.key = buildLineKey({
      menuItemId: line.menuItemId,
      mods: line.modifiers,
      courseNo: line.courseNo,
      seatNo: line.seatNo,
      lineNotes: line.lineNotes,
    });
    onUpsert(line);
  }

  function handleRemove() {
    if (target?.mode === "edit") {
      onRemove(target.lineKey);
    }
  }

  const { snapshots } = buildSnapshots();
  const modUnitTotal = snapshots.reduce(
    (s, m) => s + m.priceBtn * m.qty,
    0,
  );
  const lineTotal = (item.price_btn + modUnitTotal) * qty;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="erp max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{item.name}</DialogTitle>
          <DialogDescription>
            Choose options, then set quantity, course and seat.{" "}
            {target?.mode === "edit" ? "Editing an existing line." : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {groups.length === 0 ? (
            <p className="rounded-md border border-dashed px-4 py-6 text-sm text-muted-foreground">
              No modifier groups for this item.
            </p>
          ) : (
            groups.map((g) => {
              const count = groupCount(g.id);
              const required = g.is_required || g.min_sel > 0;
              const over = count > g.max_sel;
              const under = required && count < g.min_sel;
              return (
                <fieldset key={g.id} className="space-y-2">
                  <legend className="flex flex-wrap items-center gap-2 text-sm font-medium text-foreground">
                    <span>{g.label}</span>
                    <span className="text-[11px] font-normal text-muted-foreground">
                      {required
                        ? `Required · pick ${g.min_sel}–${g.max_sel}`
                        : `Optional · up to ${g.max_sel}`}
                    </span>
                    {under ? (
                      <span className="text-[11px] font-medium text-destructive">
                        Pick at least {g.min_sel}
                      </span>
                    ) : null}
                    {over ? (
                      <span className="text-[11px] font-medium text-destructive">
                        Too many
                      </span>
                    ) : null}
                  </legend>
                  <ul className="divide-y rounded-md border">
                    {g.options.map((opt) => {
                      const q = optionQty(g.id, opt.id);
                      return (
                        <li
                          key={opt.id}
                          className="flex items-center justify-between gap-3 px-3 py-2.5"
                        >
                          <div className="min-w-0">
                            <p className="text-sm text-foreground">{opt.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {opt.price_btn > 0
                                ? `+ ${opt.price_btn} Nu`
                                : "No extra charge"}
                              {opt.gst_applicable ? " · GST" : ""}
                            </p>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() =>
                                setOptionQty(g.id, opt.id, q - 1)
                              }
                              disabled={q === 0}
                              className="inline-flex size-9 items-center justify-center rounded-md border border-input text-foreground transition-colors hover:bg-secondary disabled:opacity-30"
                              aria-label={`Decrease ${opt.name}`}
                            >
                              <MinusIcon className="size-4" />
                            </button>
                            <span
                              className="w-6 text-center text-sm tabular-nums text-foreground"
                              aria-live="polite"
                            >
                              {q}
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                setOptionQty(g.id, opt.id, q + 1)
                              }
                              className="inline-flex size-9 items-center justify-center rounded-md border border-input text-foreground transition-colors hover:bg-secondary"
                              aria-label={`Increase ${opt.name}`}
                            >
                              <PlusIcon className="size-4" />
                            </button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </fieldset>
              );
            })
          )}

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="mod_qty">Qty</Label>
              <Input
                id="mod_qty"
                type="number"
                min={1}
                max={40}
                value={qty}
                onChange={(e) =>
                  setQty(
                    Math.max(
                      1,
                      Math.min(40, Math.floor(Number(e.target.value) || 1)),
                    ),
                  )
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mod_course">Course</Label>
              <Input
                id="mod_course"
                type="number"
                min={1}
                max={12}
                value={courseNo}
                onChange={(e) =>
                  setCourseNo(
                    Math.max(
                      1,
                      Math.min(12, Math.floor(Number(e.target.value) || 1)),
                    ),
                  )
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mod_seat">Seat</Label>
              <Input
                id="mod_seat"
                type="number"
                min={1}
                max={40}
                value={seatNo}
                onChange={(e) => setSeatNo(e.target.value)}
                placeholder="—"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="mod_notes">Line notes</Label>
            <Input
              id="mod_notes"
              type="text"
              value={lineNotes}
              onChange={(e) => setLineNotes(e.target.value)}
              placeholder="Allergy, prep instruction, etc."
            />
          </div>

          <div className="flex items-center justify-between rounded-md bg-muted/40 px-3 py-2 text-sm">
            <span className="text-muted-foreground">Line total</span>
            <span className="font-semibold tabular-nums text-foreground">
              {lineTotal.toLocaleString("en-BT", {
                minimumFractionDigits: 0,
                maximumFractionDigits: 2,
              })}{" "}
              Nu
            </span>
          </div>
        </div>

        <DialogFooter className="gap-2">
          {target.mode === "edit" ? (
            <Button
              type="button"
              variant="destructive"
              onClick={handleRemove}
              className="mr-auto"
            >
              Remove line
            </Button>
          ) : null}
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button type="button" variant="citrus" onClick={handleConfirm}>
            {target.mode === "edit" ? "Update line" : "Add to ticket"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
