import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="border-t border-espresso/10 bg-espresso text-ivory">
      <div className="mx-auto grid max-w-[1200px] gap-10 px-6 py-16 md:grid-cols-3 md:px-8">
        <div className="flex flex-col gap-3">
          <p className="tracking-[0.24em]">PELBU SUITES</p>
          <p className="max-w-xs text-sm text-ivory/70">
            Modern 3-star hospitality in Olakha, Thimphu — stay, dine, and gather
            under one roof.
          </p>
        </div>
        <div className="flex flex-col gap-2 text-sm text-ivory/80">
          <p className="text-ivory">Visit</p>
          <p>Olakha, Thimphu 11002</p>
          <p>Bhutan</p>
        </div>
        <div className="flex flex-col gap-2 text-sm text-ivory/80">
          <p className="text-ivory">Connect</p>
          <Link href="/book" className="hover:text-gold">
            Book a stay
          </Link>
          <Link href="/order" className="hover:text-gold">
            Order cafe & pastry
          </Link>
          <Link href="/agents" className="hover:text-gold">
            Agent portal
          </Link>
        </div>
      </div>
    </footer>
  );
}
