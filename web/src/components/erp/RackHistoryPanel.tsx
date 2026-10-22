"use client";

import {
  listRackHistory,
  restoreRackRevision,
  type RackHistoryRow,
} from "@/app/actions/rack-history";
import { Button } from "@/components/ui/button";
import { useState, useTransition } from "react";

function whenLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function RackHistoryPanel() {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<RackHistoryRow[]>([]);
  const [note, setNote] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function load() {
    start(async () => {
      try {
        setRows(await listRackHistory());
        setNote(null);
      } catch (e) {
        setNote(e instanceof Error ? e.message : "Could not load history.");
      }
    });
  }

  return (
    <div className="px-1">
      <Button
        type="button"
        size="sm"
        variant="ghost"
        className="h-8 px-2 text-xs"
        onClick={() => {
          const next = !open;
          setOpen(next);
          if (next) load();
        }}
      >
        History
      </Button>
      {open ? (
        <div className="mt-1 max-h-56 overflow-auto rounded-md border bg-card">
          {pending && rows.length === 0 ? (
            <p className="px-3 py-2 text-xs text-muted-foreground">Loading…</p>
          ) : null}
          {note ? (
            <p className="px-3 py-2 text-xs text-destructive">{note}</p>
          ) : null}
          {rows.length === 0 && !pending ? (
            <p className="px-3 py-2 text-xs text-muted-foreground">
              No saved versions yet. A snapshot is written before the next
              paint, move, or note edit.
            </p>
          ) : (
            <ul>
              {rows.map((row) => (
                <li
                  key={row.id}
                  className="flex items-center gap-2 border-b px-3 py-1.5 text-xs last:border-0"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-foreground">
                      {row.guest || "Stay"}
                      <span className="ml-1 font-normal text-muted-foreground">
                        {row.action === "rack.restore" ? "restored" : "saved"}
                      </span>
                    </p>
                    <p className="truncate text-muted-foreground">
                      {whenLabel(row.createdAt)} · {row.actor} · {row.summary}
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 shrink-0 px-2 text-[11px]"
                    disabled={pending}
                    onClick={() => {
                      start(async () => {
                        const result = await restoreRackRevision(row.id);
                        setNote(result.ok ? result.message : result.error);
                        if (result.ok) load();
                      });
                    }}
                  >
                    Restore
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
