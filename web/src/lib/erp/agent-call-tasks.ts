import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  AgentCallItemStatus,
  AgentCallOutcome,
  AgentCallTaskItemRow,
  AgentCallTaskRow,
  AgentCallTaskStatus,
} from "@/lib/erp/agent-call-task-types";

export type {
  AgentCallItemStatus,
  AgentCallOutcome,
  AgentCallTaskItemRow,
  AgentCallTaskRow,
  AgentCallTaskStatus,
} from "@/lib/erp/agent-call-task-types";

export async function listAgentCallTasks(
  admin: SupabaseClient,
  propertyId: string,
  opts?: { dueOnOrBefore?: string; status?: AgentCallTaskStatus | "all" },
): Promise<AgentCallTaskRow[]> {
  let q = admin
    .from("agent_call_tasks")
    .select("id, title, due_date, notes, status, created_at")
    .eq("property_id", propertyId)
    .order("due_date", { ascending: true })
    .limit(100);

  if (opts?.status && opts.status !== "all") {
    q = q.eq("status", opts.status);
  }
  if (opts?.dueOnOrBefore) {
    q = q.lte("due_date", opts.dueOnOrBefore);
  }

  const { data: tasks, error } = await q;
  if (error) throw new Error(error.message);
  if (!tasks?.length) return [];

  const ids = tasks.map((t) => t.id as string);
  const { data: items } = await admin
    .from("agent_call_task_items")
    .select("task_id, call_status")
    .in("task_id", ids);

  const counts = new Map<string, { total: number; done: number }>();
  for (const it of items ?? []) {
    const tid = it.task_id as string;
    const c = counts.get(tid) ?? { total: 0, done: 0 };
    c.total += 1;
    if (it.call_status === "completed") c.done += 1;
    counts.set(tid, c);
  }

  return tasks.map((t) => {
    const c = counts.get(t.id as string) ?? { total: 0, done: 0 };
    return {
      id: t.id as string,
      title: t.title as string,
      due_date: t.due_date as string,
      notes: (t.notes as string | null) ?? null,
      status: t.status as AgentCallTaskStatus,
      created_at: t.created_at as string,
      item_total: c.total,
      item_done: c.done,
      item_pending: Math.max(0, c.total - c.done),
    };
  });
}

export async function loadAgentCallTaskDetail(
  admin: SupabaseClient,
  propertyId: string,
  taskId: string,
): Promise<{
  task: AgentCallTaskRow & { notes: string | null };
  items: AgentCallTaskItemRow[];
} | null> {
  const { data: task, error } = await admin
    .from("agent_call_tasks")
    .select("id, title, due_date, notes, status, created_at")
    .eq("id", taskId)
    .eq("property_id", propertyId)
    .maybeSingle();
  if (error || !task) return null;

  const { data: items } = await admin
    .from("agent_call_task_items")
    .select(
      `id, task_id, agent_id, company_name_snapshot, contact_phone_snapshot,
       contact_email_snapshot, booking_count, rooms_sold, sort_order,
       call_status, outcome, remarks, called_at`,
    )
    .eq("task_id", taskId)
    .eq("property_id", propertyId)
    .order("sort_order")
    .order("company_name_snapshot");

  const mappedItems: AgentCallTaskItemRow[] = (items ?? []).map((it) => ({
    id: it.id as string,
    task_id: it.task_id as string,
    agent_id: it.agent_id as string,
    company_name: it.company_name_snapshot as string,
    contact_phone: (it.contact_phone_snapshot as string | null) ?? null,
    contact_email: (it.contact_email_snapshot as string | null) ?? null,
    booking_count: Number(it.booking_count ?? 0),
    rooms_sold: Number(it.rooms_sold ?? 0),
    call_status: it.call_status as AgentCallItemStatus,
    outcome: (it.outcome as AgentCallOutcome | null) ?? null,
    remarks: (it.remarks as string | null) ?? null,
    called_at: (it.called_at as string | null) ?? null,
    sort_order: Number(it.sort_order ?? 0),
  }));

  const done = mappedItems.filter((i) => i.call_status === "completed").length;
  return {
    task: {
      id: task.id as string,
      title: task.title as string,
      due_date: task.due_date as string,
      notes: (task.notes as string | null) ?? null,
      status: task.status as AgentCallTaskStatus,
      created_at: task.created_at as string,
      item_total: mappedItems.length,
      item_done: done,
      item_pending: mappedItems.length - done,
    },
    items: mappedItems,
  };
}

export async function countOpenCallItemsDueToday(
  admin: SupabaseClient,
  propertyId: string,
  today: string,
): Promise<{ tasksDue: number; pendingCalls: number }> {
  const { data: tasks } = await admin
    .from("agent_call_tasks")
    .select("id")
    .eq("property_id", propertyId)
    .eq("status", "open")
    .lte("due_date", today);

  const ids = (tasks ?? []).map((t) => t.id as string);
  if (ids.length === 0) return { tasksDue: 0, pendingCalls: 0 };

  const { count } = await admin
    .from("agent_call_task_items")
    .select("id", { count: "exact", head: true })
    .in("task_id", ids)
    .eq("call_status", "pending");

  return {
    tasksDue: ids.length,
    pendingCalls: count ?? 0,
  };
}
