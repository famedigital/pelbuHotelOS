"use client";

import {
  createBooking,
  previewStayCost,
  type BookingActionState,
  type RoomOption,
  type StayPreview,
} from "@/app/actions/bookings";
import { BookingStepContact } from "@/components/book/BookingStepContact";
import { BookingStepRoom } from "@/components/book/BookingStepRoom";
import { BookingStepStay } from "@/components/book/BookingStepStay";
import { BookingSummary } from "@/components/book/BookingSummary";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatBtn, roundBtn } from "@/lib/pricing";
import {
  computeExtraBedStayTotalBtn,
  computeMealStayTotalBtn,
} from "@/lib/meal-plans-calc";
import {
  nightsBetween,
  parseStaySearch,
  todayIso,
  type StaySearchParams,
} from "@/lib/stay-dates";
import { CheckIcon } from "lucide-react";
import Link from "next/link";
import { useActionState, useEffect, useMemo, useRef, useState } from "react";

const initial: BookingActionState = { ok: false };

type Step = 1 | 2 | 3;

const STEP_LABELS = ["Dates", "Room", "Contact"] as const;

const STEP_COPY: Record<Step, { title: string; hint: string }> = {
  1: {
    title: "When are you staying?",
    hint: "Set your dates and party size to load live availability.",
  },
  2: {
    title: "Choose your room",
    hint: "Live public rates for the dates you selected.",
  },
  3: {
    title: "Who is the stay for?",
    hint: "The desk uses these details to confirm and send your token link.",
  },
};

function CopyReference({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  async function onCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }
  return (
    <Button
      type="button"
      variant="outline"
      onClick={onCopy}
      aria-label={copied ? "Reference copied" : "Copy reference"}
    >
      {copied ? "Copied" : "Copy"}
    </Button>
  );
}

