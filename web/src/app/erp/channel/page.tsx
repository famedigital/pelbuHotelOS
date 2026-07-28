import {
  AckRevisionButton,
  ChannelMapForm,
  ChannelQueueActions,
  ChannelStatusForm,
} from "@/components/erp/ChannelForms";
import { DeskHeader } from "@/components/erp/DeskHeader";
import { getChannexConfig } from "@/lib/channel/channex-client";
import { isDeskAuthenticated } from "@/lib/desk-auth";
import { PELBU_PROPERTY_SLUG } from "@/lib/property";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Channel | Pelbu OS",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function ErpChannelPage() {
  if (!(await isDeskAuthenticated())) redirect("/erp/login");

  const admin = createSupabaseAdminClient();
  const { data: property } = await admin
    .from("properties")
    .select("id")
    .eq("slug", PELBU_PROPERTY_SLUG)
    .single();
  const propertyId = property?.id as string | undefined;
  if (!propertyId) {
    return (
      <div className="min-h-screen bg-ivory">
        <DeskHeader title="Channel" />
        <main className="mx-auto max-w-[1200px] px-6 py-10">
          <p className="text-sm text-maroon">Property not configured.</p>
        </main>
      </div>
    );
  }

  const [
    { data: conn },
    { data: roomTypes },
    { data: maps },
    { data: queue },
    { data: revisions },
  ] = await Promise.all([
    admin
      .from("channel_connections")
      .select(
        "id, status, external_property_id, notes, last_ari_push_at, last_booking_pull_at",
      )
      .eq("property_id", propertyId)
      .eq("provider", "channex")
      .maybeSingle(),
    admin
      .from("room_types")
      .select("id, code, name, inventory_kind")
      .eq("property_id", propertyId)
      .eq("inventory_kind", "sellable_guest")
      .order("code"),
    admin
      .from("channel_room_maps")
      .select(
        "id, room_type_id, external_room_type_id, external_rate_plan_id, is_active, room_types(code)",
      )
      .eq("property_id", propertyId)
      .order("created_at", { ascending: false }),
    admin
      .from("ari_queue")
      .select("id, kind, status, attempts, last_error, created_at")
      .eq("property_id", propertyId)
      .order("created_at", { ascending: false })
      .limit(30),
    admin
      .from("channel_booking_revisions")
      .select(
        "id, external_revision_id, external_booking_id, revision_type, status, received_at, error",
      )
      .eq("property_id", propertyId)
      .order("received_at", { ascending: false })
      .limit(30),
  ]);

  const apiReady = Boolean(getChannexConfig());
  const pendingAri = (queue ?? []).filter((q) => q.status === "pending").length;

  return (
    <div className="min-h-screen bg-ivory">
      <DeskHeader title="Channel" />
      <main className="mx-auto max-w-[1200px] space-y-12 px-6 py-10 md:px-8">
        <section>
          <h2 className="text-xs font-semibold tracking-[0.22em] text-gold uppercase">
            Channex (P6)
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-muted">
            Event-driven ARI outbox + booking revision inbox. Certification needs staging
            credentials, room/rate maps, then flush/ack against Channex — not DIY OTA APIs.
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <Stat label="Connection" value={(conn?.status as string) ?? "missing"} />
            <Stat label="API key" value={apiReady ? "set" : "missing"} />
            <Stat label="Pending ARI" value={String(pendingAri)} />
          </div>
          {conn?.notes ? (
            <p className="mt-3 text-xs text-muted">{conn.notes as string}</p>
          ) : null}
        </section>

        <div className="grid gap-8 lg:grid-cols-3">
          <ChannelStatusForm
            status={(conn?.status as string) ?? "draft"}
            externalPropertyId={(conn?.external_property_id as string | null) ?? null}
          />
          <ChannelMapForm
            roomTypes={(roomTypes ?? []).map((r) => ({
              id: r.id as string,
              code: r.code as string,
              name: r.name as string,
            }))}
          />
          <ChannelQueueActions />
        </div>

        <section>
          <div className="border-b border-espresso/15 pb-2">
            <h2 className="text-xs font-semibold tracking-[0.22em] text-gold uppercase">
              Room maps
            </h2>
          </div>
          {(maps ?? []).length === 0 ? (
            <p className="mt-4 text-sm text-muted">No maps yet — sellable guest types only.</p>
          ) : (
            <ul className="mt-2">
              {(maps ?? []).map((m) => (
                <li
                  key={m.id as string}
                  className="border-b border-espresso/10 py-3 font-mono text-xs text-espresso"
                >
                  {(m.room_types as { code?: string } | null)?.code ?? m.room_type_id} →{" "}
                  {m.external_room_type_id as string}
                  {m.external_rate_plan_id
                    ? ` · rate ${m.external_rate_plan_id as string}`
                    : ""}
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="grid gap-10 lg:grid-cols-2">
          <section>
            <div className="border-b border-espresso/15 pb-2">
              <h2 className="text-xs font-semibold tracking-[0.22em] text-gold uppercase">
                ARI queue
              </h2>
            </div>
            {(queue ?? []).length === 0 ? (
              <p className="mt-4 text-sm text-muted">Queue empty.</p>
            ) : (
              <ul className="mt-2">
                {(queue ?? []).map((q) => (
                  <li
                    key={q.id as string}
                    className="border-b border-espresso/10 py-3 text-sm"
                  >
                    <p className="font-medium text-espresso">
                      {q.kind as string} · {q.status as string}
                    </p>
                    <p className="mt-0.5 text-xs text-muted">
                      {String(q.created_at).slice(0, 16).replace("T", " ")} · attempts{" "}
                      {q.attempts as number}
                      {q.last_error ? ` · ${String(q.last_error).slice(0, 80)}` : ""}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <div className="border-b border-espresso/15 pb-2">
              <h2 className="text-xs font-semibold tracking-[0.22em] text-gold uppercase">
                Booking revisions
              </h2>
            </div>
            {(revisions ?? []).length === 0 ? (
              <p className="mt-4 text-sm text-muted">
                No revisions — pull feed or POST webhook{" "}
                <code className="font-mono text-[11px]">/api/channel/channex/webhook</code>.
              </p>
            ) : (
              <ul className="mt-2">
                {(revisions ?? []).map((r) => (
                  <li
                    key={r.id as string}
                    className="flex flex-wrap items-baseline justify-between gap-2 border-b border-espresso/10 py-3 text-sm"
                  >
                    <div>
                      <p className="font-medium text-espresso">
                        {r.revision_type as string} · {r.status as string}
                      </p>
                      <p className="mt-0.5 font-mono text-[11px] text-muted">
                        {r.external_revision_id as string}
                      </p>
                    </div>
                    {r.status === "received" || r.status === "imported" ? (
                      <AckRevisionButton revisionId={r.id as string} />
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-espresso/10 bg-white px-4 py-4">
      <p className="text-[10px] font-semibold tracking-[0.18em] text-gold uppercase">
        {label}
      </p>
      <p className="mt-2 text-lg text-espresso">{value}</p>
    </div>
  );
}
