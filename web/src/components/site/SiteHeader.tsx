import Link from "next/link";

const nav = [
  { href: "/rooms", label: "Rooms" },
  { href: "/dine", label: "Dine" },
  { href: "/spa", label: "Spa" },
  { href: "/meeting", label: "Meeting" },
  { href: "/agents", label: "Agents" },
] as const;

export function SiteHeader() {
  return (
    <header className="absolute inset-x-0 top-0 z-20">
      <div className="mx-auto flex max-w-[1200px] items-center justify-between gap-6 px-6 py-6 md:px-8">
        <Link
          href="/"
          className="text-sm font-medium tracking-[0.28em] text-white drop-shadow"
        >
          PELBU SUITES
        </Link>
        <nav className="hidden items-center gap-8 text-sm text-white/90 md:flex">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="transition hover:text-white"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <Link
          href="/book"
          className="inline-flex min-h-11 items-center rounded-sm bg-gold px-5 text-sm font-medium text-espresso"
        >
          Book
        </Link>
      </div>
    </header>
  );
}
