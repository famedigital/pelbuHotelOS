import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import Link from "next/link";

export const dynamic = "force-dynamic";
export const metadata = { title: "Hotels", robots: { index: false, follow: false } };

export default async function AdminHotelsPage() {
  let rows: Array<{
    id: string;
    name: string;
    slug: string;
    package_code: string | null;
    go_live_at: string | null;
    is_demo: boolean;
    amc_amount_btn: number | null;
    distributor_id: string | null;
  }> = [];

  try {
    const admin = createSupabaseAdminClient();
    const { data } = await admin
      .from("properties")
      .select(
        "id, name, slug, package_code, go_live_at, is_demo, amc_amount_btn, distributor_id",
      )
      .order("name");
    rows = (data as typeof rows) ?? [];
  } catch {
    rows = [];
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Hotels</h1>
          <p className="text-sm text-muted-foreground">All properties on Hotel OS.</p>
        </div>
        <Link
          href="/admin/hotels/new"
          className="rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground"
        >
          Onboard hotel
        </Link>
      </div>
      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full text-left text-sm">
          <thead className="border-b bg-muted/40">
            <tr>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Package</th>
              <th className="px-3 py-2">AMC</th>
              <th className="px-3 py-2">Live</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-muted-foreground">
                  No hotels yet.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="border-b">
                  <td className="px-3 py-2">
                    {r.name}
                    {r.is_demo ? (
                      <span className="ml-2 text-[10px] uppercase text-amber-700">
                        demo
                      </span>
                    ) : null}
                  </td>
                  <td className="px-3 py-2">{r.package_code ?? "—"}</td>
                  <td className="px-3 py-2">{r.amc_amount_btn ?? "—"}</td>
                  <td className="px-3 py-2">
                    {r.go_live_at ? "Yes" : "Checklist"}
                  </td>
                  <td className="px-3 py-2">
                    <Link href={`/admin/hotels/${r.id}`} className="underline">
                      Open
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
