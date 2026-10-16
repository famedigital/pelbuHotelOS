"use client";

import { Button } from "@/components/ui/button";

/** Guest-facing print / Save as PDF (browser print dialog). */
export function GuestReceiptActions() {
  return (
    <div className="flex flex-wrap gap-2 print:hidden">
      <Button
        type="button"
        variant="default"
        className="h-10"
        onClick={() => window.print()}
      >
        Print
      </Button>
      <Button
        type="button"
        variant="outline"
        className="h-10"
        onClick={() => window.print()}
      >
        Save PDF
      </Button>
      <p className="basis-full text-xs text-muted-foreground">
        Save PDF: choose “Save as PDF” / “Microsoft Print to PDF” in the print
        dialog.
      </p>
    </div>
  );
}
