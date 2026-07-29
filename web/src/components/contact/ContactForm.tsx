"use client";

import { createEnquiry, type EnquiryState } from "@/app/actions/enquiries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useActionState, useState } from "react";

const initial: EnquiryState = { ok: false };

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

export function ContactForm() {
  const [state, action, pending] = useActionState(createEnquiry, initial);
  const [topic, setTopic] = useState("general");

  if (state.ok && state.enquiryId) {
    return (
      <div role="status" aria-live="polite" className="space-y-4">
        <h2 className="font-display text-2xl text-ink">Message sent</h2>
        <p className="text-sm text-muted-foreground">
          We reply during desk hours. Reference:{" "}
          <span className="font-mono text-ink">{state.enquiryId}</span>{" "}
          <CopyReference value={state.enquiryId} />
        </p>
        <div className="flex gap-3">
          <Button asChild>
            <a href="/book">Book a stay</a>
          </Button>
          <Button asChild variant="outline">
            <a href="/order">Order food</a>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form action={action} className="max-w-lg space-y-5" noValidate>
      {state.error ? (
        <p className="text-sm text-maroon" role="alert">
          {state.error}
        </p>
      ) : null}

      <div className="grid gap-2">
        <Label htmlFor="topic">Topic</Label>
        <select
          id="topic"
          name="topic"
          required
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          className={selectClass}
        >
          <option value="general">General</option>
          <option value="rooms">Rooms / stay</option>
          <option value="dining">Cafe / dining</option>
          <option value="spa">Spa &amp; steam</option>
          <option value="meeting">Meeting hall</option>
          <option value="agents">Agent / trade</option>
          <option value="other">Other</option>
        </select>
      </div>

      {topic === "agents" ? (
        <p className="text-sm text-muted-foreground">
          For partnership rates, apply at{" "}
          <a href="/agents" className="underline underline-offset-4">
            /agents
          </a>
          .
        </p>
      ) : null}

      <div className="grid gap-2">
        <Label htmlFor="contact-name">Full name</Label>
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
        <Label htmlFor="message">Message</Label>
        <Textarea
          id="message"
          name="message"
          required
          rows={5}
          maxLength={2000}
          minLength={10}
        />
      </div>

      <Button type="submit" disabled={pending}>
        {pending ? "Sending…" : "Send message"}
      </Button>
    </form>
  );
}
