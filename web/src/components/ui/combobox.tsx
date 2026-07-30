"use client";

import * as React from "react";
import { CheckIcon, ChevronsUpDownIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export type ComboboxOption = {
  value: string;
  label: string;
  hint?: string;
};

type SlotCtx = {
  query: string;
  close: () => void;
};

/**
 * Generic combobox built on shadcn Popover + Command (Radix + cmdk).
 * Type to search, pick from a list. Controlled via `value` / `onValueChange`.
 */
export function Combobox({
  options,
  value,
  onValueChange,
  placeholder = "Select…",
  searchPlaceholder = "Search…",
  emptyText = "No match.",
  emptyContent,
  headerContent,
  allowClear = false,
  clearLabel = "— None —",
  className,
  disabled,
  onQueryChange,
}: {
  options: ComboboxOption[];
  value?: string | null;
  onValueChange?: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  /** Prefer over `emptyText` when search returns no rows. */
  emptyContent?: React.ReactNode | ((ctx: SlotCtx) => React.ReactNode);
  /** Always shown under the search box while open (e.g. Add agent). */
  headerContent?: React.ReactNode | ((ctx: SlotCtx) => React.ReactNode);
  allowClear?: boolean;
  clearLabel?: string;
  className?: string;
  disabled?: boolean;
  onQueryChange?: (query: string) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");

  const close = React.useCallback(() => {
    setOpen(false);
    setQuery("");
    onQueryChange?.("");
  }, [onQueryChange]);

  const selected = React.useMemo(
    () => options.find((o) => o.value === value),
    [options, value],
  );

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(q) ||
        (o.hint?.toLowerCase().includes(q) ?? false),
    );
  }, [options, query]);

  const slotCtx: SlotCtx = { query, close };

  const header =
    typeof headerContent === "function"
      ? headerContent(slotCtx)
      : headerContent;
  const empty =
    typeof emptyContent === "function"
      ? emptyContent(slotCtx)
      : (emptyContent ?? emptyText);

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setQuery("");
          onQueryChange?.("");
        }
      }}
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "w-full justify-between font-normal",
            !selected && "text-muted-foreground",
            className,
          )}
        >
          <span className="truncate">
            {selected ? selected.label : placeholder}
          </span>
          <ChevronsUpDownIcon className="size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-(--radix-popover-trigger-width) p-0"
        align="start"
      >
        <Command shouldFilter={false}>
          <CommandInput
            placeholder={searchPlaceholder}
            value={query}
            onValueChange={(next) => {
              setQuery(next);
              onQueryChange?.(next);
            }}
          />
          {header ? (
            <div className="border-b border-border/70 px-1 py-1">{header}</div>
          ) : null}
          <CommandList>
            <CommandEmpty>{empty}</CommandEmpty>
            <CommandGroup>
              {allowClear ? (
                <CommandItem
                  value="__clear__"
                  onSelect={() => {
                    onValueChange?.("");
                    close();
                  }}
                >
                  <span className="text-muted-foreground">{clearLabel}</span>
                  <CheckIcon
                    className={cn(
                      "ml-auto size-4",
                      !value ? "opacity-100" : "opacity-0",
                    )}
                  />
                </CommandItem>
              ) : null}
              {filtered.map((opt) => (
                <CommandItem
                  key={opt.value}
                  value={opt.value}
                  onSelect={(currentValue) => {
                    onValueChange?.(currentValue);
                    close();
                  }}
                >
                  <div className="flex flex-1 flex-col items-start">
                    <span>{opt.label}</span>
                    {opt.hint && (
                      <span className="text-muted-foreground text-xs">
                        {opt.hint}
                      </span>
                    )}
                  </div>
                  <CheckIcon
                    className={cn(
                      "size-4",
                      value === opt.value ? "opacity-100" : "opacity-0",
                    )}
                  />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
