import { useEffect, useMemo, useState, useTransition } from "react";
import { useParams } from "react-router-dom";
import { toast } from "sonner";
import { Button, GlassPanel, ModuleFrame } from "@hos-v2/ui";
import { useCommercialStore } from "../lib/commercial-store";
import {
  acceptMouTerms,
  composeRateSheetPack,
  hasMouAcceptance,
  isMouSessionUnlocked,
  markMouSessionUnlocked,
  parseRateShareToken,
  verifyMouContactAndCode,
  type RateSharePayload,
  type RateSheetPack,
} from "../lib/rate-sheet-share";
import { RateSheetPrintView } from "./RateSheetPrintView";

type GateStep = "loading" | "invalid" | "verify" | "sign" | "view";

function maskContactHint(contact: string): string {
  const email = contact.match(/[\w.+-]+@[\w.-]+/);
  if (email?.[0]) {
    const [user, domain] = email[0].split("@");
    const u = user ?? "";
    const masked =
      u.length <= 2 ? `${u[0] ?? "*"}*` : `${u.slice(0, 2)}***`;
    return `${masked}@${domain}`;
  }
  const digits = contact.replace(/\D/g, "");
  if (digits.length >= 6) {
    return `•••${digits.slice(-4)}`;
  }
  return "on file with hotel";
}

export function RateSheetSharePage() {
  const { token: rawToken } = useParams<{ token: string }>();
  const token = rawToken ? decodeURIComponent(rawToken) : "";
  const rateCards = useCommercialStore((s) => s.rateCards);
  const cells = useCommercialStore((s) => s.cells);
  const agents = useCommercialStore((s) => s.agents);

  const [step, setStep] = useState<GateStep>("loading");
  const [payload, setPayload] = useState<RateSharePayload | null>(null);
  const [contact, setContact] = useState("");
  const [code, setCode] = useState("");
  const [signerName, setSignerName] = useState("");
  const [signedBy, setSignedBy] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const parsed = await parseRateShareToken(token);
      if (cancelled) return;
      if (!parsed) {
        setStep("invalid");
        return;
      }
      setPayload(parsed);
      if (parsed.audience === "mou") {
        const prior = hasMouAcceptance(token);
        if (prior || isMouSessionUnlocked(token)) {
          if (prior) setSignedBy(prior.signerName);
          setStep("view");
        } else {
          setStep("verify");
        }
      } else {
        setStep("view");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const agent =
    payload?.agentId != null
      ? agents.find((a) => a.id === payload.agentId)
      : undefined;

  const pack: RateSheetPack | null = useMemo(() => {
    if (!payload) return null;
    return composeRateSheetPack({
      cards: rateCards,
      cells,
      cardIds: payload.cardIds,
      season: payload.season,
      mealPlan: payload.mealPlan,
      agent: payload.audience === "mou" ? agent ?? null : null,
      confidential: payload.audience === "mou",
    });
  }, [payload, rateCards, cells, agent]);

  const runVerify = () => {
    if (!payload || !agent) {
      toast.error("MoU agent missing on this link");
      return;
    }
    const res = verifyMouContactAndCode({
      token,
      contact,
      code,
      agentContact: agent.contact,
    });
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Verified — accept MoU terms to continue");
    setStep("sign");
  };

  const runSign = () => {
    if (!payload || !agent) return;
    startTransition(() => {
      const res = acceptMouTerms({
        token,
        propertyId: payload.propertyId,
        agentId: agent.id,
        agentName: agent.name,
        signerName,
        contact,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      markMouSessionUnlocked(token);
      setSignedBy(res.acceptance.signerName);
      toast.success("MoU accepted", {
        description: `${res.acceptance.signerName} · ${res.acceptance.acceptedAt}`,
      });
      setStep("view");
    });
  };

  const printSheet = () => {
    window.print();
  };

  if (step === "loading") {
    return (
      <ModuleFrame title="Rate sheet" description="Opening secure share…">
        <p className="text-sm text-[var(--hos-ink-3)]">Validating link…</p>
      </ModuleFrame>
    );
  }

  if (step === "invalid" || !pack) {
    return (
      <ModuleFrame title="Rate sheet" description="Link unavailable">
        <GlassPanel className="p-4">
          <p className="text-sm text-[var(--hos-ink)]">
            This share link is invalid or expired.
          </p>
        </GlassPanel>
      </ModuleFrame>
    );
  }

  if (step === "verify" || step === "sign") {
    return (
      <ModuleFrame
        title="Confidential MoU rates"
        description="Verify your agency contact, then accept terms to view"
      >
        <GlassPanel className="mx-auto max-w-md space-y-3 p-4">
          <p className="text-[12px] text-[var(--hos-ink-3)]">
            Agent: <strong>{agent?.name ?? "—"}</strong>
            {agent ? ` (${agent.code})` : ""}
          </p>
          {agent?.contact ? (
            <p className="m-0 text-[11px] text-[var(--hos-ink-3)]">
              Match contact hint: {maskContactHint(agent.contact)}
            </p>
          ) : null}
          {step === "verify" ? (
            <>
              <label className="flex flex-col gap-1 text-[11px]">
                <span className="uppercase text-[var(--hos-ink-3)]">
                  Email or phone on file
                </span>
                <input
                  value={contact}
                  onChange={(e) => setContact(e.target.value)}
                  className="hos-cell rounded-lg px-2 py-2 text-xs"
                  autoComplete="email"
                />
              </label>
              <label className="flex flex-col gap-1 text-[11px]">
                <span className="uppercase text-[var(--hos-ink-3)]">
                  One-time code
                </span>
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className="hos-cell rounded-lg px-2 py-2 font-mono text-xs"
                  inputMode="numeric"
                />
              </label>
              <Button size="sm" onClick={runVerify}>
                Verify
              </Button>
            </>
          ) : (
            <>
              <p className="text-[12px] leading-relaxed text-[var(--hos-ink-2)]">
                By accepting, you confirm these MoU rates are confidential, for
                your agency&apos;s bookings only, and not for public
                redistribution. Typed name + date acts as e-sign lite.
              </p>
              <label className="flex flex-col gap-1 text-[11px]">
                <span className="uppercase text-[var(--hos-ink-3)]">
                  Full legal name
                </span>
                <input
                  value={signerName}
                  onChange={(e) => setSignerName(e.target.value)}
                  className="hos-cell rounded-lg px-2 py-2 text-xs"
                />
              </label>
              <p className="text-[11px] text-[var(--hos-ink-3)]">
                Date: {new Date().toLocaleDateString("en-GB")}
              </p>
              <Button size="sm" disabled={pending} onClick={runSign}>
                {pending ? "Recording…" : "Accept MoU & view rates"}
              </Button>
            </>
          )}
        </GlassPanel>
      </ModuleFrame>
    );
  }

  return (
    <ModuleFrame
      title={pack.confidential ? "MoU rate sheet" : "Rate sheet"}
      description={`${pack.brand.name} · ${pack.season} · ${pack.mealPlan}`}
      actions={
        <Button size="sm" onClick={printSheet}>
          Print / Save PDF
        </Button>
      }
    >
      {signedBy ? (
        <GlassPanel className="mb-3 p-3">
          <p className="m-0 text-[12px] text-[var(--hos-ink-2)]">
            MoU accepted by <strong>{signedBy}</strong>
            {agent ? ` · ${agent.name}` : ""} · receipt kept on desk
          </p>
        </GlassPanel>
      ) : null}
      <div className="overflow-x-auto bg-[var(--hos-canvas)] py-4">
        <RateSheetPrintView pack={pack} printRoot />
      </div>
    </ModuleFrame>
  );
}
