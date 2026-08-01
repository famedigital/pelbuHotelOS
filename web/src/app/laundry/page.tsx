import type { Metadata } from "next";
import { LaundryGuestPortal } from "@/components/laundry/LaundryGuestPortal";
import { loadGuestLaundryData } from "@/app/actions/laundry";

export const metadata: Metadata = {
  title: "Laundry | Pelbu Suites",
  description:
    "Guest and walk-in laundry collection at Pelbu Suites — pay by bank transfer or charge to your room folio.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function LaundryPage({
  searchParams,
}: {
  searchParams: Promise<{ room?: string }>;
}) {
  const [{ room }, data] = await Promise.all([
    searchParams,
    loadGuestLaundryData(),
  ]);
  return (
    <main className="min-h-screen bg-secondary/25 px-4 py-8 sm:py-12">
      <div className="mx-auto w-full max-w-xl">
        <div className="mb-6 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-accent">
            Pelbu Suites
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Secure guest service
          </p>
        </div>
        <LaundryGuestPortal
          session={data.session}
          catalog={data.catalog}
          orders={data.orders}
          roomPrefill={room?.slice(0, 30)}
        />
        <p className="mt-6 text-center text-xs leading-5 text-muted-foreground">
          Need help? Contact reception. Walk-in orders require name and mobile;
          in-house guests verify privately with room and check-in name.
        </p>
      </div>
    </main>
  );
}
