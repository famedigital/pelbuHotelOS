"use client";

import type { RoomOption } from "@/app/actions/bookings";
import { formatBtn } from "@/lib/pricing";

type Props = {
  options: RoomOption[];
  selectedCode: string | null;
  onSelect: (code: string) => void;
  loading: boolean;
  error: string | null;
  nights: number;
  rooms: number;
};

export function BookingStepRoom({
  options,
  selectedCode,
  onSelect,
  loading,
  error,
  nights,
  rooms,
}: Props) {
  if (loading) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Checking live availability…
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {[0, 1].map((i) => (
            <div
              key={i}
              className="h-36 animate-pulse border border-paper-3 bg-paper-1"
              aria-hidden="true"
            />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <p
        className="border border-maroon/30 bg-maroon/5 px-4 py-3 text-sm text-maroon"
        role="alert"
      >
        {error}
      </p>
    );
  }

  if (!options.length) {
    return (
      <p className="text-sm text-muted-foreground">
        No rooms configured. Please call the desk.
      </p>
    );
  }

  const anyAvailable = options.some((o) => o.available);

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Pick a room type. Live public rate for {nights} night
        {nights === 1 ? "" : "s"}
        {" · "}
        {rooms} room{rooms === 1 ? "" : "s"}.
      </p>

      {!anyAvailable ? (
        <p className="border border-maroon/30 bg-maroon/5 px-4 py-3 text-sm text-maroon">
          Nothing available for those dates. Try different dates or fewer rooms.
        </p>
      ) : null}

      <div
        className="grid grid-cols-1 gap-3 sm:grid-cols-2"
        role="radiogroup"
        aria-label="Room type"
      >
        {options.map((o) => {
          const selected = selectedCode === o.code;
          return (
            <label
              key={o.roomTypeId}
              className={[
                "relative flex cursor-pointer flex-col gap-2 border bg-card px-5 py-5 text-sm transition-all duration-150",
                selected
                  ? "border-ink shadow-[inset_0_0_0_1px_var(--ink)]"
                  : "border-paper-3 hover:border-ink/40",
                o.available ? "" : "cursor-not-allowed opacity-50",
              ].join(" ")}
            >
              <input
                type="radio"
                name="room_type_code"
                value={o.code}
                checked={selected}
                disabled={!o.available}
                onChange={() => onSelect(o.code)}
                className="sr-only"
              />
              <span className="flex items-baseline justify-between gap-2">
                <span className="font-display text-base text-ink">{o.name}</span>
                {o.available ? (
                  <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-brass">
                    {o.remaining} left
                  </span>
                ) : (
                  <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-maroon">
                    Sold out
                  </span>
                )}
              </span>
              <span className="text-muted-foreground">
                {o.perNightBtn == null
                  ? "Rate on request"
                  : `${formatBtn(o.perNightBtn)} / night`}
              </span>
              <span className="mt-1 text-lg font-semibold tabular-nums text-ink">
                {o.totalBtn == null ? "—" : formatBtn(o.totalBtn)}
                <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                  total
                </span>
              </span>
              {selected ? (
                <span
                  aria-hidden
                  className="absolute right-4 top-4 inline-flex h-2 w-2 rounded-full bg-brass"
                />
              ) : null}
            </label>
          );
        })}
      </div>

      <input type="hidden" name="room_type_code" value={selectedCode ?? ""} />
    </div>
  );
}
