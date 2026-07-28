"""Normalized bank transaction models for Pelbu recon."""

from __future__ import annotations

from dataclasses import asdict, dataclass, field
from datetime import date, datetime
from hashlib import sha256
from typing import Any, Literal

BankCode = Literal["bob", "bnb", "tbank", "drukpnb"]


@dataclass(frozen=True)
class NormalizedTxn:
    bank_code: BankCode
    txn_date: date
    description: str
    debit_btn: float = 0.0
    credit_btn: float = 0.0
    balance_btn: float | None = None
    value_date: date | None = None
    reference: str | None = None
    raw_line: str | None = None

    def fingerprint(self) -> str:
        payload = "|".join(
            [
                self.bank_code,
                self.txn_date.isoformat(),
                (self.value_date.isoformat() if self.value_date else ""),
                self.description.strip().lower(),
                f"{self.debit_btn:.2f}",
                f"{self.credit_btn:.2f}",
                (self.reference or "").strip().lower(),
            ]
        )
        return sha256(payload.encode("utf-8")).hexdigest()[:40]

    def to_dict(self) -> dict[str, Any]:
        d = asdict(self)
        d["txn_date"] = self.txn_date.isoformat()
        d["value_date"] = self.value_date.isoformat() if self.value_date else None
        d["fingerprint"] = self.fingerprint()
        return d


@dataclass
class ParseResult:
    bank_code: BankCode
    source: str
    transactions: list[NormalizedTxn] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)
    period_start: date | None = None
    period_end: date | None = None
    account_label: str | None = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "bank_code": self.bank_code,
            "source": self.source,
            "account_label": self.account_label,
            "period_start": self.period_start.isoformat() if self.period_start else None,
            "period_end": self.period_end.isoformat() if self.period_end else None,
            "parsed_at": datetime.utcnow().isoformat() + "Z",
            "warnings": self.warnings,
            "transactions": [t.to_dict() for t in self.transactions],
        }
