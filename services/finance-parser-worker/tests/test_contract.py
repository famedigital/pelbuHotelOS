"""Contract validation tests."""

from __future__ import annotations

import pytest

from app.contract import validate_bank_row, validate_parse_output, validate_receipt_row


def test_valid_receipt_row():
    row = {
        "bill_no": "INV-001",
        "vendor": "Bhutan Supplies",
        "tpn": "TPN123456",
        "expense_date": "2026-07-15",
        "category": "supplies",
        "description": "Office paper",
        "amount_btn": 1070.0,
        "gst_btn": 0,
        "net_btn": 1070.0,
        "currency": "BTN",
        "page_no": 1,
        "confidence": 0.9,
        "warnings": ["gst_not_printed_review_required"],
    }
    normalized, errors = validate_receipt_row(row)
    assert not errors
    assert normalized is not None
    assert normalized["gst_btn"] == 0
    assert "gst_not_printed_review_required" in normalized["warnings"]


def test_receipt_rejects_unknown_fields():
    row = {"amount_btn": 100, "extra": True}
    normalized, errors = validate_receipt_row(row)
    assert normalized is None
    assert any("unknown fields" in e for e in errors)


def test_receipt_rejects_bad_date():
    row = {
        "expense_date": "15/07/2026",
        "amount_btn": 100,
        "gst_btn": 0,
        "net_btn": 100,
        "description": "Test",
        "warnings": [],
    }
    normalized, errors = validate_receipt_row(row)
    assert normalized is None
    assert any("expense_date" in e for e in errors)


def test_valid_bank_row():
    row = {
        "txn_date": "2026-07-02",
        "value_date": "2026-07-02",
        "description": "NEFT INWARD PELBU AGENT",
        "debit_btn": 0,
        "credit_btn": 45000.0,
        "balance_btn": 170000.0,
        "reference": "BOB20260702001",
        "fingerprint": "abc123",
        "confidence": 0.95,
        "warnings": [],
    }
    normalized, errors = validate_bank_row(row)
    assert not errors
    assert normalized is not None
    assert normalized["credit_btn"] == 45000.0


def test_bank_rejects_debit_and_credit():
    row = {
        "txn_date": "2026-07-02",
        "description": "Bad row",
        "debit_btn": 100,
        "credit_btn": 50,
        "warnings": [],
    }
    normalized, errors = validate_bank_row(row)
    assert normalized is None
    assert any("mutually exclusive" in e for e in errors)


def test_validate_parse_output_receipt_list():
    rows = [
        {
            "expense_date": "2026-07-01",
            "amount_btn": 500,
            "gst_btn": 0,
            "net_btn": 500,
            "description": "Fuel",
            "warnings": ["gst_not_printed_review_required"],
        }
    ]
    normalized, errors = validate_parse_output(rows, "receipt")
    assert not errors
    assert len(normalized) == 1


def test_validate_parse_output_not_a_list():
    normalized, errors = validate_parse_output({"bad": True}, "bank")
    assert not normalized
    assert errors
