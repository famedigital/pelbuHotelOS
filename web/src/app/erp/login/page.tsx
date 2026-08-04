import { DeskLoginForm } from "@/components/erp/DeskLoginForm";
import { StaffLoginForm } from "@/components/erp/StaffAuthForms";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { BRAND_ICONS } from "@/lib/brand";
import {
  deskPinAllowedInProduction,
  deskPinConfigured,
  isDeskAuthenticated,
} from "@/lib/desk-auth";
import { DESK_OUTSIDE_SHIFT_MESSAGE } from "@/lib/desk-shift-gate";
import { getStaffSession } from "@/lib/staff-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import Link from "next/link";
import { redirect } from "next/navigation";

export const metadata = {
  title: "Desk login | Pelbu OS",
  robots: { index: false, follow: false },
};

export default async function DeskLoginPage() {
  if (await isDeskAuthenticated()) {
    redirect("/erp");
  }

  // Staff Auth present but blocked by shift restriction → clear denial, not a mystery bounce.
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

  const pinOk =
    deskPinConfigured() &&
    (process.env.NODE_ENV !== "production" || deskPinAllowedInProduction());

  return (
    <main className="erp flex min-h-screen items-center justify-center bg-background px-6 py-16">
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
              Pelbu Suites
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
              Front desk
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Sign in with your employee code and PIN. Any staff account with
              desk access enabled by HR can open Work — not only Owner / GM.
            </p>
          </div>
        </div>

        {outsideShiftBanner ? (
          <Alert variant="destructive">
            <AlertTitle>Outside scheduled shift</AlertTitle>
            <AlertDescription>
              {outsideShiftBanner || DESK_OUTSIDE_SHIFT_MESSAGE}
            </AlertDescription>
          </Alert>
        ) : null}

        <div className="space-y-2">
          <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            Staff Auth
          </p>
          <StaffLoginForm workspace="desk" />
        </div>

        {pinOk ? (
          <div className="space-y-2 border-t border-border pt-6">
            <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Shared desk PIN
            </p>
            <p className="text-xs text-muted-foreground">
              Single-hotel escape hatch only — prefer named staff accounts.
            </p>
            <DeskLoginForm />
          </div>
        ) : deskPinConfigured() ? (
          <Alert>
            <AlertTitle>Shared desk PIN off in production</AlertTitle>
            <AlertDescription>
              Use staff Auth above. Shared PIN stays disabled by design.
            </AlertDescription>
          </Alert>
        ) : null}

        {process.env.NODE_ENV !== "production" && !deskPinConfigured() ? (
          <Button asChild variant="outline" className="h-11 w-full">
            <a href="/erp">Continue without PIN (dev)</a>
          </Button>
        ) : null}
        <Link
          href="/login"
          className="block text-center text-sm text-muted-foreground underline-offset-4 hover:underline"
        >
          Use a different workspace
        </Link>
        <p className="pt-2 text-center font-mono text-[10px] tracking-wide text-muted-foreground/70">
          build {process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "local"}
          {process.env.VERCEL_DEPLOYMENT_ID
            ? ` · ${process.env.VERCEL_DEPLOYMENT_ID.replace(/^dpl_/, "").slice(0, 8)}`
            : ""}
        </p>
      </div>
    </main>
  );
}
