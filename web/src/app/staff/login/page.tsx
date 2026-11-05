import { StaffLoginForm } from "@/components/erp/StaffAuthForms";
import { BRAND_ICONS } from "@/lib/brand";
import { safeStaffNextPath } from "@/lib/safe-staff-next";
import { SITE_NAME } from "@/lib/site";
import { getStaffSession } from "@/lib/staff-auth";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Clock, ShieldCheck } from "lucide-react";

export const metadata: Metadata = {
  title: "Staff HR & Attendance Login · Hotel OS Bhutan",
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
    <main className="erp relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4 py-12 md:px-6">
      {/* Ambient background glows */}
      <div
        className="pointer-events-none absolute -top-32 -left-32 h-[400px] w-[400px] rounded-full blur-[140px] opacity-15"
        style={{
          background: "radial-gradient(circle, #8b5cf6 0%, transparent 70%)",
        }}
        aria-hidden
      />

      <div className="relative z-10 w-full max-w-md">
        {/* Navigation Breadcrumb */}
        <div className="mb-4 flex items-center justify-between text-xs">
          <Link
            href="/login?switch=1"
            className="inline-flex items-center gap-1.5 text-muted-foreground transition hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" />
            <span>All Workspaces</span>
          </Link>

          <span className="inline-flex items-center gap-1 rounded-full border border-violet-500/30 bg-violet-500/10 px-2.5 py-0.5 text-[10px] font-semibold text-violet-600 dark:text-violet-400">
            <Clock className="size-3" />
            <span>Staff Self-Service</span>
          </span>
        </div>

        {/* Specular Glass Login Card */}
        <div className="relative overflow-hidden rounded-2xl border border-border/80 bg-card/90 p-6 shadow-xl backdrop-blur-xl md:p-8">
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/40 to-transparent dark:via-white/20"
            aria-hidden
          />

          <div className="space-y-4">
            <div className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={BRAND_ICONS.mark}
                alt={SITE_NAME}
                className="h-11 w-11 rounded-xl object-contain ring-1 ring-border"
                width={44}
                height={44}
              />
              <div>
                <p className="text-[10px] font-bold tracking-[0.2em] text-accent uppercase">
                  {SITE_NAME} · Staff
                </p>
                <h1 className="text-xl font-bold tracking-tight text-foreground">
                  Staff Sign In
                </h1>
              </div>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed">
              {nextPath?.startsWith("/staff/laundry/bags/")
                ? "Enter hotel code, employee ID, and PIN to open this laundry bag."
                : "Enter hotel code, then your user ID and personal PIN for attendance, leave, and clock-in."}
            </p>
          </div>

          <div className="mt-6">
            <StaffLoginForm nextPath={nextPath} />
          </div>

          <div className="mt-6 border-t border-border/70 pt-4 text-center text-xs text-muted-foreground">
            <Link
              href="/login?switch=1"
              className="hover:text-foreground underline-offset-4 hover:underline"
            >
              Use a different workspace
            </Link>
          </div>

          <div className="mt-4 flex items-center justify-center gap-1.5 text-[10px] text-muted-foreground/80">
            <ShieldCheck className="size-3 text-violet-500" />
            <span>Encrypted Time Clock • Rota & Payslips</span>
          </div>
        </div>
      </div>
    </main>
  );
}
