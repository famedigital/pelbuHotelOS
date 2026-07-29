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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useActionToast } from "@/hooks/use-action-toast";
import { formatBtn } from "@/lib/pricing";
import { useActionState } from "react";

const initial: ErpOpsState = { ok: false };

// Native <select> styled to match shadcn Input — Radix Select would force a
// controlled-value refactor across every form; the visual + a11y lift from
// this class is sufficient for now.
function selectClass() {
  return "mt-1.5 flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] cursor-pointer";
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
  useActionToast(state, { successMessage: "Staff member saved" });
  return (
    <form action={action} className="space-y-3 border border-espresso/10 bg-white p-4">
      <h3 className="text-xs font-semibold tracking-[0.18em] text-gold uppercase">
        Add staff
      </h3>
      <div className="space-y-1.5">
        <Label htmlFor="full_name" className="text-xs text-muted-foreground">
          Full name
        </Label>
        <Input id="full_name" name="full_name" required />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="role_label" className="text-xs text-muted-foreground">
            Role
          </Label>
          <select
            id="role_label"
            name="role_label"
            defaultValue="front_desk"
            className={selectClass()}
          >
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
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="hired_on" className="text-xs text-muted-foreground">
            Hired on
          </Label>
          <Input id="hired_on" type="date" name="hired_on" />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="phone" className="text-xs text-muted-foreground">
            Phone
          </Label>
          <Input id="phone" name="phone" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="email" className="text-xs text-muted-foreground">
            Email
          </Label>
          <Input id="email" name="email" type="email" />
        </div>
      </div>
      <Button type="submit" variant="gold" disabled={pending} className="min-h-10">
        {pending ? "Saving…" : "Save staff"}
      </Button>
      <ActionFlash state={state} />
    </form>
  );
}

export function StaffShiftForm({ staff }: { staff: StaffOption[] }) {
  const [state, action, pending] = useActionState(createStaffShift, initial);
  useActionToast(state, { successMessage: "Shift saved" });
  const today = new Date().toISOString().slice(0, 10);
  return (
    <form action={action} className="space-y-3 border border-espresso/10 bg-white p-4">
      <h3 className="text-xs font-semibold tracking-[0.18em] text-gold uppercase">
        Add shift
      </h3>
      <div className="space-y-1.5">
        <Label htmlFor="staff_id" className="text-xs text-muted-foreground">
          Staff
        </Label>
        <select
          id="staff_id"
          name="staff_id"
          required
          defaultValue=""
          className={selectClass()}
        >
          <option value="" disabled>
            Select…
          </option>
          {staff.map((s) => (
            <option key={s.id} value={s.id}>
              {s.full_name} · {s.role_label}
            </option>
          ))}
        </select>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="shift_date" className="text-xs text-muted-foreground">
            Date
          </Label>
          <Input
            id="shift_date"
            type="date"
            name="shift_date"
            defaultValue={today}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="starts_at" className="text-xs text-muted-foreground">
            Start
          </Label>
          <Input
            id="starts_at"
            type="time"
            name="starts_at"
            defaultValue="08:00"
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ends_at" className="text-xs text-muted-foreground">
            End
          </Label>
          <Input
            id="ends_at"
            type="time"
            name="ends_at"
            defaultValue="16:00"
            required
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="outlet" className="text-xs text-muted-foreground">
          Outlet
        </Label>
        <select
          id="outlet"
          name="outlet"
          defaultValue="front_desk"
          className={selectClass()}
        >
          <option value="front_desk">Front desk</option>
          <option value="cafe">Cafe</option>
          <option value="pastry">Pastry</option>
          <option value="restaurant">Restaurant</option>
          <option value="bar">Bar</option>
          <option value="spa">Spa</option>
          <option value="housekeeping">Housekeeping</option>
          <option value="other">Other</option>
        </select>
      </div>
      <Button
        type="submit"
        disabled={pending || staff.length === 0}
        className="min-h-10 bg-espresso text-ivory hover:bg-espresso/90"
      >
        {pending ? "Saving…" : "Save shift"}
      </Button>
      <ActionFlash state={state} />
    </form>
  );
}

export function StaffLeaveForm({ staff }: { staff: StaffOption[] }) {
  const [state, action, pending] = useActionState(createStaffLeave, initial);
  useActionToast(state, { successMessage: "Leave saved" });
  const today = new Date().toISOString().slice(0, 10);
  return (
    <form action={action} className="space-y-3 border border-espresso/10 bg-white p-4">
      <h3 className="text-xs font-semibold tracking-[0.18em] text-gold uppercase">
        Record leave
      </h3>
      <div className="space-y-1.5">
        <Label htmlFor="leave_staff_id" className="text-xs text-muted-foreground">
          Staff
        </Label>
        <select
          id="leave_staff_id"
          name="staff_id"
          required
          defaultValue=""
          className={selectClass()}
        >
          <option value="" disabled>
            Select…
          </option>
          {staff.map((s) => (
            <option key={s.id} value={s.id}>
              {s.full_name}
            </option>
          ))}
        </select>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="leave_type" className="text-xs text-muted-foreground">
            Type
          </Label>
          <select
            id="leave_type"
            name="leave_type"
            defaultValue="annual"
            className={selectClass()}
          >
            <option value="annual">Annual</option>
            <option value="sick">Sick</option>
            <option value="unpaid">Unpaid</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="starts_on" className="text-xs text-muted-foreground">
            From
          </Label>
          <Input
            id="starts_on"
            type="date"
            name="starts_on"
            defaultValue={today}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ends_on" className="text-xs text-muted-foreground">
            To
          </Label>
          <Input
            id="ends_on"
            type="date"
            name="ends_on"
            defaultValue={today}
            required
          />
        </div>
      </div>
      <Button
        type="submit"
        variant="gold"
        disabled={pending || staff.length === 0}
        className="min-h-10"
      >
        {pending ? "Saving…" : "Save leave"}
      </Button>
      <ActionFlash state={state} />
    </form>
  );
}

