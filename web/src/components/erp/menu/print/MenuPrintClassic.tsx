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

export function MenuPrintClassic({
  propertyName,
  outletLabel,
  sections,
  asOf,
}: Props) {
  return (
    <article className="menu-print-sheet classic mx-auto bg-white text-neutral-900 shadow-lg print:shadow-none">
      <header className="border-b-2 border-neutral-900 px-8 pb-4 pt-10 text-center">
        <p className="text-[10px] font-semibold tracking-[0.28em] uppercase text-neutral-500">
          {propertyName}
        </p>
        <h1 className="mt-2 font-serif text-3xl font-semibold tracking-tight">
          {outletLabel} menu
        </h1>
        <p className="mt-1 text-xs text-neutral-500">Prices as of {asOf} · Nu</p>
      </header>
      <div className="columns-1 gap-10 px-8 py-6 sm:columns-2">
        {sections.map((sec) => (
          <section key={sec.category} className="mb-6 break-inside-avoid">
            <h2 className="mb-2 border-b border-neutral-300 pb-1 text-xs font-bold tracking-[0.16em] uppercase">
              {sec.category}
            </h2>
            <ul className="space-y-2">
              {sec.items.map((item) => (
                <li key={item.id} className="text-[13px] leading-snug">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-medium">
                      {item.name}
                      {item.gst_applicable ? (
                        <sup className="ml-0.5 text-[9px] text-neutral-400">
                          +GST
                        </sup>
                      ) : null}
                    </span>
                    <span className="shrink-0 font-mono text-[12px] tabular-nums">
                      {formatPrintPrice(item.price_btn)}
                    </span>
                  </div>
                  {item.description ? (
                    <p className="mt-0.5 text-[11px] text-neutral-500">
                      {item.description}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
      <footer className="px-8 pb-8 text-center text-[10px] text-neutral-400">
        Please inform staff of allergies. Tax included where not marked +GST.
      </footer>
    </article>
  );
}
