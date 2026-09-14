"use client";

import { setGuestBlacklist, type GuestFlagState } from "@/app/actions/erp-guests";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useActionToast } from "@/hooks/use-action-toast";
import { useActionState } from "react";

const initial: GuestFlagState = { ok: false };

export function GuestBlacklistForm({
  guestId,
  blacklisted,
  reason,
}: {
  guestId: string;
  blacklisted: boolean;
  reason: string | null;
}) {
  const [state, action, pending] = useActionState(setGuestBlacklist, initial);
  useActionToast(state, {
    successMessage: blacklisted ? "Blacklist cleared" : "Guest blacklisted",
  });

  if (guestId.startsWith("contact-")) {
    return (
      <p className="text-[10px] text-muted-foreground">
        Add a guest profile to manage blacklist.
      </p>
    );
  }

  return (
    <form action={action} className="mt-2 space-y-2">
      <input type="hidden" name="guest_id" value={guestId} />
      <input
        type="hidden"
        name="blacklisted"
        value={blacklisted ? "0" : "1"}
      />
      {!blacklisted ? (
        <Input
          name="blacklist_reason"
          placeholder="Blacklist reason"
          required
          className="h-8 text-xs"
          defaultValue={reason ?? ""}
        />
      ) : (
        <p className="text-[10px] text-destructive">
          Blacklisted{reason ? `: ${reason}` : ""}
        </p>
      )}
      <Button
        type="submit"
        size="sm"
        variant={blacklisted ? "outline" : "destructive"}
        disabled={pending}
        className="h-8 text-xs"
      >
        {pending
          ? "Saving…"
          : blacklisted
            ? "Clear blacklist"
            : "Blacklist guest"}
      </Button>
    </form>
  );
}
