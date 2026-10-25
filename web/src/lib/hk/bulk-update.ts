const HK_STATUSES = new Set(["open", "in_progress", "done", "skipped"]);

export type HkBulkStaff = "keep" | "clear" | { id: string };
export type HkBulkStatus = "keep" | "open" | "in_progress" | "done" | "skipped";

export type HkBulkChoice = {
  staff: HkBulkStaff;
  status: HkBulkStatus;
  /** Null leaves existing notes alone. A string replaces them. */
  notes: string | null;
};

export type HkBulkWrite = {
  staff_id?: string | null;
  status?: string;
  notes?: string | null;
  markComplete: boolean;
};

export function parseBulkHkChoice(input: {
  staffChoice: string;
  statusChoice: string;
  notes: string;
}): HkBulkChoice {
  const staffRaw = input.staffChoice.trim();
  const statusRaw = input.statusChoice.trim() || "keep";
  const notesRaw = input.notes.trim();

  let staff: HkBulkStaff = "keep";
  if (staffRaw === "clear") staff = "clear";
  else if (staffRaw && staffRaw !== "keep") staff = { id: staffRaw };

  if (!HK_STATUSES.has(statusRaw) && statusRaw !== "keep") {
    throw new Error("Invalid status.");
  }

  return {
    staff,
    status: statusRaw as HkBulkStatus,
    notes: notesRaw ? notesRaw : null,
  };
}

export function bulkChoiceIsEmpty(choice: HkBulkChoice): boolean {
  return choice.staff === "keep" && choice.status === "keep" && choice.notes === null;
}

/** New assignment for a room that is still "needs assign". */
export function hkBulkInsert(choice: HkBulkChoice): HkBulkWrite {
  const staff_id =
    choice.staff === "keep" || choice.staff === "clear" ? null : choice.staff.id;
  const status =
    choice.status !== "keep"
      ? choice.status
      : staff_id
        ? "in_progress"
        : "open";
  return {
    staff_id,
    status,
    notes: choice.notes,
    markComplete: status === "done",
  };
}

/** Patch for a task that already has an assignment. Same choice for every task type. */
export function hkBulkPatch(
  existingStatus: string,
  choice: HkBulkChoice,
): HkBulkWrite | null {
  const patch: HkBulkWrite = { markComplete: false };

  if (choice.staff === "clear") patch.staff_id = null;
  else if (choice.staff !== "keep") patch.staff_id = choice.staff.id;

  if (choice.status !== "keep") {
    patch.status = choice.status;
    patch.markComplete = choice.status === "done";
  } else if (typeof choice.staff === "object") {
    if (existingStatus === "open" || existingStatus === "needs_assignment") {
      patch.status = "in_progress";
    }
  } else if (choice.staff === "clear" && existingStatus === "in_progress") {
    patch.status = "open";
  }

  if (choice.notes !== null) patch.notes = choice.notes;

  const hasField =
    "staff_id" in patch || patch.status !== undefined || "notes" in patch;
  return hasField ? patch : null;
}
