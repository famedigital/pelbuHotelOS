import { EmptyState } from "@/components/ui/empty-state";
import { loadHermesFleet } from "@/lib/platform/admin-data";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Hermes Fleet",
  robots: { index: false, follow: false },
};

export default async function AdminHermesFleetPage() {
  const { chats, topics, staff, available, error } = await loadHermesFleet();
  const active = chats.filter((c) => c.status === "active").length;
  const agentChats = chats.filter((c) => c.role === "agent").length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Hermes Fleet</h1>
        <p className="text-sm text-muted-foreground">
          Read-only national view of Telegram pairings, forum topics, and staff ACL. Money never
          mutates from Telegram — desk Hermes owns the bot UX.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border bg-card p-4">
          <p className="text-xs uppercase text-muted-foreground">Active chats</p>
          <p className="mt-1 text-2xl font-semibold">{available ? active : "—"}</p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <p className="text-xs uppercase text-muted-foreground">Agent chats</p>
          <p className="mt-1 text-2xl font-semibold">{available ? agentChats : "—"}</p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <p className="text-xs uppercase text-muted-foreground">Topics bound</p>
          <p className="mt-1 text-2xl font-semibold">{available ? topics.length : "—"}</p>
        </div>
      </div>

      {!available ? (
        <EmptyState
          title="Hermes schema not reachable"
          description={
            error ??
            "Apply v2 migrations 0008_telegram_hermes and 0009_hermes_ops_acl, then refresh."
          }
        />
      ) : (
        <>
          <section className="space-y-3">
            <h2 className="text-lg font-medium">Paired chats ({chats.length})</h2>
            {chats.length === 0 ? (
              <EmptyState
                title="No paired chats"
                description="Pair a property Telegram group from desk → Hermes (/telegram)."
              />
            ) : (
              <div className="overflow-x-auto rounded-xl border">
                <table className="w-full text-left text-sm">
                  <thead className="border-b bg-muted/40">
                    <tr>
                      <th className="px-3 py-2">Property</th>
                      <th className="px-3 py-2">Role</th>
                      <th className="px-3 py-2">Type</th>
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2">Chat</th>
                      <th className="px-3 py-2">Agent</th>
                      <th className="px-3 py-2">Last seen</th>
                    </tr>
                  </thead>
                  <tbody>
                    {chats.map((c) => (
                      <tr key={c.id} className="border-b last:border-0">
                        <td className="px-3 py-2">{c.propertyName}</td>
                        <td className="px-3 py-2 font-mono text-xs">{c.role}</td>
                        <td className="px-3 py-2 text-xs">{c.chatType}</td>
                        <td className="px-3 py-2 text-xs">{c.status}</td>
                        <td className="px-3 py-2 font-mono text-xs">
                          {c.displayName ?? c.chatId}
                        </td>
                        <td className="px-3 py-2 font-mono text-xs">
                          {c.agentId ?? "—"}
                        </td>
                        <td className="px-3 py-2 text-xs text-muted-foreground">
                          {c.lastSeenAt
                            ? new Date(c.lastSeenAt).toLocaleString()
                            : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-medium">Forum topics ({topics.length})</h2>
            {topics.length === 0 ? (
              <EmptyState
                title="No topics bound"
                description="Bind front_office / housekeeping / kitchen_pos / management_audit / guides_drivers from desk Hermes."
              />
            ) : (
              <div className="overflow-x-auto rounded-xl border">
                <table className="w-full text-left text-sm">
                  <thead className="border-b bg-muted/40">
                    <tr>
                      <th className="px-3 py-2">Property</th>
                      <th className="px-3 py-2">Kind</th>
                      <th className="px-3 py-2">Chat</th>
                      <th className="px-3 py-2">Thread</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topics.map((t) => (
                      <tr key={t.id} className="border-b last:border-0">
                        <td className="px-3 py-2">{t.propertyName}</td>
                        <td className="px-3 py-2 font-mono text-xs">{t.kind}</td>
                        <td className="px-3 py-2 font-mono text-xs">{t.chatId}</td>
                        <td className="px-3 py-2 font-mono text-xs">{t.threadId}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-medium">Staff links ({staff.length})</h2>
            {staff.length === 0 ? (
              <EmptyState
                title="No staff Telegram links"
                description="Link tg_user_id ↔ staff role (fo|hk|kitchen|manager|gm) from desk."
              />
            ) : (
              <div className="overflow-x-auto rounded-xl border">
                <table className="w-full text-left text-sm">
                  <thead className="border-b bg-muted/40">
                    <tr>
                      <th className="px-3 py-2">Property</th>
                      <th className="px-3 py-2">Staff</th>
                      <th className="px-3 py-2">Role</th>
                      <th className="px-3 py-2">TG user</th>
                      <th className="px-3 py-2">Active</th>
                    </tr>
                  </thead>
                  <tbody>
                    {staff.map((s) => (
                      <tr key={s.id} className="border-b last:border-0">
                        <td className="px-3 py-2">{s.propertyName}</td>
                        <td className="px-3 py-2">{s.staffName}</td>
                        <td className="px-3 py-2 font-mono text-xs">{s.role}</td>
                        <td className="px-3 py-2 font-mono text-xs">{s.tgUserId}</td>
                        <td className="px-3 py-2 text-xs">{s.active ? "yes" : "no"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
