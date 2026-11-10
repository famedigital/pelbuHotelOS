"use client";

import {
  updateSeasonWindow,
  type SeasonEditorState,
} from "@/app/actions/erp-seasons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useActionToast } from "@/hooks/use-action-toast";
import { useActionState } from "react";

const initial: SeasonEditorState = { ok: false };

export type SeasonEditorRow = {
  id: string;
  kind: string;
  starts_on: string;
  ends_on: string;
};

export function SeasonsDateEditor({ seasons }: { seasons: SeasonEditorRow[] }) {
  if (seasons.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No season windows on this property yet.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-[11px] font-semibold tracking-[0.18em] text-accent uppercase">
          Season windows
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Peak, lean, and off date ranges drive which column the rate matrix uses for
          quotes and day-1 room post.
        </p>
      </div>
      <ul className="space-y-3">
        {seasons.map((s) => (
          <SeasonRowForm key={s.id} season={s} />
        ))}
      </ul>
    </div>
  );
}

function SeasonRowForm({ season }: { season: SeasonEditorRow }) {
  const [state, action, pending] = useActionState(updateSeasonWindow, initial);
  useActionToast(state, { successMessage: "Season dates saved" });

  return (
    <form
      action={action}
      className="grid gap-3 rounded-lg border bg-card p-4 sm:grid-cols-[6rem_1fr_1fr_auto] sm:items-end"
    >
      <input type="hidden" name="season_id" value={season.id} />
      <input type="hidden" name="kind" value={season.kind} />
      <div>
        <p className="text-[10px] font-semibold tracking-[0.16em] text-muted-foreground uppercase">
          Kind
        </p>
        <p className="mt-1 font-medium capitalize text-foreground">{season.kind}</p>
      </div>
      <label className="space-y-1 text-sm">
        <span className="text-muted-foreground">Starts</span>
        <Input
          type="date"
          name="starts_on"
          required
          defaultValue={season.starts_on}
          className="h-10"
        />
      </label>
      <label className="space-y-1 text-sm">
        <span className="text-muted-foreground">Ends</span>
        <Input
          type="date"
          name="ends_on"
          required
          defaultValue={season.ends_on}
          className="h-10"
        />
      </label>
      <Button type="submit" variant="outline" disabled={pending} className="h-10">
        {pending ? "Saving…" : "Save"}
      </Button>
      {state.error ? (
        <p className="text-xs text-destructive sm:col-span-4">{state.error}</p>
      ) : null}
    </form>
  );
}
