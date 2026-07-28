"""CLI: parse bank PDFs and suggest payment/expense matches."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

# Allow `python -m pelbu_bank_recon.cli` from scripts/bank-recon
ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from pelbu_bank_recon.match import match_transactions
from pelbu_bank_recon.parsers import parse_statement


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        prog="pelbu-bank-recon",
        description="Parse Bhutan bank statement PDFs and match to hotel payments.",
    )
    sub = parser.add_subparsers(dest="cmd", required=True)

    p_parse = sub.add_parser("parse", help="Parse a statement PDF/txt → JSON")
    p_parse.add_argument("path", help="Path to PDF or .txt fixture")
    p_parse.add_argument(
        "--bank",
        choices=["bob", "bnb", "tbank", "drukpnb"],
        help="Force bank code (skip auto-detect)",
    )
    p_parse.add_argument("-o", "--out", help="Write JSON to file (default stdout)")

    p_match = sub.add_parser("match", help="Suggest matches vs payments/expenses JSON")
    p_match.add_argument("--txns", required=True, help="Parsed statement JSON from `parse`")
    p_match.add_argument("--payments", help="Payments JSON array or {payments:[...]}")
    p_match.add_argument("--expenses", help="Expenses JSON array or {expenses:[...]}")
    p_match.add_argument("--window", type=int, default=3, help="Date window days (default 3)")
    p_match.add_argument("-o", "--out", help="Write suggestions JSON to file")

    args = parser.parse_args(argv)

    if args.cmd == "parse":
        result = parse_statement(args.path, bank=args.bank)
        payload = result.to_dict()
        _write(payload, args.out)
        print(
            f"# {len(result.transactions)} txns · bank={result.bank_code}"
            f" · warnings={len(result.warnings)}",
            file=sys.stderr,
        )
        return 0

    if args.cmd == "match":
        txns_doc = _load_json(args.txns)
        transactions = txns_doc.get("transactions", txns_doc if isinstance(txns_doc, list) else [])
        payments = _load_list(args.payments, "payments") if args.payments else []
        expenses = _load_list(args.expenses, "expenses") if args.expenses else []
        suggestions = match_transactions(
            transactions,
            payments=payments,
            expenses=expenses,
            date_window_days=args.window,
        )
        payload = {
            "suggestions": [s.to_dict() for s in suggestions],
            "unmatched_count": max(0, len(transactions) - len(suggestions)),
        }
        _write(payload, args.out)
        print(
            f"# {len(suggestions)} suggestions · unmatched≈{payload['unmatched_count']}",
            file=sys.stderr,
        )
        return 0

    return 1


def _write(payload: object, out: str | None) -> None:
    text = json.dumps(payload, indent=2, ensure_ascii=False)
    if out:
        Path(out).write_text(text + "\n", encoding="utf-8")
    else:
        print(text)


def _load_json(path: str) -> dict | list:
    return json.loads(Path(path).read_text(encoding="utf-8"))


def _load_list(path: str, key: str) -> list:
    doc = _load_json(path)
    if isinstance(doc, list):
        return doc
    return list(doc.get(key) or [])


if __name__ == "__main__":
    raise SystemExit(main())
