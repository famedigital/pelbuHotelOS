/**
 * Amount in words for Bhutan Nu fiscal prints (sample: "Ngultrum … only.").
 */

const ONES = [
  "",
  "One",
  "Two",
  "Three",
  "Four",
  "Five",
  "Six",
  "Seven",
  "Eight",
  "Nine",
  "Ten",
  "Eleven",
  "Twelve",
  "Thirteen",
  "Fourteen",
  "Fifteen",
  "Sixteen",
  "Seventeen",
  "Eighteen",
  "Nineteen",
];

const TENS = [
  "",
  "",
  "Twenty",
  "Thirty",
  "Forty",
  "Fifty",
  "Sixty",
  "Seventy",
  "Eighty",
  "Ninety",
];

function underThousand(n: number): string {
  if (n === 0) return "";
  if (n < 20) return ONES[n] ?? "";
  if (n < 100) {
    const t = Math.floor(n / 10);
    const o = n % 10;
    return `${TENS[t]}${o ? ` ${ONES[o]}` : ""}`.trim();
  }
  const h = Math.floor(n / 100);
  const rest = n % 100;
  return `${ONES[h]} Hundred${rest ? ` ${underThousand(rest)}` : ""}`.trim();
}

/** Indian grouping: crore / lakh / thousand (common for Nu). */
export function amountInWordsNu(amount: number): string {
  const whole = Math.max(0, Math.round(Math.abs(amount)));
  if (whole === 0) return "Ngultrum Zero only.";

  const crore = Math.floor(whole / 10_000_000);
  const lakh = Math.floor((whole % 10_000_000) / 100_000);
  const thousand = Math.floor((whole % 100_000) / 1000);
  const rem = whole % 1000;

  const parts: string[] = [];
  if (crore) parts.push(`${underThousand(crore)} Crore`);
  if (lakh) parts.push(`${underThousand(lakh)} Lakh`);
  if (thousand) parts.push(`${underThousand(thousand)} Thousand`);
  if (rem) parts.push(underThousand(rem));

  return `Ngultrum ${parts.join(" ")} only.`;
}

/** RRCO invoice line: "SIX THOUSAND … AND 43 / 100". */
export function amountInWordsPayable(amount: number): string {
  const n = Math.round((Math.abs(amount) + Number.EPSILON) * 100) / 100;
  const whole = Math.floor(n + 1e-8);
  const chetrum = Math.round((n - whole) * 100);
  const words = hyphenateTens(
    amountInWordsNu(whole)
      .replace(/^Ngultrum /, "")
      .replace(/ only\.$/, "")
      .toUpperCase(),
  );
  if (chetrum === 0) return words || "ZERO";
  return `${words || "ZERO"} AND ${chetrum} / 100`;
}

function hyphenateTens(words: string): string {
  return words.replace(
    /\b(TWENTY|THIRTY|FORTY|FIFTY|SIXTY|SEVENTY|EIGHTY|NINETY) ([A-Z]+)\b/g,
    "$1-$2",
  );
}
