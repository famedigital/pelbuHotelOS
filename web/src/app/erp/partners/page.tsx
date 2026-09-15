import { DeskListShell } from "@/components/erp/DeskListShell";
import { PartnersTable } from "@/components/erp/PartnersTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { isDeskAuthenticated } from "@/lib/desk-auth";
import { DEFAULT_PROPERTY_SLUG } from "@/lib/property";
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

  const { data: property } = await admin
    .from("properties")
    .select("id")
    .eq("slug", DEFAULT_PROPERTY_SLUG)
    .single();

  if (!property) {
    return (
      <DeskListShell eyebrow="Directory" heading="Guides & drivers">
        <p className="text-sm text-muted-foreground">Property not configured.</p>
      </DeskListShell>
    );
  }

  const [{ data: guideRows }, { data: driverRows }] = await Promise.all([
    admin
      .from("guides")
      .select(
        "id, full_name, phone, guide_number, visit_count, last_seen_at, discount_pct",
      )
      .eq("property_id", property.id as string)
      .order("visit_count", { ascending: false })
      .limit(200),
    admin
      .from("drivers")
      .select(
        "id, full_name, phone, vehicle_no, license_no, visit_count, last_seen_at, discount_pct",
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
    <DeskListShell
      eyebrow="Repeat partners"
      heading="Guides & drivers"
      blurb="Every guide and driver who has brought guests to the property. Set a suggested discount % for returning partners — desk applies it on fast-book / rate override."
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
      <section className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-[11px] font-semibold tracking-[0.2em] text-accent uppercase">
            Guides
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
