import * as React from "react";

import { cn } from "@/lib/utils";

function Table({ className, ...props }: React.ComponentProps<"table">) {
  return (
    <div
      data-slot="table-container"
      className="glass-happy-table-container relative w-full min-w-0 max-w-full overflow-x-auto rounded-2xl border border-border/70 bg-white/70 dark:bg-zinc-950/70 backdrop-blur-xl shadow-[0_16px_40px_-12px_rgba(0,0,0,0.08),inset_0_1px_1px_rgba(255,255,255,0.85)] dark:shadow-[0_20px_50px_-12px_rgba(0,0,0,0.5),inset_0_1px_1px_rgba(255,255,255,0.12)]"
    >
      {/* 1px Specular light reflection on top edge */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/95 dark:via-white/30 to-transparent z-10" />
      <table
        data-slot="table"
        className={cn("w-full caption-bottom text-xs text-foreground antialiased", className)}
        {...props}
      />
    </div>
  );
}

function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return (
    <thead
      data-slot="table-header"
      className={cn(
        "sticky top-0 z-10 bg-muted/70 dark:bg-zinc-900/80 backdrop-blur-md border-b border-border/80 shadow-sm [&_tr]:border-b-0",
        className,
      )}
      {...props}
    />
  );
}

function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return (
    <tbody
      data-slot="table-body"
      className={cn("[&_tr:last-child]:border-0 divide-y divide-border/40", className)}
      {...props}
    />
  );
}

function TableFooter({ className, ...props }: React.ComponentProps<"tfoot">) {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn(
        "bg-muted/60 dark:bg-zinc-900/60 border-t border-border/80 font-bold text-xs [&>tr]:last:border-b-0 backdrop-blur-sm",
        className,
      )}
      {...props}
    />
  );
}

function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
  return (
    <tr
      data-slot="table-row"
      className={cn(
        "group border-b border-border/40 transition-all duration-150 ease-out " +
        "hover:bg-primary/[0.04] dark:hover:bg-primary/[0.08] " +
        "data-[state=selected]:bg-primary/10 data-[state=selected]:border-primary/30",
        className,
      )}
      {...props}
    />
  );
}

function TableHead({ className, ...props }: React.ComponentProps<"th">) {
  return (
    <th
      data-slot="table-head"
      className={cn(
        "h-10 px-3.5 text-left align-middle font-bold text-[11px] uppercase tracking-wider text-muted-foreground whitespace-nowrap select-none [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
        className,
      )}
      {...props}
    />
  );
}

function TableCell({ className, ...props }: React.ComponentProps<"td">) {
  return (
    <td
      data-slot="table-cell"
      className={cn(
        "px-3.5 py-3 align-middle whitespace-nowrap text-xs font-medium text-foreground transition-colors " +
        "[&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
        className,
      )}
      {...props}
    />
  );
}

function TableCaption({
  className,
  ...props
}: React.ComponentProps<"caption">) {
  return (
    <caption
      data-slot="table-caption"
      className={cn("text-muted-foreground mt-4 text-xs font-medium", className)}
      {...props}
    />
  );
}

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
};
