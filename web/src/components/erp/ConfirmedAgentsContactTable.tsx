"use client";

import type { ConfirmedAgentContact } from "@/lib/erp/confirmed-agents";
import { agentDossierHref } from "@/lib/erp/agent-links";
import { cn } from "@/lib/utils";
import { MailIcon, PhoneIcon } from "lucide-react";
import Link from "next/link";

function telHref(phone: string): string {
  const digits = phone.replace(/[^\d+]/g, "");
  return `tel:${digits}`;
}

/**
 * Dense call/email sheet for reservation — phone + email as primary actions.
 */
export function ConfirmedAgentsContactTable({
  rows,
}: {
  rows: ConfirmedAgentContact[];
}) {
  return (
    <div className="space-y-3">
      {/* Mobile cards */}
      <ul className="space-y-2 md:hidden">
        {rows.map((r) => (
          <li
            key={r.agent_id}
            className={cn(
              "rounded-xl border bg-card p-3 shadow-xs",
              (r.missing_phone || r.missing_email) &&
                "border-amber-500/40",
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <Link
                  href={agentDossierHref(r.agent_id, { tab: "bookings" })}
                  className="font-semibold text-foreground underline-offset-2 hover:underline"
                >
                  {r.company_name}
                </Link>
                <p className="text-xs text-muted-foreground">
                  {r.market}
                  {r.contact_name ? ` · ${r.contact_name}` : ""}
                </p>
              </div>
              <span className="shrink-0 rounded-md border bg-muted/50 px-1.5 py-0.5 text-[10px] tabular-nums">
                {r.booking_count} bk · {r.rooms_sold} rm
              </span>
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground">
              Next in {r.next_check_in ?? "—"}
              {r.last_check_in && r.last_check_in !== r.next_check_in
                ? ` · last ${r.last_check_in}`
                : ""}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {r.contact_phone ? (
                <a
                  href={telHref(r.contact_phone)}
                  className="inline-flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-lg border bg-background px-3 text-sm font-medium"
                >
                  <PhoneIcon className="size-3.5" aria-hidden />
                  {r.contact_phone}
                </a>
              ) : (
                <span className="inline-flex min-h-10 flex-1 items-center justify-center rounded-lg border border-dashed px-3 text-xs text-amber-800 dark:text-amber-200">
                  No phone
                </span>
              )}
              {r.contact_email ? (
                <a
                  href={`mailto:${r.contact_email}`}
                  className="inline-flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-lg border bg-background px-3 text-sm font-medium"
                >
                  <MailIcon className="size-3.5" aria-hidden />
                  Email
                </a>
              ) : (
                <span className="inline-flex min-h-10 flex-1 items-center justify-center rounded-lg border border-dashed px-3 text-xs text-amber-800 dark:text-amber-200">
                  No email
                </span>
              )}
            </div>
          </li>
        ))}
      </ul>

      {/* Desktop table */}
      <div className="hidden overflow-x-auto rounded-xl border md:block">
        <table className="w-full min-w-[880px] text-left text-sm">
          <thead className="border-b bg-muted/40 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
            <tr>
              <th className="px-3 py-2.5">Agent</th>
              <th className="px-3 py-2.5">Contact</th>
              <th className="px-3 py-2.5">Phone</th>
              <th className="px-3 py-2.5">Email</th>
              <th className="px-3 py-2.5 text-right">Bk / rms</th>
              <th className="px-3 py-2.5">Next arrival</th>
              <th className="px-3 py-2.5">Dossier</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.agent_id}
                className={cn(
                  "border-b last:border-0",
                  (r.missing_phone || r.missing_email) &&
                    "bg-amber-50/40 dark:bg-amber-950/10",
                )}
              >
                <td className="px-3 py-2.5">
                  <p className="font-medium text-foreground">
                    {r.company_name}
                  </p>
                  <p className="text-xs text-muted-foreground">{r.market}</p>
                </td>
                <td className="px-3 py-2.5 text-muted-foreground">
                  {r.contact_name ?? "—"}
                </td>
                <td className="px-3 py-2.5">
                  {r.contact_phone ? (
                    <a
                      href={telHref(r.contact_phone)}
                      className="inline-flex items-center gap-1 font-medium text-accent underline-offset-2 hover:underline"
                    >
                      <PhoneIcon className="size-3.5 shrink-0" aria-hidden />
                      {r.contact_phone}
                    </a>
                  ) : (
                    <span className="text-xs text-amber-800 dark:text-amber-200">
                      Missing
                    </span>
                  )}
                </td>
                <td className="px-3 py-2.5">
                  {r.contact_email ? (
                    <a
                      href={`mailto:${r.contact_email}`}
                      className="inline-flex max-w-[14rem] items-center gap-1 truncate font-medium text-accent underline-offset-2 hover:underline"
                      title={r.contact_email}
                    >
                      <MailIcon className="size-3.5 shrink-0" aria-hidden />
                      <span className="truncate">{r.contact_email}</span>
                    </a>
                  ) : (
                    <span className="text-xs text-amber-800 dark:text-amber-200">
                      Missing
                    </span>
                  )}
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums">
                  {r.booking_count} / {r.rooms_sold}
                </td>
                <td className="px-3 py-2.5 tabular-nums text-muted-foreground">
                  {r.next_check_in ?? "—"}
                </td>
                <td className="px-3 py-2.5">
                  <Link
                    href={agentDossierHref(r.agent_id, { tab: "bookings" })}
                    className="text-xs font-medium text-accent underline-offset-2 hover:underline"
                  >
                    Bookings →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
