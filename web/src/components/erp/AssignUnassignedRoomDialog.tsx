"use client";

import {
  assignCalendarBookingRoom,
  autoAssignAllUnassignedRooms,
} from "@/app/actions/erp-calendar";
import type {
  RackStay,
  RackUnit,
  RoomBlock,
  UnassignedBooking,
} from "@/components/erp/RoomRackGrid";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import {
  CheckCircle2Icon,
  Loader2Icon,
  WandSparklesIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from "react";

function unitFreeForStay(
  unitId: string,
  checkIn: string,
  checkOut: string,
  stays: RackStay[],
  blocks: RoomBlock[],
  /** Units already picked this session (exclude as free). */
  takenIds: Set<string>,
): boolean {
  if (takenIds.has(unitId)) return false;
  const busy = stays.some(
    (s) =>
      s.room_unit_id === unitId &&
      s.from_date < checkOut &&
      s.to_date > checkIn,
  );
  if (busy) return false;
  return !blocks.some(
    (b) =>
      b.room_unit_id === unitId &&
      b.from_date < checkOut &&
      b.to_date > checkIn,
  );
}

export type AssignGuideMode =
  | { kind: "single"; item: UnassignedBooking }
  | { kind: "queue"; items: UnassignedBooking[] }
  | { kind: "bulk"; items: UnassignedBooking[] };

type StepId = "review" | "pick" | "working" | "done";

const STEPS_SINGLE: { id: StepId; label: string }[] = [
  { id: "review", label: "Review" },
  { id: "pick", label: "Pick room" },
  { id: "working", label: "Save" },
  { id: "done", label: "Done" },
];

const STEPS_BULK: { id: StepId; label: string }[] = [
  { id: "review", label: "Review" },
  { id: "working", label: "Assigning" },
  { id: "done", label: "Done" },
];

function stepIndex(steps: { id: StepId }[], step: StepId): number {
  const i = steps.findIndex((s) => s.id === step);
  return i < 0 ? 0 : i;
}

function progressPct(
  steps: { id: StepId }[],
  step: StepId,
  workingPulse: number,
): number {
  const i = stepIndex(steps, step);
  const last = Math.max(1, steps.length - 1);
  if (step === "working") {
    const base = (i / last) * 100;
    const next = ((i + 1) / last) * 100;
    return Math.min(next - 2, base + (next - base) * workingPulse);
  }
  if (step === "done") return 100;
  return (i / last) * 100;
}

type Props = {
  guide: AssignGuideMode | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  units: RackUnit[];
  stays: RackStay[];
  blocks: RoomBlock[];
  onAssigned?: () => void;
};

/**
 * Guided right sheet: review → pick (single/queue) or auto-run (bulk) → progress → done.
 */
export function AssignUnassignedRoomDialog({
  guide,
  open,
  onOpenChange,
  units,
  stays,
  blocks,
  onAssigned,
}: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [step, setStep] = useState<StepId>("review");
  const [queueIndex, setQueueIndex] = useState(0);
  /** How many slots already assigned for current booking this open. */
  const [slotsDone, setSlotsDone] = useState(0);
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [pickedLabel, setPickedLabel] = useState<string | null>(null);
  const [sessionTaken, setSessionTaken] = useState<Set<string>>(() => new Set());
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [workingPulse, setWorkingPulse] = useState(0.15);
  const [bulkSummary, setBulkSummary] = useState<string | null>(null);

  const isBulk = guide?.kind === "bulk";
  const steps = isBulk ? STEPS_BULK : STEPS_SINGLE;

  const queueItems = useMemo(() => {
    if (!guide) return [] as UnassignedBooking[];
    if (guide.kind === "single") return [guide.item];
    return guide.items;
  }, [guide]);

  const item = queueItems[queueIndex] ?? null;
  const totalSlotsForItem = item?.missing_rooms ?? 1;

  useEffect(() => {
    if (!open) return;
    setStep("review");
    setQueueIndex(0);
    setSlotsDone(0);
    setPickedId(null);
    setPickedLabel(null);
    setSessionTaken(new Set());
    setMessage(null);
    setError(null);
    setWorkingPulse(0.15);
    setBulkSummary(null);
  }, [open, guide?.kind]);

  // Soft pulse while working
  useEffect(() => {
    if (step !== "working") return;
    const t = window.setInterval(() => {
      setWorkingPulse((p) => (p >= 0.92 ? 0.45 : p + 0.07));
    }, 280);
    return () => window.clearInterval(t);
  }, [step]);

  const candidates = useMemo(() => {
    if (!item) return [];
    return units
      .filter((u) => u.room_type_id === item.room_type_id)
      .map((u) => ({
        unit: u,
        free: unitFreeForStay(
          u.id,
          item.check_in,
          item.check_out,
          stays,
          blocks,
          sessionTaken,
        ),
      }))
      .sort((a, b) => {
        if (a.free !== b.free) return a.free ? -1 : 1;
        return a.unit.label.localeCompare(b.unit.label, undefined, {
          numeric: true,
        });
      });
  }, [item, units, stays, blocks, sessionTaken]);

  const freeCount = candidates.filter((c) => c.free).length;
  const pct = Math.round(progressPct(steps, step, workingPulse));

  const finishClose = useCallback(() => {
    onOpenChange(false);
    onAssigned?.();
    router.refresh();
  }, [onAssigned, onOpenChange, router]);

  const runSingleAssign = useCallback(
    (unitId: string, label: string) => {
      if (!item || pending) return;
      setPickedId(unitId);
      setPickedLabel(label);
      setStep("working");
      setError(null);
      setMessage(`Assigning ${label}…`);
      setWorkingPulse(0.2);
      start(async () => {
        const result = await assignCalendarBookingRoom(item.booking_id, unitId);
        if (!result.ok) {
          setError(result.error ?? "Could not assign room.");
          setMessage(null);
          setStep("pick");
          return;
        }
        setSessionTaken((prev) => new Set(prev).add(unitId));
        const nextSlots = slotsDone + 1;
        setSlotsDone(nextSlots);
        setMessage(result.message ?? `${label} assigned.`);

        if (nextSlots < totalSlotsForItem) {
          // More rooms needed for multi-room booking
          setPickedId(null);
          setPickedLabel(null);
          setStep("pick");
          return;
        }

        // Next guest in queue?
        if (queueIndex + 1 < queueItems.length) {
          setQueueIndex((i) => i + 1);
          setSlotsDone(0);
          setPickedId(null);
          setPickedLabel(null);
          setStep("review");
          return;
        }

        setWorkingPulse(1);
        setStep("done");
        window.setTimeout(() => {
          finishClose();
        }, 900);
      });
    },
    [
      finishClose,
      item,
      pending,
      queueIndex,
      queueItems.length,
      slotsDone,
      totalSlotsForItem,
    ],
  );

  const runBulk = useCallback(() => {
    if (pending) return;
    setStep("working");
    setError(null);
    setMessage("Matching free rooms to every unassigned stay…");
    setWorkingPulse(0.15);
    start(async () => {
      const result = await autoAssignAllUnassignedRooms();
      if (!result.ok) {
        setError(result.error ?? "Auto-assign failed.");
        setMessage(null);
        setStep("review");
        return;
      }
      setWorkingPulse(1);
      setBulkSummary(result.message ?? "Auto-assign finished.");
      setMessage(result.message ?? "Done.");
      setStep("done");
    });
  }, [pending]);

  const title = isBulk
    ? "Auto-assign rooms"
    : item
      ? `Assign · ${item.contact_name}`
      : "Assign room";

  const queueLabel =
    !isBulk && queueItems.length > 1
      ? `Guest ${queueIndex + 1} of ${queueItems.length}`
      : null;

  return (
    <Sheet open={open && guide != null} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 p-0 sm:max-w-md"
      >
        <SheetHeader className="space-y-2 border-b px-4 py-4 text-left">
          <SheetTitle className="text-base tracking-tight">{title}</SheetTitle>
          <SheetDescription className="text-xs">
            {isBulk
              ? "Fill free rooms for all unassigned stays without overlaps."
              : "Follow the steps — pick a free room for the full stay, then save."}
          </SheetDescription>

          {/* Progress bar */}
          <div className="space-y-1.5 pt-1">
            <div className="flex items-center justify-between text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
              <span>
                {steps[stepIndex(steps, step)]?.label ?? "…"}
                {queueLabel ? ` · ${queueLabel}` : ""}
              </span>
              <span className="tabular-nums">{pct}%</span>
            </div>
            <div
              className="h-2 overflow-hidden rounded-full bg-muted"
              role="progressbar"
              aria-valuenow={pct}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Assignment progress"
            >
              <div
                className={cn(
                  "h-full rounded-full bg-accent transition-[width] duration-300 ease-out",
                  step === "working" && "bg-amber-500",
                  step === "done" && "bg-emerald-500",
                )}
                style={{ width: `${pct}%` }}
              />
            </div>
            <ol className="flex gap-1 pt-0.5">
              {steps.map((s, i) => {
                const active = stepIndex(steps, step) >= i;
                return (
                  <li
                    key={s.id}
                    className={cn(
                      "h-1 flex-1 rounded-full",
                      active ? "bg-accent/80" : "bg-muted",
                    )}
                    title={s.label}
                  />
                );
              })}
            </ol>
          </div>
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          {/* REVIEW */}
          {step === "review" && isBulk ? (
            <div className="space-y-4">
              <p className="text-sm text-foreground">
                Ready to auto-assign{" "}
                <strong className="font-semibold">
                  {guide?.kind === "bulk" ? guide.items.length : 0}
                </strong>{" "}
                unassigned stay line
                {(guide?.kind === "bulk" ? guide.items.length : 0) === 1
                  ? ""
                  : "s"}
                .
              </p>
              <ul className="max-h-48 space-y-1.5 overflow-y-auto text-xs text-muted-foreground">
                {(guide?.kind === "bulk" ? guide.items : [])
                  .slice(0, 24)
                  .map((u) => (
                    <li
                      key={u.id}
                      className="rounded-md border bg-card px-2.5 py-1.5"
                    >
                      <span className="font-medium text-foreground">
                        {u.contact_name}
                      </span>
                      {" · "}
                      {u.room_type_code || u.room_type_name} · {u.check_in}→
                      {u.check_out}
                      {u.missing_rooms > 1 ? ` · ×${u.missing_rooms}` : ""}
                    </li>
                  ))}
                {guide?.kind === "bulk" && guide.items.length > 24 ? (
                  <li className="text-muted-foreground">
                    +{guide.items.length - 24} more…
                  </li>
                ) : null}
              </ul>
              <p className="text-[11px] text-muted-foreground">
                Prefers room numbers in reservation notes when free. Skips dates
                with no inventory left.
              </p>
            </div>
          ) : null}

          {step === "review" && !isBulk && item ? (
            <div className="space-y-4">
              <div className="rounded-lg border bg-card p-3 text-sm">
                <p className="text-base font-semibold text-foreground">
                  {item.contact_name}
                </p>
                {item.agent_name ? (
                  <p className="text-muted-foreground">Agent: {item.agent_name}</p>
                ) : null}
                <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
                  <div>
                    <dt className="text-muted-foreground">Room type</dt>
                    <dd className="font-medium">
                      {item.room_type_name}
                      {item.room_type_code ? ` (${item.room_type_code})` : ""}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Still need</dt>
                    <dd className="font-medium tabular-nums">
                      {totalSlotsForItem - slotsDone} of {totalSlotsForItem}
                    </dd>
                  </div>
                  <div className="col-span-2">
                    <dt className="text-muted-foreground">Stay</dt>
                    <dd className="font-medium">
                      {item.check_in} → {item.check_out}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Status</dt>
                    <dd className="font-medium capitalize">{item.status}</dd>
                  </div>
                  {item.contact_phone ? (
                    <div>
                      <dt className="text-muted-foreground">Phone</dt>
                      <dd className="font-medium">{item.contact_phone}</dd>
                    </div>
                  ) : null}
                </dl>
              </div>
              <ol className="list-decimal space-y-1 pl-4 text-xs text-muted-foreground">
                <li>Confirm guest and dates.</li>
                <li>Choose a free room of the right type.</li>
                <li>We save the assignment and refresh the calendar.</li>
              </ol>
            </div>
          ) : null}

          {/* PICK */}
          {step === "pick" && item ? (
            <div className="space-y-3">
              {slotsDone > 0 ? (
                <p className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1.5 text-xs text-emerald-900 dark:text-emerald-100">
                  {slotsDone}/{totalSlotsForItem} room
                  {slotsDone === 1 ? "" : "s"} assigned for this guest. Pick the
                  next free unit.
                </p>
              ) : null}
              {freeCount === 0 ? (
                <p className="text-sm text-amber-800 dark:text-amber-200">
                  No free {item.room_type_name} for the full stay (overlap or
                  OOO). Try another type move on the grid, or wait for a
                  checkout.
                </p>
              ) : (
                <p className="text-[11px] text-muted-foreground">
                  {freeCount} free unit{freeCount === 1 ? "" : "s"} · tap to
                  assign
                </p>
              )}
              <ul className="space-y-1">
                {candidates.map(({ unit, free }) => (
                  <li key={unit.id}>
                    <button
                      type="button"
                      disabled={!free || pending}
                      onClick={() => runSingleAssign(unit.id, unit.label)}
                      className={cn(
                        "flex min-h-11 w-full items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left text-sm",
                        free
                          ? "bg-card hover:border-accent hover:bg-accent/10"
                          : "cursor-not-allowed opacity-45",
                        pickedId === unit.id && "border-accent ring-2 ring-accent/30",
                      )}
                    >
                      <span className="font-semibold tabular-nums">
                        {unit.label}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {free
                          ? unit.hk_status === "dirty" ||
                            unit.hk_status === "inspect"
                            ? `Free · HK ${unit.hk_status}`
                            : "Free"
                          : "Busy / blocked"}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {/* WORKING */}
          {step === "working" ? (
            <div className="flex flex-col items-center gap-4 py-10 text-center">
              <Loader2Icon
                className="size-10 animate-spin text-amber-600"
                aria-hidden
              />
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">
                  {isBulk
                    ? "Running auto-assign…"
                    : `Saving room ${pickedLabel ?? "…"}`}
                </p>
                <p className="text-xs text-muted-foreground">
                  {message ?? "Please wait — checking availability."}
                </p>
              </div>
            </div>
          ) : null}

          {/* DONE */}
          {step === "done" ? (
            <div className="flex flex-col items-center gap-3 py-10 text-center">
              <CheckCircle2Icon
                className="size-10 text-emerald-600"
                aria-hidden
              />
              <p className="text-sm font-medium text-foreground">
                {isBulk ? "Auto-assign finished" : "Room assigned"}
              </p>
              <p className="max-w-xs text-xs text-muted-foreground">
                {bulkSummary ?? message ?? "Calendar will refresh."}
              </p>
            </div>
          ) : null}

          {error ? (
            <p
              role="alert"
              className="mt-3 rounded-md border border-destructive/30 bg-destructive/10 px-2.5 py-2 text-xs text-destructive"
            >
              {error}
            </p>
          ) : null}
        </div>

        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t px-4 py-3">
          {step === "review" ? (
            <>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={pending}
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              {isBulk ? (
                <Button
                  type="button"
                  size="sm"
                  disabled={pending}
                  onClick={runBulk}
                  className="gap-1.5"
                >
                  <WandSparklesIcon className="size-3.5" aria-hidden />
                  Start auto-assign
                </Button>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  disabled={!item}
                  onClick={() => setStep("pick")}
                >
                  Next · pick room
                </Button>
              )}
            </>
          ) : null}

          {step === "pick" ? (
            <>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={pending}
                onClick={() => setStep("review")}
              >
                Back
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={pending}
                onClick={() => onOpenChange(false)}
              >
                Close
              </Button>
            </>
          ) : null}

          {step === "working" ? (
            <p className="mr-auto text-[11px] text-muted-foreground">
              Do not close until finished…
            </p>
          ) : null}

          {step === "done" ? (
            <Button type="button" size="sm" onClick={finishClose}>
              Close & refresh
            </Button>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}
