import { fetchStayHubCheckIn } from "@/app/actions/stay-hub";
import { CheckInForm } from "@/components/erp/CheckInForm";
import { isDeskAuthenticated } from "@/lib/desk-auth";
import Link from "next/link";
import { redirect } from "next/navigation";

export const metadata = {
  title: "Check-in",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{ q?: string; id?: string; booking?: string }>;
};

export default async function CheckInPage({ searchParams }: Props) {
  if (!(await isDeskAuthenticated())) redirect("/erp/login");
  const sp = await searchParams;
  const id = (sp.id ?? sp.booking ?? "").trim();
  if (!id) redirect("/erp/arrivals");

  const result = await fetchStayHubCheckIn(id);
  if (!result.ok) {
    return (
      <div className="mx-auto max-w-3xl space-y-3 p-6">
        <h1 className="text-lg font-semibold">Check-in</h1>
        <p className="text-sm text-muted-foreground">{result.error}</p>
        <Link href="/erp/arrivals" className="text-sm underline">
          Back to arrivals
        </Link>
      </div>
    );
  }

  const booking = result.data.booking;
  return (
    <div className="mx-auto w-full max-w-6xl space-y-4 p-4 md:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold tracking-[0.16em] text-muted-foreground uppercase">
            Check-in
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">
            {booking.contact_name?.trim() || "Guest"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {booking.check_in} → {booking.check_out}
            {booking.agent_name ? ` · ${booking.agent_name}` : ""}
          </p>
        </div>
        <Link
          href={`/erp/arrivals?booking=${encodeURIComponent(id)}&step=check_in`}
          className="text-sm text-muted-foreground underline-offset-2 hover:underline"
        >
          Back to stay
        </Link>
      </div>
      <CheckInForm
        booking={booking}
        guides={result.data.guides}
        drivers={result.data.drivers}
        slots={result.data.slots}
        units={result.data.units}
        pane="all"
      />
    </div>
  );
}
