"use client";

import {
  promoteAgentForCredit,
  type PromoteAgentForCreditState,
} from "@/app/actions/erp-agents";
import type { BookableAgent } from "@/components/erp/AgentPicker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  creditAgentIneligibilityMessage,
  isCreditAgentStatus,
} from "@/lib/agents/status";
import { cn } from "@/lib/utils";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";

const fieldSelectClass =
  "border-input flex h-9 w-full min-w-0 rounded-md border bg-background px-3 text-sm shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50";

function shortWhy(status: string): string {
  const st = (status || "").toLowerCase();
  if (st === "directory") return "TCB directory — not trade yet";
  if (st === "pending") return "Pending approval — not trade yet";
  if (st === "rejected") return "Rejected — re-open on Agents first";
  return "Not credit-eligible yet";
}

/**
 * In-flow promote when FO picks agent credit with a directory (or non-credit) agent.
 * Book form, calendar, and Folio Settle. Not a nested <form>.
 */
export function CreditAgentPromotePanel({
  agent,
  onPromoted,
  onUseCash,
  className,
  variant = "default",
}: {
  agent: BookableAgent;
  onPromoted: (agent: BookableAgent) => void;
  /** Switch payment to cash and keep the agent as directory. */
  onUseCash?: () => void;
  className?: string;
  /** compact = Folio Settle density; default = book forms */
  variant?: "default" | "compact";
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const rateRef = useRef<HTMLSelectElement>(null);
  const limitRef = useRef<HTMLInputElement>(null);
  const handled = useRef<string | null>(null);

  if (isCreditAgentStatus(agent.status)) return null;

  const why =
    creditAgentIneligibilityMessage(agent.status, agent.company_name) ??
    "This agent cannot use agent credit yet.";

  const runPromote = () => {
    setError(null);
    const limitRaw = limitRef.current?.value?.trim() ?? "";
    if (!limitRaw) {
      const msg = "Enter a credit limit (Nu) before enabling credit.";
      setError(msg);
      toast.error(msg);
      limitRef.current?.focus();
      return;
    }
    const limit = Number(limitRaw);
    if (!Number.isFinite(limit) || limit < 1) {
      const msg = "Credit limit must be at least Nu 1.";
      setError(msg);
      toast.error(msg);
      return;
    }

    const fd = new FormData();
    fd.set("agent_id", agent.id);
    fd.set("rate_tier", rateRef.current?.value ?? "agents");
    fd.set("credit_limit", String(limit));

    startTransition(async () => {
      const result: PromoteAgentForCreditState = await promoteAgentForCredit(
        { ok: false },
        fd,
      );
      if (!result.ok) {
        const err = result.error ?? "Could not approve agent for credit.";
        setError(err);
        toast.error(err);
        return;
      }
      if (!result.agent) {
        const err = "Approved but agent payload missing. Refresh and retry.";
        setError(err);
        toast.error(err);
        return;
      }
      const key = result.agent.id + result.agent.status;
      if (handled.current === key) return;
      handled.current = key;
      toast.success(
        result.message ??
          `${result.agent.company_name} is now a trade partner · credit enabled`,
      );
      onPromoted({
        id: result.agent.id,
        company_name: result.agent.company_name,
        market: result.agent.market,
        status: result.agent.status,
      });
    });
  };

  const compact = variant === "compact";
  const rateId = `promo_rate_${agent.id}${compact ? "_c" : ""}`;
  const limitId = `promo_limit_${agent.id}${compact ? "_c" : ""}`;

  if (compact) {
    return (
      <div
        className={cn(
          "space-y-2 rounded-md border border-amber-500/40 bg-amber-500/5 px-2.5 py-2",
          className,
        )}
        role="region"
        aria-label="Enable agent credit"
      >
        <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
          <p className="text-xs font-semibold text-foreground">
            Enable credit · {agent.company_name}
          </p>
          <p className="text-[10px] text-muted-foreground">
            {shortWhy(agent.status)}
          </p>
        </div>

        {error ? (
          <p
            className="rounded-md border border-destructive/30 bg-destructive/5 px-2 py-1 text-[11px] text-destructive"
            role="alert"
          >
            {error}
          </p>
        ) : null}

        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-0.5">
            <Label htmlFor={rateId} className="text-[10px]">
              Rate tier
            </Label>
            <select
              id={rateId}
              ref={rateRef}
              defaultValue="agents"
              className={cn(fieldSelectClass, "h-8 text-xs")}
              disabled={pending}
            >
              <option value="agents">Agents</option>
              <option value="mou_agents">MoU</option>
              <option value="public">Public</option>
            </select>
          </div>
          <div className="space-y-0.5">
            <Label htmlFor={limitId} className="text-[10px]">
              Limit (Nu)
            </Label>
            <Input
              id={limitId}
              ref={limitRef}
              type="number"
              min={1}
              step={100}
              required
              defaultValue="50000"
              className="h-8 text-xs"
              inputMode="decimal"
              disabled={pending}
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5">
          <Button
            type="button"
            variant="citrus"
            disabled={pending}
            className="h-9 min-h-9 flex-1 px-3 text-xs"
            onClick={runPromote}
          >
            {pending ? "Enabling…" : "Enable credit"}
          </Button>
          {onUseCash ? (
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              className="h-9 min-h-9 px-2.5 text-xs"
              onClick={onUseCash}
            >
              Cash
            </Button>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "space-y-3 rounded-lg border border-amber-500/40 bg-amber-500/5 p-3",
        className,
      )}
      role="region"
      aria-label="Enable agent credit in this booking"
    >
      <div className="space-y-1">
        <p className="text-sm font-semibold text-foreground">
          Enable credit in this window
        </p>
        <p className="text-xs leading-relaxed text-muted-foreground">{why}</p>
        <p className="text-xs leading-relaxed text-foreground">
          Approve as trade partner + set limit here — no need to open{" "}
          <span className="font-mono text-[11px]">/erp/agents</span>.
        </p>
      </div>

      {error ? (
        <p
          className="rounded-md border border-destructive/30 bg-destructive/5 px-2.5 py-1.5 text-xs text-destructive"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={rateId} className="text-xs">
            Rate tier
          </Label>
          <select
            id={rateId}
            ref={rateRef}
            defaultValue="agents"
            className={fieldSelectClass}
            disabled={pending}
          >
            <option value="agents">Agents</option>
            <option value="mou_agents">MoU agents</option>
            <option value="public">Public</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={limitId} className="text-xs">
            Credit limit (Nu) · required
          </Label>
          <Input
            id={limitId}
            ref={limitRef}
            type="number"
            min={1}
            step={100}
            required
            placeholder="e.g. 50000"
            defaultValue="50000"
            className="h-9"
            inputMode="decimal"
            disabled={pending}
          />
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <Button
          type="button"
          variant="citrus"
          disabled={pending}
          className="h-10 w-full sm:flex-1"
          onClick={runPromote}
        >
          {pending ? "Enabling…" : "Enable credit & continue"}
        </Button>
        {onUseCash ? (
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            className="h-10 w-full sm:w-auto"
            onClick={onUseCash}
          >
            Cash / walk-in pay
          </Button>
        ) : null}
      </div>
    </div>
  );
}

/**
 * True when payment uses agent credit and the agent cannot hold credit yet.
 * Accepts booking `on_credit` and tender method `agent_credit`.
 */
export function needsCreditPromote(
  paymentMode: string,
  agent: BookableAgent | undefined | null,
): boolean {
  const mode = paymentMode.toLowerCase();
  if (mode !== "on_credit" && mode !== "agent_credit") return false;
  if (!agent) return false;
  return !isCreditAgentStatus(agent.status);
}
