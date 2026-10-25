"use client";

import { cn } from "@/lib/utils";

const PAPERS = [
  { id: "room", label: "Room" },
  { id: "fnb", label: "Food" },
  { id: "master", label: "Master" },
  { id: "group", label: "Group" },
] as const;

export type FolioPrintChoice = (typeof PAPERS)[number]["id"];

/** Top bar: open this stay as room, food, master, or all three together. */
export function FolioPrintToolbar({
  folioId,
  active,
}: {
  folioId: string;
  active: FolioPrintChoice;
}) {
  return (
    <nav aria-label="Which paper to print" className="flex shrink-0 items-center gap-1">
      {PAPERS.map((paper) => {
        const href =
          paper.id === "group"
            ? `/erp/folios/${folioId}/bill?pack=stay`
            : `/erp/folios/${folioId}/bill?bill=${paper.id}`;
        const on = active === paper.id;
        return (
          <a
            key={paper.id}
            href={href}
            aria-current={on ? "page" : undefined}
            className={cn(
              "inline-flex h-8 items-center rounded-md border px-2.5 text-xs font-semibold",
              on
                ? "border-[#1a1410] bg-[#1a1410] text-[#f6f1ea]"
                : "border-input bg-card text-foreground hover:bg-muted",
            )}
          >
            {paper.label}
          </a>
        );
      })}
    </nav>
  );
}
