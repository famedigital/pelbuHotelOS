/**
 * Owner period bounds + profit identity — pure (safe for node unit tests).
 */

export type OwnerSeason = "peak" | "lean";
export type OwnerPeriodKind = "ytd" | "season" | "month";

export type OwnerPeriod = {
  kind: OwnerPeriodKind;
  from: string;
  to: string;
  label: string;
};

function parseIso(iso: string): Date {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(y!, m! - 1, d!);
}

function lastDayOfMonth(y: number, monthIndex0: number): string {
  const last = new Date(y, monthIndex0 + 1, 0).getDate();
  return `${y}-${String(monthIndex0 + 1).padStart(2, "0")}-${String(last).padStart(2, "0")}`;
}

/**
 * Bhutan boutique seasons used for Owner “This season”:
 * Peak ≈ Oct 1 – Apr 30 (may cross calendar year); Lean ≈ May 1 – Sep 30.
 */
export function resolveOwnerPeriod(
  kind: OwnerPeriodKind,
  opts: { asOf?: string; season?: OwnerSeason } = {},
): OwnerPeriod {
  const asOf = (opts.asOf ?? new Date().toISOString().slice(0, 10)).slice(0, 10);
  const asOfDate = parseIso(asOf);
  const y = asOfDate.getFullYear();
  const month = asOfDate.getMonth(); // 0-based

  if (kind === "month") {
    const from = `${y}-${String(month + 1).padStart(2, "0")}-01`;
    const to = lastDayOfMonth(y, month);
    return {
      kind,
      from,
      to: to > asOf ? asOf : to,
      label: "This month",
    };
  }

  if (kind === "ytd") {
    return {
      kind,
      from: `${y}-01-01`,
      to: asOf,
      label: "This year",
    };
  }

  const season = opts.season ?? (month >= 4 && month <= 8 ? "lean" : "peak");
  if (season === "lean") {
    const from = `${y}-05-01`;
    const end = `${y}-09-30`;
    return {
      kind: "season",
      from,
      to: asOf < from ? from : asOf > end ? end : asOf,
      label: "This season (lean)",
    };
  }

  let from: string;
  let end: string;
  if (month >= 9) {
    from = `${y}-10-01`;
    end = `${y + 1}-04-30`;
  } else if (month <= 3) {
    from = `${y - 1}-10-01`;
    end = `${y}-04-30`;
  } else {
    from = `${y - 1}-10-01`;
    end = `${y}-04-30`;
  }
  return {
    kind: "season",
    from,
    to: asOf < from ? from : asOf > end ? end : asOf,
    label: "This season (peak)",
  };
}

export function ownerProfitIdentity(moneyIn: number, moneyOut: number): number {
  return moneyIn - moneyOut;
}

/** Roll expense category fixtures — mirrors glance category shape. */
export function rollupExpenseCategories(
  rows: ReadonlyArray<{ category: string; amount: number }>,
): { category: string; amount: number; count: number }[] {
  const byCat = new Map<string, { category: string; amount: number; count: number }>();
  for (const r of rows) {
    const cur = byCat.get(r.category) ?? {
      category: r.category,
      amount: 0,
      count: 0,
    };
    cur.amount += r.amount;
    cur.count += 1;
    byCat.set(r.category, cur);
  }
  return [...byCat.values()].sort((a, b) => b.amount - a.amount);
}
