/** Lightweight draft parsers (no Zod dependency) — reject unexpected shapes. */

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v != null && !Array.isArray(v);
}

function optStr(v: unknown): string | null | undefined {
  if (v == null) return v as null | undefined;
  return typeof v === "string" ? v : undefined;
}

function optNum(v: unknown): number | null | undefined {
  if (v == null) return v as null | undefined;
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}

function optBool(v: unknown): boolean | null | undefined {
  if (v == null) return v as null | undefined;
  return typeof v === "boolean" ? v : undefined;
}

export type StayDraft = {
  guestName?: string | null;
  checkIn?: string | null;
  checkOut?: string | null;
  rooms?: number | null;
  mealPlan?: string | null;
  nightlyRateBtn?: number | null;
  agentName?: string | null;
  guideName?: string | null;
  notes?: string | null;
  confidence?: string | null;
  summary?: string | null;
};

export type ExplainDueDraft = {
  dueBtn?: number | null;
  plainExplanation?: string | null;
  suggestedSteps?: string[] | null;
  voidRepostPlaybook?: string | null;
  confidence?: string | null;
};

export type CheckoutChecklistDraft = {
  ready?: boolean | null;
  blockers?: string[] | null;
  checklist?: Array<{ item: string; ok: boolean; hint?: string | null }> | null;
  plainSummary?: string | null;
};

export type PosTicketDraft = {
  lines?: Array<{ name: string; qty?: number | null; notes?: string | null }> | null;
  guestNote?: string | null;
  summary?: string | null;
  confidence?: string | null;
};

export type InvoiceNotesDraft = {
  notes?: string | null;
  shareText?: string | null;
  warning?: string | null;
};

export type CheckInDraft = {
  nationality?: string | null;
  adults?: number | null;
  children?: number | null;
  guideNumber?: string | null;
  roomSuggestion?: string | null;
  notes?: string | null;
  summary?: string | null;
};

export type NightCloseDraft = {
  blockers?: string[] | null;
  plainSummary?: string | null;
  readyToRun?: boolean | null;
};

export type AgentRateSheetDraft = {
  agentsPctOfPublic?: number | null;
  summary?: string | null;
  cells?: Array<{
    roomTypeCode?: string | null;
    seasonKind?: string | null;
    proposedBtn?: number | null;
  }> | null;
};

export type ShiftBriefingDraft = {
  briefing: string;
  focus?: string[] | null;
};

export function parseAssistDraft<T>(
  parse: (data: unknown) => T | null,
  data: unknown,
): { ok: true; data: T } | { ok: false; error: string } {
  try {
    const out = parse(data);
    if (out == null) {
      return { ok: false, error: "Draft shape unexpected — discard and retry." };
    }
    return { ok: true, data: out };
  } catch {
    return { ok: false, error: "Draft shape unexpected — discard and retry." };
  }
}

export function parseStayDraft(data: unknown): StayDraft | null {
  if (!isObj(data)) return null;
  return {
    guestName: optStr(data.guestName),
    checkIn: optStr(data.checkIn),
    checkOut: optStr(data.checkOut),
    rooms: optNum(data.rooms),
    mealPlan: optStr(data.mealPlan),
    nightlyRateBtn: optNum(data.nightlyRateBtn),
    agentName: optStr(data.agentName),
    guideName: optStr(data.guideName),
    notes: optStr(data.notes),
    confidence: optStr(data.confidence),
    summary: optStr(data.summary),
  };
}

export function parseExplainDueDraft(data: unknown): ExplainDueDraft | null {
  if (!isObj(data)) return null;
  const steps = Array.isArray(data.suggestedSteps)
    ? data.suggestedSteps.filter((s): s is string => typeof s === "string")
    : null;
  return {
    dueBtn: optNum(data.dueBtn),
    plainExplanation: optStr(data.plainExplanation),
    suggestedSteps: steps,
    voidRepostPlaybook: optStr(data.voidRepostPlaybook),
    confidence: optStr(data.confidence),
  };
}

export function parseCheckoutChecklistDraft(
  data: unknown,
): CheckoutChecklistDraft | null {
  if (!isObj(data)) return null;
  const blockers = Array.isArray(data.blockers)
    ? data.blockers.filter((s): s is string => typeof s === "string")
    : null;
  const checklist = Array.isArray(data.checklist)
    ? data.checklist
        .filter(isObj)
        .map((c) => ({
          item: String(c.item ?? ""),
          ok: Boolean(c.ok),
          hint: optStr(c.hint),
        }))
        .filter((c) => c.item)
    : null;
  return {
    ready: optBool(data.ready),
    blockers,
    checklist,
    plainSummary: optStr(data.plainSummary),
  };
}

export function parsePosTicketDraft(data: unknown): PosTicketDraft | null {
  if (!isObj(data)) return null;
  const lines = Array.isArray(data.lines)
    ? data.lines
        .filter(isObj)
        .map((l) => ({
          name: String(l.name ?? ""),
          qty: optNum(l.qty),
          notes: optStr(l.notes),
        }))
        .filter((l) => l.name)
    : null;
  return {
    lines,
    guestNote: optStr(data.guestNote),
    summary: optStr(data.summary),
    confidence: optStr(data.confidence),
  };
}

export function parseInvoiceNotesDraft(data: unknown): InvoiceNotesDraft | null {
  if (!isObj(data)) return null;
  return {
    notes: optStr(data.notes),
    shareText: optStr(data.shareText),
    warning: optStr(data.warning),
  };
}

export function parseCheckInDraft(data: unknown): CheckInDraft | null {
  if (!isObj(data)) return null;
  return {
    nationality: optStr(data.nationality),
    adults: optNum(data.adults),
    children: optNum(data.children),
    guideNumber: optStr(data.guideNumber),
    roomSuggestion: optStr(data.roomSuggestion),
    notes: optStr(data.notes),
    summary: optStr(data.summary),
  };
}

export function parseNightCloseDraft(data: unknown): NightCloseDraft | null {
  if (!isObj(data)) return null;
  const blockers = Array.isArray(data.blockers)
    ? data.blockers.filter((s): s is string => typeof s === "string")
    : null;
  return {
    blockers,
    plainSummary: optStr(data.plainSummary),
    readyToRun: optBool(data.readyToRun),
  };
}

export function parseAgentRateSheetDraft(
  data: unknown,
): AgentRateSheetDraft | null {
  if (!isObj(data)) return null;
  const cells = Array.isArray(data.cells)
    ? data.cells.filter(isObj).map((c) => ({
        roomTypeCode: optStr(c.roomTypeCode),
        seasonKind: optStr(c.seasonKind),
        proposedBtn: optNum(c.proposedBtn),
      }))
    : null;
  return {
    agentsPctOfPublic: optNum(data.agentsPctOfPublic),
    summary: optStr(data.summary),
    cells,
  };
}

export function parseShiftBriefingDraft(
  data: unknown,
): ShiftBriefingDraft | null {
  if (!isObj(data) || typeof data.briefing !== "string") return null;
  const focus = Array.isArray(data.focus)
    ? data.focus.filter((s): s is string => typeof s === "string")
    : null;
  return { briefing: data.briefing, focus };
}
