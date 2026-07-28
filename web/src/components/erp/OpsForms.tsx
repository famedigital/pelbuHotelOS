"use client";

import {
  createInventoryItem,
  createStaffLeave,
  createStaffMember,
  createStaffShift,
  postInventoryMovement,
  updateRoomHkStatus,
  type ErpOpsState,
} from "@/app/actions/erp-ops";
import { formatBtn } from "@/lib/pricing";
import { useActionState } from "react";

const initial: ErpOpsState = { ok: false };

function fieldClass() {
  return "mt-1.5 w-full rounded-sm border border-espresso/15 bg-white px-3 py-2 text-sm text-espresso outline-none focus:border-gold focus:ring-2 focus:ring-gold/20";
}

function ActionFlash({ state }: { state: ErpOpsState }) {
  if (!state.ok && !state.error) return null;
  return (
    <p
      className={`mt-2 text-sm ${state.ok ? "text-espresso" : "text-maroon"}`}
      role="status"
    >
      {state.ok ? state.message : state.error}
    </p>
  );
}

export type StaffOption = { id: string; full_name: string; role_label: string };
export type InvOption = {
  id: string;
  sku: string;
  name: string;
  qty_on_hand: number;
  unit: string;
};

export function StaffMemberForm() {
  const [state, action, pending] = useActionState(createStaffMember, initial);
  return (
    <form action={action} className="space-y-3 border border-espresso/10 bg-white p-4">
      <h3 className="text-xs font-semibold tracking-[0.18em] text-gold uppercase">
        Add staff
      </h3>
      <label className="block text-xs text-espresso/70">
        Full name
        <input name="full_name" required className={fieldClass()} />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-xs text-espresso/70">
          Role
          <select name="role_label" defaultValue="front_desk" className={fieldClass()}>
            <option value="front_desk">Front desk</option>
            <option value="reservation">Reservation</option>
            <option value="fnb">F&amp;B</option>
            <option value="kitchen">Kitchen</option>
            <option value="housekeeping">Housekeeping</option>
            <option value="spa">Spa</option>
            <option value="security">Security</option>
            <option value="maintenance">Maintenance</option>
            <option value="manager">Manager</option>
            <option value="other">Other</option>
          </select>
        </label>
        <label className="block text-xs text-espresso/70">
          Hired on
          <input type="date" name="hired_on" className={fieldClass()} />
        </label>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-xs text-espresso/70">
          Phone
          <input name="phone" className={fieldClass()} />
        </label>
        <label className="block text-xs text-espresso/70">
          Email
          <input name="email" type="email" className={fieldClass()} />
        </label>
      </div>
      <button
        type="submit"
        disabled={pending}
        className="inline-flex min-h-10 items-center rounded-sm bg-gold px-4 text-sm font-medium text-espresso disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save staff"}
      </button>
      <ActionFlash state={state} />
    </form>
  );
}

export function StaffShiftForm({ staff }: { staff: StaffOption[] }) {
  const [state, action, pending] = useActionState(createStaffShift, initial);
  const today = new Date().toISOString().slice(0, 10);
  return (
    <form action={action} className="space-y-3 border border-espresso/10 bg-white p-4">
      <h3 className="text-xs font-semibold tracking-[0.18em] text-gold uppercase">
        Add shift
      </h3>
      <label className="block text-xs text-espresso/70">
        Staff
        <select name="staff_id" required defaultValue="" className={fieldClass()}>
          <option value="" disabled>
            Select…
          </option>
          {staff.map((s) => (
            <option key={s.id} value={s.id}>
              {s.full_name} · {s.role_label}
            </option>
          ))}
        </select>
      </label>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block text-xs text-espresso/70">
          Date
          <input type="date" name="shift_date" defaultValue={today} required className={fieldClass()} />
        </label>
        <label className="block text-xs text-espresso/70">
          Start
          <input type="time" name="starts_at" defaultValue="08:00" required className={fieldClass()} />
        </label>
        <label className="block text-xs text-espresso/70">
          End
          <input type="time" name="ends_at" defaultValue="16:00" required className={fieldClass()} />
        </label>
      </div>
      <label className="block text-xs text-espresso/70">
        Outlet
        <select name="outlet" defaultValue="front_desk" className={fieldClass()}>
          <option value="front_desk">Front desk</option>
          <option value="cafe">Cafe</option>
          <option value="pastry">Pastry</option>
          <option value="restaurant">Restaurant</option>
          <option value="bar">Bar</option>
          <option value="spa">Spa</option>
          <option value="housekeeping">Housekeeping</option>
          <option value="other">Other</option>
        </select>
      </label>
      <button
        type="submit"
        disabled={pending || staff.length === 0}
        className="inline-flex min-h-10 items-center rounded-sm bg-espresso px-4 text-sm font-medium text-ivory disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save shift"}
      </button>
      <ActionFlash state={state} />
    </form>
  );
}

