"use client";

import { Button } from "@/components/ui/button";
import Link from "next/link";

/** Sticky chrome for menu print pages — hidden when printing. */
export function MenuPrintToolbar({
  title,
  meta,
  backHref = "/erp/menu/print",
  autoPrint = false,
}: {
  title: string;
  meta?: string;
  backHref?: string;
  autoPrint?: boolean;
}) {
  return (
    <div className="menu-print-toolbar fixed inset-x-0 top-0 z-50 flex flex-wrap items-center justify-between gap-3 border-b border-border bg-background/95 px-4 py-3 print:hidden">
      <div className="min-w-0">
        <p className="text-sm font-semibold">{title}</p>
        {meta ? (
          <p className="text-xs text-muted-foreground">{meta}</p>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" size="sm" asChild>
          <Link href={backHref}>Templates</Link>
        </Button>
        <Button type="button" variant="outline" size="sm" asChild>
          <Link href="/erp/menu">Catalog</Link>
        </Button>
        <Button
          type="button"
          variant="citrus"
          size="sm"
          onClick={() => window.print()}
        >
          {autoPrint ? "Print again" : "Print / PDF"}
        </Button>
      </div>
    </div>
  );
}
