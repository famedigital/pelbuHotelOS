/**
 * Client-safe set-meal types for POS (per-head lunch / dinner offers).
 */

export type PosSetMeal = {
  id: string;
  outlet: string | null;
  name: string;
  priceBtn: number;
  gstApplicable: boolean;
  sortOrder: number;
};