export function InventoryItemForm() {
  const [state, action, pending] = useActionState(createInventoryItem, initial);
  useActionToast(state, { successMessage: "Stock item saved" });
  return (
    <form action={action} className="space-y-3 border border-espresso/10 bg-white p-4">
      <h3 className="text-xs font-semibold tracking-[0.18em] text-gold uppercase">
        New stock item
      </h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="sku" className="text-xs text-muted-foreground">
            SKU
          </Label>
          <Input id="sku" name="sku" required placeholder="DRY-RICE" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="inv_name" className="text-xs text-muted-foreground">
            Name
          </Label>
          <Input id="inv_name" name="name" required />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="category" className="text-xs text-muted-foreground">
            Category
          </Label>
          <select
            id="category"
            name="category"
            defaultValue="dry"
            className={selectClass()}
          >
            <option value="produce">Produce</option>
            <option value="dairy">Dairy</option>
            <option value="meat">Meat</option>
            <option value="beverage">Beverage</option>
            <option value="dry">Dry</option>
            <option value="packaging">Packaging</option>
            <option value="amenity">Amenity</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="unit" className="text-xs text-muted-foreground">
            Unit
          </Label>
          <select id="unit" name="unit" defaultValue="ea" className={selectClass()}>
            <option value="ea">ea</option>
            <option value="kg">kg</option>
            <option value="g">g</option>
            <option value="l">l</option>
            <option value="ml">ml</option>
            <option value="case">case</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="qty_on_hand" className="text-xs text-muted-foreground">
            On hand
          </Label>
          <Input
            id="qty_on_hand"
            name="qty_on_hand"
            type="number"
            step="0.001"
            min="0"
            defaultValue="0"
          />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="reorder_level" className="text-xs text-muted-foreground">
            Reorder level
          </Label>
          <Input
            id="reorder_level"
            name="reorder_level"
            type="number"
            step="0.001"
            min="0"
            defaultValue="0"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="unit_cost_btn" className="text-xs text-muted-foreground">
            Unit cost (Nu)
          </Label>
          <Input
            id="unit_cost_btn"
            name="unit_cost_btn"
            type="number"
            step="0.01"
            min="0"
            defaultValue="0"
          />
        </div>
      </div>
      <Button type="submit" variant="gold" disabled={pending} className="min-h-10">
        {pending ? "Saving…" : "Save item"}
      </Button>
      <ActionFlash state={state} />
    </form>
  );
}

export function InventoryMoveForm({ items }: { items: InvOption[] }) {
  const [state, action, pending] = useActionState(postInventoryMovement, initial);
  useActionToast(state, { successMessage: "Movement posted" });
  return (
    <form action={action} className="space-y-3 border border-espresso/10 bg-white p-4">
      <h3 className="text-xs font-semibold tracking-[0.18em] text-gold uppercase">
        Stock movement
      </h3>
      <div className="space-y-1.5">
        <Label htmlFor="item_id" className="text-xs text-muted-foreground">
          Item
        </Label>
        <select
          id="item_id"
          name="item_id"
          required
          defaultValue=""
          className={selectClass()}
        >
          <option value="" disabled>
            Select…
          </option>
          {items.map((i) => (
            <option key={i.id} value={i.id}>
              {i.sku} · {i.name} ({i.qty_on_hand} {i.unit})
            </option>
          ))}
        </select>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="movement_kind" className="text-xs text-muted-foreground">
            Kind
          </Label>
          <select
            id="movement_kind"
            name="movement_kind"
            defaultValue="receive"
            className={selectClass()}
          >
            <option value="receive">Receive (+)</option>
            <option value="issue">Issue (−)</option>
            <option value="waste">Waste (−)</option>
            <option value="adjust">Adjust (±)</option>
            <option value="count">Count (set on-hand)</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="qty_delta" className="text-xs text-muted-foreground">
            Qty
          </Label>
          <Input
            id="qty_delta"
            name="qty_delta"
            type="number"
            step="0.001"
            required
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="move_reference" className="text-xs text-muted-foreground">
          Reference
        </Label>
        <Input
          id="move_reference"
          name="reference"
          placeholder="PO / invoice #"
        />
      </div>
      <Button
        type="submit"
        disabled={pending || items.length === 0}
        className="min-h-10 bg-espresso text-ivory hover:bg-espresso/90"
      >
        {pending ? "Posting…" : "Post movement"}
      </Button>
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
      <Button
        type="submit"
        size="sm"
        variant={active ? "gold" : "outline"}
        disabled={pending || active}
        className="min-h-9 px-2.5 text-[11px]"
      >
        {status}
      </Button>
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
    <span className="text-xs text-muted-foreground"> · {formatBtn(qty * unitCost)}</span>
  );
}
