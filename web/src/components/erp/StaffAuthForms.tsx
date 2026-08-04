"use client";

import { setStaffPortalPin, staffLogin, type StaffLoginState } from "@/app/actions/staff-auth";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useActionToast } from "@/hooks/use-action-toast";
import { TriangleAlertIcon } from "lucide-react";
import { useActionState, useEffect } from "react";

const loginInitial: StaffLoginState = { ok: false };
const pinInitial = { ok: false as boolean, error: undefined as string | undefined, message: undefined as string | undefined };
const selectClass =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]";

export function StaffLoginForm() {
  const [state, action, pending] = useActionState(staffLogin, loginInitial);

  // Hard navigation after cookies land. Soft App Router redirects can fetch
  // /erp RSC before the browser applies Set-Cookie from the action response.
  useEffect(() => {
    if (state.ok && state.redirectTo) {
      window.location.assign(state.redirectTo);
    }
  }, [state.ok, state.redirectTo]);

  const redirecting = Boolean(state.ok && state.redirectTo);

  return (
    <form action={action} className="space-y-4" noValidate>
      <div className="space-y-1.5">
        <Label htmlFor="employee_code">Employee code</Label>
        <Input
          id="employee_code"
          name="employee_code"
          autoCapitalize="characters"
          autoComplete="username"
          placeholder="EMP-0001"
          required
          className="h-11"
          disabled={pending || redirecting}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="staff_pin">PIN</Label>
        <Input
          id="staff_pin"
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
          Signed in. Opening desk…
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
      <Button
        type="submit"
        variant="citrus"
        disabled={pending || redirecting}
        className="h-11 w-full"
      >
        {redirecting ? "Opening…" : pending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}

export function StaffPinProvisionForm({
  staff,
}: {
  staff: Array<{ id: string; employeeCode: string; name: string }>;
}) {
  const [state, action, pending] = useActionState(setStaffPortalPin, pinInitial);
  useActionToast(state, { successMessage: "Staff PIN saved" });

  return (
    <form action={action} className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="pin_staff_id">Staff member</Label>
        <select id="pin_staff_id" name="staff_id" className={selectClass} required>
          <option value="">Select staff…</option>
          {staff.map((person) => (
            <option key={person.id} value={person.id}>
              {person.employeeCode} · {person.name}
            </option>
          ))}
        </select>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="new_staff_pin">New PIN (4–8 digits)</Label>
          <Input
            id="new_staff_pin"
            name="pin"
            type="password"
            inputMode="numeric"
            minLength={4}
            maxLength={8}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="confirm_staff_pin">Confirm PIN</Label>
          <Input
            id="confirm_staff_pin"
            name="confirm_pin"
            type="password"
            inputMode="numeric"
            minLength={4}
            maxLength={8}
            required
          />
        </div>
      </div>
      <label className="flex items-start gap-3 rounded-md border border-input px-3 py-3 text-sm">
        <input
          type="checkbox"
          name="can_access_desk"
          className="mt-1 size-4 rounded border"
        />
        <span>
          <span className="font-medium">Also allow hotel desk (/erp)</span>
          <span className="mt-1 block text-muted-foreground">
            Dual-auth Work access. Shared DESK_PIN still works for the whole
            front desk.
          </span>
        </span>
      </label>
      <Button type="submit" disabled={pending || staff.length === 0}>
        {pending ? "Saving…" : "Enable staff portal login"}
      </Button>
      {state.error || state.message ? (
        <p className={`text-sm ${state.ok ? "text-foreground" : "text-destructive"}`}>
          {state.message ?? state.error}
        </p>
      ) : null}
    </form>
  );
}
