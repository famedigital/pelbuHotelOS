import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { Button } from "@hos-v2/ui";
import { useCommercialStore } from "../../lib/commercial-store";
import {
  hermesCreatePairToken,
  hermesPairState,
  hermesTestChat,
  type HermesPairRole,
} from "../../lib/hermes-remote";

type Props = {
  open: boolean;
  onClose: () => void;
  onPaired?: () => void;
};

const ROLES: { id: HermesPairRole; label: string; hint: string }[] = [
  { id: "fo", label: "Front office", hint: "Arrivals · OCR · occ" },
  { id: "hk", label: "Housekeeping", hint: "/clean · dirty rooms" },
  { id: "kitchen", label: "Kitchen / F&B", hint: "Covers · meal board" },
  { id: "manager", label: "Manager", hint: "Audit · overrides" },
  { id: "gm", label: "GM", hint: "Owner pulse" },
  { id: "agent", label: "Tour agent", hint: "MoU · guest CI/CO alerts" },
];

export function PairWizard({ open, onClose, onPaired }: Props) {
  const agents = useCommercialStore((s) => s.agents.filter((a) => a.active));
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [role, setRole] = useState<HermesPairRole>("fo");
  const [agentId, setAgentId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [token, setToken] = useState("");
  const [deepLink, setDeepLink] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [botUsername, setBotUsername] = useState("HotelOSHermesBot");
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [pairedChat, setPairedChat] = useState<{
    id: string;
    displayName: string | null;
    chatType: string;
    role: string;
  } | null>(null);

  const qrUrl = useMemo(() => {
    if (!deepLink) return "";
    return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(deepLink)}`;
  }, [deepLink]);

  useEffect(() => {
    if (!open) {
      setStep(1);
      setError("");
      setToken("");
      setDeepLink("");
      setPairedChat(null);
      setBusy(false);
      setAgentId("");
      setRole("fo");
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!expiresAt || step !== 2) return;
    const tick = () => {
      setSecondsLeft(
        Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000)),
      );
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [expiresAt, step]);

  useEffect(() => {
    if (step !== 2 || !token) return;
    const id = window.setInterval(() => {
      void (async () => {
        const res = await hermesPairState(token);
        if (!res.ok) return;
        if (res.data.used && res.data.chat) {
          setPairedChat(res.data.chat);
          setStep(3);
          onPaired?.();
        }
      })();
    }, 2000);
    return () => window.clearInterval(id);
  }, [step, token, onPaired]);

  if (!open || typeof document === "undefined") return null;

  async function mint() {
    setBusy(true);
    setError("");
    if (role === "agent" && !agentId) {
      setError("Pick an agent for agent pairing");
      setBusy(false);
      return;
    }
    const res = await hermesCreatePairToken(
      role,
      role === "agent" ? agentId : undefined,
    );
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setToken(res.data.token);
    setDeepLink(res.data.deepLink);
    setExpiresAt(res.data.expiresAt);
    setBotUsername(res.data.botUsername);
    setStep(2);
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[140] flex items-end justify-center bg-[rgba(15,23,42,0.55)] p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-label="Pair Telegram"
      data-testid="hermes-pair-wizard"
      onClick={onClose}
    >
      <div
        className="hos-surface-glass flex max-h-[min(92vh,640px)] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl border border-[var(--hos-glass-border)] shadow-[0_24px_64px_-16px_rgba(15,23,42,0.55)] sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-2 border-b border-[var(--hos-line)] px-4 py-3">
          <div>
            <strong className="text-sm text-[var(--hos-ink)]">
              Pair Innora Bot
            </strong>
            <p className="m-0 text-[11px] text-[var(--hos-ink-3)]">
              Step {step} of 3 · @{botUsername}
            </p>
          </div>
          <Button size="sm" variant="ghost" onClick={onClose}>
            Close
          </Button>
        </div>

        <div className="hos-scrollbar-slim min-h-0 flex-1 overflow-y-auto p-4">
          {error ? (
            <p className="mb-3 rounded-xl border border-[color-mix(in_srgb,var(--hos-ruby)_35%,transparent)] bg-[color-mix(in_srgb,var(--hos-ruby)_10%,transparent)] px-3 py-2 text-[12px] text-[var(--hos-ruby)]">
              {error}
            </p>
          ) : null}

          {step === 1 ? (
            <div className="grid gap-3">
              <p className="m-0 text-[13px] text-[var(--hos-ink-2)]">
                Choose who is pairing this Telegram chat to the property.
              </p>
              <div className="grid grid-cols-2 gap-2">
                {ROLES.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    data-testid={`hermes-pair-role-${r.id}`}
                    onClick={() => setRole(r.id)}
                    className={`rounded-xl border px-3 py-2.5 text-left ${
                      role === r.id
                        ? "border-[var(--hos-primary)] bg-[color-mix(in_srgb,var(--hos-primary)_12%,transparent)]"
                        : "border-[var(--hos-line)] bg-[var(--hos-cell)]"
                    }`}
                  >
                    <div className="text-[13px] font-semibold text-[var(--hos-ink)]">
                      {r.label}
                    </div>
                    <div className="text-[10px] text-[var(--hos-ink-3)]">{r.hint}</div>
                  </button>
                ))}
              </div>
              {role === "agent" ? (
                <label className="grid gap-1 text-[12px] text-[var(--hos-ink-2)]">
                  Agent
                  <select
                    className="hos-input !min-h-10 !rounded-xl !text-[13px]"
                    value={agentId}
                    data-testid="hermes-pair-agent"
                    onChange={(e) => setAgentId(e.target.value)}
                  >
                    <option value="">Select agent…</option>
                    {agents.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.code} · {a.name}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              <Button
                className="hos-btn-ink !min-h-10 !rounded-xl"
                disabled={busy}
                data-testid="hermes-pair-mint"
                onClick={() => void mint()}
              >
                Continue
              </Button>
            </div>
          ) : null}

          {step === 2 ? (
            <div className="grid gap-3 text-center">
              <p className="m-0 text-[13px] text-[var(--hos-ink-2)]">
                Scan or open the link on the phone · expires in{" "}
                <span className="font-mono font-bold tabular-nums">
                  {Math.floor(secondsLeft / 60)}:
                  {String(secondsLeft % 60).padStart(2, "0")}
                </span>
              </p>
              {qrUrl ? (
                <img
                  src={qrUrl}
                  alt="Pair QR"
                  className="mx-auto h-[180px] w-[180px] rounded-xl border border-[var(--hos-line)] bg-white p-2"
                />
              ) : null}
              <code
                data-testid="hermes-pair-link"
                className="block break-all rounded-xl border border-[var(--hos-line)] bg-[var(--hos-bg)] px-3 py-2 text-left text-[11px] text-[var(--hos-ink)]"
              >
                {deepLink}
              </code>
              <div className="flex flex-wrap justify-center gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  className="!rounded-full"
                  onClick={() => {
                    void navigator.clipboard.writeText(deepLink).then(
                      () => toast.success("Link copied"),
                      () => toast.error("Copy failed"),
                    );
                  }}
                >
                  Copy link
                </Button>
                <a
                  href={deepLink}
                  target="_blank"
                  rel="noreferrer"
                  className="hos-btn-tactile inline-flex min-h-8 items-center rounded-full border border-[var(--hos-line)] bg-[var(--hos-cell)] px-3 text-[12px] font-semibold text-[var(--hos-ink)] no-underline"
                >
                  Open Telegram
                </a>
              </div>
              <p className="m-0 text-[11px] text-[var(--hos-ink-3)]">
                Waiting for /start on the bot…
              </p>
            </div>
          ) : null}

          {step === 3 && pairedChat ? (
            <div className="grid gap-3 text-center">
              <p className="m-0 text-[15px] font-bold text-[var(--hos-emerald)]">
                Paired
              </p>
              <p className="m-0 text-[13px] text-[var(--hos-ink)]">
                {pairedChat.displayName || "Telegram chat"} · {pairedChat.role} ·{" "}
                {pairedChat.chatType}
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                <Button
                  size="sm"
                  className="hos-btn-ink !rounded-full"
                  onClick={() => {
                    void hermesTestChat(pairedChat.id).then((res) => {
                      if (!res.ok) toast.error(res.error);
                      else if (!res.data.delivered)
                        toast.message("Test logged (bot offline)", {
                          description: res.data.error,
                        });
                      else toast.success("Test message sent");
                    });
                  }}
                >
                  Send test
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  className="!rounded-full"
                  onClick={onClose}
                >
                  Done
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>,
    document.body,
  );
}
