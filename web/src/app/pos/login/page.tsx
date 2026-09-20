import { StaffLoginForm } from "@/components/erp/StaffAuthForms";
import { BRAND_ICONS } from "@/lib/brand";
import { isDeskAuthenticated } from "@/lib/desk-auth";
import { resolvePosKioskOutlet } from "@/lib/pos-kiosk";
import { safeStaffNextPath } from "@/lib/safe-staff-next";
import Link from "next/link";
import { redirect } from "next/navigation";

export const metadata = {
  title: "POS login | Pelbu OS",
  robots: { index: false, follow: false },
};

export default async function PosLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const params = await searchParams;
  const nextPath =
    safeStaffNextPath(params.next) ?? "/pos/restaurant";

  if (await isDeskAuthenticated()) {
    redirect(nextPath.startsWith("/pos/") ? nextPath : "/pos/restaurant");
  }

  return (
    <main className="flex flex-1 items-center justify-center px-6 py-16">
      <div className="w-full max-w-md space-y-6">
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
            F&amp;B till
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
            POS sign-in
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Same employee code and PIN as the hotel desk. Bookmark this tablet
            to Cafe, Barista, Restaurant, or Bar after you sign in.
          </p>
        </div>
        <StaffLoginForm workspace="desk" nextPath={nextPath} />
        <div className="grid grid-cols-2 gap-2 text-sm">
          {(["restaurant", "cafe", "barista", "bar"] as const).map((slug) => {
            const resolved = resolvePosKioskOutlet(slug);
            if (!resolved) return null;
            return (
              <Link
                key={slug}
                href={`/pos/login?next=/pos/${slug}`}
                className="rounded-lg border bg-card px-3 py-2 text-center text-muted-foreground hover:bg-secondary hover:text-foreground"
              >
                {resolved.label}
              </Link>
            );
          })}
        </div>
        <Link
          href="/erp/login"
          className="block text-center text-sm text-muted-foreground underline-offset-4 hover:underline"
        >
          Hotel desk login
        </Link>
      </div>
    </main>
  );
}
