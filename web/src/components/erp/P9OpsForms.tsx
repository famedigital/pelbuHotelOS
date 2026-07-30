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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useActionState } from "react";

const initial: OpsState = { ok: false };

const fieldClass =
  "mt-1 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]";
const selectInline =
  "rounded-md border border-input bg-transparent px-2 py-1 text-xs text-foreground outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]";

function Flash({ state }: { state: OpsState }) {
  if (!state.error && !state.message) return null;
  return (
    <p
      className={`erp text-sm sm:col-span-2 ${state.error ? "text-destructive" : "text-foreground"}`}
    >
      {state.error ?? state.message}
    </p>
  );
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
    <form action={action} className="erp grid gap-3 rounded-lg border bg-card p-4 sm:grid-cols-2">
      <div className="space-y-1">
        <Label className="text-sm">Room</Label>
        <select name="room_unit_id" required className={fieldClass}>
          <option value="">Select…</option>
          {units.map((u) => (
            <option key={u.id} value={u.id}>
              {u.label}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1">
        <Label className="text-sm">Staff</Label>
        <select name="staff_id" required className={fieldClass}>
          <option value="">Select…</option>
          {staff.map((s) => (
            <option key={s.id} value={s.id}>
              {s.full_name}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1">
        <Label className="text-sm" htmlFor="hk_date">Date</Label>
        <Input id="hk_date" type="date" name="business_date" defaultValue={today} required />
      </div>
      <div className="space-y-1 sm:col-span-2">
        <Label className="text-sm" htmlFor="hk_notes">Notes</Label>
        <Input id="hk_notes" name="notes" />
      </div>
      <Flash state={state} />
      <Button type="submit" disabled={pending} className="h-11 sm:col-span-2">
        {pending ? "Saving…" : "Assign room"}
      </Button>
    </form>
  );
}

export function HkStatusForm({ id, status }: { id: string; status: string }) {
  const [state, action, pending] = useActionState(updateHkAssignmentStatus, initial);
  return (
    <form action={action} className="erp flex items-center gap-2">
      <input type="hidden" name="id" value={id} />
      <select name="status" defaultValue={status} className={selectInline}>
        <option value="open">open</option>
        <option value="in_progress">in_progress</option>
        <option value="done">done</option>
        <option value="skipped">skipped</option>
      </select>
      <Button
        type="submit"
        disabled={pending}
        variant="link"
        size="sm"
        className="h-auto p-0 text-xs text-accent"
      >
        Update
      </Button>
      {state.error ? <span className="text-xs text-destructive">{state.error}</span> : null}
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
    <form action={action} className="erp grid gap-3 rounded-lg border bg-card p-4 sm:grid-cols-2">
      <div className="space-y-1 sm:col-span-2">
        <Label className="text-sm" htmlFor="maint_title">Title</Label>
        <Input id="maint_title" name="title" required placeholder="AC not cooling · 203" />
      </div>
      <div className="space-y-1 sm:col-span-2">
        <Label className="text-sm" htmlFor="maint_desc">Description</Label>
        <Textarea id="maint_desc" name="description" rows={2} className={fieldClass} />
      </div>
      <div className="space-y-1">
        <Label className="text-sm">Room (optional)</Label>
        <select name="room_unit_id" className={fieldClass}>
          <option value="">—</option>
          {units.map((u) => (
            <option key={u.id} value={u.id}>
              {u.label}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1">
        <Label className="text-sm">Priority</Label>
        <select name="priority" defaultValue="normal" className={fieldClass}>
          <option value="low">low</option>
          <option value="normal">normal</option>
          <option value="high">high</option>
          <option value="urgent">urgent</option>
        </select>
      </div>
      <div className="space-y-1 sm:col-span-2">
        <Label className="text-sm">Assign to</Label>
        <select name="assigned_staff_id" className={fieldClass}>
          <option value="">Unassigned</option>
          {staff.map((s) => (
            <option key={s.id} value={s.id}>
              {s.full_name}
            </option>
          ))}
        </select>
      </div>
      <Flash state={state} />
      <Button type="submit" disabled={pending} className="h-11 sm:col-span-2">
        {pending ? "Saving…" : "Create work order"}
      </Button>
    </form>
  );
}

export function MaintenanceStatusForm({ id, status }: { id: string; status: string }) {
  const [state, action, pending] = useActionState(updateMaintenanceStatus, initial);
  return (
    <form action={action} className="erp flex items-center gap-2">
      <input type="hidden" name="id" value={id} />
      <select name="status" defaultValue={status} className={selectInline}>
        <option value="open">open</option>
        <option value="in_progress">in_progress</option>
        <option value="done">done</option>
        <option value="cancelled">cancelled</option>
      </select>
      <Button
        type="submit"
        disabled={pending}
        variant="link"
        size="sm"
        className="h-auto p-0 text-xs text-accent"
      >
        Update
      </Button>
      {state.error ? <span className="text-xs text-destructive">{state.error}</span> : null}
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
    <form action={action} className="erp grid gap-3 rounded-lg border bg-card p-4 sm:grid-cols-2">
      <div className="space-y-1 sm:col-span-2">
        <Label className="text-sm" htmlFor="group_name">Group name</Label>
        <Input id="group_name" name="name" required placeholder="Jaigaon group · Apr" />
      </div>
      <div className="space-y-1">
        <Label className="text-sm">Agent</Label>
        <select name="agent_id" className={fieldClass}>
          <option value="">—</option>
          {agents.map((a) => (
            <option key={a.id} value={a.id}>
              {a.company_name}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1">
        <Label className="text-sm">Seed_booking</Label>
        <select name="booking_id" className={fieldClass}>
          <option value="">—</option>
          {bookings.map((b) => (
            <option key={b.id} value={b.id}>
              {b.label}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1">
        <Label className="text-sm" htmlFor="grp_check_in">Check-in</Label>
        <Input id="grp_check_in" type="date" name="check_in" />
      </div>
      <div className="space-y-1">
        <Label className="text-sm" htmlFor="grp_check_out">Check-out</Label>
        <Input id="grp_check_out" type="date" name="check_out" />
      </div>
      <div className="space-y-1 sm:col-span-2">
        <Label className="text-sm" htmlFor="grp_notes">Notes</Label>
        <Input id="grp_notes" name="notes" />
      </div>
      <Flash state={state} />
      <Button type="submit" disabled={pending} className="h-11 sm:col-span-2">
        {pending ? "Saving…" : "Create group"}
      </Button>
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
    <form action={action} className="erp mt-2 flex flex-wrap items-end gap-2">
      <input type="hidden" name="group_id" value={groupId} />
      <select
        name="booking_id"
        required
        className="h-10 min-w-[180px] flex-1 rounded-md border border-input bg-transparent px-2 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
      >
        <option value="">Add booking…</option>
        {bookings.map((b) => (
          <option key={b.id} value={b.id}>
            {b.label}
          </option>
        ))}
      </select>
      <Button type="submit" disabled={pending} variant="outline" className="h-10">
        Add
      </Button>
      {state.error ? <span className="w-full text-xs text-destructive">{state.error}</span> : null}
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
    <form action={action} className="erp grid gap-3 rounded-lg border bg-card p-4 sm:grid-cols-2">
      <div className="space-y-1">
        <Label className="text-sm">Agent</Label>
        <select name="agent_id" required className={fieldClass}>
          <option value="">Select…</option>
          {agents.map((a) => (
            <option key={a.id} value={a.id}>
              {a.company_name}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1">
        <Label className="text-sm">Room type</Label>
        <select name="room_type_id" required className={fieldClass}>
          <option value="">Select…</option>
          {roomTypes.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1">
        <Label className="text-sm">Season</Label>
        <select name="season_kind" required className={fieldClass}>
          <option value="peak">peak</option>
          <option value="lean">lean</option>
          <option value="off">off</option>
        </select>
      </div>
      <div className="space-y-1">
        <Label className="text-sm" htmlFor="rooms_per_week">Rooms / week</Label>
        <Input id="rooms_per_week" type="number" name="rooms_per_week" min={1} defaultValue={2} required />
      </div>
      <div className="space-y-1">
        <Label className="text-sm" htmlFor="valid_from">From</Label>
        <Input id="valid_from" type="date" name="valid_from" required />
      </div>
      <div className="space-y-1">
        <Label className="text-sm" htmlFor="valid_to">To</Label>
        <Input id="valid_to" type="date" name="valid_to" required />
      </div>
      <div className="space-y-1 sm:col-span-2">
        <Label className="text-sm" htmlFor="allot_notes">Notes</Label>
        <Input id="allot_notes" name="notes" />
      </div>
      <Flash state={state} />
      <Button type="submit" disabled={pending} className="h-11 sm:col-span-2">
        {pending ? "Saving…" : "Save allotment"}
      </Button>
    </form>
  );
}
