"use server";

import { writeAuditEvent } from "@/lib/audit";
import {
  isDeskAuthenticated,
  requireDeskRole,
} from "@/lib/desk-auth";
import { requireDeskPropertyId } from "@/lib/desk-property";
import { loadConfirmedAgentsContactList } from "@/lib/erp/confirmed-agents";
import { getStaffSession } from "@/lib/staff-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { optionalTrim, trimRequired } from "@/lib/validation";
import { revalidatePath } from "next/cache";

export type AgentCallActionState = { ok: boolean; error?: string; taskId?: string };

async function requireDesk() {
  if (!(await isDeskAuthenticated())) {
    throw new Error("Desk session expired. Sign in again.");
  }
}

function revalidateCallPaths(taskId?: string) {
  revalidatePath("/erp");
  revalidatePath("/erp/agents/call-tasks");
  revalidatePath("/erp/agents/confirmed");
  if (taskId) revalidatePath(`/erp/agents/call-tasks/${taskId}`);
}

/**
 * Owner/GM: create a call task for a future due date, prefilled from confirmed agents.
 */
export async function createAgentCallTask(
  _prev: AgentCallActionState,
  formData: FormData,
): Promise<AgentCallActionState> {
  try {
    await requireDeskRole(["owner", "gm"]);
    const admin = createSupabaseAdminClient();
    const propertyId = await requireDeskPropertyId();
    const staff = await getStaffSession();

    const title = trimRequired(formData.get("title"), "Title");
    const dueDate = trimRequired(formData.get("due_date"), "Due date");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
      throw new Error("Invalid due date.");
    }
    const notes = optionalTrim(formData.get("notes"));
    const stayFrom =
      optionalTrim(formData.get("stay_from")) ?? dueDate;
    const stayTo = optionalTrim(formData.get("stay_to"));
    if (!stayTo || !/^\d{4}-\d{2}-\d{2}$/.test(stayTo)) {
      throw new Error("Stay window end date required (agents with rooms in this range).");
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(stayFrom)) {
      throw new Error("Invalid stay-from date.");
    }

    // exclusive end for loader
    const endExclusive = (() => {
      const d = new Date(`${stayTo}T12:00:00Z`);
      d.setUTCDate(d.getUTCDate() + 1);
      return d.toISOString().slice(0, 10);
    })();

    const agents = await loadConfirmedAgentsContactList(admin, {
      propertyId,
      from: stayFrom,
      to: endExclusive,
      includeCheckedIn: true,
    });

    if (agents.length === 0) {
      throw new Error(
        "No agents with confirmed rooms in that stay window. Widen dates or import bookings first.",
      );
    }

    const { data: task, error: tErr } = await admin
      .from("agent_call_tasks")
      .insert({
        property_id: propertyId,
        title,
        due_date: dueDate,
        notes: notes || null,
        status: "open",
        created_by_staff_id:
          staff && staff.propertyId === propertyId ? staff.staffId : null,
      })
      .select("id")
      .single();

    if (tErr || !task) throw new Error(tErr?.message ?? "Could not create task.");

    const itemRows = agents.map((a, i) => ({
      task_id: task.id as string,
      property_id: propertyId,
      agent_id: a.agent_id,
      company_name_snapshot: a.company_name,
      contact_phone_snapshot: a.contact_phone,
      contact_email_snapshot: a.contact_email,
      booking_count: a.booking_count,
      rooms_sold: a.rooms_sold,
      sort_order: i,
      call_status: "pending",
    }));

    const { error: iErr } = await admin
      .from("agent_call_task_items")
      .insert(itemRows);
    if (iErr) throw new Error(iErr.message);

    await writeAuditEvent(admin, {
      propertyId,
      action: "agent_call_task.create",
      entityType: "agent_call_tasks",
      entityId: task.id as string,
      summary: `Call task · ${title} · due ${dueDate} · ${agents.length} agents`,
      meta: { dueDate, agentCount: agents.length },
    });

    revalidateCallPaths(task.id as string);
    return { ok: true, taskId: task.id as string };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Could not create call task.",
    };
  }
}

