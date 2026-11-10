"use client";

import {
  confirmPaymentLinkProof,
  confirmPendingBankPayment,
  type ErpFolioOpsState,
} from "@/app/actions/erp-folio-ops";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useActionToast } from "@/hooks/use-action-toast";
import { formatBtn } from "@/lib/pricing";
import Link from "next/link";
import { useActionState } from "react";

const initial: ErpFolioOpsState = { ok: false };

const selectClass =
  "h-9 rounded-md border border-input bg-transparent px-3 text-sm";

export type PendingPaymentRow = {
  id: string;
  amount_btn: number;
  method: string;
  reference: string | null;
  proof_url: string | null;
  proof_submitted_at: string | null;
  folio_id: string | null;
  created_at: string;
};

export type PendingLinkRow = {
  id: string;
  amount_btn: number;
  proof_url: string | null;
  proof_reference: string | null;
  proof_submitted_at: string | null;
  booking_id: string | null;
  folio_id: string | null;
};

function ConfirmPaymentForm({ payment }: { payment: PendingPaymentRow }) {
  const [state, action, pending] = useActionState(confirmPendingBankPayment, initial);
  useActionToast(state, { successMessage: "Payment confirmed" });

  return (
    <form action={action} className="mt-3 flex flex-wrap items-end gap-2 border-t pt-3">
      <input type="hidden" name="payment_id" value={payment.id} />
      <div className="space-y-1">
        <Label className="text-[11px]">Bank ref</Label>
        <Input name="reference" defaultValue={payment.reference ?? ""} className="h-9 w-36" />
      </div>
      <Button type="submit" disabled={pending} className="h-9">
        {pending ? "Confirming…" : "Confirm landed → post + receipt"}
      </Button>
      {payment.folio_id ? (
        <Link
          href={`/erp/folios/${payment.folio_id}`}
          className="text-sm text-accent underline-offset-4 hover:underline"
        >
          Open folio →
        </Link>
      ) : null}
    </form>
  );
}

function ConfirmLinkForm({ link }: { link: PendingLinkRow }) {
  const [state, action, pending] = useActionState(confirmPaymentLinkProof, initial);
  useActionToast(state, { successMessage: "Deposit confirmed" });

  return (
    <form action={action} className="mt-3 flex flex-wrap items-end gap-2 border-t pt-3">
      <input type="hidden" name="link_id" value={link.id} />
      <select name="method" defaultValue="bank_qr" className={selectClass} aria-label="Method">
        <option value="bank_qr">Bank QR</option>
        <option value="bank">NEFT / bank</option>
      </select>
      <Input
        name="reference"
        defaultValue={link.proof_reference ?? ""}
        placeholder="Ref"
        className="h-9 w-32"
      />
      <Button type="submit" disabled={pending} className="h-9">
        {pending ? "Confirming…" : "Confirm deposit"}
      </Button>
    </form>
  );
}

export function BankProofQueue({
  payments,
  links,
}: {
  payments: PendingPaymentRow[];
  links: PendingLinkRow[];
}) {
  const empty = payments.length === 0 && links.length === 0;

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Bank QR / NEFT screenshots awaiting desk confirmation (typically 2–3 days).
        Confirm when funds land, then issue receipt from the folio.
      </p>

      {empty ? (
        <p className="rounded-lg border bg-card px-4 py-8 text-sm text-muted-foreground">
          No pending bank proofs.
        </p>
      ) : null}

      {payments.map((p) => (
        <article key={p.id} className="rounded-lg border bg-card p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="text-lg font-semibold tabular-nums">{formatBtn(p.amount_btn)}</p>
              <p className="text-xs text-muted-foreground">
                {p.method} · {String(p.proof_submitted_at ?? p.created_at).slice(0, 16).replace("T", " ")}
              </p>
            </div>
            <span className="rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase">
              pending bank
            </span>
          </div>
          {p.proof_url ? (
            <a
              href={p.proof_url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-block text-sm text-accent underline-offset-4 hover:underline"
            >
              View screenshot →
            </a>
          ) : null}
          <ConfirmPaymentForm payment={p} />
        </article>
      ))}

      {links.map((l) => (
        <article key={l.id} className="rounded-lg border border-accent/20 bg-card p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="text-lg font-semibold tabular-nums">{formatBtn(l.amount_btn)}</p>
              <p className="text-xs text-muted-foreground">Deposit link · proof submitted</p>
            </div>
            <span className="rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase">
              pending bank
            </span>
          </div>
          {l.proof_url ? (
            <a
              href={l.proof_url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-block text-sm text-accent underline-offset-4 hover:underline"
            >
              View screenshot →
            </a>
          ) : null}
          <ConfirmLinkForm link={l} />
        </article>
      ))}
    </div>
  );
}
