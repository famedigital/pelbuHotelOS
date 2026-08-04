"use client";

import {
  setRoomAssignmentNc,
  type MarketingState,
} from "@/app/actions/erp-marketing";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useActionToast } from "@/hooks/use-action-toast";
import { useActionState, useEffect, useRef } from "react";

const initial: MarketingState = { ok: false };

const selectClass =
  "h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]";

export function RoomNcForm({
  assignmentId,
  chargeable,
  ncReasonCode,
  reasons,
  roomLabel,
  onSuccess,
}: {
  assignmentId: string;
  chargeable: boolean;
  ncReasonCode: string | null;
  reasons: { code: string; label: string }[];
  roomLabel?: string | null;
  onSuccess?: () => void;
}) {
  const [state, action, pending] = useActionState(setRoomAssignmentNc, initial);
  useActionToast(state);
  const lastOk = useRef(false);
  useEffect(() => {
    if (state.ok && !lastOk.current) {
      lastOk.current = true;
      onSuccess?.();
    }
    if (!state.ok) lastOk.current = false;
  }, [state.ok, onSuccess]);

  if (!reasons.length && chargeable) {
    return (
      <p className="text-sm text-muted-foreground">
        No room-domain NC reasons configured. Add them under Sales &amp;
        Marketing → NC policies.
      </p>
    );
  }

  return (
    <div className="space-y-3 rounded-lg border bg-card p-3 sm:p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-medium">Room charge / NC</p>
        <p className="text-xs text-muted-foreground">
          {roomLabel ? `${roomLabel} · ` : ""}
          {chargeable ? (
            <span className="text-foreground">Chargeable</span>
          ) : (
            <span className="text-amber-800 dark:text-amber-200">
              NC{ncReasonCode ? ` · ${ncReasonCode}` : ""}
            </span>
          )}
        </p>
      </div>
      <p className="text-xs text-muted-foreground">
        Non-chargeable rooms still occupy inventory and run ops, but skip room
        rent on folio. Manager PIN required.
      </p>

      {chargeable ? (
        <form action={action} className="grid gap-3 sm:grid-cols-2">
          <input type="hidden" name="assignment_id" value={assignmentId} />
          <input type="hidden" name="chargeable" value="0" />
          <div className="space-y-1.5">
            <Label htmlFor="room_nc_reason">NC reason</Label>
            <select
              id="room_nc_reason"
              name="nc_reason_code"
              required
              className={selectClass}
              defaultValue=""
            >
              <option value="" disabled>
                Select reason…
              </option>
              {reasons.map((r) => (
                <option key={r.code} value={r.code}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="room_nc_pin">Manager PIN</Label>
            <Input
              id="room_nc_pin"
              type="password"
              name="manager_pin"
              required
              autoComplete="off"
              className="h-10"
            />
          </div>
          {state.error ? (
            <p className="text-sm text-destructive sm:col-span-2">{state.error}</p>
          ) : null}
          {state.ok && state.message ? (
            <p className="text-sm text-emerald-700 sm:col-span-2">
              {state.message}
            </p>
          ) : null}
          <Button
            type="submit"
            variant="outline"
            disabled={pending}
            className="h-10 sm:col-span-2"
          >
            {pending ? "Saving…" : "Mark room NC"}
          </Button>
        </form>
      ) : (
        <form action={action} className="space-y-3">
          <input type="hidden" name="assignment_id" value={assignmentId} />
          <input type="hidden" name="chargeable" value="1" />
          {state.error ? (
            <p className="text-sm text-destructive">{state.error}</p>
          ) : null}
          {state.ok && state.message ? (
            <p className="text-sm text-emerald-700">{state.message}</p>
          ) : null}
          <Button type="submit" disabled={pending} className="h-10">
            {pending ? "Saving…" : "Clear NC (chargeable again)"}
          </Button>
        </form>
      )}
    </div>
  );
}
