import type { Metadata } from "next";
import { MarketingPageBanner } from "@/components/marketing/MarketingPageBanner";
import { MarketingReveal } from "@/components/marketing/MarketingReveal";
import { MARKETING_MEDIA } from "@/lib/marketing-assets";

export const metadata: Metadata = {
  title: "Status",
  robots: { index: true, follow: true },
};

export default function StatusPage() {
  return (
    <>
      <MarketingPageBanner
        media={MARKETING_MEDIA.heroLobby}
        title="System status"
        description="Live service notice for Innora hotels."
      />
      <div className="mx-auto max-w-lg px-6 py-14 md:px-10">
        <MarketingReveal>
          <div className="rounded-2xl border border-primary/30 bg-secondary p-5">
            <p className="font-medium text-foreground">All systems normal</p>
            <p className="mt-1 text-sm text-muted-foreground">
              No active incidents reported. If your hotel Wi‑Fi or local power is
              down, that is outside Innora — check fiber and power first.
            </p>
          </div>
          <p className="mt-6 text-xs text-muted-foreground">
            Last updated: {new Date().toISOString().slice(0, 10)} (static notice —
            replace with live probe later).
          </p>
        </MarketingReveal>
      </div>
    </>
  );
}
