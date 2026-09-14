import { cn } from "@/lib/utils";
import Link from "next/link";

export type MoneyDirection = "in" | "out" | "hold" | "reversal";
export type MoneyBucket =
  | "rooms"
  | "fb"
  | "spa"
  | "services"
  | "expense"
  | "payroll"
  | "tax"
  | "deposit"
  | "agent"
  | "other";
export type MoneyState =
  | "posted"
  | "pending_bank"
  | "matched"
  | "unmatched"
  | "voided"
  | "period_locked"
  | "open"
  | "paid";

const DIRECTION_LABEL: Record<MoneyDirection, string> = {
  in: "In",
  out: "Out",
  hold: "Hold",
  reversal: "Reversal",
};

const BUCKET_LABEL: Record<MoneyBucket, string> = {
  rooms: "Rooms",
  fb: "F&B",
  spa: "Spa",
  services: "Services",
  expense: "Expense",
  payroll: "Payroll",
  tax: "Tax",
  deposit: "Deposit",
  agent: "Agent",
  other: "Other",
};

const STATE_LABEL: Record<MoneyState, string> = {
  posted: "Posted",
  pending_bank: "Pending bank",
  matched: "Matched",
  unmatched: "Unmatched",
  voided: "Voided",
  period_locked: "Period locked",
  open: "Open",
  paid: "Paid",
};

export function MoneyChip({
  children,
  tone = "muted",
}: {
  children: React.ReactNode;
  tone?: "muted" | "accent" | "good" | "warn" | "danger";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide",
        tone === "muted" && "bg-muted text-muted-foreground",
        tone === "accent" && "bg-accent/15 text-accent",
        tone === "good" && "bg-emerald-500/10 text-emerald-800 dark:text-emerald-300",
        tone === "warn" && "bg-amber-500/10 text-amber-800 dark:text-amber-300",
        tone === "danger" && "bg-red-500/10 text-red-800 dark:text-red-300",
      )}
    >
      {children}
    </span>
  );
}

export function MoneyChipSet({
  direction,
  bucket,
  state,
}: {
  direction?: MoneyDirection;
  bucket?: MoneyBucket;
  state?: MoneyState;
}) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      {direction ? (
        <MoneyChip
          tone={
            direction === "in"
              ? "good"
              : direction === "out"
                ? "warn"
                : direction === "reversal"
                  ? "danger"
                  : "muted"
          }
        >
          {DIRECTION_LABEL[direction]}
        </MoneyChip>
      ) : null}
      {bucket ? <MoneyChip>{BUCKET_LABEL[bucket]}</MoneyChip> : null}
      {state ? (
        <MoneyChip
          tone={
            state === "unmatched" || state === "pending_bank"
              ? "warn"
              : state === "voided"
                ? "danger"
                : state === "posted" || state === "matched" || state === "paid"
                  ? "good"
                  : "muted"
          }
        >
          {STATE_LABEL[state]}
        </MoneyChip>
      ) : null}
    </span>
  );
}

export function MoneySourceTrail({
  items,
}: {
  items: Array<{ label: string; href?: string | null }>;
}) {
  if (items.length === 0) return null;
  return (
    <p className="text-[11px] text-muted-foreground">
      {items.map((item, i) => (
        <span key={`${item.label}-${i}`}>
          {i > 0 ? " · " : null}
          {item.href ? (
            <Link href={item.href} className="underline underline-offset-2 hover:text-foreground">
              {item.label}
            </Link>
          ) : (
            item.label
          )}
        </span>
      ))}
    </p>
  );
}

export function MoneyRow({
  date,
  title,
  amount,
  direction,
  bucket,
  state,
  trail,
  booksHref,
}: {
  date: string;
  title: string;
  amount: string;
  direction?: MoneyDirection;
  bucket?: MoneyBucket;
  state?: MoneyState;
  trail?: Array<{ label: string; href?: string | null }>;
  booksHref?: string | null;
}) {
  return (
    <li className="flex flex-wrap items-start justify-between gap-3 py-3">
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs tabular-nums text-muted-foreground">{date}</span>
          <MoneyChipSet direction={direction} bucket={bucket} state={state} />
        </div>
        <p className="text-sm font-medium text-foreground">{title}</p>
        {trail ? <MoneySourceTrail items={trail} /> : null}
      </div>
      <div className="text-right">
        <p
          className={cn(
            "text-sm font-semibold tabular-nums",
            direction === "out" || direction === "reversal"
              ? "text-foreground"
              : "text-foreground",
          )}
        >
          {direction === "out" ? `−${amount}` : amount}
        </p>
        {booksHref ? (
          <Link
            href={booksHref}
            className="text-[11px] text-muted-foreground underline underline-offset-2"
          >
            Open in books
          </Link>
        ) : null}
      </div>
    </li>
  );
}

export function FinanceSearchField({
  placeholder = "Search amount, reference, guest, vendor…",
  name = "q",
  defaultValue,
}: {
  placeholder?: string;
  name?: string;
  defaultValue?: string;
}) {
  return (
    <form method="get" className="w-full max-w-md">
      <label className="sr-only" htmlFor={`finance-search-${name}`}>
        Search
      </label>
      <input
        id={`finance-search-${name}`}
        name={name}
        type="search"
        defaultValue={defaultValue}
        placeholder={placeholder}
        className="h-9 w-full rounded-lg border bg-background px-3 text-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
      />
    </form>
  );
}

/** Map folio source_type → display bucket. */
export function bucketFromSourceType(sourceType: string): MoneyBucket {
  const s = sourceType.toLowerCase();
  if (s === "room" || s === "meal_plan" || s === "extra_bed") return "rooms";
  if (s === "order") return "fb";
  if (s === "service") return "spa";
  if (s === "guest_service" || s === "laundry") return "services";
  if (s === "deposit") return "deposit";
  if (s === "comp") return "other";
  return "other";
}

export function bucketFromExpenseCategory(category: string): MoneyBucket {
  if (category === "payroll") return "payroll";
  if (category === "tax") return "tax";
  return "expense";
}
