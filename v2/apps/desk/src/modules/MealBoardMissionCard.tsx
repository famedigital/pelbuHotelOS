/**
 * Desk mission-control meal board — FO / F&B posts BF + dinner by business date.
 * Partners and StayHub only read this (no post from StayHub).
 */
import { useState } from "react";
import { toast } from "sonner";
import { Button, GlassElevated } from "@hos-v2/ui";
import { useFrontOfficeStore } from "../lib/front-office-store";
import { useMealBoardStore } from "../lib/meal-board-store";

export function MealBoardMissionCard() {
  const businessDate = useFrontOfficeStore((s) => s.businessDate);
  const board = useMealBoardStore((s) => s.boards[businessDate]);
  const upsertBoard = useMealBoardStore((s) => s.upsertBoard);
  const copyForward = useMealBoardStore((s) => s.copyForward);

  const [bf, setBf] = useState(board?.breakfast ?? "");
  const [lunch, setLunch] = useState(board?.lunch ?? "");
  const [dinner, setDinner] = useState(board?.dinner ?? "");
  const [notes, setNotes] = useState(board?.notes ?? "");
  const [open, setOpen] = useState(false);

  return (
    <GlassElevated className="flex flex-col gap-2 border border-[var(--hos-line)] p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <strong className="block text-[12px] font-semibold text-[var(--hos-ink)]">
            Daily meal board
          </strong>
          <p className="m-0 mt-0.5 text-[10px] text-[var(--hos-ink-3)]">
            FO / F&amp;B · mission control · agents see this for guest stay nights
          </p>
        </div>
        <button
          type="button"
          className="shrink-0 text-[10px] font-semibold text-[var(--hos-primary)]"
          onClick={() => {
            setBf(board?.breakfast ?? "");
            setLunch(board?.lunch ?? "");
            setDinner(board?.dinner ?? "");
            setNotes(board?.notes ?? "");
            setOpen((v) => !v);
          }}
        >
          {open ? "Close" : "Post / edit"}
        </button>
      </div>
      {board ? (
        <p className="m-0 text-[11px] leading-snug text-[var(--hos-ink-2)]">
          <span className="font-mono text-[var(--hos-ink-3)]">{businessDate}</span>
          <br />
          BF {board.breakfast}
          {board.lunch ? ` · Lunch ${board.lunch}` : ""}
          <br />
          Dinner {board.dinner}
        </p>
      ) : (
        <p className="m-0 text-[11px] text-[var(--hos-ink-3)]">
          No menu for {businessDate} yet
        </p>
      )}
      {open ? (
        <div className="grid gap-1.5 border-t border-[var(--hos-line)] pt-2">
          <label className="grid gap-0.5 text-[10px] font-medium text-[var(--hos-ink-2)]">
            Breakfast
            <input
              value={bf}
              onChange={(e) => setBf(e.target.value)}
              className="hos-input !min-h-9 !text-[12px]"
              placeholder="Eggs · porridge · fruit · tea"
            />
          </label>
          <label className="grid gap-0.5 text-[10px] font-medium text-[var(--hos-ink-2)]">
            Lunch (optional)
            <input
              value={lunch}
              onChange={(e) => setLunch(e.target.value)}
              className="hos-input !min-h-9 !text-[12px]"
            />
          </label>
          <label className="grid gap-0.5 text-[10px] font-medium text-[var(--hos-ink-2)]">
            Dinner
            <input
              value={dinner}
              onChange={(e) => setDinner(e.target.value)}
              className="hos-input !min-h-9 !text-[12px]"
              placeholder="Ema datshi · red rice · salad"
            />
          </label>
          <label className="grid gap-0.5 text-[10px] font-medium text-[var(--hos-ink-2)]">
            Notes
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="hos-input !min-h-9 !text-[12px]"
              placeholder="Veg on request"
            />
          </label>
          <div className="flex flex-wrap gap-1.5">
            <Button
              size="sm"
              className="hos-btn-ink !h-8 !rounded-full text-[11px]"
              onClick={() => {
                const res = upsertBoard({
                  date: businessDate,
                  breakfast: bf,
                  lunch: lunch || undefined,
                  dinner,
                  notes: notes || undefined,
                  postedBy: "FO / F&B · Desk",
                });
                if (!res.ok) toast.error(res.error);
                else {
                  toast.success(`Menu live · ${businessDate}`, {
                    description: "Visible to agents & StayHub (read-only)",
                  });
                  setOpen(false);
                }
              }}
            >
              Publish menu
            </Button>
            <Button
              size="sm"
              variant="secondary"
              className="!h-8 !rounded-full text-[11px]"
              onClick={() => {
                const [y, m, d] = businessDate.split("-").map(Number);
                const prev = new Date(Date.UTC(y!, (m ?? 1) - 1, (d ?? 1) - 1))
                  .toISOString()
                  .slice(0, 10);
                const res = copyForward(prev, businessDate, "FO / F&B · Desk");
                if (!res.ok) toast.error(res.error);
                else {
                  setBf(res.board.breakfast);
                  setLunch(res.board.lunch ?? "");
                  setDinner(res.board.dinner);
                  setNotes(res.board.notes ?? "");
                  toast.success(`Copied from ${prev}`);
                }
              }}
            >
              Copy yesterday
            </Button>
          </div>
        </div>
      ) : null}
    </GlassElevated>
  );
}
