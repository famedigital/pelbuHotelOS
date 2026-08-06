import { ConfirmedAgentsContactTable } from "@/components/erp/ConfirmedAgentsContactTable";
import { DeskEmptyState } from "@/components/erp/DeskEmptyState";
import { DeskListShell } from "@/components/erp/DeskListShell";
import { DeskMetricRow } from "@/components/erp/DeskMetricRow";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { isDeskAuthenticated } from "@/lib/desk-auth";
import { requireDeskPropertyId } from "@/lib/desk-property";
import {
  confirmedAgentsCsv,
  loadConfirmedAgentsContactList,
} from "@/lib/erp/confirmed-agents";
import { thimphuToday } from "@/lib/erp-lists";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Confirmed agents · contact list | Pelbu OS",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

function addMonths(iso: string, n: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + n);
  return d.toISOString().slice(0, 10);
}

type Props = {
  searchParams: Promise<{
    from?: string;
    to?: string;
    q?: string;
    mode?: string;
  }>;
};

/**
 * Reservation staff call/email sheet: every agent with confirmed rooms
 * in the window (eZee migration outreach).
 */
export default async function ConfirmedAgentsPage({ searchParams }: Props) {
  if (!(await isDeskAuthenticated())) redirect("/erp/login");

  const sp = await searchParams;
  const today = thimphuToday();
  const from =
    sp.from && /^\d{4}-\d{2}-\d{2}$/.test(sp.from) ? sp.from : today;
  const to =
    sp.to && /^\d{4}-\d{2}-\d{2}$/.test(sp.to)
      ? sp.to
      : addMonths(today, 6);
  const includeCheckedIn = sp.mode !== "confirmed_only";
  const q = (sp.q ?? "").trim().toLowerCase();

  const admin = createSupabaseAdminClient();
  const propertyId = await requireDeskPropertyId();

  let rows = await loadConfirmedAgentsContactList(admin, {
    propertyId,
    from,
    to: addDaysExclusive(to),
    includeCheckedIn,
  });

  if (q) {
    rows = rows.filter((r) => {
      const hay = [
        r.company_name,
        r.contact_name,
        r.contact_phone,
        r.contact_email,
        r.market,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }

  const missingContact = rows.filter(
    (r) => r.missing_phone || r.missing_email,
  ).length;
  const withPhone = rows.filter((r) => r.contact_phone).length;
  const withEmail = rows.filter((r) => r.contact_email).length;
  const totalBookings = rows.reduce((n, r) => n + r.booking_count, 0);

  const exportQs = new URLSearchParams({
    from,
    to,
    mode: includeCheckedIn ? "active" : "confirmed_only",
  });
  if (sp.q) exportQs.set("q", sp.q);

  return (
    <DeskListShell
      title="Confirmed agents"
      eyebrow="Channels · Agents"
      heading="Call & email list"
      blurb={`Agents with confirmed rooms ${from} → ${to}. Tap phone / email to reach them. Migration helper while leaving eZee.`}
      filters={
        <form
          className="flex flex-wrap items-end gap-2"
          action="/erp/agents/confirmed"
          method="get"
        >
          <div className="space-y-1">
            <Label htmlFor="ca-from" className="text-xs">
              From
            </Label>
            <Input
              id="ca-from"
              type="date"
              name="from"
              defaultValue={from}
              className="h-9 w-[10.5rem]"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="ca-to" className="text-xs">
              To
            </Label>
            <Input
              id="ca-to"
              type="date"
              name="to"
              defaultValue={to}
              className="h-9 w-[10.5rem]"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="ca-q" className="text-xs">
              Search
            </Label>
            <Input
              id="ca-q"
              name="q"
              defaultValue={sp.q ?? ""}
              placeholder="Name, phone, email…"
              className="h-9 w-[12rem]"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="ca-mode" className="text-xs">
              Status
            </Label>
            <select
              id="ca-mode"
              name="mode"
              defaultValue={includeCheckedIn ? "active" : "confirmed_only"}
              className="h-9 rounded-md border bg-background px-2 text-sm"
            >
              <option value="active">Confirmed + in-house</option>
              <option value="confirmed_only">Confirmed only</option>
            </select>
          </div>
          <Button type="submit" size="sm" className="h-9">
            Apply
          </Button>
          <Button asChild type="button" variant="outline" size="sm" className="h-9">
            <Link href={`/erp/agents/confirmed/export?${exportQs.toString()}`}>
              Download CSV
            </Link>
          </Button>
          <Button asChild type="button" variant="ghost" size="sm" className="h-9">
            <Link href="/erp/agents">All agents</Link>
          </Button>
          <Button asChild type="button" variant="outline" size="sm" className="h-9">
            <Link href="/erp/agents/call-tasks">Call tasks</Link>
          </Button>
        </form>
      }
      metrics={
        <DeskMetricRow
          metrics={[
            {
              label: "Agents",
              value: String(rows.length),
              hint: "With confirmed rooms in range",
            },
            {
              label: "Bookings",
              value: String(totalBookings),
            },
            {
              label: "With phone",
              value: String(withPhone),
              tone: withPhone === rows.length ? "accent" : "default",
            },
            {
              label: "Missing contact",
              value: String(missingContact),
              tone: missingContact > 0 ? "destructive" : "default",
              hint: "Need phone or email filled on agent",
            },
            {
              label: "With email",
              value: String(withEmail),
            },
          ]}
        />
      }
    >
      {rows.length === 0 ? (
        <DeskEmptyState
          title="No agents with confirmed rooms"
          description="Widen the date range, or check that eZee bookings are linked to agents."
        />
      ) : (
        <ConfirmedAgentsContactTable rows={rows} />
      )}
    </DeskListShell>
  );
}

function addDaysExclusive(iso: string): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}
