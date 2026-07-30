"use client";

import {
  archivePropertyOutlet,
  createPropertyOutlet,
  restorePropertyOutlet,
  type OutletAdminState,
} from "@/app/actions/erp-menu";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
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
import { useActionToast } from "@/hooks/use-action-toast";
import type { PropertyOutlet } from "@/lib/outlets";
import {
  ArchiveIcon,
  PlusIcon,
  RotateCcwIcon,
  Settings2Icon,
  TriangleAlertIcon,
} from "lucide-react";
import { useActionState, useMemo, useState } from "react";

const initial: OutletAdminState = { ok: false };

export function MenuOutletManager({
  outlets,
}: {
  outlets: PropertyOutlet[];
}) {
  const [open, setOpen] = useState(false);

  const [createState, createAction, createPending] = useActionState(
    createPropertyOutlet,
    initial,
  );
  const [archiveState, archiveAction, archivePending] = useActionState(
    archivePropertyOutlet,
    initial,
  );
  const [restoreState, restoreAction, restorePending] = useActionState(
    restorePropertyOutlet,
    initial,
  );

  useActionToast(createState, { successMessage: "Outlet added" });
  useActionToast(archiveState, { successMessage: "Outlet archived" });
  useActionToast(restoreState, { successMessage: "Outlet restored" });

  const { active, archived } = useMemo(() => {
    const activeList: PropertyOutlet[] = [];
    const archivedList: PropertyOutlet[] = [];
    for (const o of outlets) {
      if (o.is_active) activeList.push(o);
      else archivedList.push(o);
    }
    return { active: activeList, archived: archivedList };
  }, [outlets]);

  const pending = createPending || archivePending || restorePending;
  const error =
    createState.error || archiveState.error || restoreState.error || null;
  const createFormKey = `${createState.ok}-${createState.outletId ?? "new"}`;

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-9"
        onClick={() => setOpen(true)}
      >
        <Settings2Icon className="size-4" />
        Outlets
        {archived.length > 0 ? (
          <Badge variant="secondary" className="ml-1 text-[10px]">
            {archived.length} archived
          </Badge>
        ) : null}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="erp max-h-[92vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Manage outlets</DialogTitle>
            <DialogDescription>
              Add Cafe, Rooftop, or any F&amp;B counter. Archive hides it from
              Menu and POS without deleting history or dishes.
            </DialogDescription>
          </DialogHeader>

          {error ? (
            <Alert variant="destructive">
              <TriangleAlertIcon />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          <form
            key={createFormKey}
            action={createAction}
            className="space-y-3 rounded-lg border p-3"
          >
            <p className="text-sm font-medium text-foreground">Add outlet</p>
            <div className="space-y-1.5">
              <Label htmlFor="outlet_name">Name</Label>
              <Input
                id="outlet_name"
                name="name"
                required
                maxLength={40}
                autoComplete="off"
                placeholder="e.g. Rooftop, Spa cafe"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="outlet_code">
                Code{" "}
                <span className="font-normal text-muted-foreground">
                  (optional)
                </span>
              </Label>
              <Input
                id="outlet_code"
                name="code"
                maxLength={32}
                autoComplete="off"
                placeholder="auto from name"
                className="lowercase"
              />
              <p className="text-[10px] text-muted-foreground">
                Lowercase letters, numbers, underscores. Used on tickets and
                reports.
              </p>
            </div>
            <Button
              type="submit"
              variant="citrus"
              size="sm"
              className="h-9"
              disabled={pending}
            >
              <PlusIcon className="size-4" />
              {createPending ? "Adding…" : "Add outlet"}
            </Button>
          </form>

          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Active ({active.length})
            </p>
            {active.length === 0 ? (
              <p className="text-sm text-muted-foreground">No active outlets.</p>
            ) : (
              <ul className="divide-y rounded-lg border">
                {active.map((outlet) => (
                  <li
                    key={outlet.id}
                    className="flex items-center justify-between gap-2 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">
                        {outlet.name}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {outlet.code}
                      </p>
                    </div>
                    <form action={archiveAction}>
                      <input type="hidden" name="outlet_id" value={outlet.id} />
                      <Button
                        type="submit"
                        variant="ghost"
                        size="sm"
                        className="h-8 text-muted-foreground"
                        disabled={pending || active.length <= 1}
                        title={
                          active.length <= 1
                            ? "Keep at least one active outlet"
                            : "Archive outlet"
                        }
                      >
                        <ArchiveIcon className="size-3.5" />
                        Archive
                      </Button>
                    </form>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {archived.length > 0 ? (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Archived ({archived.length})
              </p>
              <ul className="divide-y rounded-lg border border-dashed">
                {archived.map((outlet) => (
                  <li
                    key={outlet.id}
                    className="flex items-center justify-between gap-2 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-muted-foreground">
                        {outlet.name}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {outlet.code}
                      </p>
                    </div>
                    <form action={restoreAction}>
                      <input type="hidden" name="outlet_id" value={outlet.id} />
                      <Button
                        type="submit"
                        variant="outline"
                        size="sm"
                        className="h-8"
                        disabled={pending}
                      >
                        <RotateCcwIcon className="size-3.5" />
                        Restore
                      </Button>
                    </form>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={pending}
            >
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
