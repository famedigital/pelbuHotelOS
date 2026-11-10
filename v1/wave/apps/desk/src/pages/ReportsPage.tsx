import { useEffect, useState } from "react";
import { NeoGlassCard, TactileButton } from "@hotel-os/ui";
import { api } from "../api";

type CatalogItem = {
  id: string;
  number: number;
  binder: string;
  title: string;
};

export function ReportsPage() {
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [selected, setSelected] = useState<string>("rep-01");
  const [report, setReport] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    void api<{ reports: CatalogItem[] }>("/v1/reports/catalog").then((r) =>
      setCatalog(r.reports),
    );
  }, []);

  useEffect(() => {
    void api<Record<string, unknown>>(`/v1/reports/${selected}`).then(setReport);
  }, [selected]);

  return (
    <div className="desk-grid">
      <NeoGlassCard className="no-print">
        <h2 style={{ marginTop: 0 }}>16-Report Studio</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {catalog.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => setSelected(r.id)}
              style={{
                textAlign: "left",
                padding: 8,
                borderRadius: 10,
                border: "1px solid rgba(255,255,255,0.08)",
                background:
                  selected === r.id ? "rgba(99,102,241,0.25)" : "#0b1220",
                color: "inherit",
                cursor: "pointer",
              }}
            >
              {r.number}. {r.title}
            </button>
          ))}
        </div>
      </NeoGlassCard>
      <NeoGlassCard>
        <div
          className="no-print"
          style={{ display: "flex", justifyContent: "space-between" }}
        >
          <h3>Fiscal / report print</h3>
          <TactileButton variant="ghost" onClick={() => window.print()}>
            Print
          </TactileButton>
        </div>
        <article className="fiscal-print-sheet">
          <header style={{ borderBottom: "2px solid #111", paddingBottom: 8 }}>
            <div style={{ fontSize: 18, fontWeight: 700 }}>Hotel OS · Fiscal pack</div>
            <div style={{ fontSize: 12 }}>
              Report {selected} · {new Date().toLocaleString("en-BT")}
            </div>
          </header>
          {report ? (
            <div style={{ fontSize: 12, marginTop: 12 }}>
              <p>
                Verification: <code>{String(report.verificationHash)}</code> ·{" "}
                {String(report.format)}
              </p>
              <pre
                style={{
                  whiteSpace: "pre-wrap",
                  background: "#fff",
                  color: "#111",
                  padding: 12,
                  border: "1px solid #ddd",
                  maxHeight: 480,
                  overflow: "auto",
                }}
              >
                {JSON.stringify(report, null, 2)}
              </pre>
            </div>
          ) : (
            <p>Loading…</p>
          )}
          <footer
            style={{
              marginTop: 24,
              fontSize: 10,
              borderTop: "1px solid #ccc",
              paddingTop: 8,
            }}
          >
            Gapless sequences remain on Postgres property_sequences · append-only
            folio lines · BST-3 stack via rates package
          </footer>
        </article>
      </NeoGlassCard>
      <style>{`
        @media print {
          .no-print, .hos-header, .hos-rail { display: none !important; }
          .fiscal-print-sheet {
            color: #111 !important;
            background: #fff !important;
          }
          body { background: #fff !important; }
        }
      `}</style>
    </div>
  );
}
