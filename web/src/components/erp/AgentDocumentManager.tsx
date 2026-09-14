"use client";

import {
  deleteAgentDocument,
  uploadAgentDocument,
  type AgentDocumentRow,
  type ErpAgentState,
} from "@/app/actions/erp-agents";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  return "mt-1.5 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]";
}

function Flash({ state }: { state: ErpAgentState }) {
  if (!state.ok && !state.error) return null;
  return (
    <p
      className={`mt-2 text-xs ${state.ok ? "text-foreground" : "text-destructive"}`}
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
      <form action={upAction} className="space-y-2 rounded-lg border bg-muted/30 p-3">
        <input type="hidden" name="agent_id" value={agentId} />
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="block text-xs text-muted-foreground">
            Document kind
            <select name="kind" defaultValue="mou_draft" className={fieldClass()} required>
              {DOC_KINDS.map((k) => (
                <option key={k.value} value={k.value}>
                  {k.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs text-muted-foreground">
            Label <span className="text-muted-foreground/60">(optional)</span>
            <Input
              name="doc_name"
              type="text"
              maxLength={140}
              placeholder="e.g. MoU signed 2026-07"
              className="mt-1.5"
            />
          </label>
        </div>
        <label className="block text-xs text-muted-foreground">
          Document URL (Cloudinary / Drive)
          <Input
            name="doc_url"
            type="url"
            required
            placeholder="https://"
            className="mt-1.5"
          />
        </label>
        <label className="block text-xs text-muted-foreground">
          Notes <span className="text-muted-foreground/60">(optional)</span>
          <Input name="notes" type="text" maxLength={300} className="mt-1.5" />
        </label>
        <Button type="submit" disabled={upPending} size="sm" className="h-9">
          {upPending ? "Saving…" : "Add document"}
        </Button>
        <Flash state={upState} />
      </form>

      {documents.length === 0 ? (
        <p className="text-xs text-muted-foreground">No documents on file yet.</p>
      ) : (
        <ul className="divide-y rounded-lg border bg-card">
          {documents.map((doc) => (
            <li key={doc.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5">
              <div className="min-w-0">
                <p className="text-sm text-foreground">
                  <span className="mr-2 inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wide">
                    {doc.kind.replace(/_/g, " ")}
                  </span>
                  <a
                    href={doc.doc_url}
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium text-accent underline-offset-4 hover:underline"
                  >
                    {doc.doc_name ?? "Open document"}
                  </a>
                </p>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {doc.notes ?? doc.doc_url}
                </p>
              </div>
              <form action={delAction}>
                <input type="hidden" name="doc_id" value={doc.id} />
                <Button
                  type="submit"
                  disabled={delPending}
                  variant="outline"
                  size="sm"
                  className="h-8 px-2 text-[11px] hover:border-destructive hover:text-destructive"
                >
                  Remove
                </Button>
              </form>
            </li>
          ))}
        </ul>
      )}
      <Flash state={delState} />
    </div>
  );
}
