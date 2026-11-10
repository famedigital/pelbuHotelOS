/** Bhutan DRC tax / service-charge helpers for Hotel OS v2. */

export type MealPlanCode = "EP" | "CP" | "MAP" | "AP" | "BB";

export const BST_RATE = 0.1;
export const SERVICE_CHARGE_RATE = 0.1;

export interface LineTaxBreakdown {
  netBtn: number;
  serviceChargeBtn: number;
  bstBtn: number;
  grossBtn: number;
}

/** Exclusive base → SC on net, then BST on (net + SC). Classic Bhutan F&B stack. */
export function stackExclusiveBtn(netBtn: number): LineTaxBreakdown {
  const net = roundBtn(netBtn);
  const serviceChargeBtn = roundBtn(net * SERVICE_CHARGE_RATE);
  const bstBtn = roundBtn((net + serviceChargeBtn) * BST_RATE);
  return {
    netBtn: net,
    serviceChargeBtn,
    bstBtn,
    grossBtn: roundBtn(net + serviceChargeBtn + bstBtn),
  };
}

/** Inclusive gross → reverse out SC+BST (gross = net * 1.1 * 1.1). */
export function unstackInclusiveBtn(grossBtn: number): LineTaxBreakdown {
  const gross = roundBtn(grossBtn);
  const net = roundBtn(gross / (1 + SERVICE_CHARGE_RATE) / (1 + BST_RATE));
  return stackExclusiveBtn(net);
}

export function roundBtn(n: number): number {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}

export function mealPlanLabel(code: MealPlanCode | string): string {
  switch (code) {
    case "EP":
      return "European Plan (Room only)";
    case "CP":
    case "BB":
      return "Bed & Breakfast";
    case "MAP":
      return "Modified American Plan";
    case "AP":
      return "American Plan (Full board)";
    default:
      return String(code);
  }
}