/**
 * FO (or owner/gm): complete a call line with confirm | cancel | void + remarks.
 */
export async function completeAgentCallTaskItem(
  _prev: AgentCallActionState,
  formData: FormData,
): Promise<AgentCallActionState> {
  try {
    await requireDesk();
    await requireDeskRole(["owner", "gm", "front_desk"]);
    const admin = createSupabaseAdminClient();
    const propertyId = await requireDeskPropertyId();
    const staff = await getStaffSession();

    const itemId = trimRequired(formData.get("item_id"), "Call line");
    const outcome = trimRequired(formData.get("outcome"), "Outcome");
    if (!["confirm", "cancel", "void"].includes(outcome)) {
      throw new Error("Outcome must be confirm, cancel, or void.");
    }
    const remarks = trimRequired(formData.get("remarks"), "Remarks");

    const { data: item, error: findErr } = await admin
      .from("agent_call_task_items")
      .select("id, task_id, company_name_snapshot, call_status")
      .eq("id", itemId)
      .eq("property_id", propertyId)
      .maybeSingle();
    if (findErr || !item) throw new Error("Call line not found.");
    if (item.call_status === "completed") {
      throw new Error("Already ticked off.");
    }

    const { data: taskRow } = await admin
      .from("agent_call_tasks")
      .select("status")
      .eq("id", item.task_id as string)
      .eq("property_id", propertyId)
      .maybeSingle();
    if (!taskRow || taskRow.status !== "open") {
      throw new Error("Task is closed — cannot tick off lines.");
    }

    const { error: upErr } = await admin
      .from("agent_call_task_items")
      .update({
        call_status: "completed",
        outcome,
        remarks: remarks || null,
        called_at: new Date().toISOString(),
        called_by_staff_id:
          staff && staff.propertyId === propertyId ? staff.staffId : null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", itemId)
      .eq("property_id", propertyId);

    if (upErr) throw new Error(upErr.message);

    const taskId = item.task_id as string;

    // Auto-close task when all items done
    const { count: pending } = await admin
      .from("agent_call_task_items")
      .select("id", { count: "exact", head: true })
      .eq("task_id", taskId)
      .eq("call_status", "pending");

    if ((pending ?? 0) === 0) {
      await admin
        .from("agent_call_tasks")
        .update({ status: "done", updated_at: new Date().toISOString() })
        .eq("id", taskId)
        .eq("property_id", propertyId);
    }

    await writeAuditEvent(admin, {
      propertyId,
      action: "agent_call_task.item_complete",
      entityType: "agent_call_task_items",
      entityId: itemId,
      summary: `${item.company_name_snapshot} · ${outcome}${remarks ? ` · ${remarks.slice(0, 80)}` : ""}`,
      meta: { outcome, taskId },
    });

    revalidateCallPaths(taskId);
    return { ok: true, taskId };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Could not save call result.",
    };
  }
}

export async function cancelAgentCallTask(
  _prev: AgentCallActionState,
  formData: FormData,
): Promise<AgentCallActionState> {
  try {
    await requireDeskRole(["owner", "gm"]);
    const admin = createSupabaseAdminClient();
    const propertyId = await requireDeskPropertyId();
    const taskId = trimRequired(formData.get("task_id"), "Task");

    const { error } = await admin
      .from("agent_call_tasks")
      .update({ status: "cancelled", updated_at: new Date().toISOString() })
      .eq("id", taskId)
      .eq("property_id", propertyId);

    if (error) throw new Error(error.message);

    await writeAuditEvent(admin, {
      propertyId,
      action: "agent_call_task.cancel",
      entityType: "agent_call_tasks",
      entityId: taskId,
      summary: "Call task cancelled",
    });

    revalidateCallPaths(taskId);
    return { ok: true, taskId };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Could not cancel task.",
    };
  }
}
