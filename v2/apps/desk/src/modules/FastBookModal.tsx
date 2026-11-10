import * as Dialog from "@radix-ui/react-dialog";
import { Drawer } from "vaul";
import { motion, useReducedMotion } from "motion/react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Badge, Button, useIsPhone } from "@hos-v2/ui";
import { Sparkles, Zap } from "lucide-react";
import {
  ROOM_TYPE_OPTIONS,
  addDays,
  formatNu,
  mealPlanNightlyNet,
  nightsBetween,
  taxBreakdown,
  useFrontOfficeStore,
  type BookingSource,
  type MealPlan,
  type RoomTypeCode,
  ymd,
} from "../lib/front-office-store";
import {
  quoteFromCard,
  rateCardById,
  resolveRateCardId,
  useCommercialStore,
} from "../lib/commercial-store";
import {
  normalizeRoomTypeCode,
  rateSheetTypeMeta,
  sellableTypeOptionsFromRooms,
} from "../lib/rate-sheet-inventory";

const MEALS: { id: MealPlan; label: string; desc: string }[] = [
  { id: "EP", label: "EP", desc: "Room only" },
  { id: "CP", label: "CP", desc: "Breakfast" },
  { id: "MAP", label: "MAP", desc: "B + D" },
  { id: "AP", label: "AP", desc: "All meals" },
];

type ProfileId = "walk_in" | "agent" | "corporate";

const PROFILES: { id: ProfileId; label: string; source: BookingSource }[] = [
  { id: "walk_in", label: "Walk-in", source: "walk_in" },
  { id: "agent", label: "Agent", source: "agent" },
  { id: "corporate", label: "Corporate", source: "direct" },
];

const TENDERS = ["Cash", "RMA mBoB QR", "Credit Card", "Bank Wire"] as const;

const fieldClass =
  "hos-input w-full !rounded-xl !border-[var(--hos-line)] !bg-[var(--hos-cell)] !px-3 !py-2.5 !text-[14px] text-[var(--hos-ink)] outline-none focus:!border-[var(--hos-primary)] md:!py-2 md:!text-[13px]";

/** Prefer a rate-sheet type that still has clean/inspected free inventory. */
function defaultSellableTypeCode(
  rooms: ReturnType<typeof useFrontOfficeStore.getState>["rooms"],
  stays: ReturnType<typeof useFrontOfficeStore.getState>["stays"],
): RoomTypeCode {
  const occupied = new Set(
    stays
      .filter((s) =>
        ["confirmed", "held", "checked_in"].includes(s.status),
      )
      .map((s) => s.roomId)
      .filter(Boolean),
  );
  const options = sellableTypeOptionsFromRooms(rooms);
  for (const t of options) {
    const free = rooms.some(
      (r) =>
        normalizeRoomTypeCode(r.typeCode) === t.code &&
        (r.hkStatus === "clean" || r.hkStatus === "inspected") &&
        !occupied.has(r.id),
    );
    if (free) return t.code;
  }
  return options[0]?.code ?? ROOM_TYPE_OPTIONS[0]?.code ?? "deluxe_twin";
}

function Stepper({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (n: number) => void;
}) {
  return (
    <div>
      <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--hos-ink-3)]">
        {label}
      </span>
      <div className="flex items-center rounded-xl border border-[var(--hos-line)] bg-[var(--hos-cell)] p-0.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.35)]">
        <button
          type="button"
          aria-label={`Decrease ${label}`}
          onClick={() => onChange(Math.max(min, value - 1))}
          className="hos-btn-tactile flex size-10 items-center justify-center rounded-[10px] text-[15px] font-bold text-[var(--hos-ink)] hover:bg-[rgba(17,17,17,0.05)] md:size-8"
        >
          −
        </button>
        <span className="flex-1 text-center font-mono text-[13px] font-black tabular-nums tracking-tight text-[var(--hos-ink)]">
          {value}
        </span>
        <button
          type="button"
          aria-label={`Increase ${label}`}
          onClick={() => onChange(Math.min(max, value + 1))}
          className="hos-btn-tactile flex size-10 items-center justify-center rounded-[10px] text-[15px] font-bold text-[var(--hos-ink)] hover:bg-[rgba(17,17,17,0.05)] md:size-8"
        >
          +
        </button>
      </div>
    </div>
  );
}

