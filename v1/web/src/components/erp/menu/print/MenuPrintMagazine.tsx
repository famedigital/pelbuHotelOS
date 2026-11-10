import {
  formatPrintPrice,
  type PrintMenuSection,
} from "@/lib/menu-print-templates";

type Props = {
  propertyName: string;
  outletLabel: string;
  sections: PrintMenuSection[];
  asOf: string;
};

/** Dark magazine sheet — marketing/print/menu-booklet-a4.html language. */
export function MenuPrintMagazine({
  propertyName,
  outletLabel,
  sections,
  asOf,
}: Props) {
  return (
    <article className="menu-print-sheet magazine mx-auto overflow-hidden text-[#fffaf3] shadow-2xl print:shadow-none">
      <div
        className="relative min-h-[min(100%,297mm)] px-8 py-10"
        style={{
          background:
            "radial-gradient(ellipse at 20% 0%, #2a1a12 0%, #0a0705 55%, #050302 100%)",
        }}
      >
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-1"
          style={{
            background:
              "linear-gradient(90deg, transparent, #e8a838 40%, #c45c26 60%, transparent)",
          }}
        />
        <header className="relative border-b border-[#e8a838]/35 pb-6 text-center">
          <p className="text-[10px] font-semibold tracking-[0.32em] text-[#e8a838]/90 uppercase">
            {propertyName}
          </p>
          <h1
            className="mt-3 text-4xl font-semibold tracking-tight text-[#fffaf3]"
            style={{ fontFamily: "Cormorant Garamond, Georgia, serif" }}
          >
            {outletLabel}
          </h1>
          <p className="mt-2 text-[11px] tracking-[0.12em] text-[#fffaf3]/55 uppercase">
            Menu · {asOf}
          </p>
        </header>

        <div className="relative mt-8 columns-1 gap-x-12 sm:columns-2">
          {sections.map((sec) => (
            <section key={sec.category} className="mb-8 break-inside-avoid">
              <h2
                className="mb-3 text-xl text-[#e8a838]"
                style={{ fontFamily: "Cormorant Garamond, Georgia, serif" }}
              >
                {sec.category}
              </h2>
              <ul className="space-y-3">
                {sec.items.map((item) => (
                  <li key={item.id}>
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-[13px] font-medium tracking-wide">
                        {item.name}
                        {item.is_popular ? (
                          <span className="ml-1.5 text-[9px] tracking-widest text-[#e8a838] uppercase">
                            ★
                          </span>
                        ) : null}
                      </span>
                      <span
                        className="shrink-0 text-[12px] tabular-nums text-[#e8a838]/95"
                        style={{
                          fontFamily: "Cormorant Garamond, Georgia, serif",
                        }}
                      >
                        {formatPrintPrice(item.price_btn)}
                      </span>
                    </div>
                    {item.description ? (
                      <p className="mt-0.5 text-[11px] leading-snug text-[#fffaf3]/55">
                        {item.description}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        <footer className="relative mt-10 border-t border-[#e8a838]/25 pt-4 text-center text-[10px] tracking-wide text-[#fffaf3]/45">
          Pelbu Suites · Olakha · {outletLabel} · All amounts in Ngultrum
        </footer>
      </div>
    </article>
  );
}
