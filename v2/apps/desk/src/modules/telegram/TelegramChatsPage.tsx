import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button, EmptyState, KpiCard } from "@hos-v2/ui";
import {
  hermesBindTopic,
  hermesListChats,
  hermesListStaffLinks,
  hermesListTopics,
  hermesRevokeChat,
  hermesTestChat,
  type HermesChat,
  type HermesStaffLink,
  type HermesTopic,
} from "../../lib/hermes-remote";
import { useTelegramOverview } from "./telegram-context";

const TOPIC_KINDS = [
  "front_office",
  "housekeeping",
  "kitchen_pos",
  "management_audit",
  "guides_drivers",
] as const;

export function TelegramChatsPage() {
  const { refresh } = useTelegramOverview();
  const [chats, setChats] = useState<HermesChat[]>([]);
  const [links, setLinks] = useState<HermesStaffLink[]>([]);
  const [topics, setTopics] = useState<HermesTopic[]>([]);
  const [bindChatId, setBindChatId] = useState("");
  const [bindThreadId, setBindThreadId] = useState("");
  const [bindKind, setBindKind] =
    useState<(typeof TOPIC_KINDS)[number]>("front_office");

  const load = useCallback(async () => {
    const [c, s, t] = await Promise.all([
      hermesListChats(),
      hermesListStaffLinks(),
      hermesListTopics(),
    ]);
    if (c.ok) setChats(c.data.chats);
    else toast.error(c.error);
    if (s.ok) setLinks(s.data.links);
    if (t.ok) setTopics(t.data.topics);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const active = chats.filter((c) => c.status === "active");

  return (
    <div className="grid gap-4" data-testid="hermes-chats">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <KpiCard label="Active" value={String(active.length)} />
        <KpiCard label="Staff links" value={String(links.length)} />
        <KpiCard label="Topics" value={String(topics.length)} />
      </div>

      <ul className="m-0 grid list-none gap-2 p-0">
        {active.length === 0 ? (
          <EmptyState
            title="No active chats"
            description="Use Pair… to mint a deep link for FO, HK, Kitchen, or Agent."
          />
        ) : (
          active.map((c) => (
            <li
              key={c.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--hos-line)] bg-[var(--hos-cell)] px-3 py-2.5"
            >
              <div className="min-w-0">
                <div className="font-semibold text-[var(--hos-ink)]">
                  {c.displayName || `Chat ${c.chatId}`}
                </div>
                <div className="text-[11px] text-[var(--hos-ink-3)]">
                  {c.role}
                  {c.agentId ? ` · agent ${c.agentId}` : ""} · paired{" "}
                  {new Date(c.pairedAt).toLocaleString()}
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <Button
                  size="sm"
                  variant="secondary"
                  className="!rounded-full"
                  onClick={() => {
                    void hermesTestChat(c.id).then((res) => {
                      if (!res.ok) toast.error(res.error);
                      else if (!res.data.delivered)
                        toast.message("Logged locally (bot offline)", {
                          description: res.data.error,
                        });
                      else toast.success("Test sent");
                    });
                  }}
                >
                  Test
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="!rounded-full text-[var(--hos-ruby)]"
                  onClick={() => {
                    void (async () => {
                      const res = await hermesRevokeChat(c.id);
                      if (!res.ok) toast.error(res.error);
                      else {
                        toast.success("Chat revoked");
                        await load();
                        await refresh();
                      }
                    })();
                  }}
                >
                  Revoke
                </Button>
              </div>
            </li>
          ))
        )}
      </ul>

      <section className="rounded-xl border border-[var(--hos-line)] bg-[var(--hos-cell)] p-3">
        <strong className="text-sm text-[var(--hos-ink)]">Bind forum topic</strong>
        <p className="m-0 mt-1 text-[12px] text-[var(--hos-ink-3)]">
          Supergroup thread_id for Print Studio / ops routing.
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          <select
            className="hos-input !min-h-9 !text-[12px]"
            value={bindChatId}
            onChange={(e) => setBindChatId(e.target.value)}
          >
            <option value="">Chat…</option>
            {active.map((c) => (
              <option key={c.id} value={String(c.chatId)}>
                {c.displayName || c.chatId} · {c.role}
              </option>
            ))}
          </select>
          <input
            className="hos-input !min-h-9 w-28 !text-[12px]"
            placeholder="thread id"
            value={bindThreadId}
            onChange={(e) => setBindThreadId(e.target.value)}
          />
          <select
            className="hos-input !min-h-9 !text-[12px]"
            value={bindKind}
            onChange={(e) =>
              setBindKind(e.target.value as (typeof TOPIC_KINDS)[number])
            }
          >
            {TOPIC_KINDS.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
          <Button
            size="sm"
            className="!rounded-full"
            onClick={() => {
              const chatId = Number(bindChatId);
              const threadId = Number(bindThreadId);
              if (!Number.isFinite(chatId) || !Number.isFinite(threadId)) {
                toast.error("Chat and thread id required");
                return;
              }
              void hermesBindTopic({ chatId, threadId, kind: bindKind }).then(
                async (res) => {
                  if (!res.ok) toast.error(res.error);
                  else {
                    toast.success("Topic bound");
                    await load();
                  }
                },
              );
            }}
          >
            Bind
          </Button>
        </div>
        {topics.length > 0 ? (
          <ul className="mt-2 space-y-1 text-[11px] text-[var(--hos-ink-2)]">
            {topics.map((t) => (
              <li key={t.id}>
                {t.kind} · chat {t.chatId} · thread {t.threadId}
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      {links.length > 0 ? (
        <section className="rounded-xl border border-[var(--hos-line)] bg-[var(--hos-cell)] p-3">
          <strong className="text-sm text-[var(--hos-ink)]">Staff links</strong>
          <ul className="mt-2 space-y-1 text-[12px] text-[var(--hos-ink-2)]">
            {links.map((l) => (
              <li key={l.id}>
                {l.staffName} · {l.role} · tg {l.tgUserId}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
