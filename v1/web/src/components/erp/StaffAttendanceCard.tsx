"use client";

import { recordStaffAttendance } from "@/app/actions/staff-attendance";
import {
  allowedAttendanceEvents,
  type AttendanceKind,
} from "@/lib/attendance-types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useCallback, useEffect, useState } from "react";

type QueuedPunch = {
  kind: AttendanceKind;
  occurredAt: string;
  clientEventId: string;
  offline: true;
  latitude: number | null;
  longitude: number | null;
  accuracyMeters: number | null;
};

const QUEUE_KEY = "pelbu.staff.attendance.queue.v1";

const LABELS: Record<AttendanceKind, string> = {
  clock_in: "Clock in",
  clock_out: "Clock out",
  break_start: "Start break",
  break_end: "End break",
};

function readQueue(): QueuedPunch[] {
  try {
    const value = localStorage.getItem(QUEUE_KEY);
    return value ? (JSON.parse(value) as QueuedPunch[]) : [];
  } catch {
    return [];
  }
}

function writeQueue(queue: QueuedPunch[]): void {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

async function currentLocation(): Promise<{
  latitude: number | null;
  longitude: number | null;
  accuracyMeters: number | null;
}> {
  if (!("geolocation" in navigator)) {
    return { latitude: null, longitude: null, accuracyMeters: null };
  }
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) =>
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracyMeters: position.coords.accuracy,
        }),
      () => resolve({ latitude: null, longitude: null, accuracyMeters: null }),
      { enableHighAccuracy: false, timeout: 4_000, maximumAge: 60_000 },
    );
  });
}

export function StaffAttendanceCard({
  initialKind,
  initialOccurredAt,
}: {
  initialKind: AttendanceKind | null;
  initialOccurredAt: string | null;
}) {
  const [latestKind, setLatestKind] = useState<AttendanceKind | null>(initialKind);
  const [latestAt, setLatestAt] = useState<string | null>(initialOccurredAt);
  const [queueCount, setQueueCount] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const flushQueue = useCallback(async () => {
    if (!navigator.onLine) return;
    const queued = readQueue();
    if (!queued.length) {
      setQueueCount(0);
      return;
    }

    const remaining: QueuedPunch[] = [];
    for (const punch of queued) {
      const result = await recordStaffAttendance(punch);
      if (result.ok && result.event) {
        setLatestKind(result.event.kind);
        setLatestAt(result.event.occurredAt);
      } else {
        remaining.push(punch);
      }
    }
    writeQueue(remaining);
    setQueueCount(remaining.length);
    setMessage(
      remaining.length
        ? `${remaining.length} offline punch${remaining.length === 1 ? "" : "es"} still waiting.`
        : "Offline punches synced.",
    );
  }, []);

  useEffect(() => {
    let cancelled = false;
    void Promise.resolve().then(() => {
      if (!cancelled) setQueueCount(readQueue().length);
    });
    const onOnline = () => void flushQueue();
    window.addEventListener("online", onOnline);
    const initialSync = window.setTimeout(() => void flushQueue(), 0);
    return () => {
      cancelled = true;
      window.clearTimeout(initialSync);
      window.removeEventListener("online", onOnline);
    };
  }, [flushQueue]);

  async function punch(kind: AttendanceKind): Promise<void> {
    setBusy(true);
    setMessage(null);
    const location = await currentLocation();
    const input: QueuedPunch = {
      kind,
      occurredAt: new Date().toISOString(),
      clientEventId: crypto.randomUUID(),
      offline: true,
      ...location,
    };

    if (!navigator.onLine) {
      const queue = [...readQueue(), input];
      writeQueue(queue);
      setQueueCount(queue.length);
      setLatestKind(kind);
      setLatestAt(input.occurredAt);
      setMessage("Saved offline. It will sync automatically when connected.");
      setBusy(false);
      return;
    }

    const result = await recordStaffAttendance({ ...input, offline: false });
    if (result.ok && result.event) {
      setLatestKind(result.event.kind);
      setLatestAt(result.event.occurredAt);
      setMessage(result.message ?? "Attendance recorded.");
    } else {
      setMessage(result.error ?? "Could not record attendance.");
    }
    setBusy(false);
  }

  const allowed = allowedAttendanceEvents(latestKind);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle>Attendance</CardTitle>
        {queueCount ? <Badge variant="outline">{queueCount} waiting to sync</Badge> : null}
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="text-sm font-medium">
            {latestKind ? LABELS[latestKind] : "Not clocked in"}
          </p>
          {latestAt ? (
            <p className="text-xs text-muted-foreground">
              Last punch {new Date(latestAt).toLocaleString()}
            </p>
          ) : null}
        </div>
        <div className="grid grid-cols-2 gap-2">
          {allowed.map((kind) => (
            <Button
              key={kind}
              type="button"
              variant={kind === "clock_out" ? "outline" : "default"}
              disabled={busy}
              onClick={() => void punch(kind)}
            >
              {busy ? "Saving…" : LABELS[kind]}
            </Button>
          ))}
        </div>
        {message ? (
          <p className="text-xs text-muted-foreground" aria-live="polite">
            {message}
          </p>
        ) : null}
        <p className="text-[11px] text-muted-foreground">
          Location is captured when available. Offline punches keep their original
          time and sync within 24 hours.
        </p>
      </CardContent>
    </Card>
  );
}
