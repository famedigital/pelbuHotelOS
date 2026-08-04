"use client";

import {
  agentLogin,
  setAgentPortalPin,
  type AgentLoginState,
} from "@/app/actions/agent-auth";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useActionToast } from "@/hooks/use-action-toast";
import { TriangleAlertIcon } from "lucide-react";
import { useActionState, useEffect } from "react";

const loginInitial: AgentLoginState = { ok: false };
const pinInitial = {
  ok: false as boolean,
  error: undefined as string | undefined,
  message: undefined as string | undefined,
};

const selectClass =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]";

export function AgentLoginForm() {
  const [state, action, pending] = useActionState(agentLogin, loginInitial);

  useEffect(() => {
    if (state.ok && state.redirectTo) {
      window.location.assign(state.redirectTo);
    }
  }, [state.ok, state.redirectTo]);

  const redirecting = Boolean(state.ok && state.redirectTo);

  return (
    <form action={action} className="space-y-4" noValidate>
      <div className="space-y-1.5">
        <Label htmlFor="login_code">Agent code</Label>
        <Input
          id="login_code"
          name="login_code"
          autoCapitalize="characters"
          autoComplete="username"
          placeholder="AG-0001"
          required
          className="h-11"
          disabled={pending || redirecting}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="agent_pin">PIN</Label>
        <Input
          id="agent_pin"
          name="pin"
          type="password"
          inputMode="numeric"
          autoComplete="current-password"
          minLength={4}
          maxLength={8}
          required
          className="h-11"
          disabled={pending || redirecting}
        />
      </div>
      {state.error ? (
        <Alert variant="destructive">
          <TriangleAlertIcon />
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}
      {redirecting ? (
        <p className="text-sm text-muted-foreground">
          Signed in. Opening portal…
          {state.redirectTo ? (
            <>
              {" "}
              <a href={state.redirectTo} className="underline underline-offset-4">
                Continue
              </a>
            </>
          ) : null}
        </p>
      ) : null}
      <Button type="submit" disabled={pending || redirecting} className="h-11 w-full">
        {redirecting ? "Opening…" : pending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}

export function AgentPinProvisionForm({
  agents,
}: {
  agents: Array<{ id: string; label: string }>;
}) {
  const [state, action, pending] = useActionState(setAgentPortalPin, pinInitial);
  useActionToast(state, { successMessage: "Agent login enabled" });

  return (
    <form action={action} className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="pin_agent_id">Agent</Label>
        <select id="pin_agent_id" name="agent_id" className={selectClass} required>
          <option value="">Select agent…</option>
          {agents.map((agent) => (
            <option key={agent.id} value={agent.id}>
              {agent.label}
            </option>
          ))}
        </select>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="new_agent_pin">New PIN (4–8 digits)</Label>
          <Input
            id="new_agent_pin"
            name="pin"
            type="password"
            inputMode="numeric"
            minLength={4}
            maxLength={8}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="confirm_agent_pin">Confirm PIN</Label>
          <Input
            id="confirm_agent_pin"
            name="confirm_pin"
            type="password"
            inputMode="numeric"
            minLength={4}
            maxLength={8}
            required
          />
        </div>
      </div>
      <Button type="submit" disabled={pending || agents.length === 0}>
        {pending ? "Saving…" : "Enable agent app login"}
      </Button>
      {state.error || state.message ? (
        <p
          className={`text-sm ${state.ok ? "text-foreground" : "text-destructive"}`}
        >
          {state.message ?? state.error}
        </p>
      ) : null}
    </form>
  );
}
