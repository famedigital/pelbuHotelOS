import { FullDocumentRedirect } from "@/components/erp/FullDocumentRedirect";
import { StaffLoginForm } from "@/components/erp/StaffAuthForms";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { BRAND_ICONS } from "@/lib/brand";
import { isDeskAuthenticated } from "@/lib/desk-auth";
import { DESK_OUTSIDE_SHIFT_MESSAGE } from "@/lib/desk-shift-gate";
import { deskPasswordGateOpen } from "@/app/actions/staff-auth";
import { LOGIN_HOTEL_CODE_COOKIE } from "@/lib/hotel-codes";
import { getStaffSession } from "@/lib/staff-auth";
import { SITE_NAME } from "@/lib/site";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { cookies } from "next/headers";
import Link from "next/link";
import { Building2, ShieldCheck, ArrowLeft } from "lucide-react";

export const metadata = {
  title: "Front Desk Login · Hotel OS Bhutan",
  robots: { index: false, follow: false },
};

export default async function DeskLoginPage() {
  if (await isDeskAuthenticated()) {
    return <FullDocumentRedirect href="/erp" />;
  }

  let outsideShiftBanner: string | null = null;
  try {
    const staff = await getStaffSession();
    if (staff?.canAccessDesk) {
      const { staffSessionSatisfiesDeskShift } = await import(
        "@/lib/desk-shift-gate"
      );
      const gate = await staffSessionSatisfiesDeskShift(
        createSupabaseAdminClient(),
        staff,
      );
      if (!gate.ok) outsideShiftBanner = gate.message;
    }
  } catch {
    // ignore
  }

  const jar = await cookies();
  const pinStep = await deskPasswordGateOpen();
  const savedCode = pinStep
    ? jar.get(LOGIN_HOTEL_CODE_COOKIE)?.value?.trim() || null
    : null;

  return (
    <main className="erp relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4 py-12 md:px-6">
      {/* Ambient background glows */}
      <div
        className="pointer-events-none absolute -top-32 -left-32 h-[450px] w-[450px] rounded-full blur-[140px] opacity-15"
        style={{
          background: "radial-gradient(circle, #059669 0%, transparent 70%)",
        }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -bottom-32 -right-32 h-[450px] w-[450px] rounded-full blur-[140px] opacity-15"
        style={{
          background: "radial-gradient(circle, #d97706 0%, transparent 70%)",
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

          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
            <Building2 className="size-3" />
            <span>Front Office Core</span>
          </span>
        </div>

        {/* Specular Glass Login Card */}
        <div className="relative overflow-hidden rounded-2xl border border-border/80 bg-card/90 p-6 shadow-xl backdrop-blur-xl md:p-8">
          {/* Specular Top Rim */}
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
                  {SITE_NAME} · Bhutan
                </p>
                <h1 className="text-xl font-bold tracking-tight text-foreground">
                  Front Desk Sign In
                </h1>
              </div>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed">
              {pinStep
                ? "Select your department, staff name, and enter your personal PIN."
                : "Enter your 6–8 character hotel code and property desk password."}
            </p>
          </div>

          {outsideShiftBanner ? (
            <div className="mt-4">
              <Alert variant="destructive">
                <AlertTitle>Outside scheduled shift</AlertTitle>
                <AlertDescription>
                  {outsideShiftBanner || DESK_OUTSIDE_SHIFT_MESSAGE}
                </AlertDescription>
              </Alert>
            </div>
          ) : null}

          <div className="mt-6">
            <StaffLoginForm
              workspace="desk"
              initialHotelCode={savedCode}
              initialDeskPinStep={pinStep}
            />
          </div>

          {/* Quick Workspace Switcher Footer */}
          <div className="mt-6 space-y-2.5 border-t border-border/70 pt-5 text-center text-xs">
            <div className="flex items-center justify-center gap-4">
              <Link
                href="/erp/pos/login"
                className="font-medium text-muted-foreground transition hover:text-foreground"
              >
                POS Register Till →
              </Link>
              <span className="text-border">·</span>
              <Link
                href="/agents/login"
                className="font-medium text-muted-foreground transition hover:text-foreground"
              >
                Travel Partner Portal →
              </Link>
            </div>
            <Link
              href="/staff/login"
              className="block text-muted-foreground/80 hover:text-foreground"
            >
              Staff HR & Attendance Rota
            </Link>
          </div>

          <div className="mt-4 flex items-center justify-center gap-1.5 text-[10px] text-muted-foreground/80">
            <ShieldCheck className="size-3 text-emerald-500" />
            <span>DRC Tax Compliant • 10% BST + 10% Service Charge</span>
          </div>
        </div>

        <p className="pt-4 text-center font-mono text-[10px] text-muted-foreground/60">
          build {process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "local"}
          {process.env.VERCEL_DEPLOYMENT_ID
            ? ` · ${process.env.VERCEL_DEPLOYMENT_ID.replace(/^dpl_/, "").slice(0, 8)}`
            : ""}
        </p>
      </div>
    </main>
  );
}
