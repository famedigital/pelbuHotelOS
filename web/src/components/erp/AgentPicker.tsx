"use client";

import {
  createDeskAgent,
  type CreateDeskAgentState,
} from "@/app/actions/erp-agents";
import { Combobox } from "@/components/ui/combobox";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { PlusIcon } from "lucide-react";
import { useActionState, useEffect, useMemo, useRef, useState } from "react";

export type BookableAgent = {
  id: string;
  company_name: string;
  market: string;
  status: string;
  /** Sheet mapping: agents | mou_agents | … */
  rate_tier?: string | null;
  /** Soft CI room control (default 15). */
  open_room_cap?: number | null;
  /** Contract commission % (display at book; AR posting separate). */
  commission_pct?: number | null;
  /** Agent AR outstanding (Nu) — reminder only, not a hard gate. */
  credit_used?: number | null;
  /** Optional soft Nu ceiling (advisory). */
  credit_limit?: number | null;
};

const createInitial: CreateDeskAgentState = { ok: false };

const fieldSelectClass =
  "border-input flex h-10 w-full min-w-0 rounded-md border bg-transparent px-3 text-base shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 md:h-9 md:text-sm";

function Field({
  label,
  htmlFor,
  children,
  hint,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={htmlFor} className="text-sm font-medium text-foreground">
        {label}
      </Label>
      {children}
      {hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

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
  const isMobile = useIsMobile();
  const [state, action, pending] = useActionState(createDeskAgent, createInitial);
  const [wantsMou, setWantsMou] = useState(false);
  const handledId = useRef<string | null>(null);

  useEffect(() => {
    if (!open) {
      setWantsMou(false);
    }
  }, [open]);

  useEffect(() => {
    if (!state.ok || !state.agent) return;
    if (handledId.current === state.agent.id) return;
    handledId.current = state.agent.id;
    onCreated(state.agent);
    onOpenChange(false);
  }, [state, onCreated, onOpenChange]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={isMobile ? "bottom" : "right"}
        className={cn(
          "erp gap-0 p-0",
          isMobile
            ? "flex h-[min(92dvh,40rem)] w-full flex-col rounded-t-2xl border-t sm:max-w-none"
            : "inset-y-0 flex h-full w-full max-w-[100vw] flex-col border-l sm:max-w-md",
        )}
      >
        <SheetHeader className="shrink-0 space-y-1.5 border-b px-5 py-5 pr-12 text-left">
          <SheetTitle className="text-lg tracking-tight">Add agent</SheetTitle>
          <SheetDescription className="text-pretty text-sm leading-relaxed">
            Creates an approved trade partner you can attach to this booking
            immediately.
          </SheetDescription>
        </SheetHeader>

        <form action={action} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-5 py-5">
            {state.error ? (
              <p
                className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
                role="alert"
              >
                {state.error}
              </p>
            ) : null}

            <Field label="Company name" htmlFor="desk_agent_company">
              <Input
                id="desk_agent_company"
                name="company_name"
                required
                defaultValue={seedCompanyName}
                key={seedCompanyName || "empty"}
                autoComplete="organization"
                placeholder="Agency / operator name"
                className="h-10 md:h-9"
              />
            </Field>

            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Market" htmlFor="desk_agent_market">
                <select
                  id="desk_agent_market"
                  name="market"
                  required
                  defaultValue="bhutan"
                  className={fieldSelectClass}
                >
                  <option value="bhutan">Bhutan</option>
                  <option value="jaigaon">Jaigaon</option>
                  <option value="india">India</option>
                </select>
              </Field>

              <Field label="Status" htmlFor="desk_agent_status">
                <select
                  id="desk_agent_status"
                  name="status"
                  defaultValue="approved"
                  className={fieldSelectClass}
                >
                  <option value="approved">Approved</option>
                  <option value="demo">Demo</option>
                </select>
              </Field>
            </div>

            <Field label="Contact name" htmlFor="desk_agent_contact">
              <Input
                id="desk_agent_contact"
                name="contact_name"
                required
                autoComplete="name"
                placeholder="Primary contact"
                className="h-10 md:h-9"
              />
            </Field>

            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Phone" htmlFor="desk_agent_phone">
                <Input
                  id="desk_agent_phone"
                  name="contact_phone"
                  type="tel"
                  required
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="+975…"
                  className="h-10 md:h-9"
                />
              </Field>

              <Field label="Email" htmlFor="desk_agent_email" hint="Optional">
                <Input
                  id="desk_agent_email"
                  name="contact_email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  placeholder="ops@…"
                  className="h-10 md:h-9"
                />
              </Field>
            </div>

            <Field label="Notes" htmlFor="desk_agent_notes" hint="Optional">
              <Textarea
                id="desk_agent_notes"
                name="notes"
                rows={3}
                placeholder="MoU terms, preferred rooms, billing notes…"
                className="min-h-[4.5rem] resize-y"
              />
            </Field>

            <label className="flex items-start gap-3 rounded-md border border-border/80 bg-muted/30 px-3 py-3 text-sm">
              <Checkbox
                checked={wantsMou}
                onCheckedChange={(v) => setWantsMou(v === true)}
                className="mt-0.5"
              />
              <input
                type="hidden"
                name="wants_mou"
                value={wantsMou ? "on" : ""}
              />
              <span>
                <span className="font-medium text-foreground">MoU interest</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  Flag for allotment / contract follow-up.
                </span>
              </span>
            </label>
          </div>

          <SheetFooter className="mt-0 shrink-0 flex-col gap-2 border-t bg-background px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:flex-row sm:justify-stretch">
            <Button
              type="submit"
              variant="citrus"
              disabled={pending}
              className="h-11 w-full sm:order-2 sm:flex-1"
            >
              {pending ? "Saving…" : "Create & select"}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              className="h-11 w-full sm:order-1 sm:w-auto sm:min-w-[6.5rem]"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
          </SheetFooter>
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
  /** When true, directory / non-credit agents are labelled as needing promote. */
  creditMode = false,
}: {
  agents: BookableAgent[];
  value: string;
  onValueChange: (value: string) => void;
  name?: string;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  creditMode?: boolean;
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
    const list = Array.from(byId.values()).sort((a, b) =>
      a.company_name.localeCompare(b.company_name),
    );
    if (!creditMode) return list;
    // Credit-eligible first when booking on credit.
    return list.sort((a, b) => {
      const ac = a.status === "approved" || a.status === "demo" ? 0 : 1;
      const bc = b.status === "approved" || b.status === "demo" ? 0 : 1;
      if (ac !== bc) return ac - bc;
      return a.company_name.localeCompare(b.company_name);
    });
  }, [agents, extras, creditMode]);

  const options = merged.map((a) => {
    const isCreditOk =
      a.status === "approved" || a.status === "demo";
    const creditHint = creditMode
      ? isCreditOk
        ? "credit OK"
        : a.status === "directory"
          ? "TCB · needs Enable credit"
          : "needs Enable credit"
      : null;
    return {
      value: a.id,
      label: a.company_name,
      hint: [
        a.market,
        a.status === "demo"
          ? "demo"
          : a.status === "directory"
            ? "TCB directory"
            : a.status === "approved"
              ? "trade partner"
              : a.status,
        creditHint,
      ]
        .filter(Boolean)
        .join(" · "),
    };
  });

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
