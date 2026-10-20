"use client";

import { staffLogout } from "@/app/actions/staff-auth";
import { StaffMobileNav } from "@/components/erp/StaffMobileNav";
import { Button } from "@/components/ui/button";
import { STAFF_TABS, hubTabIdFromPath } from "@/lib/erp/hubs";
import type { StaffSession } from "@/lib/staff-auth";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function StaffAppShell({
  session,
  children,
}: {
  session: StaffSession;
  children: React.ReactNode;
}) {
  const pathname = usePathname() ?? "";
  const activeId = hubTabIdFromPath(pathname, STAFF_TABS);
  const activeTab =
    STAFF_TABS.find((t) => t.id === activeId) ?? STAFF_TABS[0];

  return (
    <div className="erp min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-20 border-b bg-background">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-3 px-3 py-2 sm:px-4">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold tracking-tight">
              {activeTab?.label ?? "Staff"}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {activeTab?.description ?? session.fullName}
            </p>
          </div>
          <form action={staffLogout} className="shrink-0">
            <Button type="submit" variant="outline" size="sm">
              Sign out
            </Button>
          </form>
        </div>
        <nav
          aria-label="Staff sections"
          className="mx-auto flex w-full max-w-3xl items-center gap-0.5 overflow-x-auto border-t border-border/60 bg-muted/30 px-2 py-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:px-3"
        >
          {STAFF_TABS.map((tab) => {
            const active = tab.id === activeTab?.id;
            return (
              <Link
                key={tab.id}
                href={tab.href!}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex h-8 shrink-0 items-center rounded-[5px] px-2.5 text-xs font-medium whitespace-nowrap transition-colors",
                  active
                    ? "bg-accent text-accent-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-background/80 hover:text-foreground",
                )}
              >
                {tab.label}
              </Link>
            );
          })}
          {["supervisor", "hr_admin", "owner"].includes(session.accessLevel) ? (
            <Link
              href="/staff/leave/team"
              className="inline-flex h-8 shrink-0 items-center rounded-[5px] px-2.5 text-xs font-medium text-muted-foreground whitespace-nowrap hover:bg-background/80 hover:text-foreground"
            >
              Team
            </Link>
          ) : null}
        </nav>
      </header>
      <main className="mx-auto w-full max-w-3xl px-4 py-5 pb-[calc(5.5rem+env(safe-area-inset-bottom))] md:pb-6">
        {children}
      </main>
      <StaffMobileNav
        canViewTeam={["supervisor", "hr_admin", "owner"].includes(
          session.accessLevel,
        )}
      />
    </div>
  );
}
