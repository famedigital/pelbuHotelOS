# Finance Parser Worker

Isolated Python worker for the Pelbu Suites **Finance Import Workbench**. Polls for queued import batches, runs built-in or uploaded parser scripts, validates output against the `table_v1` contract, and posts staged rows back to the ERP.

## Modes

### App API mode (preferred)

Point the worker at the Next.js ERP app:

```env
FINANCE_APP_URL=http://host.docker.internal:3000
FINANCE_WORKER_SECRET=your-shared-secret
GEMINI_API_KEY=...
GEMINI_MODEL=gemini-2.0-flash
WORKER_ID=finance-parser-1
POLL_INTERVAL_SEC=5
```

Endpoints:

- `POST /api/erp/finance/worker/claim` — claim next queued batch
- `POST /api/erp/finance/worker/callback` — return parsed rows or error

Both require header `x-finance-worker-secret`.

### Direct Supabase mode (optional)

When `FINANCE_APP_URL` is unset:

```env
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...
GEMINI_API_KEY=...
```

Uses RPC `finance_claim_import_batch`, downloads from `finance-private` storage, and writes staged rows directly.

## Parser contract

Uploaded plugins must expose:

```python
def parse(input_path: str, context: dict) -> list[dict]:
    ...
```

### Receipt rows (`kind=receipt`)

`bill_no`, `vendor`, `tpn`, `expense_date` (YYYY-MM-DD), `category`, `description`, `amount_btn`, `gst_btn`, `net_btn`, `currency` (default BTN), `page_no`, `confidence` (0–1), `warnings` (list[str]).

**Never invent GST** as `amount * 0.07` from TPN alone. If GST is not printed, set `gst_btn=0` and add `"gst_not_printed_review_required"`.

### Bank rows (`kind=bank`)

`txn_date`, `value_date`, `description`, `debit_btn`, `credit_btn`, `balance_btn`, `reference`, `account_no`, `payment_mode`, `category`, `merchant`, `fingerprint`, `confidence`, `warnings`.

## Built-ins

| Key | Module | Notes |
|-----|--------|-------|
| `gemini_receipt` | `app/gemini_receipt.py` | Gemini structured JSON extraction |
| `bank_bob`, `bank_bnb`, `bank_tbank`, `bank_drukpnb` | `app/bank_builtin.py` | Wraps `scripts/bank-recon/pelbu_bank_recon` |

## Sandbox

Uploaded scripts run in a subprocess with:

- 120s timeout
- 2 MB max stdout/stderr
- No network / no `GEMINI_API_KEY` unless `requires_gemini=true` on the parser version
- Read-only input file path

## Local development

```bash
cd services/finance-parser-worker
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
export PYTHONPATH="../../scripts/bank-recon:$PYTHONPATH"
pytest
python -m app.main
```

## Docker

Build from repo root:

```bash
docker build -f services/finance-parser-worker/Dockerfile -t pelbu-finance-parser-worker .
docker run --rm \
  -e FINANCE_APP_URL=http://host.docker.internal:3000 \
  -e FINANCE_WORKER_SECRET=... \
  -e GEMINI_API_KEY=... \
  pelbu-finance-parser-worker
```

## Tests

```bash
cd services/finance-parser-worker
PYTHONPATH=../../scripts/bank-recon pytest -q
```

Covers contract validation and normalize helpers. Bank fixture smoke tests live under `scripts/bank-recon/tests/`.
