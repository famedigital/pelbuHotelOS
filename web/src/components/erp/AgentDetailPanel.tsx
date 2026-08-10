"use client";

import {
  approveAgent,
  recordAgentCreditPayment,
  rejectAgent,
  setAgentCreditLimit,
  setAgentOpenRoomCap,
  updateAgentDeskStatus,
  type AgentDocumentRow,
  type ErpAgentState,
} from "@/app/actions/erp-agents";
import { AgentDocumentManager } from "@/components/erp/AgentDocumentManager";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { formatBtn } from "@/lib/pricing";
import Link from "next/link";
import { useActionState, useRef, useState } from "react";
import type { DeskAgentRow } from "@/components/erp/AgentDeskCard";

const initial: ErpAgentState = { ok: false };

const RATE_TIERS = [
  "agents",
  "mou_agents",
  "friends",
  "family",
  "mutual_friends",
  "public",
] as const;

function fieldClass() {
  return "mt-1.5 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]";
}

function ActionFlash({ state }: { state: ErpAgentState }) {
  if (!state.ok && !state.error) return null;
  return (
    <p
      className={`mt-2 text-sm ${state.ok ? "text-foreground" : "text-destructive"}`}
      role="status"
    >
      {state.ok ? state.message : state.error}
    </p>
  );
}

function StatusForm({ agent, compact }: { agent: DeskAgentRow; compact?: boolean }) {
  const [state, action, pending] = useActionState(updateAgentDeskStatus, initial);
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="agent_id" value={agent.id} />
      <div className={`grid gap-2 ${compact ? "sm:grid-cols-2" : "sm:grid-cols-2"}`}>
        <label className="block text-xs text-muted-foreground">
          Status
          <select
            name="status"
            defaultValue={agent.status}
            className={fieldClass()}
            required
          >
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="demo">Demo</option>
            <option value="directory">Directory (TCB listing)</option>
            <option value="rejected">Rejected</option>
          </select>
        </label>
        <label className="block text-xs text-muted-foreground">
          Rate tier
          <select name="rate_tier" defaultValue={agent.rate_tier} className={fieldClass()}>
            {RATE_TIERS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="flex items-center gap-2 text-xs text-foreground">
        <Checkbox name="wants_mou" value="on" defaultChecked={agent.wants_mou} />
        MoU interest / flag
      </label>
      <Button type="submit" disabled={pending} size={compact ? "sm" : "default"} className="h-9">
        {pending ? "Saving…" : "Update status"}
      </Button>
      <ActionFlash state={state} />
    </form>
  );
}

function QuickApproveReject({ agent, compact }: { agent: DeskAgentRow; compact?: boolean }) {
  const [appState, appAction, appPending] = useActionState(approveAgent, initial);
  const [rejState, rejAction, rejPending] = useActionState(rejectAgent, initial);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <form action={appAction} className="inline-flex">
        <input type="hidden" name="agent_id" value={agent.id} />
        <input type="hidden" name="rate_tier" value={agent.rate_tier} />
        <Button
          type="submit"
          variant="citrus"
          size={compact ? "sm" : "default"}
          disabled={appPending || agent.status === "approved"}
          className="h-9"
        >
          {appPending
            ? "Approving…"
            : agent.status === "approved"
              ? "Approved"
              : "Approve & issue portal"}
        </Button>
      </form>
      <form action={rejAction} className="inline-flex">
        <input type="hidden" name="agent_id" value={agent.id} />
        <Button
          type="submit"
          variant="outline"
          size={compact ? "sm" : "default"}
          disabled={rejPending || agent.status === "rejected"}
          className="h-9 border-destructive/40 text-destructive hover:bg-destructive/5 hover:text-destructive"
        >
          {rejPending ? "Rejecting…" : agent.status === "rejected" ? "Rejected" : "Reject"}
        </Button>
      </form>
      {(appState.ok || appState.error) && <ActionFlash state={appState} />}
      {(rejState.ok || rejState.error) && <ActionFlash state={rejState} />}
    </div>
  );
}

function CreditLimitForm({ agent, compact }: { agent: DeskAgentRow; compact?: boolean }) {
  const [state, action, pending] = useActionState(setAgentCreditLimit, initial);
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="agent_id" value={agent.id} />
      <label className="block min-w-[8rem] flex-1 text-xs text-muted-foreground">
        Credit limit (Nu)
        <Input
          name="credit_limit"
          type="number"
          min={0}
          step="0.01"
          defaultValue={agent.credit_limit}
          className="mt-1.5"
          required
        />
      </label>
      <Button
        type="submit"
        variant="outline"
        size={compact ? "sm" : "default"}
        disabled={pending}
        className="h-9"
      >
        {pending ? "Saving…" : "Set limit"}
      </Button>
      <ActionFlash state={state} />
    </form>
  );
}

function OpenRoomCapForm({ agent, compact }: { agent: DeskAgentRow; compact?: boolean }) {
  const [state, action, pending] = useActionState(setAgentOpenRoomCap, initial);
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="agent_id" value={agent.id} />
      <label className="block min-w-[8rem] flex-1 text-xs text-muted-foreground">
        Open room cap (in-house)
        <Input
          name="open_room_cap"
          type="number"
          min={0}
          max={500}
          step={1}
          defaultValue={agent.open_room_cap ?? 15}
          className="mt-1.5"
          required
        />
        <span className="mt-1 block text-[10px] text-muted-foreground">
          Concurrent rooms before next check-in blocks (primary control vs Nu
          limit).
        </span>
      </label>
      <Button
        type="submit"
        variant="outline"
        size={compact ? "sm" : "default"}
        disabled={pending}
        className="h-9"
      >
        {pending ? "Saving…" : "Set room cap"}
      </Button>
      <ActionFlash state={state} />
    </form>
  );
}

