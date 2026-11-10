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

/** Ivory editorial — marketing/print/menu-booklet-editorial-a4.html. */
export function MenuPrintEditorial({
  propertyName,
  outletLabel,
  sections,
  asOf,
}: Props) {
  return (
    <article
      className="menu-print-sheet editorial mx-auto shadow-lg print:shadow-none"
      style={{ background: "#faf7f2", color: "#1a100c" }}
    >
      <header className="px-10 pb-6 pt-12 text-center">
        <p className="text-[10px] font-semibold tracking-[0.3em] text-[#b85420] uppercase">
          {propertyName}
        </p>
        <h1
          className="mt-3 text-[2.5rem] font-semibold leading-none tracking-tight"
          style={{ fontFamily: "Cormorant Garamond, Georgia, serif" }}
        >
          {outletLabel}
        </h1>
        <div
          className="mx-auto mt-4 h-px w-24"
          style={{ background: "linear-gradient(90deg, transparent, #c9a227, transparent)" }}
        />
        <p className="mt-3 text-[11px] text-[#6b5850]">Updated {asOf}</p>
      </header>

      <div className="columns-1 gap-x-12 px-10 pb-10 sm:columns-2">
        {sections.map((sec) => (
          <section key={sec.category} className="mb-8 break-inside-avoid">
            <h2
              className="mb-3 text-lg font-semibold italic text-[#b85420]"
              style={{ fontFamily: "Cormorant Garamond, Georgia, serif" }}
            >
              {sec.category}
            </h2>
            <ul className="space-y-3">
              {sec.items.map((item) => (
                <li key={item.id} className="border-b border-[#e8ddd0] pb-2">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-[13px] font-medium">
                      {item.name}
                      {item.name_dz ? (
                        <span className="ml-1.5 text-[11px] font-normal text-[#8a7060]">
                          · {item.name_dz}
                        </span>
                      ) : null}
                    </span>
                    <span className="shrink-0 font-serif text-[13px] tabular-nums text-[#1a100c]">
                      {formatPrintPrice(item.price_btn)}
                    </span>
                  </div>
                  {item.description ? (
                    <p className="mt-1 text-[11px] leading-relaxed text-[#6b5850]">
                      {item.description}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <footer className="px-10 pb-10 text-center text-[10px] tracking-[0.14em] text-[#8a7060] uppercase">
        Kindly inform the team of allergies · GST as marked
      </footer>
    </article>
  );
}
