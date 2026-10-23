"use client";

import {
  mergeDuplicateAgents,
  type ErpAgentState,
} from "@/app/actions/erp-agents";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useActionState } from "react";

const initial: ErpAgentState = { ok: false };

/** Desk tool: fold a duplicate agent row into this dossier's keeper. */
export function MergeAgentDuplicatesForm({
  keepAgentId,
  keepCompanyName,
}: {
  keepAgentId: string;
  keepCompanyName: string;
}) {
  const [state, action, pending] = useActionState(mergeDuplicateAgents, initial);

  return (
    <section className="rounded-lg border border-destructive/20 bg-card p-4 print:hidden">
      <p className="text-sm font-medium">Same company entered twice</p>
      <p className="mt-1 text-xs text-muted-foreground">
        Move stays, credit, and allotments from the other record into{" "}
        <span className="font-medium">{keepCompanyName}</span>, then close the duplicate.
      </p>
      <form action={action} className="mt-3 flex flex-wrap items-end gap-2">
        <input type="hidden" name="keep_agent_id" value={keepAgentId} />
        <div className="space-y-1">
          <Label htmlFor="merge-agent-id" className="text-xs">
            Duplicate agent UUID
          </Label>
          <Input
            id="merge-agent-id"
            name="merge_agent_id"
            required
            placeholder="Paste agent id from Agents list"
            className="h-9 w-[22rem] max-w-full font-mono text-xs"
          />
        </div>
        <Button
          type="submit"
          size="sm"
          variant="destructive"
          className="h-9"
          disabled={pending}
        >
          {pending ? "Merging…" : "Merge into this agent"}
        </Button>
      </form>
      {state.error ? (
        <p className="mt-2 text-sm text-destructive" role="alert">
          {state.error}
        </p>
      ) : null}
      {state.ok && state.message ? (
        <p className="mt-2 text-sm text-emerald-700 dark:text-emerald-300">
          {state.message}
        </p>
      ) : null}
    </section>
  );
}
