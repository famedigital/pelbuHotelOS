"""Detect bank and dispatch to the right parser."""

from __future__ import annotations

from pelbu_bank_recon.models import BankCode, ParseResult
from pelbu_bank_recon.parsers.bnb import parse_bnb_text
from pelbu_bank_recon.parsers.bob import parse_bob_text
from pelbu_bank_recon.parsers.drukpnb import parse_drukpnb_text
from pelbu_bank_recon.parsers.tbank import parse_tbank_text
from pelbu_bank_recon.pdf_text import extract_text

PARSERS = {
    "bob": parse_bob_text,
    "bnb": parse_bnb_text,
    "tbank": parse_tbank_text,
    "drukpnb": parse_drukpnb_text,
}


def detect_bank(text: str) -> BankCode | None:
    lower = text.lower()
    if "bank of bhutan" in lower or "bob ltd" in lower or "\nbob " in lower:
        return "bob"
    if "bhutan national bank" in lower or "bnb " in lower:
        return "bnb"
    if "druk pnb" in lower or "drukpnb" in lower or "punjab national bank" in lower:
        return "drukpnb"
    if "t bank" in lower or "tbank" in lower:
        return "tbank"
    return None


def parse_statement(
    path: str,
    *,
    bank: BankCode | None = None,
) -> ParseResult:
    text = extract_text(path)
    code = bank or detect_bank(text)
    if not code:
        raise ValueError(
            "Could not detect bank. Pass --bank bob|bnb|tbank|drukpnb explicitly."
        )
    parser = PARSERS[code]
    result = parser(text, source=path)
    if not result.transactions:
        result.warnings.append(
            "No transactions parsed. Share a sample PDF so we can tune the regex."
        )
    return result
