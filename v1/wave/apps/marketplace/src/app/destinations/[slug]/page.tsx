import Link from "next/link";

const LABELS: Record<string, string> = {
  thimphu: "Thimphu",
  paro: "Paro",
  punakha: "Punakha",
  bumthang: "Bumthang",
};

export default async function DestinationPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ checkIn?: string; checkOut?: string }>;
}) {
  const { slug } = await params;
  const sp = (await searchParams) ?? {};
  const label = LABELS[slug] ?? slug.replace(/-/g, " ");
  const qs = new URLSearchParams();
  if (sp.checkIn) qs.set("checkIn", sp.checkIn);
  if (sp.checkOut) qs.set("checkOut", sp.checkOut);
  qs.set("q", label);
  const exploreHref = `/explore?${qs.toString()}`;

  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: "48px 20px", color: "#f8fafc" }}>
      <Link href="/" style={{ color: "#94a3b8", fontSize: 14 }}>
        ← Stay Bhutan
      </Link>
      <h1 style={{ fontSize: 40, margin: "16px 0 8px" }}>{label}</h1>
      <p style={{ opacity: 0.8, lineHeight: 1.5 }}>
        Live hotel inventory for {label}. Search uses the national marketplace explore API — empty
        results mean no sellable rooms for those dates, not a stub list.
      </p>
      <Link
        href={exploreHref}
        style={{
          display: "inline-block",
          marginTop: 24,
          padding: "12px 18px",
          borderRadius: 999,
          background: "#fbbf24",
          color: "#0f172a",
          fontWeight: 700,
          textDecoration: "none",
        }}
      >
        See live rooms in {label}
      </Link>
    </main>
  );
}
