import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Crown,
  Building2,
  Receipt,
  Sparkles,
  ChevronRight,
  ChevronLeft,
  Check,
  Star,
  Hotel,
  KeyRound,
  ArrowRight,
  X,
  Plus,
  Trash2,
} from "lucide-react";
import { Button } from "@hos-v2/ui";
import { useSettingsStore, type Dzongkhag } from "../lib/settings-store";
import { useFiscalStore } from "../lib/fiscal-store";
import { useFrontOfficeStore } from "../lib/front-office-store";
import { toast } from "sonner";

const DZONGKHAGS: Dzongkhag[] = [
  "Thimphu",
  "Paro",
  "Punakha",
  "Bumthang",
  "Wangdue",
  "Haa",
  "Trashigang",
];

const STEPS = [
  { id: 1, label: "Identity", icon: Crown, title: "Brand & Identity" },
  { id: 2, label: "Inventory", icon: Building2, title: "Floors, types & rates" },
  { id: 3, label: "Fiscal", icon: Receipt, title: "Tax & service charge" },
  { id: 4, label: "Desk", icon: KeyRound, title: "Staff PIN & Shift 1" },
  { id: 5, label: "Launch", icon: Sparkles, title: "Commission & launch" },
];

type WizardRoomType = {
  id: string;
  code: string;
  name: string;
  count: number;
  nightlyNet: number;
};

const DEFAULT_ROOM_TYPES: WizardRoomType[] = [
  { id: "rt-dq", code: "deluxe_queen", name: "Deluxe Queen", count: 2, nightlyNet: 5900 },
  { id: "rt-dk", code: "deluxe_king", name: "Deluxe King", count: 2, nightlyNet: 5900 },
  { id: "rt-dt", code: "deluxe_twin", name: "Deluxe Twin", count: 22, nightlyNet: 5900 },
  { id: "rt-su", code: "suite", name: "Pelbu Suite", count: 1, nightlyNet: 14350 },
];

function newRoomTypeId(): string {
  return `rt-${crypto.randomUUID().slice(0, 8)}`;
}

