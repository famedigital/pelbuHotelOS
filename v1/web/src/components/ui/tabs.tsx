"use client";

import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";

import { cn } from "@/lib/utils";

function Tabs({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      className={cn("flex flex-col gap-2.5", className)}
      {...props}
    />
  );
}

function TabsList({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      className={cn(
        "relative inline-flex h-10 items-center justify-center rounded-xl p-1 gap-1 " +
        "bg-muted/50 dark:bg-zinc-900/60 backdrop-blur-xl " +
        "border border-border/60 shadow-[inset_0_1px_1px_rgba(0,0,0,0.05)] dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] " +
        "text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
}

function TabsTrigger({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        "relative inline-flex items-center justify-center gap-1.5 rounded-lg px-3.5 py-1.5 " +
        "text-xs font-bold whitespace-nowrap select-none transition-all duration-200 " +
        "text-muted-foreground hover:text-foreground cursor-pointer " +
        "data-[state=active]:bg-white dark:data-[state=active]:bg-zinc-800 " +
        "data-[state=active]:text-foreground " +
        "data-[state=active]:border data-[state=active]:border-black/5 dark:data-[state=active]:border-white/15 " +
        "data-[state=active]:shadow-[0_4px_14px_-2px_rgba(0,0,0,0.1),inset_0_1px_1px_#fff] " +
        "dark:data-[state=active]:shadow-[0_4px_18px_-2px_rgba(0,0,0,0.6),inset_0_1px_1px_rgba(255,255,255,0.15)] " +
        "data-[state=active]:scale-[1.02] " +
        "disabled:pointer-events-none disabled:opacity-50 " +
        "active:scale-95 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-3.5",
        className,
      )}
      {...props}
    />
  );
}

function TabsContent({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn("flex-1 outline-none animate-in fade-in-50 duration-200", className)}
      {...props}
    />
  );
}

export { Tabs, TabsContent, TabsList, TabsTrigger };
