"use client";

import { Button } from "@/components/ui/button";
import { PrinterIcon } from "lucide-react";

export function AgentPrintButton({ label = "Print" }: { label?: string }) {
  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      className="h-8 print:hidden"
      onClick={() => window.print()}
    >
      <PrinterIcon className="size-3.5" />
      {label}
    </Button>
  );
}
