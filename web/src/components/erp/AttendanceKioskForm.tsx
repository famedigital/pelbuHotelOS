"use client";

import { recordKioskAttendance } from "@/app/actions/staff-attendance";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useActionState, useEffect, useRef } from "react";

const initialState = { ok: false } as const;

export function AttendanceKioskForm() {
  const [state, action] = useActionState(recordKioskAttendance, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state.ok]);

  return (
    <form ref={formRef} action={action} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="employee_code">Employee code</Label>
        <Input
          id="employee_code"
          name="employee_code"
          autoComplete="username"
          autoCapitalize="characters"
          required
          className="h-12 text-lg uppercase"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="pin">PIN</Label>
        <Input
          id="pin"
          name="pin"
          type="password"
          inputMode="numeric"
          pattern="[0-9]{4,8}"
          minLength={4}
          maxLength={8}
          autoComplete="current-password"
          required
          className="h-12 text-lg tracking-[0.3em]"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Button type="submit" name="kind" value="clock_in" className="h-14">
          Clock in
        </Button>
        <Button
          type="submit"
          name="kind"
          value="clock_out"
          variant="outline"
          className="h-14"
        >
          Clock out
        </Button>
        <Button
          type="submit"
          name="kind"
          value="break_start"
          variant="secondary"
          className="h-12"
        >
          Start break
        </Button>
        <Button
          type="submit"
          name="kind"
          value="break_end"
          variant="secondary"
          className="h-12"
        >
          End break
        </Button>
      </div>
      {state.error ? (
        <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {state.error}
        </p>
      ) : state.message ? (
        <p className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-700">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
