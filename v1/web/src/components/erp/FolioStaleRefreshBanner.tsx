"use client";

import { Button } from "@/components/ui/button";
import { folioPollMs } from "@/lib/free-tier";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

/** Warn when another desk updated the folio while this page is open. */
export function FolioStaleRefreshBanner({
  folioId,
  initialVersion,
}: {
  folioId: string;
  initialVersion: string;
}) {
  const router = useRouter();
  const [stale, setStale] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      if (document.visibilityState === "hidden") return;
      try {
        const res = await fetch(
          `/api/erp/folio-version?id=${encodeURIComponent(folioId)}`,
          { cache: "no-store" },
        );
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as { version?: string };
        if (data.version && data.version !== initialVersion) {
          setStale(true);
        }
      } catch {
        // ignore
      }
    };

    const id = window.setInterval(() => void poll(), folioPollMs());
    void poll();
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [folioId, initialVersion]);

  if (!stale) return null;

  return (
    <div
      role="status"
      className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-500/40 bg-amber-50/80 px-4 py-3 text-sm text-foreground dark:bg-amber-950/40"
    >
      <p>
        This folio was updated on another screen — refresh before posting
        payment or voiding lines.
      </p>
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => router.refresh()}
      >
        Refresh folio
      </Button>
    </div>
  );
}
