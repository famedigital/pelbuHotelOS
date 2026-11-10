"use client";

import { acknowledgeNotice, markNoticeRead } from "@/app/actions/staff-portal";
import { Button } from "@/components/ui/button";
import { useActionState, useEffect, useRef } from "react";

const initialState = { ok: false } as const;

export function NoticeAckPanel({
  announcementId,
  requiresAcknowledgement,
  alreadyRead,
  acknowledgedAt,
}: {
  announcementId: string;
  requiresAcknowledgement: boolean;
  alreadyRead: boolean;
  acknowledgedAt: string | null;
}) {
  const [readState, markRead] = useActionState(markNoticeRead, initialState);
  const [ackState, acknowledge] = useActionState(acknowledgeNotice, initialState);
  const readFired = useRef(false);

  useEffect(() => {
    if (!alreadyRead && !readFired.current) {
      readFired.current = true;
      const form = new FormData();
      form.set("announcement_id", announcementId);
      markRead(form);
    }
  }, [alreadyRead, announcementId, markRead]);

  if (acknowledgedAt || ackState.ok) {
    return (
      <p className="text-sm font-medium text-emerald-600">
        Acknowledged. Thank you.
      </p>
    );
  }

  if (!requiresAcknowledgement) {
    return (
      <p className="text-xs text-muted-foreground">
        {readState.ok || alreadyRead ? "Marked as read." : "Opening…"}
      </p>
    );
  }

  return (
    <form action={acknowledge} className="space-y-2">
      <input type="hidden" name="announcement_id" value={announcementId} />
      <p className="text-sm text-muted-foreground">
        This notice needs your acknowledgement.
      </p>
      <Button type="submit">I acknowledge this notice</Button>
      {ackState.error ? (
        <p className="text-sm text-destructive">{ackState.error}</p>
      ) : null}
    </form>
  );
}
