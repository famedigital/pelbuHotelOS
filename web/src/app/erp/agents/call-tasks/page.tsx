import { CreateAgentCallTaskForm } from "@/components/erp/CreateAgentCallTaskForm";
import { DeskEmptyState } from "@/components/erp/DeskEmptyState";
import { DeskListShell } from "@/components/erp/DeskListShell";
import { DeskMetricRow } from "@/components/erp/DeskMetricRow";
import { Button } from "@/components/ui/button";
import {
  getDeskRole,
  isDeskAuthenticated,
  type DeskRole,
} from "@/lib/desk-auth";
import { requireDeskPropertyId } from "@/lib/desk-property";
import { listAgentCallTasks } from "@/lib/erp/agent-call-tasks";
import { thimphuToday } from "@/lib/erp-lists";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Agent call tasks | Hotel OS",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

function addMonths(iso: string, n: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + n);
  return d.toISOString().slice(0, 10);
}

function canCreate(role: DeskRole | null): boolean {
  return role === "owner" || role === "gm";
}

export default async function AgentCallTasksPage() {
  if (!(await isDeskAuthenticated())) redirect("/erp/login");

  const role = await getDeskRole();
  const admin = createSupabaseAdminClient();
  const propertyId = await requireDeskPropertyId();
  const today = thimphuToday();

  const openTasks = await listAgentCallTasks(admin, propertyId, {
    status: "open",
  });
  const dueToday = openTasks.filter((t) => t.due_date <= today);
  const pendingCalls = openTasks.reduce((n, t) => n + t.item_pending, 0);

  return (
    <DeskListShell
      eyebrow="Channels · Agents"
      heading="Agent call tasks"
      blurb="Owner/GM schedule future call-downs. Front desk works due lists: call each agent, pick confirm / cancel / void, and leave remarks."
      metrics={
        <DeskMetricRow
          metrics={[
            {
              label: "Open tasks",
              value: String(openTasks.length),
            },
            {
              label: "Due today or earlier",
              value: String(dueToday.length),
              tone: dueToday.length > 0 ? "destructive" : "default",
            },
            {
              label: "Agents left to call",
              value: String(pendingCalls),
            },
          ]}
        />
      }
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,20rem)]">
        <div className="space-y-3">
          <h2 className="text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
            {dueToday.length > 0 ? "Due for front desk" : "Open tasks"}
          </h2>
          {openTasks.length === 0 ? (
            <DeskEmptyState
              title="No open call tasks"
              description={
                canCreate(role)
                  ? "Create a task for a future due date — FO will see it on their dashboard."
                  : "Owner or GM will assign call-downs here."
              }
            />
          ) : (
            <ul className="space-y-2">
              {openTasks.map((t) => {
                const overdue = t.due_date < today;
                const dueNow = t.due_date <= today;
                return (
                  <li key={t.id}>
                    <Link
                      href={`/erp/agents/call-tasks/${t.id}`}
                      className="block rounded-xl border bg-card p-3 shadow-xs transition-colors hover:border-accent/40"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="font-semibold text-foreground">
                            {t.title}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Due {t.due_date}
                            {overdue ? " · overdue" : dueNow ? " · due" : ""}
                          </p>
                        </div>
                        <span className="rounded-md border bg-muted/40 px-2 py-0.5 text-xs tabular-nums">
                          {t.item_done}/{t.item_total} done
                        </span>
                      </div>
                      {t.notes ? (
                        <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                          {t.notes}
                        </p>
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
          <Button asChild variant="outline" size="sm">
            <Link href="/erp/agents/confirmed">Confirmed call list</Link>
          </Button>
        </div>

        {canCreate(role) ? (
          <CreateAgentCallTaskForm
            defaultDue={today}
            defaultStayFrom={today}
            defaultStayTo={addMonths(today, 3)}
          />
        ) : (
          <div className="rounded-xl border border-dashed bg-muted/20 p-4 text-sm text-muted-foreground">
            Only Owner and GM can create call tasks. Work open tasks from the
            list or your front desk dashboard.
          </div>
        )}
      </div>
    </DeskListShell>
  );
}
