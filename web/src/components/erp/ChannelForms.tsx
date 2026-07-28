"use client";

import {
  ackChannelRevision,
  enqueueFullAriSync,
  flushAriQueue,
  pullChannelBookings,
  saveChannelRoomMap,
  setChannelStatus,
  type ErpChannelState,
} from "@/app/actions/erp-channel";
import { useActionState } from "react";

const initial: ErpChannelState = { ok: false };

function fieldClass() {
  return "mt-1.5 w-full rounded-sm border border-espresso/15 bg-white px-3 py-2 text-sm text-espresso outline-none focus:border-gold focus:ring-2 focus:ring-gold/20";
}

function Flash({ state }: { state: ErpChannelState }) {
  if (!state.ok && !state.error) return null;
  return (
    <p className={`mt-2 text-sm ${state.ok ? "text-espresso" : "text-maroon"}`} role="status">
      {state.ok ? state.message : state.error}
    </p>
  );
}

export type RoomTypeOpt = { id: string; code: string; name: string };

export function ChannelMapForm({ roomTypes }: { roomTypes: RoomTypeOpt[] }) {
  const [state, action, pending] = useActionState(saveChannelRoomMap, initial);
  return (
    <form action={action} className="space-y-3 border border-espresso/10 bg-white p-4">
      <h3 className="text-xs font-semibold tracking-[0.18em] text-gold uppercase">
        Map room type
      </h3>
      <label className="block text-xs text-espresso/70">
        Pelbu room type
        <select name="room_type_id" required defaultValue="" className={fieldClass()}>
          <option value="" disabled>
            Select…
          </option>
          {roomTypes.map((r) => (
            <option key={r.id} value={r.id}>
              {r.code} · {r.name}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-xs text-espresso/70">
        Channex room_type_id
        <input name="external_room_type_id" required className={fieldClass()} />
      </label>
      <label className="block text-xs text-espresso/70">
        Channex rate_plan_id (optional)
        <input name="external_rate_plan_id" className={fieldClass()} />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="inline-flex min-h-10 items-center rounded-sm bg-gold px-4 text-sm font-medium text-espresso disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save map"}
      </button>
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
  return (
    <form action={action} className="space-y-3 border border-espresso/10 bg-white p-4">
      <h3 className="text-xs font-semibold tracking-[0.18em] text-gold uppercase">
        Connection
      </h3>
      <label className="block text-xs text-espresso/70">
        Status
        <select name="status" defaultValue={status} className={fieldClass()}>
          <option value="draft">draft</option>
          <option value="mapping">mapping</option>
          <option value="staging">staging</option>
          <option value="live">live</option>
          <option value="paused">paused</option>
        </select>
      </label>
      <label className="block text-xs text-espresso/70">
        Channex property id
        <input
          name="external_property_id"
          defaultValue={externalPropertyId ?? ""}
          className={fieldClass()}
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="inline-flex min-h-10 items-center rounded-sm bg-espresso px-4 text-sm font-medium text-ivory disabled:opacity-60"
      >
        {pending ? "Saving…" : "Update connection"}
      </button>
      <Flash state={state} />
    </form>
  );
}

export function ChannelQueueActions() {
  const [syncState, syncAction, syncPending] = useActionState(enqueueFullAriSync, initial);
  const [flushState, flushAction, flushPending] = useActionState(flushAriQueue, initial);
  const [pullState, pullAction, pullPending] = useActionState(pullChannelBookings, initial);

  return (
    <div className="space-y-4 border border-espresso/10 bg-white p-4">
      <h3 className="text-xs font-semibold tracking-[0.18em] text-gold uppercase">
        ARI / bookings
      </h3>
      <p className="text-xs text-muted">
        Queue is local until <code className="font-mono">CHANNEX_API_KEY</code> is set.
        Flush only works in staging/live with property id mapped.
      </p>
      <div className="flex flex-wrap gap-2">
        <form action={syncAction}>
          <button
            type="submit"
            disabled={syncPending}
            className="inline-flex min-h-10 items-center rounded-sm border border-espresso/20 px-3 text-xs font-medium text-espresso disabled:opacity-60"
          >
            {syncPending ? "…" : "Queue 90d ARI"}
          </button>
        </form>
        <form action={flushAction}>
          <button
            type="submit"
            disabled={flushPending}
            className="inline-flex min-h-10 items-center rounded-sm bg-gold px-3 text-xs font-medium text-espresso disabled:opacity-60"
          >
            {flushPending ? "…" : "Flush ARI queue"}
          </button>
        </form>
        <form action={pullAction}>
          <button
            type="submit"
            disabled={pullPending}
            className="inline-flex min-h-10 items-center rounded-sm bg-espresso px-3 text-xs font-medium text-ivory disabled:opacity-60"
          >
            {pullPending ? "…" : "Pull booking feed"}
          </button>
        </form>
      </div>
      <Flash state={syncState} />
      <Flash state={flushState} />
      <Flash state={pullState} />
    </div>
  );
}

export function AckRevisionButton({ revisionId }: { revisionId: string }) {
  const [state, action, pending] = useActionState(ackChannelRevision, initial);
  return (
    <form action={action} className="inline">
      <input type="hidden" name="revision_id" value={revisionId} />
      <button
        type="submit"
        disabled={pending}
        className="inline-flex min-h-9 items-center text-xs font-medium text-maroon underline-offset-4 hover:underline disabled:opacity-60"
      >
        {pending ? "…" : "Ack"}
      </button>
      <Flash state={state} />
    </form>
  );
}
