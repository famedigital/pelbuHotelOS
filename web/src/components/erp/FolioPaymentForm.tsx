"use client";

import { postFolioPayment, type PaymentState } from "@/app/actions/erp-pos";
import type { BookableAgent } from "@/components/erp/AgentPicker";
import {
  CreditAgentPromotePanel,
  needsCreditPromote,
} from "@/components/erp/CreditAgentPromotePanel";
import { PeriodOverrideFields } from "@/components/erp/PeriodOverrideFields";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { isCreditAgentStatus } from "@/lib/agents/status";
import { formatBtn } from "@/lib/pricing";
import { cn } from "@/lib/utils";
import { useActionToast } from "@/hooks/use-action-toast";
import { TriangleAlertIcon } from "lucide-react";
import { useActionState, useEffect, useRef, useState } from "react";

const initial: PaymentState = { ok: false };

/** Guest cash/card vs charging the agent AR book. */
export type FolioSettleMethod =
  | "cash"
  | "bank"
  | "bank_qr"
  | "pay_bt"
  | "card"
  | "deposit"
  | "agent_credit";

export type FolioAmountPreset = {
  id: string;
  label: string;
  amount: number;
};

function isAgentArMethod(method: string): boolean {
  return method === "agent_credit";
}

/**
 * Record cash/digital collection **or** charge the agent AR book
 * (agent_credit tender → guest folio down, agent credit_used up).
 */
