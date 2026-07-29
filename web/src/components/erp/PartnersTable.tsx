import type { PartnerRow } from "@/app/erp/partners/page";
import { PartnerRowActions } from "./PartnerRowActions";

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function relativeDays(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(`${iso}T00:00:00`).getTime();
  if (Number.isNaN(d)) return "";
  const diff = Math.round((Date.now() - d) / 86_400_000);
  if (diff <= 0) return "today";
  if (diff === 1) return "yesterday";
  if (diff < 30) return `${diff} days ago`;
  if (diff < 365) return `${Math.round(diff / 30)} mo ago`;
  return `${Math.round(diff / 365)} yr ago`;
}

export function PartnersTable({
  rows,
  kind,
}: {
  rows: PartnerRow[];
  kind: "guide" | "driver";
}) {
  if (rows.length === 0) {
    return (
      <p className="border border-espresso/10 bg-white px-5 py-6 text-sm text-muted-foreground">
        No {kind === "guide" ? "guides" : "drivers"} recorded yet. They will
        appear here after the first check-in.
      </p>
    );
  }

  return (
    <div className="overflow-hidden rounded-sm border border-espresso/10 bg-white">
      <table className="w-full border-collapse text-sm">
        <caption className="sr-only">
          {kind === "guide" ? "Guides" : "Drivers"} sorted by visit count.
        </caption>
        <thead className="bg-espresso/[0.04] text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
          <tr>
            <th scope="col" className="px-3 py-2 text-left font-semibold">
              {kind === "guide" ? "Guide" : "Driver"}
            </th>
            {kind === "guide" ? (
              <th scope="col" className="px-3 py-2 text-left font-semibold">
                Number
              </th>
            ) : null}
            <th scope="col" className="px-3 py-2 text-left font-semibold">
              Phone
            </th>
            {kind === "driver" ? (
              <th scope="col" className="px-3 py-2 text-left font-semibold">
                Vehicle
              </th>
            ) : null}
            <th scope="col" className="px-3 py-2 text-right font-semibold">
              Visits
            </th>
            <th scope="col" className="px-3 py-2 text-left font-semibold">
              Last seen
            </th>
            <th scope="col" className="px-3 py-2 text-right font-semibold">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const rel = relativeDays(r.last_seen_at);
            return (
              <tr key={r.id} className="border-t border-espresso/10">
                <td className="px-3 py-2.5 text-espresso">
                  <span className="font-medium">
                    {r.full_name ?? "—"}
                  </span>
                </td>
                {kind === "guide" ? (
                  <td className="px-3 py-2.5 font-mono text-xs text-muted-foreground">
                    {r.guide_number ?? "—"}
                  </td>
                ) : null}
                <td className="px-3 py-2.5 text-muted-foreground">
                  {r.phone ?? "—"}
                </td>
                {kind === "driver" ? (
                  <td className="px-3 py-2.5 font-mono text-xs text-muted-foreground">
                    {r.vehicle_no ?? "—"}
                  </td>
                ) : null}
                <td className="px-3 py-2.5 text-right">
                  <span className="inline-flex items-center rounded-full border border-gold/40 bg-gold/5 px-2 py-0.5 text-[11px] font-medium text-gold">
                    {r.visit_count}
                  </span>
                </td>
                <td className="px-3 py-2.5 text-muted-foreground">
                  <span>{fmtDate(r.last_seen_at)}</span>
                  {rel ? <span className="ml-1 text-[11px]">Â· {rel}</span> : null}
                </td>
                <td className="px-3 py-2.5 text-right">
                  <PartnerRowActions
                    kind={kind}
                    partnerId={r.id}
                    searchToken={
                      kind === "guide"
                        ? r.guide_number ?? r.full_name ?? r.phone ?? ""
                        : r.full_name ?? r.phone ?? ""
                    }
                    phone={r.phone}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
