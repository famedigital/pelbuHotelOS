"use client";

import {
  requestAgentRateView,
  type AgentRateGateState,
} from "@/app/actions/rate-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";

const initial: AgentRateGateState = { ok: false };

/**
 * Soft B2B gate — email + WhatsApp required. Does not render trade rates itself;
 * successful submit sets an httpOnly cookie and refreshes the page.
 */
export function AgentRateGateForm({
  propertyWhatsApp,
}: {
  propertyWhatsApp?: string | null;
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState(requestAgentRateView, initial);

  useEffect(() => {
    if (state.ok) {
      router.refresh();
    }
  }, [state.ok, router]);

  if (state.ok) {
    return (
      <p className="text-sm text-muted-foreground" role="status" aria-live="polite">
        Loading partner rates…
      </p>
    );
  }

  return (
    <form action={action} className="max-w-md space-y-4" noValidate>
      <div>
        <h3 className="font-display text-xl text-foreground">
          For registered travel partners
        </h3>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
          Enter your work email and WhatsApp to view confidential agent and MoU
          rates. We log access for the front desk. Rates remain subject to
          contract approval.
        </p>
      </div>

      {state.error ? (
        <p className="text-sm text-maroon" role="alert">
          {state.error}
        </p>
      ) : null}

      <div className="grid gap-2">
        <Label htmlFor="rate-full-name">Full name (optional)</Label>
        <Input
          id="rate-full-name"
          name="full_name"
          autoComplete="name"
          maxLength={120}
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="rate-email">Work email</Label>
        <Input
          id="rate-email"
          name="email"
          type="email"
          required
          autoComplete="email"
          maxLength={200}
          inputMode="email"
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="rate-whatsapp">WhatsApp number</Label>
        <Input
          id="rate-whatsapp"
          name="whatsapp"
          type="tel"
          required
          autoComplete="tel"
          maxLength={40}
          placeholder="+975 …"
          inputMode="tel"
        />
        <p className="text-xs text-muted-foreground">
          Include country code if outside Bhutan (e.g. +91 for Jaigaon / India).
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3 pt-1">
        <Button type="submit" disabled={pending} variant="citrus">
          {pending ? "Checking…" : "View partner rates"}
        </Button>
        <a
          href="/agents"
          className="text-sm font-medium text-sky-700 underline-offset-4 hover:underline"
        >
          Apply as an agent
        </a>
        {propertyWhatsApp ? (
          <a
            href={`https://wa.me/${propertyWhatsApp.replace(/\D+/g, "")}`}
            className="text-sm font-medium text-sky-700 underline-offset-4 hover:underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            WhatsApp reservations
          </a>
        ) : null}
      </div>
    </form>
  );
}
