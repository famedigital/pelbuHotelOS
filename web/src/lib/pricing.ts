/** Bhutan GST rate applied to gst_applicable F&B lines (adjust when DRC rate changes). */
export const BHUTAN_GST_RATE = 0.07;

export type LineForGst = {
  qty: number;
  unitPriceBtn: number;
  gstApplicable: boolean;
};

export function roundBtn(amount: number): number {
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

export function calculateOrderTotals(lines: LineForGst[]): {
  subtotalBtn: number;
  gstBtn: number;
  totalBtn: number;
} {
  let subtotal = 0;
  let gstBase = 0;

  for (const line of lines) {
    const lineTotal = line.qty * line.unitPriceBtn;
    subtotal += lineTotal;
    if (line.gstApplicable) {
      gstBase += lineTotal;
    }
  }

  const subtotalBtn = roundBtn(subtotal);
  const gstBtn = roundBtn(gstBase * BHUTAN_GST_RATE);
  const totalBtn = roundBtn(subtotalBtn + gstBtn);

  return { subtotalBtn, gstBtn, totalBtn };
}

export function formatBtn(amount: number): string {
  return `Nu ${amount.toLocaleString("en-BT", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}
