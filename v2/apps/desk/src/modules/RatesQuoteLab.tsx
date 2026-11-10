import { useState, useTransition } from "react";
import { quoteNight, type RateEntryMode } from "@hos-v2/domain";
import { ModulePage } from "./ModulePage";

/** Live domain quote — real math, not mock rates grid. */
export function RatesQuoteLab() {
  const [amount, setAmount] = useState(5000);
  const [mode, setMode] = useState<RateEntryMode>("net");
  const [pending, start] = useTransition();
  const [result, setResult] = useState(() => quoteNight(5000, "net"));

  return (
    <>
      <ModulePage id="rates" title="Rates" />
      <section className="panel hos-glass" style={{ marginTop: "1rem" }}>
        <h2>Quote lab (domain COPY)</h2>
        <p className="meta">SC 10% → GST 5% on (base+SC). Three entry modes.</p>
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginTop: "0.75rem" }}>
          <label>
            Amount{" "}
            <input
              className="hos-cell"
              type="number"
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
            />
          </label>
          <label>
            Mode{" "}
            <select
              className="hos-cell"
              value={mode}
              onChange={(e) => setMode(e.target.value as RateEntryMode)}
            >
              <option value="net">net</option>
              <option value="incl_sc">incl_sc</option>
              <option value="all_in">all_in</option>
            </select>
          </label>
          <button
            type="button"
            className="hos-btn-primary"
            disabled={pending}
            onClick={() => start(() => setResult(quoteNight(amount, mode)))}
          >
            Quote
          </button>
        </div>
        <pre className="hos-cell" style={{ marginTop: "1rem", padding: "0.75rem" }}>
          {JSON.stringify(result, null, 2)}
        </pre>
      </section>
    </>
  );
}
