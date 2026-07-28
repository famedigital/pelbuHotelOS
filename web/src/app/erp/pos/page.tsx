import { DeskHeader } from "@/components/erp/DeskHeader";
import { DeskPosForm } from "@/components/erp/DeskPosForm";
import { GuestServiceForm } from "@/components/erp/GuestServiceForm";
import { deskPinConfigured, isDeskAuthenticated } from "@/lib/desk-auth";
import { loadMenuByOutlets } from "@/lib/menu-loader";
import { PELBU_PROPERTY_SLUG } from "@/lib/property";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";

export const metadata = {
  title: "POS | Pelbu OS",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function ErpPosPage() {
  if (!(await isDeskAuthenticated())) {
    redirect("/erp/login");
  }

  const admin = createSupabaseAdminClient();
  const { data: property } = await admin
    .from("properties")
    .select("id")
    .eq("slug", PELBU_PROPERTY_SLUG)
    .single();

  const [items, { data: bookings }] = await Promise.all([
    loadMenuByOutlets(["cafe", "pastry", "restaurant", "bar"]),
    property
      ? admin
          .from("bookings")
          .select("id, contact_name, check_in, check_out, status")
          .eq("property_id", property.id)
          .in("status", ["pending", "confirmed", "checked_in"])
          .order("check_in", { ascending: false })
          .limit(40)
      : Promise.resolve({ data: [] }),
  ]);

  const bookingOptions = (bookings ?? []).map((b) => ({
    id: b.id as string,
    contact_name: (b.contact_name as string | null) ?? null,
    check_in: b.check_in as string,
    check_out: b.check_out as string,
    status: b.status as string,
  }));

  return (
    <div className="min-h-screen bg-ivory">
      <DeskHeader title="POS" />
      <main className="mx-auto grid max-w-[1100px] gap-8 px-6 py-10 md:grid-cols-[minmax(0,1fr)_320px] md:px-8">
        {!deskPinConfigured() ? (
          <p className="border border-gold/40 bg-gold/5 px-4 py-3 text-sm text-espresso md:col-span-2">
            Dev mode: desk PIN not set. Add <code className="font-mono">DESK_PIN</code>{" "}
            before production.
          </p>
        ) : null}

        <div className="space-y-4">
          <p className="text-sm text-muted">
            Create a kitchen ticket for walk-in cash or charge straight to a guest folio.
          </p>
          <DeskPosForm items={items} bookings={bookingOptions} />
        </div>

        <aside className="space-y-4">
          <GuestServiceForm bookings={bookingOptions} />
          <a
            href="/erp"
            className="inline-flex min-h-11 items-center text-sm text-espresso underline-offset-4 hover:underline"
          >
            Back to order board
          </a>
        </aside>
      </main>
    </div>
  );
}
