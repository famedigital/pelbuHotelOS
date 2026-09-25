import { submitDeskNationalGuide } from "@/app/actions/platform-vault";
import { DeskListShell } from "@/components/erp/DeskListShell";
import { PartnersTable } from "@/components/erp/PartnersTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { isDeskAuthenticated } from "@/lib/desk-auth";
import { resolveActivePropertyId } from "@/lib/property-context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";

export const metadata = {
  title: "Partners",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export type PartnerRow = {
  id: string;
  full_name: string | null;
  phone: string | null;
  guide_number?: string | null;
  vehicle_no?: string | null;
  license_no?: string | null;
  visit_count: number;
  last_seen_at: string | null;
  discount_pct?: number;
};

export default async function PartnersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  if (!(await isDeskAuthenticated())) {
    redirect("/erp/login");
  }

  const { q } = await searchParams;
  const query = (q ?? "").trim().toLowerCase();

  const admin = createSupabaseAdminClient();
  let propertyId: string;
  try {
    propertyId = await resolveActivePropertyId(admin);
  } catch {
    return (
      <DeskListShell eyebrow="Directory" heading="Guides & drivers">
        <p className="text-sm text-muted-foreground">Property not configured.</p>
      </DeskListShell>
    );
  }

  const [{ data: guideRows }, { data: driverRows }, { data: national }] =
    await Promise.all([
      admin
        .from("guides")
        .select(
          "id, full_name, phone, guide_number, visit_count, last_seen_at, discount_pct",
        )
        .eq("property_id", propertyId)
        .order("visit_count", { ascending: false })
        .limit(200),
      admin
        .from("drivers")
        .select(
          "id, full_name, phone, vehicle_no, license_no, visit_count, last_seen_at, discount_pct",
        )
        .eq("property_id", propertyId)
        .order("visit_count", { ascending: false })
        .limit(200),
      admin
        .from("national_guides")
        .select("id, full_name, phone, license_no, city, status")
        .eq("status", "verified")
        .order("full_name", { ascending: true })
        .limit(300),
    ]);

  const filterFn = (r: PartnerRow): boolean => {
    if (!query) return true;
    return [
      r.full_name,
      r.phone,
      r.guide_number,
      r.vehicle_no,
      r.license_no,
    ].some((v) => (v ?? "").toLowerCase().includes(query));
  };

  const guides = ((guideRows as PartnerRow[] | null) ?? []).filter(filterFn);
  const drivers = ((driverRows as PartnerRow[] | null) ?? []).filter(filterFn);
  const nationalFiltered = (national ?? []).filter((g) => {
    if (!query) return true;
    return [g.full_name, g.phone, g.license_no, g.city].some((v) =>
      (v ?? "").toLowerCase().includes(query),
    );
  });

  return (
    <DeskListShell
      eyebrow="Repeat partners"
      heading="Guides & drivers"
      blurb="National verified guides are shared across all hotels. Local visit stats and discounts stay on this property. New guides you type are sent to Innora for license verification."
      filters={
        <form
          className="flex items-center gap-2"
          action="/erp/partners"
          method="get"
        >
          <div className="min-w-[220px] flex-1 space-y-1.5">
            <label htmlFor="q" className="sr-only">
              Search partners
            </label>
            <Input
              id="q"
              type="search"
              name="q"
              defaultValue={q ?? ""}
              placeholder="Search by name, number, phone, vehicle…"
              className="h-10"
            />
          </div>
          <Button type="submit" variant="outline" className="h-10">
            Search
          </Button>
        </form>
      }
    >
      <section className="space-y-3 rounded-xl border p-4">
        <h2 className="text-[11px] font-semibold tracking-[0.2em] text-accent uppercase">
          Submit guide for Innora verification
        </h2>
        <form action={submitDeskNationalGuide} className="grid gap-2 sm:grid-cols-4">
          <Input name="license_no" required placeholder="License no" className="h-10" />
          <Input name="full_name" required placeholder="Full name" className="h-10" />
          <Input name="phone" placeholder="Phone" className="h-10" />
          <Input name="city" placeholder="City" className="h-10" />
          <Button type="submit" className="h-10 sm:col-span-4">
            Submit to vault
          </Button>
        </form>
      </section>

      <section className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-[11px] font-semibold tracking-[0.2em] text-accent uppercase">
            National verified guides
          </h2>
          <p className="text-xs text-muted-foreground">
            {nationalFiltered.length} shown
          </p>
        </div>
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full text-left text-sm">
            <thead className="border-b bg-muted/40">
              <tr>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">License</th>
                <th className="px-3 py-2">Phone</th>
                <th className="px-3 py-2">City</th>
              </tr>
            </thead>
            <tbody>
              {nationalFiltered.length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
                    className="px-3 py-4 text-muted-foreground"
                  >
                    No verified national guides yet — import from vault or
                    submit above.
                  </td>
                </tr>
              ) : (
                nationalFiltered.map((g) => (
                  <tr key={g.id} className="border-b last:border-0">
                    <td className="px-3 py-2">{g.full_name}</td>
                    <td className="px-3 py-2 font-mono text-xs">
                      {g.license_no}
                    </td>
                    <td className="px-3 py-2">{g.phone ?? "—"}</td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {g.city ?? "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-[11px] font-semibold tracking-[0.2em] text-accent uppercase">
            Local guide visits
          </h2>
          <p className="text-xs text-muted-foreground">{guides.length} shown</p>
        </div>
        <PartnersTable rows={guides} kind="guide" />
      </section>

      <section className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-[11px] font-semibold tracking-[0.2em] text-accent uppercase">
            Drivers
          </h2>
          <p className="text-xs text-muted-foreground">{drivers.length} shown</p>
        </div>
        <PartnersTable rows={drivers} kind="driver" />
      </section>
    </DeskListShell>
  );
}
