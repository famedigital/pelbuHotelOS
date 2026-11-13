import { useState } from "react";
import { toast } from "sonner";
import { Badge, Button } from "@hos-v2/ui";
import { hermesRegisterWebhook } from "../../lib/hermes-remote";
import { useTelegramOverview } from "./telegram-context";

const COMMANDS = [
  ["/help", "Command list"],
  ["/status", "Bot + property pulse"],
  ["/today", "Today board"],
  ["/occ", "Occupancy"],
  ["/arrivals", "Arrivals"],
  ["/search", "Find guest / conf"],
  ["/clean <room>", "HK mark clean"],
  ["/covers", "Kitchen covers"],
  ["/audit", "Night audit flash"],
  ["/mou", "Agent MoU"],
  ["/unpair", "Leave property"],
];

export function TelegramSetupPage() {
  const { overview, refresh } = useTelegramOverview();
  const [baseUrl, setBaseUrl] = useState(
    typeof window !== "undefined" ? window.location.origin.replace(":5174", ":4200") : "",
  );
  const [busy, setBusy] = useState(false);

  return (
    <div className="grid gap-3 text-[13px] text-[var(--hos-ink-2)]" data-testid="hermes-setup">
      <div className="rounded-xl border border-[var(--hos-line)] bg-[var(--hos-cell)] p-3">
        <strong className="text-[var(--hos-ink)]">Bot health</strong>
        <div className="mt-2 flex flex-wrap gap-2">
          <Badge>{overview?.botConfigured ? "Bot token set" : "Bot token missing"}</Badge>
          <Badge>
            {overview?.webhookSecretConfigured
              ? "Webhook secret set"
              : "Webhook secret missing"}
          </Badge>
          <Badge>
            {overview?.geminiConfigured ? "Gemini set" : "Gemini missing"}
          </Badge>
          {overview?.simulateMode ? <Badge>Simulate mode</Badge> : null}
        </div>
        <p className="mt-2 m-0 font-mono text-[11px]">
          @{overview?.botUsername || "—"} · POST /v1/telegram/webhook
        </p>
      </div>

      <div className="rounded-xl border border-[var(--hos-line)] bg-[var(--hos-cell)] p-3">
        <strong className="text-[var(--hos-ink)]">Register webhook</strong>
        <p className="m-0 mt-1 text-[12px]">
          Calls Telegram setWebhook. Requires TELEGRAM_BOT_TOKEN on API — no fake success.
        </p>
        <label className="mt-2 grid gap-1 text-[12px]">
          Public API base URL
          <input
            className="hos-input !min-h-9 !rounded-xl !font-mono !text-[12px]"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder="https://desk-v2…/api or https://host:4200"
          />
        </label>
        <Button
          size="sm"
          className="hos-btn-ink mt-2 !rounded-full"
          disabled={busy}
          onClick={() => {
            setBusy(true);
            void hermesRegisterWebhook(baseUrl.trim() || undefined).then(
              async (res) => {
                setBusy(false);
                if (!res.ok) {
                  toast.error(res.error);
                  return;
                }
                toast.success("Webhook registered", {
                  description: res.data.webhookUrl,
                });
                await refresh();
              },
            );
          }}
        >
          Verify &amp; register
        </Button>
      </div>

      <div className="rounded-xl border border-[var(--hos-line)] bg-[var(--hos-cell)] p-3">
        <strong className="text-[var(--hos-ink)]">API env (server only)</strong>
        <ul className="mt-2 space-y-1 font-mono text-[11px]">
          <li>TELEGRAM_BOT_TOKEN</li>
          <li>TELEGRAM_BOT_USERNAME</li>
          <li>TELEGRAM_WEBHOOK_SECRET</li>
          <li>GEMINI_API_KEY</li>
          <li>HERMES_OCR_SIMULATE=1</li>
          <li>PUBLIC_API_BASE_URL</li>
        </ul>
      </div>

      <div className="rounded-xl border border-[var(--hos-line)] bg-[var(--hos-cell)] p-3">
        <strong className="text-[var(--hos-ink)]">Staff command cheat-sheet</strong>
        <ul className="mt-2 space-y-1 text-[12px]">
          {COMMANDS.map(([cmd, hint]) => (
            <li key={cmd} className="flex gap-2">
              <code className="shrink-0 rounded bg-[var(--hos-bg)] px-1.5 py-0.5 font-mono text-[11px] text-[var(--hos-ink)]">
                {cmd}
              </code>
              <span className="text-[var(--hos-ink-3)]">{hint}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
