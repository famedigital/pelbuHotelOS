"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  DEFAULT_POS_PRINT_PREFS,
  readPosPrintPrefs,
  writePosPrintPrefs,
  type PosPrintPrefs,
  type PosPrinterMode,
  type PosReceiptPaper,
  type PosSettlePrint,
} from "@/lib/pos-print-prefs";
import { useEffect, useState } from "react";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/**
 * Register-local printer prefs (localStorage). Browser cannot name devices —
 * same vs separate only controls sequential print dialogs.
 */
export function PosPrinterSettings({ open, onOpenChange }: Props) {
  const [prefs, setPrefs] = useState<PosPrintPrefs>(DEFAULT_POS_PRINT_PREFS);

  useEffect(() => {
    if (open) setPrefs(readPosPrintPrefs());
  }, [open]);

  function patch(partial: Partial<PosPrintPrefs>) {
    setPrefs((prev) => {
      const next = { ...prev, ...partial };
      writePosPrintPrefs(next);
      return next;
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="erp sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Printers</DialogTitle>
          <DialogDescription>
            Choose when to print kitchen tickets and guest receipts. Chrome
            cannot pick a named printer — use Same or Separate so you get one
            or two print dialogs and pick the device in Windows.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          <fieldset className="space-y-2 rounded-md border p-3">
            <legend className="px-1 text-xs font-semibold tracking-wide uppercase text-muted-foreground">
              After settle
            </legend>
            <Label className="flex items-center gap-2 font-normal">
              <input
                type="radio"
                name="settlePrint"
                checked={prefs.settlePrint === "receipt"}
                onChange={() =>
                  patch({ settlePrint: "receipt" satisfies PosSettlePrint })
                }
              />
              Guest receipt only
            </Label>
            <Label className="flex items-center gap-2 font-normal">
              <input
                type="radio"
                name="settlePrint"
                checked={prefs.settlePrint === "kot_and_receipt"}
                onChange={() =>
                  patch({
                    settlePrint: "kot_and_receipt" satisfies PosSettlePrint,
                  })
                }
              />
              KOT then guest receipt
            </Label>
            <Label className="flex items-center gap-2 font-normal">
              <input
                type="radio"
                name="settlePrint"
                checked={prefs.settlePrint === "none"}
                onChange={() =>
                  patch({ settlePrint: "none" satisfies PosSettlePrint })
                }
              />
              No auto-print
            </Label>
            <Label className="mt-2 flex items-center gap-2 font-normal">
              <input
                type="checkbox"
                checked={prefs.receiptAutoPrint}
                onChange={(e) =>
                  patch({ receiptAutoPrint: e.target.checked })
                }
              />
              Open print dialog on receipt page
            </Label>
            <div className="flex gap-3 pt-1">
              <Label className="flex items-center gap-2 font-normal">
                <input
                  type="radio"
                  name="receiptPaper"
                  checked={prefs.receiptPaper === "thermal"}
                  onChange={() =>
                    patch({
                      receiptPaper: "thermal" satisfies PosReceiptPaper,
                    })
                  }
                />
                Receipt 80mm
              </Label>
              <Label className="flex items-center gap-2 font-normal">
                <input
                  type="radio"
                  name="receiptPaper"
                  checked={prefs.receiptPaper === "a4"}
                  onChange={() =>
                    patch({ receiptPaper: "a4" satisfies PosReceiptPaper })
                  }
                />
                Receipt A4
              </Label>
            </div>
          </fieldset>

          <fieldset className="space-y-2 rounded-md border p-3">
            <legend className="px-1 text-xs font-semibold tracking-wide uppercase text-muted-foreground">
              Kitchen (send / fire)
            </legend>
            <Label className="flex items-center gap-2 font-normal">
              <input
                type="checkbox"
                checked={prefs.kotPrintOnSend}
                onChange={(e) =>
                  patch({ kotPrintOnSend: e.target.checked })
                }
              />
              Print KOT when order is sent
            </Label>
            <div className="flex gap-3">
              <Label className="flex items-center gap-2 font-normal">
                <input
                  type="radio"
                  name="kotPaper"
                  checked={prefs.kotPaper === "thermal"}
                  onChange={() =>
                    patch({ kotPaper: "thermal" satisfies PosReceiptPaper })
                  }
                />
                KOT 80mm
              </Label>
              <Label className="flex items-center gap-2 font-normal">
                <input
                  type="radio"
                  name="kotPaper"
                  checked={prefs.kotPaper === "a4"}
                  onChange={() =>
                    patch({ kotPaper: "a4" satisfies PosReceiptPaper })
                  }
                />
                KOT A4
              </Label>
            </div>
          </fieldset>

          <fieldset className="space-y-2 rounded-md border p-3">
            <legend className="px-1 text-xs font-semibold tracking-wide uppercase text-muted-foreground">
              Same or separate printer
            </legend>
            <Label className="flex items-center gap-2 font-normal">
              <input
                type="radio"
                name="printerMode"
                checked={prefs.printerMode === "same"}
                onChange={() =>
                  patch({ printerMode: "same" satisfies PosPrinterMode })
                }
              />
              Same printer (KOT then receipt — pick one device twice)
            </Label>
            <Label className="flex items-center gap-2 font-normal">
              <input
                type="radio"
                name="printerMode"
                checked={prefs.printerMode === "separate"}
                onChange={() =>
                  patch({ printerMode: "separate" satisfies PosPrinterMode })
                }
              />
              Separate printers (two dialogs — pick KOT then receipt)
            </Label>
          </fieldset>

          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => onOpenChange(false)}
          >
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