export function StaffLeaveForm({ staff }: { staff: StaffOption[] }) {
  const [state, action, pending] = useActionState(createStaffLeave, initial);
  const today = new Date().toISOString().slice(0, 10);
  return (
    <form action={action} className="space-y-3 border border-espresso/10 bg-white p-4">
      <h3 className="text-xs font-semibold tracking-[0.18em] text-gold uppercase">
        Record leave
      </h3>
      <label className="block text-xs text-espresso/70">
        Staff
        <select name="staff_id" required defaultValue="" className={fieldClass()}>
          <option value="" disabled>
            Select…
          </option>
          {staff.map((s) => (
            <option key={s.id} value={s.id}>
              {s.full_name}
            </option>
          ))}
        </select>
      </label>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block text-xs text-espresso/70">
          Type
          <select name="leave_type" defaultValue="annual" className={fieldClass()}>
            <option value="annual">Annual</option>
            <option value="sick">Sick</option>
            <option value="unpaid">Unpaid</option>
            <option value="other">Other</option>
          </select>
        </label>
        <label className="block text-xs text-espresso/70">
          From
          <input type="date" name="starts_on" defaultValue={today} required className={fieldClass()} />
        </label>
        <label className="block text-xs text-espresso/70">
          To
          <input type="date" name="ends_on" defaultValue={today} required className={fieldClass()} />
        </label>
      </div>
      <button
        type="submit"
        disabled={pending || staff.length === 0}
        className="inline-flex min-h-10 items-center rounded-sm bg-gold px-4 text-sm font-medium text-espresso disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save leave"}
      </button>
      <ActionFlash state={state} />
    </form>
  );
}

export function InventoryItemForm() {
  const [state, action, pending] = useActionState(createInventoryItem, initial);
  return (
    <form action={action} className="space-y-3 border border-espresso/10 bg-white p-4">
      <h3 className="text-xs font-semibold tracking-[0.18em] text-gold uppercase">
        New stock item
      </h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-xs text-espresso/70">
          SKU
          <input name="sku" required className={fieldClass()} placeholder="DRY-RICE" />
        </label>
        <label className="block text-xs text-espresso/70">
          Name
          <input name="name" required className={fieldClass()} />
        </label>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block text-xs text-espresso/70">
          Category
          <select name="category" defaultValue="dry" className={fieldClass()}>
            <option value="produce">Produce</option>
            <option value="dairy">Dairy</option>
            <option value="meat">Meat</option>
            <option value="beverage">Beverage</option>
            <option value="dry">Dry</option>
            <option value="packaging">Packaging</option>
            <option value="amenity">Amenity</option>
            <option value="other">Other</option>
          </select>
        </label>
        <label className="block text-xs text-espresso/70">
          Unit
          <select name="unit" defaultValue="ea" className={fieldClass()}>
            <option value="ea">ea</option>
            <option value="kg">kg</option>
            <option value="g">g</option>
            <option value="l">l</option>
            <option value="ml">ml</option>
            <option value="case">case</option>
          </select>
        </label>
        <label className="block text-xs text-espresso/70">
          On hand
          <input name="qty_on_hand" type="number" step="0.001" min="0" defaultValue="0" className={fieldClass()} />
        </label>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-xs text-espresso/70">
          Reorder level
          <input name="reorder_level" type="number" step="0.001" min="0" defaultValue="0" className={fieldClass()} />
        </label>
        <label className="block text-xs text-espresso/70">
          Unit cost (Nu)
          <input name="unit_cost_btn" type="number" step="0.01" min="0" defaultValue="0" className={fieldClass()} />
        </label>
      </div>
      <button
        type="submit"
        disabled={pending}
        className="inline-flex min-h-10 items-center rounded-sm bg-gold px-4 text-sm font-medium text-espresso disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save item"}
      </button>
      <ActionFlash state={state} />
    </form>
  );
}

