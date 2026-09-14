import { getDistributorSession } from "@/lib/platform-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function PartnerHotelsPage() {
  const session = await getDistributorSession();
  if (!session) redirect("/partner/login");

  let rows: Array<{ id: string; name: string; go_live_at: string | null; package_code: string | null }> = [];
  try {
    const admin = createSupabaseAdminClient();
    const { data } = await admin
      .from("properties")
      .select("id, name, go_live_at, package_code")
      .eq("distributor_id", session.distributorId)
      .order("name");
    rows = (data as typeof rows) ?? [];
  } catch {
    rows = [];
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between gap-3">
        <h1 className="text-2xl font-semibold">My hotels</h1>
        <Link href="/partner/hotels/new" className="rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground">
          Onboard
        </Link>
      </div>
      <ul className="space-y-2 text-sm">
        {rows.length === 0 ? (
          <li className="text-muted-foreground">No hotels in your portfolio yet.</li>
        ) : (
          rows.map((r) => (
            <li key={r.id} className="flex justify-between rounded-lg border px-3 py-2">
              <span>
                {r.name} · {r.package_code} · {r.go_live_at ? "Live" : "Checklist"}
              </span>
              <Link href={`/partner/hotels/${r.id}`} className="underline">
                Open
              </Link>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