export function FolioPaymentForm({
  folioId,
  suggestedAmount,
  emphasized = false,
  compact = false,
  agentName = null,
  agent = null,
  agentCreditEligible,
  onAgentPromoted,
  defaultMethod = "cash",
  amountPresets = [],
  onUseCashFromPromote,
}: {
  folioId: string;
  suggestedAmount: number;
  /** Primary rail CTA — denser shell, strong collect button */
  emphasized?: boolean;
  /** StayHub Settle density (tighter grid, collapsed extras) */
  compact?: boolean;
  /** When set, agent AR option is clearer in copy. */
  agentName?: string | null;
  /** When set with agent_credit method, in-flow promote if not eligible. */
  agent?: BookableAgent | null;
  /**
   * Override eligibility after promote (before money refetch).
   * Defaults to isCreditAgentStatus(agent.status).
   */
  agentCreditEligible?: boolean;
  onAgentPromoted?: (agent: BookableAgent) => void;
  onUseCashFromPromote?: () => void;
  /** Pre-select cash-like or agent AR when FO opens from a POS/F&B action. */
  defaultMethod?: FolioSettleMethod;
  /** Quick amounts (full guest due, F&B only, …). */
  amountPresets?: FolioAmountPreset[];
}) {
  const [state, action, pending] = useActionState(postFolioPayment, initial);
  useActionToast(state, {
    successMessage:
      state.settleKind === "agent_ar"
        ? "Charged to agent AR book"
        : "Payment collected",
  });
  const [method, setMethod] = useState<FolioSettleMethod>(defaultMethod);
  const [amount, setAmount] = useState(
    suggestedAmount > 0 ? String(suggestedAmount) : "",
  );
  const [localAgent, setLocalAgent] = useState<BookableAgent | null>(
    agent ?? null,
  );

  const idempotencyKey = useRef(
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `folio-pay-${folioId}-${Date.now()}`,
  );

  useEffect(() => {
    setMethod(defaultMethod);
  }, [defaultMethod]);

  useEffect(() => {
    if (suggestedAmount > 0) setAmount(String(suggestedAmount));
  }, [suggestedAmount]);

  useEffect(() => {
    setLocalAgent(agent ?? null);
  }, [agent?.id, agent?.status, agent?.company_name, agent?.market]);

  const agentAr = isAgentArMethod(method);
  const agentLabel =
    localAgent?.company_name?.trim() || agentName?.trim() || "agent";
  const eligible =
    agentCreditEligible ??
    (localAgent ? isCreditAgentStatus(localAgent.status) : false);
  const needsPromote =
    agentAr && localAgent && needsCreditPromote("agent_credit", localAgent);
  const blockArSubmit = agentAr && Boolean(localAgent) && !eligible;

  if (state.ok) {
    const ar = state.settleKind === "agent_ar";
    return (
      <div
        className={cn(
          "erp rounded-md border bg-card",
          compact ? "p-2.5" : "p-4",
        )}
        role="status"
        aria-live="polite"
      >
        <p className="text-sm font-medium text-foreground">
          {ar ? "Charged to agent AR book" : "Payment collected"}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {state.message ??
            (ar
              ? "Guest folio reduced; agent owes hotel this amount until they settle."
              : "Balance updates on refresh.")}
        </p>
      </div>
    );
  }

  const sectionTitle = agentAr
    ? "Charge agent AR book"
    : emphasized || compact
      ? "Collect payment"
      : "Record payment";
  const submitLabel = pending
    ? agentAr
      ? "Posting to AR…"
      : "Saving…"
    : blockArSubmit
      ? "Enable credit first"
      : agentAr
        ? "Charge agent AR"
        : emphasized || compact
          ? "Collect payment"
          : "Post payment";

  const usablePresets = amountPresets.filter((p) => p.amount > 0.5);
  const dense = compact || emphasized;

  return (
    <div className="space-y-2">
      {needsPromote && localAgent ? (
        <CreditAgentPromotePanel
          agent={localAgent}
          variant={compact || emphasized ? "compact" : "default"}
          onPromoted={(next) => {
            setLocalAgent(next);
            onAgentPromoted?.(next);
          }}
          onUseCash={() => {
            setMethod("cash");
            onUseCashFromPromote?.();
          }}
        />
      ) : null}

      <form
        action={action}
        className={
          dense
            ? "erp space-y-2 rounded-md border border-citrus/40 bg-background p-2.5"
            : "erp space-y-5 rounded-lg border bg-card p-6"
        }
      >
        {state.error ? (
          <Alert variant="destructive">
            <TriangleAlertIcon />
            <AlertDescription>{state.error}</AlertDescription>
          </Alert>
        ) : null}
        <input type="hidden" name="folio_id" value={folioId} />
        <input
          type="hidden"
          name="idempotency_key"
          value={idempotencyKey.current}
        />

        <div
          className={cn(
            "flex items-baseline justify-between gap-3",
            dense ? "pb-1.5" : "border-b pb-3",
          )}
        >
          <p className="text-[11px] font-semibold tracking-[0.14em] text-accent uppercase">
            {sectionTitle}
          </p>
          {suggestedAmount > 0 ? (
            <p className="text-xs text-muted-foreground">
              Due{" "}
              <span className="font-medium tabular-nums text-foreground">
                {formatBtn(suggestedAmount)}
              </span>
            </p>
          ) : null}
        </div>

        {agentAr && !needsPromote ? (
          <p className="text-[11px] leading-snug text-muted-foreground">
            Clears guest folio; <strong>{agentLabel}</strong> AR book increases
            (not till cash).
          </p>
        ) : null}

        <div
          className={cn(
            dense ? "grid gap-2 sm:grid-cols-2" : "grid gap-3",
          )}
        >
          <div className="space-y-1">
            <Label htmlFor="method" className={dense ? "text-xs" : undefined}>
              How to settle
            </Label>
            <select
              id="method"
              name="method"
              value={method}
              onChange={(e) => setMethod(e.target.value as FolioSettleMethod)}
              className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm text-foreground outline-none transition-colors focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
            >
              <option value="cash">Cash (collect)</option>
              <option value="bank">Bank transfer (collect)</option>
              <option value="bank_qr">Bank QR (collect)</option>
              <option value="pay_bt">Pay.bt (collect)</option>
              <option value="card">Card (collect)</option>
              <option value="deposit">Apply deposit</option>
              <option value="agent_credit">
                Agent AR book (charge — agent owes)
              </option>
            </select>
          </div>
          <div className="space-y-1">
            <Label
              htmlFor="amount_btn"
              className={dense ? "text-xs" : undefined}
            >
              {agentAr ? "Amount to charge AR (Nu)" : "Amount (Nu)"}
            </Label>
            {usablePresets.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {usablePresets.map((p) => {
                  const active = Math.abs(Number(amount) - p.amount) < 0.02;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setAmount(String(p.amount))}
                      className={cn(
                        "rounded-md border px-2 py-0.5 text-[11px] font-medium transition-colors",
                        active
                          ? "border-citrus/50 bg-citrus/15 text-foreground"
                          : "bg-muted/30 text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {p.label} · {formatBtn(p.amount)}
                    </button>
                  );
                })}
              </div>
            ) : null}
            <Input
              id="amount_btn"
              type="number"
              name="amount_btn"
              required
              min={0.01}
              step="0.01"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="h-9"
            />
          </div>
          <div className={cn("space-y-1", dense && "sm:col-span-2")}>
            <Label
              htmlFor="reference"
              className={dense ? "text-xs" : undefined}
            >
              {agentAr
                ? "Agent / voucher ref (optional)"
                : "Bank / card reference"}
            </Label>
            <Input
              id="reference"
              type="text"
              name="reference"
              placeholder={
                agentAr
                  ? "Voucher no, group code"
                  : "Slip no, Pay.bt txn, or card auth"
              }
              className="h-9"
            />
            {!dense ? (
              <p className="text-xs text-muted-foreground">
                {agentAr
                  ? "Optional. Does not collect cash — posts debit on agent AR book."
                  : "Optional for cash."}
              </p>
            ) : null}
          </div>

          {dense ? (
            <details className="sm:col-span-2">
              <summary className="cursor-pointer text-[11px] font-medium text-muted-foreground">
                Notes · period override
              </summary>
              <div className="mt-1.5 space-y-2">
                <div className="space-y-1">
                  <Label htmlFor="notes" className="text-xs">
                    Notes
                  </Label>
                  <Textarea id="notes" name="notes" rows={1} className="min-h-0" />
                </div>
                <PeriodOverrideFields idPrefix={`pay-${folioId.slice(0, 8)}`} />
              </div>
            </details>
          ) : (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="notes">Notes</Label>
                <Textarea id="notes" name="notes" rows={2} />
              </div>
              <PeriodOverrideFields idPrefix={`pay-${folioId.slice(0, 8)}`} />
            </>
          )}
        </div>

        <Button
          type="submit"
          variant="citrus"
          disabled={pending || blockArSubmit}
          className="h-10 w-full min-h-10"
        >
          {submitLabel}
        </Button>
      </form>
    </div>
  );
}
