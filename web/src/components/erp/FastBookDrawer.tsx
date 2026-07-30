"use client";

import { useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { useMediaQuery } from "@/hooks/use-media-query";
import type { FastBookAgent } from "./FastBookForm";

type Props = {
  agents: FastBookAgent[];
  pending: boolean;
  open: boolean;
  onClose: () => void;
  hasQty: boolean;
};

function DrawerBody({
  agents,
  pending,
  hasQty,
  agentId,
  setAgentId,
}: {
  agents: FastBookAgent[];
  pending: boolean;
  hasQty: boolean;
  agentId: string;
  setAgentId: (v: string) => void;
}) {
  const agentOptions = agents.map((a) => ({
    value: a.id,
    label: a.company_name,
    hint: [a.market, a.status === "demo" ? "demo" : null]
      .filter(Boolean)
      .join(" · "),
  }));

  return (
    <div className="space-y-6 px-5 py-5 md:px-6 md:py-6">
      {!hasQty ? (
        <Alert variant="warning">
          <AlertDescription>
            Pick a room above to enable saving.
          </AlertDescription>
        </Alert>
      ) : null}

      <fieldset className="space-y-3" disabled={pending}>
        <legend className="text-[11px] font-semibold tracking-[0.2em] text-accent uppercase">
          Guest contact
        </legend>
        <div className="space-y-1.5">
          <Label htmlFor="contact_name">Guest / lead name</Label>
          <Input
            id="contact_name"
            type="text"
            name="contact_name"
            required
            autoComplete="off"
          />
        </div>
        <div className="grid grid-cols-1 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="contact_phone">Phone</Label>
            <Input
              id="contact_phone"
              type="tel"
              name="contact_phone"
              required
              inputMode="tel"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="contact_email">Email</Label>
            <Input
              id="contact_email"
              type="email"
              name="contact_email"
              inputMode="email"
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="notes">Notes</Label>
          <Textarea id="notes" name="notes" rows={2} />
        </div>
      </fieldset>

      <fieldset className="space-y-3" disabled={pending}>
        <legend className="text-[11px] font-semibold tracking-[0.2em] text-accent uppercase">
          Booked by
        </legend>
        <div className="grid grid-cols-1 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="source">Role</Label>
            <Select name="source" defaultValue="reservation" required>
              <SelectTrigger id="source">
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="owner">Owner</SelectItem>
                <SelectItem value="reservation">Reservation</SelectItem>
                <SelectItem value="agent">Agent</SelectItem>
                <SelectItem value="mou_agent">MoU agent</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="guest_origin">Guest origin</Label>
            <Select name="guest_origin" defaultValue="international" required>
              <SelectTrigger id="guest_origin">
                <SelectValue placeholder="Select origin" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="international">
                  International tourist
                </SelectItem>
                <SelectItem value="regional">Regional (Indian / etc.)</SelectItem>
                <SelectItem value="official">Official / diplomatic</SelectItem>
                <SelectItem value="local">Local (Bhutanese)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground">
              Drives whether a guide is required.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label>Agent</Label>
            <input type="hidden" name="agent_id" value={agentId} />
            <Combobox
              options={agentOptions}
              value={agentId || null}
              onValueChange={setAgentId}
              placeholder="— Walk-in / none —"
              searchPlaceholder="Search agents…"
              emptyText="No agent matches."
              className="bg-background"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="guide_number">Guide number</Label>
            <Input
              id="guide_number"
              type="text"
              name="guide_number"
              placeholder="Required for international tourists"
            />
            <p className="text-[11px] text-muted-foreground">
              Required for international tourists only.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="payment_mode">Payment</Label>
            <Select name="payment_mode" defaultValue="cash">
              <SelectTrigger id="payment_mode">
                <SelectValue placeholder="Select payment" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="prepaid">Prepaid</SelectItem>
                <SelectItem value="partial">Partial</SelectItem>
                <SelectItem value="on_credit">On credit</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </fieldset>

      <Button
        type="submit"
        variant="citrus"
        disabled={pending || !hasQty}
        className="h-11 w-full"
      >
        {pending ? "Saving…" : "Save booking"}
      </Button>
    </div>
  );
}

export function FastBookDrawer({
  agents,
  pending,
  open,
  onClose,
  hasQty,
}: Props) {
  // Agent picker is a type-to-search Combobox; we mirror its value into a
  // hidden input so the parent <form> submission contract is unchanged.
  const [agentId, setAgentId] = useState<string>("");

  // Switch between the desktop rail (static column in the form grid) and the
  // mobile bottom Sheet based on viewport. Only one body is rendered at a
  // time, so form fields are never duplicated in the DOM.
  const isDesktop = useMediaQuery("(min-width: 768px)");

  if (isDesktop) {
    return (
      <aside
        aria-label="Booking details"
        className="erp md:w-[360px] md:flex-shrink-0 md:self-start md:rounded-lg md:border md:bg-card"
      >
        <DrawerBody
          agents={agents}
          pending={pending}
          hasQty={hasQty}
          agentId={agentId}
          setAgentId={setAgentId}
        />
      </aside>
    );
  }

  return (
    <Sheet open={open} onOpenChange={(next) => !next && onClose()}>
      {/* portal={false} keeps the fieldset inside the parent <form> so the
          named inputs still submit. Sheet is bottom-anchored on mobile only. */}
      <SheetContent
        side="bottom"
        portal={false}
        className="erp max-h-[85vh] overflow-y-auto p-0 md:hidden"
      >
        <SheetHeader className="border-b">
          <SheetTitle className="text-[11px] font-semibold tracking-[0.2em] text-accent uppercase">
            Booking details
          </SheetTitle>
        </SheetHeader>
        <DrawerBody
          agents={agents}
          pending={pending}
          hasQty={hasQty}
          agentId={agentId}
          setAgentId={setAgentId}
        />
      </SheetContent>
    </Sheet>
  );
}
