"use client";

import { deskLogout } from "@/app/actions/desk";
import { ERP_MODULES, NAV_SECTIONS } from "@/lib/erp-nav";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import {
  BedDoubleIcon,
  CalendarDaysIcon,
  EllipsisIcon,
  ShoppingCartIcon,
  SparklesIcon,
} from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { usePathname } from "next/navigation";

const PRIMARY_ITEMS = [
  {
    title: "Calendar",
    href: "/erp/calendar",
    icon: CalendarDaysIcon,
    moduleKey: "calendar",
  },
  {
    title: "Book",
    href: "/erp/fast-book",
    icon: SparklesIcon,
    moduleKey: "front-desk",
  },
  {
    title: "Stay",
    href: "/erp/in-house",
    icon: BedDoubleIcon,
    moduleKey: "front-desk",
  },
  {
    title: "POS",
    href: "/erp/pos",
    icon: ShoppingCartIcon,
    moduleKey: "pos",
  },
] as const;

function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function DeskMobileNav({
  allowedModuleKeys,
}: {
  allowedModuleKeys?: readonly string[];
} = {}) {
  const pathname = usePathname();
  const allow = useMemo(() => {
    if (!allowedModuleKeys || allowedModuleKeys.length === 0) return null;
    return new Set(allowedModuleKeys);
  }, [allowedModuleKeys]);

  const primary = PRIMARY_ITEMS.filter(
    (item) => !allow || allow.has(item.moduleKey),
  );
  const sections = useMemo(() => {
    if (!allow) return NAV_SECTIONS;
    return ERP_MODULES.filter((m) => allow.has(m.key)).map((m) => ({
      label: m.title,
      items: m.tabs,
    }));
  }, [allow]);

  return (
    <nav
      aria-label="Desk navigation"
      data-slot="desk-mobile-nav"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border/80 bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
    >
      <div
        className="grid h-16"
        style={{
          gridTemplateColumns: `repeat(${Math.max(primary.length + 1, 2)}, minmax(0, 1fr))`,
        }}
      >
        {primary.map((item) => {
          const active = isActive(pathname, item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative flex min-h-11 flex-col items-center justify-center gap-1 text-[11px] font-medium text-muted-foreground",
                active && "text-primary",
              )}
            >
              <Icon className="size-5" strokeWidth={active ? 2.4 : 1.8} />
              <span>{item.title}</span>
              {active ? (
                <span
                  aria-hidden
                  className="absolute inset-x-5 bottom-0 h-0.5 rounded-full bg-primary"
                />
              ) : null}
            </Link>
          );
        })}

        <Sheet>
          <SheetTrigger asChild>
            <button
              type="button"
              className="flex min-h-11 flex-col items-center justify-center gap-1 text-[11px] font-medium text-muted-foreground"
            >
              <EllipsisIcon className="size-5" />
              <span>More</span>
            </button>
          </SheetTrigger>
          <SheetContent
            side="bottom"
            className="max-h-[88dvh] rounded-t-3xl pb-[env(safe-area-inset-bottom)]"
          >
            <SheetHeader className="text-left">
              <SheetTitle>Pelbu desk</SheetTitle>
              <SheetDescription>
                Tools available on your desk account.
              </SheetDescription>
            </SheetHeader>
            <div className="overflow-y-auto px-4 pb-5">
              {sections.map((section) => (
                <section key={section.label} className="mb-5">
                  <h2 className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    {section.label}
                  </h2>
                  <div className="grid grid-cols-2 gap-2">
                    {section.items.map((item) => {
                      const Icon = item.icon;
                      const active = isActive(pathname, item.href);
                      return (
                        <SheetClose asChild key={item.href}>
                          <Link
                            href={item.href}
                            className={cn(
                              "flex min-h-12 items-center gap-3 rounded-xl border border-border bg-card px-3 text-sm",
                              active && "border-primary/40 bg-primary/5",
                            )}
                          >
                            <Icon className="size-4 shrink-0" />
                            <span className="truncate">{item.title}</span>
                          </Link>
                        </SheetClose>
                      );
                    })}
                  </div>
                </section>
              ))}
              <form action={deskLogout}>
                <button
                  type="submit"
                  className="min-h-12 w-full rounded-xl border border-border px-4 text-sm font-medium"
                >
                  Sign out
                </button>
              </form>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </nav>
  );
}
