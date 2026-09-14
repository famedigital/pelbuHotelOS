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

/** A5 brochure — marketing/print/brochure-fnb-a5.html scale. */
export function MenuPrintBrochure({
  propertyName,
  outletLabel,
  sections,
  asOf,
}: Props) {
  return (
    <article
      className="menu-print-sheet brochure mx-auto shadow-lg print:shadow-none"
      style={{
        width: "148mm",
        minHeight: "210mm",
        background: "#fff6ea",
        color: "#1a0f0a",
      }}
    >
      <header
        className="px-6 pb-4 pt-8 text-center text-[#fffaf3]"
        style={{
          background: "linear-gradient(160deg, #c45c26 0%, #0f6e63 100%)",
        }}
      >
        <p className="text-[9px] font-semibold tracking-[0.22em] uppercase opacity-90">
          {propertyName}
        </p>
        <h1
          className="mt-1 text-2xl font-semibold"
          style={{ fontFamily: "Cormorant Garamond, Georgia, serif" }}
        >
          {outletLabel}
        </h1>
        <p className="mt-1 text-[10px] opacity-80">{asOf}</p>
      </header>

      <div className="space-y-5 px-5 py-5">
        {sections.map((sec) => (
          <section key={sec.category}>
            <h2
              className="mb-2 text-base font-semibold text-[#0f6e63]"
              style={{ fontFamily: "Cormorant Garamond, Georgia, serif" }}
            >
              {sec.category}
            </h2>
            <ul className="space-y-1.5">
              {sec.items.map((item) => (
                <li
                  key={item.id}
                  className="flex items-baseline justify-between gap-2 border-b border-[#e8d5b8] pb-1 text-[11px]"
                >
                  <span className="font-medium leading-snug">{item.name}</span>
                  <span className="shrink-0 tabular-nums text-[#c45c26]">
                    {formatPrintPrice(item.price_btn)}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <footer className="px-5 pb-6 text-center text-[9px] text-[#5c4033]">
        Order at counter · QR menu also on pelbusuites.bt
      </footer>
    </article>
  );
}
