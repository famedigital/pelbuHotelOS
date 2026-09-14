"use client";

import {
  markApplicationStatus,
  updateVacancyStatus,
  upsertJobVacancy,
  type VacancyActionState,
} from "@/app/actions/erp-vacancies";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useActionToast } from "@/hooks/use-action-toast";
import { useRouter } from "next/navigation";
import { useActionState, useEffect } from "react";

const selectClass =
  "flex h-11 w-full min-h-11 rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]";

const initial: VacancyActionState = { ok: false };

export type PositionOption = {
  id: string;
  title: string;
  department: string;
  isActive: boolean;
};

function ActionResult({ state }: { state: VacancyActionState }) {
  if (!state.error && !state.message) return null;
  return (
    <p
      className={`text-sm ${state.ok ? "text-citrus" : "text-destructive"}`}
      role="status"
    >
      {state.error ?? state.message}
    </p>
  );
}

export function VacancyCreateForm({
  positions,
}: {
  positions: PositionOption[];
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState(upsertJobVacancy, initial);
  useActionToast(state, { successMessage: "Vacancy saved" });
  useEffect(() => {
    if (state.ok) router.refresh();
  }, [state.ok, router]);

  const active = positions.filter((p) => p.isActive);

  if (active.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Create an active position first (Team → Positions), then open a
        vacancy here.
      </p>
    );
  }

  return (
    <form action={action} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="space-y-1.5 sm:col-span-2 lg:col-span-1">
          <Label htmlFor="vac_pos">Position</Label>
          <select
            id="vac_pos"
            name="position_id"
            required
            className={selectClass}
            defaultValue={active[0]?.id}
          >
            {active.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title} · {p.department}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="vac_hc">Headcount</Label>
          <Input
            id="vac_hc"
            name="headcount"
            type="number"
            min={1}
            max={99}
            defaultValue={1}
            className="min-h-11"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="vac_status">Status</Label>
          <select
            id="vac_status"
            name="status"
            className={selectClass}
            defaultValue="open"
          >
            <option value="draft">Draft</option>
            <option value="open">Open</option>
            <option value="filled">Filled</option>
            <option value="closed">Closed</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="vac_min">Salary min (Nu)</Label>
          <Input
            id="vac_min"
            name="salary_min_btn"
            type="number"
            min={0}
            step="0.01"
            className="min-h-11"
            placeholder="Optional"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="vac_max">Salary max (Nu)</Label>
          <Input
            id="vac_max"
            name="salary_max_btn"
            type="number"
            min={0}
            step="0.01"
            className="min-h-11"
            placeholder="Optional"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="vac_sal_note">Salary note</Label>
          <Input
            id="vac_sal_note"
            name="salary_note"
            className="min-h-11"
            placeholder="plus tip / SC"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="vac_open">Opens on</Label>
          <Input id="vac_open" name="opens_on" type="date" className="min-h-11" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="vac_close">Closes on</Label>
          <Input
            id="vac_close"
            name="closes_on"
            type="date"
            className="min-h-11"
          />
        </div>
        <div className="space-y-1.5 sm:col-span-2 lg:col-span-3">
          <Label htmlFor="vac_note">Posting note</Label>
          <Textarea
            id="vac_note"
            name="posting_note"
            rows={2}
            placeholder="Shift details, start date, language need…"
          />
        </div>
        <label className="flex min-h-11 items-start gap-3 rounded-md border bg-background px-3 py-3 text-sm sm:col-span-2">
          <input
            type="checkbox"
            name="publish_public"
            className="mt-1 size-4 rounded border"
          />
          <span>
            <span className="font-medium">Publish on /careers</span>
            <span className="mt-1 block text-xs text-muted-foreground">
              Only when status is Open.
            </span>
          </span>
        </label>
        <label className="flex min-h-11 items-start gap-3 rounded-md border bg-background px-3 py-3 text-sm">
          <input
            type="checkbox"
            name="show_salary_public"
            className="mt-1 size-4 rounded border"
          />
          <span className="font-medium">Show salary range on careers</span>
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending} className="min-h-11">
          {pending ? "Saving…" : "Create vacancy"}
        </Button>
        <ActionResult state={state} />
      </div>
    </form>
  );
}

export function VacancyStatusButtons({
  vacancyId,
  current,
}: {
  vacancyId: string;
  current: string;
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState(updateVacancyStatus, initial);
  useActionToast(state, { successMessage: "Status updated" });
  useEffect(() => {
    if (state.ok) router.refresh();
  }, [state.ok, router]);

  const options = [
    { value: "open", label: "Open" },
    { value: "filled", label: "Filled" },
    { value: "closed", label: "Closed" },
    { value: "draft", label: "Draft" },
  ] as const;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {options.map((opt) => (
        <form key={opt.value} action={action}>
          <input type="hidden" name="id" value={vacancyId} />
          <input type="hidden" name="status" value={opt.value} />
          <Button
            type="submit"
            size="sm"
            variant={current === opt.value ? "default" : "outline"}
            className="h-9"
            disabled={pending || current === opt.value}
          >
            {opt.label}
          </Button>
        </form>
      ))}
      <ActionResult state={state} />
    </div>
  );
}

export function ApplicationStatusForm({
  applicationId,
  current,
}: {
  applicationId: string;
  current: string;
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState(markApplicationStatus, initial);
  useActionToast(state, { successMessage: "Application updated" });
  useEffect(() => {
    if (state.ok) router.refresh();
  }, [state.ok, router]);

  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="id" value={applicationId} />
      <select
        name="status"
        defaultValue={current}
        className="h-9 rounded-md border border-input bg-background px-2 text-xs"
        disabled={pending}
      >
        <option value="new">New</option>
        <option value="reviewed">Reviewed</option>
        <option value="shortlisted">Shortlisted</option>
        <option value="rejected">Rejected</option>
        <option value="hired">Hired</option>
      </select>
      <Button type="submit" size="sm" className="h-9" disabled={pending}>
        {pending ? "…" : "Update"}
      </Button>
    </form>
  );
}
