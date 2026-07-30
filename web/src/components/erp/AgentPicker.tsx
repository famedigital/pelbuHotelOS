"use client";

import {
  createDeskAgent,
  type CreateDeskAgentState,
} from "@/app/actions/erp-agents";
import { Combobox } from "@/components/ui/combobox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { PlusIcon } from "lucide-react";
import { useActionState, useEffect, useMemo, useRef, useState } from "react";

export type BookableAgent = {
  id: string;
  company_name: string;
  market: string;
  status: string;
};

const createInitial: CreateDeskAgentState = { ok: false };

function AddAgentButton({
  onClick,
  className,
}: {
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        className ??
        "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm font-medium text-accent hover:bg-accent/10"
      }
    >
      <PlusIcon className="size-4 shrink-0" aria-hidden />
      Add agent
    </button>
  );
}

function CreateDeskAgentSheet({
  open,
  onOpenChange,
  seedCompanyName,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  seedCompanyName: string;
  onCreated: (agent: BookableAgent) => void;
}) {
  const [state, action, pending] = useActionState(createDeskAgent, createInitial);
  const handledId = useRef<string | null>(null);

  useEffect(() => {
    if (!state.ok || !state.agent) return;
    if (handledId.current === state.agent.id) return;
    handledId.current = state.agent.id;
    onCreated(state.agent);
    onOpenChange(false);
  }, [state, onCreated, onOpenChange]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="erp w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Add agent</SheetTitle>
          <SheetDescription>
            Creates an approved trade partner you can attach to this booking
            immediately.
          </SheetDescription>
        </SheetHeader>

        <form action={action} className="mt-6 space-y-4">
          {state.error ? (
            <p className="text-sm text-destructive" role="alert">
              {state.error}
            </p>
          ) : null}

          <div className="space-y-1.5">
            <Label htmlFor="desk_agent_company">Company name</Label>
            <Input
              id="desk_agent_company"
              name="company_name"
              required
              defaultValue={seedCompanyName}
              key={seedCompanyName}
              autoComplete="organization"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="desk_agent_market">Market</Label>
            <select
              id="desk_agent_market"
              name="market"
              required
              defaultValue="bhutan"
              className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              <option value="bhutan">Bhutan</option>
              <option value="jaigaon">Jaigaon</option>
              <option value="india">India</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="desk_agent_contact">Contact name</Label>
            <Input
              id="desk_agent_contact"
              name="contact_name"
              required
              autoComplete="name"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="desk_agent_phone">Phone</Label>
            <Input
              id="desk_agent_phone"
              name="contact_phone"
              type="tel"
              required
              inputMode="tel"
              autoComplete="tel"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="desk_agent_email">Email</Label>
            <Input
              id="desk_agent_email"
              name="contact_email"
              type="email"
              inputMode="email"
              autoComplete="email"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="desk_agent_status">Status</Label>
            <select
              id="desk_agent_status"
              name="status"
              defaultValue="approved"
              className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              <option value="approved">Approved</option>
              <option value="demo">Demo</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="desk_agent_notes">Notes</Label>
            <Input id="desk_agent_notes" name="notes" />
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="wants_mou" value="on" className="size-4" />
            MoU interest
          </label>

          <div className="flex gap-2 pt-2">
            <Button type="submit" variant="citrus" disabled={pending} className="flex-1">
              {pending ? "Saving…" : "Create & select"}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}

/**
 * Searchable agent picker for Fast Book / Calendar. Walk-in clearable.
 * Add agent is pinned at the top of the open list and repeated on empty search.
 */
export function AgentPicker({
  agents,
  value,
  onValueChange,
  name,
  disabled,
  placeholder = "— Walk-in / none —",
  className,
}: {
  agents: BookableAgent[];
  value: string;
  onValueChange: (value: string) => void;
  name?: string;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}) {
  const [extras, setExtras] = useState<BookableAgent[]>([]);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [seedCompany, setSeedCompany] = useState("");
  const [query, setQuery] = useState("");

  const merged = useMemo(() => {
    const byId = new Map<string, BookableAgent>();
    for (const a of agents) byId.set(a.id, a);
    for (const a of extras) {
      if (!byId.has(a.id)) byId.set(a.id, a);
    }
    return Array.from(byId.values()).sort((a, b) =>
      a.company_name.localeCompare(b.company_name),
    );
  }, [agents, extras]);

  const options = merged.map((a) => ({
    value: a.id,
    label: a.company_name,
    hint: [a.market, a.status === "demo" ? "demo" : null]
      .filter(Boolean)
      .join(" · "),
  }));

  const openCreate = (seed?: string) => {
    setSeedCompany((seed ?? query).trim());
    setSheetOpen(true);
  };

  return (
    <>
      {name ? <input type="hidden" name={name} value={value} /> : null}
      <Combobox
        options={options}
        value={value || null}
        onValueChange={onValueChange}
        placeholder={placeholder}
        searchPlaceholder="Search agents…"
        allowClear
        clearLabel="— Walk-in / none —"
        disabled={disabled}
        className={className}
        onQueryChange={setQuery}
        headerContent={({ close }) => (
          <AddAgentButton
            onClick={() => {
              close();
              openCreate();
            }}
          />
        )}
        emptyContent={({ query: q, close }) => (
          <div className="space-y-2 px-2 py-3 text-center">
            <p className="text-sm text-muted-foreground">No agent matches.</p>
            <AddAgentButton
              className="inline-flex items-center justify-center gap-2 rounded-md border border-accent/30 bg-accent/5 px-3 py-2 text-sm font-medium text-accent hover:bg-accent/10"
              onClick={() => {
                close();
                openCreate(q);
              }}
            />
          </div>
        )}
      />
      <CreateDeskAgentSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        seedCompanyName={seedCompany}
        onCreated={(agent) => {
          setExtras((prev) => [...prev, agent]);
          onValueChange(agent.id);
        }}
      />
    </>
  );
}
