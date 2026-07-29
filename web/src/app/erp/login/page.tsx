import { DeskLoginForm } from "@/components/erp/DeskLoginForm";
import { BRAND_ICONS } from "@/lib/brand";
import { deskPinConfigured, isDeskAuthenticated } from "@/lib/desk-auth";
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
    <main className="min-h-screen bg-ivory px-6 py-16">
      <div className="mx-auto max-w-md space-y-6">
        <div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={BRAND_ICONS.mark}
            alt="Pelbu Suites"
            className="mb-6 h-16 w-16 object-contain"
            width={64}
            height={64}
          />
          <p className="text-xs tracking-[0.25em] text-gold uppercase">Pelbu Suites</p>
          <h1 className="mt-2 text-3xl text-espresso">Front desk</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Review bookings, orders, spa/meeting requests, enquiries, and agent
            applications.
          </p>
        </div>
        {!deskPinConfigured() ? (
          <p className="border border-maroon/30 bg-maroon/5 px-4 py-3 text-sm text-maroon">
            Set <code className="font-mono">DESK_PIN</code> in{" "}
            <code className="font-mono">.env.local</code> (and Vercel) to enable
            production desk login. Local non-production builds can open the inbox
            without a PIN.
          </p>
        ) : (
          <DeskLoginForm />
        )}
        {process.env.NODE_ENV !== "production" && !deskPinConfigured() ? (
          <a
            href="/erp"
            className="inline-flex min-h-11 items-center rounded-sm bg-espresso px-5 text-sm font-medium text-ivory"
          >
            Continue without PIN (dev)
          </a>
        ) : null}
      </div>
    </main>
  );
}
