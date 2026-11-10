/**
 * Real CSV exporters for DRC BST-3 and Tourist Police / Immigration manifests.
 */

import {
  formatNu,
  taxBreakdown,
  useFrontOfficeStore,
  ymd,
} from "./front-office-store";
import { useFiscalStore } from "./fiscal-store";
import { useFnbStore } from "./fnb-store";
import { apiGet, sessionPropertyId } from "./api";

function csvEscape(cell: string): string {
  if (/[",\n\r]/.test(cell)) return `"${cell.replace(/"/g, '""')}"`;
  return cell;
}

function toCsv(rows: string[][]): string {
  return rows.map((r) => r.map((c) => csvEscape(String(c))).join(",")).join("\n");
}

function downloadCsv(filename: string, rows: string[][]): void {
  const blob = new Blob([toCsv(rows)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export type ExportResult = {
  ok: true;
  filename: string;
  rows: number;
};

/** DRC Form BST-3 draft — room + F&B SC/BST breakdown + tip-pool SC line. */
export function exportBst3Csv(opts?: {
  tpn?: string;
  license?: string;
}): ExportResult {
  const fo = useFrontOfficeStore.getState();
  const fiscal = useFiscalStore.getState();
  const fnb = useFnbStore.getState();
  const date = fo.businessDate || ymd(new Date());
  const tpn = opts?.tpn?.trim() || "BTN-TPN-PENDING";
  const license = opts?.license?.trim() || "DOT-HTL-PENDING";

  const inHouse = fo.stays.filter((s) => s.status === "checked_in");
  const roomNet = inHouse.reduce((s, st) => s + st.nightlyNet, 0);
  const roomTax = taxBreakdown(roomNet);
  const fnbNet = fnb.orders.reduce((s, o) => s + o.net, 0);
  const fnbSc = fnb.orders.reduce((s, o) => s + o.sc, 0);
  const fnbBst = fnb.orders.reduce((s, o) => s + o.bst, 0);
  const fnbTot = fnb.orders.reduce((s, o) => s + o.total, 0);

  const payload = fiscal.reportPayload("bst3");
  const tipPoolSc = roomTax.scAmount;

  const rows: string[][] = [
    ["DRC Form BST-3", "Hotel OS v2", date],
    ["TPN", tpn, ""],
    ["Hotel License", license, ""],
    ["Business Date", date, ""],
    ["Last Night Audit", fiscal.lastAuditDate ?? "—", ""],
    [],
    ["Bucket", "Net (BTN)", "SC 10%", "BST 10%", "Total"],
    [
      "Room (in-house nightly)",
      String(roomTax.netAmount),
      String(roomTax.scAmount),
      String(roomTax.bstAmount),
      String(roomTax.totalAmount),
    ],
    [
      "F&B POS settled",
      String(fnbNet),
      String(fnbSc),
      String(fnbBst),
      String(fnbTot),
    ],
    [
      "TOTAL",
      String(roomTax.netAmount + fnbNet),
      String(roomTax.scAmount + fnbSc),
      String(roomTax.bstAmount + fnbBst),
      String(roomTax.totalAmount + fnbTot),
    ],
    [],
    ["SC Tip Pool (room SC draft)", formatNu(tipPoolSc), ""],
    ["Headline", payload.headline, ""],
    ["Generated At", new Date().toISOString(), ""],
  ];

  const filename = `bst3-${date}-${tpn.slice(-6)}.csv`;
  downloadCsv(filename, rows);
  return { ok: true, filename, rows: rows.length };
}

/** Tourist Police / Immigration daily manifest — foreign nationals in-house. */
export function exportPoliceManifestCsv(opts?: {
  asOfDate?: string;
}): ExportResult {
  const fo = useFrontOfficeStore.getState();
  const asOf = opts?.asOfDate ?? (fo.businessDate || ymd(new Date()));
  const inHouse = fo.stays.filter((s) => s.status === "checked_in");
  const foreign = inHouse.filter(
    (s) => s.nationality.trim().toLowerCase() !== "bhutanese",
  );

  const rows: string[][] = [
    [
      "Guest",
      "Passport/CID",
      "Nationality",
      "Room",
      "CheckIn",
      "CheckOut",
      "Confirmation",
      "VIP",
      "Agent",
      "MealPlan",
    ],
    ...foreign.map((s) => [
      s.guestName,
      s.passportOrCid,
      s.nationality,
      s.roomNumber ?? "unassigned",
      s.checkIn,
      s.checkOut,
      s.confirmationNo,
      s.vip ? "Y" : "N",
      s.agencyName ?? "",
      s.mealPlan,
    ]),
  ];

  const filename = `police-manifest-${asOf}.csv`;
  downloadCsv(filename, rows);
  return { ok: true, filename, rows: foreign.length };
}

type ApiManifestRow = {
  guestName?: string;
  passportOrCid?: string;
  nationality?: string;
  roomNumber?: string | null;
  checkIn?: string;
  checkOut?: string;
  confirmationNo?: string;
  vip?: boolean;
  agencyName?: string | null;
  mealPlan?: string;
};

/**
 * Prefer API/Postgres immigration manifest when reachable; fall back to local FO state.
 */
export async function exportPoliceManifestPreferApi(opts?: {
  asOfDate?: string;
}): Promise<ExportResult & { source: "api" | "local" }> {
  const asOf = opts?.asOfDate ?? useFrontOfficeStore.getState().businessDate;
  try {
    const res = await apiGet<{
      ok?: boolean;
      rows?: ApiManifestRow[];
      data?: ApiManifestRow[];
    }>(
      `/v1/compliance/immigration-manifest?propertyId=${encodeURIComponent(sessionPropertyId())}&asOf=${encodeURIComponent(asOf)}`,
      { retries: 0 },
    );
    const list = res.rows ?? res.data ?? [];
    if (Array.isArray(list) && list.length >= 0 && res) {
      const rows: string[][] = [
        [
          "Guest",
          "Passport/CID",
          "Nationality",
          "Room",
          "CheckIn",
          "CheckOut",
          "Confirmation",
          "VIP",
          "Agent",
          "MealPlan",
          "Source",
        ],
        ...list.map((s) => [
          s.guestName ?? "",
          s.passportOrCid ?? "",
          s.nationality ?? "",
          s.roomNumber ?? "unassigned",
          s.checkIn ?? "",
          s.checkOut ?? "",
          s.confirmationNo ?? "",
          s.vip ? "Y" : "N",
          s.agencyName ?? "",
          s.mealPlan ?? "",
          "api",
        ]),
      ];
      const filename = `police-manifest-${asOf}-api.csv`;
      downloadCsv(filename, rows);
      return { ok: true, filename, rows: list.length, source: "api" };
    }
  } catch (err) {
    console.error("[compliance] immigration API fallback to local", err);
  }
  const local = exportPoliceManifestCsv({ asOfDate: asOf });
  return { ...local, source: "local" };
}

/** RRCO binder — packs BST-3 summary + void log stub + audit closes as CSV zip-alternative (multi-section CSV). */
export function exportRrcoBinderCsv(opts?: {
  tpn?: string;
}): ExportResult {
  const fo = useFrontOfficeStore.getState();
  const fiscal = useFiscalStore.getState();
  const date = fo.businessDate || ymd(new Date());
  const tpn = opts?.tpn?.trim() || "BTN-TPN-PENDING";

  const voids: string[][] = [];
  for (const s of fo.stays) {
    for (const line of s.folioLines) {
      if (!line.voided) continue;
      voids.push([
        s.confirmationNo,
        s.guestName,
        line.description,
        String(line.totalAmount),
        line.postedAt,
      ]);
    }
  }

  const rows: string[][] = [
    ["RRCO Audit Binder", date, tpn],
    [],
    ["SECTION", "Night Audit Log"],
    ["Entry"],
    ...(fiscal.auditLog.length
      ? fiscal.auditLog.map((l) => [l])
      : [["(no closes yet)"]]),
    [],
    ["SECTION", "Voided Folio Lines"],
    ["Confirmation", "Guest", "Line", "Total", "PostedAt"],
    ...voids,
    [],
    ["SECTION", "BST-3 Snapshot"],
    ...exportBst3RowsInline(tpn, date),
  ];

  const filename = `rrco-binder-${date}.csv`;
  downloadCsv(filename, rows);
  return { ok: true, filename, rows: rows.length };
}

function exportBst3RowsInline(tpn: string, date: string): string[][] {
  const fo = useFrontOfficeStore.getState();
  const fnb = useFnbStore.getState();
  const inHouse = fo.stays.filter((s) => s.status === "checked_in");
  const roomNet = inHouse.reduce((s, st) => s + st.nightlyNet, 0);
  const t = taxBreakdown(roomNet);
  return [
    ["TPN", tpn],
    ["Date", date],
    ["Room Net", String(t.netAmount)],
    ["Room SC", String(t.scAmount)],
    ["Room BST", String(t.bstAmount)],
    ["F&B Total", String(fnb.orders.reduce((s, o) => s + o.total, 0))],
  ];
}
