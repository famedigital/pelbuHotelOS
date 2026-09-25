"use client";

import type { ShortcutBinding } from "@/hooks/use-keyboard-shortcuts";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const HOW_TO = [
  {
    title: "Start every sale — fast",
    steps: [
      "T / R / C keys (or cards): Table · Room · Counter.",
      "Continue as… uses your last path (one tap).",
      "Switch mid-sale with Table|Room|Counter on the context bar (cart kept).",
      "N = New ticket (clears cart). T while selling opens Tickets.",
    ],
  },
  {
    title: "Menus follow the floor — flexible when needed",
    steps: [
      "Cafe table → cafe dishes only; restaurant → restaurant.",
      "Need a mix? “Show all menus” unlocks, then “Lock to …” re-seals.",
      "Edit dishes anytime: Menu admin · outlet + prep station.",
      "Tables: floor tab → Add ··· Edit · grip icon to move (saves on drop).",
    ],
  },
  {
    title: "Counter (walk-in)",
    steps: [
      "Counter → tap dishes → Send ticket.",
      "Name defaults to Walk-in (editable in Details).",
      "Tickets → Settle when they pay (cash/card/etc.).",
    ],
  },
  {
    title: "Settle and print guest receipt",
    steps: [
      "Tickets → open ticket → Settle.",
      "Enter cash / card / bank / room / agent credit (must match total).",
      "After settle you open a PAID receipt — browser print for the guest copy.",
      "Re-print later: Tickets → Closed today → Print receipt.",
    ],
  },
  {
    title: "Table service",
    steps: [
      "Table → pick floor tab (Restaurant / Cafe / Bar…).",
      "Tap a free table on that floor (or Add table ··· Edit for setup).",
      "Menu opens locked to that floor — unlock if guest orders across floors.",
      "They order more later: Open tickets → Add items (or tap the occupied table). Send course 2 on the same bill.",
      "New clears for the next party. Settle from Tickets.",
    ],
  },
  {
    title: "Guest walks away (no order)",
    steps: [
      "Context bar → Release next to the table — clears the seat.",
      "Or tap the same table again on Floor.",
      "If a ticket was already sent: Open tickets → Void (table frees).",
      "Status stuck Occupied with no ticket: Floor ··· → Set status Free.",
    ],
  },
  {
    title: "Charge to room",
    steps: [
      "Room → pick in-house room (guest list optional in Details).",
      "Menu unlocks after room is selected.",
      "Send — amount posts to the guest folio.",
    ],
  },
  {
    title: "Group / tourist lunch",
    steps: [
      "Kitchen board → Events: date, time, covers, menu note.",
      "Optional: Publish meal service so FO/POS see heads + menu.",
      "Sell/settle on POS (or room charge) — events do not bill by themselves.",
    ],
  },
  {
    title: "Close POS shift",
    steps: [
      "Settle or void every open ticket first.",
      "More → Closing: count drawer cash (include opening float) + manager PIN.",
      "System: expected = float + cash sales; variance = counted − expected.",
      "Past Z-reports: Night audit → POS daily Z-reports.",
    ],
  },
];

export function PosHowToSheet({
  open,
  onOpenChange,
  bindings,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bindings: ShortcutBinding[];
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="erp max-h-[85dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>POS help</DialogTitle>
          <DialogDescription>
            How to sell, release tables, and close the drawer. Press{" "}
            <kbd className="rounded border bg-muted px-1 text-[11px]">?</kbd>{" "}
            anytime (ignored while typing).
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="how" className="mt-2 gap-3">
          <TabsList className="w-full">
            <TabsTrigger value="how" className="flex-1">
              How to
            </TabsTrigger>
            <TabsTrigger value="keys" className="flex-1">
              Shortcuts
            </TabsTrigger>
          </TabsList>

          <TabsContent value="how" className="space-y-4">
            {HOW_TO.map((block) => (
              <section key={block.title} className="rounded-lg border bg-card p-3">
                <h3 className="text-sm font-semibold text-foreground">
                  {block.title}
                </h3>
                <ol className="mt-2 list-decimal space-y-1 pl-4 text-sm text-muted-foreground">
                  {block.steps.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>
              </section>
            ))}
          </TabsContent>

          <TabsContent value="keys">
            <ul className="space-y-1.5">
              {bindings.map((b, i) => (
                <li
                  key={`${b.display}-${i}`}
                  className="flex items-center justify-between gap-3 rounded-md border bg-card px-3 py-2"
                >
                  <span className="text-sm text-foreground">{b.label}</span>
                  <kbd className="rounded border bg-muted px-1.5 py-0.5 text-[11px] font-medium">
                    {b.display}
                  </kbd>
                </li>
              ))}
            </ul>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
