import { motion, useReducedMotion } from "motion/react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Badge, Button, GlassPanel, KpiCard,
  ModuleFrame,
} from "@hos-v2/ui";
import { useExtrasStore } from "../lib/extras-store";

const PROMPTS = [
  "Show unassigned arrivals for Yangphel group",
  "Which in-house folios still have a balance?",
  "List dirty rooms for housekeeping",
  "Draft an apology letter for a late room",
];

export function InnoraAiPage() {
  const reduce = useReducedMotion();
  const [, start] = useTransition();
  const [apiKey, setApiKey] = useState("");
  const [q, setQ] = useState(PROMPTS[0]!);
  const [answer, setAnswer] = useState("");
  const askAi = useExtrasStore((s) => s.askAi);
  const aiLog = useExtrasStore((s) => s.aiLog);

  return (
    <ModuleFrame
      title="Innora AI"
      description="Desk copilots · proposed actions"
    >
    <div className="flex flex-col gap-4">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="m-0 text-2xl font-bold text-[var(--hos-ink)]">Innora AI</h1>
          <Badge tone="teal">BYOK Gemini</Badge>
        </div>
        <p className="m-0 mt-0.5 text-xs text-[var(--hos-ink-3)]">
          Natural-language desk solver · review replies · apology drafts · key stays in browser only
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <KpiCard label="Queries" value={aiLog.length} />
        <KpiCard label="BYOK" value={apiKey ? "Set" : "Local"} delta="Demo solver" />
        <KpiCard label="Mode" value="Desk RAM" delta="No cloud write" />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <GlassPanel className="flex flex-col gap-3 p-4">
          <label className="grid gap-1 text-xs font-medium">Gemini API key (BYOK — optional)
            <input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="AIza… stored only in this session" className="rounded-lg border border-[var(--hos-line)] bg-[var(--hos-cell)] px-3 py-2 font-mono text-xs" />
          </label>
          <label className="grid gap-1 text-xs font-medium">Ask the desk
            <textarea value={q} onChange={(e) => setQ(e.target.value)} rows={3} className="rounded-lg border border-[var(--hos-line)] bg-[var(--hos-cell)] px-3 py-2 text-sm" />
          </label>
          <div className="flex flex-wrap gap-1.5">
            {PROMPTS.map((p) => (
              <button key={p} type="button" onClick={() => setQ(p)} className="rounded-lg border border-[var(--hos-line)] px-2 py-1 text-[10px] font-semibold text-[var(--hos-ink-2)] hover:border-[var(--hos-primary)]">
                {p}
              </button>
            ))}
          </div>
          <motion.div whileTap={reduce ? undefined : { scale: 0.97 }}>
            <Button onClick={() => {
              start(() => {
                const a = askAi(q);
                setAnswer(a);
                toast.success(apiKey ? "Gemini path (demo local solve)" : "Local desk solver");
              });
            }}>Solve</Button>
          </motion.div>
          {answer ? (
            <pre className="hos-cell m-0 whitespace-pre-wrap rounded-xl p-3 text-xs text-[var(--hos-ink)]">{answer}</pre>
          ) : null}
        </GlassPanel>

        <GlassPanel className="max-h-[520px] overflow-auto p-3.5">
          <strong className="text-sm">Session log</strong>
          <ul className="mt-2 m-0 list-none space-y-2 p-0">
            {aiLog.length === 0 ? (
              <li className="text-xs text-[var(--hos-ink-3)]">No queries yet.</li>
            ) : (
              aiLog.map((row) => (
                <li key={row.id} className="hos-cell rounded-xl p-2.5 text-[11px]">
                  <div className="font-semibold text-[var(--hos-primary)]">{row.q}</div>
                  <div className="mt-1 whitespace-pre-wrap text-[var(--hos-ink-2)]">{row.a.slice(0, 180)}{row.a.length > 180 ? "…" : ""}</div>
                </li>
              ))
            )}
          </ul>
        </GlassPanel>
      </div>
    </div>
    </ModuleFrame>
  );
}
