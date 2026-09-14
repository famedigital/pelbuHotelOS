"use client";

import type { MarketingCatalogueRow } from "@/lib/marketing/catalogue";

/** Temporary stub after website purge. */
export function MarketingCataloguesPanel(_props: {
  catalogues: MarketingCatalogueRow[];
  promos: { id: string; code: string; name: string }[];
}) {
  return (
    <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
      Catalogues UI stub — restore MarketingCataloguesPanel when briefed.
    </p>
  );
}
