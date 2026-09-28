"use client";

import { setStaffBiometricId } from "@/app/actions/staff-attendance";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useActionState } from "react";

export type ClockStaffOption = {
  id: string;
  fullName: string;
  employeeCode: string;
  biometricUserId: string | null;
};

const initialState = { ok: false } as const;

export function BiometricStaffLinkForm({
  staff,
  suggestions,
}: {
  staff: ClockStaffOption[];
  suggestions: string[];
}) {
  const [state, action] = useActionState(setStaffBiometricId, initialState);

  return (
    <form action={action} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="clock-staff">Staff member</Label>
          <select
            id="clock-staff"
            name="staff_id"
            required
            className="h-10 w-full rounded-md border bg-background px-3 text-sm"
            defaultValue={staff[0]?.id}
          >
            {staff.map((member) => (
              <option key={member.id} value={member.id}>
                {member.fullName} ({member.employeeCode})
                {member.biometricUserId ? ` · clock ${member.biometricUserId}` : ""}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="clock-user-id">Clock user ID</Label>
          <Input
            id="clock-user-id"
            name="biometric_user_id"
            placeholder="User number on the clock"
            maxLength={24}
            autoComplete="off"
            list={suggestions.length > 0 ? "clock-user-ids" : undefined}
          />
          {suggestions.length > 0 ? (
            <datalist id="clock-user-ids">
              {suggestions.map((pin) => (
                <option key={pin} value={pin} />
              ))}
            </datalist>
          ) : null}
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Leave the user ID blank and save to remove the link.
      </p>
      <Button type="submit" variant="outline">
        Save clock user ID
      </Button>
      {state.error ? (
        <p className="text-sm text-destructive">{state.error}</p>
      ) : null}
      {state.ok && state.message ? (
        <p className="text-sm text-muted-foreground">{state.message}</p>
      ) : null}
    </form>
  );
}
