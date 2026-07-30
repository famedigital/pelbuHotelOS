"use client";

import { Button } from "@/components/ui/button";
import { PrinterIcon } from "lucide-react";

export function LaundryQrPrintButton() {
  return (
    <Button type="button" variant="citrus" onClick={() => window.print()}>
      <PrinterIcon className="size-4" />
      Print QR cards
    </Button>
  );
}
