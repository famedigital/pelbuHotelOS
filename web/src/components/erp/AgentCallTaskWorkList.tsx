"use client";

import {
  completeAgentCallTaskItem,
  type AgentCallActionState,
} from "@/app/actions/erp-agent-call-tasks";
import type { AgentCallTaskItemRow } from "@/lib/erp/agent-call-tasks";
import { agentDossierHref } from "@/lib/erp/agent-links";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { MailIcon, PhoneIcon } from "lucide-react";
import Link from "next/link";
import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";

const initial: AgentCallActionState = { ok: true };

function telHref(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, "")}`;
}

function OutcomeForm({ item }: { item: AgentCallTaskItemRow }) {
  const router = useRouter();
  const [state, action, pending] = useActionState(
    completeAgentCallTaskItem,
    initial,
  );

  useEffect(() => {
    if (state.ok && state.taskId) {
      router.refresh();
    }
  }, [state, router]);

  if (item.call_status === "completed") {
    return (
      <div className="rounded-md border bg-muted/30 px-2.5 py-2 text-xs">
        <p className="font-medium capitalize text-foreground">
          {item.outcome ?? "done"}
          {item.called_at
            ? ` · ${item.called_at.slice(0, 16).replace("T", " ")}`
            : ""}
        </p>
        {item.remarks ? (
          <p className="mt-0.5 text-muted-foreground">{item.remarks}</p>
        ) : null}
      </div>
    );
  }

  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="item_id" value={item.id} />
      <div className="flex flex-wrap gap-2">
        <select
          name="outcome"
          required
          defaultValue=""
          className="h-9 min-w-[8rem] flex-1 rounded-md border bg-background px-2 text-sm"
          disabled={pending}
        >
          <option value="" disabled>
            Outcome…
          </option>
          <option value="confirm">Confirm</option>
          <option value="cancel">Cancel</option>
          <option value="void">Void</option>
        </select>
        <Button type="submit" size="sm" className="h-9" disabled={pending}>
          {pending ? "Saving…" : "Tick off"}
        </Button>
      </div>
      <textarea
        name="remarks"
        rows={2}
        required
        placeholder="Remarks (who answered, notes…)"
        className="w-full rounded-md border bg-background px-2 py-1.5 text-sm"
        disabled={pending}
      />
      {state.error ? (
        <p className="text-xs text-destructive">{state.error}</p>
      ) : null}
    </form>
  );
}

export function AgentCallTaskWorkList({
  items,
  readOnly = false,
}: {
  items: AgentCallTaskItemRow[];
  readOnly?: boolean;
}) {
  const pending = items.filter((i) => i.call_status === "pending");
  const done = items.filter((i) => i.call_status === "completed");

  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <h2 className="text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
          To call ({pending.length})
        </h2>
        {pending.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            All agents on this task are ticked off.
          </p>
        ) : (
          <ul className="space-y-3">
            {pending.map((item) => (
              <li
                key={item.id}
                className="rounded-xl border bg-card p-3 shadow-xs"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <Link
                      href={agentDossierHref(item.agent_id, { tab: "bookings" })}
                      className="font-semibold text-foreground underline-offset-2 hover:underline"
                    >
                      {item.company_name}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {item.booking_count} booking
                      {item.booking_count === 1 ? "" : "s"} · {item.rooms_sold}{" "}
                      room{item.rooms_sold === 1 ? "" : "s"}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {item.contact_phone ? (
                      <a
                        href={telHref(item.contact_phone)}
                        className="inline-flex h-9 items-center gap-1 rounded-md border bg-background px-2.5 text-xs font-medium"
                      >
                        <PhoneIcon className="size-3.5" aria-hidden />
                        {item.contact_phone}
                      </a>
                    ) : (
                      <span className="inline-flex h-9 items-center rounded-md border border-dashed px-2 text-xs text-amber-800 dark:text-amber-200">
                        No phone
                      </span>
                    )}
                    {item.contact_email ? (
                      <a
                        href={`mailto:${item.contact_email}`}
                        className="inline-flex h-9 items-center gap-1 rounded-md border bg-background px-2.5 text-xs font-medium"
                      >
                        <MailIcon className="size-3.5" aria-hidden />
                        Email
                      </a>
                    ) : null}
                  </div>
                </div>
                <div className="mt-3 border-t pt-3">
                  {readOnly ? (
                    <p className="text-xs text-muted-foreground">
                      Task closed — cannot tick off.
                    </p>
                  ) : (
                    <OutcomeForm item={item} />
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {done.length > 0 ? (
        <section className="space-y-2">
          <h2 className="text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
            Completed ({done.length})
          </h2>
          <ul className="space-y-2">
            {done.map((item) => (
              <li
                key={item.id}
                className={cn(
                  "rounded-lg border px-3 py-2 text-sm",
                  item.outcome === "confirm" &&
                    "border-emerald-500/30 bg-emerald-500/5",
                  item.outcome === "cancel" &&
                    "border-amber-500/30 bg-amber-500/5",
                  item.outcome === "void" && "border-rose-500/30 bg-rose-500/5",
                )}
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-medium">{item.company_name}</span>
                  <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                    {item.outcome}
                  </span>
                </div>
                {item.remarks ? (
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {item.remarks}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
