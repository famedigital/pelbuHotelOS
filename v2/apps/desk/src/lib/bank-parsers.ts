/**
 * Port of scripts/bank-recon parsers (BoB / BNB / DrukPNB) for desk + API.
 * Text-in → normalized statement lines — no PDF OCR in this path.
 */

export type BankCode = "bob" | "bnb" | "drukpnb";

export type ParsedBankLine = {
  txnDate: string;
  description: string;
  amountBtn: number;
  direction: "in" | "out";
  externalRef?: string;
  rawLine: string;
};

export type BankParseResult = {
  bankCode: BankCode;
  lines: ParsedBankLine[];
  warnings: string[];
};

const AMOUNT_RE =
  /(?<![\d.])(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)(?![\d.])/g;

const DATE_SPECS: { fmt: RegExp; toIso: (m: string) => string | null }[] = [
  {
    fmt: /\b(\d{1,2}\/\d{1,2}\/\d{4})\b/g,
    toIso: (m) => dmyToIso(m, "/"),
  },
  {
    fmt: /\b(\d{1,2}-\d{1,2}-\d{4})\b/g,
    toIso: (m) => dmyToIso(m, "-"),
  },
  {
    fmt: /\b(\d{4}-\d{2}-\d{2})\b/g,
    toIso: (m) => m,
  },
  {
    fmt: /\b(\d{1,2}-[A-Za-z]{3}-\d{4})\b/g,
    toIso: (m) => monToIso(m),
  },
];

function dmyToIso(raw: string, sep: string): string | null {
  const [d, m, y] = raw.split(sep);
  if (!d || !m || !y) return null;
  const dd = d.padStart(2, "0");
  const mm = m.padStart(2, "0");
  return `${y}-${mm}-${dd}`;
}

function monToIso(raw: string): string | null {
  const m = raw.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/);
  if (!m) return null;
  const months: Record<string, string> = {
    jan: "01",
    feb: "02",
    mar: "03",
    apr: "04",
    may: "05",
    jun: "06",
    jul: "07",
    aug: "08",
    sep: "09",
    oct: "10",
    nov: "11",
    dec: "12",
  };
  const mm = months[m[2]!.toLowerCase()];
  if (!mm) return null;
  return `${m[3]}-${mm}-${m[1]!.padStart(2, "0")}`;
}

function parseAmount(raw: string): number {
  const s = raw.replace(/,/g, "").replace(/Nu\.?/gi, "").replace(/BTN/gi, "").trim();
  const n = Number(s);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
}

function findDates(line: string): string[] {
  const out: string[] = [];
  for (const spec of DATE_SPECS) {
    const re = new RegExp(spec.fmt.source, spec.fmt.flags);
    let match: RegExpExecArray | null;
    while ((match = re.exec(line)) !== null) {
      const iso = spec.toIso(match[1]!);
      if (iso) out.push(iso);
    }
  }
  return out;
}

function findAmounts(line: string): number[] {
  const out: number[] = [];
  const re = new RegExp(AMOUNT_RE.source, AMOUNT_RE.flags);
  let match: RegExpExecArray | null;
  while ((match = re.exec(line)) !== null) {
    out.push(parseAmount(match[1]!));
  }
  return out;
}

function cleanDesc(text: string): string {
  return text.replace(/\s+/g, " ").trim().replace(/^[-|]+|[-|]+$/g, "");
}

function extractRef(body: string): string | undefined {
  const m = body.match(
    /(?:UTR|REF|QR|CHQ|PSBN)[:\s-]*([A-Z0-9-]{4,})/i,
  );
  return m ? m[0]!.toUpperCase() : undefined;
}

function splitDebitCredit(
  amounts: number[],
  body: string,
): { debit: number; credit: number } {
  if (amounts.length === 0) return { debit: 0, credit: 0 };
  const lower = body.toLowerCase();
  let bodyAmts = amounts;
  if (amounts.length >= 3) {
    bodyAmts = amounts.slice(0, -1);
  }
  if (bodyAmts.length === 1) {
    const amt = bodyAmts[0]!;
    if (/(cr|credit|deposit|inward|neft|receipt)/.test(lower)) {
      return { debit: 0, credit: amt };
    }
    if (/(dr|debit|withdrawal|charge|fee|payment)/.test(lower)) {
      return { debit: amt, credit: 0 };
    }
    return { debit: 0, credit: amt };
  }
  return { debit: bodyAmts[0]!, credit: bodyAmts[1]! };
}

function isNoise(line: string): boolean {
  const l = line.toLowerCase();
  return (
    l.includes("statement of account") ||
    l.includes("opening balance") ||
    l.includes("account number") ||
    /^date\s+particulars/i.test(line) ||
    /^bank of bhutan/i.test(line) ||
    /^bhutan national/i.test(line) ||
    /^druk\s*pnb/i.test(line)
  );
}

