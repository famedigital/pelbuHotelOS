"use client";

import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useEffect } from "react";

export default function ErpError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[erp]", error);
  }, [error]);

  return (
    <div className="erp flex min-h-[60vh] flex-col items-center justify-center gap-4 p-6 text-center">
      <p className="text-[11px] font-semibold tracking-[0.18em] text-accent uppercase">
        Desk error
      </p>
      <h1 className="text-xl font-semibold tracking-tight">
        Something went wrong on this screen
      </h1>
      <p className="max-w-md text-sm text-muted-foreground">
        Your session is still active. Retry this screen or jump back to the room
        rack while we recover.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button type="button" onClick={() => reset()}>
          Try again
        </Button>
        <Button asChild variant="outline">
          <Link href="/erp/calendar">Open calendar</Link>
        </Button>
        <Button asChild variant="ghost">
          <Link href="/erp">Desk home</Link>
        </Button>
      </div>
    </div>
  );
}
