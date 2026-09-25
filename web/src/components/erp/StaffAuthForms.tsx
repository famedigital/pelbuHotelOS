"use client";

import {
  clearLoginHotelCode,
  resolveHotelCode,
  setStaffPortalPin,
  staffLogin,
  type ResolveHotelCodeState,
  type StaffLoginState,
} from "@/app/actions/staff-auth";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ShimmerButton } from "@/components/ui/shimmer-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useActionToast } from "@/hooks/use-action-toast";
import { TriangleAlertIcon } from "lucide-react";
import { useActionState, useEffect, useState, useTransition } from "react";

const loginInitial: StaffLoginState = { ok: false };
const resolveInitial: ResolveHotelCodeState = { ok: false };
const pinInitial = {
  ok: false as boolean,
  error: undefined as string | undefined,
  message: undefined as string | undefined,
};
const selectClass =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]";

export function StaffLoginForm({
  workspace = "staff",
  nextPath,
  initialHotelCode,
  initialPropertyName,
}: {
  workspace?: "staff" | "desk";
  nextPath?: string | null;
  /** From httpOnly cookie when returning to step 2. */
  initialHotelCode?: string | null;
  initialPropertyName?: string | null;
}) {
  const [hotelStep, setHotelStep] = useState<{
    code: string;
    name: string;
  } | null>(
    initialHotelCode
      ? { code: initialHotelCode, name: initialPropertyName ?? initialHotelCode }
      : null,
  );
  const [resolveState, resolveAction, resolvePending] = useActionState(
    resolveHotelCode,
    resolveInitial,
  );
  const [loginState, loginAction, loginPending] = useActionState(
    staffLogin,
    loginInitial,
  );
  const [clearPending, startClear] = useTransition();

  useEffect(() => {
    if (resolveState.ok && resolveState.hotelCode) {
      setHotelStep({
        code: resolveState.hotelCode,
        name: resolveState.propertyName ?? resolveState.hotelCode,
      });
    }
  }, [resolveState]);

  if (!hotelStep) {
    return (
      <form action={resolveAction} className="space-y-4" noValidate>
        <div className="space-y-1.5">
          <Label htmlFor="hotel_code">Hotel code</Label>
          <Input
            id="hotel_code"
            name="hotel_code"
            autoCapitalize="characters"
            autoComplete="organization"
            placeholder="THI02001"
            required
            maxLength={8}
            pattern="[A-Za-z0-9]{6,8}"
            title="6–8 letters or numbers, no spaces or symbols"
            className="h-11 uppercase tracking-wider"
          />
          <p className="text-xs text-muted-foreground">
            Letters and numbers only (e.g. THI02001). No spaces or symbols.
          </p>
        </div>
        {resolveState.error ? (
          <Alert variant="destructive">
            <TriangleAlertIcon />
            <AlertDescription>{resolveState.error}</AlertDescription>
          </Alert>
        ) : null}
        <ShimmerButton
          type="submit"
          disabled={resolvePending}
          background="var(--citrus-500)"
          shimmerColor="#082f49"
          borderRadius="0.5rem"
          className="h-11 w-full text-sm font-semibold text-[var(--sky-ink)] border-transparent disabled:opacity-60"
        >
          {resolvePending ? "Checking…" : "Continue"}
        </ShimmerButton>
      </form>
    );
  }

  return (
    <form action={loginAction} className="space-y-4" noValidate>
      <input type="hidden" name="workspace" value={workspace} />
      <input type="hidden" name="hotel_code" value={hotelStep.code} />
      {nextPath ? <input type="hidden" name="next" value={nextPath} /> : null}

      <div className="rounded-md border border-border bg-muted/40 px-3 py-2.5">
        <p className="text-xs text-muted-foreground">Hotel</p>
        <p className="font-medium text-foreground">{hotelStep.name}</p>
        <p className="font-mono text-xs tracking-wider text-muted-foreground">
          {hotelStep.code}
        </p>
        <button
          type="button"
          className="mt-1 text-xs text-foreground underline-offset-4 hover:underline disabled:opacity-50"
          disabled={clearPending}
          onClick={() => {
            startClear(async () => {
              await clearLoginHotelCode();
              setHotelStep(null);
            });
          }}
        >
          Change hotel
        </button>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="user_id">User ID</Label>
        <Input
          id="user_id"
          name="user_id"
          autoCapitalize="characters"
          autoComplete="username"
          placeholder="OWNER"
          required
          className="h-11"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="staff_password">Password</Label>
        <Input
          id="staff_password"
          name="password"
          type="password"
          inputMode="numeric"
          autoComplete="current-password"
          minLength={4}
          maxLength={8}
          required
          className="h-11"
        />
      </div>
      {loginState.error ? (
        <Alert variant="destructive">
          <TriangleAlertIcon />
          <AlertDescription>{loginState.error}</AlertDescription>
        </Alert>
      ) : null}
      <ShimmerButton
        type="submit"
        disabled={loginPending}
        background="var(--citrus-500)"
        shimmerColor="#082f49"
        borderRadius="0.5rem"
        className="h-11 w-full text-sm font-semibold text-[var(--sky-ink)] border-transparent disabled:opacity-60"
      >
        {loginPending ? "Signing in…" : "Sign in"}
      </ShimmerButton>
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
            Required for front desk, cashier, and other ERP operators. Leave
            unchecked for staff-portal only (rota / leave). Unchecked does not
            strip desk access already granted under Team → Access.
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
