import {
  AddToGroupForm,
  BookingGroupCreateForm,
} from "@/components/erp/P9OpsForms";
import { Card, CardContent } from "@/components/ui/card";
import {
  BOOKABLE_AGENT_STATUSES,
} from "@/lib/agents/status";
import { isDeskAuthenticated } from "@/lib/desk-auth";
import { fmtDate } from "@/lib/erp-lists";
import { requireDeskPropertyId } from "@/lib/desk-property";
import { formatBtn } from "@/lib/pricing";
import {
  listProperties,
  resolveActivePropertyId,
} from "@/lib/property-context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";

export const metadata = {
  title: "Groups",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

function StatusPill({ value }: { value: string }) {
  if (!value) return null;
  const tone =
    value === "open" || value === "checked_in"
      ? "border-citrus/40 bg-citrus-tint/60 text-citrus"
      : value === "tentative" || value === "pending"
        ? "border-destructive/30 bg-destructive/5 text-destructive"
        : "border-border bg-muted text-muted-foreground";
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide whitespace-nowrap ${tone}`}
    >
      {value.replace(/_/g, " ")}
    </span>
  );
}

export default async function GroupDeskPage() {
  if (!(await isDeskAuthenticated())) redirect("/erp/login");

  const admin = createSupabaseAdminClient();
  const [, properties, propertyId] = await Promise.all([
    resolveActivePropertyId(admin),
    listProperties(admin),
    requireDeskPropertyId(),
  ]);

  const [
    { data: groups },
    { data: agents },
    { data: bookings },
    { data: payments },
  ] = await Promise.all([
    admin
      .from("booking_groups")
      .select(
        "id, name, status, check_in, check_out, notes, agents(company_name), booking_group_members(booking_id, bookings(id, contact_name, status, check_in, check_out))",
      )
      .eq("property_id", propertyId)
      .order("created_at", { ascending: false })
      .limit(50),
    admin
      .from("agents")
      .select("id, company_name, status")
      .in("status", [...BOOKABLE_AGENT_STATUSES])
      .order("company_name")
      .limit(1000),
    admin
      .from("bookings")
      .select("id, contact_name, check_in, status")
      .eq("property_id", propertyId)
      .in("status", ["held", "pending", "confirmed", "checked_in"])
      .order("check_in", { ascending: false })
      .limit(80),
    admin
      .from("payments")
      .select("property_id, amount_btn, created_at")
      .gte(
        "created_at",
        new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString(),
      )
      .in(
        "property_id",
        properties.map((p) => p.id).length
          ? properties.map((p) => p.id)
          : ["00000000-0000-0000-0000-000000000000"],
      ),
  ]);

  const payByProp = new Map<string, number>();
  for (const p of payments ?? []) {
    const pid = p.property_id as string;
    payByProp.set(pid, (payByProp.get(pid) ?? 0) + Number(p.amount_btn ?? 0));
  }

  const bookingOpts = (bookings ?? []).map((b) => ({
    id: b.id as string,
    label: `${(b.contact_name as string) ?? "Guest"} · ${b.check_in as string} · ${(b.id as string).slice(0, 6)}`,
  }));

  return (
    <div className="erp mx-auto w-full max-w-[1200px] space-y-10 p-4 md:p-6">
      <header className="space-y-1.5">
        <p className="text-[11px] font-semibold tracking-[0.2em] text-accent uppercase">
          Front desk
        </p>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Group bookings
        </h1>
        <p className="max-w-prose text-sm text-muted-foreground">
          Create a group master and attach reservations for a shared rooming
          list. Multi-property month payments:{" "}
          {formatBtn(
            [...payByProp.values()].reduce((a, b) => a + b, 0),
          )}{" "}
          MTD.
        </p>
      </header>

      <BookingGroupCreateForm
        agents={(agents ?? []).map((a) => ({
          id: a.id as string,
          company_name: a.company_name as string,
        }))}
        bookings={bookingOpts}
      />

      <section className="space-y-4">
        <h2 className="text-[11px] font-semibold tracking-[0.2em] text-accent uppercase">
          Groups
        </h2>
        {(groups ?? []).length === 0 ? (
          <Card>
            <CardContent className="py-6 text-sm text-muted-foreground">
              No groups yet — create one above.
            </CardContent>
          </Card>
        ) : (
          (groups ?? []).map((g) => {
            const agent = g.agents as
              | { company_name?: string }
              | { company_name?: string }[]
              | null;
            const agentName = Array.isArray(agent)
              ? agent[0]?.company_name
              : agent?.company_name;
            const members = (g.booking_group_members as {
              booking_id: string;
              bookings:
                | {
                    id: string;
                    contact_name: string | null;
                    status: string;
                    check_in: string;
                    check_out: string;
                  }
                | {
                    id: string;
                    contact_name: string | null;
                    status: string;
                    check_in: string;
                    check_out: string;
                  }[]
                | null;
            }[] | null) ?? [];

            return (
              <Card key={g.id as string} className="gap-0 p-5">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div>
                    <h3 className="text-lg font-medium text-foreground">
                      {g.name as string}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      {agentName ?? "No agent"} ·{" "}
                      {fmtDate(g.check_in as string | null)} →{" "}
                      {fmtDate(g.check_out as string | null)}
                    </p>
                  </div>
                  <StatusPill value={g.status as string} />
                </div>
                <ul className="mt-4 divide-y border-t">
                  {members.length === 0 ? (
                    <li className="py-3 text-sm text-muted-foreground">
                      No rooming list yet.
                    </li>
                  ) : (
                    members.map((m) => {
                      const b = Array.isArray(m.bookings)
                        ? m.bookings[0]
                        : m.bookings;
                      if (!b) return null;
                      return (
                        <li
                          key={m.booking_id}
                          className="flex flex-wrap items-baseline justify-between gap-2 py-3 text-sm"
                        >
                          <span className="font-medium text-foreground">
                            {b.contact_name ?? "Guest"}
                          </span>
                          <span className="text-muted-foreground">
                            {fmtDate(b.check_in)} → {fmtDate(b.check_out)} ·{" "}
                            {b.status}
                          </span>
                          <a
                            href={`/erp/check-in?id=${b.id}`}
                            className="text-accent underline-offset-4 hover:underline"
                          >
                            Open →
                          </a>
                        </li>
                      );
                    })
                  )}
                </ul>
                <AddToGroupForm
                  groupId={g.id as string}
                  bookings={bookingOpts}
                />
              </Card>
            );
          })
        )}
      </section>
    </div>
  );
}
