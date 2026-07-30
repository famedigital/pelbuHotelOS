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
import {
  nightsBetween,
  parseStaySearch,
  todayIso,
  type StaySearchParams,
} from "@/lib/stay-dates";
import { useActionState, useEffect, useMemo, useRef, useState } from "react";

const initial: BookingActionState = { ok: false };

type Step = 1 | 2 | 3;

const STEP_LABELS = ["Dates", "Room", "Contact"] as const;

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
}: {
  initialStay?: Partial<StaySearchParams> | null;
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

  const [step, setStep] = useState<Step>(1);

  // Stay state lifted so we can drive the room-step preview.
  const [checkIn, setCheckIn] = useState<string>(stay.checkIn);
  const [checkOut, setCheckOut] = useState<string>(stay.checkOut);
  const [adults, setAdults] = useState<number>(stay.adults);
  const [rooms, setRooms] = useState<number>(stay.rooms);
  const [mealPlanCode, setMealPlanCode] = useState<string>("EP");

  // Preview + selection.
  const [preview, setPreview] = useState<StayPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState<boolean>(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [selectedCode, setSelectedCode] = useState<string | null>(null);

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
    let cancelled = false;
    // Async stay preview; loading flags are intentional external sync.
    /* eslint-disable react-hooks/set-state-in-effect -- fetch lifecycle */
    setPreviewLoading(true);
    setPreviewError(null);
    previewStayCost({ checkIn, checkOut, rooms })
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
  }, [checkIn, checkOut, rooms, datesValid]); // eslint-disable-line react-hooks/exhaustive-deps

  const options: RoomOption[] = preview?.options ?? [];
  const selectedOption = options.find((o) => o.code === selectedCode) ?? null;
  const selectedTotal = selectedOption?.totalBtn ?? null;

  if (state.ok && state.bookingId) {
    return (
      <div role="status" aria-live="polite" className="max-w-lg space-y-4">
        <h2 className="font-display text-2xl text-ink">Rooms held</h2>
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
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-mono text-sm break-all text-ink">
            {state.bookingId}
          </span>
          <CopyReference value={state.bookingId} />
        </div>
        <div className="flex flex-wrap gap-3 pt-2">
          {state.paymentUrl ? (
            <Button asChild>
              <a href={state.paymentUrl}>Pay token</a>
            </Button>
          ) : null}
          <Button asChild variant="outline">
            <a href="/rooms">Back to rooms</a>
          </Button>
        </div>
      </div>
    );
  }

  const canNext =
    step === 1
      ? datesValid
      : step === 2
        ? Boolean(selectedCode)
        : true;

  return (
    <form
      ref={formRef}
      action={action}
      className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]"
    >
      {/* Hidden fields posted on submit regardless of which step is visible. */}
      <input type="hidden" name="check_in" value={checkIn} />
      <input type="hidden" name="check_out" value={checkOut} />
      <input type="hidden" name="adults" value={adults} />
      <input type="hidden" name="rooms" value={rooms} />
      <input type="hidden" name="meal_plan_code" value={mealPlanCode} />
      <input type="hidden" name="quoted_total_btn" value={selectedTotal ?? ""} />
      {/* Step 2 also renders its own room_type_code hidden input. */}

      <div className="space-y-6">
        <Stepper step={step} />

        {state.error ? (
          <p
            className="border border-maroon/30 bg-maroon/5 px-4 py-3 text-sm text-maroon"
            role="alert"
          >
            {state.error}
          </p>
        ) : null}

        <div className="space-y-1">
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
              rooms={rooms}
              onRooms={setRooms}
              mealPlans={preview?.mealPlans ?? []}
              mealPlanCode={mealPlanCode}
              onMealPlan={setMealPlanCode}
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
            />
          ) : null}

          {step === 3 ? <BookingStepContact /> : null}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          {step > 1 ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => setStep((s) => Math.max(1, s - 1) as Step)}
            >
              Back
            </Button>
          ) : (
            <span />
          )}

          {step < 3 ? (
            <Button
              type="button"
              onClick={() => {
                if (canNext) setStep((s) => Math.min(3, s + 1) as Step);
              }}
              disabled={!canNext}
            >
              Continue
            </Button>
          ) : (
            <Button type="submit" disabled={pending}>
              {pending ? "Holding rooms…" : "Request booking"}
            </Button>
          )}
        </div>
      </div>

      <BookingSummary
        checkIn={checkIn}
        checkOut={checkOut}
        nights={nights}
        adults={adults}
        rooms={rooms}
        selectedName={selectedOption?.name ?? null}
        totalBtn={selectedTotal}
        currency="BTN"
      />
    </form>
  );
}

function Stepper({ step }: { step: Step }) {
  return (
    <ol className="flex items-center gap-4 text-sm">
      {STEP_LABELS.map((label, i) => {
        const n = (i + 1) as Step;
        const active = step === n;
        const done = step > n;
        return (
          <li key={label}>
            <span
              className={
                active
                  ? "font-medium text-ink"
                  : done
                    ? "text-ink/60"
                    : "text-muted-foreground"
              }
              aria-current={active ? "step" : undefined}
            >
              {n}. {label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
