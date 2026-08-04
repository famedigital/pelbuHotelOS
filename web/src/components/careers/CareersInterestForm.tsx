"use client";

import {
  submitVacancyInterest,
  type VacancyActionState,
} from "@/app/actions/erp-vacancies";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useActionState } from "react";

const initial: VacancyActionState = { ok: false };

export function CareersInterestForm({ vacancyId }: { vacancyId: string }) {
  const [state, action, pending] = useActionState(submitVacancyInterest, initial);

  if (state.ok) {
    return (
      <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
        {state.message ??
          "Thanks — we’ll call you on WhatsApp or phone if there’s a good fit."}
      </p>
    );
  }

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="vacancy_id" value={vacancyId} />
      {/* Honeypot */}
      <div className="absolute -left-[9999px] opacity-0" aria-hidden>
        <Label htmlFor={`company_${vacancyId}`}>Company website</Label>
        <Input
          id={`company_${vacancyId}`}
          name="company_website"
          tabIndex={-1}
          autoComplete="off"
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={`name_${vacancyId}`}>Full name</Label>
          <Input
            id={`name_${vacancyId}`}
            name="full_name"
            required
            className="min-h-11"
            autoComplete="name"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`phone_${vacancyId}`}>Phone / WhatsApp</Label>
          <Input
            id={`phone_${vacancyId}`}
            name="phone"
            type="tel"
            required
            className="min-h-11"
            autoComplete="tel"
          />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor={`email_${vacancyId}`}>Email (optional)</Label>
          <Input
            id={`email_${vacancyId}`}
            name="email"
            type="email"
            className="min-h-11"
            autoComplete="email"
          />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor={`msg_${vacancyId}`}>Short note (optional)</Label>
          <Textarea
            id={`msg_${vacancyId}`}
            name="message"
            rows={3}
            placeholder="Experience, availability, languages…"
          />
        </div>
      </div>
      {state.error ? (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      ) : null}
      <Button type="submit" disabled={pending} className="min-h-11">
        {pending ? "Sending…" : "Express interest"}
      </Button>
    </form>
  );
}
