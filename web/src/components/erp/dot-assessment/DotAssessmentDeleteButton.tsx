"use client";

import {
  deleteDotAssessment,
  deleteEmptyDotDrafts,
} from "@/app/actions/erp-dot-assessment";
import { Button } from "@/components/ui/button";
import { Trash2Icon } from "lucide-react";

export function DotAssessmentDeleteButton({
  assessmentId,
  starLevel,
  status,
  progressPct,
}: {
  assessmentId: string;
  starLevel: 3 | 4;
  status: string;
  progressPct: number;
}) {
  return (
    <form
      action={deleteDotAssessment}
      onSubmit={(e) => {
        const msg =
          progressPct > 0
            ? `Delete this ${starLevel}★ checklist (${status}, ${progressPct}%)? Answers and photos will be removed.`
            : `Delete this unused ${starLevel}★ draft? This cannot be undone.`;
        if (!window.confirm(msg)) e.preventDefault();
      }}
    >
      <input type="hidden" name="assessment_id" value={assessmentId} />
      <Button
        type="submit"
        variant="ghost"
        size="icon"
        className="size-11 shrink-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
        aria-label={`Delete ${starLevel}★ ${status} assessment`}
      >
        <Trash2Icon className="size-4" />
      </Button>
    </form>
  );
}

export function ClearEmptyDotDraftsButton({ count }: { count: number }) {
  if (count < 2) return null;
  return (
    <form
      action={deleteEmptyDotDrafts}
      onSubmit={(e) => {
        if (
          !window.confirm(
            `Delete ${count} unused drafts (0% progress, no photos)? This cannot be undone.`,
          )
        ) {
          e.preventDefault();
        }
      }}
    >
      <Button type="submit" variant="outline" size="sm" className="h-9">
        Clear {count} unused drafts
      </Button>
    </form>
  );
}
