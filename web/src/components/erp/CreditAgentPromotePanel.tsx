"use client";

import {
  promoteAgentForCredit,
  type PromoteAgentForCreditState,
} from "@/app/actions/erp-agents";
import type { BookableAgent } from "@/components/erp/AgentPicker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { isCreditAgentStatus } from "@/lib/agents/status";
import { cn } from "@/lib/utils";
import { useRef, useState, useTransition } from "react";

const fieldSelectClass =
  "border-input flex h-9 w-full min-w-0 rounded-md border bg-background px-3 text-sm shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50";

/**
 * In-booking step when FO picks on credit with a directory (or non-credit) agent.
 * Promote to approved trade partner without leaving Fast Book / Calendar.
 *
 * Not a nested <form> — parent booking form stays intact; promote runs via action call.
 */
export function CreditAgentPromotePanel({
  agent,
  onPromoted,
  onUseCash,
  className,
}: {
  agent: BookableAgent;
  onPromoted: (agent: BookableAgent) => void;
  /** Switch payment to cash and keep the agent as directory. */
  onUseCash?: () => void;
  className?: string;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const rateRef = useRef<HTMLSelectElement>(null);
  const limitRef = useRef<HTMLInputElement>(null);
  const handled = useRef<string | null>(null);

  if (isCreditAgentStatus(agent.status)) return null;

  const runPromote = () => {
    setError(null);
    const fd = new FormData();
    fd.set("agent_id", agent.id);
    fd.set("rate_tier", rateRef.current?.value ?? "agents");
    const limit = limitRef.current?.value?.trim();
    if (limit) fd.set("credit_limit", limit);

    startTransition(async () => {
      const result: PromoteAgentForCreditState = await promoteAgentForCredit(
        { ok: false },
        fd,
      );
      if (!result.ok) {
        setError(result.error ?? "Could not approve agent for credit.");
        return;
      }
      if (!result.agent) {
        setError("Approved but agent payload missing. Refresh and retry.");
        return;
      }
      const key = result.agent.id + result.agent.status;
      if (handled.current === key) return;
      handled.current = key;
      onPromoted({
        id: result.agent.id,
        company_name: result.agent.company_name,
        market: result.agent.market,
        status: result.agent.status,
      });
    });
  };

  return (
    <div
      className={cn(
        "space-y-3 rounded-lg border border-amber-500/40 bg-amber-500/5 p-3",
        className,
      )}
      role="region"
      aria-label="Approve trade partner for credit"
    >
      <div className="space-y-1">
        <p className="text-sm font-semibold text-foreground">
          Enable credit for this agent
        </p>
        <p className="text-xs leading-relaxed text-muted-foreground">
          <span className="font-medium text-foreground">
            {agent.company_name}
          </span>{" "}
          is still a <span className="font-medium">{agent.status}</span> listing.
          One click makes them a trade partner so you can finish this on-credit
          booking (usual mode for agents).
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
          <Label htmlFor={`promo_rate_${agent.id}`} className="text-xs">
            Rate tier
          </Label>
          <select
            id={`promo_rate_${agent.id}`}
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
          <Label htmlFor={`promo_limit_${agent.id}`} className="text-xs">
            Credit limit (optional)
          </Label>
          <Input
            id={`promo_limit_${agent.id}`}
            ref={limitRef}
            type="number"
            min={0}
            step={100}
            placeholder="e.g. 50000"
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

/** True when payment is on_credit and agent cannot hold credit yet. */
export function needsCreditPromote(
  paymentMode: string,
  agent: BookableAgent | undefined | null,
): boolean {
  if (paymentMode !== "on_credit") return false;
  if (!agent) return false;
  return !isCreditAgentStatus(agent.status);
}
