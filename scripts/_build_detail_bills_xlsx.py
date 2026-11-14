"""Build Pelbu detail-bills Excel from JSON (paid/unpaid from TA Payment Follow-up)."""
from __future__ import annotations

import json
import re
from pathlib import Path

from openpyxl import Workbook
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter

JSON_PATH = Path(r"C:\Users\rajiv\Downloads\_pelbu_detail_bills_aug_nov.json")
OUT_PATH = Path(
    r"C:\Users\rajiv\Downloads\Pelbu Olakha detail bills Aug-Nov 2026 TA checked.xlsx"
)

MONTH_NAMES = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
]

HEADER_FILL = PatternFill("solid", fgColor="1F4E3D")
HEADER_FONT = Font(name="Arial", bold=True, color="FFFFFF", size=10)
TITLE_FONT = Font(name="Arial", bold=True, size=14)
BODY_FONT = Font(name="Arial", size=10)
BOLD = Font(name="Arial", bold=True, size=10)
PAID_FILL = PatternFill("solid", fgColor="E7F2EA")
UNPAID_FILL = PatternFill("solid", fgColor="FFE8E8")
THIN = Border(
    left=Side(style="thin", color="D0D0D0"),
    right=Side(style="thin", color="D0D0D0"),
    top=Side(style="thin", color="D0D0D0"),
    bottom=Side(style="thin", color="D0D0D0"),
)


def fmt_date(iso: str) -> str:
    parts = str(iso or "")[:10].split("-")
    if len(parts) != 3:
        return ""
    y, m, d = (int(x) for x in parts)
    return f"{d} {MONTH_NAMES[m - 1]} {y}"


def style_header(ws, row: int, cols: int) -> None:
    for c in range(1, cols + 1):
        cell = ws.cell(row, c)
        cell.fill = HEADER_FILL
        cell.font = HEADER_FONT
        cell.alignment = Alignment(vertical="center", wrap_text=True)


def autosize(ws, max_w: int = 56) -> None:
    for col in ws.columns:
        letter = get_column_letter(col[0].column)
        width = 12
        for cell in col:
            val = "" if cell.value is None else str(cell.value)
            width = max(width, min(max_w, len(val) + 2))
        ws.column_dimensions[letter].width = width


def is_soul(row: dict) -> bool:
    blob = " ".join(
        [
            str(row.get("code") or ""),
            str(row.get("agent") or ""),
            str(row.get("guestAgentCode") or ""),
            str(row.get("bookingCode") or ""),
        ]
    ).lower()
    if "soultrip" in blob or "soul trip" in blob:
        return True
    return bool(re.match(r"^ST\b", str(row.get("code") or "").strip(), re.I))


