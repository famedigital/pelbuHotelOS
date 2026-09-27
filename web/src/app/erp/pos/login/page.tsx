import { PosPwaInstall } from "@/components/pwa/PosPwaInstall";
import { StaffLoginForm } from "@/components/erp/StaffAuthForms";
import { BRAND_ICONS } from "@/lib/brand";
import { isDeskAuthenticated } from "@/lib/desk-auth";
import { deskPasswordGateOpen } from "@/app/actions/staff-auth";
import { LOGIN_HOTEL_CODE_COOKIE } from "@/lib/hotel-codes";
import { SITE_NAME } from "@/lib/site";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "POS login",
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
    redirect("/erp/pos");
  }

  const jar = await cookies();
  const pinStep = await deskPasswordGateOpen();
  const savedCode = pinStep
    ? jar.get(LOGIN_HOTEL_CODE_COOKIE)?.value?.trim() || null
    : null;

  return (
    <main className="erp flex min-h-dvh items-center justify-center bg-background px-6 py-10">
      <div className="w-full max-w-sm space-y-6">
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
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">POS</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Hotel code and password, then your name and your own PIN. Install
              this page on the till.
            </p>
          </div>
        </div>
        <StaffLoginForm
          workspace="desk"
          nextPath="/erp/pos"
          initialHotelCode={savedCode}
          initialDeskPinStep={pinStep}
        />
        <PosPwaInstall />
      </div>
    </main>
  );
}
