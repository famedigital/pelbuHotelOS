"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/** Optional fields when posting into a soft-closed or closed accounting period. */
export function PeriodOverrideFields({
  idPrefix = "period",
  /** When true, section starts open (e.g. after a period-lock error). */
  defaultOpen = false,
  className,
}: {
  idPrefix?: string;
  defaultOpen?: boolean;
  className?: string;
}) {
  return (
    <details
      open={defaultOpen || undefined}
      className={cn(
        "rounded-md border border-dashed px-3 py-2 text-sm",
        className,
      )}
    >
      <summary className="cursor-pointer text-xs font-medium text-muted-foreground">
        Period override (manager only)
      </summary>
      <div className="mt-3 grid gap-3">
        <p className="text-[11px] text-muted-foreground">
          Needed only when the night is in a locked accounting period. PIN + a
          short reason unlock this one void/post.
        </p>
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}_manager_pin`}>Manager PIN</Label>
          <Input
            id={`${idPrefix}_manager_pin`}
            name="manager_pin"
            type="password"
            autoComplete="off"
            className="h-9"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}_override_reason`}>
            Override reason (required when period locked)
          </Label>
          <Input
            id={`${idPrefix}_override_reason`}
            name="period_override_reason"
            placeholder="e.g. Rate correction room 203"
            className="h-9"
          />
        </div>
      </div>
    </details>
  );
}
