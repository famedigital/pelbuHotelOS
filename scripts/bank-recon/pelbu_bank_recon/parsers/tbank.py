"""T Bank Ltd statement line parser."""

from __future__ import annotations

import re

from pelbu_bank_recon.models import NormalizedTxn, ParseResult
from pelbu_bank_recon.parsers.bob import _fill_period
from pelbu_bank_recon.parsers.common import (
    clean_desc,
    extract_reference,
    find_amounts,
    find_dates,
    split_debit_credit,
)

LINE_RE = re.compile(
    r"^(?P<date>\d{1,2}[./-]\d{1,2}[./-]\d{2,4})\s+"
    r"(?P<body>.+)$"
)


def parse_tbank_text(text: str, *, source: str = "tbank") -> ParseResult:
    result = ParseResult(bank_code="tbank", source=source)
    for raw in text.splitlines():
        line = raw.strip()
        if not line or _is_noise(line):
            continue
        m = LINE_RE.match(line)
        if not m:
            continue
        dates = find_dates(m.group("date"))
        if not dates:
            continue
        body = m.group("body")
        amounts = find_amounts(body)
        if not amounts:
            continue
        debit, credit, balance = split_debit_credit(
            amounts,
            prefer_credit_keywords=body,
            prefer_debit_keywords=body,
        )
        if len(amounts) >= 3:
            # TBank: Debit Credit Balance
            debit, credit, balance = amounts[0], amounts[1], amounts[2]
        desc = clean_desc(re.sub(r"\d[\d,]*\.?\d*", " ", body))
        result.transactions.append(
            NormalizedTxn(
                bank_code="tbank",
                txn_date=dates[0],
                description=desc or clean_desc(body),
                debit_btn=round(debit, 2),
                credit_btn=round(credit, 2),
                balance_btn=balance,
                reference=extract_reference(body),
                raw_line=line,
            )
        )
    _fill_period(result)
    return result


def _is_noise(line: str) -> bool:
    lower = line.lower()
    keys = (
        "t bank",
        "tbank",
        "account statement",
        "value date",
        "debit",
        "credit",
        "balance",
        "page ",
    )
    return any(k in lower for k in keys) and len(find_amounts(line)) < 1
