"use client";

import { useTheme } from "next-themes";
import { Toaster as Sonner, type ToasterProps } from "sonner";
import {
  CheckCircle2,
  AlertTriangle,
  AlertOctagon,
  Info,
  Loader2,
  Sparkles
} from "lucide-react";

export function Toaster({ ...props }: ToasterProps) {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      richColors={false}
      gap={10}
      offset={18}
      icons={{
        success: (
          <div className="relative flex size-8 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-500 border border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.35)]">
            <CheckCircle2 className="size-4 animate-in zoom-in-50 duration-200 stroke-[2.5]" />
          </div>
        ),
        error: (
          <div className="relative flex size-8 shrink-0 items-center justify-center rounded-xl bg-rose-500/15 text-rose-500 border border-rose-500/30 shadow-[0_0_15px_rgba(244,63,94,0.35)]">
            <AlertOctagon className="size-4 animate-in zoom-in-50 duration-200 stroke-[2.5]" />
          </div>
        ),
        warning: (
          <div className="relative flex size-8 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-500 border border-amber-500/30 shadow-[0_0_15px_rgba(245,158,11,0.35)]">
            <AlertTriangle className="size-4 animate-in zoom-in-50 duration-200 stroke-[2.5]" />
          </div>
        ),
        info: (
          <div className="relative flex size-8 shrink-0 items-center justify-center rounded-xl bg-sky-500/15 text-sky-500 border border-sky-500/30 shadow-[0_0_15px_rgba(14,165,233,0.35)]">
            <Info className="size-4 animate-in zoom-in-50 duration-200 stroke-[2.5]" />
          </div>
        ),
        loading: (
          <div className="relative flex size-8 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary border border-primary/30 shadow-[0_0_15px_rgba(217,119,6,0.35)]">
            <Loader2 className="size-4 animate-spin text-primary stroke-[2.5]" />
          </div>
        ),
      }}
      toastOptions={{
        classNames: {
          toast:
            "group sovereign-toast relative flex items-center gap-3.5 w-full rounded-2xl p-4 " +
            "border border-border/70 backdrop-blur-2xl backdrop-saturate-150 " +
            "bg-white/90 dark:bg-zinc-950/90 text-foreground shadow-2xl " +
            "transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] " +
            "hover:scale-[1.015] active:scale-[0.985]",
          title: "text-xs font-black tracking-tight text-foreground antialiased font-sans flex items-center gap-1.5",
          description: "text-[11px] text-muted-foreground font-medium leading-relaxed mt-0.5 antialiased font-sans",
          actionButton:
            "h-8 px-3.5 rounded-xl text-xs font-black bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 active:scale-95 transition-all shrink-0",
          cancelButton:
            "h-8 px-3 rounded-xl text-xs font-bold bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground active:scale-95 transition-all shrink-0",
          closeButton:
            "!rounded-full !border !border-border/60 !bg-background/90 hover:!bg-background !text-muted-foreground hover:!text-foreground !size-6 !top-3.5 !right-3.5 transition-transform hover:scale-110 active:scale-90 shadow-sm",
          success:
            "!border-emerald-500/40 dark:!border-emerald-500/30 !shadow-[0_20px_50px_-10px_rgba(16,185,129,0.25)]",
          error:
            "!border-rose-500/40 dark:!border-rose-500/30 !shadow-[0_20px_50px_-10px_rgba(244,63,94,0.25)]",
          warning:
            "!border-amber-500/40 dark:!border-amber-500/30 !shadow-[0_20px_50px_-10px_rgba(245,158,11,0.25)]",
          info:
            "!border-sky-500/40 dark:!border-sky-500/30 !shadow-[0_20px_50px_-10px_rgba(14,165,233,0.25)]",
        },
      }}
      {...props}
    />
  );
}
