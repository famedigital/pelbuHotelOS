/**
 * Laundry bag pricing + folio copy — pure helpers (no store / API imports).
 */

export type LaundryService = "dry_clean" | "wash_iron" | "press_only";
export type LaundrySpeed = "normal" | "express";

export type GarmentKind =
  | "gho"
  | "kira"
  | "tego"
  | "wonju"
  | "suit"
  | "shirt"
  | "trousers"
  | "dress"
  | "skirt"
  | "blouse"
  | "jacket"
  | "woolen"
  | "towel"
  | "bedsheet"
  | "duvet_cover"
  | "other";

export type LaundryGarmentLine = {
  id: string;
  kind: GarmentKind | "custom";
  label: string;
  qty: number;
  unitNet: number;
};

export const GARMENT_RATES: Record<GarmentKind, number> = {
  gho: 180,
  kira: 200,
  tego: 120,
  wonju: 100,
  suit: 350,
  shirt: 80,
  trousers: 100,
  dress: 220,
  skirt: 110,
  blouse: 90,
  jacket: 250,
  woolen: 280,
  towel: 40,
  bedsheet: 60,
  duvet_cover: 90,
  other: 100,
};

export const GARMENT_LABEL: Record<GarmentKind, string> = {
  gho: "Gho",
  kira: "Kira",
  tego: "Tego",
  wonju: "Wonju",
  suit: "Suit",
  shirt: "Shirt",
  trousers: "Trousers",
  dress: "Dress",
  skirt: "Skirt",
  blouse: "Blouse",
  jacket: "Jacket",
  woolen: "Sweater / woolen",
  towel: "Towel",
  bedsheet: "Bedsheet",
  duvet_cover: "Duvet cover",
  other: "Other (catalog)",
};

export const CATALOG_GARMENTS: readonly GarmentKind[] = [
  "gho",
  "kira",
  "tego",
  "wonju",
  "suit",
  "shirt",
  "trousers",
  "dress",
  "skirt",
  "blouse",
  "jacket",
  "woolen",
  "towel",
  "bedsheet",
  "duvet_cover",
  "other",
] as const;

export const SERVICE_LABEL: Record<LaundryService, string> = {
  dry_clean: "Dry Cleaning",
  wash_iron: "Wash & Iron",
  press_only: "Pressing Only",
};

export function laundryServiceSpeedMult(
  service: LaundryService,
  speed: LaundrySpeed,
): number {
  const serviceMult =
    service === "dry_clean" ? 1.4 : service === "wash_iron" ? 1 : 0.7;
  const speedMult = speed === "express" ? 1.5 : 1;
  return serviceMult * speedMult;
}

export function laundryLineNet(
  lines: ReadonlyArray<Pick<LaundryGarmentLine, "qty" | "unitNet">>,
): number {
  return lines.reduce(
    (sum, g) => sum + Math.max(0, g.unitNet) * Math.max(0, g.qty),
    0,
  );
}

export function laundryBagPreviewNet(
  lines: ReadonlyArray<Pick<LaundryGarmentLine, "qty" | "unitNet">>,
  service: LaundryService,
  speed: LaundrySpeed,
): number {
  return Math.round(laundryLineNet(lines) * laundryServiceSpeedMult(service, speed));
}

export function laundryBagDescription(bag: {
  bagNo: string;
  service: LaundryService;
  speed: LaundrySpeed;
  garments: ReadonlyArray<Pick<LaundryGarmentLine, "label" | "qty">>;
}): string {
  const items = bag.garments
    .filter((g) => g.qty > 0)
    .map((g) => `${g.label}×${g.qty}`)
    .join(", ");
  const cloth = items || "items";
  return `Laundry ${bag.bagNo} · ${SERVICE_LABEL[bag.service]} · ${bag.speed} · ${cloth}`;
}

export function catalogLineDefaults(kind: GarmentKind): Pick<
  LaundryGarmentLine,
  "kind" | "label" | "unitNet"
> {
  return {
    kind,
    label: GARMENT_LABEL[kind],
    unitNet: GARMENT_RATES[kind],
  };
}
