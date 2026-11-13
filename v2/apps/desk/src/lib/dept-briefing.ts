/**
 * Department shift briefing — print / sign / file locally until API filing lands.
 */
import { z } from "zod";
import {
  briefingDeptForRole,
  loadDeptSop,
  type BriefingDept,
  type DeptSop,
} from "./dept-sop";
import { readDeskStaff } from "./desk-session";

export const BriefingFileSchema = z.object({
  id: z.string().uuid(),
  propertySlug: z.string(),
  dept: z.enum(["fo", "reservations", "hk", "fnb", "kitchen", "stores", "owner"]),
  businessDate: z.string(),
  shiftLabel: z.string(),
  staffName: z.string(),
  deskRole: z.string().nullable(),
  checklist: z.array(z.string()),
  notes: z.string(),
  signedAt: z.string(),
  printed: z.boolean(),
});

export type BriefingFile = z.infer<typeof BriefingFileSchema>;

const FILES_KEY = "hos.v2.briefingFiles";

function loadFiles(): BriefingFile[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(FILES_KEY);
    if (!raw) return [];
    const parsed = z.array(BriefingFileSchema).safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : [];
  } catch (err) {
    console.error("[briefing] load failed", err);
    return [];
  }
}

function saveFiles(rows: BriefingFile[]): void {
  localStorage.setItem(FILES_KEY, JSON.stringify(rows.slice(0, 200)));
}

export type BriefingDraft = {
  dept: BriefingDept;
  shiftLabel: string;
  checklist: string[];
  rhythmNote: string | null;
  sop: DeptSop;
};

export function buildBriefingDraft(
  deskRole?: string | null,
  now = new Date(),
): BriefingDraft {
  const sop = loadDeptSop();
  const role = deskRole ?? readDeskStaff()?.deskRole ?? null;
  const dept = briefingDeptForRole(role);
  const checklist = sop.checklists[dept] ?? sop.checklists.fo ?? [];

  const mins = now.getHours() * 60 + now.getMinutes();
  const toMins = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    return (h ?? 0) * 60 + (m ?? 0);
  };

  let shiftLabel = "Current shift";
  if (dept === "fo" || dept === "owner") {
    const hit = sop.foShifts.find((s) => {
      const a = toMins(s.start);
      const b = toMins(s.end);
      if (a <= b) return mins >= a && mins < b;
      return mins >= a || mins < b;
    });
    if (hit) shiftLabel = hit.label;
  } else if (dept === "kitchen" || dept === "fnb") {
    const hit = sop.kitchenWindows.find((w) => {
      const a = toMins(w.start);
      const b = toMins(w.end);
      return mins >= a && mins < b;
    });
    if (hit) shiftLabel = hit.label;
  } else if (dept === "reservations") {
    shiftLabel = `Reservations ${sop.reservationsHours.start}–${sop.reservationsHours.end}`;
  }

  const rhythm = sop.opsLeadRhythm.find((r) => Math.abs(toMins(r.time) - mins) <= sop.bufferMinutes);
  return {
    dept,
    shiftLabel,
    checklist,
    rhythmNote: rhythm ? `${rhythm.label}: ${rhythm.protocol}` : null,
    sop,
  };
}

export function fileBriefing(input: {
  propertySlug: string;
  businessDate: string;
  notes: string;
  printed: boolean;
  deskRole?: string | null;
}): BriefingFile {
  const staff = readDeskStaff();
  const draft = buildBriefingDraft(input.deskRole ?? staff?.deskRole);
  const row: BriefingFile = {
    id: crypto.randomUUID(),
    propertySlug: input.propertySlug,
    dept: draft.dept,
    businessDate: input.businessDate,
    shiftLabel: draft.shiftLabel,
    staffName: staff?.fullName ?? "Desk staff",
    deskRole: staff?.deskRole ?? null,
    checklist: draft.checklist,
    notes: input.notes.trim(),
    signedAt: new Date().toISOString(),
    printed: input.printed,
  };
  const next = [row, ...loadFiles().filter((f) => f.id !== row.id)];
  saveFiles(next);
  return row;
}

export function listBriefings(propertySlug: string, businessDate?: string): BriefingFile[] {
  return loadFiles().filter(
    (f) =>
      f.propertySlug === propertySlug &&
      (!businessDate || f.businessDate === businessDate),
  );
}

export function printBriefingHtml(row: BriefingFile): void {
  const win = window.open("", "_blank", "noopener,noreferrer,width=720,height=900");
  if (!win) {
    throw new Error("Pop-up blocked — allow print window");
  }
  const items = row.checklist.map((c) => `<li>${escapeHtml(c)}</li>`).join("");
  win.document.write(`<!doctype html><html><head><title>Shift briefing · ${escapeHtml(row.dept)}</title>
<style>
  body{font-family:Georgia,serif;padding:28px;color:#111;max-width:640px;margin:0 auto}
  h1{font-size:20px;margin:0 0 4px} .meta{color:#555;font-size:13px;margin-bottom:18px}
  ul{padding-left:1.2em;line-height:1.55} .sign{margin-top:36px;border-top:1px solid #ccc;padding-top:16px}
  @media print{button{display:none}}
</style></head><body>
<h1>${escapeHtml(row.shiftLabel)} · ${escapeHtml(row.dept.toUpperCase())}</h1>
<div class="meta">${escapeHtml(row.propertySlug)} · ${escapeHtml(row.businessDate)} · ${escapeHtml(row.staffName)}${row.deskRole ? ` · ${escapeHtml(row.deskRole)}` : ""}</div>
<p><strong>Handover checklist</strong></p>
<ul>${items}</ul>
${row.notes ? `<p><strong>Notes</strong><br/>${escapeHtml(row.notes)}</p>` : ""}
<div class="sign">
  <p>Outgoing signature: ______________________ &nbsp; Time: ${escapeHtml(row.signedAt.slice(11, 16))}</p>
  <p>Incoming signature: ______________________</p>
</div>
<button onclick="window.print()">Print</button>
</body></html>`);
  win.document.close();
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
