"use client";

import {
  deleteAgentDocument,
  uploadAgentDocument,
  type AgentDocumentRow,
  type ErpAgentState,
} from "@/app/actions/erp-agents";
import { useActionState } from "react";

const initial: ErpAgentState = { ok: false };

const DOC_KINDS = [
  { value: "license", label: "Trade license" },
  { value: "mou_draft", label: "MoU draft" },
  { value: "mou_signed", label: "MoU signed" },
  { value: "gst_cert", label: "GST / tax certificate" },
  { value: "other", label: "Other" },
] as const;

function fieldClass() {
  return "mt-1.5 w-full rounded-sm border border-espresso/15 bg-white px-3 py-2 text-sm text-espresso outline-none focus:border-gold focus:ring-2 focus:ring-gold/20";
}

function Flash({ state }: { state: ErpAgentState }) {
  if (!state.ok && !state.error) return null;
  return (
    <p
      className={`mt-2 text-xs ${state.ok ? "text-espresso" : "text-maroon"}`}
      role="status"
    >
      {state.ok ? state.message : state.error}
    </p>
  );
}

export function AgentDocumentManager({
  agentId,
  documents,
}: {
  agentId: string;
  documents: AgentDocumentRow[];
}) {
  const [upState, upAction, upPending] = useActionState(uploadAgentDocument, initial);
  const [delState, delAction, delPending] = useActionState(
    deleteAgentDocument,
    initial,
  );

  return (
    <div className="space-y-4">
      <form action={upAction} className="space-y-2 border border-espresso/10 bg-ivory/40 p-3">
        <input type="hidden" name="agent_id" value={agentId} />
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="block text-xs text-espresso/70">
            Document kind
            <select name="kind" defaultValue="mou_draft" className={fieldClass()} required>
              {DOC_KINDS.map((k) => (
                <option key={k.value} value={k.value}>
                  {k.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs text-espresso/70">
            Label <span className="text-espresso/40">(optional)</span>
            <input
              name="doc_name"
              type="text"
              maxLength={140}
              placeholder="e.g. MoU signed 2026-07"
              className={fieldClass()}
            />
          </label>
        </div>
        <label className="block text-xs text-espresso/70">
          Document URL (Cloudinary / Drive)
          <input
            name="doc_url"
            type="url"
            required
            placeholder="https://"
            className={fieldClass()}
          />
        </label>
        <label className="block text-xs text-espresso/70">
          Notes <span className="text-espresso/40">(optional)</span>
          <input name="notes" type="text" maxLength={300} className={fieldClass()} />
        </label>
        <button
          type="submit"
          disabled={upPending}
          className="inline-flex min-h-9 items-center rounded-sm bg-espresso px-3 text-sm text-ivory disabled:opacity-60"
        >
          {upPending ? "Saving…" : "Add document"}
        </button>
        <Flash state={upState} />
      </form>

      {documents.length === 0 ? (
        <p className="text-xs text-espresso/55">No documents on file yet.</p>
      ) : (
        <ul className="divide-y divide-espresso/8 border border-espresso/10 bg-white">
          {documents.map((doc) => (
            <li key={doc.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5">
              <div className="min-w-0">
                <p className="text-sm text-espresso">
                  <span className="mr-2 inline-flex items-center rounded-full border border-espresso/15 px-2 py-0.5 text-[10px] uppercase tracking-wide">
                    {doc.kind.replace(/_/g, " ")}
                  </span>
                  <a
                    href={doc.doc_url}
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium text-maroon underline-offset-4 hover:underline"
                  >
                    {doc.doc_name ?? "Open document"}
                  </a>
                </p>
                <p className="mt-0.5 truncate text-xs text-espresso/55">
                  {doc.notes ?? doc.doc_url}
                </p>
              </div>
              <form action={delAction}>
                <input type="hidden" name="doc_id" value={doc.id} />
                <button
                  type="submit"
                  disabled={delPending}
                  className="rounded-sm border border-espresso/15 px-2 py-1 text-[11px] text-espresso/70 transition-colors hover:border-maroon hover:text-maroon disabled:opacity-60"
                >
                  Remove
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
      <Flash state={delState} />
    </div>
  );
}
