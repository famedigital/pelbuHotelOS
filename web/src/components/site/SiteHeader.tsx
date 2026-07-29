import Link from "next/link";
import { BRAND_ICONS } from "@/lib/brand";

const nav = [
  { href: "/rooms", label: "Rooms" },
  { href: "/dine", label: "Dine" },
  { href: "/spa", label: "Spa" },
  { href: "/meeting", label: "Meeting" },
  { href: "/agents", label: "Agents" },
] as const;

type Variant = "ink" | "bare";

/** Quiet sticky-feel header — wordmark, nav, one Book control. No brass rules. */
export function SiteHeader({
  logoSrc,
  variant = "ink",
}: {
  logoSrc?: string | null;
  variant?: Variant;
}) {
  const logo = logoSrc || BRAND_ICONS.mark;
  const onInk = variant === "ink";

  return (
    <header className="absolute inset-x-0 top-0 z-20">
      <div className="mx-auto flex max-w-[1120px] items-center justify-between gap-4 px-5 py-5 md:px-8 md:py-6">
        <Link
          href="/"
          className={`flex items-center gap-2.5 text-[13px] font-medium ${
            onInk ? "text-ivory" : "text-ink"
          }`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={logo}
            alt="Pelbu Suites"
            className="h-8 w-8 object-contain"
            width={32}
            height={32}
          />
          <span>Pelbu Suites</span>
        </Link>

        <nav
          className={`hidden items-center gap-6 text-[13px] md:flex ${
            onInk ? "text-ivory/75" : "text-ink/70"
          }`}
        >
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={
                onInk ? "transition-colors hover:text-ivory" : "hover:text-ink"
              }
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <Link
          href="/book"
          className={`inline-flex h-9 items-center rounded-md px-3.5 text-[13px] font-medium transition-colors ${
            onInk
              ? "bg-ivory text-ink hover:bg-ivory/90"
              : "bg-ink text-ivory hover:bg-ink-soft"
          }`}
        >
          Book
        </Link>
      </div>
    </header>
  );
}
