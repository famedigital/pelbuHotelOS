import {
  upsertVaultGuide,
  verifyVaultGuide,
} from "@/app/actions/platform-vault";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import Link from "next/link";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Vault · Guides",
  robots: { index: false, follow: false },
};

export default async function AdminVaultGuidesPage() {
  const admin = createSupabaseAdminClient();
  const [{ data: queue }, { data: guides }] = await Promise.all([
    admin
      .from("platform_verification_queue")
      .select("id, entity_id, payload, created_at, submitted_by")
      .eq("entity_type", "guide")
      .eq("status", "open")
      .order("created_at", { ascending: false })
      .limit(100),
    admin
      .from("national_guides")
      .select(
        "id, license_no, full_name, phone, city, guide_type, status, languages, created_at",
      )
      .order("full_name", { ascending: true })
      .limit(500),
  ]);

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Guide vault</h1>
        <p className="text-sm text-muted-foreground">
          National licensed guides shared with every hotel. Hotel-typed guides
          wait here until Innora verifies license details.
        </p>
        <Link href="/admin/vault/agents" className="text-sm underline">
          Agent vault →
        </Link>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">
          Pending verification ({queue?.length ?? 0})
        </h2>
        {(queue ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">No open guide reviews.</p>
        ) : (
          <ul className="space-y-3">
            {(queue ?? []).map((item) => {
              const payload = (item.payload ?? {}) as Record<string, unknown>;
              const guide = (guides ?? []).find((g) => g.id === item.entity_id);
              return (
                <li key={item.id} className="rounded-xl border p-4 text-sm space-y-2">
                  <p className="font-medium">
                    {guide?.full_name ?? String(payload.fullName ?? "Unknown")}
                  </p>
                  <p className="font-mono text-xs text-muted-foreground">
                    {guide?.license_no ?? String(payload.licenseNo ?? "—")} ·{" "}
                    {guide?.phone ?? String(payload.phone ?? "")}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <form action={verifyVaultGuide}>
                      <input type="hidden" name="guide_id" value={item.entity_id} />
                      <input type="hidden" name="status" value="verified" />
                      <button
                        type="submit"
                        className="rounded-md bg-primary px-3 py-1.5 text-primary-foreground"
                      >
                        Verify
                      </button>
                    </form>
                    <form action={verifyVaultGuide}>
                      <input type="hidden" name="guide_id" value={item.entity_id} />
                      <input type="hidden" name="status" value="rejected" />
                      <button
                        type="submit"
                        className="rounded-md border border-destructive/40 px-3 py-1.5 text-destructive"
                      >
                        Reject
                      </button>
                    </form>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Add / update guide</h2>
        <form action={upsertVaultGuide} className="grid gap-2 rounded-xl border p-4 sm:grid-cols-2">
          <input
            name="license_no"
            required
            placeholder="License no"
            className="rounded-md border px-3 py-2 text-sm"
          />
          <input
            name="full_name"
            required
            placeholder="Full name"
            className="rounded-md border px-3 py-2 text-sm"
          />
          <input name="phone" placeholder="Phone" className="rounded-md border px-3 py-2 text-sm" />
          <input name="city" placeholder="City" className="rounded-md border px-3 py-2 text-sm" />
          <input
            name="guide_type"
            placeholder="Guide type"
            className="rounded-md border px-3 py-2 text-sm"
          />
          <input
            name="languages"
            placeholder="Languages (comma-separated)"
            defaultValue="English"
            className="rounded-md border px-3 py-2 text-sm"
          />
          <button
            type="submit"
            className="rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground sm:col-span-2"
          >
            Save verified guide
          </button>
        </form>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Guides ({guides?.length ?? 0})</h2>
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full text-left text-sm">
            <thead className="border-b bg-muted/40">
              <tr>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">License</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">City</th>
              </tr>
            </thead>
            <tbody>
              {(guides ?? []).map((g) => (
                <tr key={g.id} className="border-b last:border-0">
                  <td className="px-3 py-2">{g.full_name}</td>
                  <td className="px-3 py-2 font-mono text-xs">{g.license_no}</td>
                  <td className="px-3 py-2 font-mono text-xs">{g.status}</td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {g.city ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
