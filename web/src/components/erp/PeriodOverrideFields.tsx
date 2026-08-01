"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** Optional fields when posting into a soft-closed or closed accounting period. */
export function PeriodOverrideFields({ idPrefix = "period" }: { idPrefix?: string }) {
  return (
    <details className="rounded-md border border-dashed px-3 py-2 text-sm">
      <summary className="cursor-pointer text-xs font-medium text-muted-foreground">
        Period override (manager only)
      </summary>
      <div className="mt-3 grid gap-3">
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
          <Label htmlFor={`${idPrefix}_override_reason`}>Override reason</Label>
          <Input
            id={`${idPrefix}_override_reason`}
            name="period_override_reason"
            placeholder="Why post into a locked period?"
            className="h-9"
          />
        </div>
      </div>
    </details>
  );
}
