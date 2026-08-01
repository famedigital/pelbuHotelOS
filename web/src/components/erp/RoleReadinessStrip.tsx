import type { ReadinessTile, ReadinessTone } from "@/lib/erp/readiness";
import Link from "next/link";

const toneStyles: Record<
  ReadinessTone,
  { ring: string; dot: string; bg: string }
> = {
  green: {
    ring: "border-citrus/40",
    dot: "bg-citrus",
    bg: "bg-citrus-tint/40",
  },
  amber: {
    ring: "border-amber-400/50",
    dot: "bg-amber-500",
    bg: "bg-amber-50 dark:bg-amber-950/30",
  },
  red: {
    ring: "border-destructive/40",
    dot: "bg-destructive",
    bg: "bg-destructive/5",
  },
};

export function RoleReadinessStrip({ tiles }: { tiles: ReadinessTile[] }) {
  return (
    <section
      className="grid grid-cols-1 gap-4 lg:grid-cols-3"
      aria-label="Department readiness"
    >
      {tiles.map((tile) => {
        const style = toneStyles[tile.tone];
        return (
          <Link
            key={tile.role}
            href={tile.href}
            className={`group block rounded-xl border p-4 outline-none transition-colors hover:border-accent/40 focus-visible:ring-[3px] focus-visible:ring-ring/40 ${style.ring} ${style.bg}`}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-[10px] font-semibold tracking-[0.16em] text-muted-foreground uppercase">
                  {tile.label}
                </p>
                <p className="mt-1 text-sm font-medium text-foreground">
                  {tile.summary}
                </p>
              </div>
              <span
                className={`mt-1 size-2.5 shrink-0 rounded-full ${style.dot}`}
                aria-hidden
              />
            </div>
            <ul className="mt-3 space-y-1">
              {tile.items.slice(0, 4).map((item) => (
                <li
                  key={item.label}
                  className={`text-xs ${item.ok ? "text-muted-foreground" : "font-medium text-foreground"}`}
                >
                  {item.ok ? "✓" : "○"} {item.label}
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-accent opacity-0 transition-opacity group-hover:opacity-100">
              Open →
            </p>
          </Link>
        );
      })}
    </section>
  );
}
