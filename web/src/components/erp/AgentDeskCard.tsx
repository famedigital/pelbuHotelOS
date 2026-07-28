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
  return "mt-1.5 w-full rounded-sm border border-espresso/15 bg-white px-3 py-2 text-sm text-espresso outline-none focus:border-gold focus:ring-2 focus:ring-gold/20";
}

function ActionFlash({ state }: { state: ErpAgentState }) {
  if (!state.ok && !state.error) return null;
  return (
    <p
      className={`mt-2 text-sm ${state.ok ? "text-espresso" : "text-maroon"}`}
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
        <label className="block text-xs text-espresso/70">
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
        <label className="block text-xs text-espresso/70">
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
      <label className="flex items-center gap-2 text-xs text-espresso/80">
        <input
          type="checkbox"
          name="wants_mou"
          value="on"
          defaultChecked={agent.wants_mou}
          className="rounded-sm border-espresso/30"
        />
        MoU interest / flag
      </label>
      <button
        type="submit"
        disabled={pending}
        className="inline-flex min-h-9 items-center rounded-sm bg-espresso px-3 text-sm text-ivory disabled:opacity-60"
      >
        {pending ? "Saving…" : "Update status"}
      </button>
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
        <button
          type="submit"
          disabled={appPending || agent.status === "approved"}
          className="inline-flex min-h-9 items-center rounded-sm bg-gold px-3 text-sm font-medium text-espresso disabled:opacity-50"
        >
          {appPending ? "Approving…" : agent.status === "approved" ? "Approved" : "Approve & issue portal"}
        </button>
      </form>
      <form action={rejAction} className="inline-flex">
        <input type="hidden" name="agent_id" value={agent.id} />
        <button
          type="submit"
          disabled={rejPending || agent.status === "rejected"}
          className="inline-flex min-h-9 items-center rounded-sm border border-maroon/40 px-3 text-sm text-maroon disabled:opacity-50"
        >
          {rejPending ? "Rejecting…" : agent.status === "rejected" ? "Rejected" : "Reject"}
        </button>
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
      <label className="block min-w-[8rem] flex-1 text-xs text-espresso/70">
        Credit limit (Nu)
        <input
          name="credit_limit"
          type="number"
          min={0}
          step="0.01"
          defaultValue={agent.credit_limit}
          className={fieldClass()}
          required
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="inline-flex min-h-9 items-center rounded-sm border border-espresso/20 px-3 text-sm text-espresso disabled:opacity-60"
      >
        {pending ? "Saving…" : "Set limit"}
      </button>
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
        <label className="block min-w-[8rem] flex-1 text-xs text-espresso/70">
          Payment (Nu)
          <input
            name="amount_btn"
            type="number"
            min={0.01}
            step="0.01"
            className={fieldClass()}
            required
          />
        </label>
        <label className="block min-w-[10rem] flex-[2] text-xs text-espresso/70">
          Note
          <input name="note" type="text" className={fieldClass()} />
        </label>
        <button
          type="submit"
          disabled={pending}
          className="inline-flex min-h-9 items-center rounded-sm bg-gold px-3 text-sm font-medium text-espresso disabled:opacity-60"
        >
          {pending ? "Saving…" : "Record payment"}
        </button>
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
      <p className="text-xs text-espresso/50">
        Portal: not issued (approve to issue).
      </p>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      <p className="text-xs text-espresso/70">Portal token</p>
      <code className="rounded-sm border border-espresso/15 bg-ivory/40 px-2 py-0.5 font-mono text-xs text-espresso">
        {token}
      </code>
      <button
        type="button"
        onClick={() => copy(token)}
        className="rounded-sm border border-espresso/15 px-2 py-0.5 text-[11px] text-espresso/70 transition-colors hover:border-gold"
      >
        {copied ? "Copied" : "Copy"}
      </button>
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
      ? "border-gold/40 bg-gold/10 text-gold"
      : agent.status === "rejected"
        ? "border-maroon/40 bg-maroon/5 text-maroon"
        : agent.status === "demo"
          ? "border-espresso/30 bg-espresso/[0.06] text-espresso"
          : "border-espresso/15 text-muted";

  return (
    <article className="border border-espresso/10 bg-white px-5 py-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-medium text-espresso">
              {agent.company_name}
            </h2>
            <span
              className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${statusTone}`}
            >
              {agent.status}
            </span>
            {agent.wants_mou ? (
              <span className="inline-flex items-center rounded-full border border-espresso/20 px-2 py-0.5 text-[10px] uppercase tracking-wide text-espresso/70">
                MoU
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-xs tracking-wide text-espresso/55 uppercase">
            {agent.market}
          </p>
          <p className="mt-2 text-sm text-espresso/80">
            {[agent.contact_name, agent.contact_phone].filter(Boolean).join(" · ") ||
              "No contact on file"}
          </p>
          {agent.contact_email ? (
            <p className="text-xs text-espresso/55">{agent.contact_email}</p>
          ) : null}
        </div>
        <div className="text-right text-sm text-espresso">
          <p>
            Used {formatBtn(agent.credit_used)} / {formatBtn(agent.credit_limit)}
          </p>
          <p className="mt-0.5 text-espresso/60">Available {formatBtn(available)}</p>
          <p className="mt-1 text-xs text-espresso/50">Tier: {agent.rate_tier}</p>
        </div>
      </div>

      <div className="mt-5 grid gap-5 border-t border-espresso/8 pt-5 lg:grid-cols-2">
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
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="inline-flex min-h-9 items-center gap-2 rounded-sm border border-espresso/15 px-3 text-xs text-espresso/70 transition-colors hover:border-gold hover:bg-gold/5"
          aria-expanded={open}
        >
          {open ? "Hide" : "Show"} notes, license & MoU documents ({documents.length})
          <span aria-hidden="true">{open ? "▴" : "▾"}</span>
        </button>
      </div>

      {open ? (
        <div className="mt-3 grid gap-4 border-t border-espresso/8 pt-4 lg:grid-cols-2">
          <div className="space-y-2 text-sm text-espresso/80">
            <p className="text-xs uppercase tracking-wide text-espresso/55">
              Application
            </p>
            {agent.notes ? (
              <p className="whitespace-pre-wrap text-espresso/85">{agent.notes}</p>
            ) : (
              <p className="text-espresso/55">No notes supplied.</p>
            )}
            {agent.license_url ? (
              <p className="text-xs">
                <a
                  href={agent.license_url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-maroon underline-offset-4 hover:underline"
                >
                  Open trade license →
                </a>
              </p>
            ) : null}
          </div>
          <AgentDocumentManager agentId={agent.id} documents={documents} />
        </div>
      ) : null}
    </article>
  );
}
