import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import Link from "next/link";
import { createDistributor } from "@/app/actions/platform-admin";

export const dynamic = "force-dynamic";
export const metadata = { title: "Distributors", robots: { index: false, follow: false } };

export default async function DistributorsPage() {
  let rows: Array<{
    id: string;
    name: string;
    slug: string;
    status: string;
    contact_email: string | null;
  }> = [];
  try {
    const admin = createSupabaseAdminClient();
    const { data } = await admin
      .from("distributors")
      .select("id, name, slug, status, contact_email")
      .order("name");
    rows = data ?? [];
  } catch {
    rows = [];
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Distributors</h1>
        <p className="text-sm text-muted-foreground">
          Partner offices that create hotels and collect AMC.
        </p>
      </div>

      <form action={createDistributor} className="grid max-w-xl gap-2 rounded-xl border p-4">
        <p className="text-sm font-medium">Add distributor</p>
        <input name="name" required placeholder="Office name" className="rounded-md border px-3 py-2 text-sm" />
        <input name="slug" placeholder="slug (optional)" className="rounded-md border px-3 py-2 text-sm" />
        <input name="contact_email" type="email" placeholder="Contact email" className="rounded-md border px-3 py-2 text-sm" />
        <input name="contact_phone" placeholder="Phone" className="rounded-md border px-3 py-2 text-sm" />
        <button type="submit" className="rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground">
          Create
        </button>
      </form>

      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full text-left text-sm">
          <thead className="border-b bg-muted/40">
            <tr>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Slug</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Email</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-muted-foreground">
                  No distributors yet (apply migrations if empty).
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="border-b">
                  <td className="px-3 py-2 font-medium">{r.name}</td>
                  <td className="px-3 py-2">{r.slug}</td>
                  <td className="px-3 py-2">{r.status}</td>
                  <td className="px-3 py-2">{r.contact_email}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">
        Add partner logins via Supabase Auth + <code>distributor_members</code> row.
      </p>
      <Link href="/admin" className="text-sm underline">
        Back
      </Link>
    </div>
  );
}
