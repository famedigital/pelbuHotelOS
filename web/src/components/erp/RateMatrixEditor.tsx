"use client";

import {
  upsertRoomRate,
  type ErpAgentState,
  type RateMatrixRow,
  type RoomTypeLite,
} from "@/app/actions/erp-agents";
import { formatBtn } from "@/lib/pricing";
import { useActionState, useState } from "react";

const SEASONS = ["peak", "lean", "off"] as const;
const TIERS = [
  "public",
  "agents",
  "mou_agents",
  "friends",
  "family",
  "mutual_friends",
] as const;

const initial: ErpAgentState = { ok: false };

function findByKey(
  rows: RateMatrixRow[],
  roomTypeId: string,
  season: string,
  tier: string,
): RateMatrixRow | undefined {
  return rows.find(
    (r) =>
      r.room_type_id === roomTypeId &&
      r.season_kind === season &&
      r.rate_tier === tier,
  );
}

function EditorCell({
  row,
  label,
}: {
  row: RateMatrixRow;
  label: string;
}) {
  const [draft, setDraft] = useState<string>(
    row.amount_btn ? String(row.amount_btn) : "",
  );
  const [lastSaved, setLastSaved] = useState<number | null>(row.amount_btn ?? null);
  const [state, action, pending] = useActionState(upsertRoomRate, initial);

  const dirty = Number(draft) !== (lastSaved ?? 0) && draft !== "";

  return (
    <td className="border-b px-2 py-1.5 align-top">
      <form action={action} className="flex flex-col gap-1">
        <input type="hidden" name="room_type_id" value={row.room_type_id} />
        <input type="hidden" name="season_kind" value={row.season_kind} />
        <input type="hidden" name="rate_tier" value={row.rate_tier} />
        <label className="sr-only" htmlFor={`${label}-amount`}>
          {label}
        </label>
        <div className="flex items-stretch">
          <span className="inline-flex items-center rounded-l-md border border-r-0 border-input bg-muted px-2 text-xs text-muted-foreground">
            Nu
          </span>
          <input
            id={`${label}-amount`}
            name="amount_btn"
            type="number"
            inputMode="numeric"
            step="0.01"
            min={0}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="—"
            className="w-24 rounded-r-md border border-input bg-background px-2 py-1.5 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
          />
        </div>
        <button
          type="submit"
          disabled={pending || !dirty}
          className="self-start rounded-md border border-input px-2 py-1 text-[11px] tracking-wide text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
        >
          {pending ? "Saving…" : dirty ? "Save" : lastSaved ? "Saved" : "Add"}
        </button>
        {state?.ok && dirty === false ? (
          <span className="text-[10px] text-muted-foreground">{state.message}</span>
        ) : state?.error ? (
          <span className="text-[10px] text-destructive">{state.error}</span>
        ) : lastSaved ? (
          <span className="text-[10px] text-muted-foreground">
            now {formatBtn(lastSaved)}
          </span>
        ) : null}
      </form>
    </td>
  );
}

export function RateMatrixEditor({
  rows,
  roomTypes,
}: {
  rows: RateMatrixRow[];
  roomTypes: RoomTypeLite[];
}) {
  const guestRooms = roomTypes.filter((r) => r.inventory_kind === "sellable_guest");

  if (guestRooms.length === 0) {
    return (
      <p className="erp rounded-lg border bg-card px-5 py-6 text-sm text-muted-foreground">
        No sellable guest room types configured. Seed room types first.
      </p>
    );
  }

  return (
    <div className="erp mt-4 overflow-x-auto rounded-lg border bg-card">
      <table className="min-w-full text-left text-sm">
        <thead className="border-b text-xs tracking-wide text-muted-foreground uppercase">
          <tr>
            <th className="px-4 py-3 font-medium">Room</th>
            <th className="px-3 py-3 font-medium">Season</th>
            {TIERS.map((tier) => (
              <th key={tier} className="px-2 py-3 text-center font-medium">
                {tier.replace(/_/g, " ")}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {guestRooms.map((rt) =>
            SEASONS.map((season) => (
              <tr key={`${rt.id}-${season}`} className="border-b last:border-0">
                <td className="px-4 py-2.5 align-top text-foreground">
                  {season === SEASONS[0] ? (
                    <span className="font-medium">{rt.name}</span>
                  ) : (
                    <span className="text-muted-foreground">↳</span>
                  )}
                </td>
                <td className="px-3 py-2.5 align-top text-foreground/80">
                  <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] tracking-wide">
                    {season}
                  </span>
                </td>
                {TIERS.map((tier) => {
                  const cell = findByKey(rows, rt.id, season, tier);
                  return (
                    <EditorCell
                      key={`${rt.id}-${season}-${tier}`}
                      label={`${rt.code}-${season}-${tier}`}
                      row={
                        cell ?? {
                          id: null,
                          room_type_id: rt.id,
                          room_type_name: rt.name,
                          season_kind: season,
                          rate_tier: tier,
                          amount_btn: 0,
                        }
                      }
                    />
                  );
                })}
              </tr>
            )),
          )}
        </tbody>
      </table>
    </div>
  );
}
