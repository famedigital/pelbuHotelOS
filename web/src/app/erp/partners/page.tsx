import { DeskHeader } from "@/components/erp/DeskHeader";
import { PartnersTable } from "@/components/erp/PartnersTable";
import { deskPinConfigured, isDeskAuthenticated } from "@/lib/desk-auth";
import { PELBU_PROPERTY_SLUG } from "@/lib/property";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";

export const metadata = {
  title: "Partners | Pelbu OS",
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

  const { data: property } = await admin
    .from("properties")
    .select("id")
    .eq("slug", PELBU_PROPERTY_SLUG)
    .single();

  if (!property) {
    return (
      <div className="min-h-screen bg-ivory">
        <DeskHeader title="Partners" />
        <main className="mx-auto max-w-[1100px] px-6 py-10">
          <p className="text-sm text-muted">Property not configured.</p>
        </main>
      </div>
    );
  }

  const [{ data: guideRows }, { data: driverRows }] = await Promise.all([
    admin
      .from("guides")
      .select(
        "id, full_name, phone, guide_number, visit_count, last_seen_at",
      )
      .eq("property_id", property.id as string)
      .order("visit_count", { ascending: false })
      .limit(200),
    admin
      .from("drivers")
      .select(
        "id, full_name, phone, vehicle_no, license_no, visit_count, last_seen_at",
      )
      .eq("property_id", property.id as string)
      .order("visit_count", { ascending: false })
      .limit(200),
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

  return (
    <div className="min-h-screen bg-ivory">
      <DeskHeader title="Partners" />
      <main className="mx-auto max-w-[1100px] space-y-8 px-6 py-10 md:px-8">
        {!deskPinConfigured() ? (
          <p className="border border-gold/40 bg-gold/5 px-4 py-3 text-sm text-espresso">
            Dev mode: desk PIN not set.
          </p>
        ) : null}

        <header className="space-y-2">
          <p className="text-[11px] font-semibold tracking-[0.28em] text-gold uppercase">
            Repeat partners
          </p>
          <h1 className="text-3xl text-espresso">Guides &amp; drivers</h1>
          <p className="max-w-prose text-sm text-muted">
            Every guide and driver who has brought guests to the property. Visit
            counts help reception recognize returning partners — the foundation
            for future perks and discounts.
          </p>
        </header>

        <form className="flex items-center gap-2" action="/erp/partners" method="get">
          <label className="block flex-1 text-sm text-espresso">
            <span className="sr-only">Search partners</span>
            <input
              type="search"
              name="q"
              defaultValue={q ?? ""}
              placeholder="Search by name, number, phone, vehicle…"
              className="mt-0 w-full rounded-sm border border-espresso/15 bg-white px-3 py-2.5 text-sm text-espresso outline-none transition-colors focus:border-gold focus:ring-2 focus:ring-gold/20"
            />
          </label>
          <button
            type="submit"
            className="inline-flex min-h-11 items-center rounded-sm border border-espresso/20 px-4 text-sm text-espresso transition-colors hover:border-espresso/40 hover:bg-espresso/[0.03]"
          >
            Search
          </button>
        </form>

        <section className="space-y-3">
          <div className="flex items-baseline justify-between">
            <h2 className="text-xs font-semibold tracking-[0.22em] text-gold uppercase">
              Guides
            </h2>
            <p className="text-xs text-muted">{guides.length} shown</p>
          </div>
          <PartnersTable rows={guides} kind="guide" />
        </section>

        <section className="space-y-3">
          <div className="flex items-baseline justify-between">
            <h2 className="text-xs font-semibold tracking-[0.22em] text-gold uppercase">
              Drivers
            </h2>
            <p className="text-xs text-muted">{drivers.length} shown</p>
          </div>
          <PartnersTable rows={drivers} kind="driver" />
        </section>
      </main>
    </div>
  );
}