export function BookingWizard({
  initialStay,
  initialPreview = null,
}: {
  initialStay?: Partial<StaySearchParams> | null;
  initialPreview?: StayPreview | null;
} = {}) {
  const [state, action, pending] = useActionState(createBooking, initial);
  const stay = useMemo(
    () =>
      parseStaySearch({
        checkIn: initialStay?.checkIn,
        checkOut: initialStay?.checkOut,
        adults: initialStay?.adults,
        rooms: initialStay?.rooms,
      }),
    [
      initialStay?.checkIn,
      initialStay?.checkOut,
      initialStay?.adults,
      initialStay?.rooms,
    ],
  );
  const minCheckIn = useMemo(() => todayIso(), []);

  const [step, setStep] = useState<Step>(initialPreview ? 2 : 1);

  // Stay state lifted so we can drive the room-step preview.
  const [checkIn, setCheckIn] = useState<string>(stay.checkIn);
  const [checkOut, setCheckOut] = useState<string>(stay.checkOut);
  const [adults, setAdults] = useState<number>(stay.adults);
  const [children, setChildren] = useState<number>(0);
  const [rooms, setRooms] = useState<number>(stay.rooms);
  const [extraBeds, setExtraBeds] = useState<number>(0);
  const [mealPlanCode, setMealPlanCode] = useState<string>(
    initialPreview?.mealPlans[0]?.code ?? "EP",
  );

  // Preview + selection — SSR can seed first paint when dates are in the URL.
  const [preview, setPreview] = useState<StayPreview | null>(initialPreview);
  const [previewLoading, setPreviewLoading] = useState<boolean>(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const seededPreviewKey = useRef(
    initialPreview
      ? `${stay.checkIn}|${stay.checkOut}|${stay.rooms}|${stay.adults}`
      : null,
  );

  // Reference to the form so step 3 submit can trigger it programmatically.
  const formRef = useRef<HTMLFormElement>(null);

  const nights = nightsBetween(checkIn, checkOut);
  const nightsLabel =
    nights > 0 ? `→ ${nights} night${nights === 1 ? "" : "s"}` : null;

  const datesValid = Boolean(checkIn && checkOut && nights >= 1);

  // Re-fetch the rate/availability preview whenever the stay window changes.
  useEffect(() => {
    if (!datesValid) {
      const clearTimer = window.setTimeout(() => {
        setPreview(null);
        setPreviewError(null);
      }, 0);
      return () => window.clearTimeout(clearTimer);
    }
    const key = `${checkIn}|${checkOut}|${rooms}|${adults}`;
    if (seededPreviewKey.current === key && preview) {
      return;
    }
    seededPreviewKey.current = null;
    let cancelled = false;
    // Async stay preview; loading flags are intentional external sync.
    /* eslint-disable react-hooks/set-state-in-effect -- fetch lifecycle */
    setPreviewLoading(true);
    setPreviewError(null);
    previewStayCost({ checkIn, checkOut, rooms, adults })
      .then((res) => {
        if (cancelled) return;
        if (res.ok) {
          setPreview(res.preview);
          const plans = res.preview.mealPlans;
          if (plans.length) {
            setMealPlanCode((current) =>
              plans.some((p) => p.code === current)
                ? current
                : (plans[0]?.code ?? "EP"),
            );
          }
          if (!res.preview.extraBed.sellable) {
            setExtraBeds(0);
          }
          // If the previously selected room is no longer available, clear it.
          if (
            selectedCode &&
            !res.preview.options.some(
              (o) => o.code === selectedCode && o.available,
            )
          ) {
            setSelectedCode(null);
          }
        } else {
          setPreviewError(res.error);
          setPreview(null);
        }
      })
      .catch(() => {
        if (cancelled) return;
        setPreviewError("Could not load rates. Please try again.");
        setPreview(null);
      })
      .finally(() => {
        if (!cancelled) setPreviewLoading(false);
      });
    /* eslint-enable react-hooks/set-state-in-effect */
    return () => {
      cancelled = true;
    };
  }, [checkIn, checkOut, rooms, adults, datesValid]); // eslint-disable-line react-hooks/exhaustive-deps

  const options: RoomOption[] = preview?.options ?? [];
  const selectedOption = options.find((o) => o.code === selectedCode) ?? null;
  const selectedMealPlan =
    preview?.mealPlans.find((p) => p.code === mealPlanCode) ?? null;
  const mealTotalBtn =
    selectedOption?.totalBtn != null
      ? computeMealStayTotalBtn(
          selectedMealPlan?.amountPerAdultNight,
          adults,
          nights,
          selectedMealPlan?.amountPerChildNight,
          children,
        ) ?? 0
      : 0;
  const extraBedTotalBtn =
    selectedOption?.totalBtn != null && preview?.extraBed.sellable
      ? computeExtraBedStayTotalBtn(
          preview.extraBed.ratePerNight,
          extraBeds,
          nights,
        )
      : 0;
  const selectedTotal =
    selectedOption?.totalBtn != null
      ? roundBtn(selectedOption.totalBtn + mealTotalBtn + extraBedTotalBtn)
      : null;

  if (state.ok && state.bookingId) {
    return (
      <div className="mx-auto max-w-xl">
        <Card className="gap-0 overflow-hidden py-0" role="status">
          <div className="flex items-center gap-3 border-b border-border bg-mint-100 px-6 py-5">
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-mint-500 text-white">
              <CheckIcon className="size-5" aria-hidden />
            </span>
            <div>
              <h2 className="font-display text-xl text-foreground">
                Rooms held
              </h2>
              <p className="text-sm text-mint-600">
                Your reference is ready below.
              </p>
            </div>
          </div>
          <div className="space-y-4 px-6 py-5" aria-live="polite">
            <p className="text-sm text-muted-foreground">
              Pay the token to confirm
              {state.tokenAmount != null
                ? ` (${state.tokenAmount.toLocaleString("en-BT")} BTN)`
                : ""}
              . Quote your reference in bank remarks.
              {state.holdExpiresAt
                ? ` Hold expires ${new Date(state.holdExpiresAt).toLocaleString(
                    "en-BT",
                    { timeZone: "Asia/Thimphu" },
                  )}.`
                : ""}
            </p>
            <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-frost-1 px-4 py-3">
              <span className="font-mono text-sm break-all text-foreground">
                {state.bookingId}
              </span>
              <CopyReference value={state.bookingId} />
            </div>
            <div className="flex flex-wrap gap-3 pt-1">
              {state.paymentUrl ? (
                <Button asChild variant="citrus" size="lg">
                  <a href={state.paymentUrl}>Pay token</a>
                </Button>
              ) : null}
              <Button asChild variant="outline" size="lg">
                <Link href="/rooms">Back to rooms</Link>
              </Button>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  const canNext =
    step === 1 ? datesValid : step === 2 ? Boolean(selectedCode) : true;

  return (
    <form
      ref={formRef}
      action={action}
      className="grid items-start gap-4 sm:gap-6 lg:grid-cols-[minmax(0,1fr)_352px] lg:gap-8"
    >
      {/* Hidden fields posted on submit regardless of which step is visible. */}
      <input type="hidden" name="check_in" value={checkIn} />
      <input type="hidden" name="check_out" value={checkOut} />
      <input type="hidden" name="adults" value={adults} />
      <input type="hidden" name="children" value={children} />
      <input type="hidden" name="rooms" value={rooms} />
      <input type="hidden" name="extra_beds" value={extraBeds} />
      <input type="hidden" name="meal_plan_code" value={mealPlanCode} />
      <input type="hidden" name="quoted_total_btn" value={selectedTotal ?? ""} />
      {/* Step 2 also renders its own room_type_code hidden input. */}

      <div className="space-y-5">
        <Stepper step={step} />

        {state.error ? (
          <p
            className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"
            role="alert"
          >
            {state.error}
          </p>
        ) : null}

        <Card className="gap-0 overflow-hidden py-0">
          <div className="border-b border-border px-4 py-4 sm:px-5 md:px-6">
            <h2 className="text-base font-semibold text-foreground">
              {STEP_COPY[step].title}
            </h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {STEP_COPY[step].hint}
            </p>
          </div>

          <div className="px-4 py-5 sm:px-5 md:px-6">
            {step === 1 ? (
              <BookingStepStay
                checkIn={checkIn}
                checkOut={checkOut}
                minCheckIn={minCheckIn}
                nightsLabel={nightsLabel}
                onCheckIn={setCheckIn}
                onCheckOut={setCheckOut}
                adults={adults}
                onAdults={setAdults}
                children={children}
                onChildren={setChildren}
                rooms={rooms}
                onRooms={setRooms}
                extraBeds={extraBeds}
                onExtraBeds={setExtraBeds}
                mealPlans={preview?.mealPlans ?? []}
                mealPlanCode={mealPlanCode}
                onMealPlan={setMealPlanCode}
                extraBed={preview?.extraBed ?? null}
              />
            ) : null}

            {step === 2 ? (
              <BookingStepRoom
                options={options}
                selectedCode={selectedCode}
                onSelect={setSelectedCode}
                loading={previewLoading}
                error={previewError}
                nights={nights}
                rooms={rooms}
                ratesInclusiveOfGstSc={
                  preview?.ratesInclusiveOfGstSc ?? false
                }
              />
            ) : null}

            {step === 3 ? <BookingStepContact /> : null}
          </div>
        </Card>
      </div>

      <BookingSummary
        className="hidden lg:block"
        checkIn={checkIn}
        checkOut={checkOut}
        nights={nights}
        adults={adults}
        children={children}
        rooms={rooms}
        extraBeds={extraBeds}
        selectedName={selectedOption?.name ?? null}
        perNightBtn={selectedOption?.perNightBtn ?? null}
        mealTotalBtn={mealTotalBtn > 0 ? mealTotalBtn : null}
        extraBedTotalBtn={extraBedTotalBtn > 0 ? extraBedTotalBtn : null}
        totalBtn={selectedTotal}
        currency="BTN"
        ratesInclusiveOfGstSc={preview?.ratesInclusiveOfGstSc ?? false}
      />

      {step === 3 ? (
        <div className="rounded-xl border border-border bg-frost-2/50 px-4 py-3 text-sm lg:hidden">
          <p className="font-medium text-foreground">
            {selectedOption?.name ?? "Room selected"}
          </p>
          <p className="mt-0.5 text-muted-foreground tabular-nums">
            {nights} night{nights === 1 ? "" : "s"} · {rooms} room
            {rooms === 1 ? "" : "s"}
            {selectedTotal != null ? ` · ${formatBtn(selectedTotal)}` : ""}
          </p>
        </div>
      ) : null}

      {/* Keeps content clear of the fixed mobile action bar + home indicator. */}
      <div
        className="col-span-full h-[calc(5rem+env(safe-area-inset-bottom))] lg:hidden"
        aria-hidden
      />

      {/* One action row: fixed bottom bar on mobile, inline on desktop. */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur lg:static lg:col-start-1 lg:row-start-2 lg:border-0 lg:bg-transparent lg:p-0">
        <div className="mx-auto flex max-w-[1160px] items-center gap-3 lg:max-w-none">
          <div className="min-w-0 lg:hidden">
            <p className="text-[11px] leading-none text-muted-foreground">
              {selectedTotal == null ? "Total" : "Estimated total"}
            </p>
            <p className="mt-1 truncate text-sm font-semibold leading-none tabular-nums text-foreground">
              {selectedTotal == null ? "—" : formatBtn(selectedTotal)}
            </p>
          </div>

          <div className="ml-auto flex items-center gap-2">
            {step > 1 ? (
              <Button
                type="button"
                variant="outline"
                size="lg"
                className="min-h-11 min-w-11 px-4"
                onClick={() => setStep((s) => Math.max(1, s - 1) as Step)}
              >
                Back
              </Button>
            ) : null}

            {step < 3 ? (
              <Button
                type="button"
                variant="citrus"
                size="lg"
                className="min-h-11 min-w-[7.5rem] px-5"
                onClick={() => {
                  if (canNext) setStep((s) => Math.min(3, s + 1) as Step);
                }}
                disabled={!canNext}
              >
                Continue
              </Button>
            ) : (
              <Button
                type="submit"
                variant="citrus"
                size="lg"
                className="min-h-11 min-w-[8.5rem] px-5"
                disabled={pending}
              >
                {pending ? "Holding rooms…" : "Request booking"}
              </Button>
            )}
          </div>
        </div>
      </div>
    </form>
  );
}

function Stepper({ step }: { step: Step }) {
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground">
        Step {step} of {STEP_LABELS.length}
      </p>
      <ol className="mt-2 flex items-center gap-2" aria-label="Booking steps">
        {STEP_LABELS.map((label, i) => {
          const n = (i + 1) as Step;
          const active = step === n;
          const done = step > n;
          const isLast = i === STEP_LABELS.length - 1;
          return (
            <li
              key={label}
              className={isLast ? "flex items-center gap-2" : "flex flex-1 items-center gap-2"}
            >
              <span
                aria-current={active ? "step" : undefined}
                className={[
                  "grid size-7 shrink-0 place-items-center rounded-full text-xs font-semibold transition-colors",
                  done
                    ? "bg-mint-500 text-white"
                    : active
                      ? "bg-sky-700 text-white"
                      : "bg-secondary text-muted-foreground",
                ].join(" ")}
              >
                {done ? <CheckIcon className="size-3.5" aria-hidden /> : n}
              </span>
              <span
                className={[
                  "text-xs font-medium whitespace-nowrap",
                  active
                    ? "text-foreground"
                    : "hidden text-muted-foreground sm:inline",
                ].join(" ")}
              >
                {label}
              </span>
              {!isLast ? (
                <span
                  aria-hidden
                  className={[
                    "h-px flex-1 rounded-full",
                    done ? "bg-mint-500/50" : "bg-border",
                  ].join(" ")}
                />
              ) : null}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
