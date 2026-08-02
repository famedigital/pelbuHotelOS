import type {
  DotCatalog,
  DotResponse,
  DotSection,
} from "@/lib/dot-assessment/types";

export type SectionScore = {
  sectionKey: string;
  title: string;
  order: number;
  na: boolean;
  mRequired: number;
  mAchieved: number;
  qMax: number;
  qAchieved: number;
  pMax: number;
  pAchieved: number;
  answered: number;
  totalScorable: number;
  incompleteCodes: string[];
  failedMCodes: string[];
};

export type Scoreboard = {
  entryGate: {
    required: number;
    yes: number;
    no: number;
    pending: number;
    complete: boolean;
    failedCodes: string[];
    pendingCodes: string[];
  };
  sections: SectionScore[];
  totals: {
    mRequired: number;
    mAchieved: number;
    mShortfall: number;
    qAchieved: number;
    qMax: number;
    pAchieved: number;
    pMax: number;
    answered: number;
    totalScorable: number;
    progressPct: number;
  };
  qualityBand: { rank: number; label: string } | null;
  pBand: { rank: number; label: string } | null;
  mandatoryPass: boolean;
  entryGatePass: boolean;
  readyForInspection: boolean;
  failedMCodes: string[];
};

function responseMap(responses: DotResponse[]): Map<string, DotResponse> {
  const m = new Map<string, DotResponse>();
  for (const r of responses) m.set(r.criterionCode, r);
  return m;
}

function scoreMOf(r: DotResponse | undefined): number | null {
  if (!r) return null;
  if (r.scoreM === 0 || r.scoreM === 1) return r.scoreM;
  if (r.status === "yes") return 1;
  if (r.status === "no") return 0;
  return null;
}

function scoreQOf(r: DotResponse | undefined): number | null {
  if (!r || r.scoreQ == null) return null;
  if (r.scoreQ < 1 || r.scoreQ > 5) return null;
  return r.scoreQ;
}

function scorePOf(r: DotResponse | undefined, max: number | null): number {
  if (!r || r.scoreP == null) return 0;
  const maxP = max ?? Number.POSITIVE_INFINITY;
  return Math.max(0, Math.min(r.scoreP, maxP));
}

function bandFromPercent(
  catalog: DotCatalog,
  pct: number,
): { rank: number; label: string } | null {
  if (!Number.isFinite(pct) || pct <= 0) return null;
  for (const b of catalog.scoring.percentBands) {
    if (pct >= b.minPct && pct <= b.maxPct) {
      return { rank: b.rank, label: b.label };
    }
  }
  if (pct > 100) {
    return catalog.scoring.percentBands.find((b) => b.rank === 5) ?? null;
  }
  return null;
}

function qualityBand3Absolute(
  catalog: DotCatalog,
  q: number,
): { rank: number; label: string } | null {
  const bands = catalog.scoring.qualityBands3Star;
  if (!bands) return null;
  for (const b of bands) {
    if (b.min != null && b.max != null && q >= b.min && q <= b.max) {
      return { rank: b.rank, label: b.label };
    }
    if (b.max != null && b.min == null && q <= b.max) {
      return { rank: b.rank, label: b.label };
    }
  }
  return null;
}

function sectionScorable(section: DotSection) {
  return section.criteria.filter((c) => c.kind !== "X");
}

/**
 * Live scoreboard for an assessment, mirroring HCS 2024 scoring sheets.
 * `naSections` drops recreation/mice (etc.) from totals when the hotel has no facility.
 */
