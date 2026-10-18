"use client";

import { FoRateSheetSelect } from "@/components/erp/FoRateSheetSelect";
import type { AskAvailabilityAnswer } from "@/lib/ask/availability-answer";
import { defaultFoRateTier } from "@/lib/ask/fo-rate-sheet";
import type { RateTier } from "@/lib/rates";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";

type AskResponse = {
  ok?: boolean;
  error?: string | null;
  parsed?: {
    rooms: number;
    checkIn: string;
    checkOut: string;
    nights: number;
    raw: string;
  };
  answer?: AskAvailabilityAnswer;
};

function formatNu(n: number | null): string {
  if (n == null) return "—";
  return `Nu ${Math.round(n).toLocaleString("en-BT")}`;
}

export function AskPanel({
  initialQuery = "",
}: {
  initialQuery?: string;
} = {}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState(initialQuery);
  const [rateTier, setRateTier] = useState<RateTier | "custom">(
    defaultFoRateTier(false),
  );
  const [error, setError] = useState<string | null>(null);
  const [answer, setAnswer] = useState<AskAvailabilityAnswer | null>(null);
  const [parsed, setParsed] = useState<AskResponse["parsed"]>(undefined);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const runAsk = useCallback(
    (q: string) => {
      const trimmed = q.trim();
      if (!trimmed) {
        setError("Type something like: 3 rooms 22 oct 3n");
        return;
      }
      setError(null);
      startTransition(async () => {
        const tier =
          rateTier === "custom" ? defaultFoRateTier(false) : rateTier;
        const params = new URLSearchParams({
          q: trimmed,
          rate_tier: tier,
        });
        try {
          const res = await fetch(`/api/erp/ask?${params}`);
          const data = (await res.json()) as AskResponse;
          if (!res.ok || !data.answer) {
            setAnswer(null);
            setParsed(data.parsed);
            setError(data.error || "Could not answer.");
            return;
          }
          setParsed(data.parsed);
          setAnswer(data.answer);
        } catch {
          setError("Network error — try again.");
          setAnswer(null);
        }
      });
    },
    [rateTier],
  );

  const reserveHref = (() => {
    if (!answer || !parsed) return "/erp/reserve";
    const best =
      answer.types.find((t) => t.free >= answer.roomsRequested) ??
      answer.types.find((t) => t.free > 0) ??
      answer.types[0];
    const params = new URLSearchParams({
      check_in: answer.checkIn,
      check_out: answer.checkOut,
      rooms: String(answer.roomsRequested),
      rate_tier: answer.rateTier,
    });
    if (best) {
      params.set("room_type", best.code);
      params.set(`qty_${best.code}`, String(answer.roomsRequested));
    }
    return `/erp/reserve?${params.toString()}`;
  })();

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      <form
        className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-sm"
        onSubmit={(e) => {
          e.preventDefault();
          if (answer?.yes) {
            router.push(reserveHref);
            return;
          }
          runAsk(query);
        }}
      >
        <div className="flex flex-col gap-1">
          <label
            htmlFor="fo-ask-input"
            className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase"
          >
            Ask · free / held / rate
          </label>
          <Input
            ref={inputRef}
            id="fo-ask-input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="3 rooms 22 oct 3n"
            className="h-12 text-base"
            autoComplete="off"
            spellCheck={false}
          />
          <p className="text-xs text-muted-foreground">
            Press Enter · shortcut <kbd className="rounded border px-1">/</kbd>{" "}
            or <kbd className="rounded border px-1">F2</kbd>
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <FoRateSheetSelect
            value={rateTier}
            onChange={(v) => {
              setRateTier(v);
              if (v === "custom") {
                setError("Custom needs manager PIN on Reserve — pick a sheet for Ask.");
              }
            }}
          />
          <Button type="submit" size="lg" disabled={pending} className="min-w-28">
            {pending ? "…" : "Ask"}
          </Button>
        </div>
      </form>

      {error ? (
        <p className="rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {answer ? (
        <div className="flex flex-col gap-3">
          <div
            className={cn(
              "rounded-xl border px-4 py-3 text-lg font-semibold tracking-tight",
              answer.yes
                ? "border-emerald-600/30 bg-emerald-500/10 text-emerald-900 dark:text-emerald-100"
                : "border-amber-600/30 bg-amber-500/10 text-amber-950 dark:text-amber-100",
            )}
          >
            {answer.yes ? "YES" : "NO"} · {answer.roomsRequested} room
            {answer.roomsRequested === 1 ? "" : "s"} · {answer.checkIn} →{" "}
            {answer.checkOut} ({answer.nights}n) · {answer.seasonKind} ·{" "}
            {answer.rateTier.replace(/_/g, " ")}
          </div>

          <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
            {answer.types.map((t) => (
              <li
                key={t.roomTypeId}
                className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-3"
              >
                <div>
                  <p className="font-medium">{t.name}</p>
                  <p className="text-xs text-muted-foreground">
                    Free {t.free} · Held {t.held} · In {t.inHouse}
                    {t.confirmed > 0 ? ` · Conf ${t.confirmed}` : ""}
                  </p>
                </div>
                <p className="text-sm font-semibold tabular-nums">
                  {formatNu(t.rateBtn)}
                  <span className="ml-1 text-xs font-normal text-muted-foreground">
                    /night
                  </span>
                </p>
              </li>
            ))}
          </ul>

          <div className="sticky bottom-16 z-10 flex gap-2 md:bottom-4">
            <Button
              asChild
              size="lg"
              className="flex-1"
              disabled={!answer.yes}
            >
              <Link href={reserveHref}>Reserve</Link>
            </Button>
            <Button
              type="button"
              size="lg"
              variant="secondary"
              className="flex-1"
              disabled={!answer.yes}
              onClick={() => router.push(reserveHref)}
            >
              Enter →
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
