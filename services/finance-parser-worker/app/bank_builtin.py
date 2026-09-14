"""Built-in bank statement parser — wraps scripts/bank-recon/pelbu_bank_recon."""

from __future__ import annotations

from typing import Any

from pelbu_bank_recon.models import BankCode
from pelbu_bank_recon.parsers import parse_statement

from app.normalize import bank_txn_to_row


def parse(input_path: str, context: dict[str, Any]) -> list[dict[str, Any]]:
    """
    Parse a bank statement PDF/text using the built-in pelbu_bank_recon parsers.

    context keys:
      - bank_code: bob | bnb | tbank | drukpnb (required unless auto-detect works)
      - account_no: optional account number label
    """
    bank_code = context.get("bank_code")
    if bank_code:
        bank: BankCode | None = str(bank_code).lower()  # type: ignore[assignment]
    else:
        bank = None

    result = parse_statement(input_path, bank=bank)
    account_no = context.get("account_no") or result.account_label

    rows: list[dict[str, Any]] = []
    for txn in result.transactions:
        row = bank_txn_to_row(txn, account_no=account_no)
        if result.warnings:
            row["warnings"] = [*row.get("warnings", []), *result.warnings[:3]]
        rows.append(row)

    return rows
