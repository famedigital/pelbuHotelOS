"""Match normalized bank credits/debits to hotel payments / expenses."""

from __future__ import annotations

from dataclasses import asdict, dataclass
from datetime import date, datetime, timedelta
from typing import Any, Literal


@dataclass
class CandidatePayment:
    id: str
    amount_btn: float
    method: str
    reference: str | None
    created_at: date
    notes: str | None = None


@dataclass
class CandidateExpense:
    id: str
    amount_btn: float
    reference: str | None
    expense_date: date
    description: str | None = None


@dataclass
class MatchSuggestion:
    bank_fingerprint: str
    target_kind: Literal["payment", "expense"]
    target_id: str
    score: float
    matched_amount_btn: float
    reason: str

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


def _parse_date(value: str | date) -> date:
    if isinstance(value, date):
        return value
    return datetime.fromisoformat(value[:10]).date()


def match_transactions(
    transactions: list[dict[str, Any]],
    *,
    payments: list[dict[str, Any]] | None = None,
    expenses: list[dict[str, Any]] | None = None,
    date_window_days: int = 3,
) -> list[MatchSuggestion]:
    """
    Auto-match heuristics (highest score wins per bank txn):
    1. Exact reference match + amount
    2. Amount + date within window
    Credits → payments (bank method preferred)
    Debits → expenses
    """
    pay_list = [
        CandidatePayment(
            id=str(p["id"]),
            amount_btn=float(p["amount_btn"]),
            method=str(p.get("method") or ""),
            reference=(p.get("reference") or None),
            created_at=_parse_date(p.get("created_at") or p.get("paid_on") or date.today()),
            notes=p.get("notes"),
        )
        for p in (payments or [])
    ]
    exp_list = [
        CandidateExpense(
            id=str(e["id"]),
            amount_btn=float(e["amount_btn"]),
            reference=(e.get("reference") or None),
            expense_date=_parse_date(e.get("expense_date") or date.today()),
            description=e.get("description"),
        )
        for e in (expenses or [])
    ]

    suggestions: list[MatchSuggestion] = []
    used_payments: set[str] = set()
    used_expenses: set[str] = set()

    for txn in transactions:
        fp = str(txn.get("fingerprint") or "")
        credit = float(txn.get("credit_btn") or 0)
        debit = float(txn.get("debit_btn") or 0)
        txn_date = _parse_date(txn["txn_date"])
        ref = (txn.get("reference") or "").strip().lower()
        desc = (txn.get("description") or "").lower()

        best: MatchSuggestion | None = None

        if credit > 0:
            for p in pay_list:
                if p.id in used_payments:
                    continue
                score, reason = _score_payment(p, credit, txn_date, ref, desc, date_window_days)
                if score <= 0:
                    continue
                if best is None or score > best.score:
                    best = MatchSuggestion(
                        bank_fingerprint=fp,
                        target_kind="payment",
                        target_id=p.id,
                        score=score,
                        matched_amount_btn=credit,
                        reason=reason,
                    )
        elif debit > 0:
            for e in exp_list:
                if e.id in used_expenses:
                    continue
                score, reason = _score_expense(e, debit, txn_date, ref, desc, date_window_days)
                if score <= 0:
                    continue
                if best is None or score > best.score:
                    best = MatchSuggestion(
                        bank_fingerprint=fp,
                        target_kind="expense",
                        target_id=e.id,
                        score=score,
                        matched_amount_btn=debit,
                        reason=reason,
                    )

        if best and best.score >= 0.55:
            suggestions.append(best)
            if best.target_kind == "payment":
                used_payments.add(best.target_id)
            else:
                used_expenses.add(best.target_id)

    return suggestions


def _score_payment(
    p: CandidatePayment,
    credit: float,
    txn_date: date,
    ref: str,
    desc: str,
    window: int,
) -> tuple[float, str]:
    if abs(p.amount_btn - credit) > 0.05:
        return 0.0, ""
    score = 0.4
    reasons = ["amount"]
    if p.method == "bank":
        score += 0.1
        reasons.append("bank_method")
    pref = (p.reference or "").strip().lower()
    if ref and pref and (ref == pref or ref in pref or pref in ref or pref in desc):
        score += 0.45
        reasons.append("reference")
    delta = abs((txn_date - p.created_at).days)
    if delta <= window:
        score += 0.25 * (1 - delta / max(window, 1))
        reasons.append(f"date±{delta}")
    else:
        return 0.0, ""
    return min(score, 1.0), "+".join(reasons)


def _score_expense(
    e: CandidateExpense,
    debit: float,
    txn_date: date,
    ref: str,
    desc: str,
    window: int,
) -> tuple[float, str]:
    if abs(e.amount_btn - debit) > 0.05:
        return 0.0, ""
    score = 0.4
    reasons = ["amount"]
    pref = (e.reference or "").strip().lower()
    if ref and pref and (ref == pref or ref in pref or pref in ref):
        score += 0.45
        reasons.append("reference")
    delta = abs((txn_date - e.expense_date).days)
    if delta <= window:
        score += 0.25 * (1 - delta / max(window, 1))
        reasons.append(f"date±{delta}")
    else:
        return 0.0, ""
    if e.description and e.description.lower()[:12] in desc:
        score += 0.05
    return min(score, 1.0), "+".join(reasons)
