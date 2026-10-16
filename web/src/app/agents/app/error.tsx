"use client";

import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useEffect } from "react";

export default function AgentAppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("agents/app error", error);
  }, [error]);

  return (
    <div className="erp mx-auto flex min-h-[50vh] max-w-lg flex-col items-center justify-center gap-4 px-4 text-center">
      <p className="text-[11px] font-semibold tracking-[0.2em] text-sky-700 uppercase">
        Partner app
      </p>
      <h1 className="text-xl font-semibold tracking-tight">
        Something went wrong
      </h1>
      <p className="text-sm text-muted-foreground">
        Try again, or open Book / Account while this recovers.
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        <Button type="button" onClick={reset}>
          Try again
        </Button>
        <Button asChild variant="outline">
          <Link href="/agents/app/book">Hold rooms</Link>
        </Button>
        <Button asChild variant="ghost">
          <Link href="/agents/app">Account</Link>
        </Button>
      </div>
    </div>
  );
}
