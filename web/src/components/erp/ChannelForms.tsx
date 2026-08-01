"use client";

import {
  ackChannelRevision,
  enqueueFullAriSync,
  flushAriQueue,
  pullChannelBookings,
  retryFailedAriJobs,
  saveChannelRoomMap,
  setChannelStatus,
  type ErpChannelState,
} from "@/app/actions/erp-channel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useActionToast } from "@/hooks/use-action-toast";
import { useActionState } from "react";

const initial: ErpChannelState = { ok: false };

function selectClass() {
  return "mt-1.5 flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] cursor-pointer";
}

function Flash({ state }: { state: ErpChannelState }) {
  if (!state.ok && !state.error) return null;
  return (
    <p
      className={`erp mt-2 text-sm ${state.ok ? "text-foreground" : "text-destructive"}`}
      role="status"
    >
      {state.ok ? state.message : state.error}
    </p>
  );
}

export type RoomTypeOpt = { id: string; code: string; name: string };

export type MappingChecklistItem = {
  roomTypeId: string;
  code: string;
  name: string;
  mapped: boolean;
  hasRatePlan: boolean;
};

export function ChannelMappingChecklist({
  items,
  apiReady,
  hasExternalProperty,
  connectionStatus,
  failedCount,
  pendingCount,
}: {
  items: MappingChecklistItem[];
  apiReady: boolean;
  hasExternalProperty: boolean;
  connectionStatus: string;
  failedCount: number;
  pendingCount: number;
}) {
  const mapped = items.filter((i) => i.mapped).length;
  const withRates = items.filter((i) => i.hasRatePlan).length;
  const readyToFlush =
    apiReady &&
    hasExternalProperty &&
    ["staging", "live"].includes(connectionStatus) &&
    mapped > 0;

  return (
    <div className="erp space-y-3 rounded-lg border bg-card p-4">
      <h3 className="text-[11px] font-semibold tracking-[0.2em] text-accent uppercase">
        Mapping checklist
      </h3>
      <ul className="space-y-1.5 text-xs text-muted-foreground">
        <li className={apiReady ? "text-foreground" : ""}>
          {apiReady ? "✓" : "○"} CHANNEX_API_KEY in env
        </li>
        <li className={hasExternalProperty ? "text-foreground" : ""}>
          {hasExternalProperty ? "✓" : "○"} Channex property id on connection
        </li>
        <li
          className={
            ["staging", "live"].includes(connectionStatus)
              ? "text-foreground"
              : ""
          }
        >
          {["staging", "live"].includes(connectionStatus) ? "✓" : "○"} Status
          staging or live (now: {connectionStatus})
        </li>
        <li className={mapped > 0 ? "text-foreground" : ""}>
          {mapped > 0 ? "✓" : "○"} Room types mapped ({mapped}/{items.length})
        </li>
        <li className={withRates > 0 ? "text-foreground" : ""}>
          {withRates > 0 ? "✓" : "○"} Rate plans mapped ({withRates}/
          {items.length}) — needed for rates / min-stay / stop-sell
        </li>
        <li className={readyToFlush ? "text-foreground" : ""}>
          {readyToFlush ? "✓" : "○"} Ready to flush
          {pendingCount > 0 ? ` · ${pendingCount} pending` : ""}
          {failedCount > 0 ? ` · ${failedCount} failed` : ""}
        </li>
      </ul>
      {items.length > 0 ? (
        <ul className="divide-y border-t pt-2">
          {items.map((item) => (
            <li
              key={item.roomTypeId}
              className="flex flex-wrap items-baseline justify-between gap-2 py-2 font-mono text-[11px]"
            >
              <span className="text-foreground">
                {item.code} · {item.name}
              </span>
              <span className="text-muted-foreground">
                {item.mapped
                  ? item.hasRatePlan
                    ? "room + rate"
                    : "room only"
                  : "unmapped"}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export function ChannelMapForm({ roomTypes }: { roomTypes: RoomTypeOpt[] }) {
  const [state, action, pending] = useActionState(saveChannelRoomMap, initial);
  useActionToast(state, { successMessage: "Room mapping saved" });
  return (
    <form action={action} className="erp space-y-3 rounded-lg border bg-card p-4">
      <h3 className="text-[11px] font-semibold tracking-[0.2em] text-accent uppercase">
        Map room type
      </h3>
      <div className="space-y-1.5">
        <Label htmlFor="room_type_id" className="text-xs text-muted-foreground">
          Pelbu room type
        </Label>
        <select
          id="room_type_id"
          name="room_type_id"
          required
          defaultValue=""
          className={selectClass()}
        >
          <option value="" disabled>
            Select…
          </option>
          {roomTypes.map((r) => (
            <option key={r.id} value={r.id}>
              {r.code} · {r.name}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1.5">
        <Label
          htmlFor="external_room_type_id"
          className="text-xs text-muted-foreground"
        >
          Channex room_type_id
        </Label>
        <Input
          id="external_room_type_id"
          name="external_room_type_id"
          required
        />
      </div>
      <div className="space-y-1.5">
        <Label
          htmlFor="external_rate_plan_id"
          className="text-xs text-muted-foreground"
        >
          Channex rate_plan_id (required for rates / stop-sell)
        </Label>
        <Input id="external_rate_plan_id" name="external_rate_plan_id" />
      </div>
      <Button type="submit" variant="citrus" disabled={pending} className="h-10 w-full">
        {pending ? "Saving…" : "Save map"}
      </Button>
      <Flash state={state} />
    </form>
  );
}

export function ChannelStatusForm({
  status,
  externalPropertyId,
}: {
  status: string;
  externalPropertyId: string | null;
}) {
  const [state, action, pending] = useActionState(setChannelStatus, initial);
  useActionToast(state, { successMessage: "Connection updated" });
  return (
    <form action={action} className="erp space-y-3 rounded-lg border bg-card p-4">
      <h3 className="text-[11px] font-semibold tracking-[0.2em] text-accent uppercase">
        Connection
      </h3>
      <div className="space-y-1.5">
        <Label htmlFor="channel_status" className="text-xs text-muted-foreground">
          Status
        </Label>
        <select
          id="channel_status"
          name="status"
          defaultValue={status}
          className={selectClass()}
        >
          <option value="draft">draft</option>
          <option value="mapping">mapping</option>
          <option value="staging">staging</option>
          <option value="live">live</option>
          <option value="paused">paused</option>
        </select>
      </div>
      <div className="space-y-1.5">
        <Label
          htmlFor="external_property_id"
          className="text-xs text-muted-foreground"
        >
          Channex property id
        </Label>
        <Input
          id="external_property_id"
          name="external_property_id"
          defaultValue={externalPropertyId ?? ""}
        />
      </div>
      <Button
        type="submit"
        disabled={pending}
        className="h-10 w-full"
      >
        {pending ? "Saving…" : "Update connection"}
      </Button>
      <Flash state={state} />
    </form>
  );
}

export function ChannelQueueActions({ failedCount = 0 }: { failedCount?: number }) {
  const [syncState, syncAction, syncPending] = useActionState(
    enqueueFullAriSync,
    initial,
  );
  const [flushState, flushAction, flushPending] = useActionState(
    flushAriQueue,
    initial,
  );
  const [retryState, retryAction, retryPending] = useActionState(
    retryFailedAriJobs,
    initial,
  );
  const [pullState, pullAction, pullPending] = useActionState(
    pullChannelBookings,
    initial,
  );
  useActionToast(syncState, { successMessage: "ARI sync queued" });
  useActionToast(flushState, { successMessage: "ARI queue flushed" });
  useActionToast(retryState, { successMessage: "Failed jobs re-queued" });
  useActionToast(pullState, { successMessage: "Bookings pulled" });

  return (
    <div className="erp space-y-4 rounded-lg border bg-card p-4">
      <h3 className="text-[11px] font-semibold tracking-[0.2em] text-accent uppercase">
        ARI / bookings
      </h3>
      <p className="text-xs text-muted-foreground">
        Queue builds local availability + public rates + min-stay / stop-sell
        batches. Flush requires <code className="font-mono">CHANNEX_API_KEY</code>
        , staging/live status, Channex property id, and room maps. Failed jobs
        stay marked until you retry then flush again. Live certification is a
        human packet (see docs/CHANNEX-CERT.md) — desk flush alone does not
        raise Channel maturity past ~40–55.
      </p>
      <div className="flex flex-wrap gap-2">
        <form action={syncAction}>
          <Button
            type="submit"
            variant="outline"
            size="sm"
            disabled={syncPending}
            className="h-10 text-xs"
          >
            {syncPending ? "Queuing…" : "Queue 90d ARI"}
          </Button>
        </form>
        <form action={flushAction}>
          <Button
            type="submit"
            variant="citrus"
            size="sm"
            disabled={flushPending}
            className="h-10 text-xs"
          >
            {flushPending ? "Flushing…" : "Flush pending"}
          </Button>
        </form>
        <form action={retryAction}>
          <Button
            type="submit"
            variant="outline"
            size="sm"
            disabled={retryPending || failedCount === 0}
            className="h-10 text-xs"
          >
            {retryPending
              ? "Retrying…"
              : failedCount > 0
                ? `Retry ${failedCount} failed`
                : "Retry failed"}
          </Button>
        </form>
        <form action={pullAction}>
          <Button
            type="submit"
            size="sm"
            disabled={pullPending}
            className="h-10 text-xs"
          >
            {pullPending ? "Pulling…" : "Pull booking feed"}
          </Button>
        </form>
      </div>
      <Flash state={syncState} />
      <Flash state={flushState} />
      <Flash state={retryState} />
      <Flash state={pullState} />
    </div>
  );
}

export function AckRevisionButton({ revisionId }: { revisionId: string }) {
  const [state, action, pending] = useActionState(ackChannelRevision, initial);
  useActionToast(state, { successMessage: "Revision acknowledged" });
  return (
    <form action={action} className="erp inline">
      <input type="hidden" name="revision_id" value={revisionId} />
      <Button
        type="submit"
        variant="ghost"
        size="sm"
        disabled={pending}
        className="text-xs font-medium text-accent"
      >
        {pending ? "Acking…" : "Ack"}
      </Button>
      <Flash state={state} />
    </form>
  );
}
