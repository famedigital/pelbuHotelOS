import { staffLogout } from "@/app/actions/staff-auth";
import { StaffMobileNav } from "@/components/erp/StaffMobileNav";
import { Button } from "@/components/ui/button";
import type { StaffSession } from "@/lib/staff-auth";
import Link from "next/link";

export function StaffAppShell({
  session,
  children,
}: {
  session: StaffSession;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-3 px-4 py-3">
          <div>
            <p className="text-xs font-semibold tracking-[0.18em] text-accent uppercase">
              Pelbu Staff
            </p>
            <p className="text-sm font-medium">{session.fullName}</p>
          </div>
          <div className="hidden items-center gap-2 md:flex">
            <Button asChild variant="ghost" size="sm">
              <Link href="/staff">Home</Link>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link href="/staff/leave">Leave</Link>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link href="/staff/payslips">Payslips</Link>
            </Button>
            {["supervisor", "hr_admin", "owner"].includes(session.accessLevel) ? (
              <Button asChild variant="ghost" size="sm">
                <Link href="/staff/leave/team">Team</Link>
              </Button>
            ) : null}
            <form action={staffLogout}>
              <Button type="submit" variant="outline" size="sm">
                Sign out
              </Button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl px-4 py-6 pb-[calc(5.5rem+env(safe-area-inset-bottom))] md:pb-6">
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
