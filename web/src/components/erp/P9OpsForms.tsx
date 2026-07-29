"use client";

import {
  addBookingToGroup,
  createAgentAllotment,
  createBookingGroup,
  createHkAssignment,
  createMaintenanceOrder,
  updateHkAssignmentStatus,
  updateMaintenanceStatus,
  type OpsState,
} from "@/app/actions/erp-p9-ops";
import { useActionState } from "react";

const initial: OpsState = { ok: false };

function fieldClass() {
  return "mt-1 w-full rounded-sm border border-espresso/15 bg-white px-3 py-2 text-sm text-espresso";
}

export function HkAssignForm({
  units,
  staff,
  today,
}: {
  units: { id: string; label: string }[];
  staff: { id: string; full_name: string }[];
  today: string;
}) {
  const [state, action, pending] = useActionState(createHkAssignment, initial);
  return (
    <form action={action} className="grid gap-3 border border-espresso/10 bg-white p-4 sm:grid-cols-2">
      <label className="text-sm">
        Room
        <select name="room_unit_id" required className={fieldClass()}>
          <option value="">Select…</option>
          {units.map((u) => (
            <option key={u.id} value={u.id}>
              {u.label}
            </option>
          ))}
        </select>
      </label>
      <label className="text-sm">
        Staff
        <select name="staff_id" required className={fieldClass()}>
          <option value="">Select…</option>
          {staff.map((s) => (
            <option key={s.id} value={s.id}>
              {s.full_name}
            </option>
          ))}
        </select>
      </label>
      <label className="text-sm">
        Date
        <input type="date" name="business_date" defaultValue={today} required className={fieldClass()} />
      </label>
      <label className="text-sm sm:col-span-2">
        Notes
        <input name="notes" className={fieldClass()} />
      </label>
      {state.error ? <p className="text-sm text-maroon sm:col-span-2">{state.error}</p> : null}
      {state.message ? <p className="text-sm text-espresso sm:col-span-2">{state.message}</p> : null}
      <button
        type="submit"
        disabled={pending}
        className="inline-flex min-h-11 items-center justify-center rounded-sm bg-espresso px-4 text-sm text-ivory sm:col-span-2"
      >
        {pending ? "Saving…" : "Assign room"}
      </button>
    </form>
  );
}

export function HkStatusForm({ id, status }: { id: string; status: string }) {
  const [state, action, pending] = useActionState(updateHkAssignmentStatus, initial);
  return (
    <form action={action} className="flex items-center gap-2">
      <input type="hidden" name="id" value={id} />
      <select name="status" defaultValue={status} className="rounded-sm border border-espresso/15 px-2 py-1 text-xs">
        <option value="open">open</option>
        <option value="in_progress">in_progress</option>
        <option value="done">done</option>
        <option value="skipped">skipped</option>
      </select>
      <button type="submit" disabled={pending} className="text-xs text-maroon underline-offset-2 hover:underline">
        Update
      </button>
      {state.error ? <span className="text-xs text-maroon">{state.error}</span> : null}
    </form>
  );
}

export function MaintenanceCreateForm({
  units,
  staff,
}: {
  units: { id: string; label: string }[];
  staff: { id: string; full_name: string }[];
}) {
  const [state, action, pending] = useActionState(createMaintenanceOrder, initial);
  return (
    <form action={action} className="grid gap-3 border border-espresso/10 bg-white p-4 sm:grid-cols-2">
      <label className="text-sm sm:col-span-2">
        Title
        <input name="title" required className={fieldClass()} placeholder="AC not cooling · 203" />
      </label>
      <label className="text-sm sm:col-span-2">
        Description
        <textarea name="description" rows={2} className={fieldClass()} />
      </label>
      <label className="text-sm">
        Room (optional)
        <select name="room_unit_id" className={fieldClass()}>
          <option value="">—</option>
          {units.map((u) => (
            <option key={u.id} value={u.id}>
              {u.label}
            </option>
          ))}
        </select>
      </label>
      <label className="text-sm">
        Priority
        <select name="priority" defaultValue="normal" className={fieldClass()}>
          <option value="low">low</option>
          <option value="normal">normal</option>
          <option value="high">high</option>
          <option value="urgent">urgent</option>
        </select>
      </label>
      <label className="text-sm sm:col-span-2">
        Assign to
        <select name="assigned_staff_id" className={fieldClass()}>
          <option value="">Unassigned</option>
          {staff.map((s) => (
            <option key={s.id} value={s.id}>
              {s.full_name}
            </option>
          ))}
        </select>
      </label>
      {state.error ? <p className="text-sm text-maroon sm:col-span-2">{state.error}</p> : null}
      <button
        type="submit"
        disabled={pending}
        className="inline-flex min-h-11 items-center justify-center rounded-sm bg-espresso px-4 text-sm text-ivory sm:col-span-2"
      >
        {pending ? "Saving…" : "Create work order"}
      </button>
    </form>
  );
}

