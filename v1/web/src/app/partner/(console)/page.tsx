import { getDistributorSession } from "@/lib/platform-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import Link from "next/link";

export const dynamic = "force-dynamic";
export const metadata = { title: "Partner dashboard", robots: { index: false, follow: false } };

export default async function PartnerDashboardPage() {
  const session = await getDistributorSession();
  if (!session) redirect("/partner/login");

  let hotels = 0;
  let leads = 0;
  try {
    const admin = createSupabaseAdminClient();
    const [h, l] = await Promise.all([
      admin
        .from("properties")
        .select("id", { count: "exact", head: true })
        .eq("distributor_id", session.distributorId),
      admin
        .from("sales_leads")
        .select("id", { count: "exact", head: true })
        .eq("distributor_id", session.distributorId)
        .in("status", ["new", "contacted", "demo"]),
    ]);
    hotels = h.count ?? 0;
    leads = l.count ?? 0;
  } catch {
    /* empty */
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Partner dashboard</h1>
        <p className="text-sm text-muted-foreground">{session.distributorName}</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Link href="/partner/hotels" className="rounded-xl border p-4">
          <p className="text-xs uppercase text-muted-foreground">My hotels</p>
          <p className="mt-1 text-2xl font-semibold">{hotels}</p>
        </Link>
        <Link href="/partner/leads" className="rounded-xl border p-4">
          <p className="text-xs uppercase text-muted-foreground">Open leads</p>
          <p className="mt-1 text-2xl font-semibold">{leads}</p>
        </Link>
      </div>
      <Link
        href="/partner/hotels/new"
        className="inline-flex rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground"
      >
        Onboard hotel
      </Link>
    </div>
  );
}
