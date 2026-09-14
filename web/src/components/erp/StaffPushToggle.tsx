"use client";

import { Button } from "@/components/ui/button";
import { removePushSubscription, savePushSubscription } from "@/app/actions/staff-portal";
import { useEffect, useState } from "react";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const normalized = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(normalized);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);
  return output;
}

type Status = "idle" | "unsupported" | "denied" | "on" | "working";

export function StaffPushToggle() {
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await Promise.resolve();
      if (cancelled) return;
      if (
        typeof window === "undefined" ||
        !("serviceWorker" in navigator) ||
        !("PushManager" in window) ||
        !VAPID_PUBLIC_KEY
      ) {
        setStatus("unsupported");
        return;
      }
      if (Notification.permission === "denied") {
        setStatus("denied");
        return;
      }
      const reg = await navigator.serviceWorker.getRegistration("/staff-sw.js");
      const sub = await reg?.pushManager.getSubscription();
      if (!cancelled) setStatus(sub ? "on" : "idle");
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function enable() {
    try {
      setStatus("working");
      setMessage(null);
      const registration = await navigator.serviceWorker.register("/staff-sw.js", {
        scope: "/staff",
      });
      await navigator.serviceWorker.ready;

      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus(permission === "denied" ? "denied" : "idle");
        return;
      }

      const applicationServerKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey as BufferSource,
      });

      const result = await savePushSubscription(
        JSON.stringify(subscription),
        navigator.userAgent,
      );
      if (!result.ok) {
        setMessage(result.error ?? "Could not enable notifications.");
        setStatus("idle");
        return;
      }
      setStatus("on");
      setMessage("Push alerts are on for this device.");
    } catch {
      setStatus("idle");
      setMessage("Could not enable notifications on this device.");
    }
  }

  async function disable() {
    try {
      setStatus("working");
      const registration = await navigator.serviceWorker.getRegistration("/staff-sw.js");
      const subscription = await registration?.pushManager.getSubscription();
      if (subscription) {
        await removePushSubscription(subscription.endpoint);
        await subscription.unsubscribe();
      }
      setStatus("idle");
      setMessage("Push alerts turned off.");
    } catch {
      setStatus("on");
      setMessage("Could not turn off notifications.");
    }
  }

  if (status === "unsupported") {
    return (
      <p className="text-xs text-muted-foreground">
        Push alerts are not available on this browser. Install the app to your
        home screen for the best experience.
      </p>
    );
  }

  if (status === "denied") {
    return (
      <p className="text-xs text-muted-foreground">
        Notifications are blocked. Enable them for this site in your browser
        settings to receive shift and notice alerts.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {status === "on" ? (
        <Button type="button" variant="outline" size="sm" onClick={disable}>
          Turn off push alerts
        </Button>
      ) : (
        <Button
          type="button"
          size="sm"
          onClick={enable}
          disabled={status === "working"}
        >
          {status === "working" ? "Enabling…" : "Enable push alerts"}
        </Button>
      )}
      {message ? <p className="text-xs text-muted-foreground">{message}</p> : null}
    </div>
  );
}