export function MaintenanceStatusForm({ id, status }: { id: string; status: string }) {
  const [state, action, pending] = useActionState(updateMaintenanceStatus, initial);
  return (
    <form action={action} className="flex items-center gap-2">
      <input type="hidden" name="id" value={id} />
      <select name="status" defaultValue={status} className="rounded-sm border border-espresso/15 px-2 py-1 text-xs">
        <option value="open">open</option>
        <option value="in_progress">in_progress</option>
        <option value="done">done</option>
        <option value="cancelled">cancelled</option>
      </select>
      <button type="submit" disabled={pending} className="text-xs text-maroon underline-offset-2 hover:underline">
        Update
      </button>
      {state.error ? <span className="text-xs text-maroon">{state.error}</span> : null}
    </form>
  );
}

export function BookingGroupCreateForm({
  agents,
  bookings,
}: {
  agents: { id: string; company_name: string }[];
  bookings: { id: string; label: string }[];
}) {
  const [state, action, pending] = useActionState(createBookingGroup, initial);
  return (
    <form action={action} className="grid gap-3 border border-espresso/10 bg-white p-4 sm:grid-cols-2">
      <label className="text-sm sm:col-span-2">
        Group name
        <input name="name" required className={fieldClass()} placeholder="Jaigaon group · Apr" />
      </label>
      <label className="text-sm">
        Agent
        <select name="agent_id" className={fieldClass()}>
          <option value="">—</option>
          {agents.map((a) => (
            <option key={a.id} value={a.id}>
              {a.company_name}
            </option>
          ))}
        </select>
      </label>
      <label className="text-sm">
        Seed booking
        <select name="booking_id" className={fieldClass()}>
          <option value="">—</option>
          {bookings.map((b) => (
            <option key={b.id} value={b.id}>
              {b.label}
            </option>
          ))}
        </select>
      </label>
      <label className="text-sm">
        Check-in
        <input type="date" name="check_in" className={fieldClass()} />
      </label>
      <label className="text-sm">
        Check-out
        <input type="date" name="check_out" className={fieldClass()} />
      </label>
      <label className="text-sm sm:col-span-2">
        Notes
        <input name="notes" className={fieldClass()} />
      </label>
      {state.error ? <p className="text-sm text-maroon sm:col-span-2">{state.error}</p> : null}
      <button
        type="submit"
        disabled={pending}
        className="inline-flex min-h-11 items-center justify-center rounded-sm bg-espresso px-4 text-sm text-ivory sm:col-span-2"
      >
        {pending ? "Saving…" : "Create group"}
      </button>
    </form>
  );
}

export function AddToGroupForm({
  groupId,
  bookings,
}: {
  groupId: string;
  bookings: { id: string; label: string }[];
}) {
  const [state, action, pending] = useActionState(addBookingToGroup, initial);
  return (
    <form action={action} className="mt-2 flex flex-wrap items-end gap-2">
      <input type="hidden" name="group_id" value={groupId} />
      <select name="booking_id" required className="min-h-10 flex-1 rounded-sm border border-espresso/15 px-2 text-sm">
        <option value="">Add booking…</option>
        {bookings.map((b) => (
          <option key={b.id} value={b.id}>
            {b.label}
          </option>
        ))}
      </select>
      <button type="submit" disabled={pending} className="min-h-10 border border-espresso/20 px-3 text-sm">
        Add
      </button>
      {state.error ? <span className="w-full text-xs text-maroon">{state.error}</span> : null}
    </form>
  );
}

export function AllotmentCreateForm({
  agents,
  roomTypes,
}: {
  agents: { id: string; company_name: string }[];
  roomTypes: { id: string; name: string }[];
}) {
  const [state, action, pending] = useActionState(createAgentAllotment, initial);
  return (
    <form action={action} className="grid gap-3 border border-espresso/10 bg-white p-4 sm:grid-cols-2">
      <label className="text-sm">
        Agent
        <select name="agent_id" required className={fieldClass()}>
          <option value="">Select…</option>
          {agents.map((a) => (
            <option key={a.id} value={a.id}>
              {a.company_name}
            </option>
          ))}
        </select>
      </label>
      <label className="text-sm">
        Room type
        <select name="room_type_id" required className={fieldClass()}>
          <option value="">Select…</option>
          {roomTypes.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
      </label>
      <label className="text-sm">
        Season
        <select name="season_kind" required className={fieldClass()}>
          <option value="peak">peak</option>
          <option value="lean">lean</option>
          <option value="off">off</option>
        </select>
      </label>
      <label className="text-sm">
        Rooms / week
        <input type="number" name="rooms_per_week" min={1} defaultValue={2} required className={fieldClass()} />
      </label>
      <label className="text-sm">
        From
        <input type="date" name="valid_from" required className={fieldClass()} />
      </label>
      <label className="text-sm">
        To
        <input type="date" name="valid_to" required className={fieldClass()} />
      </label>
      <label className="text-sm sm:col-span-2">
        Notes
        <input name="notes" className={fieldClass()} />
      </label>
      {state.error ? <p className="text-sm text-maroon sm:col-span-2">{state.error}</p> : null}
      <button
        type="submit"
        disabled={pending}
        className="inline-flex min-h-11 items-center justify-center rounded-sm bg-espresso px-4 text-sm text-ivory sm:col-span-2"
      >
        {pending ? "Saving…" : "Save allotment"}
      </button>
    </form>
  );
}
