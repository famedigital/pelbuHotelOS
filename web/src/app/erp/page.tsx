import { DeskHeader } from "@/components/erp/DeskHeader";
import { deskPinConfigured, isDeskAuthenticated } from "@/lib/desk-auth";
import { formatBtn } from "@/lib/pricing";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

export const metadata = {
  title: "Desk inbox | Pelbu OS",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

function fmtDate(value: string | null | undefined): string {
  if (!value) return "—";
  return value;
}

export default async function ErpInboxPage() {
  if (!(await isDeskAuthenticated())) {
    redirect("/erp/login");
  }

  const admin = createSupabaseAdminClient();

  const [
    { data: bookings },
    { data: orders },
    { data: services },
    { data: enquiries },
    { data: agents },
  ] = await Promise.all([
    admin
      .from("bookings")
      .select(
        "id, contact_name, contact_phone, check_in, check_out, adults, rooms, status, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(25),
    admin
      .from("orders")
      .select(
        "id, customer_name, phone, outlet, delivery_type, total_btn, status, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(25),
    admin
      .from("service_requests")
      .select(
        "id, kind, contact_name, contact_phone, preferred_on, preferred_time, party_size, status, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(25),
    admin
      .from("enquiries")
      .select("id, topic, contact_name, contact_phone, message, status, created_at")
      .order("created_at", { ascending: false })
      .limit(25),
    admin
      .from("agents")
      .select(
        "id, company_name, market, contact_name, contact_phone, status, wants_mou, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(25),
  ]);

  return (
    <div className="min-h-screen bg-ivory">
      <DeskHeader title="Inbox" />
      <main className="mx-auto max-w-[1200px] space-y-10 px-6 py-10 md:px-8">
        {!deskPinConfigured() ? (
          <p className="border border-gold/40 bg-gold/5 px-4 py-3 text-sm text-espresso">
            Dev mode: desk PIN not set. Add <code className="font-mono">DESK_PIN</code>{" "}
            before production.
          </p>
        ) : null}

        <InboxSection title="Room bookings" empty="No bookings yet.">
          {(bookings ?? []).map((row) => (
            <li key={row.id as string} className="border-b border-espresso/10 py-3 text-sm">
              <p className="font-medium text-espresso">
                {(row.contact_name as string) ?? "Guest"} · {row.contact_phone as string}
              </p>
              <p className="text-muted">
                {fmtDate(row.check_in as string)} → {fmtDate(row.check_out as string)} ·{" "}
                {row.adults as number} adults · {row.rooms as number} rooms ·{" "}
                <span className="uppercase tracking-wide">{row.status as string}</span>
              </p>
              <p className="mt-1 font-mono text-xs text-espresso/50">{row.id as string}</p>
            </li>
          ))}
        </InboxSection>

        <InboxSection title="Cafe / pastry orders" empty="No orders yet.">
          {(orders ?? []).map((row) => (
            <li key={row.id as string} className="border-b border-espresso/10 py-3 text-sm">
              <p className="font-medium text-espresso">
                {row.customer_name as string} · {row.phone as string}
              </p>
              <p className="text-muted">
                {row.outlet as string} · {row.delivery_type as string} ·{" "}
                {formatBtn(Number(row.total_btn))} ·{" "}
                <span className="uppercase tracking-wide">{row.status as string}</span>
              </p>
              <p className="mt-1 font-mono text-xs text-espresso/50">{row.id as string}</p>
            </li>
          ))}
        </InboxSection>

        <InboxSection title="Spa / meeting requests" empty="No service requests yet.">
          {(services ?? []).map((row) => (
            <li key={row.id as string} className="border-b border-espresso/10 py-3 text-sm">
              <p className="font-medium text-espresso">
                {row.kind as string} · {row.contact_name as string} ·{" "}
                {row.contact_phone as string}
              </p>
              <p className="text-muted">
                {fmtDate(row.preferred_on as string)}
                {row.preferred_time ? ` · ${row.preferred_time}` : ""} · party{" "}
                {row.party_size as number} ·{" "}
                <span className="uppercase tracking-wide">{row.status as string}</span>
              </p>
              <p className="mt-1 font-mono text-xs text-espresso/50">{row.id as string}</p>
            </li>
          ))}
        </InboxSection>

        <InboxSection title="Enquiries" empty="No enquiries yet.">
          {(enquiries ?? []).map((row) => (
            <li key={row.id as string} className="border-b border-espresso/10 py-3 text-sm">
              <p className="font-medium text-espresso">
                {row.topic as string} · {row.contact_name as string} ·{" "}
                {row.contact_phone as string}
              </p>
              <p className="text-muted line-clamp-2">{row.message as string}</p>
              <p className="mt-1 font-mono text-xs text-espresso/50">{row.id as string}</p>
            </li>
          ))}
        </InboxSection>

        <InboxSection title="Agent applications" empty="No agent applications yet.">
          {(agents ?? []).map((row) => (
            <li key={row.id as string} className="border-b border-espresso/10 py-3 text-sm">
              <p className="font-medium text-espresso">
                {row.company_name as string} · {row.market as string}
              </p>
              <p className="text-muted">
                {(row.contact_name as string) ?? "—"} ·{" "}
                {(row.contact_phone as string) ?? "—"} · MoU{" "}
                {row.wants_mou ? "yes" : "no"} ·{" "}
                <span className="uppercase tracking-wide">{row.status as string}</span>
              </p>
              <p className="mt-1 font-mono text-xs text-espresso/50">{row.id as string}</p>
            </li>
          ))}
        </InboxSection>
      </main>
    </div>
  );
}

function InboxSection({
  title,
  empty,
  children,
}: {
  title: string;
  empty: string;
  children: ReactNode;
}) {
  const items = Array.isArray(children) ? children.filter(Boolean) : [children];
  const list = items.flat().filter(Boolean);
  return (
    <section>
      <h2 className="text-sm font-medium tracking-[0.18em] text-gold uppercase">
        {title}
      </h2>
      {list.length === 0 ? (
        <p className="mt-3 text-sm text-muted">{empty}</p>
      ) : (
        <ul className="mt-3 border-t border-espresso/10">{list}</ul>
      )}
    </section>
  );
}
