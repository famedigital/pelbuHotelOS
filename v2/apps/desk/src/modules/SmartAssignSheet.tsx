import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Badge, Button } from "@hos-v2/ui";
import { Sparkles, Wand2, X } from "lucide-react";
import {
  formatNu,
  nightsBetween,
  rankRoomsForStay,
  useFrontOfficeStore,
  type Room,
  type Stay,
} from "../lib/front-office-store";

export type SmartAssignMode =
  | { kind: "stay"; stayId: string }
  | { kind: "room"; roomId: string; date?: string }
  | { kind: "queue" };

type Props = {
  open: boolean;
  mode: SmartAssignMode | null;
  queue: Stay[];
  onClose: () => void;
};

function HkPill({ status }: { status: Room["hkStatus"] }) {
  const tone =
    status === "clean" || status === "inspected"
      ? "text-[var(--hos-emerald)]"
      : status === "dirty"
        ? "text-[var(--hos-brass-ink)]"
        : "text-[var(--hos-ink-3)]";
  return (
    <span className={`text-[10px] font-bold uppercase tracking-wide ${tone}`}>
      {status}
    </span>
  );
}

export function SmartAssignSheet({ open, mode, queue, onClose }: Props) {
  const reduce = useReducedMotion();
  const stays = useFrontOfficeStore((s) => s.stays);
  const rooms = useFrontOfficeStore((s) => s.rooms);
  const assignRoom = useFrontOfficeStore((s) => s.assignRoom);
  const smartAutoAssign = useFrontOfficeStore((s) => s.smartAutoAssign);
  const [stayId, setStayId] = useState<string | null>(null);
  const [allowUpgrade, setAllowUpgrade] = useState(false);
  const [dirtyPinPrompt, setDirtyPinPrompt] = useState<{
    roomId: string;
    roomNumber: string;
  } | null>(null);
  const [dirtyPin, setDirtyPin] = useState("");

  useEffect(() => {
    if (!open || !mode) return;
    if (mode.kind === "stay") {
      setStayId(mode.stayId);
      return;
    }
    if (mode.kind === "queue") {
      setStayId(queue[0]?.id ?? null);
      return;
    }
    /* Room-first: pick best matching unassigned for this room type. */
    const room = rooms.find((r) => r.id === mode.roomId);
    if (!room) {
      setStayId(queue[0]?.id ?? null);
      return;
    }
    const match =
      queue.find((s) => s.typeCode === room.typeCode) ?? queue[0] ?? null;
    setStayId(match?.id ?? null);
  }, [open, mode, queue, rooms]);

  const stay = stays.find((s) => s.id === stayId) ?? null;
  const prefRoomId = mode?.kind === "room" ? mode.roomId : null;

  const suggestions = useMemo(() => {
    if (!stay) return [];
    const ranked = rankRoomsForStay(stays, rooms, stay, {
      allowUpgrade,
      limit: 10,
    });
    if (!prefRoomId) return ranked;
    const pref = ranked.find((s) => s.room.id === prefRoomId);
    if (!pref) return ranked;
    return [pref, ...ranked.filter((s) => s.room.id !== prefRoomId)];
  }, [stay, stays, rooms, allowUpgrade, prefRoomId]);

  function apply(roomId: string) {
    if (!stay) return;
    void (async () => {
      const res = await assignRoom(stay.id, roomId, "Smart Assign", {
        allowUpgrade,
      });
      if (!res.ok && res.code === "DIRTY_PIN_REQUIRED") {
        const room = rooms.find((r) => r.id === roomId);
        setDirtyPin("");
        setDirtyPinPrompt({
          roomId,
          roomNumber: room?.number ?? "—",
        });
        return;
      }
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      const room = rooms.find((r) => r.id === roomId);
      toast.success(`Assigned · Rm ${room?.number ?? ""}`, {
        description: `${stay.guestName} · ${stay.typeCode}${allowUpgrade ? " · upgrade OK" : ""}`,
      });
      onClose();
    })();
  }

  function confirmDirtyPin() {
    if (!stay || !dirtyPinPrompt) return;
    const pin = dirtyPin.trim();
    if (!pin) {
      toast.error("Enter manager PIN");
      return;
    }
    const roomId = dirtyPinPrompt.roomId;
    void (async () => {
      const res = await assignRoom(stay.id, roomId, "Smart Assign", {
        allowUpgrade,
        dirtyOverridePin: pin,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      const room = rooms.find((r) => r.id === roomId);
      toast.success(`Assigned · Rm ${room?.number ?? ""}`, {
        description: `${stay.guestName} · dirty override`,
      });
      setDirtyPinPrompt(null);
      setDirtyPin("");
      onClose();
    })();
  }

  function runBatch() {
    const ids = queue.map((s) => s.id);
    void (async () => {
      const res = await smartAutoAssign(ids.length ? ids : undefined);
      if (res.assigned === 0 && res.conflicts.length) {
        toast.error("Smart assign blocked", {
          description: res.conflicts.slice(0, 2).join(" · "),
        });
        return;
      }
      toast.success(`⚡ Assigned ${res.assigned}`, {
        description:
          res.conflicts.length > 0
            ? `${res.conflicts.length} still need a room`
            : "VIP floor · group cluster · gap fill",
      });
      onClose();
    })();
  }

  return (
    <AnimatePresence>
      {open && mode ? (
        <motion.div
          className="fixed inset-0 z-[90] flex items-end justify-center bg-[rgba(15,23,42,0.5)] p-0 backdrop-blur-[2px] sm:items-center sm:p-4"
          initial={reduce ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            role="dialog"
            aria-modal
            aria-label="Smart room assignment"
            className="hos-pin-vault relative flex max-h-[min(92vh,720px)] w-full max-w-lg flex-col overflow-hidden rounded-t-[24px] sm:rounded-[24px]"
            initial={reduce ? false : { y: 28, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={reduce ? undefined : { y: 20, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
          >
            <header className="flex shrink-0 items-start justify-between gap-3 border-b border-[var(--hos-line)] px-4 py-3.5">
              <div className="min-w-0">
                <p className="m-0 text-[10px] font-black uppercase tracking-[0.16em] text-[var(--hos-ink-3)]">
                  StayView · intelligent assign
                </p>
                <h2 className="m-0 mt-0.5 text-[17px] font-black tracking-tight text-[var(--hos-ink)]">
                  {mode.kind === "room"
                    ? `Place into Rm ${rooms.find((r) => r.id === mode.roomId)?.number ?? "—"}`
                    : "Assign room"}
                </h2>
                <p className="m-0 mt-1 text-[12px] text-[var(--hos-ink-3)]">
                  Ranked by VIP floor, group cluster, clean HK &amp; gap fill.
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="hos-btn-tactile inline-flex size-10 items-center justify-center rounded-xl border border-[var(--hos-line)] bg-[var(--hos-cell)]"
                aria-label="Close"
              >
                <X className="size-4" strokeWidth={2} />
              </button>
            </header>

            <div className="hos-scrollbar-slim min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3">
              {queue.length > 1 || mode.kind !== "stay" ? (
                <div>
                  <p className="mb-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-[var(--hos-ink-3)]">
                    Guest
                  </p>
                  <div className="hos-scrollbar-slim flex gap-2 overflow-x-auto pb-1">
                    {(mode.kind === "stay"
                      ? queue.filter((s) => s.id === mode.stayId).concat(
                          queue.filter((s) => s.id !== mode.stayId),
                        )
                      : queue
                    ).map((s) => {
                      const active = s.id === stayId;
                      return (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => setStayId(s.id)}
                          className={[
                            "hos-btn-tactile min-w-[148px] shrink-0 rounded-2xl border px-3 py-2.5 text-left",
                            active
                              ? "border-[#111] bg-[#111] text-white"
                              : "border-[var(--hos-line)] bg-[var(--hos-cell)] text-[var(--hos-ink)]",
                          ].join(" ")}
                        >
                          <div className="truncate text-[13px] font-bold">
                            {s.guestName}
                          </div>
                          <div
                            className={[
                              "mt-0.5 font-mono text-[10px] tabular-nums",
                              active ? "text-white/65" : "text-[var(--hos-ink-3)]",
                            ].join(" ")}
                          >
                            {s.typeCode} · {s.checkIn.slice(5)}→{s.checkOut.slice(5)}
                          </div>
                          {s.vip ? (
                            <Badge
                              tone="vip"
                              className="mt-1 !text-[9px]"
                            >
                              VIP
                            </Badge>
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              {stay ? (
                <div className="hos-luxury-card flex items-center justify-between gap-2 p-3">
                  <div className="min-w-0">
                    <strong className="block truncate text-[14px] text-[var(--hos-ink)]">
                      {stay.guestName}
                    </strong>
                    <p className="m-0 mt-0.5 text-[11px] text-[var(--hos-ink-3)]">
                      {stay.confirmationNo} · {nightsBetween(stay.checkIn, stay.checkOut)}N ·{" "}
                      {formatNu(stay.nightlyNet)}/n
                      {stay.groupName ? ` · ${stay.groupName}` : ""}
                    </p>
                  </div>
                  <label className="flex shrink-0 items-center gap-1.5 text-[11px] font-semibold text-[var(--hos-ink-2)]">
                    <input
                      type="checkbox"
                      checked={allowUpgrade}
                      onChange={(e) => setAllowUpgrade(e.target.checked)}
                      className="size-4 rounded border-[var(--hos-line)]"
                    />
                    Upgrade OK
                  </label>
                </div>
              ) : (
                <p className="m-0 rounded-xl border border-dashed border-[var(--hos-line)] px-3 py-6 text-center text-[13px] text-[var(--hos-ink-3)]">
                  No unassigned stays in the near-term queue.
                </p>
              )}

              {stay && suggestions.length === 0 ? (
                <p className="m-0 rounded-xl border border-[rgba(239,68,68,0.25)] bg-[rgba(239,68,68,0.06)] px-3 py-4 text-center text-[13px] text-[var(--hos-ruby)]">
                  No free {stay.typeCode}
                  {allowUpgrade ? "" : " — enable Upgrade OK to widen search"}.
                </p>
              ) : null}

              <div className="grid gap-2">
                {suggestions.map((s, i) => {
                  const top = i === 0;
                  return (
                    <button
                      key={s.room.id}
                      type="button"
                      onClick={() => apply(s.room.id)}
                      className={[
                        "hos-btn-tactile flex w-full items-center gap-3 rounded-2xl border px-3 py-3 text-left transition",
                        top
                          ? "border-[#111] bg-[#111] text-white shadow-[0_14px_32px_-16px_#111]"
                          : "border-[var(--hos-line)] bg-[var(--hos-cell)] text-[var(--hos-ink)]",
                      ].join(" ")}
                    >
                      <span
                        className={[
                          "flex size-12 shrink-0 flex-col items-center justify-center rounded-[14px] font-mono",
                          top
                            ? "bg-white/12 text-white"
                            : "bg-[rgba(17,17,17,0.06)] text-[var(--hos-ink)]",
                        ].join(" ")}
                      >
                        <span className="text-[15px] font-black tabular-nums leading-none">
                          {s.room.number}
                        </span>
                        <span className="mt-0.5 text-[8px] font-bold uppercase opacity-70">
                          F{s.room.floor}
                        </span>
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-1.5">
                          <strong className="text-[14px] font-bold">
                            {s.room.typeName}
                          </strong>
                          {top ? (
                            <span className="inline-flex items-center gap-0.5 rounded-full bg-[var(--hos-gold)] px-1.5 py-0.5 text-[9px] font-black text-[#1a1410]">
                              <Sparkles className="size-2.5" strokeWidth={2.5} />
                              Best
                            </span>
                          ) : null}
                        </span>
                        <span
                          className={[
                            "mt-1 flex flex-wrap gap-1",
                            top ? "text-white/75" : "text-[var(--hos-ink-3)]",
                          ].join(" ")}
                        >
                          {s.reasons.slice(0, 3).map((r) => (
                            <span
                              key={r}
                              className={[
                                "rounded-full px-1.5 py-0.5 text-[9px] font-bold",
                                top ? "bg-white/12" : "bg-[rgba(17,17,17,0.05)]",
                              ].join(" ")}
                            >
                              {r}
                            </span>
                          ))}
                        </span>
                      </span>
                      <span className="shrink-0 text-right">
                        <HkPill status={s.room.hkStatus} />
                        <div
                          className={[
                            "mt-1 font-mono text-[10px] font-bold tabular-nums",
                            top ? "text-white/55" : "text-[var(--hos-ink-3)]",
                          ].join(" ")}
                        >
                          {s.score}
                        </div>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <footer className="flex shrink-0 flex-wrap gap-2 border-t border-[var(--hos-line)] px-4 py-3">
              <Button
                size="sm"
                className="hos-btn-ink hos-btn-spring flex-1 !min-h-11 !rounded-full"
                disabled={!suggestions[0] || !stay}
                onClick={() => suggestions[0] && apply(suggestions[0].room.id)}
              >
                <Wand2 className="mr-1.5 size-3.5" strokeWidth={2} />
                Assign best
              </Button>
              {queue.length > 1 ? (
                <Button
                  size="sm"
                  variant="secondary"
                  className="!min-h-11 !rounded-full"
                  onClick={runBatch}
                >
                  ⚡ All ({queue.length})
                </Button>
              ) : null}
            </footer>

            {dirtyPinPrompt ? (
              <div className="absolute inset-0 z-10 flex items-end justify-center bg-[rgba(15,23,42,0.55)] p-4 sm:items-center">
                <div
                  className="hos-glass w-full max-w-sm rounded-2xl p-4"
                  role="dialog"
                  aria-modal
                  aria-label="Dirty room manager PIN"
                >
                  <h3 className="m-0 text-[15px] font-bold text-[var(--hos-ink)]">
                    Dirty room · Rm {dirtyPinPrompt.roomNumber}
                  </h3>
                  <p className="m-0 mt-1 text-[12px] text-[var(--hos-ink-3)]">
                    Manager PIN required to assign before housekeeping clears.
                  </p>
                  <input
                    type="password"
                    inputMode="numeric"
                    autoComplete="off"
                    value={dirtyPin}
                    onChange={(e) => setDirtyPin(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") confirmDirtyPin();
                    }}
                    data-testid="smart-assign-dirty-pin"
                    className="mt-3 w-full rounded-xl border border-[var(--hos-line)] bg-[var(--hos-cell)] px-3 py-2.5 font-mono text-[14px] text-[var(--hos-ink)]"
                    placeholder="Manager PIN"
                    autoFocus
                  />
                  <div className="mt-3 flex gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      className="flex-1 !rounded-full"
                      onClick={() => {
                        setDirtyPinPrompt(null);
                        setDirtyPin("");
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      className="hos-btn-ink flex-1 !rounded-full"
                      onClick={confirmDirtyPin}
                    >
                      Override
                    </Button>
                  </div>
                </div>
              </div>
            ) : null}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
