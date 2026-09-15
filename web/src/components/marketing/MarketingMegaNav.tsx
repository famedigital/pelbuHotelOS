"use client";

import {
  buildMarketingMegaMenu,
  type MarketingMegaSection,
} from "@/lib/marketing-mega-menu";
import { cn } from "@/lib/utils";
import { ChevronDownIcon, MenuIcon, XIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useState } from "react";

function sectionActive(pathname: string, section: MarketingMegaSection): boolean {
  if (section.href && (pathname === section.href || pathname.startsWith(`${section.href}/`))) {
    return true;
  }
  return (section.columns ?? []).some((col) =>
    col.items.some(
      (item) =>
        pathname === item.href || pathname.startsWith(`${item.href}/`),
    ),
  );
}

export function MarketingMegaNav({
  onHome = false,
}: {
  onHome?: boolean;
}) {
  const pathname = usePathname();
  const sections = buildMarketingMegaMenu();
  const [openLabel, setOpenLabel] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const panelId = useId();

  useEffect(() => {
    setOpenLabel(null);
    setMobileOpen(false);
  }, [pathname]);

  const linkMuted = onHome ? "text-white/80 hover:text-white" : "text-muted-foreground hover:text-foreground";
  const linkActive = onHome ? "text-white" : "text-foreground";

  return (
    <>
      <nav className="hidden items-center gap-1 lg:flex" aria-label="Primary">
        {sections.map((section) => {
          const active = sectionActive(pathname, section);
          const isOpen = openLabel === section.label;
          if (section.href && !section.columns?.length) {
            return (
              <Link
                key={section.label}
                href={section.href}
                className={cn(
                  "rounded-md px-3 py-2 text-sm transition-colors",
                  linkMuted,
                  active && linkActive,
                )}
              >
                {section.label}
              </Link>
            );
          }
          return (
            <div
              key={section.label}
              className="relative"
              onMouseEnter={() => setOpenLabel(section.label)}
              onMouseLeave={() => setOpenLabel(null)}
            >
              <button
                type="button"
                className={cn(
                  "inline-flex items-center gap-1 rounded-md px-3 py-2 text-sm transition-colors",
                  linkMuted,
                  (active || isOpen) && linkActive,
                )}
                aria-expanded={isOpen}
                aria-controls={`${panelId}-${section.label}`}
                onClick={() =>
                  setOpenLabel(isOpen ? null : section.label)
                }
              >
                {section.label}
                <ChevronDownIcon className="size-3.5 opacity-70" />
              </button>
              {isOpen && section.columns ? (
                <div
                  id={`${panelId}-${section.label}`}
                  className="absolute left-0 top-full z-40 pt-2"
                >
                  <div className="min-w-[28rem] rounded-xl border border-border bg-background p-5 shadow-lg">
                    <div
                      className={cn(
                        "grid gap-6",
                        section.columns.length > 1
                          ? "grid-cols-2"
                          : "grid-cols-1",
                      )}
                    >
                      {section.columns.map((col) => (
                        <div key={col.heading}>
                          <p className="text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
                            {col.heading}
                          </p>
                          <ul className="mt-3 space-y-2.5">
                            {col.items.map((item) => (
                              <li key={`${item.href}-${item.title}`}>
                                <Link
                                  href={item.href}
                                  className="block rounded-lg px-2 py-1.5 transition hover:bg-muted/70"
                                  onClick={() => setOpenLabel(null)}
                                >
                                  <span className="text-sm font-medium text-foreground">
                                    {item.title}
                                  </span>
                                  {item.description ? (
                                    <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">
                                      {item.description}
                                    </span>
                                  ) : null}
                                </Link>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
      </nav>

      <button
        type="button"
        className={cn(
          "inline-flex size-10 items-center justify-center rounded-md lg:hidden",
          onHome ? "text-white" : "text-foreground",
        )}
        aria-label={mobileOpen ? "Close menu" : "Open menu"}
        aria-expanded={mobileOpen}
        onClick={() => setMobileOpen((v) => !v)}
      >
        {mobileOpen ? (
          <XIcon className="size-5" />
        ) : (
          <MenuIcon className="size-5" />
        )}
      </button>

      {mobileOpen ? (
        <div className="absolute inset-x-0 top-full border-b border-border bg-background px-6 py-4 shadow-md lg:hidden">
          <div className="mx-auto max-w-6xl space-y-4">
            {sections.map((section) => (
              <div key={section.label} className="space-y-2">
                <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  {section.label}
                </p>
                <ul className="space-y-1">
                  {(section.columns ?? []).flatMap((col) =>
                    col.items.map((item) => (
                      <li key={`${section.label}-${item.href}-${item.title}`}>
                        <Link
                          href={item.href}
                          className="block rounded-md px-2 py-2 text-sm text-foreground hover:bg-muted"
                          onClick={() => setMobileOpen(false)}
                        >
                          {item.title}
                        </Link>
                      </li>
                    )),
                  )}
                  {section.href && !(section.columns?.length) ? (
                    <li>
                      <Link
                        href={section.href}
                        className="block rounded-md px-2 py-2 text-sm text-foreground hover:bg-muted"
                        onClick={() => setMobileOpen(false)}
                      >
                        {section.label}
                      </Link>
                    </li>
                  ) : null}
                </ul>
              </div>
            ))}
            <div className="flex gap-2 border-t border-border pt-3">
              <Link
                href="/login"
                className="flex-1 rounded-full bg-secondary px-3 py-2 text-center text-sm"
                onClick={() => setMobileOpen(false)}
              >
                Login
              </Link>
              <Link
                href="/demo"
                className="flex-1 rounded-full bg-cta px-3 py-2 text-center text-sm font-semibold"
                onClick={() => setMobileOpen(false)}
              >
                Book a demo
              </Link>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
