"use client";

import { agentLogout } from "@/app/actions/agent-auth";
import { cn } from "@/lib/utils";
import { CalendarDaysIcon, PlusCircleIcon, UserRoundIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

type AgentTab = {
  href: string;
  label: string;
  icon: typeof CalendarDaysIcon;
  exact?: boolean;
};

const TABS: AgentTab[] = [
  { href: "/agents/app/book", label: "Book", icon: PlusCircleIcon },
  { href: "/agents/app/calendar", label: "Calendar", icon: CalendarDaysIcon },
  { href: "/agents/app", label: "Account", icon: UserRoundIcon, exact: true },
];

function isActive(pathname: string, href: string, exact?: boolean): boolean {
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AgentAppShell({
  companyName,
  children,
}: {
  companyName: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <header className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-3 px-4 py-3">
          <div>
            <p className="text-xs font-semibold tracking-[0.18em] text-accent uppercase">
              Partner
            </p>
            <p className="truncate text-sm font-medium">{companyName}</p>
          </div>
          <form action={agentLogout}>
            <button
              type="submit"
              className="hidden h-9 items-center rounded-md border border-border px-3 text-sm md:inline-flex"
            >
              Sign out
            </button>
          </form>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl px-4 py-6 pb-[calc(5.5rem+env(safe-area-inset-bottom))]">
        {children}
      </main>

      <nav
        aria-label="Agent navigation"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border/80 bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur"
      >
        <div className="mx-auto grid h-16 max-w-md grid-cols-3">
          {TABS.map((tab) => {
            const active = isActive(pathname, tab.href, tab.exact);
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
                    className="absolute inset-x-6 bottom-0 h-0.5 rounded-full bg-primary"
                  />
                ) : null}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
