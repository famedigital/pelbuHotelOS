"use client";

import { Button } from "@/components/ui/button";
import {
  guestWaMeHref,
  guestWaTemplate,
  type GuestWaKind,
} from "@/lib/guest-wa-templates";
import { useState } from "react";

/** Desk: open WhatsApp templates for conf / due / thank-you (not CRM). */
export function GuestWaMessageButtons({
  phone,
  guestName,
  confLabel,
  checkIn,
  checkOut,
  dueBtn,
  propertyName = "Hotel",
  kinds = ["confirmation", "due_reminder", "thank_you"],
  className,
}: {
  phone?: string | null;
  guestName: string;
  confLabel?: string | null;
  checkIn?: string | null;
  checkOut?: string | null;
  dueBtn?: number | null;
  propertyName?: string | null;
  kinds?: GuestWaKind[];
  className?: string;
}) {
  const [copied, setCopied] = useState<GuestWaKind | null>(null);

  async function copyKind(kind: GuestWaKind) {
    const t = guestWaTemplate({
      kind,
      guestName,
      confLabel,
      checkIn,
      checkOut,
      dueBtn,
      propertyName,
    });
    try {
      await navigator.clipboard.writeText(t.body);
      setCopied(kind);
      window.setTimeout(() => setCopied(null), 2000);
    } catch {
      /* ignore */
    }
  }

  return (
    <div className={className}>
      <p className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
        Guest WhatsApp
      </p>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {kinds.map((kind) => {
          const t = guestWaTemplate({
            kind,
            guestName,
            confLabel,
            checkIn,
            checkOut,
            dueBtn,
            propertyName,
          });
          const href = guestWaMeHref(phone, t.body);
          const label =
            kind === "confirmation"
              ? "Conf"
              : kind === "due_reminder"
                ? "Due"
                : "Thanks";
          return (
            <div key={kind} className="flex gap-1">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 text-xs"
                onClick={() => void copyKind(kind)}
              >
                {copied === kind ? "Copied" : `Copy ${label}`}
              </Button>
              {href ? (
                <a
                  href={href}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="inline-flex h-8 items-center rounded-md border px-2 text-xs font-medium hover:bg-muted"
                >
                  WA {label}
                </a>
              ) : null}
            </div>
          );
        })}
      </div>
      {!phone ? (
        <p className="mt-1 text-[10px] text-muted-foreground">
          Add guest phone on Details to open WhatsApp directly.
        </p>
      ) : null}
    </div>
  );
}
