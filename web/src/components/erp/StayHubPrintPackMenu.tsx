"use client";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDownIcon } from "lucide-react";
import Link from "next/link";

/**
 * Stay print pack (eZee Folio Print tree lite) — wires existing Pelbu docs.
 */
export function StayHubPrintPackMenu({
  bookingId,
  folioId,
  agentId,
  confirmationCode,
  compact = false,
}: {
  bookingId: string;
  folioId?: string | null;
  agentId?: string | null;
  confirmationCode?: string | null;
  compact?: boolean;
}) {
  const folioHref = folioId
    ? `/erp/folios/${folioId}`
    : `/erp/folios?q=${encodeURIComponent(confirmationCode || bookingId)}`;
  const settlementHref = `/erp/bookings/${bookingId}/settlement-pack`;
  const bookingHref = `/erp/bookings/${bookingId}`;
  const receiptHref = folioId ? `/erp/folios/${folioId}/receipt` : null;
  const statementHref = folioId
    ? `/erp/folios/${folioId}/statement`
    : agentId
      ? `/erp/agents/${agentId}/statement`
      : null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className={
            compact
              ? "h-8 shrink-0 gap-1 px-2.5 text-xs"
              : "h-9 shrink-0 gap-1.5 px-3 text-xs"
          }
        >
          Print pack
          <ChevronDownIcon className="size-3.5 opacity-60" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="text-[10px] uppercase tracking-wide text-muted-foreground">
          Stay documents
        </DropdownMenuLabel>
        <DropdownMenuItem asChild>
          <Link href={bookingHref}>Stay dossier / voucher</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href={folioHref}>Folio · bill</Link>
        </DropdownMenuItem>
        {receiptHref ? (
          <DropdownMenuItem asChild>
            <Link href={receiptHref}>Folio · receipt</Link>
          </DropdownMenuItem>
        ) : null}
        {statementHref ? (
          <DropdownMenuItem asChild>
            <Link href={statementHref}>Master / group statement</Link>
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href={settlementHref}>Settlement pack</Link>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => {
            // Open StayHub already has reg flow post-CI; deep-link book dossier notes.
            window.open(bookingHref, "_blank", "noopener,noreferrer");
          }}
        >
          Registration (from dossier)
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href={`/erp/calendar?q=${encodeURIComponent(bookingId)}`}>
            Find on room rack
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
