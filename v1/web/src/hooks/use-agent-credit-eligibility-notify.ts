"use client";

import {
  creditAgentIneligibilityMessage,
  isCreditAgentStatus,
} from "@/lib/agents/status";
import { useEffect, useRef } from "react";
import { toast } from "sonner";

type AgentLike = {
  id: string;
  company_name: string;
  status: string;
} | null | undefined;

/**
 * When FO picks an agent under on-credit (or switches payment), toast
 * eligibility so the error is not buried in the form body.
 * Returns the eligibility error string (null when ok / N/A).
 */
export function useAgentCreditEligibilityNotify(
  paymentMode: string,
  agent: AgentLike,
  opts?: { enabled?: boolean },
): string | null {
  const enabled = opts?.enabled !== false;
  const mode = (paymentMode ?? "").toLowerCase();
  const wantsCredit = mode === "on_credit" || mode === "agent_credit";

  let message: string | null = null;
  if (enabled && wantsCredit && agent) {
    message = creditAgentIneligibilityMessage(
      agent.status,
      agent.company_name,
    );
  }

  const lastKey = useRef("");
  useEffect(() => {
    if (!enabled || !message || !agent) {
      lastKey.current = "";
      return;
    }
    const key = `${agent.id}:${agent.status}:${mode}`;
    if (lastKey.current === key) return;
    lastKey.current = key;
    toast.warning(message, {
      id: `agent-credit-${agent.id}`,
      duration: 10_000,
      description: isCreditAgentStatus(agent.status)
        ? undefined
        : "Use Enable credit below in this window — no need to open Agents.",
    });
  }, [enabled, message, agent?.id, agent?.status, mode]);

  return message;
}
