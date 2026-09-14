"use client";

import {
  deleteDiningTable,
  saveDiningTable,
  type DiningTableState,
} from "@/app/actions/erp-pos";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useActionToast } from "@/hooks/use-action-toast";
import type { DiningTable } from "@/lib/pos";
import {
  TABLE_STATUS_LABELS,
  TABLE_STATUS_VALUES,
} from "@/lib/pos-tables";
import { TriangleAlertIcon } from "lucide-react";
import { useActionState, useEffect, useState } from "react";

const initial: DiningTableState = { ok: false };

/** `null` = closed. `{ mode: "create" }` or `{ mode: "edit", table }`. */
export type TableFormTarget =
  | { mode: "create" }
  | { mode: "edit"; table: DiningTable }
  | null;

const SHARED = "__shared__";

export function DiningTableForm({
  target,
  onOpenChange,
  defaultOutlet,
  outlets,
  existingNames,
}: {
  target: TableFormTarget;
  onOpenChange: (open: boolean) => void;
  /** Outlet code, or `__shared__` for shared-across-floors tables. */
  defaultOutlet: string;
  outlets: { value: string; label: string }[];
  existingNames: string[];
}) {
  const open = target !== null;
  const editing = target?.mode === "edit" ? target.table : null;

  const [saveState, saveAction, savePending] = useActionState(
    saveDiningTable,
    initial,
  );
  const [deleteState, deleteAction, deletePending] = useActionState(
    deleteDiningTable,
    initial,
  );

  useActionToast(saveState, { successMessage: "Table saved" });
  useActionToast(deleteState, { successMessage: "Table deleted" });

  const [name, setName] = useState("");
  const [area, setArea] = useState("main");
  const [outlet, setOutlet] = useState<string>(defaultOutlet);
  const [seats, setSeats] = useState("2");
  const [status, setStatus] = useState<string>("free");
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Seed the form whenever it opens for a different target.
  useEffect(() => {
    if (!open) return;
    setConfirmDelete(false);
    if (editing) {
      setName(editing.name);
      setArea(editing.area || "main");
      setOutlet(editing.outlet ?? SHARED);
      setSeats(String(editing.seats));
      setStatus(editing.status);
    } else {
      setName("");
      setArea("main");
      setOutlet(defaultOutlet);
      setSeats("2");
      setStatus("free");
    }
  }, [open, editing, defaultOutlet]);

  useEffect(() => {
    if (saveState.ok || deleteState.ok) onOpenChange(false);
  }, [saveState.ok, deleteState.ok, onOpenChange]);

  const trimmed = name.trim();
  const duplicate =
    trimmed.length > 0 &&
    existingNames.some(
      (n) =>
        n.toLowerCase() === trimmed.toLowerCase() &&
        n.toLowerCase() !== (editing?.name ?? "").toLowerCase(),
    );
  const seatsNum = Number(seats);
  const seatsValid = Number.isInteger(seatsNum) && seatsNum >= 1 && seatsNum <= 40;
  const canSave = trimmed.length > 0 && !duplicate && seatsValid;

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="erp sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit table" : "Add table"}</DialogTitle>
          <DialogDescription>
            {editing
              ? "Rename, move between floors, change seats, or delete."
              : "Tables belong to one floor (outlet). Cafe / restaurant / bar each get their own layout."}
          </DialogDescription>
        </DialogHeader>

        {saveState.error ? (
          <Alert variant="destructive">
            <TriangleAlertIcon />
            <AlertDescription>{saveState.error}</AlertDescription>
          </Alert>
        ) : null}
        {deleteState.error ? (
          <Alert variant="destructive">
            <TriangleAlertIcon />
            <AlertDescription>{deleteState.error}</AlertDescription>
          </Alert>
        ) : null}

        <form action={saveAction} className="space-y-4">
          <input type="hidden" name="table_id" value={editing?.id ?? ""} />
          <input
            type="hidden"
            name="outlet"
            value={outlet === SHARED ? "" : outlet}
          />
          <input type="hidden" name="status" value={status} />

          <div className="space-y-1.5">
            <Label htmlFor="dt_name">Table name</Label>
            <Input
              id="dt_name"
              name="name"
              required
              maxLength={24}
              autoComplete="off"
              placeholder="T1 / Window 2 / Patio A"
              value={name}
              onChange={(e) => setName(e.target.value)}
              aria-invalid={duplicate || undefined}
            />
            {duplicate ? (
              <p className="text-xs text-destructive">
                A table called “{trimmed}” already exists.
              </p>
            ) : null}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="dt_seats">Seats</Label>
              <Input
                id="dt_seats"
                name="seats"
                type="number"
                required
                min={1}
                max={40}
                inputMode="numeric"
                value={seats}
                onChange={(e) => setSeats(e.target.value)}
                aria-invalid={!seatsValid || undefined}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dt_area">Area</Label>
              <Input
                id="dt_area"
                name="area"
                maxLength={32}
                autoComplete="off"
                placeholder="main / patio / terrace"
                value={area}
                onChange={(e) => setArea(e.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="dt_outlet">Floor / outlet</Label>
              <Select value={outlet} onValueChange={setOutlet}>
                <SelectTrigger id="dt_outlet" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {outlets.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                  <SelectItem value={SHARED}>Shared (all floors)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dt_status">Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger id="dt_status" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TABLE_STATUS_VALUES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {TABLE_STATUS_LABELS[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:justify-between">
            {editing ? (
              <Button
                type="button"
                variant="outline"
                className="text-destructive hover:bg-destructive/5"
                disabled={savePending || deletePending}
                onClick={() => setConfirmDelete(true)}
              >
                Delete
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={savePending || deletePending}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="citrus"
                disabled={savePending || deletePending || !canSave}
              >
                {savePending ? "Saving…" : editing ? "Save table" : "Add table"}
              </Button>
            </div>
          </DialogFooter>
        </form>

        {confirmDelete && editing ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
            <p className="text-sm text-foreground">
              Delete “{editing.name}”? Tickets already settled against it keep
              their history.
            </p>
            <div className="mt-3 flex gap-2">
              <form action={deleteAction}>
                <input type="hidden" name="table_id" value={editing.id} />
                <Button
                  type="submit"
                  variant="outline"
                  size="sm"
                  className="text-destructive hover:bg-destructive/10"
                  disabled={deletePending}
                >
                  {deletePending ? "Deleting…" : "Yes, delete"}
                </Button>
              </form>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setConfirmDelete(false)}
                disabled={deletePending}
              >
                Keep table
              </Button>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
