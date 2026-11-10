"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { DownloadIcon, PrinterIcon, SearchIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

export type AgentStaysPreset =
  | "all"
  | "season"
  | "arriving"
  | "pending"
  | "custom";

const PRESETS: { id: AgentStaysPreset; label: string }[] = [
  { id: "all", label: "All time" },
  { id: "season", label: "Current season" },
  { id: "arriving", label: "Arriving this week" },
  { id: "pending", label: "Pending payment" },
];

export function AgentStaysFilterToolbar({
  from,
  to,
  preset,
  search,
  boundsFrom,
  boundsTo,
  seasonFrom,
  seasonTo,
  weekFrom,
  weekTo,
  exportHref,
  printHref,
  className,
}: {
  from: string;
  to: string;
  preset: AgentStaysPreset;
  search: string;
  boundsFrom: string | null;
  boundsTo: string | null;
  seasonFrom: string;
  seasonTo: string;
  weekFrom: string;
  weekTo: string;
  exportHref: string;
  printHref: string;
  className?: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function push(next: {
    from?: string;
    to?: string;
    preset?: AgentStaysPreset;
    q?: string;
    tab?: string;
  }) {
    const params = new URLSearchParams();
    params.set("tab", "bookings");
    const p = next.preset ?? preset;
    params.set("preset", p);
    const f = next.from ?? from;
    const t = next.to ?? to;
    if (f) params.set("from", f);
    if (t) params.set("to", t);
    const q = next.q ?? search;
    if (q.trim()) params.set("q", q.trim());
    start(() => {
      router.push(`/agents/app/stays?${params.toString()}`);
    });
  }

  return (
    <div
      className={cn(
        "neo-card flex flex-col gap-3 p-3 sm:p-4",
        className,
      )}
    >
      <div className="flex flex-wrap gap-1.5">
        {PRESETS.map((chip) => (
          <button
            key={chip.id}
            type="button"
            disabled={pending}
            onClick={() => {
              if (chip.id === "all") {
                push({
                  preset: "all",
                  from: boundsFrom ?? from,
                  to: boundsTo ?? to,
                });
              } else if (chip.id === "season") {
                push({
                  preset: "season",
                  from: seasonFrom,
                  to: seasonTo,
                });
              } else if (chip.id === "arriving") {
                push({
                  preset: "arriving",
                  from: weekFrom,
                  to: weekTo,
                });
              } else {
                push({ preset: "pending" });
              }
            }}
            className={cn(
              "h-8 rounded-full border px-3 text-xs font-medium transition-colors",
              preset === chip.id
                ? "border-sky-600/40 bg-sky-600 text-white"
                : "border-border bg-background text-muted-foreground hover:bg-secondary hover:text-foreground",
            )}
          >
            {chip.label}
          </button>
        ))}
      </div>

      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          push({
            preset: "custom",
            from: String(fd.get("from") ?? from),
            to: String(fd.get("to") ?? to),
            q: String(fd.get("q") ?? ""),
          });
        }}
      >
        <label className="text-xs text-muted-foreground">
          From
          <Input
            name="from"
            type="date"
            defaultValue={from}
            className="mt-1 h-9 w-[10.5rem] bg-background"
          />
        </label>
        <label className="text-xs text-muted-foreground">
          To
          <Input
            name="to"
            type="date"
            defaultValue={to}
            className="mt-1 h-9 w-[10.5rem] bg-background"
          />
        </label>
        <label className="min-w-[12rem] flex-1 text-xs text-muted-foreground">
          Search
          <div className="relative mt-1">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              name="q"
              defaultValue={search}
              placeholder="Guest, guide, ref…"
              className="h-9 bg-background pl-8"
            />
          </div>
        </label>
        <Button type="submit" size="sm" className="h-9" disabled={pending}>
          Apply
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-9"
          disabled={pending || !boundsFrom || !boundsTo}
          onClick={() =>
            push({
              preset: "all",
              from: boundsFrom ?? from,
              to: boundsTo ?? to,
              q: "",
            })
          }
        >
          Reset
        </Button>
        <div className="ml-auto flex flex-wrap gap-1.5">
          <Button asChild size="sm" variant="outline" className="h-9">
            <a href={exportHref}>
              <DownloadIcon className="size-3.5" />
              Excel
            </a>
          </Button>
          <Button asChild size="sm" variant="outline" className="h-9">
            <a href={printHref} target="_blank" rel="noreferrer">
              <PrinterIcon className="size-3.5" />
              Print
            </a>
          </Button>
        </div>
      </form>
    </div>
  );
}
