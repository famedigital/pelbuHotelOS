"use server";

import { writeAuditEvent } from "@/lib/audit";
import { isDeskAuthenticated } from "@/lib/desk-auth";
import { requireDeskPropertyId } from "@/lib/desk-property";
import { isInhouseTaskKind } from "@/lib/inhouse-task-kinds";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { optionalTrim, trimRequired } from "@/lib/validation";
import { revalidatePath } from "next/cache";

export type InhouseTaskState = {
  ok: boolean;
  error?: string;
  taskId?: string;
};

const initialOk = { ok: true } as const;

async function requireDesk() {
  if (!(await isDeskAuthenticated())) {
    throw new Error("Desk session expired. Sign in again.");
  }
}

export async function createInhouseTask(
  _prev: InhouseTaskState,
  formData: FormData,
): Promise<InhouseTaskState> {
  try {
    await requireDesk();
    const admin = createSupabaseAdminClient();
    const propertyId = await requireDeskPropertyId();

    const bookingId = optionalTrim(formData.get("booking_id"));
    const dueAtRaw = trimRequired(formData.get("due_at"), "Due time");
    const kind = optionalTrim(formData.get("kind")) ?? "wake_up";
    if (!isInhouseTaskKind(kind)) {
      throw new Error("Invalid request kind.");
    }
    const notes = optionalTrim(formData.get("notes"));

    const dueAt = new Date(dueAtRaw);
    if (Number.isNaN(dueAt.getTime())) {
      throw new Error("Invalid due time.");
    }

    if (bookingId) {
      const { data: booking } = await admin
        .from("bookings")
        .select("id")
        .eq("id", bookingId)
        .eq("property_id", propertyId)
        .maybeSingle();
      if (!booking) throw new Error("Booking not found for this property.");
    }

    const { data, error } = await admin
      .from("inhouse_tasks")
      .insert({
        property_id: propertyId,
        booking_id: bookingId,
        due_at: dueAt.toISOString(),
        kind,
        notes,
        created_by: "desk",
      })
      .select("id")
      .single();

    if (error || !data) {
      throw new Error(error?.message ?? "Could not create task.");
    }

    await writeAuditEvent(admin, {
      propertyId,
      action: "inhouse_task.create",
      entityType: "inhouse_tasks",
      entityId: data.id as string,
      summary: `Scheduled ${kind.replace(/_/g, " ")}`,
      meta: { bookingId, dueAt: dueAt.toISOString() },
    });

    revalidatePath("/erp/in-house");
    revalidatePath("/erp/calendar");
    revalidatePath("/erp/reservations");
    return { ok: true, taskId: data.id as string };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Something went wrong.",
    };
  }
}

export async function completeInhouseTask(
  _prev: InhouseTaskState,
  formData: FormData,
): Promise<InhouseTaskState> {
  try {
    await requireDesk();
    const admin = createSupabaseAdminClient();
    const propertyId = await requireDeskPropertyId();
    const taskId = trimRequired(formData.get("task_id"), "Task");

    const { error } = await admin
      .from("inhouse_tasks")
      .update({ done_at: new Date().toISOString() })
      .eq("id", taskId)
      .eq("property_id", propertyId)
      .is("done_at", null);

    if (error) throw new Error(error.message);

    revalidatePath("/erp/in-house");
    revalidatePath("/erp/calendar");
    return { ...initialOk, taskId };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Something went wrong.",
    };
  }
}
