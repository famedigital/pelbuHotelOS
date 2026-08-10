"use client";

import {
  DeskBookForm,
  type DeskBookFormProps,
} from "@/components/erp/DeskBookForm";
import { useStayHubOptional } from "@/components/erp/StayHubProvider";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { DeskBookIntent } from "@/app/actions/fast-book";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { useState } from "react";

export type FastBookDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (bookingId: string) => void;
  roomTypes: DeskBookFormProps["roomTypes"];
  agents: DeskBookFormProps["agents"];
  staff?: DeskBookFormProps["staff"];
  defaultSoldByStaffId?: string;
  mealPlans?: DeskBookFormProps["mealPlans"];
  property?: DeskBookFormProps["property"];
  invoiceDesign?: DeskBookFormProps["invoiceDesign"];
  voucherDesign?: DeskBookFormProps["voucherDesign"];
  defaults?: DeskBookFormProps["defaults"];
  /** @deprecated Classic FastBook form removed — DeskBook is the only path. */
  classic?: boolean;
};

function stepForIntent(intent: DeskBookIntent) {
  if (intent === "check_in") return "check_in" as const;
  if (intent === "reserve") return "reserve" as const;
  return "confirm" as const;
}

/**
 * Desk book modal — StayHub-style left rail + dense form + confirmation pack.
 */
export function FastBookDialog({
  open,
  onOpenChange,
  onCreated,
  classic: _classic,
  ...formProps
}: FastBookDialogProps) {
  void _classic;
  const router = useRouter();
  const stayHub = useStayHubOptional();
  const [formKey, setFormKey] = useState(0);
  const [stage, setStage] = useState<"form" | "confirm">("form");

  const openStayHub = (
    bookingId: string,
    intent: DeskBookIntent = "confirm",
  ) => {
    onCreated?.(bookingId);
    if (stayHub) {
      stayHub.openStayHub({
        bookingId,
        step: stepForIntent(intent),
        board: intent === "check_in" ? "arrivals" : "reservations",
        agents: formProps.agents,
      });
    }
    onOpenChange(false);
    setFormKey((k) => k + 1);
    setStage("form");
    router.refresh();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) {
          setFormKey((k) => k + 1);
          setStage("form");
        }
      }}
    >
      <DialogContent
        showCloseButton
        className={cn(
          "erp flex flex-col gap-0 overflow-hidden p-0",
          "top-auto bottom-0 left-0 right-0 h-[100dvh] max-h-[100dvh] w-full max-w-none translate-x-0 translate-y-0 rounded-none border-0",
          "data-[state=open]:slide-in-from-bottom data-[state=closed]:slide-out-to-bottom",
          "md:top-[50%] md:bottom-auto md:left-[50%] md:right-auto md:h-[min(92dvh,820px)] md:max-h-[92dvh] md:w-[min(96vw,1040px)] md:max-w-[1040px] md:translate-x-[-50%] md:translate-y-[-50%] md:rounded-xl md:border",
          "lg:w-[min(95vw,1180px)] lg:max-w-[1180px] lg:h-[min(90dvh,860px)]",
          "pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]",
        )}
      >
        <DialogHeader className="shrink-0 space-y-0 border-b px-3 py-2 pr-11 text-left md:px-4 print:hidden">
          <DialogTitle className="text-base font-semibold tracking-tight md:text-lg">
            {stage === "confirm" ? "Booking confirmed" : "New booking"}
          </DialogTitle>
          <DialogDescription className="text-[11px] text-muted-foreground">
            {stage === "confirm"
              ? "Print note / voucher / reg card, then open stay."
              : "Price left · form right · package + inventory live · same-day opens check-in."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <DeskBookForm
            key={formKey}
            roomTypes={formProps.roomTypes}
            agents={formProps.agents}
            staff={formProps.staff}
            defaultSoldByStaffId={formProps.defaultSoldByStaffId}
            mealPlans={formProps.mealPlans}
            property={formProps.property}
            invoiceDesign={formProps.invoiceDesign}
            voucherDesign={formProps.voucherDesign}
            defaults={formProps.defaults}
            onSaved={() => {
              setStage("confirm");
              router.refresh();
            }}
            onOpenStay={openStayHub}
            onBookAnother={() => {
              setFormKey((k) => k + 1);
              setStage("form");
            }}
            onClose={() => {
              onOpenChange(false);
              setFormKey((k) => k + 1);
              setStage("form");
            }}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function DeskBookModal(props: FastBookDialogProps) {
  return <FastBookDialog {...props} />;
}

export type { DeskBookFormProps };
