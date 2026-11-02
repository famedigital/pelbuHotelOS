"use client";

import { Toaster as Sonner, type ToasterProps } from "sonner";

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="light"
      className="toaster group"
      toastOptions={{
        classNames: {
          toast: "glass-happy-card border-border/60",
          success: "border-emerald-500/35 text-emerald-800",
          error: "border-rose-500/35 text-rose-800",
        },
      }}
      style={
        {
          "--normal-bg": "transparent",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
        } as React.CSSProperties
      }
      {...props}
    />
  );
}

export { Toaster };
