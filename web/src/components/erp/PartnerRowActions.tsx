"use client";

import { useState } from "react";
import { CheckIcon, CopyIcon, MoreHorizontalIcon, SearchIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

export type PartnerRowActionsProps = {
  kind: "guide" | "driver";
  partnerId: string;
  /** Search token pushed into the desk inbox — phone, guide number, or name. */
  searchToken: string;
  phone: string | null;
};

/**
 * Per-row actions menu for guide/driver rows in the partners table.
 * - Copy phone → clipboard + toast
 * - View bookings → opens the desk inbox pre-filtered to this partner
 *
 * Kept as a client island so the partners table itself stays server-rendered.
 */
export function PartnerRowActions({
  kind,
  searchToken,
  phone,
}: PartnerRowActionsProps) {
  const [copied, setCopied] = useState(false);

  async function copyPhone() {
    if (!phone) {
      toast.error("No phone on file for this partner.");
      return;
    }
    try {
      await navigator.clipboard.writeText(phone);
      setCopied(true);
      toast.success("Phone copied");
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Couldn't copy — clipboard blocked.");
    }
  }

  const inboxHref = `/erp/check-in?q=${encodeURIComponent(searchToken)}`;
  const label = kind === "guide" ? "guide" : "driver";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="size-8"
          aria-label={`Actions for this ${label}`}
        >
          <MoreHorizontalIcon className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>{kind === "guide" ? "Guide" : "Driver"}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={(e) => {
            e.preventDefault();
            copyPhone();
          }}
          disabled={!phone}
        >
          {copied ? <CheckIcon /> : <CopyIcon />}
          Copy phone
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <a href={inboxHref}>
            <SearchIcon />
            View bookings
          </a>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
