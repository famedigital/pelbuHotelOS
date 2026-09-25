"use client";

import type { ReactNode } from "react";
import { PosFullscreenToggle } from "@/components/erp/pos/PosFullscreenToggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import {
  BoxesIcon,
  CircleHelpIcon,
  ConciergeBellIcon,
  ListOrderedIcon,
  LockKeyholeIcon,
  MoreHorizontalIcon,
  PrinterIcon,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { PosPrinterSettings } from "./PosPrinterSettings";
import type { PosSection } from "./types";

function segmentClass(active: boolean) {
  return cn(
    "inline-flex h-7 shrink-0 items-center rounded-[5px] px-2.5 text-xs font-medium whitespace-nowrap transition-colors",
    active
      ? "bg-accent text-accent-foreground shadow-sm"
      : "text-muted-foreground hover:bg-background/80 hover:text-foreground",
  );
}

type Props = {
  section: PosSection;
  onSection: (s: PosSection) => void;
  tableCount: number;
  openTicketsCount: number;
  onOpenTickets: () => void;
  shiftOpen: boolean;
  closingOpenCount: number;
  onOpenHelp: () => void;
  cssFullscreen: boolean;
  onCssFullscreenChange: (v: boolean) => void;
  /** False while the Table / Room / Counter gate is showing. */
  saleActive?: boolean;
  /** Optional Syncing chip from ticket SWR / live patch. */
  syncChip?: ReactNode;
};

/**
 * Register chrome for the **first desk header row**: Sell | Floor + Tickets / More.
 * Portals into DeskShell slots when normal layout; falls back in-page under
 * POS fullscreen (desk header is hidden by `body.pos-fs`).
 */
export function PosRegisterHeaderChrome(props: Props) {
  const [mounted, setMounted] = useState(false);
  const [modesSlot, setModesSlot] = useState<Element | null>(null);
  const [actionsSlot, setActionsSlot] = useState<Element | null>(null);

  useEffect(() => {
    setMounted(true);
    setModesSlot(document.querySelector('[data-slot="erp-header-pos-modes"]'));
    setActionsSlot(
      document.querySelector('[data-slot="erp-header-pos-actions"]'),
    );
  }, []);

  const modes = <RegisterModes {...props} />;
  const actions = <RegisterActions {...props} />;

  // Avoid a pre-hydration flash of an in-page second toolbar.
  if (!mounted) return null;

  const canPortal =
    !props.cssFullscreen && modesSlot != null && actionsSlot != null;

  if (canPortal) {
    return (
      <>
        {createPortal(modes, modesSlot)}
        {createPortal(actions, actionsSlot)}
      </>
    );
  }

  // Fullscreen or missing shell slots (e.g. unexpected layout).
  return (
    <div className="flex flex-wrap items-center gap-2">
      {modes}
      <div className="ml-auto flex flex-wrap items-center gap-1.5">{actions}</div>
    </div>
  );
}

function RegisterModes({
  section,
  onSection,
  tableCount,
  saleActive = true,
}: Pick<Props, "section" | "onSection" | "tableCount" | "saleActive">) {
  return (
    <nav
      aria-label="Register surface"
      className="flex min-w-0 items-center gap-0.5 overflow-x-auto rounded-md border bg-muted/40 p-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      <button
        type="button"
        onClick={() => onSection("menu")}
        className={segmentClass(
          section === "menu" || (!saleActive && section !== "floor"),
        )}
        aria-current={section === "menu" ? "page" : undefined}
      >
        {saleActive ? "Sell" : "Start"}
      </button>
      <button
        type="button"
        onClick={() => onSection("floor")}
        className={segmentClass(section === "floor")}
        aria-current={section === "floor" ? "page" : undefined}
      >
        Floor
        {tableCount > 0 ? (
          <span className="ml-1 text-[10px] tabular-nums opacity-80">
            {tableCount}
          </span>
        ) : null}
      </button>
    </nav>
  );
}

function RegisterActions({
  section,
  onSection,
  openTicketsCount,
  onOpenTickets,
  shiftOpen,
  closingOpenCount,
  onOpenHelp,
  cssFullscreen,
  onCssFullscreenChange,
  syncChip,
}: Props) {
  const [printerOpen, setPrinterOpen] = useState(false);

  return (
    <>
      {syncChip}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-8 gap-1.5 px-2.5"
        onClick={onOpenTickets}
      >
        <ListOrderedIcon className="size-3.5" />
        <span className="hidden sm:inline">Tickets</span>
        {openTicketsCount > 0 ? (
          <Badge variant="secondary" className="h-5 px-1.5 tabular-nums">
            {openTicketsCount}
          </Badge>
        ) : null}
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 px-2.5"
          >
            <MoreHorizontalIcon className="size-3.5" />
            <span className="hidden sm:inline">More</span>
            {shiftOpen ? (
              <span className="size-2 rounded-full bg-emerald-500" />
            ) : null}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="erp w-52">
          <DropdownMenuLabel>Register ops</DropdownMenuLabel>
          <DropdownMenuGroup>
            <DropdownMenuItem
              onSelect={() => onSection("stock")}
              className={section === "stock" ? "bg-accent/10" : undefined}
            >
              <BoxesIcon className="size-4" />
              Stock
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => onSection("closing")}
              className={section === "closing" ? "bg-accent/10" : undefined}
            >
              <LockKeyholeIcon className="size-4" />
              Closing
              {closingOpenCount > 0 ? (
                <Badge
                  variant="destructive"
                  className="ml-auto tabular-nums"
                >
                  {closingOpenCount}
                </Badge>
              ) : shiftOpen ? (
                <span className="ml-auto size-2 rounded-full bg-emerald-500" />
              ) : null}
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => onSection("service")}
              className={section === "service" ? "bg-accent/10" : undefined}
            >
              <ConciergeBellIcon className="size-4" />
              Guest service
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setPrinterOpen(true)}>
              <PrinterIcon className="size-4" />
              Printers
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuLabel>Kitchen &amp; setup</DropdownMenuLabel>
          <DropdownMenuGroup>
            <DropdownMenuItem asChild>
              <Link href="/erp/kitchen">Kitchen board</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/erp/kds">Kitchen TV</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/erp/menu">Menu</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/erp/kitchen/day-pack">Day pack</Link>
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuLabel>Costing</DropdownMenuLabel>
          <DropdownMenuGroup>
            <DropdownMenuItem asChild>
              <Link href="/erp/kitchen/food-cost">Food cost</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/erp/pos/recipe-cost">Recipe cost</Link>
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-8 px-2"
        onClick={onOpenHelp}
        aria-label="How to sell and shortcuts"
        title="How to sell (?)"
      >
        <CircleHelpIcon className="size-3.5" />
      </Button>
      <PosFullscreenToggle
        active={cssFullscreen}
        onChange={onCssFullscreenChange}
      />
      <PosPrinterSettings open={printerOpen} onOpenChange={setPrinterOpen} />
    </>
  );
}