function CreditPaymentForm({ agent, compact }: { agent: DeskAgentRow; compact?: boolean }) {
  const [state, action, pending] = useActionState(recordAgentCreditPayment, initial);
  const idempotencyKey = useRef(
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `agent-pay-${agent.id}-${Date.now()}`,
  );
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="agent_id" value={agent.id} />
      <input type="hidden" name="idempotency_key" value={idempotencyKey.current} />
      <div className="flex flex-wrap items-end gap-2">
        <label className="block min-w-[8rem] flex-1 text-xs text-muted-foreground">
          Payment (Nu)
          <Input name="amount_btn" type="number" min={0.01} step="0.01" className="mt-1.5" required />
        </label>
        <label className="block min-w-[10rem] flex-[2] text-xs text-muted-foreground">
          Note
          <Input name="note" type="text" className="mt-1.5" />
        </label>
        <Button
          type="submit"
          variant="citrus"
          size={compact ? "sm" : "default"}
          disabled={pending}
          className="h-9"
        >
          {pending ? "Saving…" : "Record payment"}
        </Button>
      </div>
      <ActionFlash state={state} />
    </form>
  );
}

function PortalTokenBadge({ token }: { token: string | null }) {
  const [copied, setCopied] = useState(false);
  async function copy(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }
  if (!token) {
    return (
      <p className="text-xs text-muted-foreground">Portal: not issued (approve to issue).</p>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      <p className="text-xs text-muted-foreground">Portal token</p>
      <code className="rounded-md border bg-muted px-2 py-0.5 font-mono text-xs text-foreground">
        {token}
      </code>
      <Button
        type="button"
        onClick={() => copy(token)}
        variant="outline"
        size="sm"
        className="h-7 px-2 text-[11px]"
      >
        {copied ? "Copied" : "Copy"}
      </Button>
    </div>
  );
}

export function AgentDetailPanel({
  agent,
  documents,
  compact = false,
}: {
  agent: DeskAgentRow;
  documents: AgentDocumentRow[];
  compact?: boolean;
}) {
  const available = Math.max(0, agent.credit_limit - agent.credit_used);

  return (
    <div className={`space-y-4 ${compact ? "text-sm" : ""}`}>
      <div className="flex flex-wrap items-center gap-2">
        <Button asChild size={compact ? "sm" : "default"}>
          <Link href={`/erp/agents/${agent.id}`}>Open dossier</Link>
        </Button>
        <Button asChild variant="outline" size={compact ? "sm" : "default"}>
          <Link href={`/erp/agents/${agent.id}?tab=money`}>Credit & statement</Link>
        </Button>
        <Button asChild variant="outline" size={compact ? "sm" : "default"}>
          <Link href="/erp/rate-plans">Rate plans</Link>
        </Button>
        <span className="text-xs text-muted-foreground">
          Available {formatBtn(available)} of {formatBtn(agent.credit_limit)}
        </span>
      </div>

      <div className={`grid gap-4 ${compact ? "lg:grid-cols-2" : "lg:grid-cols-2"}`}>
        <section className="rounded-lg border bg-card p-3 sm:p-4">
          <h3 className="text-[11px] font-semibold tracking-[0.16em] text-muted-foreground uppercase">
            Status & approval
          </h3>
          <div className="mt-3 space-y-3">
            <StatusForm agent={agent} compact={compact} />
            <QuickApproveReject agent={agent} compact={compact} />
            <PortalTokenBadge token={agent.portal_token} />
          </div>
        </section>

        <section className="rounded-lg border bg-card p-3 sm:p-4">
          <h3 className="text-[11px] font-semibold tracking-[0.16em] text-muted-foreground uppercase">
            Credit & room capacity
          </h3>
          <div className="mt-3 space-y-4">
            <OpenRoomCapForm agent={agent} compact={compact} />
            <CreditLimitForm agent={agent} compact={compact} />
            <CreditPaymentForm agent={agent} compact={compact} />
          </div>
        </section>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-lg border bg-card p-3 sm:p-4">
          <h3 className="text-[11px] font-semibold tracking-[0.16em] text-muted-foreground uppercase">
            Application
          </h3>
          <div className="mt-3 space-y-2 text-sm text-foreground/80">
            {agent.contact_email ? (
              <p className="text-xs text-muted-foreground">{agent.contact_email}</p>
            ) : null}
            {agent.notes ? (
              <p className="whitespace-pre-wrap text-foreground/85">{agent.notes}</p>
            ) : (
              <p className="text-muted-foreground">No notes supplied.</p>
            )}
            {agent.license_url ? (
              <p className="text-xs">
                <a
                  href={agent.license_url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-accent underline-offset-4 hover:underline"
                >
                  Open trade license →
                </a>
              </p>
            ) : null}
          </div>
        </section>

        <section className="rounded-lg border bg-card p-3 sm:p-4">
          <h3 className="text-[11px] font-semibold tracking-[0.16em] text-muted-foreground uppercase">
            Documents ({documents.length})
          </h3>
          <div className="mt-3">
            <AgentDocumentManager agentId={agent.id} documents={documents} />
          </div>
        </section>
      </div>
    </div>
  );
}
