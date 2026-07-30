"use client";

import { remindUnreadNotice } from "@/app/actions/erp-rota";
import { Button } from "@/components/ui/button";
import { useActionState } from "react";

const initialState = { ok: false } as const;

export function NoticeReminderButton({ announcementId }: { announcementId: string }) {
  const [state, remind] = useActionState(remindUnreadNotice, initialState);

  return (
    <form action={remind} className="mt-2 flex items-center gap-2">
      <input type="hidden" name="announcement_id" value={announcementId} />
      <Button type="submit" variant="outline" size="sm">
        Remind unread
      </Button>
      {state.error ? (
        <span className="text-xs text-destructive">{state.error}</span>
      ) : state.message ? (
        <span className="text-xs text-emerald-600">{state.message}</span>
      ) : null}
    </form>
  );
}
