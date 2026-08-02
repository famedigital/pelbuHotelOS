import type { DotCatalog, StarLevel } from "@/lib/dot-assessment/types";
import catalog3 from "@/lib/dot-assessment/catalog/hcs-2024-3star.json";
import catalog4 from "@/lib/dot-assessment/catalog/hcs-2024-4star.json";

const CATALOGS: Record<StarLevel, DotCatalog> = {
  3: catalog3 as DotCatalog,
  4: catalog4 as DotCatalog,
};

export function getCatalog(starLevel: StarLevel): DotCatalog {
  return CATALOGS[starLevel];
}

export function listCatalogStarLevels(): StarLevel[] {
  return [3, 4];
}

export function findCriterion(catalog: DotCatalog, code: string) {
  if (code.startsWith("gate.")) {
    return catalog.entryGate.find((g) => g.code === code) ?? null;
  }
  for (const section of catalog.sections) {
    const c = section.criteria.find((x) => x.code === code);
    if (c) return { section, criterion: c };
  }
  return null;
}

export function allScorableCodes(catalog: DotCatalog): string[] {
  const codes = catalog.entryGate.map((g) => g.code);
  for (const s of catalog.sections) {
    for (const c of s.criteria) {
      if (c.kind !== "X") codes.push(c.code);
    }
  }
  return codes;
}
