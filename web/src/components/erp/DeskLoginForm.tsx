"use client";

import { deskLogin, type DeskLoginState } from "@/app/actions/desk";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useActionState } from "react";

const initial: DeskLoginState = { ok: false };

export function DeskLoginForm() {
  const [state, action, pending] = useActionState(deskLogin, initial);

  return (
    <form action={action} className="mx-auto max-w-sm space-y-4" noValidate>
      <div className="space-y-1.5">
        <Label htmlFor="pin">Desk PIN</Label>
        <Input
          id="pin"
          type="password"
          name="pin"
          required
          autoComplete="current-password"
        />
      </div>
      {state.error ? (
        <p className="text-sm text-maroon" role="alert">
          {state.error}
        </p>
      ) : null}
      <Button
        type="submit"
        variant="gold"
        disabled={pending}
        className="min-h-11 w-full"
      >
        {pending ? "Opening…" : "Open desk"}
      </Button>
    </form>
  );
}
