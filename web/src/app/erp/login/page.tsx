import { StaffLoginForm } from "@/components/erp/StaffAuthForms";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { BRAND_ICONS } from "@/lib/brand";
import { isDeskAuthenticated } from "@/lib/desk-auth";
import { DESK_OUTSIDE_SHIFT_MESSAGE } from "@/lib/desk-shift-gate";
import { getStaffSession } from "@/lib/staff-auth";
import { SITE_NAME } from "@/lib/site";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { DeskBlurFade } from "@/components/erp/DeskBlurFade";
import { DotPattern } from "@/components/ui/dot-pattern";
import Link from "next/link";
import { redirect } from "next/navigation";

export const metadata = {
  title: "Desk login",
  robots: { index: false, follow: false },
};

export default async function DeskLoginPage() {
  if (await isDeskAuthenticated()) {
    redirect("/erp");
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

  return (
    <main className="erp relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-6 py-16">
      <DotPattern
        glow={false}
        className="text-muted-foreground/25 [mask-image:radial-gradient(ellipse_at_center,white,transparent_70%)]"
      />
      <DeskBlurFade className="relative z-10 w-full max-w-md space-y-6">
        <div className="space-y-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={BRAND_ICONS.mark}
            alt={SITE_NAME}
            className="h-12 w-12 object-contain"
            width={48}
            height={48}
          />
          <div>
            <p className="text-xs font-semibold tracking-[0.2em] text-accent uppercase">
              {SITE_NAME}
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
              Front desk
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Sign in with your hotel code, user ID, and password — same shape as
              eZee Absolute. Your role comes from HR after login.
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

        <StaffLoginForm workspace="desk" />

        <div className="space-y-2 border-t border-border pt-6 text-center text-sm">
          <Link
            href="/agents/login"
            className="block text-foreground underline-offset-4 hover:underline"
          >
            Travel agent portal →
          </Link>
          <Link
            href="/login"
            className="block text-muted-foreground underline-offset-4 hover:underline"
          >
            Other workspaces
          </Link>
          <Link
            href="/staff/login"
            className="block text-muted-foreground underline-offset-4 hover:underline"
          >
            Staff HR portal
          </Link>
        </div>
        <p className="pt-2 text-center font-mono text-[10px] tracking-wide text-muted-foreground/70">
          build {process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "local"}
          {process.env.VERCEL_DEPLOYMENT_ID
            ? ` · ${process.env.VERCEL_DEPLOYMENT_ID.replace(/^dpl_/, "").slice(0, 8)}`
            : ""}
        </p>
      </DeskBlurFade>
    </main>
  );
}
