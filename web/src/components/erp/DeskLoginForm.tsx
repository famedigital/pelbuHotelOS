"use client";

import { deskLogin, type DeskLoginState } from "@/app/actions/desk";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
      <Button
        type="submit"
        variant="citrus"
        disabled={pending}
        className="h-11 w-full"
      >
        {pending ? "Opening…" : "Open desk"}
      </Button>
    </form>
  );
}
