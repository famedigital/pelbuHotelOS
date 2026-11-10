"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ClockIcon, UserIcon, BedDoubleIcon, ReceiptTextIcon } from "lucide-react";

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
import {
  ERP_MODULES,
  ERP_QUICK_ACTIONS,
  erpNavLeafHaystack,
} from "@/lib/erp-nav";
import {
  erpNavFilterScore,
  erpNavSearchHaystack,
} from "@/lib/erp-nav-search";
import {
  filterErpNavByGrants,
  pathnameAllowedForModules,
} from "@/lib/erp/desk-modules";
import {
  pushErpRecent,
  readErpRecents,
  type ErpRecentRoute,
} from "@/lib/erp-recents";

/** Custom event so mobile More / buttons can open the palette without keyboard. */
export const ERP_OPEN_COMMAND_PALETTE = "erp:open-command-palette";

export function openErpCommandPalette() {
  document.dispatchEvent(new CustomEvent(ERP_OPEN_COMMAND_PALETTE));
}

type EntityHit = {
  kind: "guest" | "room" | "booking" | "invoice" | "agent";
  id: string;
  label: string;
  href: string;
  meta?: string;
};

const ENTITY_ICONS = {
  guest: UserIcon,
  room: BedDoubleIcon,
  booking: ReceiptTextIcon,
  invoice: ReceiptTextIcon,
  agent: UserIcon,
} as const;

/**
 * Desk command palette — Ctrl+K / Cmd+K jumps to any allowed module tab.
 */
export function ErpCommandPalette({
  allowedModuleKeys,
}: {
  allowedModuleKeys?: readonly string[];
} = {}) {
  const [open, setOpen] = React.useState(false);
  const [recents, setRecents] = React.useState<ErpRecentRoute[]>([]);
  const [entityQuery, setEntityQuery] = React.useState("");
  const [entityHits, setEntityHits] = React.useState<EntityHit[]>([]);
  const [entityLoading, setEntityLoading] = React.useState(false);
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

  React.useEffect(() => {
    if (open) setRecents(readErpRecents());
  }, [open]);

  React.useEffect(() => {
    const q = entityQuery.trim();
    if (q.length < 2) {
      setEntityHits([]);
      setEntityLoading(false);
      return;
    }

    setEntityLoading(true);
    const handle = window.setTimeout(() => {
      void fetch(`/api/erp/desk-search?q=${encodeURIComponent(q)}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (!data || !Array.isArray(data.results)) {
            setEntityHits([]);
            return;
          }
          setEntityHits(data.results as EntityHit[]);
        })
        .catch(() => setEntityHits([]))
        .finally(() => setEntityLoading(false));
    }, 280);

    return () => window.clearTimeout(handle);
  }, [entityQuery]);

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

  const allowedRecents = React.useMemo(() => {
    if (!allow) return recents;
    return recents.filter((r) => pathnameAllowedForModules(r.href, allow));
  }, [allow, recents]);

  const navigate = React.useCallback(
    (href: string, title: string) => {
      pushErpRecent({ href, title });
      setRecents(readErpRecents());
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
      commandProps={{ filter: erpNavFilterScore }}
    >
      <CommandInput
        placeholder="Conf # · guest · phone · room · folio · INV · agent…"
        aria-label="Search desk screens and records"
        onValueChange={setEntityQuery}
      />
      <CommandList>
        <CommandEmpty>No matching screen.</CommandEmpty>
        {entityLoading ? (
          <p className="px-3 py-2 text-xs text-muted-foreground">
            Searching reservations, guests, invoices…
          </p>
        ) : null}
        {entityHits.length > 0 ? (
          <>
            <CommandGroup heading="Records">
              {entityHits.map((hit) => {
                const Icon = ENTITY_ICONS[hit.kind];
                return (
                  <CommandItem
                    key={`${hit.kind}-${hit.id}`}
                    value={erpNavSearchHaystack({
                      title: hit.label,
                      href: hit.href,
                      context: hit.kind,
                      keywords: hit.meta ? [hit.meta] : undefined,
                    })}
                    keywords={[hit.kind, hit.meta ?? ""].filter(Boolean)}
                    onSelect={() => navigate(hit.href, hit.label)}
                  >
                    <Icon />
                    <span>{hit.label}</span>
                    {hit.meta ? (
                      <CommandShortcut>{hit.meta}</CommandShortcut>
                    ) : null}
                  </CommandItem>
                );
              })}
            </CommandGroup>
            <CommandSeparator />
          </>
        ) : null}
        {allowedRecents.length > 0 ? (
          <>
            <CommandGroup heading="Recent">
              {allowedRecents.map((recent) => (
                <CommandItem
                  key={recent.href}
                  value={erpNavSearchHaystack({
                    title: recent.title,
                    href: recent.href,
                    context: "recent",
                  })}
                  onSelect={() => navigate(recent.href, recent.title)}
                >
                  <ClockIcon />
                  <span>{recent.title}</span>
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
          </>
        ) : null}
        {quick.length > 0 ? (
          <>
            <CommandGroup heading="Quick actions">
              {quick.map((action) => {
                const Icon = action.icon;
                return (
                  <CommandItem
                    key={action.href}
                    value={erpNavLeafHaystack(action)}
                    keywords={action.keywords}
                    onSelect={() => navigate(action.href, action.title)}
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
                  value={erpNavLeafHaystack(tab, module.title)}
                  keywords={tab.keywords}
                  onSelect={() => navigate(tab.href, tab.title)}
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

/** cmdk filter wired at dialog level — re-export for Command wrapper if needed. */
export { erpNavFilterScore as erpCommandFilter };
