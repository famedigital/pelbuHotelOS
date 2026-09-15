"use client";

import { deskLogin, type DeskLoginState } from "@/app/actions/desk";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ShimmerButton } from "@/components/ui/shimmer-button";
import { TriangleAlertIcon } from "lucide-react";
import { useActionState } from "react";

const initial: DeskLoginState = { ok: false };

export function DeskLoginForm() {
  const [state, action, pending] = useActionState(deskLogin, initial);

  return (
    <form action={action} className="erp mx-auto max-w-sm space-y-4" noValidate>
      <div className="space-y-1.5">
        <Label htmlFor="pin">Desk PIN</Label>
        <Input
          id="pin"
          type="password"
          name="pin"
          required
          autoComplete="current-password"
          className="h-10"
        />
      </div>
      {state.error ? (
        <Alert variant="destructive">
          <TriangleAlertIcon />
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}
      <ShimmerButton
        type="submit"
        disabled={pending}
        background="var(--citrus-500)"
        shimmerColor="#082f49"
        borderRadius="0.5rem"
        className="h-11 w-full text-sm font-semibold text-[var(--sky-ink)] border-transparent disabled:opacity-60"
      >
        {pending ? "Opening…" : "Open desk"}
      </ShimmerButton>
    </form>
  );
}
