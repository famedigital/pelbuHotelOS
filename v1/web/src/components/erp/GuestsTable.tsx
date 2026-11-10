"use client";

import { useStayHubOptional } from "@/components/erp/StayHubProvider";
import { recommendStayHubStep } from "@/lib/folio/stay-hub-cycle";

export type GuestStay = {
  guestId: string;
  full_name: string;
  nationality: string | null;
  passport_or_cid: string | null;
  sdf_ref: string | null;
  sdf_doc_url: string | null;
  booking_id: string;
  contact_phone: string | null;
  check_in: string;
  check_out: string;
  status: string;
  guest_origin: string | null;
  stay_count: number;
  blacklisted?: boolean;
  blacklist_reason?: string | null;
};

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  return `${Number(d)} ${months[Number(m) - 1] ?? m}`;
}

function StatusPill({ value }: { value: string }) {
  if (!value) return null;
  const tone =
    value === "checked_in" || value === "open"
      ? "border-citrus/40 bg-citrus-tint/60 text-citrus"
      : value === "confirmed"
        ? "border-accent/30 bg-accent/10 text-accent"
        : value === "held" || value === "pending"
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

function incomplete(row: GuestStay): boolean {
  return (
    !String(row.passport_or_cid ?? "").trim() ||
    !String(row.sdf_ref ?? "").trim()
  );
}

export function GuestsTable({ data }: { data: GuestStay[] }) {
  const stayHub = useStayHubOptional();

  function openStay(row: GuestStay) {
    stayHub?.openStayHub({
      bookingId: row.booking_id,
      step: recommendStayHubStep({
        status: row.status,
        checkInDate: row.check_in,
        sdfIncomplete: incomplete(row),
        board: "auto",
      }),
    });
  }

  if (data.length === 0) {
    return (
      <p className="rounded-md border bg-card px-4 py-6 text-sm text-muted-foreground">
        No guests match.
      </p>
    );
  }

  return (
    <ul className="divide-y overflow-hidden rounded-md border bg-card">
      {data.map((row) => (
        <li key={`${row.guestId}-${row.booking_id}`}>
          <div className="flex w-full items-center gap-3 px-3 py-2 hover:bg-muted/40">
            <button
              type="button"
              onClick={() => openStay(row)}
              className="flex min-w-0 flex-1 items-center gap-3 text-left"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-foreground">
                  {row.full_name}
                  {row.blacklisted ? (
                    <span className="ml-2 text-[10px] font-semibold tracking-wide text-destructive uppercase">
                      DNR
                    </span>
                  ) : null}
                </span>
                <span className="block truncate text-xs text-muted-foreground">
                  {row.contact_phone || "No phone"}
                  {row.nationality ? ` · ${row.nationality}` : ""}
                  {row.passport_or_cid ? ` · ${row.passport_or_cid}` : ""}
                </span>
              </span>
              <span className="hidden shrink-0 text-xs text-muted-foreground sm:block">
                {fmtDate(row.check_in)} – {fmtDate(row.check_out)}
              </span>
              {incomplete(row) ? (
                <span className="shrink-0 rounded border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-amber-800 uppercase">
                  SDF
                </span>
              ) : null}
              <StatusPill value={row.status} />
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}
