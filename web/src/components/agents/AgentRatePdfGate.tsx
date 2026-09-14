"use client";

import {
  requestAgentRatePdfDownload,
  type AgentRatePdfGateState,
} from "@/app/actions/agent-rate-pdf";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useActionState, useEffect, useState } from "react";

const initial: AgentRatePdfGateState = { ok: false };

/**
 * Public gate: email + phone → register download → open rate card (print/save as PDF).
 */
export function AgentRatePdfGate({
  initialTotalDownloads,
}: {
  initialTotalDownloads: number;
}) {
  const [state, action, pending] = useActionState(
    requestAgentRatePdfDownload,
    initial,
  );
  const [total, setTotal] = useState(initialTotalDownloads);

  useEffect(() => {
    if (state.ok) {
      if (typeof state.totalDownloads === "number") {
        setTotal(state.totalDownloads);
      } else {
        setTotal((n) => n + 1);
      }
      // Cookie set on same origin — trigger download immediately.
      window.location.assign("/api/agents/rate-card-download");
    }
  }, [state.ok, state.totalDownloads]);

  return (
    <section
      className="space-y-6 border-t border-border/60 pt-10"
      aria-labelledby="agent-rate-pdf-heading"
    >
      <div className="max-w-lg space-y-2">
        <h2
          id="agent-rate-pdf-heading"
          className="font-display text-2xl text-foreground sm:text-3xl"
        >
          Agent rate card
        </h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Enter your phone and work email to download the current trade rate
          card. Your details are registered with the desk each time you
          download. Open the file and use Print → Save as PDF if you need a PDF
          copy.
        </p>
        <p
          className="text-sm font-medium text-foreground"
          aria-live="polite"
        >
          {total === 1
            ? "1 download so far"
            : `${total.toLocaleString()} downloads so far`}
        </p>
      </div>

      {state.ok ? (
        <p className="text-sm text-muted-foreground" role="status" aria-live="polite">
          Starting your download…
        </p>
      ) : (
        <form action={action} className="max-w-md space-y-4" noValidate>
          {state.error ? (
            <p className="text-sm text-maroon" role="alert">
              {state.error}
            </p>
          ) : null}

          <div className="grid gap-2">
            <Label htmlFor="agent-pdf-full-name">Full name (optional)</Label>
            <Input
              id="agent-pdf-full-name"
              name="full_name"
              autoComplete="name"
              maxLength={120}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="agent-pdf-email">Work email</Label>
            <Input
              id="agent-pdf-email"
              name="email"
              type="email"
              required
              autoComplete="email"
              maxLength={200}
              inputMode="email"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="agent-pdf-phone">Phone number</Label>
            <Input
              id="agent-pdf-phone"
              name="phone"
              type="tel"
              required
              autoComplete="tel"
              maxLength={40}
              placeholder="+975 …"
              inputMode="tel"
            />
            <p className="text-xs text-muted-foreground">
              Include country code if outside Bhutan (e.g. +91 for India).
            </p>
          </div>

          <Button type="submit" disabled={pending} variant="citrus">
            {pending ? "Preparing…" : "Download rate card"}
          </Button>
        </form>
      )}
    </section>
  );
}
