"use client";

import { fetchBookingDetail } from "@/app/actions/booking-detail";
import { BookingDetailPanel } from "@/components/erp/BookingDetailPanel";
import { useEffect, useState } from "react";

export function BookingDetailPanelLoader({
  bookingId,
  compact = false,
  showDossierLink = true,
}: {
  bookingId: string;
  compact?: boolean;
  showDossierLink?: boolean;
}) {
  const [state, setState] = useState<
    "idle" | "loading" | "ready" | "error"
  >("idle");
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<
    Awaited<ReturnType<typeof fetchBookingDetail>>["data"] | null
  >(null);

  useEffect(() => {
    let cancelled = false;
    setState("loading");
    setError(null);

    fetchBookingDetail(bookingId).then((result) => {
      if (cancelled) return;
      if (result.ok && result.data) {
        setData(result.data);
        setState("ready");
      } else {
        setError(result.error ?? "Could not load booking");
        setState("error");
      }
    });

    return () => {
      cancelled = true;
    };
  }, [bookingId]);

  if (state === "loading" || state === "idle") {
    return (
      <p className="py-4 text-sm text-muted-foreground">Loading details…</p>
    );
  }

  if (state === "error" || !data) {
    return (
      <p className="py-4 text-sm text-destructive">
        {error ?? "Could not load booking"}
      </p>
    );
  }

  return (
    <BookingDetailPanel
      data={data}
      compact={compact}
      showDossierLink={showDossierLink}
    />
  );
}
