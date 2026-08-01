"use client";

import { BookingLifecycleActions } from "@/components/erp/BookingLifecycleActions";
import { Button } from "@/components/ui/button";
import {
  boardActionHref,
  boardActionLabel,
} from "@/lib/arrival-board";
import type { BookingDetailData } from "@/lib/booking-detail";
import { formatBtn } from "@/lib/pricing";
import Link from "next/link";

const CHECKIN_STATUSES = ["pending", "confirmed", "checked_in"];

function DetailField({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm break-words text-foreground">{value || "—"}</dd>
    </div>
  );
}

function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toISOString().slice(0, 16).replace("T", " ");
}

export function BookingDetailPanel({
  data,
  compact = false,
  showDossierLink = true,
  className,
}: {
  data: BookingDetailData;
  /** Denser layout for accordion rows. */
  compact?: boolean;
  showDossierLink?: boolean;
  className?: string;
}) {
  const status = data.status;
  const canCheckIn = CHECKIN_STATUSES.includes(status);
  const showLifecycle = [
    "held",
    "pending",
    "confirmed",
    "checked_in",
  ].includes(status);
  const isClosed = ["cancelled", "no_show", "expired"].includes(status);

  return (
    <div
      className={`space-y-4 ${compact ? "text-sm" : ""} ${className ?? ""}`}
    >
      <div className="flex flex-wrap items-center gap-2">
        {canCheckIn ? (
          <Button asChild size={compact ? "sm" : "default"}>
            <Link href={boardActionHref(status, data.id)}>
              {boardActionLabel(status)}
            </Link>
          </Button>
        ) : null}
        {data.open_folio_id ? (
          <Button asChild variant="outline" size={compact ? "sm" : "default"}>
            <Link href={`/erp/folios/${data.open_folio_id}`}>Open folio</Link>
          </Button>
        ) : null}
        {showDossierLink ? (
          <Button asChild variant="ghost" size={compact ? "sm" : "default"}>
            <Link href={`/erp/bookings/${data.id}`}>Full dossier</Link>
          </Button>
        ) : null}
      </div>

      {status === "held" ? (
        <div className="rounded-lg border border-amber-500/30 bg-amber-50/50 px-3 py-2.5 dark:bg-amber-950/20">
          <p className="text-sm font-medium text-foreground">
            Hold awaiting token
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Token {formatBtn(data.token_received_btn)} of{" "}
            {formatBtn(data.token_required_btn)} received.
            {data.hold_expires_at
              ? ` Expires ${fmtDateTime(data.hold_expires_at)}.`
              : ""}
            {data.hold_extended_count > 0 ? " Already extended once." : ""}
          </p>
        </div>
      ) : null}

      {isClosed ? (
        <div className="rounded-lg border bg-muted/30 px-3 py-2.5">
          <p className="text-sm font-medium text-foreground">
            {status === "expired"
              ? "Hold expired"
              : `Marked ${status.replace(/_/g, " ")}`}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {data.cancelled_at
              ? fmtDateTime(data.cancelled_at)
              : "Inventory released."}
            {data.cancel_reason ? ` · ${data.cancel_reason}` : ""}
          </p>
        </div>
      ) : null}

      <div
        className={`grid gap-4 ${compact ? "sm:grid-cols-2" : "lg:grid-cols-2"}`}
      >
        <section className="rounded-lg border bg-card p-3 sm:p-4">
          <h3 className="text-[11px] font-semibold tracking-[0.16em] text-muted-foreground uppercase">
            Stay
          </h3>
          <dl className="mt-3 grid grid-cols-1 gap-x-4 gap-y-2.5 sm:grid-cols-2">
            <DetailField label="Contact" value={data.contact_phone} />
            <DetailField label="Email" value={data.contact_email} />
            <DetailField
              label="Source"
              value={
                [data.source, data.channel_source].filter(Boolean).join(" · ") ||
                null
              }
            />
            <DetailField label="Agent" value={data.agent_name} />
            <DetailField label="Origin" value={data.guest_origin} />
            <DetailField label="Guide #" value={data.guide_number} />
            <DetailField label="Payment mode" value={data.payment_mode} />
            <DetailField
              label="Meal plan"
              value={
                data.meal_plan_code
                  ? `${data.meal_plan_code}${
                      Number(data.meal_plan_amount_btn ?? 0) > 0
                        ? ` · ${formatBtn(Number(data.meal_plan_amount_btn))}`
                        : ""
                    }`
                  : null
              }
            />
            <DetailField
              label="Rooms assigned"
              value={
                data.room_labels.length ? data.room_labels.join(", ") : null
              }
            />
            <DetailField
              label="Created"
              value={data.created_at ? fmtDateTime(data.created_at) : null}
            />
          </dl>
          {data.notes ? (
            <p className="mt-3 rounded-md border border-border/70 bg-muted/30 p-2.5 text-xs text-muted-foreground">
              {data.notes}
            </p>
          ) : null}
        </section>

        <section className="rounded-lg border bg-card p-3 sm:p-4">
          <h3 className="text-[11px] font-semibold tracking-[0.16em] text-muted-foreground uppercase">
            Money
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Token {formatBtn(data.token_received_btn)} received of{" "}
            {formatBtn(data.token_required_btn)} required
          </p>
          <dl className="mt-3 grid grid-cols-1 gap-x-4 gap-y-2.5 sm:grid-cols-2">
            <DetailField
              label="Quoted total"
              value={
                data.quoted_total_btn != null
                  ? formatBtn(data.quoted_total_btn)
                  : null
              }
            />
            <DetailField
              label="Folio balance"
              value={
                data.open_folio_id
                  ? formatBtn(data.folio_balance_btn)
                  : null
              }
            />
          </dl>
          <h4 className="mt-4 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
            Payments
          </h4>
          {data.payments.length === 0 ? (
            <p className="mt-1.5 text-xs text-muted-foreground">
              No payments recorded.
            </p>
          ) : (
            <ul className="mt-1.5 divide-y rounded-md border border-border/70 text-xs">
              {data.payments.slice(0, compact ? 3 : 8).map((p) => (
                <li
                  key={p.id}
                  className="flex flex-wrap items-baseline justify-between gap-2 px-2.5 py-1.5"
                >
                  <span className="text-foreground">
                    {formatBtn(p.amount_btn)}
                    <span className="ml-1.5 text-muted-foreground">
                      {[p.kind, p.method].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                  <span className="text-muted-foreground">
                    {p.reference ? `${p.reference} · ` : ""}
                    {p.created_at ? fmtDateTime(p.created_at) : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="rounded-lg border bg-card p-3 sm:p-4">
        <h3 className="text-[11px] font-semibold tracking-[0.16em] text-muted-foreground uppercase">
          Rooms &amp; guests
        </h3>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <div>
            <h4 className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
              Booked room types
            </h4>
            <ul className="mt-1.5 space-y-0.5 text-sm">
              {data.room_lines.length === 0 ? (
                <li className="text-muted-foreground">No room lines.</li>
              ) : (
                data.room_lines.map((line, i) => (
                  <li key={`line-${i}`}>
                    {line.qty} × {line.name}
                    {line.inventory_kind ? (
                      <span className="ml-1.5 text-xs text-muted-foreground">
                        {line.inventory_kind.replace(/_/g, " ")}
                      </span>
                    ) : null}
                  </li>
                ))
              )}
            </ul>
          </div>
          <div>
            <h4 className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
              Guests on file ({data.guests.length})
            </h4>
            {data.guests.length === 0 ? (
              <p className="mt-1.5 text-xs text-muted-foreground">
                Collected at check-in.
              </p>
            ) : (
              <ul className="mt-1.5 space-y-0.5 text-sm">
                {data.guests.map((g, i) => (
                  <li key={`guest-${i}`}>
                    {g.full_name ?? "Guest"}
                    <span className="ml-1.5 text-xs text-muted-foreground">
                      {[g.nationality, g.passport_or_cid]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>

      {showLifecycle ? (
        <section className="rounded-lg border bg-card p-3 sm:p-4">
          <h3 className="text-[11px] font-semibold tracking-[0.16em] text-muted-foreground uppercase">
            Lifecycle
          </h3>
          {data.is_mou_agent ? (
            <p className="mt-2 inline-flex items-center rounded-full border border-citrus/40 bg-citrus-tint/50 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-citrus">
              MoU — free cancel
            </p>
          ) : null}
          <BookingLifecycleActions
            bookingId={data.id}
            status={status}
            tokenRequired={data.token_required_btn}
            cancelPolicySummary={data.cancel_policy_summary}
            isMouAgent={data.is_mou_agent}
          />
        </section>
      ) : null}
    </div>
  );
}
