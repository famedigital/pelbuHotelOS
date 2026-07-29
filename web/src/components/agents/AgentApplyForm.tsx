"use client";

import {
  createAgentApplication,
  type AgentApplyState,
} from "@/app/actions/agents";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useActionState, useState } from "react";

const initial: AgentApplyState = { ok: false };

const selectClass =
  "flex h-10 w-full rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/25";

function CopyReference({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  async function onCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }
  return (
    <Button type="button" variant="outline" size="sm" onClick={onCopy}>
      {copied ? "Copied" : "Copy"}
    </Button>
  );
}

export function AgentApplyForm() {
  const [state, action, pending] = useActionState(createAgentApplication, initial);

  if (state.ok && state.agentId) {
    return (
      <div role="status" aria-live="polite" className="space-y-4">
        <h2 className="font-display text-2xl text-ink">Application received</h2>
        <p className="text-sm text-muted-foreground">
          We review your license and market, then reply within a few working
          days. Reference:{" "}
          <span className="font-mono text-ink">{state.agentId}</span>{" "}
          <CopyReference value={state.agentId} />
        </p>
        <Button asChild>
          <a href="/book">Book a guest meanwhile</a>
        </Button>
      </div>
    );
  }

  return (
    <form action={action} className="max-w-lg space-y-6" noValidate>
      {state.error ? (
        <p className="text-sm text-maroon" role="alert">
          {state.error}
        </p>
      ) : null}

      <div className="space-y-4">
        <div className="grid gap-2">
          <Label htmlFor="company-name">Company name</Label>
          <Input
            id="company-name"
            name="company_name"
            required
            maxLength={160}
            autoComplete="organization"
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="market">Primary market</Label>
          <select
            id="market"
            name="market"
            required
            defaultValue="bhutan"
            className={selectClass}
          >
            <option value="bhutan">Bhutan</option>
            <option value="jaigaon">Jaigaon</option>
            <option value="india">India</option>
          </select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="license-url">License URL (optional)</Label>
          <Input
            id="license-url"
            type="url"
            name="license_url"
            placeholder="https://"
            maxLength={500}
          />
        </div>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" name="wants_mou" className="mt-1" />
          <span>I want MoU / credit terms after approval</span>
        </label>
      </div>

      <div className="space-y-4">
        <div className="grid gap-2">
          <Label htmlFor="contact-name">Contact person</Label>
          <Input
            id="contact-name"
            name="contact_name"
            required
            maxLength={120}
            autoComplete="name"
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="contact-phone">Phone</Label>
            <Input
              id="contact-phone"
              type="tel"
              name="contact_phone"
              required
              autoComplete="tel"
              placeholder="+975 …"
              maxLength={24}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="contact-email">Email (optional)</Label>
            <Input
              id="contact-email"
              type="email"
              name="contact_email"
              autoComplete="email"
              maxLength={160}
            />
          </div>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="notes">Notes</Label>
          <Textarea id="notes" name="notes" rows={3} maxLength={800} />
        </div>
      </div>

      <Button type="submit" disabled={pending}>
        {pending ? "Submitting…" : "Submit application"}
      </Button>
    </form>
  );
}
