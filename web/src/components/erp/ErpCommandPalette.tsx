"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import { ERP_MODULES, ERP_QUICK_ACTIONS } from "@/lib/erp-nav";

/**
 * Desk command palette — Ctrl+K / Cmd+K jumps to any module tab or quick action.
 * Mounted in DeskShell so it only runs inside the authenticated ERP shell.
 */
export function ErpCommandPalette() {
  const [open, setOpen] = React.useState(false);
  const router = useRouter();

  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "k" || !(event.metaKey || event.ctrlKey)) return;
      event.preventDefault();
      setOpen((value) => !value);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  const navigate = React.useCallback(
    (href: string) => {
      setOpen(false);
      router.push(href);
    },
    [router],
  );

  return (
    <CommandDialog
      open={open}
      onOpenChange={setOpen}
      title="Desk command palette"
      description="Search modules and jump to a screen"
    >
      <CommandInput placeholder="Jump to a screen…" aria-label="Search desk screens" />
      <CommandList>
        <CommandEmpty>No matching screen.</CommandEmpty>
        <CommandGroup heading="Quick actions">
          {ERP_QUICK_ACTIONS.map((action) => {
            const Icon = action.icon;
            return (
              <CommandItem
                key={action.href}
                value={`${action.title} ${action.href}`}
                onSelect={() => navigate(action.href)}
              >
                <Icon />
                <span>{action.title}</span>
              </CommandItem>
            );
          })}
        </CommandGroup>
        <CommandSeparator />
        {ERP_MODULES.map((module) => (
          <CommandGroup key={module.key} heading={module.title}>
            {module.tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <CommandItem
                  key={tab.href}
                  value={`${module.title} ${tab.title} ${tab.href}`}
                  onSelect={() => navigate(tab.href)}
                >
                  <Icon />
                  <span>{tab.title}</span>
                  {module.tabs.length > 1 ? (
                    <CommandShortcut>{module.title}</CommandShortcut>
                  ) : null}
                </CommandItem>
              );
            })}
          </CommandGroup>
        ))}
      </CommandList>
    </CommandDialog>
  );
}
