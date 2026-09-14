"use client";

import {
  autoGenerateRotaWeek,
  copyRotaWeek,
  publishRotaWeek,
} from "@/app/actions/erp-rota";
import { Button } from "@/components/ui/button";
import { useActionToast } from "@/hooks/use-action-toast";
import { usePendingFeedback } from "@/hooks/use-pending-feedback";
import { useRouter } from "next/navigation";
import { useActionState, useEffect } from "react";

const initialState = { ok: false } as const;

export function RotaWeekControls({
  weekStart,
  prevWeekStart,
}: {
  weekStart: string;
  prevWeekStart: string;
}) {
  const router = useRouter();
  const [publishState, publish, publishPending] = useActionState(
    publishRotaWeek,
    initialState,
  );
  const [copyState, copy, copyPending] = useActionState(copyRotaWeek, initialState);
  const [genState, generate, genPending] = useActionState(
    autoGenerateRotaWeek,
    initialState,
  );
  const pending = publishPending || copyPending || genPending;

  useActionToast(publishState, { successMessage: "Week published" });
  useActionToast(copyState, { successMessage: "Week copied" });
  useActionToast(genState, { successMessage: "Draft week generated" });
  usePendingFeedback(pending, "Updating rota…");

  useEffect(() => {
    if (publishState.ok || copyState.ok || genState.ok) router.refresh();
  }, [publishState.ok, copyState.ok, genState.ok, router]);

  const feedbacks = [publishState, copyState, genState];
  const feedback =
    feedbacks.find((s) => s.error)?.error
      ? { tone: "error" as const, text: feedbacks.find((s) => s.error)!.error! }
      : feedbacks.find((s) => s.message)
        ? {
            tone: "ok" as const,
            text: feedbacks.find((s) => s.message)!.message!,
          }
        : null;

  const details =
    copyState.details ?? genState.details ?? publishState.details ?? null;

  return (
    <div className="flex w-full flex-col gap-2 sm:items-end">
      <div className="flex flex-wrap items-center gap-2">
        <form action={generate}>
          <input type="hidden" name="week_start" value={weekStart} />
          <Button type="submit" variant="outline" size="sm" className="h-11 min-h-11" disabled={pending}>
            Generate week
          </Button>
        </form>
        <form action={copy}>
          <input type="hidden" name="source_week_start" value={prevWeekStart} />
          <input type="hidden" name="target_week_start" value={weekStart} />
          <Button type="submit" variant="outline" size="sm" className="h-11 min-h-11" disabled={pending}>
            Copy last week
          </Button>
        </form>
        <form action={publish}>
          <input type="hidden" name="week_start" value={weekStart} />
          <Button type="submit" size="sm" className="h-11 min-h-11" disabled={pending}>
            Publish week &amp; alert staff
          </Button>
        </form>
      </div>
      {feedback ? (
        <div className="max-w-md text-sm">
          <p
            className={
              feedback.tone === "error" ? "text-destructive" : "text-emerald-600"
            }
          >
            {feedback.text}
          </p>
          {details?.length ? (
            <ul className="mt-1 list-disc pl-4 text-xs text-muted-foreground">
              {details.slice(0, 8).map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
