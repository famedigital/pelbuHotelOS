"use client";

import { Badge } from "@/components/ui/badge";
import {
  DESK_MODULE_CATALOG,
  grantsFromEditorSelection,
} from "@/lib/erp/desk-modules";
import { cn } from "@/lib/utils";
import {
  CheckIcon,
  ChevronDownIcon,
  LockIcon,
  ShieldIcon,
} from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";

export type StaffAccessGrantPickerProps = {
  /** When true, show role-defaults preview only (checkboxes disabled for style). */
  useDefaults: boolean;
  onUseDefaultsChange: (next: boolean) => void;
  /** Selected module keys + tab hrefs for editor state. */
  selected: Set<string>;
  onSelectedChange: (next: Set<string>) => void;
  /** Role-default module keys used when useDefaults is on. */
  roleDefaults: readonly string[];
  /** Disable all controls (view-only / owner locked). */
  disabled?: boolean;
  /** Compact for dossier sheet. */
  compact?: boolean;
};

/**
 * Hyper-specific desk access: whole modules or individual screens (e.g. Money
 * without Team › Payroll / salary).
 */
export function StaffAccessGrantPicker({
  useDefaults,
  onUseDefaultsChange,
  selected,
  onSelectedChange,
  roleDefaults,
  disabled = false,
  compact = false,
}: StaffAccessGrantPickerProps) {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());

  const previewSelected = useMemo(() => {
    if (!useDefaults) return selected;
    const next = new Set<string>();
    for (const key of roleDefaults) {
      next.add(key);
      const mod = DESK_MODULE_CATALOG.find((m) => m.key === key);
      if (mod) for (const t of mod.tabs) next.add(t.href);
    }
    return next;
  }, [useDefaults, selected, roleDefaults]);

  const grantTokens = useMemo(
    () => grantsFromEditorSelection(previewSelected),
    [previewSelected],
  );

  const locked = disabled || useDefaults;

  function toggleExpand(key: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function ensureDashboard(next: Set<string>) {
    next.add("dashboard");
    for (const t of DESK_MODULE_CATALOG.find((m) => m.key === "dashboard")
      ?.tabs ?? []) {
      next.add(t.href);
    }
  }

  function setModuleAll(moduleKey: string, on: boolean) {
    if (locked || moduleKey === "dashboard") return;
    const mod = DESK_MODULE_CATALOG.find((m) => m.key === moduleKey);
    if (!mod) return;
    onSelectedChange(
      (() => {
        const next = new Set(selected);
        if (on) {
          next.add(moduleKey);
          for (const t of mod.tabs) next.add(t.href);
        } else {
          next.delete(moduleKey);
          for (const t of mod.tabs) next.delete(t.href);
        }
        ensureDashboard(next);
        return next;
      })(),
    );
  }

  function setTab(moduleKey: string, href: string, on: boolean) {
    if (locked || moduleKey === "dashboard") return;
    const mod = DESK_MODULE_CATALOG.find((m) => m.key === moduleKey);
    if (!mod) return;
    onSelectedChange(
      (() => {
        const next = new Set(selected);
        if (on) next.add(href);
        else next.delete(href);
        next.delete(moduleKey);
        if (mod.tabs.every((t) => next.has(t.href))) {
          next.add(moduleKey);
        }
        ensureDashboard(next);
        return next;
      })(),
    );
  }

  function moduleState(moduleKey: string): "all" | "partial" | "none" {
    const mod = DESK_MODULE_CATALOG.find((m) => m.key === moduleKey);
    if (!mod) return "none";
    const tabCount = mod.tabs.length;
    if (tabCount === 0) {
      return previewSelected.has(moduleKey) ? "all" : "none";
    }
    const on = mod.tabs.filter((t) => previewSelected.has(t.href)).length;
    if (on === 0) return "none";
    if (on === tabCount) return "all";
    return "partial";
  }

  const fullModuleCount = grantTokens.filter((g) => !g.startsWith("/")).length;
  const tabOnlyCount = grantTokens.filter((g) => g.startsWith("/")).length;

  return (
    <div className="space-y-4">
      <div
        className={cn(
          "flex flex-col gap-3 rounded-2xl border bg-gradient-to-br from-muted/40 via-background to-background p-4",
          compact && "p-3",
        )}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <p className="flex items-center gap-2 text-sm font-semibold tracking-tight">
              <ShieldIcon className="size-4 text-accent" aria-hidden />
              ERP screens
            </p>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Grant whole modules or open a module and pick screens. Example:
              Money for payments, but leave Team › Payroll off so salary stays
              private.
            </p>
          </div>
          <div
            className="inline-flex rounded-full border bg-background p-0.5 shadow-sm"
            role="group"
            aria-label="Access mode"
          >
            <ModePill
              active={useDefaults}
              disabled={disabled}
              onClick={() => onUseDefaultsChange(true)}
            >
              Role defaults
            </ModePill>
            <ModePill
              active={!useDefaults}
              disabled={disabled}
              onClick={() => onUseDefaultsChange(false)}
            >
              Custom mix
            </ModePill>
          </div>
        </div>

        {useDefaults ? (
          <p className="text-[11px] text-muted-foreground">
            Following desk role defaults (full modules). Switch to{" "}
            <span className="font-medium text-foreground">Custom mix</span> to
            allow or block individual screens.
          </p>
        ) : (
          <p className="text-[11px] text-muted-foreground">
            {fullModuleCount} module{fullModuleCount === 1 ? "" : "s"}
            {tabOnlyCount > 0
              ? ` · ${tabOnlyCount} screen-only grant${tabOnlyCount === 1 ? "" : "s"}`
              : ""}
          </p>
        )}
      </div>

      <input
        type="hidden"
        name="module_mode"
        value={useDefaults ? "defaults" : "custom"}
      />
      {!useDefaults
        ? grantTokens.map((token) =>
            token.startsWith("/erp") ? (
              <input key={token} type="hidden" name="tab_key" value={token} />
            ) : (
              <input
                key={token}
                type="hidden"
                name="module_key"
                value={token}
              />
            ),
          )
        : null}

      <div
        className={cn(
          "grid gap-2",
          compact ? "sm:grid-cols-1" : "sm:grid-cols-2",
          useDefaults && "opacity-90",
        )}
      >
        {DESK_MODULE_CATALOG.map((mod) => {
          const state = moduleState(mod.key);
          const isOpen = expanded.has(mod.key) || state === "partial";
          const isDashboard = mod.key === "dashboard";
          const hasSensitive = mod.tabs.some((t) => t.sensitive);

          return (
            <div
              key={mod.key}
              className={cn(
                "overflow-hidden rounded-xl border bg-card transition-shadow",
                state !== "none" && !useDefaults && "ring-1 ring-accent/25",
                isOpen && "shadow-sm",
              )}
            >
              <div className="flex items-stretch gap-0">
                <label
                  className={cn(
                    "flex min-h-12 flex-1 cursor-pointer items-center gap-3 px-3 py-2.5",
                    (locked || isDashboard) && "cursor-default",
                  )}
                >
                  <span
                    className={cn(
                      "flex size-5 shrink-0 items-center justify-center rounded-md border transition-colors",
                      state === "all" &&
                        "border-accent bg-accent text-accent-foreground",
                      state === "partial" &&
                        "border-accent/70 bg-accent/15 text-accent",
                      state === "none" && "border-input bg-background",
                    )}
                    aria-hidden
                  >
                    {state === "all" ? (
                      <CheckIcon className="size-3.5" strokeWidth={2.5} />
                    ) : state === "partial" ? (
                      <span className="block size-2 rounded-[2px] bg-accent" />
                    ) : null}
                  </span>
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={state === "all"}
                    disabled={locked || isDashboard}
                    onChange={(e) => setModuleAll(mod.key, e.target.checked)}
                    aria-label={`${mod.title} module (all screens)`}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-1.5 text-sm font-medium">
                      {mod.title}
                      {isDashboard ? (
                        <Badge variant="secondary" className="text-[10px]">
                          always on
                        </Badge>
                      ) : null}
                      {hasSensitive ? (
                        <Badge
                          variant="outline"
                          className="gap-0.5 border-amber-500/40 text-[10px] text-amber-800 dark:text-amber-200"
                        >
                          <LockIcon className="size-2.5" aria-hidden />
                          pay
                        </Badge>
                      ) : null}
                    </span>
                    <span className="mt-0.5 block text-[11px] text-muted-foreground">
                      {state === "all"
                        ? "All screens"
                        : state === "partial"
                          ? `${mod.tabs.filter((t) => previewSelected.has(t.href)).length} of ${mod.tabs.length} screens`
                          : "No access"}
                    </span>
                  </span>
                </label>
                {mod.tabs.length > 1 ? (
                  <button
                    type="button"
                    onClick={() => toggleExpand(mod.key)}
                    className="inline-flex w-10 shrink-0 items-center justify-center border-l text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
                    aria-expanded={isOpen}
                    aria-label={`${isOpen ? "Hide" : "Show"} ${mod.title} screens`}
                  >
                    <ChevronDownIcon
                      className={cn(
                        "size-4 transition-transform duration-200",
                        isOpen && "rotate-180",
                      )}
                    />
                  </button>
                ) : null}
              </div>

              {isOpen && mod.tabs.length > 1 ? (
                <div className="border-t bg-muted/25 px-3 py-2.5">
                  <ul className="flex flex-col gap-1">
                    {mod.tabs.map((tab) => {
                      const on = previewSelected.has(tab.href);
                      return (
                        <li key={tab.href}>
                          <label
                            className={cn(
                              "flex min-h-9 cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-background/80",
                              (locked || isDashboard) && "cursor-default",
                              tab.sensitive && "bg-amber-500/5",
                            )}
                          >
                            <input
                              type="checkbox"
                              checked={on}
                              disabled={locked || isDashboard}
                              onChange={(e) =>
                                setTab(mod.key, tab.href, e.target.checked)
                              }
                              className="size-3.5 shrink-0 rounded border"
                            />
                            <span className="flex min-w-0 flex-1 items-center gap-1.5">
                              <span className="truncate">{tab.title}</span>
                              {tab.sensitive ? (
                                <Badge
                                  variant="outline"
                                  className="shrink-0 border-amber-500/40 text-[10px] text-amber-800 dark:text-amber-200"
                                >
                                  salary
                                </Badge>
                              ) : null}
                            </span>
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ModePill({
  active,
  disabled,
  onClick,
  children,
}: {
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
        active
          ? "bg-foreground text-background shadow-sm"
          : "text-muted-foreground hover:text-foreground",
        disabled && "opacity-50",
      )}
      aria-pressed={active}
    >
      {children}
    </button>
  );
}
