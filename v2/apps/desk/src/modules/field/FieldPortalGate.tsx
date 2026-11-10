/**
 * PIN unlock for partner / guide / driver — standalone, no desk chrome.
 */
import { useState, useTransition } from "react";
import { Lock, ShieldCheck } from "lucide-react";
import { Badge, Button } from "@hos-v2/ui";
import {
  FIELD_DEMO_HINTS,
  useFieldPortalAuth,
  type FieldPortalRole,
} from "../../lib/field-portal-auth";

type Props = {
  role: FieldPortalRole;
  title: string;
  blurb: string;
  children: React.ReactNode;
};

export function FieldPortalGate({ role, title, blurb, children }: Props) {
  const session = useFieldPortalAuth((s) => s.sessions[role]);
  const unlock = useFieldPortalAuth((s) => s.unlock);
  const lock = useFieldPortalAuth((s) => s.lock);
  const hint = FIELD_DEMO_HINTS[role];
  const [code, setCode] = useState(hint.code);
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [, start] = useTransition();

  if (session) {
    return (
      <div className="flex min-h-dvh flex-col bg-[var(--hos-canvas)]">
        <header className="sticky top-0 z-20 flex items-center gap-2 border-b border-[var(--hos-line)] bg-[color-mix(in_srgb,var(--hos-surface)_92%,transparent)] px-3 py-2.5 backdrop-blur-md pt-[max(0.5rem,env(safe-area-inset-top))]">
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13px] font-bold text-[var(--hos-ink)]">
              {title}
            </div>
            <div className="truncate text-[10px] text-[var(--hos-ink-3)]">
              {session.displayName} · {session.code}
            </div>
          </div>
          <Badge tone="teal">{role}</Badge>
          <Button
            size="sm"
            variant="ghost"
            className="!rounded-full"
            onClick={() => lock(role)}
          >
            Lock
          </Button>
        </header>
        <div className="min-h-0 flex-1 overflow-auto pb-[max(1rem,env(safe-area-inset-bottom))]">
          {children}
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-[var(--hos-canvas)] px-4 py-10 pt-[max(2rem,env(safe-area-inset-top))]">
      <div className="hos-luxury-card w-full max-w-sm p-5 shadow-[0_20px_50px_-28px_rgba(15,23,42,0.45)]">
        <div className="mb-4 flex items-center gap-3">
          <span className="flex size-11 items-center justify-center rounded-2xl bg-[#111] text-white">
            <Lock className="size-5" />
          </span>
          <div>
            <p className="m-0 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--hos-ink-3)]">
              Field portal
            </p>
            <h1 className="m-0 text-lg font-extrabold tracking-tight text-[var(--hos-ink)]">
              {title}
            </h1>
          </div>
        </div>
        <p className="m-0 mb-4 text-[12px] leading-relaxed text-[var(--hos-ink-3)]">
          {blurb}
        </p>
        <label className="mb-3 grid gap-1 text-[10px] font-bold uppercase tracking-wider text-[var(--hos-ink-3)]">
          Portal code
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            autoCapitalize="characters"
            autoComplete="username"
            className="hos-input !min-h-12 !rounded-xl !text-[15px]"
          />
        </label>
        <label className="mb-3 grid gap-1 text-[10px] font-bold uppercase tracking-wider text-[var(--hos-ink-3)]">
          PIN
          <input
            type="password"
            inputMode="numeric"
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 8))}
            autoComplete="current-password"
            className="hos-input !min-h-12 !rounded-xl !text-[15px] tracking-[0.3em]"
            placeholder="••••"
          />
        </label>
        {error ? (
          <p className="m-0 mb-3 text-[12px] font-semibold text-[var(--hos-ruby)]">
            {error}
          </p>
        ) : null}
        <Button
          className="hos-btn-ink !min-h-12 w-full !rounded-xl text-[15px] font-bold"
          onClick={() => {
            start(() => {
              const res = unlock(role, code, pin);
              if (!res.ok) setError(res.error);
              else setError(null);
            });
          }}
        >
          Unlock
        </Button>
        <p className="m-0 mt-3 flex items-start gap-1.5 text-[10px] text-[var(--hos-ink-3)]">
          <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-[var(--hos-primary)]" />
          <span>
            Demo · {hint.label}: code <strong>{hint.code}</strong> · PIN{" "}
            <strong>{hint.pin}</strong>
          </span>
        </p>
      </div>
    </div>
  );
}
