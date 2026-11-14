/** Trip budget / margin math — integer chhetrum only (M02). */

import type { BudgetLine, TripMarginResult } from "./types.js";

function assertIntegerChh(n: number, label: string): void {
  if (!Number.isFinite(n) || !Number.isInteger(n)) {
    throw new Error(`INVALID_MONEY:${label}`);
  }
}

/** Sum amountChh for all kinds except sell. */
export function sumBudgetCosts(lines: BudgetLine[]): number {
  let total = 0;
  for (const line of lines) {
    assertIntegerChh(line.amountChh, line.id);
    if (line.kind === "sell") continue;
    total += line.amountChh;
  }
  return total;
}

/** Sum amountChh where kind === sell. */
export function sumSell(lines: BudgetLine[]): number {
  let total = 0;
  for (const line of lines) {
    assertIntegerChh(line.amountChh, line.id);
    if (line.kind !== "sell") continue;
    total += line.amountChh;
  }
  return total;
}

export function tripMargin(input: {
  lines: BudgetLine[];
  sellChh?: number;
}): TripMarginResult {
  const costChh = sumBudgetCosts(input.lines);
  const sellChh =
    input.sellChh !== undefined ? input.sellChh : sumSell(input.lines);
  assertIntegerChh(sellChh, "sellChh");
  const marginChh = sellChh - costChh;
  const marginBps =
    sellChh === 0 ? 0 : Math.trunc((marginChh * 10000) / sellChh);
  return { costChh, sellChh, marginChh, marginBps };
}
