export const INHOUSE_TASK_KINDS = [
  { value: "wake_up", label: "Wake-up" },
  { value: "follow_up", label: "Follow-up" },
  { value: "guest_message", label: "Guest message" },
  { value: "callback", label: "Callback" },
  { value: "towels", label: "Extra towels" },
  { value: "extra_pillows", label: "Extra pillows" },
  { value: "extra_bed", label: "Extra bed" },
  { value: "minibar", label: "Minibar restock" },
  { value: "taxi", label: "Taxi / transfer" },
  { value: "housekeeping", label: "Housekeeping" },
  { value: "luggage", label: "Luggage hold" },
  { value: "turb", label: "Turb / special note" },
  { value: "other", label: "Other" },
] as const;

export type InhouseTaskKind = (typeof INHOUSE_TASK_KINDS)[number]["value"];

export function isInhouseTaskKind(value: string): value is InhouseTaskKind {
  return INHOUSE_TASK_KINDS.some((k) => k.value === value);
}

export function labelInhouseTaskKind(kind: string): string {
  return (
    INHOUSE_TASK_KINDS.find((k) => k.value === kind)?.label ??
    kind.replace(/_/g, " ")
  );
}
