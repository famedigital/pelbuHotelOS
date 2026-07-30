import { DeskLoginForm } from "@/components/erp/DeskLoginForm";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { BRAND_ICONS } from "@/lib/brand";
import { deskPinConfigured, isDeskAuthenticated } from "@/lib/desk-auth";
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
              Review bookings, orders, spa/meeting requests, enquiries, and
              agent applications.
            </p>
          </div>
        </div>
        {!deskPinConfigured() ? (
          <Alert variant="destructive">
            <AlertTitle>Desk PIN not configured</AlertTitle>
            <AlertDescription>
              Set <code className="font-mono">DESK_PIN</code> in{" "}
              <code className="font-mono">.env.local</code> (and Vercel) to
              enable production desk login. Local non-production builds can open
              the inbox without a PIN.
            </AlertDescription>
          </Alert>
        ) : (
          <DeskLoginForm />
        )}
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
