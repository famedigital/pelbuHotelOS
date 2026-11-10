import { Command } from "cmdk";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect } from "react";
import { cn } from "../lib/cn.js";
import { springSnappy } from "../motion/presets.js";

export type CommandItem = {
  id: string;
  label: string;
  hint?: string;
  group?: string;
  onSelect: () => void;
};

type CommandPaletteProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: CommandItem[];
  placeholder?: string;
};

export function CommandPalette({
  open,
  onOpenChange,
  items,
  placeholder = "Jump to…",
}: CommandPaletteProps) {
  const reduce = useReducedMotion();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        onOpenChange(!open);
      }
      if (e.key === "Escape" && open) onOpenChange(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  const groups = [...new Set(items.map((i) => i.group ?? "Navigate"))];

  return (
    <AnimatePresence>
      {open ? (
        <div className="fixed inset-0 z-[80] flex items-start justify-center px-4 pt-[12vh]">
          <motion.button
            type="button"
            aria-label="Close command palette"
            className="absolute inset-0 bg-[rgba(15,23,42,0.4)]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => onOpenChange(false)}
          />
          <motion.div
            role="dialog"
            aria-modal
            className={cn(
              "relative z-[1] w-full max-w-xl overflow-hidden rounded-[16px] border border-white/14",
              "bg-[rgba(255,255,255,0.9)] shadow-[0_24px_80px_-20px_rgba(37,99,235,0.45)] backdrop-blur-[28px]",
            )}
            initial={reduce ? false : { opacity: 0, y: -12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduce ? undefined : { opacity: 0, y: -8, scale: 0.98 }}
            transition={springSnappy}
          >
            <Command label="Command palette" className="flex flex-col">
              <Command.Input
                placeholder={placeholder}
                className="h-12 w-full border-b border-[var(--hos-line)] bg-transparent px-4 text-base text-[var(--hos-ink)] outline-none placeholder:text-[var(--hos-ink-3)]"
              />
              <Command.List className="max-h-[360px] overflow-auto p-2">
                <Command.Empty className="px-3 py-6 text-center text-sm text-[var(--hos-ink-3)]">
                  No matches
                </Command.Empty>
                {groups.map((g) => (
                  <Command.Group
                    key={g}
                    heading={g}
                    className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-[var(--hos-ink-3)]"
                  >
                    {items
                      .filter((i) => (i.group ?? "Navigate") === g)
                      .map((item) => (
                        <Command.Item
                          key={item.id}
                          value={`${item.label} ${item.hint ?? ""}`}
                          onSelect={() => {
                            item.onSelect();
                            onOpenChange(false);
                          }}
                          className="flex cursor-pointer items-center justify-between rounded-[8px] px-3 py-2 text-sm text-[var(--hos-ink)] aria-selected:bg-[rgba(37,99,235,0.12)] aria-selected:text-[var(--hos-primary)]"
                        >
                          <span>{item.label}</span>
                          {item.hint ? (
                            <span className="text-xs text-[var(--hos-ink-3)]">{item.hint}</span>
                          ) : null}
                        </Command.Item>
                      ))}
                  </Command.Group>
                ))}
              </Command.List>
            </Command>
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  );
}
