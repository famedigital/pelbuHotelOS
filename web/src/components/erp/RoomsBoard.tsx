"use client";

import {
  bulkRequestRoomService,
  type OpsState,
} from "@/app/actions/erp-hk";
import { RoomHkButtons } from "@/components/erp/OpsForms";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useActionState, useMemo, useState } from "react";

export type RoomBoardUnit = {
  id: string;
  label: string;
  hk_status: string;
  floor_label: string | null;
  notes: string | null;
  room_type_name: string;
  is_comp: boolean;
  service_requested_at: string | null;
};

const initial: OpsState = { ok: false };

export function RoomsBoard({ units }: { units: RoomBoardUnit[] }) {
  const [view, setView] = useState<"card" | "table">("card");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [state, action, pending] = useActionState(bulkRequestRoomService, initial);

  const dirtyUnits = useMemo(
    () => units.filter((u) => u.hk_status === "dirty" || u.service_requested_at),
    [units],
  );

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectDirty() {
    setSelected(new Set(dirtyUnits.map((u) => u.id)));
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-md border bg-card p-0.5">
          <Button
            type="button"
            size="sm"
            variant={view === "card" ? "citrus" : "ghost"}
            onClick={() => setView("card")}
          >
            Cards
          </Button>
          <Button
            type="button"
            size="sm"
            variant={view === "table" ? "citrus" : "ghost"}
            onClick={() => setView("table")}
          >
            Table
          </Button>
        </div>
        <Button type="button" size="sm" variant="outline" onClick={selectDirty}>
          Select dirty / requested
        </Button>
        <form action={action} className="inline-flex items-center gap-2">
          {Array.from(selected).map((id) => (
            <input key={id} type="hidden" name="room_unit_ids" value={id} />
          ))}
          <Button type="submit" size="sm" disabled={pending || selected.size === 0}>
            {pending ? "Requesting…" : `Request service (${selected.size})`}
          </Button>
        </form>
        {state.message ? (
          <p className="text-sm text-foreground">{state.message}</p>
        ) : null}
        {state.error ? (
          <p className="text-sm text-destructive" role="alert">
            {state.error}
          </p>
        ) : null}
      </div>

      {view === "card" ? (
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {units.map((u) => (
            <Card key={u.id} className={selected.has(u.id) ? "ring-2 ring-accent" : ""}>
              <CardContent className="space-y-2">
                <label className="flex cursor-pointer items-start gap-2">
                  <input
                    type="checkbox"
                    checked={selected.has(u.id)}
                    onChange={() => toggle(u.id)}
                    className="mt-1 size-4 accent-accent"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="font-mono text-sm font-medium">{u.label}</span>
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-accent">
                        {u.hk_status}
                      </span>
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {u.room_type_name}
                      {u.is_comp ? " · comp" : ""}
                    </span>
                    {u.service_requested_at ? (
                      <span className="mt-1 block text-[11px] font-medium text-violet-700 dark:text-violet-300">
                        Service requested
                      </span>
                    ) : null}
                  </span>
                </label>
                <RoomHkButtons unitId={u.id} current={u.hk_status} />
              </CardContent>
            </Card>
          ))}
        </section>
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-card">
          <table className="min-w-[720px] w-full text-sm">
            <thead className="bg-muted/40">
              <tr>
                {["", "Room", "Type", "HK", "Service", ""].map((h) => (
                  <th
                    key={h || "sel"}
                    scope="col"
                    className="h-10 px-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {units.map((u) => (
                <tr key={u.id} className="border-t">
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={selected.has(u.id)}
                      onChange={() => toggle(u.id)}
                      className="size-4 accent-accent"
                    />
                  </td>
                  <td className="px-3 py-2 font-mono font-medium">{u.label}</td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {u.room_type_name}
                  </td>
                  <td className="px-3 py-2 uppercase text-xs">{u.hk_status}</td>
                  <td className="px-3 py-2 text-xs">
                    {u.service_requested_at ? "Requested" : "—"}
                  </td>
                  <td className="px-3 py-2">
                    <RoomHkButtons unitId={u.id} current={u.hk_status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
