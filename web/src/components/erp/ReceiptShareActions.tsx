"use client";

import {
  emailPosOrderReceipt,
  type PosReceiptEmailState,
} from "@/app/actions/erp-order-receipt";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useActionToast } from "@/hooks/use-action-toast";
import {
  receiptWaShareHref,
  usableGuestPhone,
} from "@/lib/pos-receipt-message";
import { useActionState, useMemo, useState } from "react";

const emailInitial: PosReceiptEmailState = { ok: false };

/**
 * Desk share rail for POS (or folio) receipt text: Copy, WhatsApp, Email.
 * Hidden when printing.
 */
export function ReceiptShareActions({
  messageText,
  defaultPhone,
  defaultEmail,
  defaultName,
  orderId,
  title = "Share receipt",
}: {
  messageText: string;
  defaultPhone?: string | null;
  defaultEmail?: string | null;
  defaultName?: string | null;
  /** When set, shows Resend email form for POS tickets. */
  orderId?: string | null;
  title?: string;
}) {
  const prefPhone = usableGuestPhone(defaultPhone) ?? "";
  const [phone, setPhone] = useState(prefPhone);
  const [copied, setCopied] = useState(false);
  const [emailState, emailAction, emailPending] = useActionState(
    emailPosOrderReceipt,
    emailInitial,
  );
  useActionToast(emailState, {
    successMessage: emailState.message ?? "Email sent",
  });

  const waHref = useMemo(
    () => receiptWaShareHref(phone || null, messageText),
    [phone, messageText],
  );

  async function copyText() {
    try {
      await navigator.clipboard.writeText(messageText);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="erp space-y-3 rounded-lg border bg-card p-4 print:hidden">
      <p className="text-[11px] font-semibold tracking-[0.18em] text-accent uppercase">
        {title}
      </p>
      <p className="text-xs text-muted-foreground">
        Opens WhatsApp on this device with the receipt text. Email sends a text
        copy via Resend.
      </p>

      <div className="space-y-1.5">
        <Label htmlFor="receipt-share-phone" className="text-xs">
          Guest WhatsApp
        </Label>
        <Input
          id="receipt-share-phone"
          type="tel"
          inputMode="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="97517XXXXXX"
          className="h-10"
          autoComplete="tel"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          className="h-10"
          onClick={() => void copyText()}
        >
          {copied ? "Copied" : "Copy text"}
        </Button>
        <Button asChild variant="default" className="h-10">
          <a href={waHref} target="_blank" rel="noopener noreferrer">
            WhatsApp
          </a>
        </Button>
      </div>

      {orderId ? (
        <form action={emailAction} className="space-y-3 border-t pt-3">
          <input type="hidden" name="order_id" value={orderId} />
          {defaultName ? (
            <input type="hidden" name="recipient_name" value={defaultName} />
          ) : null}
          <div className="space-y-1.5">
            <Label htmlFor="receipt-share-email" className="text-xs">
              To email
            </Label>
            <Input
              id="receipt-share-email"
              name="to"
              type="email"
              required
              defaultValue={defaultEmail ?? ""}
              placeholder="guest@example.com"
              className="h-10"
              autoComplete="email"
            />
          </div>
          <Button
            type="submit"
            variant="outline"
            disabled={emailPending}
            className="h-10 w-full"
          >
            {emailPending ? "Sending…" : "Email now"}
          </Button>
        </form>
      ) : null}
    </div>
  );
}

/** Folio page: WhatsApp + copy only (email stays on FiscalDocEmailForm). */
export function FolioReceiptWaShare({
  messageText,
  defaultPhone,
}: {
  messageText: string;
  defaultPhone?: string | null;
}) {
  return (
    <ReceiptShareActions
      messageText={messageText}
      defaultPhone={defaultPhone}
      title="WhatsApp receipt"
    />
  );
}
