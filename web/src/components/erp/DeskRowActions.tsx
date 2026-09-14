"use client";

import Link from "next/link";
import { MoreHorizontalIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

/**
 * Typed row action for ERP tables and mobile cards.
 * Prefer `href` to existing routes/sheets — do not invent duplicate flows.
 */
export type DeskRowAction = {
  id: string;
  label: string;
  href?: string;
  onSelect?: () => void;
  icon?: React.ReactNode;
  destructive?: boolean;
  disabled?: boolean;
};

export type DeskRowActionsProps = {
  /** Context for aria-label, e.g. "Booking PS-1042" */
  label: string;
  actions: DeskRowAction[];
  /** Optional section title inside the menu */
  menuLabel?: string;
  className?: string;
};

/**
 * Shared hover / focus ⋯ actions for ERP data rows.
 *
 * Usage:
 * - Wrap table row or card in `group` for desktop hover reveal.
 * - On mobile cards, keep trigger visible (`opacity-100`).
 * - Map each action to an existing route or server handler — see plan §S.
 *
 * @example
 * ```tsx
 * <DeskRowActions
 *   label={`Booking ${ref}`}
 *   menuLabel="Booking"
 *   actions={[
 *     { id: "open", label: "Open dossier", href: `/erp/bookings/${id}`, icon: <FileIcon /> },
 *     { id: "checkin", label: "Check in", href: `/erp/check-in/${id}` },
 *   ]}
 * />
 * ```
 */
export function DeskRowActions({
  label,
  actions,
  menuLabel,
  className,
}: DeskRowActionsProps) {
  if (actions.length === 0) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "size-8 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 data-[state=open]:opacity-100",
            className,
          )}
          aria-label={`Actions for ${label}`}
        >
          <MoreHorizontalIcon className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {menuLabel ? (
          <>
            <DropdownMenuLabel>{menuLabel}</DropdownMenuLabel>
            <DropdownMenuSeparator />
          </>
        ) : null}
        {actions.map((action) => {
          if (action.href) {
            return (
              <DropdownMenuItem key={action.id} asChild disabled={action.disabled}>
                <Link
                  href={action.href}
                  className={cn(action.destructive && "text-destructive focus:text-destructive")}
                >
                  {action.icon}
                  {action.label}
                </Link>
              </DropdownMenuItem>
            );
          }
          return (
            <DropdownMenuItem
              key={action.id}
              disabled={action.disabled}
              variant={action.destructive ? "destructive" : "default"}
              onSelect={(event) => {
                if (action.onSelect) {
                  event.preventDefault();
                  action.onSelect();
                }
              }}
            >
              {action.icon}
              {action.label}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
