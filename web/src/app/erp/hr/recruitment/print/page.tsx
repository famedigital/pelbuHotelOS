import { PrintButton } from "@/components/erp/PrintButton";
import { Button } from "@/components/ui/button";
import { isDeskAuthenticated } from "@/lib/desk-auth";
import { fmtDate, thimphuToday } from "@/lib/erp-lists";
import { resolveActivePropertyId } from "@/lib/property-context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Recruitment report | Hotel OS",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type Kind = "pipeline" | "hires" | "terminations" | "movements";

type Props = {
  searchParams: Promise<{
    kind?: string;
    from?: string;
    to?: string;
  }>;
};

function parseKind(raw: string | undefined): Kind {
  if (raw === "hires" || raw === "terminations" || raw === "movements") {
    return raw;
  }
  return "pipeline";
}

const KIND_LABEL: Record<Kind, string> = {
  pipeline: "Provisional pipeline",
  hires: "Confirmed hires",
  terminations: "Terminations",
  movements: "Recruitment movements",
};

export default async function RecruitmentPrintPage({ searchParams }: Props) {
  if (!(await isDeskAuthenticated())) redirect("/erp/login");

  const sp = await searchParams;
  const kind = parseKind(sp.kind);
  const today = thimphuToday();
  const from =
    sp.from && /^\d{4}-\d{2}-\d{2}$/.test(sp.from)
      ? sp.from
      : `${today.slice(0, 7)}-01`;
  const to =
    sp.to && /^\d{4}-\d{2}-\d{2}$/.test(sp.to) ? sp.to : today;

  const admin = createSupabaseAdminClient();
  const propertyId = await resolveActivePropertyId(admin);

  const { data: property } = await admin
    .from("properties")
    .select("name")
    .eq("id", propertyId)
    .maybeSingle();

  type PrintRow = {
    code: string;
    name: string;
    department: string;
    role: string;
    date: string;
    detail: string;
  };

  let rows: PrintRow[] = [];
  let periodNote = "";

  if (kind === "pipeline") {
    periodNote = `As of ${fmtDate(today)}`;
    const { data } = await admin
      .from("staff_members")
      .select(
        "employee_code, full_name, department, role_label, position_title, hired_on, probation_ends_on, employment_type",
      )
      .eq("property_id", propertyId)
      .eq("status", "provisional")
      .order("full_name")
      .limit(500);
    rows = (data ?? []).map((r) => ({
      code: r.employee_code as string,
      name: r.full_name as string,
      department: (r.department as string | null) ?? "—",
      role:
        (r.position_title as string | null) ||
        ((r.role_label as string) ?? "—"),
      date: fmtDate(r.hired_on as string | null),
      detail: r.probation_ends_on
        ? `Probation ends ${fmtDate(r.probation_ends_on as string)} · ${(r.employment_type as string).replaceAll("_", " ")}`
        : (r.employment_type as string).replaceAll("_", " "),
    }));
  } else {
    periodNote = `${fmtDate(from)} → ${fmtDate(to)}`;
    const types =
      kind === "hires"
        ? ["confirmation", "hire"]
        : kind === "terminations"
          ? ["termination"]
          : ["provisional", "confirmation", "hire", "termination"];
    const { data } = await admin
      .from("staff_employment_events")
      .select(
        "event_type, effective_on, summary, staff_members(employee_code, full_name, department, role_label, position_title)",
      )
      .eq("property_id", propertyId)
      .in("event_type", types)
      .gte("effective_on", from)
      .lte("effective_on", to)
      .order("effective_on", { ascending: true })
      .limit(1000);
    rows = (data ?? []).map((ev) => {
      const sm = Array.isArray(ev.staff_members)
        ? ev.staff_members[0]
        : ev.staff_members;
      const s = sm as {
        employee_code?: string;
        full_name?: string;
        department?: string | null;
        role_label?: string;
        position_title?: string | null;
      } | null;
      return {
        code: s?.employee_code ?? "—",
        name: s?.full_name ?? "Staff",
        department: s?.department ?? "—",
        role: s?.position_title || s?.role_label || "—",
        date: fmtDate(ev.effective_on as string),
        detail: `${ev.event_type as string}: ${ev.summary as string}`,
      };
    });
  }

  const qs = (k: Kind) =>
    `/erp/hr/recruitment/print?kind=${k}&from=${from}&to=${to}`;

  return (
    <div className="erp mx-auto max-w-4xl space-y-6 p-4 md:p-6 print:max-w-none print:p-0">
      <div className="flex flex-wrap items-end justify-between gap-3 print:hidden">
        <div>
          <p className="text-xs font-semibold tracking-[0.16em] text-muted-foreground uppercase">
            HR · Print
          </p>
          <h1 className="mt-1 text-xl font-semibold tracking-tight">
            Recruitment reports
          </h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" className="min-h-10">
            <Link href="/erp/hr/recruitment">← Recruitment</Link>
          </Button>
          <PrintButton label="Print report" />
        </div>
      </div>

      <nav
        className="flex flex-wrap gap-2 print:hidden"
        aria-label="Report kind"
      >
        {(
          [
            ["pipeline", "Pipeline"],
            ["hires", "Hires"],
            ["terminations", "Terminations"],
            ["movements", "All movements"],
          ] as const
        ).map(([k, label]) => (
          <Link
            key={k}
            href={qs(k)}
            className={`inline-flex h-9 items-center rounded-md border px-3 text-xs font-medium ${
              kind === k
                ? "border-accent bg-accent text-accent-foreground"
                : "hover:bg-muted"
            }`}
          >
            {label}
          </Link>
        ))}
      </nav>

      {kind !== "pipeline" ? (
        <form
          method="get"
          action="/erp/hr/recruitment/print"
          className="flex flex-wrap items-end gap-2 print:hidden"
        >
          <input type="hidden" name="kind" value={kind} />
          <label className="space-y-1 text-xs">
            <span className="text-muted-foreground">From</span>
            <input
              type="date"
              name="from"
              defaultValue={from}
              className="flex h-10 rounded-md border border-input bg-background px-3 text-sm"
            />
          </label>
          <label className="space-y-1 text-xs">
            <span className="text-muted-foreground">To</span>
            <input
              type="date"
              name="to"
              defaultValue={to}
              className="flex h-10 rounded-md border border-input bg-background px-3 text-sm"
            />
          </label>
          <Button type="submit" variant="outline" className="h-10">
            Apply
          </Button>
        </form>
      ) : null}

      <section className="rounded-lg border bg-card p-4 print:border-0 print:p-0">
        <header className="mb-4 border-b pb-3 print:border-neutral-400">
          <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            {(property?.name as string | null) ?? "Property"} · HR
          </p>
          <h2 className="mt-1 text-lg font-semibold">{KIND_LABEL[kind]}</h2>
          <p className="text-sm text-muted-foreground">{periodNote}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Printed {fmtDate(today)} · {rows.length} row
            {rows.length === 1 ? "" : "s"}
          </p>
        </header>

        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No rows for this report.</p>
        ) : (
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b text-xs tracking-wide text-muted-foreground uppercase">
                <th className="py-2 pr-2 font-medium">Code</th>
                <th className="py-2 pr-2 font-medium">Name</th>
                <th className="py-2 pr-2 font-medium">Department</th>
                <th className="py-2 pr-2 font-medium">Role</th>
                <th className="py-2 pr-2 font-medium">Date</th>
                <th className="py-2 font-medium">Detail</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={`${row.code}-${i}`} className="border-b border-border/60">
                  <td className="py-2 pr-2 tabular-nums whitespace-nowrap">
                    {row.code}
                  </td>
                  <td className="py-2 pr-2 font-medium">{row.name}</td>
                  <td className="py-2 pr-2">{row.department}</td>
                  <td className="py-2 pr-2">{row.role}</td>
                  <td className="py-2 pr-2 tabular-nums whitespace-nowrap">
                    {row.date}
                  </td>
                  <td className="py-2 text-muted-foreground">{row.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <footer className="mt-6 border-t pt-3 text-xs text-muted-foreground print:border-neutral-400">
          <p>
            Lifecycle: Provision → Confirm hire (active) or Terminate.
            Signatures for file retention optional.
          </p>
          <div className="mt-6 grid gap-8 sm:grid-cols-2 print:mt-10">
            <div>
              <p className="mb-8 border-b border-foreground/40 pt-8" />
              <p>HR / Manager · signature &amp; date</p>
            </div>
            <div>
              <p className="mb-8 border-b border-foreground/40 pt-8" />
              <p>Witness · signature &amp; date</p>
            </div>
          </div>
        </footer>
      </section>
    </div>
  );
}
