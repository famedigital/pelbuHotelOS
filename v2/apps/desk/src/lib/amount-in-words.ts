/** Bhutan Nu. amount-in-words for fiscal invoice footers (matches v1 print helper). */

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

function underLakh(n: number): string {
  if (n < 1000) return underThousand(n);
  const th = Math.floor(n / 1000);
  const rest = n % 1000;
  return `${underThousand(th)} Thousand${rest ? ` ${underThousand(rest)}` : ""}`.trim();
}

/** "Ngultrum Twelve Thousand Nine Hundred Forty Seven Only" */
export function amountInWordsNu(amount: number): string {
  const whole = Math.max(0, Math.round(Math.abs(amount)));
  if (whole === 0) return "Ngultrum Zero Only";
  if (whole >= 100_000_000) return `Ngultrum ${whole.toLocaleString("en-IN")} Only`;

  const lakh = Math.floor(whole / 100_000);
  const rest = whole % 100_000;
  const parts: string[] = [];
  if (lakh > 0) parts.push(`${underThousand(lakh)} Lakh`);
  if (rest > 0) parts.push(underLakh(rest));
  return `Ngultrum ${parts.join(" ")} Only`;
}
