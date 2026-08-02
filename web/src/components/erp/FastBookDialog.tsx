"use client";

import {
  FastBookForm,
  type FastBookFormProps,
} from "@/components/erp/FastBookForm";
import { useStayHubOptional } from "@/components/erp/StayHubProvider";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { useState } from "react";

export type FastBookDialogProps = Omit<
  FastBookFormProps,
  "onCreated" | "embedded"
> & {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called after create, before StayHub opens (optional extras like refresh). */
  onCreated?: (bookingId: string) => void;
};

/**
 * Full-sheet (phone) / large dialog (desktop) Fast Book create.
 * On success: closes, opens StayHub at Reserve — same path as calendar create.
 */
export function FastBookDialog({
  open,
  onOpenChange,
  onCreated,
  ...formProps
}: FastBookDialogProps) {
  const router = useRouter();
  const stayHub = useStayHubOptional();
  const [formKey, setFormKey] = useState(0);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) setFormKey((k) => k + 1);
      }}
    >
      <DialogContent
        showCloseButton
        className={cn(
          "erp flex flex-col gap-0 overflow-hidden p-0",
          // Phone: full viewport sheet (match StayHub)
          "top-auto bottom-0 left-0 right-0 h-[100dvh] max-h-[100dvh] w-full max-w-none translate-x-0 translate-y-0 rounded-none border-0",
          "data-[state=open]:slide-in-from-bottom data-[state=closed]:slide-out-to-bottom",
          // Tablet+
          "md:top-[50%] md:bottom-auto md:left-[50%] md:right-auto md:h-auto md:max-h-[90vh] md:w-full md:max-w-3xl md:translate-x-[-50%] md:translate-y-[-50%] md:rounded-lg md:border",
          "lg:max-w-4xl",
          "pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]",
        )}
      >
        <DialogHeader className="shrink-0 space-y-1 border-b bg-gradient-to-b from-muted/40 to-background px-4 py-3 pr-12 text-left md:px-5 md:py-4">
          <DialogTitle className="text-lg tracking-tight md:text-xl">
            New reservation
          </DialogTitle>
          <DialogDescription className="text-sm">
            Walk-in or phone book — pick dates and rooms, then StayHub opens
            at Reserve to confirm and progress the stay.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 md:px-5">
          <FastBookForm
            key={formKey}
            {...formProps}
            embedded
            onCreated={(bookingId) => {
              // Parent may suppress dropping URL (StayHub write owns ?booking=)
              onCreated?.(bookingId);
              if (stayHub) {
                stayHub.openStayHub({
                  bookingId,
                  step: "reserve",
                  board: "reservations",
                  agents: formProps.agents,
                });
              }
              onOpenChange(false);
              setFormKey((k) => k + 1);
              router.refresh();
            }}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
