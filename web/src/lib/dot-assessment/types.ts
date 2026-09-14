export type CriterionKind = "M" | "Q" | "P" | "X" | "custom";

export type StarLevel = 3 | 4;

export type AssessmentStatus = "draft" | "in_progress" | "ready" | "archived";

export type ResponseStatus = "pending" | "yes" | "no" | "na" | "scored";

export type DotCriterion = {
  code: string;
  text: string;
  kind: CriterionKind;
  maxPoints: number | null;
  notes: string | null;
  groupCode: string | null;
};

export type DotGroup = {
  code: string;
  title: string;
};

export type DotSection = {
  key: string;
  sheetName: string;
  order: number;
  code: string | null;
  title: string;
  caps: { M: number | null; Q: number | null; P: number | null };
  groups: DotGroup[];
  criteria: DotCriterion[];
};

export type DotEntryGate = {
  code: string;
  no: number | string;
  text: string;
  kind: "M";
};

export type DotPropertyField = {
  key: string;
  label: string;
  subLabel: string | null;
};

export type DotCatalog = {
  version: string;
  sourceFile: string;
  sourceDate: string;
  starLevel: StarLevel;
  title: string;
  scoring: {
    mandatoryRequired: number;
    qualityBandMode: string;
    qualityBands3Star: Array<{
      rank: number;
      label: string;
      min?: number;
      max?: number;
    }> | null;
    percentBands: Array<{
      rank: number;
      label: string;
      minPct: number;
      maxPct: number;
    }>;
  };
  propertyFields: DotPropertyField[];
  entryGate: DotEntryGate[];
  sections: DotSection[];
  stats: {
    leafCriteria: number;
    mandatoryLeafCount: number;
    entryGateCount: number;
    sectionCount: number;
  };
};

export type DotResponse = {
  criterionCode: string;
  sectionKey: string;
  status: ResponseStatus;
  scoreM: number | null;
  scoreQ: number | null;
  scoreP: number | null;
  remarks: string | null;
  updatedAt?: string;
};

export type DotEvidence = {
  id: string;
  criterionCode: string;
  storagePath: string;
  fileName: string;
  mimeType: string | null;
  byteSize: number | null;
  caption: string | null;
  uploadedAt: string;
};

export type PropertyInfo = Record<string, string>;

export type DotAssessmentRow = {
  id: string;
  propertyId: string;
  starLevel: StarLevel;
  status: AssessmentStatus;
  propertyInfo: PropertyInfo;
  leadAssessor: string | null;
  assessor2: string | null;
  assessor3: string | null;
  assessedOn: string | null;
  notes: string | null;
  /** Section keys marked N/A (no facility) e.g. recreation, mice */
  naSections: string[];
  createdAt: string;
  updatedAt: string;
};
