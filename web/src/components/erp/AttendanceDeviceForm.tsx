"use client";

import { createAttendanceDevice } from "@/app/actions/staff-attendance";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useActionState } from "react";

const initialState = { ok: false } as const;

export function AttendanceDeviceForm() {
  const [state, action] = useActionState(createAttendanceDevice, initialState);

  return (
    <form action={action} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="device-name">Device name</Label>
          <Input
            id="device-name"
            name="name"
            placeholder="Lobby fingerprint clock"
            required
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="device-type">Type</Label>
          <select
            id="device-type"
            name="device_type"
            className="h-10 w-full rounded-md border bg-background px-3 text-sm"
            defaultValue="biometric"
          >
            <option value="biometric">Biometric clock</option>
            <option value="integration">Attendance integration</option>
          </select>
        </div>
      </div>
      <div className="space-y-1">
        <Label htmlFor="external-ref">Vendor device ID (optional)</Label>
        <Input id="external-ref" name="external_ref" maxLength={100} />
      </div>
      <Button type="submit" variant="outline">
        Register device
      </Button>
      {state.error ? (
        <p className="text-sm text-destructive">{state.error}</p>
      ) : null}
      {state.ok && state.deviceId && state.secret ? (
        <div className="space-y-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
          <p className="font-medium">{state.message}</p>
          <p>
            Device ID: <code className="break-all">{state.deviceId}</code>
          </p>
          <p>
            Secret: <code className="break-all">{state.secret}</code>
          </p>
        </div>
      ) : null}
    </form>
  );
}
