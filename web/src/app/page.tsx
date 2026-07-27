export default function Home() {
  return (
    <div className="min-h-screen bg-ivory text-espresso">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-6">
        <p className="text-xl tracking-[0.2em]">PELBU SUITES</p>
        <p className="text-sm text-muted">Olakha · Thimphu · template_id 1</p>
      </header>

      <main className="mx-auto flex max-w-5xl flex-col gap-12 px-6 pb-24 pt-16">
        <section className="flex flex-col gap-6">
          <h1 className="max-w-2xl text-4xl leading-tight tracking-tight md:text-5xl">
            Stay. Dine. Gather.
            <span className="block text-maroon">Modern Bhutanese hospitality.</span>
          </h1>
          <p className="max-w-xl text-lg text-muted">
            Flagship scaffold is live. Review UX mockups, then we build the full
            conversion site and hotel OS.
          </p>
          <div className="flex flex-wrap gap-3">
            <a
              href="#streams"
              className="inline-flex min-h-11 items-center rounded-sm bg-gold px-5 text-sm font-medium text-espresso"
            >
              Explore streams
            </a>
            <span className="inline-flex min-h-11 items-center rounded-sm border border-espresso/20 px-5 text-sm text-muted">
              Mockups → /design/mockups
            </span>
          </div>
        </section>

        <section id="streams" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[
            "Rooms",
            "Cafe & Pastry",
            "Restaurant",
            "Bar",
            "Spa & Steam",
            "Meeting",
          ].map((label) => (
            <div
              key={label}
              className="border border-espresso/10 bg-white/50 px-5 py-8"
            >
              <p className="text-sm tracking-wide text-maroon">Stream</p>
              <p className="mt-2 text-xl">{label}</p>
            </div>
          ))}
        </section>
      </main>
    </div>
  );
}
