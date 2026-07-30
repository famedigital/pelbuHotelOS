import {
  AckRevisionButton,
  ChannelMapForm,
  ChannelQueueActions,
  ChannelStatusForm,
} from "@/components/erp/ChannelForms";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
      <div className="erp mx-auto w-full max-w-[1200px] p-6">
        <p className="text-sm text-destructive">Property not configured.</p>
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
    <div className="erp mx-auto w-full max-w-[1200px] space-y-10 p-4 md:p-6">
      <section className="space-y-3">
        <div className="space-y-1">
          <p className="text-[11px] font-semibold tracking-[0.2em] text-accent uppercase">
            Channex (P6)
          </p>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Event-driven ARI outbox + booking revision inbox. Certification needs staging
            credentials, room/rate maps, then flush/ack against Channex — not DIY OTA APIs.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Stat label="Connection" value={(conn?.status as string) ?? "missing"} />
          <Stat label="API key" value={apiReady ? "set" : "missing"} />
          <Stat label="Pending ARI" value={String(pendingAri)} />
        </div>
        {conn?.notes ? (
          <p className="text-xs text-muted-foreground">{conn.notes as string}</p>
        ) : null}
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
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

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-[11px] font-semibold tracking-[0.2em] text-accent uppercase">
            Room maps
          </CardTitle>
        </CardHeader>
        <CardContent>
          {(maps ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No maps yet — sellable guest types only.
            </p>
          ) : (
            <ul className="divide-y">
              {(maps ?? []).map((m) => (
                <li
                  key={m.id as string}
                  className="py-3 font-mono text-xs text-foreground"
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
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-[11px] font-semibold tracking-[0.2em] text-accent uppercase">
              ARI queue
            </CardTitle>
          </CardHeader>
          <CardContent>
            {(queue ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">Queue empty.</p>
            ) : (
              <ul className="divide-y">
                {(queue ?? []).map((q) => (
                  <li key={q.id as string} className="py-3 text-sm">
                    <p className="font-medium text-foreground">
                      {q.kind as string} · {q.status as string}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {String(q.created_at).slice(0, 16).replace("T", " ")} · attempts{" "}
                      {q.attempts as number}
                      {q.last_error ? ` · ${String(q.last_error).slice(0, 80)}` : ""}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-[11px] font-semibold tracking-[0.2em] text-accent uppercase">
              Booking revisions
            </CardTitle>
          </CardHeader>
          <CardContent>
            {(revisions ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No revisions — pull feed or POST webhook{" "}
                <code className="font-mono text-[11px]">/api/channel/channex/webhook</code>.
              </p>
            ) : (
              <ul className="divide-y">
                {(revisions ?? []).map((r) => (
                  <li
                    key={r.id as string}
                    className="flex flex-wrap items-baseline justify-between gap-2 py-3 text-sm"
                  >
                    <div>
                      <p className="font-medium text-foreground">
                        {r.revision_type as string} · {r.status as string}
                      </p>
                      <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
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
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card className="gap-2 py-4">
      <CardContent>
        <p className="text-[10px] font-semibold tracking-[0.18em] text-accent uppercase">
          {label}
        </p>
        <p className="mt-2 text-lg font-semibold text-foreground">{value}</p>
      </CardContent>
    </Card>
  );
}
