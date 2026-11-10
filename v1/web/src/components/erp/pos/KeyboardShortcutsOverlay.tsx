"use client";

import type { ShortcutBinding } from "@/hooks/use-keyboard-shortcuts";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * Help overlay for keyboard shortcuts. Opens on `?`. Renders the canonical
 * binding list passed in from the host component so the overlay always matches
 * what's actually registered.
 */
export function KeyboardShortcutsOverlay({
  open,
  onOpenChange,
  bindings,
  title = "Keyboard shortcuts",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bindings: ShortcutBinding[];
  title?: string;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="erp sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Press <kbd className="kbd">?</kbd> anywhere to open this. Shortcuts
            are ignored while you&rsquo;re typing in a field.
          </DialogDescription>
        </DialogHeader>
        <ul className="mt-2 space-y-1.5">
          {bindings.map((b, i) => (
            <li
              key={`${b.display}-${i}`}
              className="flex items-center justify-between gap-3 rounded-md border bg-card px-3 py-2"
            >
              <span className="text-sm text-foreground">{b.label}</span>
              <kbd className="kbd">{b.display}</kbd>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
