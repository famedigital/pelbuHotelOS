import type { RateSheetPack } from "../lib/rate-sheet-share";

function formatNu(n: number): string {
  return `Nu. ${Math.round(n).toLocaleString("en-IN")}`;
}

const SEASON_LABEL: Record<string, string> = {
  peak: "Peak season",
  lean: "Lean season",
};

const MEAL_LABEL: Record<string, string> = {
  EP: "European Plan (room only)",
  CP: "Continental Plan (BB)",
  MAP: "Modified American Plan (HB)",
  AP: "American Plan (FB)",
};

type Props = {
  pack: RateSheetPack;
  /** When true, sheet is the only printable surface (share route / print modal) */
  printRoot?: boolean;
};

export function RateSheetPrintView({ pack, printRoot = false }: Props) {
  const multiCard = pack.cards.length > 1;

  return (
    <div
      id={printRoot ? "hos-print-root" : undefined}
      className="hos-rate-sheet-print"
      data-confidential={pack.confidential ? "1" : "0"}
    >
      <style>{PRINT_CSS}</style>
      <article className="rs-sheet">
        <div className="rs-inner">
          <div className="rs-top-bar" aria-hidden />

          <header className="rs-header">
            <div className="rs-brand">
              <img src={pack.brand.logoUrl} alt="" width={52} height={52} />
              <div className="rs-brand-text">
                <h1>
                  {pack.brand.name.split(" ")[0]}{" "}
                  <span>{pack.brand.name.split(" ").slice(1).join(" ") || "Hotel"}</span>
                </h1>
                <p>{pack.brand.tagline}</p>
              </div>
            </div>
            <div className="rs-season-badge">
              <div className="rs-label">Rate card</div>
              <div className="rs-title">{SEASON_LABEL[pack.season] ?? pack.season}</div>
              <div className="rs-sub">{MEAL_LABEL[pack.mealPlan] ?? pack.mealPlan}</div>
            </div>
          </header>

          {pack.confidential ? (
            <div className="rs-confidential" role="status">
              CONFIDENTIAL · MoU rates · not for public distribution
              {pack.agent ? ` · ${pack.agent.name} (${pack.agent.code})` : ""}
            </div>
          ) : null}

          <div className="rs-intro">
            <div>
              <h2>Tariff sheet</h2>
              <p className="rs-nap">
                {pack.brand.addressLines.join(" · ")}
                <br />
                {pack.brand.phone} · {pack.brand.email}
                <br />
                {pack.brand.website.replace(/^https?:\/\//, "")}
              </p>
            </div>
            <div className="rs-tax-legend">
              {pack.scOn ? <span className="rs-pill">+10% SC</span> : null}
              {pack.gstOn ? (
                <span className="rs-pill">+10% GST</span>
              ) : (
                <span className="rs-pill rs-pill-warn">GST OFF</span>
              )}
              <span className="rs-pill rs-pill-muted">Amounts = base net Nu.</span>
            </div>
          </div>

          <table className="rs-matrix">
            <thead>
              <tr>
                <th>Room type</th>
                {multiCard
                  ? pack.cards.map((c) => (
                      <th key={c.id} colSpan={4} className="rs-card-head">
                        {c.code}
                      </th>
                    ))
                  : null}
                {!multiCard ? (
                  <>
                    <th>Double</th>
                    <th>Single</th>
                    <th>Extra</th>
                    <th>Child</th>
                  </>
                ) : null}
              </tr>
              {multiCard ? (
                <tr className="rs-subhead">
                  <th />
                  {pack.cards.map((c) => (
                    <FragmentBands key={c.id} />
                  ))}
                </tr>
              ) : null}
            </thead>
            <tbody>
              {pack.rows.map((row) => (
                <tr key={row.typeCode}>
                  <td className="rs-type">
                    <strong>{row.label}</strong>
                    <span className="rs-type-code">{row.typeCode}</span>
                  </td>
                  {row.cards.map((col) => (
                    <FragmentRates key={col.cardId} col={col} />
                  ))}
                </tr>
              ))}
            </tbody>
          </table>

          <section className="rs-photos">
            <h3>Room gallery</h3>
            <div className="rs-photo-grid">
              {pack.rows.map((row) => (
                <div key={row.typeCode} className="rs-photo-card">
                  <div className="rs-photo-label">{row.label}</div>
                  <div className="rs-photo-strip">
                    {(row.photos.length > 0 ? row.photos : [""]).slice(0, 3).map((src, i) =>
                      src ? (
                        <img key={`${row.typeCode}-${i}`} src={src} alt="" loading="lazy" />
                      ) : (
                        <div key={`${row.typeCode}-ph`} className="rs-photo-ph" aria-hidden>
                          Photo soon
                        </div>
                      ),
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <footer className="rs-footer">
            <p>{pack.childPolicy}</p>
            <p>{pack.validityNote}</p>
            {!pack.gstOn ? (
              <p className="rs-gst-note">
                GST is not charged under current property tax policy (new license / exempt).
              </p>
            ) : null}
            <p className="rs-legal">
              {pack.brand.legalName} · Rates subject to change · Printed{" "}
              {new Date().toLocaleDateString("en-GB")}
            </p>
          </footer>
        </div>
      </article>
    </div>
  );
}

function FragmentBands() {
  return (
    <>
      <th>Dbl</th>
      <th>Sgl</th>
      <th>Ext</th>
      <th>Chd</th>
    </>
  );
}

function FragmentRates({
  col,
}: {
  col: { double: number; single: number; extra: number; child: number };
}) {
  return (
    <>
      <td className="rs-amt">{formatNu(col.double)}</td>
      <td className="rs-amt">{formatNu(col.single)}</td>
      <td className="rs-amt">{formatNu(col.extra)}</td>
      <td className="rs-amt">{formatNu(col.child)}</td>
    </>
  );
}

const PRINT_CSS = `
  .hos-rate-sheet-print {
    --rs-ink: #1a0f0a;
    --rs-muted: #6b5a4e;
    --rs-copper: #c45c26;
    --rs-gold: #e8a838;
    --rs-teal: #0d7377;
    --rs-cream: #fff6ea;
    --rs-paper: #fffdf8;
    --rs-line: rgba(26, 15, 10, 0.14);
    color: var(--rs-ink);
    font-family: "Segoe UI", system-ui, sans-serif;
    font-size: 11px;
    line-height: 1.35;
  }
  .rs-sheet {
    width: 210mm;
    min-height: 297mm;
    margin: 0 auto;
    background:
      radial-gradient(ellipse 80% 40% at 50% 0%, rgba(232, 168, 56, 0.12), transparent 55%),
      linear-gradient(180deg, var(--rs-cream) 0%, var(--rs-paper) 100%);
    box-shadow: 0 18px 48px rgba(26, 15, 10, 0.18);
    position: relative;
  }
  .rs-sheet::before {
    content: "";
    position: absolute;
    inset: 8mm;
    border: 1px solid rgba(196, 92, 38, 0.22);
    pointer-events: none;
    z-index: 0;
  }
  .rs-inner {
    position: relative;
    z-index: 1;
    padding: 12mm 14mm 10mm;
  }
  .rs-top-bar {
    height: 4px;
    background: linear-gradient(90deg, var(--rs-copper) 0%, var(--rs-gold) 45%, var(--rs-teal) 100%);
    margin: -12mm -14mm 10mm;
  }
  .rs-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding-bottom: 8mm;
    border-bottom: 1.5px solid var(--rs-line);
  }
  .rs-brand { display: flex; align-items: center; gap: 12px; }
  .rs-brand img { width: 52px; height: 52px; object-fit: contain; }
  .rs-brand-text h1 {
    font-family: Georgia, "Times New Roman", serif;
    font-size: 26px;
    font-weight: 700;
    line-height: 1.05;
    margin: 0;
  }
  .rs-brand-text h1 span { color: var(--rs-copper); }
  .rs-brand-text p {
    margin: 2px 0 0;
    font-size: 9.5px;
    font-weight: 600;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--rs-muted);
  }
  .rs-season-badge { text-align: right; }
  .rs-label {
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: var(--rs-copper);
  }
  .rs-title {
    font-family: Georgia, serif;
    font-size: 22px;
    font-weight: 700;
    margin-top: 2px;
  }
  .rs-sub { margin-top: 2px; font-size: 10px; color: var(--rs-muted); }
  .rs-confidential {
    margin-top: 3mm;
    padding: 2mm 3mm;
    background: #3b0a0a;
    color: #fecaca;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    border-radius: 4px;
  }
  .rs-intro {
    margin: 4mm 0 3.5mm;
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 10px;
    align-items: end;
  }
  .rs-intro h2 {
    font-family: Georgia, serif;
    font-size: 18px;
    margin: 0 0 2mm;
  }
  .rs-nap { margin: 0; color: var(--rs-muted); font-size: 10px; }
  .rs-tax-legend { display: flex; flex-wrap: wrap; gap: 4px; justify-content: flex-end; }
  .rs-pill {
    display: inline-block;
    padding: 2px 8px;
    border-radius: 999px;
    background: rgba(13, 115, 119, 0.12);
    color: var(--rs-teal);
    font-size: 9px;
    font-weight: 700;
  }
  .rs-pill-warn { background: rgba(196, 92, 38, 0.15); color: var(--rs-copper); }
  .rs-pill-muted { background: rgba(26, 15, 10, 0.06); color: var(--rs-muted); }
  .rs-matrix {
    width: 100%;
    border-collapse: collapse;
    font-size: 10px;
  }
  .rs-matrix th, .rs-matrix td {
    border: 1px solid var(--rs-line);
    padding: 2.5mm 2mm;
    text-align: right;
    background: #fff;
  }
  .rs-matrix th {
    background: rgba(26, 15, 10, 0.04);
    font-size: 9px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .rs-matrix .rs-type { text-align: left; }
  .rs-type-code {
    display: block;
    font-size: 8px;
    color: var(--rs-muted);
    font-weight: 600;
  }
  .rs-card-head { text-align: center !important; }
  .rs-amt { font-variant-numeric: tabular-nums; font-weight: 600; }
  .rs-photos { margin-top: 5mm; }
  .rs-photos h3 {
    font-family: Georgia, serif;
    font-size: 14px;
    margin: 0 0 2mm;
  }
  .rs-photo-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 3mm;
  }
  .rs-photo-label {
    font-size: 9px;
    font-weight: 700;
    margin-bottom: 1mm;
    color: var(--rs-muted);
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }
  .rs-photo-strip {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 1.5mm;
  }
  .rs-photo-strip img,
  .rs-photo-ph {
    width: 100%;
    aspect-ratio: 4/3;
    object-fit: cover;
    border-radius: 3px;
    border: 1px solid var(--rs-line);
  }
  .rs-photo-ph {
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(26, 15, 10, 0.04);
    color: var(--rs-muted);
    font-size: 8px;
  }
  .rs-footer {
    margin-top: 5mm;
    padding-top: 3mm;
    border-top: 1px solid var(--rs-line);
    font-size: 9px;
    color: var(--rs-muted);
  }
  .rs-footer p { margin: 0 0 1.5mm; }
  .rs-gst-note { color: var(--rs-copper); font-weight: 600; }
  .rs-legal { font-size: 8px; opacity: 0.85; }

  @media print {
    @page { size: A4; margin: 0; }
    body * { visibility: hidden !important; }
    #hos-print-root,
    #hos-print-root * { visibility: visible !important; }
    #hos-print-root {
      position: absolute;
      left: 0;
      top: 0;
      width: 100%;
    }
    .hos-rate-sheet-print .rs-sheet {
      box-shadow: none;
      margin: 0;
      width: 210mm;
      min-height: 297mm;
    }
  }

  @media (prefers-reduced-transparency: reduce) {
    .rs-sheet {
      background: var(--rs-paper);
    }
  }
`;
