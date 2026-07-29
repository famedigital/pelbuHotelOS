"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useMediaQuery } from "@/hooks/use-media-query";
import type { FastBookAgent } from "./FastBookForm";

type Props = {
  agents: FastBookAgent[];
  pending: boolean;
  open: boolean;
  onClose: () => void;
  hasQty: boolean;
};

function fieldClassName() {
  return "mt-1.5 w-full rounded-sm border border-espresso/15 bg-white px-3 py-2.5 text-sm text-espresso outline-none transition-colors focus:border-gold focus:ring-2 focus:ring-gold/20";
}

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
        <p className="border border-gold/40 bg-gold/5 px-3 py-2 text-xs text-espresso">
          Pick a room above to enable saving.
        </p>
      ) : null}

      <fieldset className="space-y-3" disabled={pending}>
        <legend className="text-xs font-semibold tracking-[0.22em] text-gold uppercase">
          Guest contact
        </legend>
        <label className="block text-sm text-espresso">
          Guest / lead name
          <input
            type="text"
            name="contact_name"
            required
            autoComplete="off"
            className={fieldClassName()}
          />
        </label>
        <div className="grid grid-cols-1 gap-3">
          <label className="block text-sm text-espresso">
            Phone
            <input
              type="tel"
              name="contact_phone"
              required
              inputMode="tel"
              className={fieldClassName()}
            />
          </label>
          <label className="block text-sm text-espresso">
            Email
            <input
              type="email"
              name="contact_email"
              inputMode="email"
              className={fieldClassName()}
            />
          </label>
        </div>
        <label className="block text-sm text-espresso">
          Notes
          <textarea name="notes" rows={2} className={fieldClassName()} />
        </label>
      </fieldset>

      <fieldset className="space-y-3" disabled={pending}>
        <legend className="text-xs font-semibold tracking-[0.22em] text-gold uppercase">
          Booked by
        </legend>
        <div className="grid grid-cols-1 gap-3">
          <label className="block text-sm text-espresso">
            Role
            <select
              name="source"
              required
              defaultValue="reservation"
              className={fieldClassName()}
            >
              <option value="owner">Owner</option>
              <option value="reservation">Reservation</option>
              <option value="agent">Agent</option>
              <option value="mou_agent">MoU agent</option>
            </select>
          </label>
          <label className="block text-sm text-espresso">
            Guest origin
            <select
              name="guest_origin"
              required
              defaultValue="international"
              className={fieldClassName()}
            >
              <option value="international">International tourist</option>
              <option value="regional">Regional (Indian / etc.)</option>
              <option value="official">Official / diplomatic</option>
              <option value="local">Local (Bhutanese)</option>
            </select>
            <span className="mt-1 block text-[11px] text-muted-foreground">
              Drives whether a guide is required.
            </span>
          </label>
          <div className="block text-sm text-espresso">
            <span className="mb-1.5 block font-medium">Agent</span>
            <input type="hidden" name="agent_id" value={agentId} />
            <Combobox
              options={agentOptions}
              value={agentId || null}
              onValueChange={setAgentId}
              placeholder="— Walk-in / none —"
              searchPlaceholder="Search agents…"
              emptyText="No agent matches."
              className="bg-white"
            />
          </div>
          <label className="block text-sm text-espresso">
            Guide number
            <input
              type="text"
              name="guide_number"
              placeholder="Required for international tourists"
              className={fieldClassName()}
            />
            <span className="mt-1 block text-[11px] text-muted-foreground">
              Required for international tourists only.
            </span>
          </label>
          <label className="block text-sm text-espresso">
            Payment
            <select name="payment_mode" defaultValue="cash" className={fieldClassName()}>
              <option value="cash">Cash</option>
              <option value="prepaid">Prepaid</option>
              <option value="partial">Partial</option>
              <option value="on_credit">On credit</option>
            </select>
          </label>
        </div>
      </fieldset>

      <Button
        type="submit"
        disabled={pending || !hasQty}
        className="min-h-11 w-full bg-espresso text-ivory hover:bg-espresso/90"
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
        className="md:w-[360px] md:flex-shrink-0 md:self-start md:rounded-sm md:border md:border-espresso/10 md:bg-white"
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
        className="md:hidden max-h-[85vh] overflow-y-auto p-0"
      >
        <SheetHeader className="border-b border-espresso/10">
          <SheetTitle className="text-xs font-semibold tracking-[0.22em] text-gold uppercase">
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
