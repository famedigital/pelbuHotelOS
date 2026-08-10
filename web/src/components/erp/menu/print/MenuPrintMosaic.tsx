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

/** Dense category cards — mosaic layout. */
export function MenuPrintMosaic({
  propertyName,
  outletLabel,
  sections,
  asOf,
}: Props) {
  return (
    <article
      className="menu-print-sheet mosaic mx-auto p-6 text-[#fffaf3] shadow-xl print:shadow-none"
      style={{ background: "#0a0705" }}
    >
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3 border-b border-[#e8a838]/40 pb-4">
        <div>
          <p className="text-[10px] tracking-[0.24em] text-[#e8a838] uppercase">
            {propertyName}
          </p>
          <h1
            className="text-3xl font-semibold text-[#fffaf3]"
            style={{ fontFamily: "Cormorant Garamond, Georgia, serif" }}
          >
            {outletLabel} · categories
          </h1>
        </div>
        <p className="text-[10px] text-[#fffaf3]/50">{asOf}</p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        {sections.map((sec) => (
          <section
            key={sec.category}
            className="break-inside-avoid rounded-sm border border-[#e8a838]/22 bg-[#14100c] p-4"
          >
            <h2
              className="mb-3 border-b border-[#e8a838]/30 pb-2 text-lg text-[#e8a838]"
              style={{ fontFamily: "Cormorant Garamond, Georgia, serif" }}
            >
              {sec.category}
            </h2>
            <ul className="space-y-2">
              {sec.items.map((item) => (
                <li
                  key={item.id}
                  className="flex items-baseline justify-between gap-2 text-[12px]"
                >
                  <span className="leading-snug">{item.name}</span>
                  <span className="shrink-0 tabular-nums text-[#e8a838]/90">
                    {formatPrintPrice(item.price_btn)}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </article>
  );
}
