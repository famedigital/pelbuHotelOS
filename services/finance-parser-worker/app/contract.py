"""Validate parse() output against the Finance Import Workbench table_v1 contract."""

from __future__ import annotations

import re
from typing import Any, Literal

Kind = Literal["receipt", "bank"]

RECEIPT_FIELDS = {
    "bill_no",
    "vendor",
    "tpn",
    "expense_date",
    "category",
    "description",
    "amount_btn",
    "gst_btn",
    "net_btn",
    "currency",
    "page_no",
    "confidence",
    "warnings",
}

BANK_FIELDS = {
    "txn_date",
    "value_date",
    "description",
    "debit_btn",
    "credit_btn",
    "balance_btn",
    "reference",
    "account_no",
    "payment_mode",
    "category",
    "merchant",
    "fingerprint",
    "confidence",
    "warnings",
}

DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
INVENTED_GST_RE = re.compile(r"^0\.0?7\s*\*\s*amount", re.I)

EXPENSE_CATEGORIES = {
    "supplies",
    "utilities",
    "payroll",
    "maintenance",
    "marketing",
    "tax",
    "bank_fee",
    "other",
}


def _is_number(value: Any) -> bool:
    return isinstance(value, (int, float)) and not isinstance(value, bool)


def _as_float(value: Any, field: str, errors: list[str]) -> float | None:
    if value is None:
        return None
    if _is_number(value):
        return float(value)
    if isinstance(value, str):
        try:
            return float(value.replace(",", "").strip())
        except ValueError:
            errors.append(f"{field} must be numeric")
            return None
    errors.append(f"{field} must be numeric")
    return None


def _as_int(value: Any, field: str, errors: list[str]) -> int | None:
    if value is None:
        return None
    if isinstance(value, bool):
        errors.append(f"{field} must be an integer")
        return None
    if isinstance(value, int):
        return value
    if isinstance(value, float) and value.is_integer():
        return int(value)
    if isinstance(value, str) and value.strip().isdigit():
        return int(value.strip())
    errors.append(f"{field} must be an integer")
    return None


def _validate_date(value: Any, field: str, errors: list[str]) -> str | None:
    if value is None:
        return None
    if not isinstance(value, str):
        errors.append(f"{field} must be YYYY-MM-DD string")
        return None
    if not DATE_RE.match(value):
        errors.append(f"{field} must be YYYY-MM-DD")
        return None
    return value


def _validate_warnings(value: Any, errors: list[str]) -> list[str]:
    if value is None:
        return []
    if not isinstance(value, list):
        errors.append("warnings must be a list of strings")
        return []
    out: list[str] = []
    for item in value:
        if not isinstance(item, str):
            errors.append("warnings must be a list of strings")
            return []
        out.append(item)
    return out


def validate_receipt_row(row: dict[str, Any], *, row_no: int = 0) -> tuple[dict[str, Any] | None, list[str]]:
    errors: list[str] = []
    prefix = f"row {row_no}: " if row_no else ""

    if not isinstance(row, dict):
        return None, [f"{prefix}row must be a dict"]

    unknown = set(row.keys()) - RECEIPT_FIELDS
    if unknown:
        errors.append(f"{prefix}unknown fields: {sorted(unknown)}")

    expense_date = _validate_date(row.get("expense_date"), "expense_date", errors)
    amount = _as_float(row.get("amount_btn"), "amount_btn", errors)
    gst = _as_float(row.get("gst_btn"), "gst_btn", errors)
    net = _as_float(row.get("net_btn"), "net_btn", errors)
    confidence = _as_float(row.get("confidence"), "confidence", errors)
    page_no = _as_int(row.get("page_no"), "page_no", errors)
    warnings = _validate_warnings(row.get("warnings"), errors)

    currency = row.get("currency", "BTN")
    if currency is not None and not isinstance(currency, str):
        errors.append(f"{prefix}currency must be a string")

    category = row.get("category")
    if category is not None and isinstance(category, str):
        cat_lower = category.strip().lower()
        if cat_lower and cat_lower not in EXPENSE_CATEGORIES:
            warnings = [*warnings, f"unknown_category:{cat_lower}"]

    if amount is not None and amount < 0:
        errors.append(f"{prefix}amount_btn must be >= 0")
    if gst is not None and gst < 0:
        errors.append(f"{prefix}gst_btn must be >= 0")
    if net is not None and net < 0:
        errors.append(f"{prefix}net_btn must be >= 0")

    if confidence is not None and not (0 <= confidence <= 1):
        errors.append(f"{prefix}confidence must be between 0 and 1")

    tpn = row.get("tpn")
    for w in warnings:
        if INVENTED_GST_RE.search(w):
            errors.append(f"{prefix}must not invent GST from TPN alone")
            break

    if tpn and (gst is None or gst == 0) and "gst_not_printed_review_required" not in warnings:
        warnings = [*warnings, "gst_not_printed_review_required"]

    if errors:
        return None, [f"{prefix}{e}" if not e.startswith(prefix.strip()) else e for e in errors]

    normalized: dict[str, Any] = {
        "bill_no": _str_or_none(row.get("bill_no")),
        "vendor": _str_or_none(row.get("vendor")),
        "tpn": _str_or_none(row.get("tpn")),
        "expense_date": expense_date,
        "category": _str_or_none(category) or "other",
        "description": _str_or_none(row.get("description")),
        "amount_btn": round(amount or 0, 2),
        "gst_btn": round(gst or 0, 2),
        "net_btn": round(net or 0, 2),
        "currency": (currency or "BTN").upper(),
        "page_no": page_no,
        "confidence": confidence,
        "warnings": warnings,
    }
    return normalized, []


