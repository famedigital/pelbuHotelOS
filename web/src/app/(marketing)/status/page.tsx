import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Status",
  robots: { index: true, follow: true },
};

export default function StatusPage() {
  return (
    <div className="mx-auto max-w-xl px-6 pb-16 pt-28 md:px-10">
      <h1 className="font-display text-4xl tracking-tight">System status</h1>
      <p className="mt-6 text-lg">All systems normal.</p>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
        Hotel Wi-Fi and power are outside Innora. If the desk cannot reach the
        network, check fiber and power first.
      </p>
      <p className="mt-6 text-xs text-muted-foreground">
        Last updated: {new Date().toISOString().slice(0, 10)}. This is a static
        notice.
      </p>
    </div>
  );
}
