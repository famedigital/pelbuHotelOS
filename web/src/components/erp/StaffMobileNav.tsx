"use client";

import { staffLogout } from "@/app/actions/staff-auth";
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
  CalendarHeartIcon,
  EllipsisIcon,
  HomeIcon,
  ShirtIcon,
  ReceiptTextIcon,
  UsersIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { title: "Home", href: "/staff", icon: HomeIcon },
  { title: "Laundry", href: "/staff/laundry", icon: ShirtIcon },
  { title: "Leave", href: "/staff/leave", icon: CalendarHeartIcon },
  { title: "Payslips", href: "/staff/payslips", icon: ReceiptTextIcon },
] as const;

function activePath(pathname: string, href: string): boolean {
  if (href === "/staff") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function StaffMobileNav({ canViewTeam }: { canViewTeam: boolean }) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Staff navigation"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-50 md:hidden"
    >
      <div className="glass-dock-mobile pointer-events-auto">
        {ITEMS.map((item) => {
          const active = activePath(pathname, item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "touch-press relative flex min-h-11 min-w-11 flex-1 flex-col items-center justify-center gap-0.5 text-[10px] font-medium text-muted-foreground",
                active && "text-primary",
              )}
            >
              <Icon className="size-5" strokeWidth={active ? 2.4 : 1.8} />
              <span className="max-w-[4.5rem] truncate">{item.title}</span>
              {active ? (
                <span
                  aria-hidden
                  className="absolute inset-x-[28%] bottom-0.5 h-0.5 rounded-full bg-primary"
                />
              ) : null}
            </Link>
          );
        })}
        <Sheet>
          <SheetTrigger asChild>
            <button
              type="button"
              className="touch-press flex min-h-11 min-w-11 flex-1 flex-col items-center justify-center gap-0.5 text-[10px] font-medium text-muted-foreground"
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
              <SheetTitle>Staff tools</SheetTitle>
            </SheetHeader>
            <div className="space-y-2 px-4 pb-5">
              {canViewTeam ? (
                <SheetClose asChild>
                  <Link
                    href="/staff/leave/team"
                    className="touch-press flex min-h-12 items-center gap-3 rounded-xl border border-border px-4 text-sm"
                  >
                    <UsersIcon className="size-4" />
                    Team leave
                  </Link>
                </SheetClose>
              ) : null}
              <form action={staffLogout}>
                <button
                  type="submit"
                  className="touch-press min-h-12 w-full rounded-xl border border-border px-4 text-sm font-medium"
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
