"use client";

import { copyRotaWeek, publishRotaWeek } from "@/app/actions/erp-rota";
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
  const pending = publishPending || copyPending;

  useActionToast(publishState, { successMessage: "Week published" });
  useActionToast(copyState, { successMessage: "Week copied" });
  usePendingFeedback(pending, "Updating rota…");

  useEffect(() => {
    if (publishState.ok || copyState.ok) router.refresh();
  }, [publishState.ok, copyState.ok, router]);

  const feedback = publishState.error
    ? { tone: "error", text: publishState.error }
    : publishState.message
      ? { tone: "ok", text: publishState.message }
      : copyState.error
        ? { tone: "error", text: copyState.error }
        : copyState.message
          ? { tone: "ok", text: copyState.message }
          : null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <form action={copy}>
        <input type="hidden" name="source_week_start" value={prevWeekStart} />
        <input type="hidden" name="target_week_start" value={weekStart} />
        <Button type="submit" variant="outline" size="sm" disabled={pending}>
          Copy last week
        </Button>
      </form>
      <form action={publish}>
        <input type="hidden" name="week_start" value={weekStart} />
        <Button type="submit" size="sm" disabled={pending}>
          Publish week &amp; alert staff
        </Button>
      </form>
      {feedback ? (
        <span
          className={`text-sm ${
            feedback.tone === "error" ? "text-destructive" : "text-emerald-600"
          }`}
        >
          {feedback.text}
        </span>
      ) : null}
    </div>
  );
}
