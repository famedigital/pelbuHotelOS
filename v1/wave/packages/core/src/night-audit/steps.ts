/** Shared night-audit pipeline shapes (client + server safe). */

export const NIGHT_AUDIT_STEP_IDS = [
  "guard",
  "occupancy",
  "day_money",
  "room_nights",
  "no_shows",
  "blockers",
  "save",
  "backup",
] as const;

export type NightAuditStepId = (typeof NIGHT_AUDIT_STEP_IDS)[number];

export type NightAuditStepStatus =
  | "pending"
  | "running"
  | "done"
  | "skipped"
  | "failed";

export type NightAuditPipelineStep = {
  id: NightAuditStepId;
  label: string;
  status: NightAuditStepStatus;
  detail?: string;
};

export type NightAuditStepEvent = {
  id: NightAuditStepId;
  label: string;
  status: Exclude<NightAuditStepStatus, "pending">;
  detail?: string;
};

export const NIGHT_AUDIT_STEP_LABELS: Record<NightAuditStepId, string> = {
  guard: "Not already closed for date",
  occupancy: "Snapshot in-house occupancy",
  day_money: "Day charges & payments",
  room_nights: "Post room nights",
  no_shows: "Mark no-shows",
  blockers: "Close-day checks",
  save: "Save audit record",
  backup: "Hotel backup pack",
};

/** Initial pipeline UI (all pending). */
export function initialNightAuditPipeline(): NightAuditPipelineStep[] {
  return NIGHT_AUDIT_STEP_IDS.map((id) => ({
    id,
    label: NIGHT_AUDIT_STEP_LABELS[id],
    status: "pending" as const,
  }));
}

export function applyPipelineStep(
  pipeline: NightAuditPipelineStep[],
  event: NightAuditStepEvent,
): NightAuditPipelineStep[] {
  return pipeline.map((s) =>
    s.id === event.id
      ? {
          ...s,
          status: event.status,
          detail: event.detail !== undefined ? event.detail : s.detail,
        }
      : s,
  );
}