export function HotelOnboardingWizard() {
  const isHotelOnboardingOpen = useSettingsStore((s) => s.isHotelOnboardingOpen);
  const closeHotelOnboarding = useSettingsStore((s) => s.closeHotelOnboarding);
  const completeHotelOnboarding = useSettingsStore((s) => s.completeHotelOnboarding);
  const hotelNameDefault = useSettingsStore((s) => s.hotelName);
  const dotStarsDefault = useSettingsStore((s) => s.dotStars);
  const dzongkhagDefault = useSettingsStore((s) => s.dzongkhag);

  const [step, setStep] = useState(1);
  const [direction, setDirection] = useState(1);

  const [hotelName, setHotelName] = useState(hotelNameDefault || "Demo Hotel");
  const [dotStars, setDotStars] = useState(dotStarsDefault || 4);
  const [dzongkhag, setDzongkhag] = useState<Dzongkhag>(dzongkhagDefault || "Thimphu");
  const [tradeLicense, setTradeLicense] = useState("TL-THIM-2026-9041");
  const [tpn, setTpn] = useState("BTN-TPN-109482");

  const [floorsCount, setFloorsCount] = useState(3);
  const [roomTypes, setRoomTypes] = useState<WizardRoomType[]>(DEFAULT_ROOM_TYPES);

  const [scEnabled, setScEnabled] = useState(true);
  const [bstEnabled, setBstEnabled] = useState(true);
  const [startingTill, setStartingTill] = useState(10000);

  const [gmName, setGmName] = useState("Karma Dorji");
  const [staffPin, setStaffPin] = useState("1234");
  const [shiftCode] = useState("Shift 1 (07:00 – 15:00)");

  const roomsCount = useMemo(
    () => roomTypes.reduce((sum, t) => sum + Math.max(0, t.count), 0),
    [roomTypes],
  );

  if (!isHotelOnboardingOpen) return null;

  const nextStep = () => {
    if (step === 2 && roomsCount < floorsCount) {
      toast.error("Total rooms must be at least the number of floors");
      return;
    }
    if (step === 2 && roomTypes.every((t) => t.count <= 0)) {
      toast.error("Add at least one room type with rooms");
      return;
    }
    if (step < 5) {
      setDirection(1);
      setStep((s) => s + 1);
    }
  };

  const prevStep = () => {
    if (step > 1) {
      setDirection(-1);
      setStep((s) => s - 1);
    }
  };

  const patchRoomType = (id: string, patch: Partial<WizardRoomType>) => {
    setRoomTypes((prev) =>
      prev.map((t) => {
        if (t.id !== id) return t;
        const next = { ...t, ...patch };
        if (typeof patch.count === "number") {
          next.count = Math.max(0, Math.min(120, Math.floor(patch.count)));
        }
        if (typeof patch.nightlyNet === "number") {
          next.nightlyNet = Math.max(0, Math.floor(patch.nightlyNet));
        }
        if (typeof patch.code === "string") {
          next.code = patch.code.toUpperCase().slice(0, 12);
        }
        return next;
      }),
    );
  };

  const bumpRoomCount = (id: string, delta: number) => {
    setRoomTypes((prev) => {
      const total = prev.reduce((s, t) => s + t.count, 0);
      return prev.map((t) => {
        if (t.id !== id) return t;
        if (delta > 0 && total >= 120) return t;
        return { ...t, count: Math.max(0, Math.min(120, t.count + delta)) };
      });
    });
  };

  const addRoomType = () => {
    setRoomTypes((prev) => [
      ...prev,
      {
        id: newRoomTypeId(),
        code: `TYPE${prev.length + 1}`,
        name: "New room type",
        count: 1,
        nightlyNet: 4500,
      },
    ]);
  };

  const removeRoomType = (id: string) => {
    setRoomTypes((prev) => (prev.length <= 1 ? prev : prev.filter((t) => t.id !== id)));
  };

  const handleFinish = () => {
    useFiscalStore.setState({ tillBalance: startingTill });

    const inv = useFrontOfficeStore.getState().commissionInventory({
      floors: floorsCount,
      roomTypes: roomTypes.map((t) => ({
        code: t.code,
        name: t.name,
        count: t.count,
        nightlyNet: t.nightlyNet,
      })),
    });
    if (!inv.ok) {
      toast.error(inv.error);
      return;
    }

    completeHotelOnboarding({
      hotelName,
      dzongkhag,
      dotStars,
      tradeLicense,
      tpn,
      scEnabled,
      bstEnabled,
      roomsCount: inv.roomCount,
      startingTill,
    });

    toast.success(`${hotelName} successfully commissioned!`, {
      description: `${inv.roomCount} rooms · ${floorsCount} floors · ${roomTypes.filter((t) => t.count > 0).length} types · tour starting…`,
    });
  };

  const fieldClass =
    "hos-input w-full !rounded-xl !min-h-11 !px-3.5 !text-sm font-medium text-[var(--hos-ink)]";
  const labelClass =
    "text-[11px] font-medium tracking-wide text-[var(--hos-ink-3)]";

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-center sm:items-center sm:p-4 md:p-6">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-slate-950/70 backdrop-blur-md"
        onClick={() => closeHotelOnboarding()}
      />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 12 }}
        transition={{ type: "spring", damping: 28, stiffness: 320 }}
        className="hos-luxury-card relative z-10 flex h-[100dvh] w-full max-w-none flex-col overflow-hidden rounded-none border-0 bg-[var(--hos-cell)] shadow-none sm:h-[min(720px,calc(100dvh-2rem))] sm:max-w-[720px] sm:rounded-[24px] sm:border sm:border-[var(--hos-line)] sm:shadow-[var(--hos-elevated-shadow)] md:max-w-[840px]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="wizard-title"
      >
        <div className="pointer-events-none absolute -top-20 left-1/2 h-40 w-80 -translate-x-1/2 rounded-full bg-[radial-gradient(circle,color-mix(in_srgb,var(--hos-primary)_28%,transparent),transparent_70%)] blur-2xl" />

        {/* Header */}
        <div className="relative flex shrink-0 items-start justify-between gap-3 border-b border-[var(--hos-line)] px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:items-center sm:px-6 sm:py-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="hos-btn-gemini flex size-10 shrink-0 items-center justify-center rounded-full text-white sm:size-9">
              <Hotel className="size-4.5" strokeWidth={2} />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] font-medium text-[var(--hos-primary)]">
                  Hotel setup
                </span>
                <span className="rounded-full bg-[var(--hos-primary-container)] px-2 py-0.5 font-mono text-[10px] font-medium text-[var(--hos-primary-on-container)]">
                  {step}/5
                </span>
              </div>
              <h2
                id="wizard-title"
                className="m-0 truncate text-[17px] font-medium tracking-normal text-[var(--hos-ink)] sm:text-lg"
              >
                {STEPS[step - 1].title}
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={() => closeHotelOnboarding()}
            className="hos-btn-tactile inline-flex size-11 shrink-0 items-center justify-center rounded-full border border-[var(--hos-line)] text-[var(--hos-ink-3)] sm:size-9"
            aria-label="Close wizard"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Step rail — scrollable on phone */}
        <div className="relative flex shrink-0 gap-1 overflow-x-auto border-b border-[var(--hos-line)] bg-[var(--hos-surface)] px-3 py-2.5 sm:justify-between sm:gap-2 sm:px-6 sm:py-3">
          {STEPS.map((s) => {
            const Icon = s.icon;
            const isCompleted = step > s.id;
            const isCurrent = step === s.id;
            return (
              <div
                key={s.id}
                className="flex min-w-[4.5rem] flex-1 flex-col items-center gap-1 sm:min-w-0 sm:flex-row sm:justify-center sm:gap-2"
              >
                <div
                  className={`flex size-8 items-center justify-center rounded-full text-[11px] font-medium transition-colors sm:size-7 ${
                    isCompleted
                      ? "bg-[var(--hos-emerald)] text-white"
                      : isCurrent
                        ? "bg-[var(--hos-primary)] text-white shadow-[var(--hos-primary-glow)]"
                        : "bg-[color-mix(in_srgb,var(--hos-ink)_8%,transparent)] text-[var(--hos-ink-3)]"
                  }`}
                >
                  {isCompleted ? (
                    <Check className="size-3.5 stroke-[3]" />
                  ) : (
                    <Icon className="size-3.5 sm:hidden" strokeWidth={2} />
                  )}
                  <span className="hidden sm:inline">{isCompleted ? null : s.id}</span>
                </div>
                <span
                  className={`max-w-[4.5rem] truncate text-center text-[10px] font-medium sm:max-w-none sm:text-left sm:text-[12px] ${
                    isCurrent
                      ? "text-[var(--hos-ink)]"
                      : isCompleted
                        ? "text-[var(--hos-emerald)]"
                        : "text-[var(--hos-ink-3)]"
                  }`}
                >
                  {s.label}
                </span>
              </div>
            );
          })}
        </div>

        {/* Body */}
        <div className="relative flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain px-4 py-4 sm:px-6 sm:py-5">
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={step}
              custom={direction}
              initial={{ x: direction > 0 ? 28 : -28, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: direction < 0 ? 28 : -28, opacity: 0 }}
              transition={{ type: "spring", damping: 28, stiffness: 320 }}
              className="flex min-h-full flex-col"
            >
              {step === 1 && (
                <div className="space-y-4">
                  <p className="m-0 text-[13px] leading-relaxed text-[var(--hos-ink-3)]">
                    Property name and DoT stars appear on registration cards, key envelopes,
                    and DRC receipts.
                  </p>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
                    <div className="space-y-1.5">
                      <label className={labelClass}>Property name</label>
                      <input
                        type="text"
                        value={hotelName}
                        onChange={(e) => setHotelName(e.target.value)}
                        placeholder="e.g. Demo Hotel"
                        className={fieldClass}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className={labelClass}>Dzongkhag</label>
                      <select
                        value={dzongkhag}
                        onChange={(e) => setDzongkhag(e.target.value as Dzongkhag)}
                        className={fieldClass}
                      >
                        {DZONGKHAGS.map((d) => (
                          <option key={d} value={d}>
                            {d}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className={labelClass}>DoT star rating</label>
                    <div className="flex flex-wrap gap-2">
                      {[1, 2, 3, 4, 5].map((stars) => (
                        <button
                          key={stars}
                          type="button"
                          onClick={() => setDotStars(stars)}
                          className={`hos-btn-tactile inline-flex min-h-11 items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-medium sm:min-h-10 ${
                            dotStars === stars
                              ? "border-[var(--hos-brass)] bg-[color-mix(in_srgb,var(--hos-brass)_16%,transparent)] text-[var(--hos-brass-ink)]"
                              : "border-[var(--hos-line)] text-[var(--hos-ink-3)]"
                          }`}
                        >
                          <Star
                            className={`size-4 ${
                              dotStars >= stars
                                ? "fill-[var(--hos-brass)] text-[var(--hos-brass)]"
                                : "text-[var(--hos-ink-3)]"
                            }`}
                          />
                          {stars}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
                    <div className="space-y-1.5">
                      <label className={labelClass}>Trade license #</label>
                      <input
                        type="text"
                        value={tradeLicense}
                        onChange={(e) => setTradeLicense(e.target.value)}
                        className={`${fieldClass} !font-mono`}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className={labelClass}>Tax Payer Number (TPN)</label>
                      <input
                        type="text"
                        value={tpn}
                        onChange={(e) => setTpn(e.target.value)}
                        className={`${fieldClass} !font-mono`}
                      />
                    </div>
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-4">
                  <p className="m-0 text-[13px] leading-relaxed text-[var(--hos-ink-3)]">
                    Set floors, then add every room type with its count and nightly net rack
                    rate. Total rooms = sum of type counts.
                  </p>

                  <div className="hos-luxury-card flex flex-col gap-3 p-3.5 sm:flex-row sm:items-center sm:justify-between sm:p-4">
                    <div>
                      <p className={labelClass}>Building floors</p>
                      <p className="m-0 text-[12px] text-[var(--hos-ink-3)]">
                        F1 to F{floorsCount}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        aria-label="Fewer floors"
                        onClick={() => setFloorsCount((f) => Math.max(1, f - 1))}
                        className="hos-btn-tactile inline-flex size-11 items-center justify-center rounded-full border border-[var(--hos-line)] text-lg font-medium sm:size-10"
                      >
                        −
                      </button>
                      <span className="min-w-[2ch] text-center font-mono text-2xl font-medium tabular-nums text-[var(--hos-ink)]">
                        {floorsCount}
                      </span>
                      <button
                        type="button"
                        aria-label="More floors"
                        onClick={() => setFloorsCount((f) => Math.min(8, f + 1))}
                        className="hos-btn-tactile inline-flex size-11 items-center justify-center rounded-full border border-[var(--hos-line)] text-lg font-medium sm:size-10"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  <div className="flex items-end justify-between gap-2">
                    <div>
                      <p className={`m-0 ${labelClass}`}>Room types & rates</p>
                      <p className="m-0 mt-0.5 text-[12px] text-[var(--hos-ink-3)]">
                        <span className="font-mono font-medium text-[var(--hos-ink)]">
                          {roomsCount}
                        </span>{" "}
                        rooms total · {roomTypes.length} type
                        {roomTypes.length === 1 ? "" : "s"}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={addRoomType}
                      className="!h-10 shrink-0 gap-1.5 !px-3.5"
                    >
                      <Plus className="size-4" strokeWidth={2} />
                      Add type
                    </Button>
                  </div>

                  <div className="space-y-3">
                    {roomTypes.map((rt) => (
                      <div
                        key={rt.id}
                        className="hos-cell space-y-3 rounded-2xl p-3.5 sm:p-4"
                      >
                        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-[minmax(0,1.2fr)_minmax(0,0.7fr)_auto] sm:items-end">
                          <div className="space-y-1">
                            <label className={labelClass}>Name</label>
                            <input
                              type="text"
                              value={rt.name}
                              onChange={(e) =>
                                patchRoomType(rt.id, { name: e.target.value })
                              }
                              className={fieldClass}
                            />
                          </div>
                          <div className="space-y-1">
                            <label className={labelClass}>Code</label>
                            <input
                              type="text"
                              value={rt.code}
                              onChange={(e) =>
                                patchRoomType(rt.id, { code: e.target.value })
                              }
                              className={`${fieldClass} !font-mono uppercase`}
                            />
                          </div>
                          <button
                            type="button"
                            aria-label={`Remove ${rt.name}`}
                            disabled={roomTypes.length <= 1}
                            onClick={() => removeRoomType(rt.id)}
                            className="hos-btn-tactile inline-flex size-11 items-center justify-center self-end rounded-full border border-[var(--hos-line)] text-[var(--hos-ruby)] disabled:opacity-35 sm:size-10"
                          >
                            <Trash2 className="size-4" strokeWidth={1.75} />
                          </button>
                        </div>

                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                          <div className="flex items-center justify-between gap-3 rounded-xl bg-[color-mix(in_srgb,var(--hos-primary)_6%,transparent)] px-3 py-2.5">
                            <span className="text-[13px] font-medium text-[var(--hos-ink-2)]">
                              Rooms
                            </span>
                            <div className="flex items-center gap-2.5">
                              <button
                                type="button"
                                aria-label={`Fewer ${rt.name}`}
                                onClick={() => bumpRoomCount(rt.id, -1)}
                                className="hos-btn-tactile inline-flex size-11 items-center justify-center rounded-full border border-[var(--hos-line)] bg-[var(--hos-cell)] text-lg font-medium sm:size-9"
                              >
                                −
                              </button>
                              <span className="min-w-[2.5ch] text-center font-mono text-xl font-medium tabular-nums text-[var(--hos-ink)]">
                                {rt.count}
                              </span>
                              <button
                                type="button"
                                aria-label={`More ${rt.name}`}
                                onClick={() => bumpRoomCount(rt.id, 1)}
                                className="hos-btn-tactile inline-flex size-11 items-center justify-center rounded-full border border-[var(--hos-line)] bg-[var(--hos-cell)] text-lg font-medium sm:size-9"
                              >
                                +
                              </button>
                            </div>
                          </div>

                          <div className="space-y-1">
                            <label className={labelClass}>Nightly net (Nu.)</label>
                            <input
                              type="number"
                              min={0}
                              step={100}
                              value={rt.nightlyNet}
                              onChange={(e) =>
                                patchRoomType(rt.id, {
                                  nightlyNet: Number(e.target.value) || 0,
                                })
                              }
                              className={`${fieldClass} !font-mono`}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {step === 3 && (
                <div className="space-y-3">
                  <p className="m-0 text-[13px] leading-relaxed text-[var(--hos-ink-3)]">
                    Separate 10% service charge (staff tip pool) from 10% Bhutan Sales Tax
                    for DRC filing.
                  </p>

                  <div className="hos-luxury-card flex items-start justify-between gap-3 p-4">
                    <div className="min-w-0">
                      <strong className="text-[14px] font-medium text-[var(--hos-ink)]">
                        10% Service Charge
                      </strong>
                      <p className="m-0 mt-1 text-[12px] text-[var(--hos-ink-3)]">
                        Tip pool for on-duty staff.
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={scEnabled}
                      onChange={(e) => setScEnabled(e.target.checked)}
                      className="mt-0.5 size-5 shrink-0 accent-[var(--hos-primary)]"
                    />
                  </div>

                  <div className="hos-luxury-card flex items-start justify-between gap-3 p-4">
                    <div className="min-w-0">
                      <strong className="text-[14px] font-medium text-[var(--hos-ink)]">
                        10% Bhutan Sales Tax (BST)
                      </strong>
                      <p className="m-0 mt-1 text-[12px] text-[var(--hos-ink-3)]">
                        Auto on taxable guest folios.
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={bstEnabled}
                      onChange={(e) => setBstEnabled(e.target.checked)}
                      className="mt-0.5 size-5 shrink-0 accent-[var(--hos-primary)]"
                    />
                  </div>

                  <div className="hos-luxury-card space-y-2 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <strong className="text-[14px] font-medium text-[var(--hos-ink)]">
                        Starting till float
                      </strong>
                      <span className="font-mono text-[14px] font-medium text-[var(--hos-emerald)]">
                        Nu. {startingTill.toLocaleString()}
                      </span>
                    </div>
                    <p className="m-0 text-[12px] text-[var(--hos-ink-3)]">
                      Opening cash for Shift 1 guest change.
                    </p>
                    <div className="flex flex-wrap gap-2 pt-1">
                      {[5000, 10000, 20000].map((amt) => (
                        <button
                          key={amt}
                          type="button"
                          onClick={() => setStartingTill(amt)}
                          className={`hos-btn-tactile min-h-10 rounded-full border px-3.5 font-mono text-[12px] font-medium ${
                            startingTill === amt
                              ? "border-[var(--hos-emerald)] bg-[color-mix(in_srgb,var(--hos-emerald)_14%,transparent)] text-[var(--hos-emerald)]"
                              : "border-[var(--hos-line)] text-[var(--hos-ink-2)]"
                          }`}
                        >
                          Nu. {amt.toLocaleString()}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {step === 4 && (
                <div className="space-y-4">
                  <p className="m-0 text-[13px] leading-relaxed text-[var(--hos-ink-3)]">
                    Primary staff PIN for the GM or front-desk lead.
                  </p>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
                    <div className="space-y-1.5">
                      <label className={labelClass}>Lead cashier / GM</label>
                      <input
                        type="text"
                        value={gmName}
                        onChange={(e) => setGmName(e.target.value)}
                        className={fieldClass}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className={labelClass}>4-digit PIN</label>
                      <input
                        type="password"
                        inputMode="numeric"
                        maxLength={4}
                        value={staffPin}
                        onChange={(e) =>
                          setStaffPin(e.target.value.replace(/\D/g, "").slice(0, 4))
                        }
                        className={`${fieldClass} !text-center !font-mono !text-lg !tracking-[0.35em]`}
                      />
                    </div>
                  </div>

                  <div className="hos-luxury-card space-y-2 p-4">
                    <label className={labelClass}>Active shift</label>
                    <div className="flex items-center gap-2">
                      <span className="size-2 animate-pulse rounded-full bg-[var(--hos-emerald)]" />
                      <span className="font-mono text-[13px] font-medium text-[var(--hos-ink)]">
                        {shiftCode}
                      </span>
                    </div>
                    <p className="m-0 text-[12px] text-[var(--hos-ink-3)]">
                      Opens with till float Nu. {startingTill.toLocaleString()}.
                    </p>
                  </div>
                </div>
              )}

              {step === 5 && (
                <div className="flex flex-col items-center justify-center gap-4 py-6 text-center sm:py-8">
                  <div className="hos-btn-gemini relative flex size-16 items-center justify-center rounded-full text-2xl text-white sm:size-20 sm:text-3xl">
                    👑
                    <span className="absolute -bottom-0.5 -right-0.5 flex size-7 items-center justify-center rounded-full bg-[var(--hos-emerald)] text-white shadow-md">
                      <Check className="size-4 stroke-[3]" />
                    </span>
                  </div>
                  <div>
                    <h3 className="m-0 text-xl font-medium tracking-normal text-[var(--hos-ink)] sm:text-2xl">
                      {hotelName} is ready
                    </h3>
                    <p className="m-0 mt-1.5 text-[13px] text-[var(--hos-ink-3)]">
                      {dzongkhag} · {dotStars}★ · {roomsCount} rooms ·{" "}
                      {roomTypes.filter((t) => t.count > 0).length} types
                    </p>
                  </div>

                  <div className="w-full max-w-md space-y-2 rounded-2xl border border-[var(--hos-line)] bg-[var(--hos-surface)] p-4 text-left">
                    {roomTypes
                      .filter((t) => t.count > 0)
                      .map((t) => (
                        <div
                          key={t.id}
                          className="flex justify-between gap-2 text-[13px]"
                        >
                          <span className="truncate text-[var(--hos-ink-3)]">
                            {t.name}{" "}
                            <span className="font-mono text-[11px]">({t.code})</span>
                          </span>
                          <span className="shrink-0 font-mono font-medium text-[var(--hos-ink)]">
                            {t.count} · Nu. {t.nightlyNet.toLocaleString()}
                          </span>
                        </div>
                      ))}
                    <div className="border-t border-[var(--hos-line)] pt-2">
                      <div className="flex justify-between text-[13px]">
                        <span className="text-[var(--hos-ink-3)]">Till float</span>
                        <span className="font-mono font-medium text-[var(--hos-emerald)]">
                          Nu. {startingTill.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="relative flex shrink-0 items-center justify-between gap-2 border-t border-[var(--hos-line)] bg-[var(--hos-surface)] px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6 sm:py-4">
          <Button
            variant="ghost"
            onClick={prevStep}
            disabled={step === 1}
            className="!h-11 gap-1 !px-3 text-[13px] sm:!h-10"
          >
            <ChevronLeft className="size-4" />
            <span className="hidden xs:inline sm:inline">Back</span>
          </Button>

          {step < 5 ? (
            <Button
              onClick={nextStep}
              className="hos-btn-primary !h-11 gap-1.5 !px-5 text-[13px] sm:!h-10"
            >
              Continue
              <ChevronRight className="size-4" />
            </Button>
          ) : (
            <Button
              onClick={handleFinish}
              className="hos-btn-gemini !h-11 gap-1.5 !px-5 text-[13px] sm:!h-10"
            >
              Launch desk
              <ArrowRight className="size-4" />
            </Button>
          )}
        </div>
      </motion.div>
    </div>
  );
}
