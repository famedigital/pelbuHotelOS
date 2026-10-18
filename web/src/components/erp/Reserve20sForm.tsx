"use client";

import {
  createFastBooking,
  type FastBookState,
} from "@/app/actions/fast-book";
import { FoRateSheetSelect } from "@/components/erp/FoRateSheetSelect";
import { defaultFoRateTier } from "@/lib/ask/fo-rate-sheet";
import type { RateTier } from "@/lib/rates";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useMemo, useState } from "react";

export type ReserveRoomType = {
  code: string;
  name: string;
  unit_count: number;
};

export type ReserveAgent = {
  id: string;
  company_name: string;
  rate_tier: string | null;
};

function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

function todayIso(): string {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
}

const initial: FastBookState = { ok: false };

/**
 * 20s Reserve — Who · When · What · Rate · Hold / CI.
 * Posts to createFastBooking (assign later by default).
 */
export function Reserve20sForm({
  roomTypes,
  agents,
  defaults,
}: {
  roomTypes: ReserveRoomType[];
  agents: ReserveAgent[];
  defaults: {
    checkIn?: string;
    checkOut?: string;
    rooms?: number;
    rateTier?: string;
    roomTypeCode?: string;
    contactName?: string;
  };
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState(createFastBooking, initial);

  const [who, setWho] = useState<"guest" | "agent">(
    defaults.contactName ? "guest" : "guest",
  );
  const [agentId, setAgentId] = useState("");
  const [name, setName] = useState(defaults.contactName ?? "");
  const [whenMode, setWhenMode] = useState<"tonight" | "tomorrow" | "custom">(
    defaults.checkIn ? "custom" : "tonight",
  );
  const [checkIn, setCheckIn] = useState(defaults.checkIn ?? todayIso());
  const [nights, setNights] = useState(() => {
    if (defaults.checkIn && defaults.checkOut) {
      const a = Date.parse(`${defaults.checkIn}T00:00:00Z`);
      const b = Date.parse(`${defaults.checkOut}T00:00:00Z`);
      return Math.max(1, Math.round((b - a) / 86_400_000));
    }
    return 1;
  });
  const [roomCode, setRoomCode] = useState(
    defaults.roomTypeCode ?? roomTypes[0]?.code ?? "",
  );
  const [qty, setQty] = useState(defaults.rooms ?? 1);
  const [rateTier, setRateTier] = useState<RateTier | "custom">(() => {
    if (defaults.rateTier && defaults.rateTier !== "custom") {
      return defaults.rateTier as RateTier;
    }
    return defaultFoRateTier(false);
  });
  const [customRate, setCustomRate] = useState("");
  const [managerPin, setManagerPin] = useState("");
  const [intent, setIntent] = useState<"reserve" | "confirm">("reserve");

  useEffect(() => {
    if (whenMode === "tonight") setCheckIn(todayIso());
    if (whenMode === "tomorrow") setCheckIn(addDays(todayIso(), 1));
  }, [whenMode]);

  const checkOut = useMemo(() => addDays(checkIn, nights), [checkIn, nights]);

  useEffect(() => {
    if (!state.ok || !state.bookingId) return;
    router.push(`/erp/reservations?highlight=${state.bookingId}`);
  }, [state, router]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      if (e.key === "Enter" && e.shiftKey) {
        e.preventDefault();
        setIntent("confirm");
        (
          document.getElementById("fo-reserve-form") as HTMLFormElement | null
        )?.requestSubmit();
      } else if (e.key === "Enter") {
        e.preventDefault();
        setIntent("reserve");
        (
          document.getElementById("fo-reserve-form") as HTMLFormElement | null
        )?.requestSubmit();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const selectedAgent = agents.find((a) => a.id === agentId);
  const effectiveTier: RateTier =
    rateTier === "custom"
      ? defaultFoRateTier(Boolean(agentId))
      : rateTier;

  return (
    <form
      id="fo-reserve-form"
      action={action}
      className="mx-auto flex w-full max-w-xl flex-col gap-4"
    >
      <input type="hidden" name="intent" value={intent} />
      <input type="hidden" name="source" value={agentId ? "agent" : "reservation"} />
      <input type="hidden" name="check_in" value={checkIn} />
      <input type="hidden" name="check_out" value={checkOut} />
      <input type="hidden" name="adults" value={Math.max(qty * 2, 1)} />
      <input type="hidden" name="children" value="0" />
      <input type="hidden" name="extra_beds" value="0" />
      <input type="hidden" name="meal_plan_code" value="EP" />
      <input type="hidden" name="guest_origin" value="international" />
      <input type="hidden" name="guest_details_later" value="1" />
      <input type="hidden" name="phone_later" value="1" />
      <input type="hidden" name="payment_mode" value="cash" />
      <input type="hidden" name="rate_tier" value={effectiveTier} />
      {agentId ? <input type="hidden" name="agent_id" value={agentId} /> : null}
      {roomTypes.map((rt) => (
        <input
          key={rt.code}
          type="hidden"
          name={`qty_${rt.code}`}
          value={rt.code === roomCode ? String(qty) : "0"}
        />
      ))}
      {rateTier === "custom" && customRate ? (
        <>
          <input type="hidden" name="agreed_nightly_rate_btn" value={customRate} />
          <input type="hidden" name="rate_request_reason" value="FO custom 20s" />
          {managerPin ? (
            <input type="hidden" name="manager_pin" value={managerPin} />
          ) : null}
        </>
      ) : null}

      <section className="rounded-xl border border-border bg-card p-4 shadow-sm">
        <p className="mb-2 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
          1 · Who
        </p>
        <div className="mb-2 flex gap-1">
          {(
            [
              ["guest", "Guest"],
              ["agent", "Agent"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setWho(id)}
              className={cn(
                "h-8 rounded-md px-3 text-xs font-medium",
                who === id
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-muted",
              )}
            >
              {label}
            </button>
          ))}
        </div>
        {who === "agent" ? (
          <select
            className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={agentId}
            onChange={(e) => {
              const id = e.target.value;
              setAgentId(id);
              const a = agents.find((x) => x.id === id);
              if (a?.rate_tier) {
                setRateTier(
                  (a.rate_tier as RateTier) === "mou_agents"
                    ? "mou_agents"
                    : "agents",
                );
              } else {
                setRateTier("agents");
              }
              if (!name.trim() && a) setName(a.company_name);
            }}
            required
          >
            <option value="">Select agent…</option>
            {agents.map((a) => (
              <option key={a.id} value={a.id}>
                {a.company_name}
              </option>
            ))}
          </select>
        ) : null}
        <Input
          name="contact_name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={who === "agent" ? "Guest / party name" : "Guest name"}
          className="mt-2 h-11"
          required
          autoFocus
        />
      </section>

      <section className="rounded-xl border border-border bg-card p-4 shadow-sm">
        <p className="mb-2 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
          2 · When
        </p>
        <div className="mb-2 flex flex-wrap gap-1">
          {(
            [
              ["tonight", "Tonight"],
              ["tomorrow", "Tomorrow"],
              ["custom", "Custom"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setWhenMode(id)}
              className={cn(
                "h-8 rounded-md px-3 text-xs font-medium",
                whenMode === id
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-muted",
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs text-muted-foreground">Check-in</label>
            <Input
              type="date"
              value={checkIn}
              onChange={(e) => {
                setWhenMode("custom");
                setCheckIn(e.target.value);
              }}
              className="h-11"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Nights</label>
            <Input
              type="number"
              min={1}
              max={60}
              value={nights}
              onChange={(e) =>
                setNights(Math.max(1, Number(e.target.value) || 1))
              }
              className="h-11"
            />
          </div>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Out {checkOut}
          {selectedAgent ? ` · ${selectedAgent.company_name}` : ""}
        </p>
      </section>

      <section className="rounded-xl border border-border bg-card p-4 shadow-sm">
        <p className="mb-2 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
          3 · What · assign later
        </p>
        <div className="grid grid-cols-[1fr_5rem] gap-2">
          <select
            className="h-11 rounded-md border border-input bg-background px-3 text-sm"
            value={roomCode}
            onChange={(e) => setRoomCode(e.target.value)}
          >
            {roomTypes.map((rt) => (
              <option key={rt.code} value={rt.code}>
                {rt.name} ({rt.unit_count})
              </option>
            ))}
          </select>
          <Input
            type="number"
            min={1}
            max={20}
            value={qty}
            onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))}
            className="h-11"
            aria-label="Quantity"
          />
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-4 shadow-sm">
        <p className="mb-2 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
          4 · Rate
        </p>
        <FoRateSheetSelect value={rateTier} onChange={setRateTier} />
        {rateTier === "custom" ? (
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <Input
              type="number"
              min={0}
              step="1"
              placeholder="Custom Nu / night"
              value={customRate}
              onChange={(e) => setCustomRate(e.target.value)}
              className="h-11"
              required
            />
            <Input
              type="password"
              inputMode="numeric"
              placeholder="Manager PIN"
              value={managerPin}
              onChange={(e) => setManagerPin(e.target.value)}
              className="h-11"
              autoComplete="off"
            />
          </div>
        ) : null}
      </section>

      {state.error ? (
        <p className="rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {state.error}
        </p>
      ) : null}
      {state.ok && state.confirmationCode ? (
        <p className="rounded-lg border border-emerald-600/30 bg-emerald-500/10 px-3 py-2 text-sm">
          Saved {state.confirmationCode}
          {state.ratePendingApproval ? " · rate pending GM" : ""}
        </p>
      ) : null}

      <div className="sticky bottom-16 z-10 flex gap-2 md:bottom-4">
        <Button
          type="submit"
          size="lg"
          className="flex-1"
          disabled={pending}
          onClick={() => setIntent("reserve")}
        >
          {pending && intent === "reserve" ? "…" : "Hold"}
        </Button>
        <Button
          type="submit"
          size="lg"
          variant="secondary"
          className="flex-1"
          disabled={pending}
          onClick={() => setIntent("confirm")}
        >
          {pending && intent === "confirm" ? "…" : "Check in now"}
        </Button>
      </div>
      <p className="text-center text-[11px] text-muted-foreground">
        Ctrl+Enter Hold · Ctrl+Shift+Enter CI
      </p>
    </form>
  );
}
