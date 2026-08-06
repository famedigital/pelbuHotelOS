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
import {
  filterErpNavByGrants,
  pathnameAllowedForModules,
} from "@/lib/erp/desk-modules";

/** Custom event so mobile More / buttons can open the palette without keyboard. */
export const ERP_OPEN_COMMAND_PALETTE = "erp:open-command-palette";

export function openErpCommandPalette() {
  document.dispatchEvent(new CustomEvent(ERP_OPEN_COMMAND_PALETTE));
}

/**
 * Desk command palette — Ctrl+K / Cmd+K jumps to any allowed module tab.
 */
export function ErpCommandPalette({
  allowedModuleKeys,
}: {
  allowedModuleKeys?: readonly string[];
} = {}) {
  const [open, setOpen] = React.useState(false);
  const router = useRouter();

  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "k" || !(event.metaKey || event.ctrlKey)) return;
      event.preventDefault();
      setOpen((value) => !value);
    };
    const onOpen = () => setOpen(true);
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener(ERP_OPEN_COMMAND_PALETTE, onOpen);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener(ERP_OPEN_COMMAND_PALETTE, onOpen);
    };
  }, []);

  const allow = React.useMemo(() => {
    if (!allowedModuleKeys || allowedModuleKeys.length === 0) return null;
    return allowedModuleKeys;
  }, [allowedModuleKeys]);

  const modules = React.useMemo(() => {
    if (!allow) return ERP_MODULES;
    return filterErpNavByGrants(ERP_MODULES, allow);
  }, [allow]);

  const quick = React.useMemo(() => {
    if (!allow) return ERP_QUICK_ACTIONS;
    return ERP_QUICK_ACTIONS.filter((action) =>
      pathnameAllowedForModules(action.href, allow),
    );
  }, [allow]);

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
        {quick.length > 0 ? (
          <>
            <CommandGroup heading="Quick actions">
              {quick.map((action) => {
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
          </>
        ) : null}
        {modules.map((module) => (
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
