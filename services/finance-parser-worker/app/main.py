"""Finance import parser worker — poll loop."""

from __future__ import annotations

import hashlib
import logging
import mimetypes
import os
import socket
import sys
import tempfile
import time
from pathlib import Path
from typing import Any

import httpx

from app import __version__
from app.bank_builtin import parse as bank_parse
from app.contract import validate_parse_output
from app.gemini_receipt import parse as gemini_receipt_parse
from app.sandbox import run_uploaded_script

LOG = logging.getLogger("finance-parser-worker")

DEFAULT_POLL_INTERVAL = 5
DEFAULT_GEMINI_MODEL = "gemini-2.0-flash"
BUILTIN_RECEIPT_KEY = "gemini_receipt"
BUILTIN_BANK_PREFIX = "bank_"


def _env(name: str, default: str | None = None) -> str | None:
    value = os.environ.get(name, default)
    return value if value not in {None, ""} else default


def _worker_id() -> str:
    return _env("WORKER_ID") or socket.gethostname()


def _poll_interval() -> int:
    try:
        return max(1, int(_env("POLL_INTERVAL_SEC", str(DEFAULT_POLL_INTERVAL)) or DEFAULT_POLL_INTERVAL))
    except ValueError:
        return DEFAULT_POLL_INTERVAL


def _app_headers() -> dict[str, str]:
    secret = _env("FINANCE_WORKER_SECRET")
    if not secret:
        raise RuntimeError("FINANCE_WORKER_SECRET is required when FINANCE_APP_URL is set")
    return {
        "x-finance-worker-secret": secret,
        "content-type": "application/json",
    }


def claim_job_app(client: httpx.Client) -> dict[str, Any] | None:
    app_url = _env("FINANCE_APP_URL", "").rstrip("/")
    resp = client.post(
        f"{app_url}/api/erp/finance/worker/claim",
        headers=_app_headers(),
        json={"worker_id": _worker_id(), "kinds": ["receipt", "bank"]},
        timeout=60,
    )
    if resp.status_code == 204:
        return None
    resp.raise_for_status()
    data = resp.json()
    batch = data.get("batch")
    if not batch:
        return None
    return data


def callback_app(
    client: httpx.Client,
    *,
    batch_id: str,
    property_id: str,
    status: str,
    rows: list[dict[str, Any]],
    logs: str,
    error_message: str | None = None,
    raw_output: dict[str, Any] | None = None,
    parser_sha256: str | None = None,
) -> None:
    app_url = _env("FINANCE_APP_URL", "").rstrip("/")
    payload = {
        "batch_id": batch_id,
        "property_id": property_id,
        "worker_id": _worker_id(),
        "status": status,
        "ok": status != "error",
        "rows": rows,
        "logs": logs,
        "error_message": error_message,
        "raw_output": raw_output,
        "parser_sha256": parser_sha256,
    }
    resp = client.post(
        f"{app_url}/api/erp/finance/worker/callback",
        headers=_app_headers(),
        json=payload,
        timeout=120,
    )
    resp.raise_for_status()


def claim_job_direct(supabase: Any) -> dict[str, Any] | None:
    result = supabase.rpc(
        "finance_claim_import_batch",
        {"p_worker_id": _worker_id(), "p_kinds": ["receipt", "bank"]},
    ).execute()
    batch = result.data
    if not batch:
        return None
    return {"batch": batch, "parser": None, "source_bytes": None}


def download_source(job: dict[str, Any], supabase: Any | None, tmp_dir: Path) -> Path:
    batch = job["batch"]
    filename = batch.get("source_filename") or "source.bin"
    dest = tmp_dir / filename

    if job.get("source_bytes_base64"):
        import base64

        dest.write_bytes(base64.b64decode(job["source_bytes_base64"]))
        return dest

    if job.get("source_download_url"):
        with httpx.Client(timeout=120) as client:
            resp = client.get(job["source_download_url"])
            resp.raise_for_status()
            dest.write_bytes(resp.content)
        return dest

    if supabase is None:
        raise RuntimeError("No source download path available")

    storage_path = batch["source_storage_path"]
    data = supabase.storage.from_("finance-private").download(storage_path)
    dest.write_bytes(data)
    return dest


def download_script(job: dict[str, Any], supabase: Any | None, tmp_dir: Path) -> str | None:
    parser = job.get("parser") or {}
    if parser.get("is_builtin"):
        return None

    if parser.get("script_source"):
        return parser["script_source"]

    if parser.get("script_download_url"):
        with httpx.Client(timeout=60) as client:
            resp = client.get(parser["script_download_url"])
            resp.raise_for_status()
            return resp.text

    if supabase and parser.get("storage_path"):
        data = supabase.storage.from_("finance-private").download(parser["storage_path"])
        return data.decode("utf-8", errors="replace")

    return None


