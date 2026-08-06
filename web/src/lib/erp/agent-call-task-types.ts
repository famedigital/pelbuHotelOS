/** Shared agent call-task types — safe for Client Components (no server-only). */

export type AgentCallTaskStatus = "open" | "done" | "cancelled";
export type AgentCallItemStatus = "pending" | "completed";
export type AgentCallOutcome = "confirm" | "cancel" | "void";

export type AgentCallTaskRow = {
  id: string;
  title: string;
  due_date: string;
  notes: string | null;
  status: AgentCallTaskStatus;
  created_at: string;
  item_total: number;
  item_done: number;
  item_pending: number;
};

export type AgentCallTaskItemRow = {
  id: string;
  task_id: string;
  agent_id: string;
  company_name: string;
  contact_phone: string | null;
  contact_email: string | null;
  booking_count: number;
  rooms_sold: number;
  call_status: AgentCallItemStatus;
  outcome: AgentCallOutcome | null;
  remarks: string | null;
  called_at: string | null;
  sort_order: number;
};
