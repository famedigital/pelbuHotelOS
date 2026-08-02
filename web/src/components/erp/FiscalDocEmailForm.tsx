"use client";

import { emailFiscalDocument, type FiscalDocEmailState } from "@/app/actions/erp-fiscal-docs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useActionToast } from "@/hooks/use-action-toast";
import { useActionState } from "react";

const initial: FiscalDocEmailState = { ok: false };

export function FiscalDocEmailForm({
  folioId,
  fiscalDocId,
  docKind,
  defaultEmail,
  defaultName,
  label,
}: {
  folioId: string;
  fiscalDocId?: string | null;
  docKind: "invoice" | "receipt";
  defaultEmail?: string | null;
  defaultName?: string | null;
  label?: string;
}) {
  const [state, action, pending] = useActionState(emailFiscalDocument, initial);
  useActionToast(state, {
    successMessage: state.message ?? "Email sent",
  });

  return (
    <form
      action={action}
      className="erp space-y-3 rounded-lg border bg-card p-4 print:hidden"
    >
      <input type="hidden" name="folio_id" value={folioId} />
      <input type="hidden" name="doc_kind" value={docKind} />
      {fiscalDocId ? (
        <input type="hidden" name="fiscal_doc_id" value={fiscalDocId} />
      ) : null}
      {defaultName ? (
        <input type="hidden" name="recipient_name" value={defaultName} />
      ) : null}
      <p className="text-[11px] font-semibold tracking-[0.18em] text-accent uppercase">
        {label ?? (docKind === "invoice" ? "Email invoice" : "Email receipt")}
      </p>
      <p className="text-xs text-muted-foreground">
        Sends a text copy via Resend. Guest sees document number and line items.
      </p>
      <div className="space-y-1.5">
        <Label htmlFor={`fiscal-email-${docKind}`} className="text-xs">
          To email
        </Label>
        <Input
          id={`fiscal-email-${docKind}`}
          name="to"
          type="email"
          required
          defaultValue={defaultEmail ?? ""}
          placeholder="guest@example.com"
          className="h-10"
          autoComplete="email"
        />
      </div>
      <Button type="submit" variant="outline" disabled={pending} className="h-10 w-full">
        {pending ? "Sending…" : "Email now"}
      </Button>
    </form>
  );
}
