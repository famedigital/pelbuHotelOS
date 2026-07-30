"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const TABS = [
  { href: "/erp/arrivals", label: "Arrivals" },
  { href: "/erp/in-house", label: "In-house" },
  { href: "/erp/departures", label: "Departures" },
];

export function BoardTabs() {
  const pathname = usePathname();
  return (
    <nav className="erp flex flex-wrap gap-1 text-sm" aria-label="Board switch">
      {TABS.map((t) => {
        const active = pathname === t.href;
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "inline-flex h-9 items-center rounded-md px-3 transition-colors",
              active
                ? "bg-primary text-primary-foreground"
                : "border border-input text-foreground hover:bg-muted",
            )}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
