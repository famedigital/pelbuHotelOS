"""Smoke tests for fixture parsers — run: python -m tests.test_parsers"""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from pelbu_bank_recon.parsers import parse_statement


def _assert(cond: bool, msg: str) -> None:
    if not cond:
        raise AssertionError(msg)


def test_bank(bank: str, fixture: str, min_txns: int) -> None:
    path = ROOT / "fixtures" / fixture
    result = parse_statement(str(path), bank=bank)  # type: ignore[arg-type]
    _assert(result.bank_code == bank, f"{bank}: wrong code")
    _assert(
        len(result.transactions) >= min_txns,
        f"{bank}: expected >={min_txns} txns, got {len(result.transactions)}",
    )
    for t in result.transactions:
        _assert(t.debit_btn >= 0 and t.credit_btn >= 0, f"{bank}: negative amount")
        _assert(t.debit_btn > 0 or t.credit_btn > 0, f"{bank}: zero amount {t}")
        _assert(bool(t.fingerprint()), f"{bank}: missing fingerprint")
    print(f"ok {bank}: {len(result.transactions)} txns")


def main() -> None:
    test_bank("bob", "bob_sample.txt", 4)
    test_bank("bnb", "bnb_sample.txt", 3)
    test_bank("tbank", "tbank_sample.txt", 3)
    test_bank("drukpnb", "drukpnb_sample.txt", 3)
    print("all parser fixtures passed")


if __name__ == "__main__":
    main()
