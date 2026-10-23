import {
  guestVisibleBalanceLines,
  netFolioBalance,
  type FolioLineForBalance,
} from "@/lib/folio/balance";

export type TenderBucket = "cash" | "bank" | "qr" | "other";

/** Till buckets for the cashier strip. Card and transfer sit with bank. */
export function bucketTender(method: string | null | undefined): TenderBucket {
  const key = (method ?? "").trim().toLowerCase();
  if (key === "cash") return "cash";
  if (
    key === "bank" ||
    key === "card" ||
    key === "pay_bt" ||
    key === "transfer" ||
    key === "bank_transfer" ||
    key === "cheque" ||
    key === "check"
  ) {
    return "bank";
  }
  if (key === "bank_qr" || key === "qr" || key === "qr_code") return "qr";
  return "other";
}

export type FolioMoneyLine = FolioLineForBalance & {
  source_type?: string | null;
};

export type FolioMoney = {
  chargesBtn: number;
  paidBtn: number;
  dueBtn: number;
};

/** Guest-visible charges, money taken, and what is still due. */
export function folioMoney(lines: FolioMoneyLine[]): FolioMoney {
  const visible = guestVisibleBalanceLines(lines);
  let chargesBtn = 0;
  let paidBtn = 0;
  for (const line of visible) {
    const src = (line.source_type ?? "").toLowerCase();
    const amount = Number(line.total_btn);
    if (src === "payment" || src === "deposit") {
      paidBtn += -amount;
    } else {
      chargesBtn += amount;
    }
  }
  return {
    chargesBtn,
    paidBtn,
    dueBtn: netFolioBalance(lines),
  };
}
