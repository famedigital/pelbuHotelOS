"use client";

import type { NightAuditPipelineStep } from "@/lib/night-audit/steps";
import {
  CheckCircle2Icon,
  CircleIcon,
  Loader2Icon,
  XCircleIcon,
} from "lucide-react";

export function NightAuditPipelineList({
  steps,
  compact = false,
}: {
  steps: NightAuditPipelineStep[];
  compact?: boolean;
}) {
  return (
    <ul className={compact ? "space-y-1.5" : "space-y-2"}>
      {steps.map((step) => (
        <li key={step.id} className="flex items-start gap-2 text-sm">
          <StepIcon status={step.status} />
          <div className="min-w-0 flex-1">
            <p
              className={
                step.status === "failed"
                  ? "font-medium text-destructive"
                  : step.status === "done" || step.status === "skipped"
                    ? "text-foreground"
                    : step.status === "running"
                      ? "font-medium text-foreground"
                      : "text-muted-foreground"
              }
            >
              {step.label}
            </p>
            {step.detail ? (
              <p
                className={`mt-0.5 text-xs ${
                  step.status === "failed"
                    ? "text-destructive"
                    : "text-muted-foreground"
                }`}
              >
                {step.detail}
              </p>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );
}

function StepIcon({ status }: { status: NightAuditPipelineStep["status"] }) {
  const cls = "mt-0.5 size-4 shrink-0";
  if (status === "running") {
    return (
      <Loader2Icon
        className={`${cls} animate-spin text-accent`}
        aria-label="Running"
      />
    );
  }
  if (status === "done" || status === "skipped") {
    return (
      <CheckCircle2Icon
        className={`${cls} text-citrus`}
        aria-label={status === "skipped" ? "Skipped" : "Done"}
      />
    );
  }
  if (status === "failed") {
    return (
      <XCircleIcon className={`${cls} text-destructive`} aria-label="Failed" />
    );
  }
  return (
    <CircleIcon
      className={`${cls} text-muted-foreground/50`}
      aria-label="Pending"
    />
  );
}
