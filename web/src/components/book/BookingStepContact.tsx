"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function BookingStepContact() {
  return (
    <fieldset className="space-y-5">
      <legend className="sr-only">Contact details</legend>

      <div className="grid gap-2">
        <Label htmlFor="contact-name">Full name</Label>
        <Input
          id="contact-name"
          type="text"
          name="contact_name"
          required
          autoComplete="name"
          maxLength={120}
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
          <Label htmlFor="contact-email">
            Email <span className="text-muted-foreground">(optional)</span>
          </Label>
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
        <Label htmlFor="guide-number">
          Guide number{" "}
          <span className="text-muted-foreground">
            (if traveling with a guide)
          </span>
        </Label>
        <Input
          id="guide-number"
          type="text"
          name="guide_number"
          maxLength={64}
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="notes">Notes</Label>
        <Textarea
          id="notes"
          name="notes"
          rows={3}
          maxLength={800}
          placeholder="Arrival time, room preference, dietary needs…"
        />
      </div>
    </fieldset>
  );
}
