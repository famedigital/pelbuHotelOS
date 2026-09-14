"""Bank-of-Bhutan statement line parser."""

from __future__ import annotations

import re

from pelbu_bank_recon.models import NormalizedTxn, ParseResult
from pelbu_bank_recon.parsers.common import (
    clean_desc,
    extract_reference,
    find_amounts,
    find_dates,
    split_debit_credit,
)

# Typical BoB export: DD/MM/YYYY Particulars Debit Credit Balance
LINE_RE = re.compile(
    r"^(?P<date>\d{1,2}[/-]\d{1,2}[/-]\d{2,4})\s+"
    r"(?P<body>.+?)\s+"
    r"(?P<a1>\d[\d,]*\.?\d*)\s+"
    r"(?P<a2>\d[\d,]*\.?\d*)\s*"
    r"(?P<a3>\d[\d,]*\.?\d*)?\s*$"
)


def parse_bob_text(text: str, *, source: str = "bob") -> ParseResult:
    result = ParseResult(bank_code="bob", source=source)
    for raw in text.splitlines():
        line = raw.strip()
        if not line or _is_noise(line):
            continue
        m = LINE_RE.match(line)
        if m:
            dates = find_dates(m.group("date"))
            if not dates:
                result.warnings.append(f"skip date: {line[:80]}")
                continue
            amounts = [
                float(x.replace(",", ""))
                for x in (m.group("a1"), m.group("a2"), m.group("a3"))
                if x
            ]
            body = m.group("body")
            debit, credit, balance = _classify(amounts, body)
            result.transactions.append(
                NormalizedTxn(
                    bank_code="bob",
                    txn_date=dates[0],
                    description=clean_desc(body),
                    debit_btn=debit,
                    credit_btn=credit,
                    balance_btn=balance,
                    reference=extract_reference(body),
                    raw_line=line,
                )
            )
            continue

        # Fallback: date + amounts anywhere on line
        dates = find_dates(line)
        amounts = find_amounts(line)
        if not dates or len(amounts) < 1:
            continue
        if _looks_like_header(line):
            continue
        debit, credit, balance = split_debit_credit(
            amounts,
            prefer_credit_keywords=line,
            prefer_debit_keywords=line,
        )
        desc = clean_desc(re.sub(r"\d{1,2}[/-]\d{1,2}[/-]\d{2,4}", "", line))
        for amt_token in re.findall(r"\d[\d,]*\.?\d*", desc):
            desc = desc.replace(amt_token, " ", 1)
        desc = clean_desc(desc)
        if not desc:
            continue
        result.transactions.append(
            NormalizedTxn(
                bank_code="bob",
                txn_date=dates[0],
                description=desc,
                debit_btn=debit,
                credit_btn=credit,
                balance_btn=balance,
                reference=extract_reference(line),
                raw_line=line,
            )
        )

    _fill_period(result)
    return result


def _classify(amounts: list[float], body: str) -> tuple[float, float, float | None]:
    if len(amounts) >= 3:
        return amounts[0], amounts[1], amounts[2]
    if len(amounts) == 2:
        # Debit Credit (no balance) OR amount+balance
        lower = body.lower()
        if any(k in lower for k in ("cr", "credit", "deposit", "neft", "inward")):
            return 0.0, amounts[0], amounts[1]
        if any(k in lower for k in ("dr", "debit", "withdrawal", "charge")):
            return amounts[0], 0.0, amounts[1]
        return amounts[0], amounts[1], None
    if len(amounts) == 1:
        return split_debit_credit(
            amounts, prefer_credit_keywords=body, prefer_debit_keywords=body
        )
    return 0.0, 0.0, None


def _is_noise(line: str) -> bool:
    lower = line.lower()
    return any(
        k in lower
        for k in (
            "statement of account",
            "page ",
            "opening balance",
            "closing balance",
            "particulars",
            "transaction date",
            "bank of bhutan",
            "account number",
            "branch",
        )
    )


def _looks_like_header(line: str) -> bool:
    lower = line.lower()
    return "debit" in lower and "credit" in lower


def _fill_period(result: ParseResult) -> None:
    if not result.transactions:
        return
    dates = [t.txn_date for t in result.transactions]
    result.period_start = min(dates)
    result.period_end = max(dates)
