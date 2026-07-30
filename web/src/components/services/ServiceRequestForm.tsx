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
import { formatBtn } from "@/lib/pricing";
import type { ServiceOffering } from "@/lib/service-offerings";
import { Clock3Icon, UsersRoundIcon } from "lucide-react";
import { useActionState, useMemo, useState } from "react";

const initial: ServiceRequestState = { ok: false };

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

export function ServiceRequestForm({
  kind,
  offerings,
}: {
  kind: ServiceKind;
  offerings: ServiceOffering[];
}) {
  const [state, action, pending] = useActionState(createServiceRequest, initial);
  const [chargeToRoom, setChargeToRoom] = useState(false);
  const [selectedOfferingId, setSelectedOfferingId] = useState(
    offerings[0]?.id ?? "",
  );
  const minDate = useMemo(() => todayIso(), []);
  const isMeeting = kind === "meeting";
  const selectedOffering =
    offerings.find((offering) => offering.id === selectedOfferingId) ?? null;

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
    <form action={action} className="max-w-3xl space-y-8" noValidate>
      <input
        type="hidden"
        name="kind"
        value={selectedOffering?.kind ?? kind}
      />
      <input
        type="hidden"
        name="package_name"
        value={selectedOffering?.name ?? ""}
      />
      <input
        type="hidden"
        name="offering_id"
        value={selectedOffering?.id ?? ""}
      />

      {state.error ? (
        <p className="text-sm text-maroon" role="alert">
          {state.error}
        </p>
      ) : null}

      {offerings.length > 0 ? (
        <fieldset className="space-y-3">
          <legend className="text-sm font-medium text-ink">
            {isMeeting ? "Choose a room layout" : "Choose an experience"}
          </legend>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {offerings.map((offering) => {
              const selected = offering.id === selectedOfferingId;
              return (
                <label
                  key={offering.id}
                  className={[
                    "relative cursor-pointer overflow-hidden rounded-2xl border bg-card transition-colors",
                    selected
                      ? "border-primary ring-2 ring-primary/15"
                      : "border-border hover:border-primary/40",
                  ].join(" ")}
                >
                  <input
                    type="radio"
                    name="offering"
                    value={offering.id}
                    checked={selected}
                    onChange={() => setSelectedOfferingId(offering.id)}
                    className="sr-only"
                  />
                  {offering.imageSrc ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={offering.imageSrc}
                      alt=""
                      width={480}
                      height={260}
                      className="aspect-[16/9] w-full object-cover"
                    />
                  ) : null}
                  <span className="block p-4">
                    <span className="block text-sm font-semibold">
                      {offering.name}
                    </span>
                    {offering.description ? (
                      <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
                        {offering.description}
                      </span>
                    ) : null}
                    <span className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
                      {offering.durationMinutes ? (
                        <span className="inline-flex items-center gap-1">
                          <Clock3Icon className="size-3.5" />
                          {offering.durationMinutes} min
                        </span>
                      ) : null}
                      {offering.capacity ? (
                        <span className="inline-flex items-center gap-1">
                          <UsersRoundIcon className="size-3.5" />
                          Up to {offering.capacity}
                        </span>
                      ) : null}
                      <span>
                        {offering.priceBtn == null
                          ? "Rate confirmed before booking"
                          : formatBtn(offering.priceBtn)}
                      </span>
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>
      ) : (
        <p className="rounded-xl border border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
          Choose your preferred date and describe the treatment or layout in
          notes. The desk will confirm available options.
        </p>
      )}

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
            <Label htmlFor="party-size">
              Attendees
              {selectedOffering?.capacity
                ? ` (max ${selectedOffering.capacity})`
                : ""}
            </Label>
            <Input
              id="party-size"
              type="number"
              name="party_size"
              required
              min={1}
              max={selectedOffering?.capacity ?? 40}
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
              max={selectedOffering?.capacity ?? 6}
              defaultValue={1}
            />
          </div>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              name="charge_to_room"
              className="mt-1"
              checked={chargeToRoom}
              onChange={(e) => setChargeToRoom(e.target.checked)}
            />
            <span>
              Charge to my in-house room folio
              <span className="mt-1 block text-xs text-muted-foreground">
                Requires your current room number or booking reference and the
                phone used for the stay. The desk still confirms before posting.
              </span>
            </span>
          </label>
          {chargeToRoom ? (
            <div className="grid gap-2">
              <Label htmlFor="room-ref">Room number or booking reference</Label>
              <Input
                id="room-ref"
                name="room_or_booking_ref"
                required
                maxLength={120}
                placeholder="e.g. 204 or booking code"
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
