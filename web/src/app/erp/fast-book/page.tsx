import { FastBookForm } from "@/components/erp/FastBookForm";
import { DeskHeader } from "@/components/erp/DeskHeader";
import { deskPinConfigured, isDeskAuthenticated } from "@/lib/desk-auth";
import { PELBU_PROPERTY_SLUG } from "@/lib/property";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";

export const metadata = {
  title: "Fast book | Pelbu OS",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function FastBookPage() {
  if (!(await isDeskAuthenticated())) {
    redirect("/erp/login");
  }

  const admin = createSupabaseAdminClient();

  const { data: property } = await admin
    .from("properties")
    .select("id")
    .eq("slug", PELBU_PROPERTY_SLUG)
    .single();

  const [{ data: roomTypes }, { data: agents }] = await Promise.all([
    property
      ? admin
          .from("room_types")
          .select("id, code, name, inventory_kind, unit_count")
          .eq("property_id", property.id)
          .order("code")
      : Promise.resolve({ data: [] }),
    admin
      .from("agents")
      .select("id, company_name, market, status")
      .in("status", ["approved", "demo"])
      .order("company_name"),
  ]);

  return (
    <div className="min-h-screen bg-ivory">
      <DeskHeader title="Fast book" />
      <main className="mx-auto max-w-[1200px] space-y-6 px-6 py-10 md:px-8">
        {!deskPinConfigured() ? (
          <p className="border border-gold/40 bg-gold/5 px-4 py-3 text-sm text-espresso">
            Dev mode: desk PIN not set. Add <code className="font-mono">DESK_PIN</code>{" "}
            before production.
          </p>
        ) : null}

        <p className="text-sm text-muted-foreground">
          One screen: dates → rooms → pax → agent → guide no → guest / guide /
          driver beds → save.
        </p>

        <FastBookForm
          roomTypes={(roomTypes ?? []).map((r) => ({
            id: r.id as string,
            code: r.code as string,
            name: r.name as string,
            inventory_kind: r.inventory_kind as string,
            unit_count: Number(r.unit_count ?? 0),
          }))}
          agents={(agents ?? []).map((a) => ({
            id: a.id as string,
            company_name: a.company_name as string,
            market: a.market as string,
            status: a.status as string,
          }))}
        />
      </main>
    </div>
  );
}
