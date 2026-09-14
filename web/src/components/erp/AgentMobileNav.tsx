"use client";

import { agentLogout } from "@/app/actions/agent-auth";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import {
  CalendarDaysIcon,
  EllipsisIcon,
  PlusCircleIcon,
  UserRoundIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/agents/app/book", label: "Book", icon: PlusCircleIcon },
  { href: "/agents/app/calendar", label: "Calendar", icon: CalendarDaysIcon },
  { href: "/agents/app", label: "Account", icon: UserRoundIcon, exact: true },
] as const;

function isActive(pathname: string, href: string, exact?: boolean): boolean {
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AgentMobileNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Agent navigation"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border/80 bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
    >
      <div className="mx-auto grid h-16 max-w-md grid-cols-4">
        {ITEMS.map((tab) => {
          const active = isActive(
            pathname,
            tab.href,
            "exact" in tab ? Boolean(tab.exact) : false,
          );
          const Icon = tab.icon;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative flex min-h-11 flex-col items-center justify-center gap-1 text-[11px] font-medium text-muted-foreground",
                active && "text-primary",
              )}
            >
              <Icon className="size-5" strokeWidth={active ? 2.4 : 1.8} />
              <span>{tab.label}</span>
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
            className="rounded-t-3xl pb-[env(safe-area-inset-bottom)]"
          >
            <SheetHeader className="text-left">
              <SheetTitle>Partner tools</SheetTitle>
            </SheetHeader>
            <div className="space-y-2 px-4 pb-5">
              <SheetClose asChild>
                <Link
                  href="/agents/app"
                  className="flex min-h-12 items-center gap-3 rounded-xl border border-border px-4 text-sm"
                >
                  <UserRoundIcon className="size-4" />
                  Account
                </Link>
              </SheetClose>
              <form action={agentLogout}>
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
