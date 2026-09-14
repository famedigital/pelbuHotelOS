"use client";

import { updateBookingNotes } from "@/app/actions/erp-reservations-party";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

export function RackStayNotesDialog({
  open,
  bookingId,
  guestLabel,
  initialNotes,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  bookingId: string | null;
  guestLabel: string;
  initialNotes: string | null;
  onOpenChange: (open: boolean) => void;
  onSaved?: (notes: string | null) => void;
}) {
  const [value, setValue] = useState(initialNotes ?? "");
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (open) setValue(initialNotes ?? "");
  }, [open, initialNotes, bookingId]);

  const save = () => {
    if (!bookingId) return;
    startTransition(async () => {
      const result = await updateBookingNotes(bookingId, value);
      if (result.ok) {
        toast.success(result.message ?? "Notes saved");
        onSaved?.(value.trim() || null);
        onOpenChange(false);
      } else {
        toast.error(result.error ?? "Could not save notes");
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="erp max-w-md">
        <DialogHeader>
          <DialogTitle>Notes · {guestLabel}</DialogTitle>
        </DialogHeader>
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          rows={5}
          maxLength={2000}
          placeholder="FO notes for this stay…"
          className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
        />
        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="citrus"
            disabled={pending || !bookingId}
            onClick={save}
          >
            {pending ? "Saving…" : "Save notes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