function FastBookShell({
  open,
  onOpenChange,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
}) {
  const isPhone = useIsPhone();
  const reduce = useReducedMotion();

  if (isPhone) {
    return (
      <Drawer.Root open={open} onOpenChange={onOpenChange}>
        <Drawer.Portal>
          <Drawer.Overlay className="fixed inset-0 z-[80] bg-[rgba(9,13,22,0.55)]" />
          <Drawer.Content className="hos-surface-glass fixed inset-x-0 bottom-0 z-[90] flex h-[min(94dvh,100%)] max-h-[94dvh] flex-col rounded-t-[22px] border border-[var(--hos-glass-border)] shadow-[var(--hos-elevated-shadow)] outline-none [transform:translateZ(0)] [backdrop-filter:blur(var(--hos-blur-l3))]">
            <div
              className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-[rgba(60,60,67,0.28)]"
              aria-hidden
            />
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              {children}
            </div>
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>
    );
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[80] bg-[rgba(9,13,22,0.52)] backdrop-blur-[28px]" />
        <Dialog.Content asChild>
          <motion.div
            className="fixed left-1/2 top-1/2 z-[90] w-[min(880px,96vw)] -translate-x-1/2 -translate-y-1/2 outline-none"
            initial={reduce ? false : { opacity: 0, y: 18, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ type: "spring", stiffness: 420, damping: 34 }}
          >
            <div className="hos-surface-glass flex max-h-[90dvh] flex-col overflow-hidden rounded-[24px] border border-[var(--hos-glass-border)] shadow-[var(--hos-shadow-volaro-lg)] [transform:translateZ(0)] [backdrop-filter:blur(var(--hos-blur-l3))]">
              {children}
            </div>
          </motion.div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function FastBookModal() {
  const isPhone = useIsPhone();
  const open = useFrontOfficeStore((s) => s.fastBookOpen);
  const prefill = useFrontOfficeStore((s) => s.fastBookPrefill);
  const closeFastBook = useFrontOfficeStore((s) => s.closeFastBook);
  const createBooking = useFrontOfficeStore((s) => s.createBooking);
  const updateStayRate = useFrontOfficeStore((s) => s.updateStayRate);
  const openStay = useFrontOfficeStore((s) => s.openStay);
  const businessDate = useFrontOfficeStore((s) => s.businessDate);
  const rooms = useFrontOfficeStore((s) => s.rooms);
  const agents = useCommercialStore((s) => s.agents);
  const rateCards = useCommercialStore((s) => s.rateCards);
  const cells = useCommercialStore((s) => s.cells);
  const season = useCommercialStore((s) => s.season);
  const [submitting, setSubmitting] = useState(false);

  const [profile, setProfile] = useState<ProfileId>("walk_in");
  const [guestName, setGuestName] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [checkIn, setCheckIn] = useState(businessDate);
  const [checkOut, setCheckOut] = useState(() => addDays(businessDate, 1));
  const [roomsCount, setRoomsCount] = useState(1);
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(0);
  const [extraBed, setExtraBed] = useState(false);
  /** Focused slot when editing type from the type grid (multi-room). */
  const [activeLineIdx, setActiveLineIdx] = useState(0);
  const [roomLines, setRoomLines] = useState<
    { key: string; typeCode: RoomTypeCode; roomId: string }[]
  >([{ key: "r0", typeCode: "deluxe_twin", roomId: "" }]);
  const [mealPlan, setMealPlan] = useState<MealPlan>("MAP");
  const [selectedAgentId, setSelectedAgentId] = useState(agents[0]?.id ?? "");
  const [rateCardId, setRateCardId] = useState(
    () => agents[0]?.rateCardId ?? rateCards.find((c) => c.code === "PUBLIC")?.id ?? "",
  );
  const [voucherNo, setVoucherNo] = useState("");
  const [asHold, setAsHold] = useState(false);
  const [depositAmount, setDepositAmount] = useState(0);
  const [depositTender, setDepositTender] = useState<(typeof TENDERS)[number]>("Cash");
  const [showMore, setShowMore] = useState(false);
  /** Same EP room net on every peer despite type — agents + multi-room parties. */
  const [uniformRate, setUniformRate] = useState(false);
  const [uniformNightlyNet, setUniformNightlyNet] = useState(0);

  const source: BookingSource =
    PROFILES.find((p) => p.id === profile)?.source ?? "walk_in";

  useEffect(() => {
    if (!open) return;
    const today = businessDate || ymd(new Date());
    setGuestName(prefill?.guestName ?? "");
    setGuestPhone(prefill?.guestPhone ?? "");
    setGuestEmail(prefill?.guestEmail ?? "");
    setCheckIn(prefill?.checkIn ?? today);
    setCheckOut(prefill?.checkOut ?? addDays(prefill?.checkIn ?? today, 1));
    const fo = useFrontOfficeStore.getState();
    const seedType =
      prefill?.typeCode ??
      defaultSellableTypeCode(fo.rooms, fo.stays);
    setMealPlan(prefill?.mealPlan ?? "MAP");
    setAsHold(Boolean(prefill?.asHold));
    setDepositAmount(prefill?.depositAmount ?? 0);
    setRoomsCount(1);
    setActiveLineIdx(0);
    setRoomLines([
      {
        key: "r0",
        typeCode: seedType,
        roomId: prefill?.roomId ?? "",
      },
    ]);
    setAdults(2);
    setChildren(0);
    setExtraBed(false);
    setShowMore(false);
    setVoucherNo("");
    const prefSource = prefill?.source;
    if (prefSource === "agent") {
      setProfile("agent");
      setUniformRate(true);
    } else if (prefSource === "direct" || prefSource === "ota") {
      setProfile("corporate");
      setUniformRate(false);
      setUniformNightlyNet(0);
    } else {
      setProfile("walk_in");
      setUniformRate(false);
      setUniformNightlyNet(0);
    }
  }, [open, prefill, businessDate]);

  /** Agent bookings always get the control; walk-in/corporate when 2+ rooms. */
  const showUniformRate = profile === "agent" || roomsCount >= 2;

  const setRoomsCountSafe = (n: number) => {
    const next = Math.max(1, Math.min(8, n));
    setRoomsCount(next);
    setRoomLines((prev) => {
      if (next === prev.length) return prev;
      if (next < prev.length) return prev.slice(0, next);
      const pad = [...prev];
      const last = pad[pad.length - 1] ?? {
        key: "r0",
        typeCode: (roomLines[0]?.typeCode ?? "deluxe_twin") as RoomTypeCode,
        roomId: "",
      };
      while (pad.length < next) {
        pad.push({
          key: `r${pad.length}-${Date.now()}`,
          typeCode: last.typeCode,
          roomId: "",
        });
      }
      return pad;
    });
    setActiveLineIdx((idx) => Math.min(idx, next - 1));
  };

  const typeOptions = useMemo(
    () => sellableTypeOptionsFromRooms(rooms),
    [rooms],
  );
  const typeCode = normalizeRoomTypeCode(
    roomLines[activeLineIdx]?.typeCode ?? roomLines[0]?.typeCode ?? "deluxe_twin",
  );
  const typeMeta =
    typeOptions.find((t) => t.code === typeCode) ??
    rateSheetTypeMeta(typeCode);
  const nights = nightsBetween(checkIn, checkOut);
  const activeCards = rateCards.filter((c) => c.active);
  const pickupCardId = resolveRateCardId({
    agents,
    rateCards,
    agentId: profile === "agent" ? selectedAgentId || rateCardId : null,
    explicitCardId: profile === "agent" ? rateCardId || null : null,
    profile,
  });

  const cardNightly = useMemo(() => {
    if (!pickupCardId) return typeMeta.nightlyNet;
    return quoteFromCard({
      cells,
      rateCardId: pickupCardId,
      typeCode,
      season,
      mealPlan,
      adults,
      fallbackNet: typeMeta.nightlyNet,
    });
  }, [pickupCardId, cells, season, mealPlan, typeCode, adults, typeMeta.nightlyNet]);

  const extraPerNight = useMemo(() => {
    if (!extraBed || !pickupCardId) return extraBed ? 1500 : 0;
    return quoteFromCard({
      cells,
      rateCardId: pickupCardId,
      typeCode,
      season,
      mealPlan,
      band: "extra",
      fallbackNet: 1500,
    });
  }, [extraBed, pickupCardId, cells, typeCode, season, mealPlan]);

  const childPerNight = useMemo(() => {
    if (children <= 0 || !pickupCardId) return 0;
    return quoteFromCard({
      cells,
      rateCardId: pickupCardId,
      typeCode,
      season,
      mealPlan,
      band: "child",
      fallbackNet: 0,
    });
  }, [children, pickupCardId, cells, typeCode, season, mealPlan]);

  const extraBedCharge = extraPerNight * nights * roomsCount;
  const childMealCharge = childPerNight * children * nights * roomsCount;

  const quote = useMemo(() => {
    let baseRoomNet = 0;
    let mealNet = 0;
    if (uniformRate && showUniformRate) {
      /* Uniform = EP room net despite category; meals add separately. */
      const ep = Math.max(0, uniformNightlyNet);
      const meal = mealPlanNightlyNet(mealPlan);
      baseRoomNet = ep * nights * roomsCount;
      mealNet = meal * nights * roomsCount;
    } else {
      /* Card nets are meal-inclusive — do not stack mealSurcharge again. */
      for (const line of roomLines) {
        const meta =
          typeOptions.find((t) => t.code === normalizeRoomTypeCode(line.typeCode)) ??
          rateSheetTypeMeta(line.typeCode);
        const fallback = meta?.nightlyNet ?? typeMeta.nightlyNet;
        const nightly = pickupCardId
          ? quoteFromCard({
              cells,
              rateCardId: pickupCardId,
              typeCode: line.typeCode,
              season,
              mealPlan,
              adults,
              fallbackNet: fallback,
            })
          : fallback;
        baseRoomNet += nightly * nights;
      }
    }
    const totalNet = baseRoomNet + mealNet + extraBedCharge + childMealCharge;
    const tax = taxBreakdown(totalNet);
    return {
      nights,
      roomsCount,
      baseNet: baseRoomNet,
      mealNet,
      totalNet,
      sc: tax.scAmount,
      bst: tax.bstAmount,
      totalDue: tax.totalAmount,
    };
  }, [
    uniformRate,
    showUniformRate,
    uniformNightlyNet,
    roomLines,
    pickupCardId,
    cells,
    season,
    mealPlan,
    adults,
    nights,
    roomsCount,
    extraBedCharge,
    childMealCharge,
    typeMeta.nightlyNet,
  ]);

  /* Seed uniform Nu from active card EP when turning the toggle on. */
  useEffect(() => {
    if (!uniformRate || !showUniformRate) return;
    if (uniformNightlyNet > 0) return;
    const ep = pickupCardId
      ? quoteFromCard({
          cells,
          rateCardId: pickupCardId,
          typeCode,
          season,
          mealPlan: "EP",
          adults,
          fallbackNet: typeMeta.nightlyNet,
        })
      : typeMeta.nightlyNet;
    setUniformNightlyNet(ep);
  }, [
    uniformRate,
    showUniformRate,
    uniformNightlyNet,
    pickupCardId,
    cells,
    typeCode,
    season,
    adults,
    typeMeta.nightlyNet,
  ]);

  const claimedRoomIds = useMemo(
    () => new Set(roomLines.map((l) => l.roomId).filter(Boolean)),
    [roomLines],
  );

  const candidatesForType = (code: RoomTypeCode, keepRoomId?: string) => {
    const want = normalizeRoomTypeCode(code);
    return rooms
      .filter(
        (r) =>
          normalizeRoomTypeCode(r.typeCode) === want &&
          r.hkStatus !== "ooo" &&
          r.hkStatus !== "occupied" &&
          (keepRoomId ? r.id === keepRoomId || !claimedRoomIds.has(r.id) : !claimedRoomIds.has(r.id)),
      )
      .sort((a, b) => {
        const rank = (h: string) =>
          h === "inspected" ? 0 : h === "clean" ? 1 : h === "dirty" ? 2 : 3;
        return rank(a.hkStatus) - rank(b.hkStatus) || a.number.localeCompare(b.number);
      });
  };

  const mixSummary = useMemo(() => {
    const counts = new Map<string, number>();
    for (const line of roomLines) {
      counts.set(line.typeCode, (counts.get(line.typeCode) ?? 0) + 1);
    }
    return [...counts.entries()]
      .map(([code, n]) => (n > 1 ? `${n}×${code}` : code))
      .join(" · ");
  }, [roomLines]);

  const submit = () => {
    if (submitting) return;
    if (!guestName.trim()) {
      toast.error("Lead guest name is required");
      return;
    }
    if (nights < 1) {
      toast.error("Check-out date must be after check-in date");
      return;
    }
    if (uniformRate && showUniformRate && uniformNightlyNet < 100) {
      toast.error("Set party EP room net", {
        description: "Uniform rate is on — enter nightly EP Nu before booking",
      });
      return;
    }
    if (!uniformRate && quote.totalDue < 1) {
      toast.error("Quote is empty", {
        description: "Pick a rate card / room type with a sellable nightly net",
      });
      return;
    }

    setSubmitting(true);
    void (async () => {
      try {
        const agent = agents.find((a) => a.id === selectedAgentId);
        const created = await createBooking({
          guestName,
          guestPhone,
          guestEmail,
          typeCode: roomLines[0]?.typeCode ?? typeCode,
          checkIn,
          checkOut,
          mealPlan,
          source,
          asHold,
          depositAmount: depositAmount > 0 ? depositAmount : undefined,
          roomId: roomLines[0]?.roomId || null,
          agencyName: profile === "agent" ? agent?.name ?? null : null,
          groupName:
            profile === "agent"
              ? agent?.name ?? null
              : profile === "corporate"
                ? "Corporate"
                : undefined,
          roomsCount: roomLines.length,
          roomLines: roomLines.map((l) => ({
            typeCode: l.typeCode,
            roomId: l.roomId || null,
          })),
          uniformNightlyNet:
            uniformRate && showUniformRate ? Math.max(0, uniformNightlyNet) : null,
          adults,
          children,
          extraBed,
        });
        if (!created.ok) {
          toast.error(created.error);
          return;
        }
        if (created.assignWarning) {
          toast.error(created.assignWarning, {
            description: "Booking saved — assign the room in StayHub",
          });
        }
        const stay = created.stay;
        const party = created.stays;

        /*
         * FO folio = room nightlyNet + mealPlanNightlyNet(meal).
         * Uniform: stamp same EP net on every peer. Else: card EP band per type.
         */
        const useUniform = uniformRate && showUniformRate;
        if (useUniform || pickupCardId) {
          for (const peer of party) {
            const meta =
              typeOptions.find((t) => t.code === normalizeRoomTypeCode(peer.typeCode)) ??
              rateSheetTypeMeta(peer.typeCode);
            const roomNet = useUniform
              ? Math.max(0, uniformNightlyNet)
              : quoteFromCard({
                  cells,
                  rateCardId: pickupCardId!,
                  typeCode: peer.typeCode,
                  season,
                  mealPlan: "EP",
                  adults,
                  fallbackNet: meta?.nightlyNet ?? typeMeta.nightlyNet,
                });
            const rateRes = await updateStayRate(peer.id, {
              nightlyNet: roomNet,
              mealPlan,
            });
            if (!rateRes.ok) {
              console.error("[fast-book] updateStayRate failed", rateRes.error);
              toast.error(rateRes.error, {
                description: "Booking created but card rate was not applied",
              });
              /* Still open StayHub — do not abort Open Stay on rate patch failure. */
            }
          }
        }

        toast.success(
          `${stay.confirmationNo} · ${asHold ? "Hold reserved" : "Booking confirmed"}`,
          {
            description:
              party.length > 1
                ? `${guestName} · ${party.length} rooms (${mixSummary})${
                    useUniform ? ` · uniform ${formatNu(uniformNightlyNet)}/n` : ""
                  } · ${nights}N · ${mealPlan} · ${formatNu(quote.totalDue)}`
                : `${guestName} · 1 rm · ${typeCode}${
                    useUniform ? ` · uniform ${formatNu(uniformNightlyNet)}/n` : ""
                  } · ${nights}N · ${mealPlan} · ${formatNu(quote.totalDue)} · Stay open`,
          },
        );

        /* createBooking already closed Fast Book. Delay StayHub open past Radix/Vaul
         * exit (~200ms). openStay also stamps stayHubDismissGuardUntil so focus-restore
         * cannot clear the sheet. Do NOT clear this timer via a React effect — that
         * cancelled openStay when pending state flipped null. */
        const stayId = stay.id;
        window.setTimeout(() => {
          openStay(stayId);
        }, 320);
      } catch (err) {
        console.error("[fast-book] submit failed", err);
        toast.error(err instanceof Error ? err.message : "Could not create booking");
      } finally {
        setSubmitting(false);
      }
    })();
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        submit();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- submit closes over latest form state
  }, [open, guestName, nights, profile, checkIn, checkOut, roomLines, mealPlan]);

  const TitleTag = isPhone ? Drawer.Title : Dialog.Title;
  const DescTag = isPhone ? Drawer.Description : Dialog.Description;
  const CloseTag = isPhone ? Drawer.Close : Dialog.Close;

  const rateCode = rateCardById(rateCards, pickupCardId)?.code ?? "—";

  return (
    <FastBookShell
      open={open}
      onOpenChange={(next) => {
        if (!next) closeFastBook();
      }}
    >
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="hos-module-chrome relative shrink-0 overflow-hidden rounded-none border-x-0 border-t-0 px-3.5 py-2.5 md:px-5 md:py-3">
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[rgba(17,17,17,0.04)] via-transparent to-[rgba(37,99,235,0.06)]" />
          <div className="relative flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-[#111] text-white shadow-[0_8px_18px_-10px_#111] md:size-9">
                <Zap className="size-3.5" strokeWidth={2.25} />
              </span>
              <div className="min-w-0">
                <TitleTag className="m-0 truncate text-[1.05rem] font-extrabold tracking-tight text-[var(--hos-ink)] md:text-[1.15rem]">
                  Fast Book
                </TitleTag>
                <DescTag className="m-0 mt-0.5 font-mono text-[10px] tabular-nums text-[var(--hos-ink-3)] md:text-[11px]">
                  {checkIn.slice(5)} → {checkOut.slice(5)} · {nights}N ·{" "}
                  <span className="font-semibold text-[var(--hos-ink)]">
                    {formatNu(quote.totalDue)}
                  </span>
                </DescTag>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <kbd className="hos-keycap hidden md:inline">⌘↵</kbd>
              <CloseTag asChild>
                <button
                  type="button"
                  className="hos-btn-tactile flex size-9 items-center justify-center rounded-xl text-sm font-bold text-[var(--hos-ink-3)] hover:bg-[rgba(17,17,17,0.06)] hover:text-[var(--hos-ink)]"
                  aria-label="Close"
                >
                  ✕
                </button>
              </CloseTag>
            </div>
          </div>

          <div className="relative mt-2.5 flex flex-wrap items-center gap-2">
            <div className="hos-mobile-segment-rail !mx-0 flex !gap-1 !overflow-visible !px-0">
              {PROFILES.map((p) => {
                const active = profile === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    data-active={active ? "true" : undefined}
                    onClick={() => {
                      setProfile(p.id);
                      if (p.id === "agent") {
                        setUniformRate(true);
                        const ag =
                          agents.find((a) => a.id === selectedAgentId) ?? agents[0];
                        if (ag) {
                          setSelectedAgentId(ag.id);
                          setRateCardId(ag.rateCardId);
                        }
                      } else {
                        setUniformRate(false);
                      }
                    }}
                    className="hos-mobile-segment !min-h-9 !rounded-full !px-3.5 !text-[12px]"
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
            <Badge
              tone={asHold ? "danger" : "success"}
              className="ml-auto border border-[var(--hos-line)]"
            >
              {asHold ? "HOLD" : "CONFIRMED"}
            </Badge>
          </div>
        </div>

        <div className="hos-scrollbar-slim grid min-h-0 flex-1 grid-cols-1 content-start gap-2.5 overflow-y-auto overscroll-contain p-3.5 text-xs md:grid-cols-2 md:gap-3 md:p-5">
          <div className="flex flex-col gap-2.5">
            <div className="hos-luxury-card space-y-2.5 p-3">
              <h3 className="m-0 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-[var(--hos-primary)]">
                Guest
              </h3>
              <label className="grid gap-1.5">
                <span className="text-[11px] font-semibold text-[var(--hos-ink-2)]">
                  Lead name <span className="text-[var(--hos-ruby)]">*</span>
                </span>
                <input
                  autoFocus={!isPhone}
                  data-testid="fast-book-guest-name"
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  placeholder="Guest full name"
                  className={fieldClass}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") submit();
                  }}
                />
              </label>
              <label className="grid gap-1.5">
                <span className="text-[11px] font-semibold text-[var(--hos-ink-2)]">
                  Phone
                </span>
                <input
                  value={guestPhone}
                  onChange={(e) => setGuestPhone(e.target.value)}
                  placeholder="+975-17…"
                  className={fieldClass}
                />
              </label>
            </div>

            <div className="hos-luxury-card space-y-3 p-3.5">
              <h3 className="m-0 text-[10px] font-black uppercase tracking-[0.16em] text-[var(--hos-primary)]">
                Stay
              </h3>
              <div className="grid grid-cols-2 gap-2.5">
                <label className="grid gap-1.5">
                  <span className="text-[11px] font-semibold text-[var(--hos-ink-2)]">
                    Check-in
                  </span>
                  <input
                    type="date"
                    value={checkIn}
                    onChange={(e) => {
                      setCheckIn(e.target.value);
                      if (e.target.value >= checkOut) {
                        setCheckOut(addDays(e.target.value, 1));
                      }
                    }}
                    className={`${fieldClass} !font-mono !tabular-nums`}
                  />
                </label>
                <label className="grid gap-1.5">
                  <span className="text-[11px] font-semibold text-[var(--hos-ink-2)]">
                    Check-out
                  </span>
                  <input
                    type="date"
                    value={checkOut}
                    onChange={(e) => setCheckOut(e.target.value)}
                    className={`${fieldClass} !font-mono !tabular-nums`}
                  />
                </label>
              </div>
              <div className="grid grid-cols-3 gap-2.5 border-t border-[var(--hos-line)] pt-3">
                <Stepper
                  label="Rooms"
                  value={roomsCount}
                  min={1}
                  max={8}
                  onChange={setRoomsCountSafe}
                />
                <Stepper
                  label="Adults"
                  value={adults}
                  min={1}
                  max={16}
                  onChange={setAdults}
                />
                <Stepper
                  label="Children"
                  value={children}
                  min={0}
                  max={8}
                  onChange={setChildren}
                />
              </div>
              <p className="rounded-xl border border-[color-mix(in_srgb,var(--hos-teal)_35%,transparent)] bg-[color-mix(in_srgb,var(--hos-teal)_10%,transparent)] px-3 py-2 text-[11px] font-semibold text-[var(--hos-teal)]">
                Bhutanese child policy · 0–5 free · 6–11 50% meal
              </p>
              <label className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-[var(--hos-line)] bg-[var(--hos-cell)] px-3 py-2.5 text-[12px] font-medium text-[var(--hos-ink)]">
                <input
                  type="checkbox"
                  checked={extraBed}
                  onChange={(e) => setExtraBed(e.target.checked)}
                  className="size-4 rounded border-[var(--hos-line)]"
                />
                Extra bed
                <span className="ml-auto font-mono text-[11px] tabular-nums text-[var(--hos-ink-3)]">
                  +{formatNu(1500)}/n
                </span>
              </label>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <div className="hos-luxury-card space-y-3 p-3.5">
              <h3 className="m-0 text-[10px] font-black uppercase tracking-[0.16em] text-[var(--hos-primary)]">
                Room & meal
              </h3>
              {roomsCount > 1 ? (
                <p className="m-0 rounded-xl border border-[color-mix(in_srgb,var(--hos-primary)_28%,transparent)] bg-[color-mix(in_srgb,var(--hos-primary)_8%,transparent)] px-2.5 py-1.5 text-[11px] text-[var(--hos-ink-2)]">
                  Mixed types OK — tap a room row below, then a type card to set that
                  slot. Assign lists only units of that type.
                </p>
              ) : null}
              <div className="grid grid-cols-2 gap-2">
                {typeOptions.map((t) => {
                  const isSel = typeCode === t.code;
                  const inMix = roomLines.some(
                    (l) => normalizeRoomTypeCode(l.typeCode) === t.code,
                  );
                  const availableCount = rooms.filter(
                    (r) =>
                      normalizeRoomTypeCode(r.typeCode) === t.code &&
                      r.hkStatus !== "ooo" &&
                      r.hkStatus !== "occupied",
                  ).length;
                  const nightRate = isSel ? cardNightly : t.nightlyNet;
                  return (
                    <motion.button
                      key={t.code}
                      type="button"
                      whileTap={{ scale: 0.985 }}
                      onClick={() => {
                        setRoomLines((prev) =>
                          prev.map((line, i) =>
                            i === activeLineIdx
                              ? { ...line, typeCode: t.code, roomId: "" }
                              : line,
                          ),
                        );
                      }}
                      className={`hos-btn-tactile relative flex flex-col overflow-hidden rounded-2xl border p-2.5 text-left transition-shadow ${
                        isSel
                          ? "border-[var(--hos-primary)] bg-[rgba(37,99,235,0.1)] shadow-[0_0_0_1px_rgba(37,99,235,0.25),0_8px_20px_-12px_rgba(37,99,235,0.45)]"
                          : inMix
                            ? "border-[color-mix(in_srgb,var(--hos-primary)_40%,var(--hos-line))] bg-[var(--hos-cell)]"
                            : "border-[var(--hos-line)] bg-[var(--hos-cell)] hover:border-[rgba(37,99,235,0.35)]"
                      }`}
                    >
                      <div className="flex w-full items-center justify-between gap-1">
                        <span
                          className={`truncate text-[12px] font-bold tracking-tight ${
                            isSel ? "text-[var(--hos-primary)]" : "text-[var(--hos-ink)]"
                          }`}
                        >
                          {t.name}
                        </span>
                        <span
                          className={`shrink-0 rounded-full px-1.5 py-0.5 font-mono text-[10px] font-bold tabular-nums ${
                            availableCount === 0
                              ? "bg-[rgba(239,68,68,0.12)] text-[var(--hos-ruby)]"
                              : "bg-[rgba(16,185,129,0.14)] text-[var(--hos-emerald)]"
                          }`}
                        >
                          {availableCount}
                        </span>
                      </div>
                      <div className="mt-1.5 flex items-center justify-between text-[10px] text-[var(--hos-ink-3)]">
                        <span className="font-mono font-semibold">{t.code}</span>
                        <span className="font-mono font-bold tabular-nums text-[var(--hos-ink)]">
                          {formatNu(nightRate)}
                          <span className="font-medium text-[var(--hos-ink-3)]">/n</span>
                        </span>
                      </div>
                    </motion.button>
                  );
                })}
              </div>

              <div className="space-y-2">
                <span className="block text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--hos-ink-3)]">
                  Room assignment · by type
                </span>
                {roomLines.map((line, idx) => {
                  const candidates = candidatesForType(line.typeCode, line.roomId || undefined);
                  const meta =
          typeOptions.find((t) => t.code === normalizeRoomTypeCode(line.typeCode)) ??
          rateSheetTypeMeta(line.typeCode);
                  const isActive = idx === activeLineIdx;
                  return (
                    <div
                      key={line.key}
                      role="button"
                      tabIndex={0}
                      onClick={() => setActiveLineIdx(idx)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setActiveLineIdx(idx);
                        }
                      }}
                      className={`grid gap-1.5 rounded-xl border p-2.5 ${
                        isActive
                          ? "border-[var(--hos-primary)] bg-[rgba(37,99,235,0.06)]"
                          : "border-[var(--hos-line)] bg-[var(--hos-cell)]"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-semibold text-[var(--hos-ink)]">
                          Room {idx + 1}
                          {roomsCount > 1 ? (
                            <span className="ml-1 font-mono text-[10px] text-[var(--hos-ink-3)]">
                              · {line.typeCode}
                            </span>
                          ) : null}
                        </span>
                        {roomsCount > 1 ? (
                          <select
                            value={line.typeCode}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => {
                              const code = e.target.value as RoomTypeCode;
                              setActiveLineIdx(idx);
                              setRoomLines((prev) =>
                                prev.map((l, i) =>
                                  i === idx
                                    ? { ...l, typeCode: code, roomId: "" }
                                    : l,
                                ),
                              );
                            }}
                            className="hos-input !min-h-8 !rounded-lg !px-2 !py-1 !text-[11px]"
                            aria-label={`Type for room ${idx + 1}`}
                          >
                            {typeOptions.map((t) => (
                              <option key={t.code} value={t.code}>
                                {t.name}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span className="font-mono text-[10px] text-[var(--hos-ink-3)]">
                            {meta?.name ?? line.typeCode}
                          </span>
                        )}
                      </div>
                      <select
                        data-testid={idx === 0 ? "fast-book-room" : undefined}
                        value={line.roomId}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => {
                          const id = e.target.value;
                          setActiveLineIdx(idx);
                          setRoomLines((prev) =>
                            prev.map((l, i) =>
                              i === idx ? { ...l, roomId: id } : l,
                            ),
                          );
                        }}
                        className={fieldClass}
                      >
                        <option value="">
                          Unassigned · needs {line.typeCode}
                          {candidates.length === 0 ? " (none free)" : ""}
                        </option>
                        {candidates.map((r) => (
                          <option key={r.id} value={r.id}>
                            Rm {r.number} · {r.typeName} · {r.hkStatus}
                          </option>
                        ))}
                      </select>
                    </div>
                  );
                })}
              </div>

              <div>
                <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--hos-ink-3)]">
                  Meal plan
                </span>
                <div className="grid grid-cols-4 gap-1.5">
                  {MEALS.map((m) => {
                    const isSel = mealPlan === m.id;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setMealPlan(m.id)}
                        className={`hos-btn-tactile rounded-xl py-2 text-center ${
                          isSel
                            ? "hos-btn-ink shadow-[0_8px_18px_-10px_#111]"
                            : "border border-[var(--hos-line)] bg-[var(--hos-cell)] text-[var(--hos-ink-2)]"
                        }`}
                      >
                        <div className="text-[12px] font-bold">{m.label}</div>
                        <div
                          className={`text-[9px] ${isSel ? "text-white/70" : "opacity-80"}`}
                        >
                          {m.desc}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {showUniformRate ? (
                <div
                  className={`space-y-2 rounded-2xl border p-3 ${
                    profile === "agent"
                      ? "border-[rgba(245,158,11,0.45)] bg-[rgba(245,158,11,0.08)]"
                      : "border-[color-mix(in_srgb,var(--hos-primary)_30%,transparent)] bg-[color-mix(in_srgb,var(--hos-primary)_6%,transparent)]"
                  }`}
                >
                  <label className="flex cursor-pointer items-start gap-2.5">
                    <input
                      type="checkbox"
                      checked={uniformRate}
                      onChange={(e) => {
                        const on = e.target.checked;
                        setUniformRate(on);
                        if (!on) setUniformNightlyNet(0);
                      }}
                      className="mt-0.5 size-4 rounded border-[var(--hos-line)]"
                      data-testid="fast-book-uniform-rate"
                    />
                    <span className="min-w-0">
                      <span className="block text-[12px] font-bold text-[var(--hos-ink)]">
                        Uniform party rate · all rooms
                      </span>
                      <span className="block text-[10px] text-[var(--hos-ink-3)]">
                        {profile === "agent"
                          ? "Agent contract: same EP room net despite EXE / DLX / VAL. Meals still from meal plan."
                          : "Same EP room net on every room despite category. Meals still from meal plan."}
                      </span>
                    </span>
                  </label>
                  {uniformRate ? (
                    <label className="grid gap-1.5">
                      <span className="text-[11px] font-semibold text-[var(--hos-ink)]">
                        Party room net (EP) · Nu / night
                      </span>
                      <input
                        type="number"
                        min={0}
                        step={50}
                        value={uniformNightlyNet || ""}
                        onChange={(e) =>
                          setUniformNightlyNet(Math.max(0, Number(e.target.value) || 0))
                        }
                        className={`${fieldClass} !font-mono !tabular-nums`}
                        data-testid="fast-book-uniform-net"
                        placeholder="e.g. 4500"
                      />
                    </label>
                  ) : null}
                </div>
              ) : null}

              {profile === "agent" ? (
                <div className="space-y-2 rounded-2xl border border-[rgba(245,158,11,0.35)] bg-[rgba(245,158,11,0.06)] p-3">
                  <label className="grid gap-1.5">
                    <span className="text-[11px] font-semibold text-[var(--hos-ink)]">
                      Tour operator
                    </span>
                    {agents.length === 0 ? (
                      <p className="m-0 rounded-xl border border-dashed border-[var(--hos-line)] px-3 py-2 text-[12px] text-[var(--hos-ink-3)]">
                        No agents hydrated — PIN into the live hotel so the partners
                        vault can load from Postgres.
                      </p>
                    ) : (
                      <select
                        value={selectedAgentId}
                        onChange={(e) => {
                          const id = e.target.value;
                          setSelectedAgentId(id);
                          const ag = agents.find((a) => a.id === id);
                          if (ag) setRateCardId(ag.rateCardId);
                        }}
                        className={fieldClass}
                      >
                        {[...agents]
                          .sort((a, b) => a.name.localeCompare(b.name))
                          .map((ag) => (
                            <option key={ag.id} value={ag.id}>
                              {ag.name} ({ag.code})
                            </option>
                          ))}
                      </select>
                    )}
                  </label>
                  <input
                    placeholder="Voucher / MoU ref"
                    value={voucherNo}
                    onChange={(e) => setVoucherNo(e.target.value)}
                    className={fieldClass}
                  />
                </div>
              ) : null}

              <p className="m-0 flex items-center gap-1.5 font-mono text-[10px] tabular-nums text-[var(--hos-ink-3)]">
                <Sparkles className="size-3 text-[var(--hos-brass)]" strokeWidth={2} />
                Card {rateCode} · {formatNu(cardNightly)}/n net
              </p>
            </div>

            <button
              type="button"
              onClick={() => setShowMore((v) => !v)}
              data-testid="fast-book-more"
              className="text-left text-[12px] font-bold text-[var(--hos-primary)]"
            >
              {showMore ? "Hide extras" : "More — deposit, hold, email"}
            </button>

            {showMore ? (
              <div className="hos-luxury-card space-y-2.5 p-3.5">
                <label className="grid gap-1.5">
                  <span className="text-[11px] font-semibold text-[var(--hos-ink-2)]">
                    Email
                  </span>
                  <input
                    value={guestEmail}
                    onChange={(e) => setGuestEmail(e.target.value)}
                    placeholder="guest@domain.com"
                    className={fieldClass}
                  />
                </label>
                <label className="grid gap-1.5">
                  <span className="text-[11px] font-semibold text-[var(--hos-ink-2)]">
                    Rate card
                  </span>
                  <select
                    value={pickupCardId}
                    onChange={(e) => setRateCardId(e.target.value)}
                    className={fieldClass}
                  >
                    {activeCards.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.code} · {c.name}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  <label className="grid gap-1.5">
                    <span className="text-[11px] font-semibold text-[var(--hos-ink-2)]">
                      Deposit Nu
                    </span>
                    <input
                      type="number"
                      min={0}
                      value={depositAmount || ""}
                      onChange={(e) => setDepositAmount(Number(e.target.value) || 0)}
                      className={`${fieldClass} !font-mono !tabular-nums`}
                    />
                  </label>
                  <label className="grid gap-1.5">
                    <span className="text-[11px] font-semibold text-[var(--hos-ink-2)]">
                      Tender
                    </span>
                    <select
                      value={depositTender}
                      onChange={(e) =>
                        setDepositTender(e.target.value as (typeof TENDERS)[number])
                      }
                      className={fieldClass}
                    >
                      {TENDERS.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <label className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-[var(--hos-line)] bg-[var(--hos-cell)] px-3 py-2.5 text-[12px] font-semibold text-[var(--hos-ink)]">
                  <input
                    type="checkbox"
                    checked={asHold}
                    onChange={(e) => setAsHold(e.target.checked)}
                    className="size-4 rounded"
                  />
                  Tentative hold
                  <span className="ml-auto text-[10px] font-medium text-[var(--hos-ink-3)]">
                    releases 18:00
                  </span>
                </label>
              </div>
            ) : null}
          </div>
        </div>

        {/* Docked quote + actions — never sticky-over-scroll (was clipping Live BST quote). */}
        <div className="shrink-0 border-t border-[var(--hos-line)] bg-[var(--hos-surface)]">
          <div className="border-b border-[var(--hos-line)] px-3.5 py-2 md:px-5 md:py-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <strong className="flex items-center gap-1 text-[9px] font-black uppercase tracking-[0.14em] text-[var(--hos-primary)]">
                  <Sparkles className="size-2.5" strokeWidth={2} />
                  Live BST-3 quote
                </strong>
                <p className="m-0 truncate text-[10px] text-[var(--hos-ink-3)]">
                  {roomsCount} rm × {nights}N · {mixSummary || typeMeta.name} ·{" "}
                  {mealPlan}
                  {uniformRate && showUniformRate
                    ? ` · uniform ${formatNu(uniformNightlyNet)}/n EP`
                    : ""}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <div className="font-mono text-[1.2rem] font-black tabular-nums leading-none tracking-tight text-[var(--hos-ink)] md:text-[1.35rem]">
                  {formatNu(quote.totalDue)}
                </div>
                <div className="mt-0.5 text-[9px] font-bold text-[var(--hos-emerald)]">
                  All-in tax inclusive
                </div>
              </div>
            </div>
            <div className="mt-2 hidden grid-cols-4 gap-1.5 md:grid">
              {(
                [
                  { label: "Room net", value: quote.baseNet },
                  {
                    label: "Meals",
                    value:
                      uniformRate && showUniformRate
                        ? quote.mealNet
                        : quote.totalNet - quote.baseNet,
                  },
                  { label: "10% SC", value: quote.sc },
                  { label: "10% BST", value: quote.bst },
                ] as const
              ).map((row) => (
                <div
                  key={row.label}
                  className="rounded-lg border border-[var(--hos-line)] bg-[var(--hos-cell)] px-2 py-1.5"
                >
                  <span className="block text-[9px] font-medium text-[var(--hos-ink-3)]">
                    {row.label}
                  </span>
                  <strong className="font-mono text-[11px] tabular-nums text-[var(--hos-ink)]">
                    {formatNu(row.value)}
                  </strong>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 px-3.5 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] md:px-5 md:py-2.5 md:pb-2.5">
            <CloseTag asChild>
              <Button variant="ghost" size="sm" className="!min-h-9 !rounded-xl">
                Cancel
              </Button>
            </CloseTag>
            <Button
              size="sm"
              magnetic
              data-testid="fast-book-submit"
              disabled={submitting || !guestName.trim() || nights < 1}
              onClick={submit}
              className="hos-btn-ink hos-btn-spring !min-h-9 flex-1 gap-1.5 !rounded-xl px-4 text-[13px] font-bold md:flex-none"
            >
              <Zap className="size-3.5" strokeWidth={2.25} />
              {submitting
                ? "Creating…"
                : asHold
                  ? "Create hold → Stay"
                  : isPhone
                    ? "Confirm Booking"
                    : "Create → Open Stay"}
            </Button>
          </div>
        </div>
      </div>
    </FastBookShell>
  );
}