def resolve_builtin_key(batch: dict[str, Any], parser: dict[str, Any] | None) -> str | None:
    if parser and parser.get("builtin_key"):
        return str(parser["builtin_key"])
    if parser and parser.get("is_builtin"):
        kind = batch.get("kind")
        if kind == "receipt":
            return BUILTIN_RECEIPT_KEY
        bank = batch.get("bank_code")
        if bank:
            return f"{BUILTIN_BANK_PREFIX}{bank}"
    label = (batch.get("parser_label") or "").lower()
    if "gemini" in label and batch.get("kind") == "receipt":
        return BUILTIN_RECEIPT_KEY
    bank = batch.get("bank_code")
    if batch.get("kind") == "bank" and bank:
        return f"{BUILTIN_BANK_PREFIX}{bank}"
    return None


def run_parser(
    *,
    batch: dict[str, Any],
    parser: dict[str, Any] | None,
    input_path: str,
    script_source: str | None,
) -> tuple[list[dict[str, Any]], str, list[str]]:
    kind = batch["kind"]
    context: dict[str, Any] = {
        "property_id": batch.get("property_id"),
        "batch_id": batch.get("id"),
        "kind": kind,
        "bank_code": batch.get("bank_code"),
        "account_label": batch.get("account_label"),
        "source_filename": batch.get("source_filename"),
        "source_mime": batch.get("source_mime"),
    }

    builtin = resolve_builtin_key(batch, parser)
    logs: list[str] = []

    if builtin == BUILTIN_RECEIPT_KEY:
        context["gemini_api_key"] = _env("GEMINI_API_KEY")
        context["gemini_model"] = batch.get("gemini_model") or _env("GEMINI_MODEL", DEFAULT_GEMINI_MODEL)
        rows = gemini_receipt_parse(input_path, context)
        normalized, errors = validate_parse_output(rows, kind)
        return normalized, "builtin:gemini_receipt", errors

    if builtin and builtin.startswith(BUILTIN_BANK_PREFIX):
        bank_code = builtin[len(BUILTIN_BANK_PREFIX) :]
        context["bank_code"] = bank_code
        rows = bank_parse(input_path, context)
        normalized, errors = validate_parse_output(rows, kind)
        return normalized, f"builtin:{builtin}", errors

    if not script_source:
        return [], "", ["No parser script available for batch"]

    requires_gemini = bool((parser or {}).get("requires_gemini"))
    if requires_gemini:
        context["gemini_api_key"] = _env("GEMINI_API_KEY")
        context["gemini_model"] = (
            (parser or {}).get("gemini_model")
            or batch.get("gemini_model")
            or _env("GEMINI_MODEL", DEFAULT_GEMINI_MODEL)
        )

    rows, script_logs, errors = run_uploaded_script(
        script_source,
        input_path,
        context,
        kind=kind,
        requires_gemini=requires_gemini,
    )
    return rows, script_logs, errors


def persist_direct(
    supabase: Any,
    *,
    batch: dict[str, Any],
    rows: list[dict[str, Any]],
    logs: str,
    status: str,
    error_message: str | None,
) -> None:
    batch_id = batch["id"]
    property_id = batch["property_id"]
    kind = batch["kind"]

    if status == "review" and rows:
        if kind == "receipt":
            staged = []
            for idx, row in enumerate(rows, start=1):
                staged.append(
                    {
                        "property_id": property_id,
                        "batch_id": batch_id,
                        "row_no": idx,
                        "bill_no": row.get("bill_no"),
                        "vendor": row.get("vendor"),
                        "tpn": row.get("tpn"),
                        "expense_date": row.get("expense_date"),
                        "category": row.get("category"),
                        "description": row.get("description"),
                        "amount_btn": row.get("amount_btn", 0),
                        "gst_btn": row.get("gst_btn", 0),
                        "net_btn": row.get("net_btn", 0),
                        "currency": row.get("currency", "BTN"),
                        "page_no": row.get("page_no"),
                        "confidence": row.get("confidence"),
                        "warnings": row.get("warnings", []),
                        "raw": row,
                    }
                )
            supabase.table("finance_staged_receipt_rows").delete().eq("batch_id", batch_id).execute()
            if staged:
                supabase.table("finance_staged_receipt_rows").insert(staged).execute()
        else:
            staged = []
            for idx, row in enumerate(rows, start=1):
                staged.append(
                    {
                        "property_id": property_id,
                        "batch_id": batch_id,
                        "row_no": idx,
                        "txn_date": row.get("txn_date"),
                        "value_date": row.get("value_date"),
                        "description": row.get("description"),
                        "debit_btn": row.get("debit_btn", 0),
                        "credit_btn": row.get("credit_btn", 0),
                        "balance_btn": row.get("balance_btn"),
                        "reference": row.get("reference"),
                        "account_no": row.get("account_no"),
                        "payment_mode": row.get("payment_mode"),
                        "category": row.get("category"),
                        "merchant": row.get("merchant"),
                        "fingerprint": row.get("fingerprint"),
                        "confidence": row.get("confidence"),
                        "warnings": row.get("warnings", []),
                        "raw": row,
                    }
                )
            supabase.table("finance_staged_bank_rows").delete().eq("batch_id", batch_id).execute()
            if staged:
                supabase.table("finance_staged_bank_rows").insert(staged).execute()

    totals: dict[str, Any] = {}
    if kind == "receipt" and rows:
        totals["amount_btn"] = round(sum(r.get("amount_btn", 0) for r in rows), 2)
        totals["gst_btn"] = round(sum(r.get("gst_btn", 0) for r in rows), 2)
    elif kind == "bank" and rows:
        totals["debit_btn"] = round(sum(r.get("debit_btn", 0) for r in rows), 2)
        totals["credit_btn"] = round(sum(r.get("credit_btn", 0) for r in rows), 2)

    supabase.table("finance_import_batches").update(
        {
            "status": status,
            "logs": logs,
            "error_message": error_message,
            "row_count": len(rows),
            "selected_count": len(rows),
            "totals": totals,
            "finished_at": "now()",
            "updated_at": "now()",
        }
    ).eq("id", batch_id).execute()


