import { StaffLoginForm } from "@/components/erp/StaffAuthForms";
import { BRAND_ICONS } from "@/lib/brand";
import { safeStaffNextPath } from "@/lib/safe-staff-next";
import { getStaffSession } from "@/lib/staff-auth";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Staff login | Pelbu Suites",
  robots: { index: false, follow: false },
  manifest: "/staff.webmanifest",
};

export default async function StaffLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const params = await searchParams;
  const nextPath = safeStaffNextPath(params.next);
  const session = await getStaffSession();
  if (session) {
    redirect(nextPath ?? (session.canAccessDesk ? "/erp" : "/staff"));
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 py-16">
      <div className="w-full max-w-md space-y-6">
        <div className="space-y-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={BRAND_ICONS.mark}
            alt="Pelbu Suites"
            className="h-12 w-12 object-contain"
            width={48}
            height={48}
          />
          <div>
            <p className="text-xs font-semibold tracking-[0.2em] text-accent uppercase">
              Staff portal
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">
              Sign in
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {nextPath?.startsWith("/staff/laundry/bags/")
                ? "Sign in with your employee code and PIN to open this laundry bag."
                : "Use your employee code and PIN to see shifts, notices, leave and clock options."}
            </p>
          </div>
        </div>
        <StaffLoginForm nextPath={nextPath} />
        <Link
          href="/login"
          className="block text-center text-sm text-muted-foreground underline-offset-4 hover:underline"
        >
          Use a different workspace
        </Link>
      </div>
    </main>
  );
}
