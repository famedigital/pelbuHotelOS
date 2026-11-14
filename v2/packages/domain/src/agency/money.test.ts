import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { sumBudgetCosts, sumSell, tripMargin } from "./money.js";
import type { BudgetLine } from "./types.js";

function line(
  partial: Partial<BudgetLine> & Pick<BudgetLine, "id" | "kind" | "amountChh">,
): BudgetLine {
  return {
    label: partial.label ?? partial.kind,
    qty: partial.qty ?? 1,
    unitChh: partial.unitChh ?? partial.amountChh,
    isClientVisible: partial.isClientVisible ?? false,
    ...partial,
  };
}

describe("agency money", () => {
  it("sum_budget_costs_excludes_sell", () => {
    const lines = [
      line({ id: "1", kind: "hotel", amountChh: 80_000 }),
      line({ id: "2", kind: "sdf", amountChh: 20_000 }),
      line({ id: "3", kind: "sell", amountChh: 150_000 }),
    ];
    assert.equal(sumBudgetCosts(lines), 100_000);
    assert.equal(sumSell(lines), 150_000);
  });

  it("sum_budget_costs_rejects_non_integer", () => {
    assert.throws(
      () =>
        sumBudgetCosts([
          line({ id: "x", kind: "hotel", amountChh: 10.5 as unknown as number }),
        ]),
      /INVALID_MONEY/,
    );
  });

  it("trip_margin_happy_50_percent", () => {
    // 50% margin on sell: cost 75k, sell 150k → marginBps 5000
    const lines = [
      line({ id: "1", kind: "hotel", amountChh: 75_000 }),
      line({ id: "2", kind: "sell", amountChh: 150_000 }),
    ];
    const m = tripMargin({ lines, sellChh: 150_000 });
    assert.equal(m.costChh, 75_000);
    assert.equal(m.sellChh, 150_000);
    assert.equal(m.marginChh, 75_000);
    assert.equal(m.marginBps, 5000);
  });

  it("trip_margin_zero_sell_bps_zero", () => {
    const m = tripMargin({
      lines: [line({ id: "1", kind: "hotel", amountChh: 10_000 })],
      sellChh: 0,
    });
    assert.equal(m.marginChh, -10_000);
    assert.equal(m.marginBps, 0);
  });

  it("trip_margin_uses_sell_lines_when_sellChh_omitted", () => {
    const m = tripMargin({
      lines: [
        line({ id: "1", kind: "guide", amountChh: 40_000 }),
        line({ id: "2", kind: "sell", amountChh: 90_000 }),
      ],
    });
    assert.equal(m.sellChh, 90_000);
    assert.equal(m.costChh, 40_000);
    assert.equal(m.marginChh, 50_000);
  });
});
