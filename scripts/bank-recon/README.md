# Bank reconciliation (P4)

Python toolkit that turns Bhutan bank statement PDFs into normalized JSON, then suggests matches against hotel `payments` / `expenses`.

## Banks

| Code | Bank |
|------|------|
| `bob` | Bank of Bhutan |
| `bnb` | Bhutan National Bank |
| `tbank` | T Bank Ltd |
| `drukpnb` | Druk PNB |

## Setup

```bash
cd scripts/bank-recon
python -m venv .venv
# Windows:
.venv\Scripts\activate
pip install -r requirements.txt
```

## Parse

```bash
python -m pelbu_bank_recon.cli parse fixtures/bob_sample.txt --bank bob -o out/bob.json
python -m pelbu_bank_recon.cli parse path/to/statement.pdf --bank bnb -o out/bnb.json
```

Auto-detect works when the PDF text contains the bank name; otherwise pass `--bank`.

## Match

Export payments/expenses from the desk (or Supabase) as JSON, then:

```bash
python -m pelbu_bank_recon.cli match --txns out/bob.json --payments payments.json --expenses expenses.json -o out/matches.json
```

Payment object shape:

```json
{ "id": "uuid", "amount_btn": 45000, "method": "bank", "reference": "BOB20260702001", "created_at": "2026-07-02" }
```

## Import into ERP

1. Run `parse` → JSON  
2. Open `/erp/finance` → **Import bank JSON** (paste or upload text)  
3. Review unmatched queue → **Match** to payment/expense or **Ignore**

## Tuning

Fixture `.txt` files mimic extracted PDF text. Real layouts vary by branch/export — drop sample PDFs into `fixtures/raw/` (gitignored if sensitive) and we tighten regexes per bank.

## Tests

```bash
python -m tests.test_parsers
```