export function InventoryMoveForm({ items }: { items: InvOption[] }) {
  const [state, action, pending] = useActionState(postInventoryMovement, initial);
  return (
    <form action={action} className="space-y-3 border border-espresso/10 bg-white p-4">
      <h3 className="text-xs font-semibold tracking-[0.18em] text-gold uppercase">
        Stock movement
      </h3>
      <label className="block text-xs text-espresso/70">
        Item
        <select name="item_id" required defaultValue="" className={fieldClass()}>
          <option value="" disabled>
            Select…
          </option>
          {items.map((i) => (
            <option key={i.id} value={i.id}>
              {i.sku} · {i.name} ({i.qty_on_hand} {i.unit})
            </option>
          ))}
        </select>
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-xs text-espresso/70">
          Kind
          <select name="movement_kind" defaultValue="receive" className={fieldClass()}>
            <option value="receive">Receive (+)</option>
            <option value="issue">Issue (−)</option>
            <option value="waste">Waste (−)</option>
            <option value="adjust">Adjust (±)</option>
            <option value="count">Count (set on-hand)</option>
          </select>
        </label>
        <label className="block text-xs text-espresso/70">
          Qty
          <input name="qty_delta" type="number" step="0.001" required className={fieldClass()} />
        </label>
      </div>
      <label className="block text-xs text-espresso/70">
        Reference
        <input name="reference" className={fieldClass()} placeholder="PO / invoice #" />
      </label>
      <button
        type="submit"
        disabled={pending || items.length === 0}
        className="inline-flex min-h-10 items-center rounded-sm bg-espresso px-4 text-sm font-medium text-ivory disabled:opacity-60"
      >
        {pending ? "Posting…" : "Post movement"}
      </button>
      <ActionFlash state={state} />
    </form>
  );
}

export function RoomHkButtons({
  unitId,
  current,
}: {
  unitId: string;
  current: string;
}) {
  const statuses = ["clean", "dirty", "inspect", "occupied", "ooo"] as const;
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {statuses.map((status) => (
        <HkStatusButton
          key={status}
          unitId={unitId}
          status={status}
          active={current === status}
        />
      ))}
    </div>
  );
}

function HkStatusButton({
  unitId,
  status,
  active,
}: {
  unitId: string;
  status: string;
  active: boolean;
}) {
  const [state, action, pending] = useActionState(updateRoomHkStatus, initial);
  return (
    <form action={action}>
      <input type="hidden" name="room_unit_id" value={unitId} />
      <input type="hidden" name="hk_status" value={status} />
      <button
        type="submit"
        disabled={pending || active}
        className={`inline-flex min-h-9 items-center rounded-sm border px-2.5 text-[11px] transition-colors disabled:opacity-50 ${
          active
            ? "border-gold bg-gold/15 font-medium text-espresso"
            : "border-espresso/20 text-espresso hover:border-espresso/40"
        }`}
      >
        {status}
      </button>
      {state.error ? (
        <span className="sr-only" role="alert">
          {state.error}
        </span>
      ) : null}
    </form>
  );
}

export function StockValueHint({
  qty,
  unitCost,
}: {
  qty: number;
  unitCost: number;
}) {
  if (!unitCost) return null;
  return (
    <span className="text-xs text-muted"> · {formatBtn(qty * unitCost)}</span>
  );
}
