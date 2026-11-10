import { AttendanceDeviceForm } from "@/components/erp/AttendanceDeviceForm";
import {
  BiometricStaffLinkForm,
  type ClockStaffOption,
} from "@/components/erp/BiometricStaffLinkForm";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export type ClockDeviceRow = {
  id: string;
  name: string;
  serial: string | null;
  lastSeenLabel: string;
};

export type UnmatchedPunchRow = {
  id: string;
  pin: string;
  whenLabel: string;
};

export function NetworkClockPanel({
  clockHost,
  devices,
  staff,
  suggestions,
  unmatched,
}: {
  clockHost: string;
  devices: ClockDeviceRow[];
  staff: ClockStaffOption[];
  suggestions: string[];
  unmatched: UnmatchedPunchRow[];
}) {
  const linked = staff.filter((member) => member.biometricUserId);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Network fingerprint clock</CardTitle>
        <CardDescription>
          ZKTeco, eSSL, and similar clocks push arrival and departure here.
          Fingerprints stay on the clock.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
          <li>Register the clock with the serial number printed on it.</li>
          <li>
            In the clock&apos;s cloud or ADMS menu, set the server address to{" "}
            <span className="font-medium text-foreground">{clockHost}</span>.
            The clock calls <code>/iclock/cdata</code>. If it asks for a port,
            use 443. A clock that only speaks plain HTTP needs port 80
            forwarded to this server.
          </li>
          <li>
            Set each person&apos;s clock user ID to the user number stored on
            the clock.
          </li>
        </ol>

        {devices.length > 0 ? (
          <ul className="space-y-2 text-sm">
            {devices.map((device) => (
              <li
                key={device.id}
                className="flex flex-wrap items-baseline justify-between gap-2"
              >
                <span>
                  <span className="font-medium">{device.name}</span>
                  <span className="text-muted-foreground">
                    {" "}
                    · {device.serial ? `SN ${device.serial}` : "No serial number"}
                  </span>
                </span>
                <span className="text-muted-foreground">{device.lastSeenLabel}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No clock registered yet.</p>
        )}

        <AttendanceDeviceForm />

        <div className="space-y-3">
          <h2 className="text-sm font-medium">Clock user IDs</h2>
          {linked.length > 0 ? (
            <ul className="space-y-1 text-sm text-muted-foreground">
              {linked.map((member) => (
                <li key={member.id}>
                  {member.fullName} · {member.employeeCode} · clock{" "}
                  {member.biometricUserId}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              No clock user IDs linked yet.
            </p>
          )}
          {staff.length > 0 ? (
            <BiometricStaffLinkForm staff={staff} suggestions={suggestions} />
          ) : (
            <p className="text-sm text-muted-foreground">
              Add staff before linking clock user IDs.
            </p>
          )}
        </div>

        {unmatched.length > 0 ? (
          <div className="space-y-2">
            <h2 className="text-sm font-medium">Punches waiting for a staff link</h2>
            <ul className="space-y-1 text-sm text-muted-foreground">
              {unmatched.map((row) => (
                <li key={row.id}>
                  Clock user{" "}
                  <span className="font-mono text-foreground">{row.pin}</span> at{" "}
                  {row.whenLabel}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
