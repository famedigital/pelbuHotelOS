"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { TrainingManual } from "@/lib/erp/training-manuals";
import { allTrainingStepIds } from "@/lib/erp/training-manuals";
import { cn } from "@/lib/utils";
import { CheckCircle2Icon, CircleIcon, ExternalLinkIcon } from "lucide-react";

const STORAGE_PREFIX = "pelbu_training_v1";

function storageKey(propertyId: string) {
  return `${STORAGE_PREFIX}:${propertyId}`;
}

export function TrainingLmsPanel({
  propertyId,
  manuals,
}: {
  propertyId: string;
  manuals: TrainingManual[];
}) {
  const allIds = useMemo(() => allTrainingStepIds(manuals), [manuals]);
  const [done, setDone] = useState<Set<string>>(new Set());

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey(propertyId));
      if (!raw) return;
      const parsed = JSON.parse(raw) as string[];
      setDone(new Set(parsed.filter((id) => allIds.includes(id))));
    } catch {
      /* ignore corrupt storage */
    }
  }, [propertyId, allIds]);

  const persist = useCallback(
    (next: Set<string>) => {
      setDone(next);
      localStorage.setItem(storageKey(propertyId), JSON.stringify([...next]));
    },
    [propertyId],
  );

  const toggle = (stepId: string, checked: boolean) => {
    const next = new Set(done);
    if (checked) next.add(stepId);
    else next.delete(stepId);
    persist(next);
  };

  const completedCount = allIds.filter((id) => done.has(id)).length;
  const pct = allIds.length ? Math.round((completedCount / allIds.length) * 100) : 0;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Your progress</CardTitle>
          <CardDescription>
            {completedCount} of {allIds.length} steps complete — tick each after
            you have walked the screen once.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <div
            className="h-2 overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className="h-full bg-accent transition-[width] duration-300"
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground">{pct}% complete</p>
        </CardContent>
      </Card>

      {manuals.map((manual) => (
        <Card key={manual.key}>
          <CardHeader>
            <CardTitle>{manual.title}</CardTitle>
            <CardDescription>{manual.summary}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {manual.steps.map((step) => {
              const stepId = `${manual.key}:${step.id}`;
              const checked = done.has(stepId);
              return (
                <div
                  key={stepId}
                  className={cn(
                    "flex gap-3 rounded-lg border p-4 transition-colors",
                    checked && "border-emerald-300/60 bg-emerald-50/40",
                  )}
                >
                  <Checkbox
                    id={stepId}
                    checked={checked}
                    onCheckedChange={(v) => toggle(stepId, v === true)}
                    className="mt-0.5"
                    aria-label={`Mark complete: ${step.title}`}
                  />
                  <div className="min-w-0 flex-1 space-y-1">
                    <label
                      htmlFor={stepId}
                      className="flex cursor-pointer items-start gap-2 font-medium"
                    >
                      {checked ? (
                        <CheckCircle2Icon className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                      ) : (
                        <CircleIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                      )}
                      {step.title}
                    </label>
                    <p className="text-sm text-muted-foreground">{step.body}</p>
                    {step.href ? (
                      <Button variant="link" className="h-auto p-0" asChild>
                        <Link href={step.href}>
                          Open screen
                          <ExternalLinkIcon className="ml-1 size-3.5" />
                        </Link>
                      </Button>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