def process_job(job: dict[str, Any], supabase: Any | None) -> None:
    batch = job["batch"]
    batch_id = batch["id"]
    kind = batch.get("kind")
    LOG.info("Processing batch %s kind=%s", batch_id, kind)

    with tempfile.TemporaryDirectory(prefix="finance-batch-") as tmp:
        tmp_dir = Path(tmp)
        input_path = download_source(job, supabase, tmp_dir)
        script_source = download_script(job, supabase, tmp_dir)

        rows, parser_logs, errors = run_parser(
            batch=batch,
            parser=job.get("parser"),
            input_path=str(input_path),
            script_source=script_source,
        )

        logs = "\n".join(
            [
                f"worker={_worker_id()} version={__version__}",
                f"input={input_path.name} sha256={_sha256_file(input_path)}",
                parser_logs,
            ]
        ).strip()

        if errors:
            LOG.error("Batch %s failed: %s", batch_id, errors)
            _finish_job(
                job,
                supabase,
                status="error",
                rows=[],
                logs=logs,
                error_message="; ".join(errors[:5]),
            )
            return

        LOG.info("Batch %s parsed %d rows", batch_id, len(rows))
        _finish_job(job, supabase, status="review", rows=rows, logs=logs, error_message=None)


def _finish_job(
    job: dict[str, Any],
    supabase: Any | None,
    *,
    status: str,
    rows: list[dict[str, Any]],
    logs: str,
    error_message: str | None,
) -> None:
    batch_id = job["batch"]["id"]
    app_url = _env("FINANCE_APP_URL")

    if app_url:
        with httpx.Client(timeout=120) as client:
            callback_app(
                client,
                batch_id=batch_id,
                property_id=str(job["batch"].get("property_id") or ""),
                status=status,
                rows=rows,
                logs=logs,
                error_message=error_message,
                parser_sha256=job["batch"].get("parser_sha256"),
            )
        return

    if supabase is None:
        raise RuntimeError("Direct mode requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY")

    persist_direct(
        supabase,
        batch=job["batch"],
        rows=rows,
        logs=logs,
        status=status,
        error_message=error_message,
    )


def _sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


def create_supabase_client() -> Any | None:
    url = _env("SUPABASE_URL") or _env("NEXT_PUBLIC_SUPABASE_URL")
    key = _env("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        return None
    from supabase import create_client

    return create_client(url, key)


def run_loop() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s %(message)s",
    )

    app_url = _env("FINANCE_APP_URL")
    supabase = None if app_url else create_supabase_client()

    if app_url:
        LOG.info("Worker %s polling %s every %ss", _worker_id(), app_url, _poll_interval())
        if not _env("FINANCE_WORKER_SECRET"):
            raise RuntimeError("FINANCE_WORKER_SECRET is required with FINANCE_APP_URL")
    else:
        if supabase is None:
            raise RuntimeError(
                "Set FINANCE_APP_URL + FINANCE_WORKER_SECRET, or SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY"
            )
        LOG.info("Worker %s direct Supabase mode, poll=%ss", _worker_id(), _poll_interval())

    with httpx.Client(timeout=60) as client:
        while True:
            try:
                if app_url:
                    job = claim_job_app(client)
                else:
                    job = claim_job_direct(supabase)
                if job:
                    process_job(job, supabase)
                else:
                    time.sleep(_poll_interval())
            except KeyboardInterrupt:
                LOG.info("Shutting down")
                break
            except Exception:
                LOG.exception("Worker loop error")
                time.sleep(_poll_interval())


def main() -> None:
    run_loop()


if __name__ == "__main__":
    main()