def write_detail_sheet(wb, title: str, subtitle: str, rows: list[dict], position=None):
    if position is None:
        ws = wb.create_sheet(title)
    else:
        ws = wb.create_sheet(title, position)
    ws.freeze_panes = "A6"
    ws["A1"] = "PELBU SUITES OLAKHA"
    ws["A1"].font = TITLE_FONT
    ws["A2"] = subtitle
    ws["A3"] = (
        "Alias = rack cell · note = full group detail  ·  Paid/Unpaid from "
        "TA Payment Follow-up  ·  Incl. 10% S.C.  ·  GST not charged"
    )
    ws["A4"] = f"Bookings: {len(rows)}"
    for r in (2, 3, 4):
        ws.cell(r, 1).font = BODY_FONT

    headers = [
        "Sl. no",
        "Guest / Agent / Alias",
        "Check-in",
        "Check-out",
        "No. of nights",
        "No. of rooms",
        "Rate",
        "Total",
        "Paid / Unpaid",
        "Remarks",
    ]
    hr = 6
    for i, h in enumerate(headers, 1):
        ws.cell(hr, i, h)
    style_header(ws, hr, len(headers))

    nights = rooms = total = paid_amt = unpaid_amt = 0.0
    paid_n = unpaid_n = 0
    for i, row in enumerate(rows, 1):
        r = hr + i
        label = row.get("payLabel") or "Unpaid"
        rem = row.get("payNote") or row.get("remarks") or ""
        # Prefer short pay remark; keep full note after
        full_note = row.get("rawNote") or ""
        if not full_note:
            # remarks may already combine note || pay
            parts = str(row.get("remarks") or "").split(" || ")
            full_note = parts[0] if parts else ""
            if len(parts) > 1 and not row.get("payNote"):
                rem = parts[-1]
        remark_out = " · ".join(
            [
                x
                for x in [
                    rem,
                    full_note if full_note and full_note not in rem else "",
                ]
                if x
            ]
        )
        vals = [
            i,
            row.get("guestAgentCode") or "",
            fmt_date(row.get("checkIn") or ""),
            fmt_date(row.get("checkOut") or ""),
            row.get("nights") or 0,
            row.get("rooms") or 0,
            row.get("rate") or "",
            row.get("total") or 0,
            label,
            remark_out,
        ]
        for c, v in enumerate(vals, 1):
            cell = ws.cell(r, c, v)
            cell.font = BODY_FONT
            cell.border = THIN
            if c in (2, 7, 10):
                cell.alignment = Alignment(wrap_text=True, vertical="top")
            if c == 8:
                cell.number_format = "#,##0.00"
            if c == 9:
                cell.alignment = Alignment(horizontal="center", vertical="center")
                cell.fill = PAID_FILL if label == "Paid" else UNPAID_FILL
                cell.font = BOLD
        nights += float(row.get("nights") or 0)
        rooms += float(row.get("rooms") or 0)
        total += float(row.get("total") or 0)
        paid_amt += float(row.get("paid") or 0)
        unpaid_amt += float(row.get("unpaid") or 0)
        if label == "Paid":
            paid_n += 1
        else:
            unpaid_n += 1
        ws.row_dimensions[r].height = max(
            28, min(80, 16 + len(str(remark_out)) // 70 * 12)
        )

    tr = hr + len(rows) + 1
    for c, v in enumerate(
        [
            "",
            f"TOTAL · {len(rows)} bookings · Paid {paid_n} · Unpaid {unpaid_n}",
            "",
            "",
            int(nights),
            int(rooms),
            "",
            round(total, 2),
            "",
            f"Paid Nu {round(paid_amt, 2):,.2f}  ·  Unpaid Nu {round(unpaid_amt, 2):,.2f}",
        ],
        1,
    ):
        cell = ws.cell(tr, c, v)
        cell.font = BOLD
        if c == 8:
            cell.number_format = "#,##0.00"

    autosize(ws, 60)
    ws.column_dimensions["B"].width = 44
    ws.column_dimensions["G"].width = 32
    ws.column_dimensions["I"].width = 14
    ws.column_dimensions["J"].width = 56
    return {
        "nights": int(nights),
        "rooms": int(rooms),
        "total": round(total, 2),
        "paid": round(paid_amt, 2),
        "unpaid": round(unpaid_amt, 2),
        "paid_n": paid_n,
        "unpaid_n": unpaid_n,
    }


def main() -> None:
    data = json.loads(JSON_PATH.read_text(encoding="utf-8"))
    billed = data["billed"]
    # keep rawNote if present for remarks split
    for row in billed:
        if "rawNote" not in row:
            rem = str(row.get("remarks") or "")
            row["rawNote"] = rem.split(" || ")[0] if rem else ""

    agent_rows = data["agentRows"]
    tot = data["tot"]
    months = data["months"]
    source = data.get("input", "")
    pay_path = data.get("payPath") or ""

    wb = Workbook()

    # Summary
    ws = wb.active
    ws.title = "Summary"
    ws.freeze_panes = "A6"
    ws["A1"] = "PELBU SUITES OLAKHA"
    ws["A1"].font = TITLE_FONT
    ws["A2"] = "Detail bills — agent-wise summary (cross-checked with TA Payment Follow-up)"
    ws["A3"] = (
        "1 Aug 2026 – 30 Nov 2026  ·  Incl. 10% service charge  ·  GST not charged"
    )
    ws["A4"] = f"Source: {source}  ·  Payments: {pay_path or '(notes only)'}"
    for r in (2, 3, 4):
        ws.cell(r, 1).font = BODY_FONT

    headers = [
        "Sl. no",
        "Agent",
        "Alias (rack)",
        "No. of bookings",
        "No. of rooms",
        "Nights",
        "Total",
        "Paid",
        "Unpaid",
    ]
    hr = 6
    for i, h in enumerate(headers, 1):
        ws.cell(hr, i, h)
    style_header(ws, hr, len(headers))

    for i, a in enumerate(agent_rows, 1):
        r = hr + i
        vals = [
            i,
            a["agent"],
            a.get("aliases") or "",
            a["bookings"],
            a["rooms"],
            a["nights"],
            a["total"],
            a["paid"],
            a["unpaid"],
        ]
        for c, v in enumerate(vals, 1):
            cell = ws.cell(r, c, v)
            cell.font = BODY_FONT
            cell.border = THIN
            if c >= 7:
                cell.number_format = "#,##0.00"
            if c == 8 and float(a.get("paid") or 0) > 0:
                cell.fill = PAID_FILL
            if c == 9 and float(a.get("unpaid") or 0) > 0:
                cell.fill = UNPAID_FILL

    tr = hr + len(agent_rows) + 1
    for c, v in enumerate(
        [
            "",
            "TOTAL",
            "",
            tot["bookings"],
            tot["rooms"],
            tot["nights"],
            tot["total"],
            tot["paid"],
            tot["unpaid"],
        ],
        1,
    ):
        cell = ws.cell(tr, c, v)
        cell.font = BOLD
        if c >= 7 and v != "":
            cell.number_format = "#,##0.00"

    ws.cell(tr + 2, 1, "Assumptions")
    ws.cell(
        tr + 2,
        2,
        "Paid / Unpaid from TA Payment Follow up.xlsx (TA + Local sheets). "
        "Matched by agent + check-in (+ guest when available). "
        "Status Not Received or due balance → Unpaid. "
        "mPAY/mBOB/Cash/UPI/etc or received amount → Paid. "
        "Stays not on the payment file → Unpaid. Rates from group note or agent card.",
    )
    ws.merge_cells(start_row=tr + 2, start_column=2, end_row=tr + 2, end_column=9)
    ws.cell(tr + 2, 2).alignment = Alignment(wrap_text=True, vertical="top")
    ws.row_dimensions[tr + 2].height = 55
    autosize(ws)
    ws.column_dimensions["B"].width = 36
    ws.column_dimensions["C"].width = 18

    # Soultrip sheet (right after Summary)
    soul_rows = [r for r in billed if is_soul(r)]
    soul_rows.sort(key=lambda r: (r.get("checkIn") or "", r.get("guestAgentCode") or ""))
    write_detail_sheet(
        wb,
        "Soultrip",
        "Detail bill — Soultrip (ST)  ·  Aug–Nov 2026",
        soul_rows,
        position=1,
    )

    for month in months:
        key = month["key"]
        name = month["name"]
        label = month["label"]
        rows = [
            r
            for r in billed
            if key in (r.get("months") or [])
            or (r.get("checkIn") or "")[:7] == key
        ]
        rows.sort(key=lambda r: (r.get("checkIn") or "", r.get("agent") or ""))
        write_detail_sheet(wb, name, f"Detail bills — {label}", rows)

    # Rate card
    nws = wb.create_sheet("Rate card")
    lines = [
        ["Pelbu Suites Olakha — rate + payment basis", ""],
        ["Period", f"{data['from']} to {data['to']}"],
        ["Source rack", source],
        ["Payment file", pay_path or "(none)"],
        ["", ""],
        ["Paid / Unpaid", "Only two statuses"],
        ["Paid", "TA/Local sheet: received / mPAY / mBOB / Cash / UPI / etc."],
        ["Unpaid", "Not Received, outstanding due, or not on payment file"],
        ["", ""],
        ["Agent card (if note has no rate)", "Incl. 10% S.C. No GST"],
        ["Room", "Occupancy", "CP", "MAP"],
        ["Deluxe", "Single", 3200, 4200],
        ["Deluxe", "Double / Twin", 3450, 5600],
        ["Suite 502", "Single", 8400, 9100],
        ["Suite 502", "Double", 9300, 10600],
    ]
    for r, line in enumerate(lines, 1):
        for c, v in enumerate(line, 1):
            cell = nws.cell(r, c, v)
            cell.font = BODY_FONT
    nws["A1"].font = Font(name="Arial", bold=True, size=12)
    for addr in ("C12", "D12", "C13", "D13", "C14", "D14", "C15", "D15"):
        nws[addr].number_format = "#,##0"
    nws.column_dimensions["A"].width = 70
    nws.column_dimensions["B"].width = 55

    wb.save(OUT_PATH)
    paid_n = sum(1 for r in billed if r.get("payLabel") == "Paid")
    unpaid_n = len(billed) - paid_n
    print(
        json.dumps(
            {
                "output": str(OUT_PATH),
                "stays": len(billed),
                "paid_stays": paid_n,
                "unpaid_stays": unpaid_n,
                "total": tot["total"],
                "paid": tot["paid"],
                "unpaid": tot["unpaid"],
                "soultrip": len(soul_rows),
                "payments_file": pay_path,
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
