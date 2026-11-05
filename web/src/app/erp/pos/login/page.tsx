import { FullDocumentRedirect } from "@/components/erp/FullDocumentRedirect";
import { PosPwaInstall } from "@/components/pwa/PosPwaInstall";
import { StaffLoginForm } from "@/components/erp/StaffAuthForms";
import { BRAND_ICONS } from "@/lib/brand";
import { isDeskAuthenticated } from "@/lib/desk-auth";
import { deskPasswordGateOpen } from "@/app/actions/staff-auth";
import { LOGIN_HOTEL_CODE_COOKIE } from "@/lib/hotel-codes";
import { SITE_NAME } from "@/lib/site";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { ArrowLeft, UtensilsCrossed, ShieldCheck } from "lucide-react";

export const metadata: Metadata = {
  title: "Till & Restaurant POS Login · Hotel OS Bhutan",
  description: "Sign in and open the register.",
  robots: { index: false, follow: false },
  manifest: "/pos.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "POS",
  },
  icons: {
    apple: BRAND_ICONS.appleTouch,
  },
};

export const dynamic = "force-dynamic";

export default async function PosLoginPage() {
  if (await isDeskAuthenticated()) {
    return <FullDocumentRedirect href="/erp/pos" />;
  }

  const jar = await cookies();
  const pinStep = await deskPasswordGateOpen();
  const savedCode = pinStep
    ? jar.get(LOGIN_HOTEL_CODE_COOKIE)?.value?.trim() || null
    : null;

  return (
    <main className="erp relative flex min-h-dvh items-center justify-center overflow-hidden bg-background px-4 py-10 md:px-6">
      {/* Ambient background glows */}
      <div
        className="pointer-events-none absolute -top-28 -right-28 h-[400px] w-[400px] rounded-full blur-[130px] opacity-15"
        style={{
          background: "radial-gradient(circle, #d97706 0%, transparent 70%)",
        }}
        aria-hidden
      />

      <div className="relative z-10 w-full max-w-sm">
        {/* Navigation Breadcrumb */}
        <div className="mb-4 flex items-center justify-between text-xs">
          <Link
            href="/login?switch=1"
            className="inline-flex items-center gap-1.5 text-muted-foreground transition hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" />
            <span>All Workspaces</span>
          </Link>

          <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-[10px] font-semibold text-amber-600 dark:text-amber-400">
            <UtensilsCrossed className="size-3" />
            <span>Dining & Till POS</span>
          </span>
        </div>

        {/* Specular Glass Login Card */}
        <div className="relative overflow-hidden rounded-2xl border border-border/80 bg-card/90 p-6 shadow-xl backdrop-blur-xl">
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
                  {SITE_NAME} · Till
                </p>
                <h1 className="text-xl font-bold tracking-tight text-foreground">
                  POS Register Sign In
                </h1>
              </div>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed">
              {pinStep
                ? "Select your F&B staff name and enter your personal PIN."
                : "Enter hotel code and password to unlock the dining till."}
            </p>
          </div>

          <div className="mt-6">
            <StaffLoginForm
              workspace="desk"
              nextPath="/erp/pos"
              initialHotelCode={savedCode}
              initialDeskPinStep={pinStep}
            />
          </div>

          <div className="mt-5">
            <PosPwaInstall />
          </div>

          <div className="mt-6 border-t border-border/70 pt-4 text-center text-xs text-muted-foreground">
            <Link
              href="/erp/login"
              className="hover:text-foreground underline-offset-4 hover:underline"
            >
              ← Switch to Front Desk
            </Link>
          </div>

          <div className="mt-4 flex items-center justify-center gap-1.5 text-[10px] text-muted-foreground/80">
            <ShieldCheck className="size-3 text-amber-500" />
            <span>Room Charge in BTN • RMA QR Receipts</span>
          </div>
        </div>
      </div>
    </main>
  );
}
