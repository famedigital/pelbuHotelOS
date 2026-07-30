"use client";

import {
  approveAgent,
  recordAgentCreditPayment,
  rejectAgent,
  setAgentCreditLimit,
  updateAgentDeskStatus,
  type AgentDocumentRow,
  type ErpAgentState,
} from "@/app/actions/erp-agents";
import { AgentDocumentManager } from "@/components/erp/AgentDocumentManager";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatBtn } from "@/lib/pricing";
import { useActionState, useState } from "react";

export type DeskAgentRow = {
  id: string;
  company_name: string;
  market: string;
  contact_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  license_url: string | null;
  notes: string | null;
  status: string;
  rate_tier: string;
  credit_limit: number;
  credit_used: number;
  wants_mou: boolean;
  approved_at: string | null;
  created_at: string;
  portal_token: string | null;
};

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

function StatusForm({ agent }: { agent: DeskAgentRow }) {
  const [state, action, pending] = useActionState(updateAgentDeskStatus, initial);
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="agent_id" value={agent.id} />
      <div className="grid gap-2 sm:grid-cols-2">
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
        <Checkbox
          name="wants_mou"
          value="on"
          defaultChecked={agent.wants_mou}
        />
        MoU interest / flag
      </label>
      <Button type="submit" disabled={pending} size="sm" className="h-9">
        {pending ? "Saving…" : "Update status"}
      </Button>
      <ActionFlash state={state} />
    </form>
  );
}

function QuickApproveReject({ agent }: { agent: DeskAgentRow }) {
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
          size="sm"
          disabled={appPending || agent.status === "approved"}
          className="h-9"
        >
          {appPending ? "Approving…" : agent.status === "approved" ? "Approved" : "Approve & issue portal"}
        </Button>
      </form>
      <form action={rejAction} className="inline-flex">
        <input type="hidden" name="agent_id" value={agent.id} />
        <Button
          type="submit"
          variant="outline"
          size="sm"
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

function CreditLimitForm({ agent }: { agent: DeskAgentRow }) {
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
        size="sm"
        disabled={pending}
        className="h-9"
      >
        {pending ? "Saving…" : "Set limit"}
      </Button>
      <ActionFlash state={state} />
    </form>
  );
}

function CreditPaymentForm({ agent }: { agent: DeskAgentRow }) {
  const [state, action, pending] = useActionState(
    recordAgentCreditPayment,
    initial,
  );
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="agent_id" value={agent.id} />
      <div className="flex flex-wrap items-end gap-2">
        <label className="block min-w-[8rem] flex-1 text-xs text-muted-foreground">
          Payment (Nu)
          <Input
            name="amount_btn"
            type="number"
            min={0.01}
            step="0.01"
            className="mt-1.5"
            required
          />
        </label>
        <label className="block min-w-[10rem] flex-[2] text-xs text-muted-foreground">
          Note
          <Input name="note" type="text" className="mt-1.5" />
        </label>
        <Button
          type="submit"
          variant="citrus"
          size="sm"
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
      <p className="text-xs text-muted-foreground">
        Portal: not issued (approve to issue).
      </p>
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

export function AgentDeskCard({
  agent,
  documents,
}: {
  agent: DeskAgentRow;
  documents: AgentDocumentRow[];
}) {
  const [open, setOpen] = useState(false);
  const available = Math.max(0, agent.credit_limit - agent.credit_used);
  const statusTone =
    agent.status === "approved"
      ? "border-citrus/40 bg-citrus-tint/60 text-citrus"
      : agent.status === "rejected"
        ? "border-destructive/40 bg-destructive/5 text-destructive"
        : agent.status === "demo"
          ? "border-accent/30 bg-accent/10 text-accent"
          : "border-border text-muted-foreground";

  return (
    <Card className="erp gap-0 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-medium text-foreground">
              {agent.company_name}
            </h2>
            <span
              className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${statusTone}`}
            >
              {agent.status}
            </span>
            {agent.wants_mou ? (
              <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                MoU
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-xs tracking-wide text-muted-foreground uppercase">
            {agent.market}
          </p>
          <p className="mt-2 text-sm text-foreground/80">
            {[agent.contact_name, agent.contact_phone].filter(Boolean).join(" · ") ||
              "No contact on file"}
          </p>
          {agent.contact_email ? (
            <p className="text-xs text-muted-foreground">{agent.contact_email}</p>
          ) : null}
          <a
            href={`/erp/agents/${agent.id}/statement`}
            className="mt-3 inline-flex text-sm text-accent underline-offset-4 hover:underline"
          >
            Statement →
          </a>
        </div>
        <div className="text-right text-sm text-foreground">
          <p>
            Used {formatBtn(agent.credit_used)} / {formatBtn(agent.credit_limit)}
          </p>
          <p className="mt-0.5 text-muted-foreground">Available {formatBtn(available)}</p>
          <p className="mt-1 text-xs text-muted-foreground">Tier: {agent.rate_tier}</p>
        </div>
      </div>

      <div className="mt-5 grid gap-5 border-t pt-5 lg:grid-cols-2">
        <div className="space-y-3">
          <StatusForm agent={agent} />
          <QuickApproveReject agent={agent} />
          <PortalTokenBadge token={agent.portal_token} />
        </div>
        <div className="space-y-4">
          <CreditLimitForm agent={agent} />
          <CreditPaymentForm agent={agent} />
        </div>
      </div>

      <div className="mt-4">
        <Button
          type="button"
          onClick={() => setOpen((v) => !v)}
          variant="outline"
          size="sm"
          className="h-9 gap-2 text-xs"
          aria-expanded={open}
        >
          {open ? "Hide" : "Show"} notes, license & MoU documents ({documents.length})
          <span aria-hidden="true">{open ? "▴" : "▾"}</span>
        </Button>
      </div>

      {open ? (
        <div className="mt-3 grid gap-4 border-t pt-4 lg:grid-cols-2">
          <div className="space-y-2 text-sm text-foreground/80">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Application
            </p>
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
          <AgentDocumentManager agentId={agent.id} documents={documents} />
        </div>
      ) : null}
    </Card>
  );
}
