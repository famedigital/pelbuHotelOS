"use client";

import {
  askInnoraDesk,
  runInnoraDeskAction,
  type InnoraChatTurn,
  type InnoraPendingAction,
} from "@/app/actions/erp-innora-chat";
import { Bubble, BubbleContent } from "@/components/ui/bubble";
import { Button } from "@/components/ui/button";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from "@/components/ui/input-group";
import { Message, MessageContent } from "@/components/ui/message";
import {
  MessageScroller,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@/components/ui/message-scroller";
import { ArrowUpIcon, HistoryIcon, SquarePenIcon, SparklesIcon, XIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type BubbleMessage = InnoraChatTurn & {
  id: string;
  action?: InnoraPendingAction | null;
  lines?: string[];
};

type Thread = {
  id: string;
  title: string;
  messages: BubbleMessage[];
  updatedAt: number;
};

const GREETING =
  "Ask for the desk job. Add an extra mattress, laundry, or a minibar item to an in-house bill, or open a page.";

function freshThread(): Thread {
  return {
    id: crypto.randomUUID(),
    title: "New chat",
    updatedAt: Date.now(),
    messages: [{ id: crypto.randomUUID(), role: "innora", text: GREETING }],
  };
}

function storageKey(propertyId: string) {
  return `innora-desk-chats:${propertyId}`;
}

function loadThreads(propertyId: string): Thread[] {
  try {
    const raw = localStorage.getItem(storageKey(propertyId));
    if (!raw) return [freshThread()];
    const parsed = JSON.parse(raw) as Thread[];
    if (!Array.isArray(parsed) || parsed.length === 0) return [freshThread()];
    return parsed.slice(0, 20);
  } catch {
    return [freshThread()];
  }
}

export function InnoraChatBubble({ propertyId }: { propertyId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [running, setRunning] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [threads, setThreads] = useState<Thread[]>(() => [freshThread()]);
  const [activeId, setActiveId] = useState(threads[0]?.id ?? "");

  useEffect(() => {
    const loaded = loadThreads(propertyId);
    setThreads(loaded);
    setActiveId(loaded[0]?.id ?? "");
    setHydrated(true);
  }, [propertyId]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(storageKey(propertyId), JSON.stringify(threads.slice(0, 20)));
    } catch {
      /* private mode */
    }
  }, [threads, propertyId, hydrated]);

  const active = threads.find((thread) => thread.id === activeId) ?? threads[0];
  const messages = active?.messages ?? [];

  function patchActive(updater: (rows: BubbleMessage[]) => BubbleMessage[]) {
    setThreads((rows) =>
      rows.map((thread) => {
        if (thread.id !== activeId) return thread;
        const next = updater(thread.messages);
        const firstUser = next.find((row) => row.role === "user");
        return {
          ...thread,
          messages: next,
          updatedAt: Date.now(),
          title: firstUser ? firstUser.text.slice(0, 48) : thread.title,
        };
      }),
    );
  }

  function newChat() {
    const next = freshThread();
    setThreads((rows) =>
      [next, ...rows.filter((thread) => thread.messages.some((row) => row.role === "user"))].slice(
        0,
        20,
      ),
    );
    setActiveId(next.id);
    setHistoryOpen(false);
    setDraft("");
  }

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    const affirm = /^(yes|confirm|do it|do that|go ahead|ok|okay|yes do that)$/.test(
      trimmed.toLowerCase().replace(/[^a-z\s]/g, " ").replace(/\s+/g, " ").trim(),
    );
    const pending = [...messages].reverse().find((row) => row.role === "innora" && row.action);
    const next = [
      ...messages,
      { id: crypto.randomUUID(), role: "user" as const, text: trimmed },
    ];
    patchActive(() => next);
    setDraft("");
    if (affirm && pending?.action) {
      await run(pending.action, pending.id);
      return;
    }
    setBusy(true);
    const result = await askInnoraDesk({
      messages: next.map((row) => ({ role: row.role, text: row.text })),
    });
    setBusy(false);
    if (!result.ok) {
      patchActive((rows) => [
        ...rows,
        { id: crypto.randomUUID(), role: "innora", text: result.error },
      ]);
      return;
    }
    patchActive((rows) => [
      ...rows,
      {
        id: crypto.randomUUID(),
        role: "innora",
        text: result.reply,
        action: result.action,
        lines: result.lines,
      },
    ]);
    if (result.href) await router.push(result.href);
    if (result.openStay?.bookingId) {
      window.dispatchEvent(
        new CustomEvent("innora:open-stay", {
          detail: {
            bookingId: result.openStay.bookingId,
            step: result.openStay.step,
          },
        }),
      );
    }
  }

  async function run(action: InnoraPendingAction, messageId: string) {
    if (running) return;
    setRunning(true);
    const result = await runInnoraDeskAction({
      kind: action.kind,
      bookingId: action.bookingId,
      addon: action.addon,
      qty: action.qty,
      speed: action.speed,
      catalogItemId: action.catalogItemId,
      serviceItemId: action.serviceItemId,
      roomUnitId: action.roomUnitId,
      roomLabel: action.roomLabel,
      amountBtn: action.amountBtn,
      method: action.method,
      guestName: action.guestName,
      checkIn: action.checkIn,
      checkOut: action.checkOut,
    });
    setRunning(false);
    patchActive((rows) => [
      ...rows.map((row) => (row.id === messageId ? { ...row, action: null } : row)),
      { id: crypto.randomUUID(), role: "innora", text: result.message },
    ]);
    if (result.ok && action.kind === "post_bill_addon" && action.bookingId) {
      window.dispatchEvent(
        new CustomEvent("hotelos-desk", { detail: { bookingId: action.bookingId } }),
      );
      window.dispatchEvent(
        new CustomEvent("innora:open-stay", {
          detail: { bookingId: action.bookingId, step: "stay_money" },
        }),
      );
    }
    if (result.ok) router.refresh();
    if (result.href) router.push(result.href);
  }

  return (
    <div className="pointer-events-none fixed right-3 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-50 flex flex-col items-end gap-2 md:right-4 md:bottom-4 print:hidden">
      {open ? (
        <section
          data-property-id={propertyId}
          className="pointer-events-auto flex h-[min(32rem,70vh)] w-[min(100vw-1.5rem,22rem)] flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-lg"
          aria-label="Innora"
        >
          <header className="flex items-center gap-1 border-b px-2 py-1.5">
            <SparklesIcon className="ml-1 size-4 text-primary" />
            <h2 className="px-1 text-sm font-semibold">Innora</h2>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="ml-auto size-8"
              aria-label="New chat"
              onClick={newChat}
            >
              <SquarePenIcon className="size-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8"
              aria-label="Chat history"
              aria-pressed={historyOpen}
              onClick={() => setHistoryOpen((value) => !value)}
            >
              <HistoryIcon className="size-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8"
              aria-label="Close Innora"
              onClick={() => setOpen(false)}
            >
              <XIcon className="size-4" />
            </Button>
          </header>

          {historyOpen ? (
            <ul className="min-h-0 flex-1 overflow-y-auto p-2">
              {threads
                .filter((thread) => thread.messages.some((row) => row.role === "user"))
                .map((thread) => (
                  <li key={thread.id}>
                    <button
                      type="button"
                      className="flex min-h-11 w-full items-center rounded-md px-2 text-left text-sm hover:bg-muted"
                      onClick={() => {
                        setActiveId(thread.id);
                        setHistoryOpen(false);
                      }}
                    >
                      <span className="truncate">{thread.title}</span>
                    </button>
                  </li>
                ))}
            </ul>
          ) : (
            <MessageScrollerProvider autoScroll>
              <MessageScroller className="min-h-0 flex-1">
                <MessageScrollerViewport>
                  <MessageScrollerContent className="gap-3 px-3 py-3">
                    {messages.map((message) => (
                      <MessageScrollerItem
                        key={message.id}
                        messageId={message.id}
                        scrollAnchor={message.role === "user"}
                      >
                        <Message align={message.role === "user" ? "end" : "start"}>
                          <MessageContent>
                            <Bubble
                              align={message.role === "user" ? "end" : "start"}
                              variant={message.role === "user" ? "default" : "muted"}
                            >
                              <BubbleContent>
                                <p>{message.text}</p>
                                {message.lines && message.lines.length > 0 ? (
                                  <ul className="mt-2 space-y-1 text-xs">
                                    {message.lines.map((line, lineIndex) => (
                                      <li key={`${lineIndex}-${line}`}>{line}</li>
                                    ))}
                                  </ul>
                                ) : null}
                                {message.action ? (
                                  <Button
                                    type="button"
                                    size="sm"
                                    className="mt-2 h-9"
                                    variant="citrus"
                                    disabled={running}
                                    onClick={() => void run(message.action!, message.id)}
                                  >
                                    {running ? "Working…" : message.action.label}
                                  </Button>
                                ) : null}
                              </BubbleContent>
                            </Bubble>
                          </MessageContent>
                        </Message>
                      </MessageScrollerItem>
                    ))}
                  </MessageScrollerContent>
                </MessageScrollerViewport>
              </MessageScroller>
            </MessageScrollerProvider>
          )}

          <form
            className="border-t p-2"
            onSubmit={(event) => {
              event.preventDefault();
              void send(draft);
            }}
          >
            <InputGroup>
              <InputGroupTextarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder="Find the Soul Trips bill"
                rows={1}
                aria-label="Ask Innora"
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    event.currentTarget.form?.requestSubmit();
                  }
                }}
              />
              <InputGroupAddon align="block-end">
                <InputGroupButton
                  type="submit"
                  variant="default"
                  size="icon-sm"
                  className="ml-auto rounded-full"
                  disabled={busy || !draft.trim()}
                  aria-label="Send"
                >
                  <ArrowUpIcon />
                </InputGroupButton>
              </InputGroupAddon>
            </InputGroup>
          </form>
        </section>
      ) : null}
      <button
        type="button"
        className="pointer-events-auto flex h-12 items-center gap-2 rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-lg"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <SparklesIcon className="size-4" />
        Innora
      </button>
    </div>
  );
}