function toLines(
  bankCode: BankCode,
  debit: number,
  credit: number,
  txnDate: string,
  description: string,
  rawLine: string,
): ParsedBankLine | null {
  if (credit > 0.009) {
    return {
      txnDate,
      description,
      amountBtn: credit,
      direction: "in",
      externalRef: extractRef(description),
      rawLine,
    };
  }
  if (debit > 0.009) {
    return {
      txnDate,
      description,
      amountBtn: debit,
      direction: "out",
      externalRef: extractRef(description),
      rawLine,
    };
  }
  return null;
}

const BOB_LINE =
  /^(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})\s+(.+?)\s+(\d[\d,]*\.?\d*)\s+(\d[\d,]*\.?\d*)\s*(\d[\d,]*\.?\d*)?\s*$/;

export function parseBobText(text: string): BankParseResult {
  const warnings: string[] = [];
  const lines: ParsedBankLine[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || isNoise(line)) continue;
    const m = BOB_LINE.exec(line);
    if (m) {
      const dates = findDates(m[1]!);
      if (!dates[0]) {
        warnings.push(`skip date: ${line.slice(0, 80)}`);
        continue;
      }
      const amounts = [m[3], m[4], m[5]]
        .filter(Boolean)
        .map((x) => parseAmount(x!));
      const body = m[2]!;
      const { debit, credit } = splitDebitCredit(amounts, body);
      const parsed = toLines("bob", debit, credit, dates[0], cleanDesc(body), line);
      if (parsed) lines.push(parsed);
      continue;
    }
    const dates = findDates(line);
    const amounts = findAmounts(line);
    if (!dates[0] || amounts.length < 1) continue;
    const { debit, credit } = splitDebitCredit(amounts, line);
    const desc = cleanDesc(line.replace(/\d{1,2}[/-]\d{1,2}[/-]\d{2,4}/, ""));
    const parsed = toLines("bob", debit, credit, dates[0], desc || "BoB line", line);
    if (parsed) lines.push(parsed);
  }
  return { bankCode: "bob", lines, warnings };
}

export function parseBnbText(text: string): BankParseResult {
  const warnings: string[] = [];
  const lines: ParsedBankLine[] = [];
  const lineRe =
    /^(\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{1,2}-[A-Za-z]{3}-\d{4})\s+(.+)$/;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || isNoise(line)) continue;
    const m = lineRe.exec(line);
    if (!m) continue;
    const dates = findDates(m[1]!);
    if (!dates[0]) continue;
    const body = m[2]!;
    const amounts = findAmounts(body);
    if (!amounts.length) continue;
    let debit: number;
    let credit: number;
    if (amounts.length >= 3) {
      debit = amounts[0]!;
      credit = amounts[1]!;
    } else {
      ({ debit, credit } = splitDebitCredit(amounts, body));
    }
    const desc = cleanDesc(body.replace(/\d[\d,]*\.?\d*/g, " "));
    const parsed = toLines("bnb", debit, credit, dates[0], desc || "BNB line", line);
    if (parsed) lines.push(parsed);
    else warnings.push(`zero amount: ${line.slice(0, 60)}`);
  }
  return { bankCode: "bnb", lines, warnings };
}

export function parseDrukPnbText(text: string): BankParseResult {
  const warnings: string[] = [];
  const lines: ParsedBankLine[] = [];
  const lineRe =
    /^(\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{1,2}\s+[A-Za-z]{3}\s+\d{4})\s+(.+)$/;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || isNoise(line)) continue;
    const m = lineRe.exec(line);
    if (!m) continue;
    const dates = findDates(m[1]!);
    if (!dates[0]) continue;
    const body = m[2]!;
    const amounts = findAmounts(body);
    if (!amounts.length) continue;
    let debit: number;
    let credit: number;
    if (amounts.length >= 3) {
      debit = amounts[0]!;
      credit = amounts[1]!;
    } else {
      ({ debit, credit } = splitDebitCredit(amounts, body));
    }
    const desc = cleanDesc(body.replace(/\d[\d,]*\.?\d*/g, " "));
    const parsed = toLines(
      "drukpnb",
      debit,
      credit,
      dates[0],
      desc || "DrukPNB line",
      line,
    );
    if (parsed) lines.push(parsed);
  }
  return { bankCode: "drukpnb", lines, warnings };
}

export function parseBankStatementText(
  bankCode: BankCode,
  text: string,
): BankParseResult {
  if (bankCode === "bob") return parseBobText(text);
  if (bankCode === "bnb") return parseBnbText(text);
  return parseDrukPnbText(text);
}