def validate_bank_row(row: dict[str, Any], *, row_no: int = 0) -> tuple[dict[str, Any] | None, list[str]]:
    errors: list[str] = []
    prefix = f"row {row_no}: " if row_no else ""

    if not isinstance(row, dict):
        return None, [f"{prefix}row must be a dict"]

    unknown = set(row.keys()) - BANK_FIELDS
    if unknown:
        errors.append(f"{prefix}unknown fields: {sorted(unknown)}")

    txn_date = _validate_date(row.get("txn_date"), "txn_date", errors)
    value_date = _validate_date(row.get("value_date"), "value_date", errors)
    debit = _as_float(row.get("debit_btn"), "debit_btn", errors)
    credit = _as_float(row.get("credit_btn"), "credit_btn", errors)
    balance = _as_float(row.get("balance_btn"), "balance_btn", errors)
    confidence = _as_float(row.get("confidence"), "confidence", errors)
    warnings = _validate_warnings(row.get("warnings"), errors)

    if debit is not None and debit < 0:
        errors.append(f"{prefix}debit_btn must be >= 0")
    if credit is not None and credit < 0:
        errors.append(f"{prefix}credit_btn must be >= 0")

    if debit is not None and credit is not None:
        if debit > 0 and credit > 0:
            errors.append(f"{prefix}debit_btn and credit_btn are mutually exclusive")
        if debit == 0 and credit == 0:
            warnings = [*warnings, "zero_amount_row"]

    if confidence is not None and not (0 <= confidence <= 1):
        errors.append(f"{prefix}confidence must be between 0 and 1")

    description = _str_or_none(row.get("description"))
    if not description:
        errors.append(f"{prefix}description is required")

    if errors:
        return None, errors

    return {
        "txn_date": txn_date,
        "value_date": value_date,
        "description": description or "",
        "debit_btn": round(debit or 0, 2),
        "credit_btn": round(credit or 0, 2),
        "balance_btn": balance,
        "reference": _str_or_none(row.get("reference")),
        "account_no": _str_or_none(row.get("account_no")),
        "payment_mode": _str_or_none(row.get("payment_mode")),
        "category": _str_or_none(row.get("category")),
        "merchant": _str_or_none(row.get("merchant")),
        "fingerprint": _str_or_none(row.get("fingerprint")),
        "confidence": confidence,
        "warnings": warnings,
    }, []


def _str_or_none(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def validate_parse_output(
    rows: Any,
    kind: Kind,
) -> tuple[list[dict[str, Any]], list[str]]:
    """Validate plugin parse() output. Returns (normalized_rows, errors)."""
    if not isinstance(rows, list):
        return [], ["parse() must return a list of dicts"]

    validator = validate_receipt_row if kind == "receipt" else validate_bank_row
    normalized: list[dict[str, Any]] = []
    errors: list[str] = []

    for idx, row in enumerate(rows, start=1):
        item, row_errors = validator(row, row_no=idx)
        if row_errors:
            errors.extend(row_errors)
        elif item is not None:
            normalized.append(item)

    if not normalized and not errors:
        errors.append("parse() returned no rows")

    return normalized, errors
