export type AgingBucket = "current" | "d30" | "d60" | "d90";

export type AgingAmounts = {
  current: number;
  d30: number;
  d60: number;
  d90: number;
  total: number;
};

/** Age an outstanding balance by days past as-of date (Thimphu business day). */
export function agingBucket(daysPast: number): AgingBucket {
  if (daysPast <= 30) return "current";
  if (daysPast <= 60) return "d30";
  if (daysPast <= 90) return "d60";
  return "d90";
}

export function emptyAging(): AgingAmounts {
  return { current: 0, d30: 0, d60: 0, d90: 0, total: 0 };
}

export function addToAging(
  buckets: AgingAmounts,
  amount: number,
  asOf: string,
  openDate: string,
): AgingAmounts {
  if (Math.abs(amount) < 0.005) return buckets;
  const a = new Date(`${asOf}T00:00:00Z`).getTime();
  const b = new Date(`${openDate}T00:00:00Z`).getTime();
  const daysPast = Number.isNaN(a) || Number.isNaN(b)
    ? 0
    : Math.max(0, Math.round((a - b) / 86_400_000));
  const key = agingBucket(daysPast);
  const next = { ...buckets };
  next[key] += amount;
  next.total += amount;
  return next;
}

export function daysBetweenIso(from: string, to: string): number {
  const a = new Date(`${from}T00:00:00Z`).getTime();
  const b = new Date(`${to}T00:00:00Z`).getTime();
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.max(0, Math.round((b - a) / 86_400_000));
}
