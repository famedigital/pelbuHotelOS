import type { ReactNode } from "react";
import { GlassElevated } from "./Glass.js";
import { Button } from "./Button.js";
import { cn } from "../lib/cn.js";

type ConfirmCardProps = {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "danger" | "primary";
  pending?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  children?: ReactNode;
  className?: string;
};

export function ConfirmCard({
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  tone = "primary",
  pending,
  onConfirm,
  onCancel,
  children,
  className,
}: ConfirmCardProps) {
  return (
    <GlassElevated className={cn("w-full max-w-md p-5", className)}>
      <p className="hos-section-label mb-1">Confirm</p>
      <h3 className="m-0 text-lg font-semibold tracking-tight text-[var(--hos-ink)]">
        {title}
      </h3>
      {description ? (
        <p className="mt-2 text-sm leading-relaxed text-[var(--hos-ink-3)]">{description}</p>
      ) : null}
      {children}
      <div className="mt-4 flex gap-2">
        <Button
          variant={tone === "danger" ? "danger" : "primary"}
          disabled={pending}
          onClick={onConfirm}
        >
          {confirmLabel}
        </Button>
        <Button variant="ghost" disabled={pending} onClick={onCancel}>
          {cancelLabel}
        </Button>
      </div>
    </GlassElevated>
  );
}
