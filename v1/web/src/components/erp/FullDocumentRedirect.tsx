"use client";

import { useEffect } from "react";

/** Full page load. A soft redirect() keeps the login layout, which has no menu. */
export function FullDocumentRedirect({ href }: { href: string }) {
  useEffect(() => {
    window.location.replace(href);
  }, [href]);

  return (
    <main className="erp flex min-h-svh items-center justify-center bg-background px-6">
      <p className="text-sm text-muted-foreground">Opening the desk…</p>
    </main>
  );
}
