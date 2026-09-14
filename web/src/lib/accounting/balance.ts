import { roundBtn } from "@/lib/pricing";
import type { JournalLineInput } from "@/lib/accounting/types";

export function assertBalancedLines(lines: JournalLineInput[]): void {
  if (lines.length === 0) throw new Error("Journal has no lines.");
  const debit = roundBtn(lines.reduce((s, l) => s + l.debitBtn, 0));
  const credit = roundBtn(lines.reduce((s, l) => s + l.creditBtn, 0));
  if (debit !== credit) {
    throw new Error(`Journal unbalanced: debit ${debit} credit ${credit}`);
  }
  for (const line of lines) {
    const d = roundBtn(line.debitBtn);
    const c = roundBtn(line.creditBtn);
    if ((d > 0 && c > 0) || (d === 0 && c === 0)) {
      throw new Error("Each journal line must be debit XOR credit.");
    }
  }
}
