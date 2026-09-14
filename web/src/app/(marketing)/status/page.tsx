import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Status",
  robots: { index: true, follow: true },
};

export default function StatusPage() {
  return (
    <div className="pt-24">
      <div className="mx-auto max-w-lg px-6 py-16 md:px-10">
        <h1 className="font-display text-3xl">System status</h1>
        <div className="mt-6 rounded-md border border-[var(--mint-500)] bg-[var(--mint-100)] p-4">
          <p className="font-medium text-[var(--mint-ink)]">All systems normal</p>
          <p className="mt-1 text-sm text-[var(--muted)]">
            No active incidents reported. If your hotel Wi‑Fi or local power is
            down, that is outside Hotel OS — check fiber and power first.
          </p>
        </div>
        <p className="mt-6 text-xs text-[var(--muted)]">
          Last updated: {new Date().toISOString().slice(0, 10)} (static notice —
          replace with live probe later).
        </p>
      </div>
    </div>
  );
}
