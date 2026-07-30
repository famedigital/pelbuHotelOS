"""Normalize dates, amounts, and bank/receipt rows for the worker contract."""

from __future__ import annotations

import re
from datetime import date, datetime
from typing import Any

from pelbu_bank_recon.models import NormalizedTxn

DATE_FORMATS = (
    "%Y-%m-%d",
    "%d/%m/%Y",
    "%d-%m-%Y",
    "%d/%m/%y",
    "%d-%m-%y",
    "%Y/%m/%d",
)

AMOUNT_RE = re.compile(r"[^\d.\-]")


def parse_date(value: Any) -> str | None:
    """Return ISO date YYYY-MM-DD or None."""
    if value is None:
        return None
    if isinstance(value, date):
        return value.isoformat()
    if isinstance(value, datetime):
        return value.date().isoformat()
    text = str(value).strip()
    if not text:
        return None
    if re.match(r"^\d{4}-\d{2}-\d{2}$", text):
        return text
    for fmt in DATE_FORMATS:
        try:
            return datetime.strptime(text, fmt).date().isoformat()
        except ValueError:
            continue
    return None


def parse_amount(value: Any) -> float:
    if value is None:
        return 0.0
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        return round(float(value), 2)
    text = AMOUNT_RE.sub("", str(value))
    if not text or text in {"-", "."}:
        return 0.0
    try:
        return round(float(text), 2)
    except ValueError:
        return 0.0


def normalize_receipt_row(raw: dict[str, Any]) -> dict[str, Any]:
    amount = parse_amount(raw.get("amount_btn"))
    gst = parse_amount(raw.get("gst_btn"))
    net = parse_amount(raw.get("net_btn"))
    if amount == 0 and net > 0:
        amount = round(net + gst, 2)
    if net == 0 and amount > 0:
        net = round(max(amount - gst, 0), 2)

    warnings = raw.get("warnings") or []
    if not isinstance(warnings, list):
        warnings = [str(warnings)]
    warnings = [str(w) for w in warnings]

    tpn = _clean_str(raw.get("tpn"))
    if tpn and gst == 0 and "gst_not_printed_review_required" not in warnings:
        warnings = [*warnings, "gst_not_printed_review_required"]

    confidence = raw.get("confidence")
    conf_val = float(confidence) if confidence is not None else None

    return {
        "bill_no": _clean_str(raw.get("bill_no")),
        "vendor": _clean_str(raw.get("vendor")),
        "tpn": tpn,
        "expense_date": parse_date(raw.get("expense_date")),
        "category": (_clean_str(raw.get("category")) or "other").lower(),
        "description": _clean_str(raw.get("description")),
        "amount_btn": amount,
        "gst_btn": gst,
        "net_btn": net,
        "currency": (_clean_str(raw.get("currency")) or "BTN").upper(),
        "page_no": _int_or_none(raw.get("page_no")),
        "confidence": conf_val,
        "warnings": warnings,
    }


def bank_txn_to_row(txn: NormalizedTxn, *, account_no: str | None = None) -> dict[str, Any]:
    return {
        "txn_date": txn.txn_date.isoformat(),
        "value_date": txn.value_date.isoformat() if txn.value_date else None,
        "description": txn.description,
        "debit_btn": round(txn.debit_btn, 2),
        "credit_btn": round(txn.credit_btn, 2),
        "balance_btn": round(txn.balance_btn, 2) if txn.balance_btn is not None else None,
        "reference": txn.reference,
        "account_no": account_no,
        "payment_mode": None,
        "category": None,
        "merchant": None,
        "fingerprint": txn.fingerprint(),
        "confidence": 0.95,
        "warnings": [],
    }


def _clean_str(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def _int_or_none(value: Any) -> int | None:
    if value is None:
        return None
    if isinstance(value, int):
        return value
    if isinstance(value, float) and value.is_integer():
        return int(value)
    text = str(value).strip()
    return int(text) if text.isdigit() else None
