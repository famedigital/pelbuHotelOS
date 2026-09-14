"use client";

import { agentLogout } from "@/app/actions/agent-auth";
import { AgentMobileNav } from "@/components/erp/AgentMobileNav";
import { Button } from "@/components/ui/button";
import { BRAND_ICONS } from "@/lib/brand";
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
        <div className="mx-auto flex w-full max-w-4xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={BRAND_ICONS.mark}
              alt=""
              width={32}
              height={32}
              className="size-8 shrink-0 rounded-md object-contain"
            />
            <div className="min-w-0">
              <p className="text-xs font-semibold tracking-[0.18em] text-accent uppercase">
                Pelbu Partner
              </p>
              <p className="truncate text-sm font-medium">{companyName}</p>
            </div>
          </div>
          <div className="hidden items-center gap-1 md:flex">
            {TABS.map((tab) => {
              const active = isActive(pathname, tab.href, tab.exact);
              return (
                <Button
                  key={tab.href}
                  asChild
                  variant="ghost"
                  size="sm"
                  className={cn(active && "bg-muted text-foreground")}
                >
                  <Link href={tab.href} aria-current={active ? "page" : undefined}>
                    {tab.label}
                  </Link>
                </Button>
              );
            })}
            <form action={agentLogout} className="ml-1">
              <Button type="submit" variant="outline" size="sm">
                Sign out
              </Button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-4xl px-4 py-6 pb-[calc(5.5rem+env(safe-area-inset-bottom))] md:pb-6">
        {children}
      </main>

      <AgentMobileNav />
    </div>
  );
}
