import { DeskHeader } from "@/components/erp/DeskHeader";
import { isDeskAuthenticated } from "@/lib/desk-auth";
import { formatBtn } from "@/lib/pricing";
import {
  listProperties,
  resolveActivePropertyId,
} from "@/lib/property-context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";

export const metadata = {
  title: "Group desk | Pelbu OS",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function GroupDeskPage() {
  if (!(await isDeskAuthenticated())) redirect("/erp/login");

  const admin = createSupabaseAdminClient();
  const [activeId, properties] = await Promise.all([
    resolveActivePropertyId(admin),
    listProperties(admin),
  ]);

  const propertyIds = properties.map((p) => p.id);
  const nameById = Object.fromEntries(properties.map((p) => [p.id, p.name]));

  const [
    { data: bookings },
    { data: holds },
    { data: links },
    { data: payments },
  ] = await Promise.all([
    admin
      .from("bookings")
      .select(
        "id, property_id, contact_name, check_in, check_out, status, source, created_at",
      )
      .in("property_id", propertyIds.length ? propertyIds : ["00000000-0000-0000-0000-000000000000"])
      .in("status", ["held", "confirmed", "checked_in", "pending"])
      .order("check_in", { ascending: true })
      .limit(80),
    admin
      .from("bookings")
      .select("id, property_id, status")
      .eq("status", "held")
      .in("property_id", propertyIds.length ? propertyIds : ["00000000-0000-0000-0000-000000000000"]),
    admin
      .from("payment_links")
      .select("id, property_id, status, amount_btn")
      .eq("status", "open")
      .in("property_id", propertyIds.length ? propertyIds : ["00000000-0000-0000-0000-000000000000"]),
    admin
      .from("payments")
      .select("property_id, amount_btn, kind, created_at")
      .gte(
        "created_at",
        new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString(),
      )
      .in("property_id", propertyIds.length ? propertyIds : ["00000000-0000-0000-0000-000000000000"]),
  ]);

  const heldByProp = new Map<string, number>();
  for (const h of holds ?? []) {
    const pid = h.property_id as string;
    heldByProp.set(pid, (heldByProp.get(pid) ?? 0) + 1);
  }

  const payByProp = new Map<string, number>();
  for (const p of payments ?? []) {
    const pid = p.property_id as string;
    payByProp.set(pid, (payByProp.get(pid) ?? 0) + Number(p.amount_btn ?? 0));
  }

  const openLinkTotal = (links ?? []).reduce(
    (s, l) => s + Number(l.amount_btn ?? 0),
    0,
  );

  return (
    <div className="min-h-screen bg-ivory">
      <DeskHeader
        title="Group"
        properties={properties}
        activePropertyId={activeId}
      />
      <main className="mx-auto max-w-[1200px] space-y-12 px-6 py-10 md:px-8">
        <section>
          <h2 className="text-lg font-medium text-espresso">Hotels</h2>
          <ul className="mt-4 divide-y divide-espresso/10 border border-espresso/10 bg-white">
            {properties.map((p) => (
              <li
                key={p.id}
                className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-3 text-sm"
              >
                <div>
                  <p className="font-medium text-espresso">{p.name}</p>
                  <p className="text-xs text-muted">
                    {p.slug}
                    {!p.setup_completed_at ? " · setup incomplete" : ""}
                    {" · "}
                    {(p.income_streams.outlets ?? []).join(", ") || "rooms only"}
                  </p>
                </div>
                <div className="text-right text-xs text-muted">
                  <p>Holds open: {heldByProp.get(p.id) ?? 0}</p>
                  <p>MTD payments: {formatBtn(payByProp.get(p.id) ?? 0)}</p>
                  {!p.setup_completed_at ? (
                    <a
                      href={`/erp/properties/${p.id}/setup`}
                      className="text-maroon underline-offset-4 hover:underline"
                    >
                      Finish setup
                    </a>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-medium text-espresso">
            Open deposit links
          </h2>
          <p className="mt-1 text-sm text-muted">
            Across all hotels · {formatBtn(openLinkTotal)} awaiting payment
          </p>
        </section>

        <section>
          <h2 className="text-lg font-medium text-espresso">
            Reservations (all hotels)
          </h2>
          <ul className="mt-4 divide-y divide-espresso/10 border border-espresso/10 bg-white">
            {(bookings ?? []).length === 0 ? (
              <li className="px-4 py-6 text-sm text-muted">No open reservations.</li>
            ) : (
              (bookings ?? []).map((b) => (
                <li key={b.id as string} className="px-4 py-3 text-sm">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="font-medium text-espresso">
                      {nameById[b.property_id as string] ?? "Hotel"} ·{" "}
                      {(b.contact_name as string) ?? "Guest"}
                    </p>
                    <span className="text-xs uppercase tracking-wide text-muted">
                      {b.status as string}
                    </span>
                  </div>
                  <p className="mt-1 text-muted">
                    {b.check_in as string} → {b.check_out as string} ·{" "}
                    {b.source as string}
                  </p>
                </li>
              ))
            )}
          </ul>
        </section>
      </main>
    </div>
  );
}
