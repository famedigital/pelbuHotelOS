"use client";

import { checkInDueThroughToday } from "@/app/actions/erp-due-checkin";
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
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

/**
 * Checks in every reservation still due through today.
 * Day-1 rent posts; identity documents stay deferred until the desk uploads them.
 */
export function CheckInDueButton({
  count,
  onDone,
}: {
  count: number;
  onDone?: () => void | Promise<void>;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pin, setPin] = useState("");
  const [pending, startTransition] = useTransition();

  if (count <= 0) return null;

  return (
    <>
      <Button
        type="button"
        variant="citrus"
        size="sm"
        className="h-9"
        onClick={() => setOpen(true)}
      >
        Check in all due ({count})
      </Button>
      <Dialog open={open} onOpenChange={(next) => !pending && setOpen(next)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Check in all due through today</DialogTitle>
            <DialogDescription>
              {count} reservation{count === 1 ? "" : "s"} with an arrival on or
              before today and a departure still ahead. Each one that already
              has a room is checked in. Day-1 room rent posts to the folio.
              Passport, CID, and SDF stay deferred so you can file them after.
              Reservations with no room number, and rooms that are not clean, are left on the list.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="due_check_in_pin">
              Manager PIN (past arrival or closed business date)
            </Label>
            <Input
              id="due_check_in_pin"
              type="password"
              autoComplete="off"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="GM / owner can leave this blank"
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="citrus"
              disabled={pending}
              onClick={() => {
                startTransition(async () => {
                  const result = await checkInDueThroughToday(pin);
                  if (result.checkedIn > 0) {
                    toast.success(result.message);
                  } else {
                    toast.error(result.message);
                  }
                  if (result.failed.length > 0 && result.checkedIn > 0) {
                    const sample = result.failed
                      .slice(0, 3)
                      .map((f) => `${f.name}: ${f.error}`)
                      .join(" · ");
                    toast.message(sample);
                  }
                  setOpen(false);
                  setPin("");
                  router.refresh();
                  await onDone?.();
                });
              }}
            >
              {pending ? "Checking in…" : "Check in all due"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
