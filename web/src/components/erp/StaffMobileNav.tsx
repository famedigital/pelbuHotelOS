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
  ReceiptTextIcon,
  UsersIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { title: "Home", href: "/staff", icon: HomeIcon },
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
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border/80 bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
    >
      <div className="mx-auto grid h-16 max-w-md grid-cols-4">
        {ITEMS.map((item) => {
          const active = activePath(pathname, item.href);
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
              <SheetTitle>Staff tools</SheetTitle>
            </SheetHeader>
            <div className="space-y-2 px-4 pb-5">
              {canViewTeam ? (
                <SheetClose asChild>
                  <Link
                    href="/staff/leave/team"
                    className="flex min-h-12 items-center gap-3 rounded-xl border border-border px-4 text-sm"
                  >
                    <UsersIcon className="size-4" />
                    Team leave
                  </Link>
                </SheetClose>
              ) : null}
              <form action={staffLogout}>
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
