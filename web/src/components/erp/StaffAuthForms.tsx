"use client";

import {
  clearLoginHotelCode,
  listDeskDepartmentStaff,
  resolveHotelCode,
  setStaffPortalPin,
  signDeskDepartmentPin,
  signDeskHotelPassword,
  staffLogin,
  type DeskGateState,
  type DeskStaffChoice,
  type ResolveHotelCodeState,
  type StaffLoginState,
} from "@/app/actions/staff-auth";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DESK_LOGIN_DEPARTMENTS,
  type DeskLoginDepartment,
} from "@/lib/desk-login-departments";
import { useActionToast } from "@/hooks/use-action-toast";
import { TriangleAlertIcon } from "lucide-react";
import { useActionState, useEffect, useState, useTransition } from "react";

const loginInitial: StaffLoginState = { ok: false };
const resolveInitial: ResolveHotelCodeState = { ok: false };
const deskGateInitial: DeskGateState = { ok: false };
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
  initialDeskPinStep = false,
}: {
  workspace?: "staff" | "desk";
  nextPath?: string | null;
  /** Code already accepted with the hotel password. Never a name. */
  initialHotelCode?: string | null;
  /** Hotel password already accepted — show the department PIN. */
  initialDeskPinStep?: boolean;
}) {
  const [hotelStep, setHotelStep] = useState<{ code: string } | null>(
    initialDeskPinStep && initialHotelCode ? { code: initialHotelCode } : null,
  );
  const [resolveState, resolveAction, resolvePending] = useActionState(
    resolveHotelCode,
    resolveInitial,
  );
  const [loginState, loginAction, loginPending] = useActionState(
    staffLogin,
    loginInitial,
  );
  const [hotelGate, hotelGateAction, hotelGatePending] = useActionState(
    signDeskHotelPassword,
    deskGateInitial,
  );
  const [pinState, pinAction, pinPending] = useActionState(
    signDeskDepartmentPin,
    deskGateInitial,
  );
  const [clearPending, startClear] = useTransition();
  const [pinStep, setPinStep] = useState(initialDeskPinStep);
  const [department, setDepartment] = useState<DeskLoginDepartment>(
    nextPath === "/erp/pos" ? "fnb" : "front_desk",
  );
  const [staffChoices, setStaffChoices] = useState<DeskStaffChoice[]>([]);
  const [staffId, setStaffId] = useState("");
  const [staffListError, setStaffListError] = useState<string | null>(null);
  const [staffLoading, setStaffLoading] = useState(false);

  useEffect(() => {
    if (hotelGate.ok && hotelGate.step === "pin") setPinStep(true);
  }, [hotelGate]);

  useEffect(() => {
    if (pinState.error && pinState.step !== "pin" && pinState.error.includes("again")) {
      setPinStep(false);
    }
  }, [pinState]);

  useEffect(() => {
    if (!pinStep || workspace !== "desk") return;
    let cancelled = false;
    setStaffLoading(true);
    setStaffListError(null);
    void listDeskDepartmentStaff(department).then((result) => {
      if (cancelled) return;
      setStaffLoading(false);
      if (!result.ok) {
        setStaffChoices([]);
        setStaffId("");
        if (result.error.includes("again")) {
          setPinStep(false);
          setHotelStep(null);
          setStaffListError(null);
          return;
        }
        setStaffListError(result.error);
        return;
      }
      setStaffChoices(result.staff);
      setStaffId((current) =>
        result.staff.some((row) => row.id === current)
          ? current
          : (result.staff[0]?.id ?? ""),
      );
    });
    return () => {
      cancelled = true;
    };
  }, [pinStep, department, workspace]);

  useEffect(() => {
    if (resolveState.ok && resolveState.hotelCode) {
      setHotelStep({ code: resolveState.hotelCode });
    }
  }, [resolveState]);

  useEffect(() => {
    if (hotelGate.ok && hotelGate.hotelCode) {
      setHotelStep({ code: hotelGate.hotelCode });
    }
  }, [hotelGate]);

  if (workspace === "desk") {
    if (!pinStep) {
      return (
        <form action={hotelGateAction} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="hotel_code">Hotel code</Label>
            <Input
              id="hotel_code"
              name="hotel_code"
              autoCapitalize="characters"
              autoComplete="organization"
              placeholder="ABC12345"
              required
              maxLength={8}
              pattern="[A-Za-z0-9]{6,8}"
              title="6–8 letters or numbers, no spaces or symbols"
              defaultValue=""
              className="h-11 uppercase tracking-wider"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="hotel_password">Password</Label>
            <Input
              id="hotel_password"
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
          {hotelGate.error ? (
            <Alert variant="destructive">
              <TriangleAlertIcon />
              <AlertDescription>{hotelGate.error}</AlertDescription>
            </Alert>
          ) : null}
          <Button
            type="submit"
            disabled={hotelGatePending}
            className="h-11 w-full"
          >
            {hotelGatePending ? "Checking…" : "Continue"}
          </Button>
        </form>
      );
    }

    return (
      <form action={pinAction} className="space-y-4" noValidate>
        {nextPath ? <input type="hidden" name="next" value={nextPath} /> : null}
        <div className="rounded-md border border-border bg-muted/40 px-3 py-2.5">
          <p className="text-xs text-muted-foreground">Hotel code</p>
          <p className="font-mono text-sm tracking-wider text-foreground">
            {hotelStep?.code ?? initialHotelCode}
          </p>
          <button
            type="button"
            className="mt-1 text-xs text-foreground underline-offset-4 hover:underline disabled:opacity-50"
            disabled={clearPending}
            onClick={() => {
              startClear(async () => {
                await clearLoginHotelCode();
                setPinStep(false);
                setHotelStep(null);
              });
            }}
          >
            Change hotel
          </button>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="department">Department</Label>
          <select
            id="department"
            name="department"
            className={selectClass}
            required
            value={department}
            onChange={(event) =>
              setDepartment(event.target.value as DeskLoginDepartment)
            }
          >
            {DESK_LOGIN_DEPARTMENTS.map((dept) => (
              <option key={dept.id} value={dept.id}>
                {dept.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="staff_id">Your name</Label>
          <select
            id="staff_id"
            name="staff_id"
            className={selectClass}
            required
            value={staffId}
            disabled={staffLoading || staffChoices.length === 0}
            onChange={(event) => setStaffId(event.target.value)}
          >
            {staffChoices.length === 0 ? (
              <option value="">
                {staffLoading ? "Loading staff…" : "No staff in this department"}
              </option>
            ) : (
              staffChoices.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.name} ({person.code})
                </option>
              ))
            )}
          </select>
          {staffListError ? (
            <p className="text-xs text-destructive">{staffListError}</p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Pick yourself. Each person uses their own PIN.
            </p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="desk_pin">Your PIN</Label>
          <Input
            id="desk_pin"
            name="desk_pin"
            type="password"
            inputMode="numeric"
            autoComplete="one-time-code"
            minLength={4}
            maxLength={8}
            required
            className="h-11"
          />
        </div>
        {pinState.error ? (
          <Alert variant="destructive">
            <TriangleAlertIcon />
            <AlertDescription>{pinState.error}</AlertDescription>
          </Alert>
        ) : null}
        <Button
          type="submit"
          disabled={pinPending || staffLoading || !staffId}
          className="h-11 w-full"
        >
          {pinPending ? "Opening…" : "Open desk"}
        </Button>
      </form>
    );
  }

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
            placeholder="ABC12345"
            required
            maxLength={8}
            pattern="[A-Za-z0-9]{6,8}"
            title="6–8 letters or numbers, no spaces or symbols"
            className="h-11 uppercase tracking-wider"
          />
          <p className="text-xs text-muted-foreground">
            Letters and numbers only. No spaces or symbols.
          </p>
        </div>
        {resolveState.error ? (
          <Alert variant="destructive">
            <TriangleAlertIcon />
            <AlertDescription>{resolveState.error}</AlertDescription>
          </Alert>
        ) : null}
        <Button type="submit" disabled={resolvePending} className="h-11 w-full">
          {resolvePending ? "Checking…" : "Continue"}
        </Button>
      </form>
    );
  }

  return (
    <form action={loginAction} className="space-y-4" noValidate>
      <input type="hidden" name="workspace" value={workspace} />
      <input type="hidden" name="hotel_code" value={hotelStep.code} />
      {nextPath ? <input type="hidden" name="next" value={nextPath} /> : null}

      <div className="rounded-md border border-border bg-muted/40 px-3 py-2.5">
        <p className="text-xs text-muted-foreground">Hotel code</p>
        <p className="font-mono text-sm tracking-wider text-foreground">
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
      <Button type="submit" disabled={loginPending} className="h-11 w-full">
        {loginPending ? "Signing in…" : "Sign in"}
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
