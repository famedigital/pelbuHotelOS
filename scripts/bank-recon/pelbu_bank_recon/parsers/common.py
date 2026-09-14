"""Shared parsing utilities for Bhutan bank statement text."""

from __future__ import annotations

import re
from datetime import date, datetime
from decimal import Decimal, InvalidOperation

AMOUNT_RE = re.compile(
    r"(?<![\d.])(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)(?![\d.])"
)
DATE_PATTERNS = (
    ("%d/%m/%Y", re.compile(r"\b(\d{1,2}/\d{1,2}/\d{4})\b")),
    ("%d-%m-%Y", re.compile(r"\b(\d{1,2}-\d{1,2}-\d{4})\b")),
    ("%d.%m.%Y", re.compile(r"\b(\d{1,2}\.\d{1,2}\.\d{4})\b")),
    ("%Y-%m-%d", re.compile(r"\b(\d{4}-\d{2}-\d{2})\b")),
    ("%d/%m/%y", re.compile(r"\b(\d{1,2}/\d{1,2}/\d{2})\b")),
    ("%d-%b-%Y", re.compile(r"\b(\d{1,2}-[A-Za-z]{3}-\d{4})\b")),
    ("%d %b %Y", re.compile(r"\b(\d{1,2}\s+[A-Za-z]{3}\s+\d{4})\b")),
)


def parse_amount(raw: str | None) -> float:
    if raw is None:
        return 0.0
    s = raw.strip().replace(",", "").replace("Nu", "").replace("BTN", "").strip()
    if not s or s in {"-", "—", "."}:
        return 0.0
    try:
        return float(Decimal(s).quantize(Decimal("0.01")))
    except (InvalidOperation, ValueError):
        return 0.0


def parse_date(raw: str) -> date | None:
    s = raw.strip()
    for fmt, _ in DATE_PATTERNS:
        try:
            return datetime.strptime(s, fmt).date()
        except ValueError:
            continue
    return None


def find_dates(line: str) -> list[date]:
    found: list[date] = []
    for fmt, pattern in DATE_PATTERNS:
        for m in pattern.finditer(line):
            try:
                found.append(datetime.strptime(m.group(1), fmt).date())
            except ValueError:
                continue
    return found


def find_amounts(line: str) -> list[float]:
    return [parse_amount(m.group(1)) for m in AMOUNT_RE.finditer(line)]


def clean_desc(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip(" -|\t")


def split_debit_credit(
    amounts: list[float],
    *,
    prefer_credit_keywords: str,
    prefer_debit_keywords: str,
) -> tuple[float, float, float | None]:
    """
    Heuristic: last amount is often balance; preceding are debit/credit.
    Returns (debit, credit, balance_or_none).
    """
    if not amounts:
        return 0.0, 0.0, None

    balance: float | None = None
    body = amounts
    if len(amounts) >= 3:
        balance = amounts[-1]
        body = amounts[:-1]
    elif len(amounts) == 1:
        body = amounts

    lower = prefer_credit_keywords.lower()
    debit_kw = prefer_debit_keywords.lower()

    if len(body) == 1:
        amt = body[0]
        if any(k in lower for k in ("cr", "credit", "deposit", "inward", "neft", "receipt")):
            return 0.0, amt, balance
        if any(k in debit_kw for k in ("dr", "debit", "withdrawal", "charge", "fee", "payment")):
            return amt, 0.0, balance
        # Default: single amount with no cue → credit (inflow) for hotel recon
        return 0.0, amt, balance

    if len(body) >= 2:
        debit, credit = body[0], body[1]
        # If one side is zero-ish, keep as-is
        return debit, credit, balance

    return 0.0, 0.0, balance


REF_PATTERNS = (
    re.compile(r"\b(?:UTR|RRN|REF|CHQ|CHEQUE|TXN)[:\s#-]*([A-Z0-9/-]{4,})\b", re.I),
    re.compile(r"\b([A-Z]{2,}\d{6,})\b"),
)


def extract_reference(line: str) -> str | None:
    for pattern in REF_PATTERNS:
        m = pattern.search(line)
        if m:
            return m.group(1).strip()
    return None