export function computeScoreboard(
  catalog: DotCatalog,
  responses: DotResponse[],
  naSections: string[] = [],
): Scoreboard {
  const map = responseMap(responses);
  const naSet = new Set(naSections);

  // Entry gate
  let yes = 0;
  let no = 0;
  let pending = 0;
  const failedCodes: string[] = [];
  const pendingCodes: string[] = [];
  for (const g of catalog.entryGate) {
    const r = map.get(g.code);
    const m = scoreMOf(r);
    if (m === 1) yes += 1;
    else if (m === 0) {
      no += 1;
      failedCodes.push(g.code);
    } else {
      pending += 1;
      pendingCodes.push(g.code);
    }
  }
  const entryRequired = catalog.entryGate.length;
  const entryGatePass = yes === entryRequired && pending === 0 && no === 0;

  const sections: SectionScore[] = [];
  const allFailedM: string[] = [];
  let mRequired = 0;
  let mAchieved = 0;
  let qAchieved = 0;
  let qMax = 0;
  let pAchieved = 0;
  let pMax = 0;
  let answered = 0;
  let totalScorable = entryRequired;

  for (const section of catalog.sections) {
    const na = naSet.has(section.key);
    const scorable = sectionScorable(section);
    const incompleteCodes: string[] = [];
    const failedMCodes: string[] = [];
    let secMReq = 0;
    let secMAch = 0;
    let secQ = 0;
    let secP = 0;
    let secAns = 0;

    // Q max: count of Q criteria * 5 (rate 1–5). Official sheet uses section Standard Points.
    const qCriteria = scorable.filter((c) => c.kind === "Q");
    const pCriteria = scorable.filter(
      (c) => c.kind === "P" || (c.kind === "custom" && c.maxPoints != null),
    );
    const mCriteria = scorable.filter((c) => c.kind === "M");
    const customNoMax = scorable.filter(
      (c) => c.kind === "custom" && c.maxPoints == null,
    );

    const secQMax = qCriteria.length * 5;
    const secPMax =
      pCriteria.reduce((n, c) => n + (c.maxPoints ?? 0), 0) ||
      (section.caps.P ?? 0);

    if (!na) {
      totalScorable += scorable.length;
      // Prefer official section M cap when present and higher than leaf count
      // (some M indicators are implied on the scoring sheet only).
      secMReq = section.caps.M ?? mCriteria.length;
      // Count achieved only from leaf M answers; shortfall vs official cap shown to user
      for (const c of mCriteria) {
        const r = map.get(c.code);
        const m = scoreMOf(r);
        if (m === 1) {
          secMAch += 1;
          secAns += 1;
        } else if (m === 0) {
          failedMCodes.push(c.code);
          secAns += 1;
        } else {
          incompleteCodes.push(c.code);
        }
      }
      for (const c of qCriteria) {
        const r = map.get(c.code);
        const q = scoreQOf(r);
        if (q != null) {
          secQ += q;
          secAns += 1;
          if (q < 1) failedMCodes.push(c.code); // treat as fail signal
        } else incompleteCodes.push(c.code);
      }
      for (const c of pCriteria) {
        const r = map.get(c.code);
        if (r && (r.status === "scored" || r.scoreP != null || r.status === "na")) {
          secP += r.status === "na" ? 0 : scorePOf(r, c.maxPoints);
          secAns += 1;
        } else incompleteCodes.push(c.code);
      }
      for (const c of customNoMax) {
        const r = map.get(c.code);
        const m = scoreMOf(r);
        const q = scoreQOf(r);
        if (m != null || q != null || (r && r.scoreP != null) || r?.status === "na") {
          secAns += 1;
          if (m === 1) {
            /* optional */
          } else if (m === 0) failedMCodes.push(c.code);
          if (q != null) secQ += q;
          if (r?.scoreP != null) secP += scorePOf(r, null);
        } else incompleteCodes.push(c.code);
      }

      mRequired += secMReq;
      mAchieved += secMAch;
      qAchieved += secQ;
      qMax += secQMax;
      pAchieved += secP;
      pMax += secPMax || (section.caps.P ?? 0);
      answered += secAns;
      allFailedM.push(...failedMCodes);
    }

    sections.push({
      sectionKey: section.key,
      title: section.title,
      order: section.order,
      na,
      mRequired: na ? 0 : secMReq,
      mAchieved: na ? 0 : secMAch,
      qMax: na ? 0 : secQMax,
      qAchieved: na ? 0 : secQ,
      pMax: na ? 0 : secPMax || (section.caps.P ?? 0),
      pAchieved: na ? 0 : secP,
      answered: na ? 0 : secAns,
      totalScorable: na ? 0 : scorable.length,
      incompleteCodes: na ? [] : incompleteCodes,
      failedMCodes: na ? [] : failedMCodes,
    });
  }

  // Entry answers count toward progress
  answered += yes + no;

  // Align required M with official scoring sheet when no optional sections are excluded
  if (naSet.size === 0) {
    mRequired = catalog.scoring.mandatoryRequired;
  }

  const mShortfall = Math.max(0, mRequired - mAchieved);
  const progressPct = totalScorable
    ? Math.round((answered / totalScorable) * 100)
    : 0;

  const qPct = qMax > 0 ? (qAchieved / qMax) * 100 : 0;
  const pPct = pMax > 0 ? (pAchieved / pMax) * 100 : 0;

  const qualityBand =
    catalog.starLevel === 3 && catalog.scoring.qualityBands3Star
      ? qualityBand3Absolute(catalog, qAchieved) ?? bandFromPercent(catalog, qPct)
      : bandFromPercent(catalog, qPct);

  const pBand = bandFromPercent(catalog, pPct);

  // Quality fail if any answered Q is missing scale (already treated) — also if any Q score would be 0 (not allowed)
  const mandatoryPass = mShortfall === 0 && allFailedM.length === 0;
  const readyForInspection =
    entryGatePass && mandatoryPass && progressPct >= 100;

  return {
    entryGate: {
      required: entryRequired,
      yes,
      no,
      pending,
      complete: entryGatePass,
      failedCodes,
      pendingCodes,
    },
    sections,
    totals: {
      mRequired,
      mAchieved,
      mShortfall,
      qAchieved,
      qMax,
      pAchieved,
      pMax,
      answered,
      totalScorable,
      progressPct: Math.min(100, progressPct),
    },
    qualityBand,
    pBand,
    mandatoryPass,
    entryGatePass,
    readyForInspection,
    failedMCodes: allFailedM,
  };
}

export function countProgress(
  catalog: DotCatalog,
  responses: DotResponse[],
  naSections: string[] = [],
): { answered: number; total: number; pct: number } {
  const s = computeScoreboard(catalog, responses, naSections);
  return {
    answered: s.totals.answered,
    total: s.totals.totalScorable,
    pct: s.totals.progressPct,
  };
}
