import { AgentCallTaskWorkList } from "@/components/erp/AgentCallTaskWorkList";
import { DeskListShell } from "@/components/erp/DeskListShell";
import { DeskMetricRow } from "@/components/erp/DeskMetricRow";
import { Button } from "@/components/ui/button";
import { cancelAgentCallTask } from "@/app/actions/erp-agent-call-tasks";
import { getDeskRole, isDeskAuthenticated } from "@/lib/desk-auth";
import { requireDeskPropertyId } from "@/lib/desk-property";
import { loadAgentCallTaskDetail } from "@/lib/erp/agent-call-tasks";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Work call task",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function AgentCallTaskDetailPage({ params }: Props) {
  if (!(await isDeskAuthenticated())) redirect("/erp/login");
  const { id } = await params;
  const admin = createSupabaseAdminClient();
  const propertyId = await requireDeskPropertyId();
  const role = await getDeskRole();

  const detail = await loadAgentCallTaskDetail(admin, propertyId, id);
  if (!detail) notFound();

  const { task, items } = detail;
  const canCancel =
    (role === "owner" || role === "gm") && task.status === "open";

  async function cancelAction() {
    "use server";
    const fd = new FormData();
    fd.set("task_id", id);
    const result = await cancelAgentCallTask({ ok: true }, fd);
    if (result.ok) redirect("/erp/agents/call-tasks");
  }

  return (
    <DeskListShell
      eyebrow="Channels · Call tasks"
      heading={task.title}
      blurb={`Due ${task.due_date}${task.notes ? ` · ${task.notes}` : ""}`}
      headerAside={
        <Button asChild variant="outline" size="sm">
          <Link href="/erp/agents/call-tasks">All tasks</Link>
        </Button>
      }
      metrics={
        <DeskMetricRow
          metrics={[
            {
              label: "Status",
              value: task.status,
            },
            {
              label: "Called",
              value: `${task.item_done} / ${task.item_total}`,
            },
            {
              label: "Left",
              value: String(task.item_pending),
              tone: task.item_pending > 0 ? "destructive" : "accent",
            },
          ]}
        />
      }
    >
      {task.status === "open" ? (
        <AgentCallTaskWorkList items={items} />
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            This task is <span className="font-medium">{task.status}</span>.
            Call outcomes below are read-only.
          </p>
          <AgentCallTaskWorkList items={items} readOnly />
        </div>
      )}

      {canCancel ? (
        <form action={cancelAction} className="mt-6 border-t pt-4">
          <Button type="submit" variant="outline" size="sm">
            Cancel this task
          </Button>
        </form>
      ) : null}
    </DeskListShell>
  );
}
