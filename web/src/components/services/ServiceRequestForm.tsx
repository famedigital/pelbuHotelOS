"use client";

import {
  createServiceRequest,
  type ServiceKind,
  type ServiceRequestState,
} from "@/app/actions/service-requests";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useActionState, useMemo, useState } from "react";

const initial: ServiceRequestState = { ok: false };

const selectClass =
  "flex h-10 w-full rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/25";

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

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

const SPA_PACKAGES = [
  "Massage 60 min",
  "Massage 90 min",
  "Steam session",
  "Treatment package — desk will advise",
] as const;

export function ServiceRequestForm({ kind }: { kind: ServiceKind }) {
  const [state, action, pending] = useActionState(createServiceRequest, initial);
  const [chargeToRoom, setChargeToRoom] = useState(false);
  const minDate = useMemo(() => todayIso(), []);
  const isMeeting = kind === "meeting";

  if (state.ok && state.requestId) {
    return (
      <div role="status" aria-live="polite" className="space-y-4">
        <h2 className="font-display text-2xl text-ink">Request received</h2>
        <p className="text-sm text-muted-foreground">
          We confirm shortly. Reference:{" "}
          <span className="font-mono text-ink">{state.requestId}</span>{" "}
          <CopyReference value={state.requestId} />
        </p>
        <Button asChild>
          <a href="/book">
            {isMeeting ? "Reserve rooms for delegates" : "Book a stay"}
          </a>
        </Button>
      </div>
    );
  }

  return (
    <form action={action} className="max-w-lg space-y-6" noValidate>
      <input type="hidden" name="kind" value={kind} />

      {state.error ? (
        <p className="text-sm text-maroon" role="alert">
          {state.error}
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="preferred-on">Preferred date</Label>
          <Input
            id="preferred-on"
            type="date"
            name="preferred_on"
            required
            min={minDate}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="preferred-time">Time (optional)</Label>
          <Input id="preferred-time" type="time" name="preferred_time" />
        </div>
      </div>

      {isMeeting ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="party-size">Attendees (max 25)</Label>
            <Input
              id="party-size"
              type="number"
              name="party_size"
              required
              min={1}
              max={25}
              defaultValue={8}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="duration-hours">Hours</Label>
            <Input
              id="duration-hours"
              type="number"
              name="duration_hours"
              required
              min={1}
              max={12}
              step={0.5}
              defaultValue={2}
            />
          </div>
        </div>
      ) : (
        <>
          <div className="grid gap-2">
            <Label htmlFor="party-size">Guests</Label>
            <Input
              id="party-size"
              type="number"
              name="party_size"
              required
              min={1}
              max={6}
              defaultValue={1}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="package-name">Package</Label>
            <select
              id="package-name"
              name="package_name"
              className={selectClass}
              defaultValue=""
            >
              <option value="">Select — rates confirmed by desk</option>
              {SPA_PACKAGES.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </div>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              name="charge_to_room"
              className="mt-1"
              checked={chargeToRoom}
              onChange={(e) => setChargeToRoom(e.target.checked)}
            />
            <span>Charge to my room folio</span>
          </label>
          {chargeToRoom ? (
            <div className="grid gap-2">
              <Label htmlFor="room-ref">Room / booking reference</Label>
              <Input
                id="room-ref"
                name="room_or_booking_ref"
                required
                maxLength={120}
              />
            </div>
          ) : (
            <input type="hidden" name="room_or_booking_ref" value="" />
          )}
        </>
      )}

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
        <Label htmlFor="notes">Notes</Label>
        <Textarea id="notes" name="notes" rows={3} maxLength={800} />
      </div>

      <Button type="submit" disabled={pending}>
        {pending
          ? "Sending…"
          : isMeeting
            ? "Send meeting enquiry"
            : "Request spa slot"}
      </Button>
    </form>
  );
}
