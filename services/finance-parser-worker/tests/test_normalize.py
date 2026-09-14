"""Normalize helper tests."""

from __future__ import annotations

from datetime import date

import pytest

from app.normalize import bank_txn_to_row, normalize_receipt_row, parse_amount, parse_date
from pelbu_bank_recon.models import NormalizedTxn


def test_parse_date_iso_and_slash():
    assert parse_date("2026-07-15") == "2026-07-15"
    assert parse_date("15/07/2026") == "2026-07-15"
    assert parse_date(date(2026, 7, 15)) == "2026-07-15"
    assert parse_date("not-a-date") is None


def test_parse_amount():
    assert parse_amount("1,234.50") == 1234.5
    assert parse_amount(None) == 0.0
    assert parse_amount("BTN 99.00") == 99.0


def test_normalize_receipt_adds_gst_warning_with_tpn():
    row = normalize_receipt_row(
        {
            "vendor": "Shop",
            "tpn": "TPN999",
            "amount_btn": 1000,
            "gst_btn": 0,
            "expense_date": "2026-07-01",
        }
    )
    assert row["gst_btn"] == 0
    assert "gst_not_printed_review_required" in row["warnings"]


def test_normalize_receipt_derives_net():
    row = normalize_receipt_row(
        {
            "amount_btn": 1070,
            "gst_btn": 70,
            "net_btn": 0,
        }
    )
    assert row["net_btn"] == 1000.0


def test_bank_txn_to_row():
    txn = NormalizedTxn(
        bank_code="bob",
        txn_date=date(2026, 7, 2),
        description="NEFT INWARD",
        debit_btn=0,
        credit_btn=45000.0,
        balance_btn=170000.0,
        reference="BOB001",
    )
    row = bank_txn_to_row(txn, account_no="****4521")
    assert row["txn_date"] == "2026-07-02"
    assert row["credit_btn"] == 45000.0
    assert row["account_no"] == "****4521"
    assert len(row["fingerprint"]) == 40


def test_bank_builtin_fixture_smoke():
    from pathlib import Path

    from app.bank_builtin import parse as bank_parse

    fixture = (
        Path(__file__).resolve().parents[3]
        / "scripts"
        / "bank-recon"
        / "fixtures"
        / "bob_sample.txt"
    )
    if not fixture.exists():
        pytest.skip("bank-recon fixture not available")

    rows = bank_parse(str(fixture), {"bank_code": "bob"})
    assert len(rows) >= 4
    assert all(r["debit_btn"] >= 0 and r["credit_btn"] >= 0 for r in rows)
    assert all(r.get("fingerprint") for r in rows)
