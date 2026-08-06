import { DeskEmptyState } from "@/components/erp/DeskEmptyState";
import { DeskListShell } from "@/components/erp/DeskListShell";
import { DeskMetricRow } from "@/components/erp/DeskMetricRow";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { isDeskAuthenticated } from "@/lib/desk-auth";
import { PELBU_PROPERTY_SLUG } from "@/lib/property";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Rate card downloads | Pelbu OS",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type LeadRow = {
  id: string;
  email: string;
  phone: string;
  full_name: string | null;
  download_count: number;
  first_download_at: string;
  last_download_at: string;
  last_user_agent: string | null;
};

function formatWhen(iso: string): string {
  try {
    return new Intl.DateTimeFormat("en-GB", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Asia/Thimphu",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export default async function ErpAgentRateDownloadsPage() {
  if (!(await isDeskAuthenticated())) {
    redirect("/erp/login");
  }

  const admin = createSupabaseAdminClient();
  const { data: property } = await admin
    .from("properties")
    .select("id, name")
    .eq("slug", PELBU_PROPERTY_SLUG)
    .maybeSingle();

  if (!property?.id) {
    return (
      <DeskListShell
        heading="Rate card downloads"
        subtitle="Property not found."
      >
        <DeskEmptyState
          title="No property"
          description="Configure the flagship property first."
        />
      </DeskListShell>
    );
  }

  const { data: leads, error } = await admin
    .from("agent_rate_pdf_leads")
    .select(
      "id, email, phone, full_name, download_count, first_download_at, last_download_at, last_user_agent",
    )
    .eq("property_id", property.id)
    .order("last_download_at", { ascending: false });

  if (error) {
    console.error("agent_rate_pdf_leads erp load", error);
  }

  const rows = (leads ?? []) as LeadRow[];
  const totalDownloads = rows.reduce(
    (sum, r) => sum + (Number(r.download_count) || 0),
    0,
  );
  const uniqueLeads = rows.length;
  const recentCount = rows.filter((r) => {
    const t = new Date(r.last_download_at).getTime();
    return Date.now() - t < 7 * 24 * 60 * 60 * 1000;
  }).length;

  return (
    <DeskListShell
      heading="Rate card downloads"
      subtitle={`Public agent rate-card gate for ${property.name}.`}
      blurb="Email and phone required before download. Each contact shows per-person download count; total is the sum across all leads."
      headerAside={
        <Link
          href="/erp/agents"
          className="text-sm font-medium text-sky-700 underline-offset-4 hover:underline"
        >
          ← Agents
        </Link>
      }
      metrics={
        <DeskMetricRow
          metrics={[
            { label: "Total downloads", value: String(totalDownloads) },
            { label: "Unique contacts", value: String(uniqueLeads) },
            { label: "Active (7 days)", value: String(recentCount) },
          ]}
        />
      }
    >
      <Card>
        <CardHeader>
          <CardTitle>Download registry</CardTitle>
          <CardDescription>
            Each row is one email + phone pair. Download count is how many times
            they took the rate card.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <DeskEmptyState
              title="No downloads yet"
              description="When agents submit email and phone on /agents, they appear here."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="pb-2 pr-3 font-medium">Contact</th>
                    <th className="pb-2 pr-3 font-medium">Phone</th>
                    <th className="pb-2 pr-3 font-medium">Email</th>
                    <th className="pb-2 pr-3 font-medium tabular-nums">
                      Downloads
                    </th>
                    <th className="pb-2 pr-3 font-medium">First</th>
                    <th className="pb-2 font-medium">Last</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr
                      key={row.id}
                      className="border-b border-border/60 last:border-0"
                    >
                      <td className="py-2.5 pr-3 text-foreground">
                        {row.full_name?.trim() || "—"}
                      </td>
                      <td className="py-2.5 pr-3 font-mono text-xs">
                        {row.phone}
                      </td>
                      <td className="py-2.5 pr-3">
                        <a
                          href={`mailto:${row.email}`}
                          className="text-sky-700 underline-offset-2 hover:underline"
                        >
                          {row.email}
                        </a>
                      </td>
                      <td className="py-2.5 pr-3 tabular-nums font-medium">
                        {row.download_count}
                      </td>
                      <td className="py-2.5 pr-3 text-muted-foreground whitespace-nowrap">
                        {formatWhen(row.first_download_at)}
                      </td>
                      <td className="py-2.5 text-muted-foreground whitespace-nowrap">
                        {formatWhen(row.last_download_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </DeskListShell>
  );
}
