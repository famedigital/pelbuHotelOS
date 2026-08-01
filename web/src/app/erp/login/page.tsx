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
              Sign in with your staff employee code and PIN. Owner / GM accounts
              open the full desk.
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            Staff Auth
          </p>
          <StaffLoginForm />
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
      </div>
    </main>
  );
}
