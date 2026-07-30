"""Built-in Gemini receipt extractor for PDF/image receipts."""

from __future__ import annotations

import json
import mimetypes
import os
import re
from pathlib import Path
from typing import Any

from app.normalize import normalize_receipt_row

DEFAULT_MODEL = "gemini-2.0-flash"

RECEIPT_SCHEMA_PROMPT = """
Extract every bill/receipt line item from this document as JSON.

Return ONLY a JSON array (no markdown). Each object must use these keys:
- bill_no (string or null)
- vendor (string or null)
- tpn (string or null) — Bhutan Tax Payer Number if printed
- expense_date (YYYY-MM-DD or null)
- category (one of: supplies, utilities, payroll, maintenance, marketing, tax, bank_fee, other)
- description (string)
- amount_btn (gross total including GST if shown, numeric)
- gst_btn (GST amount ONLY if explicitly printed on the receipt; otherwise 0)
- net_btn (taxable/net amount if printed; else amount_btn - gst_btn)
- currency (default BTN)
- page_no (integer page number in source PDF, 1-based)
- confidence (0-1 how sure you are)
- warnings (array of strings)

CRITICAL RULES:
- NEVER calculate GST as 7% of amount just because a TPN is present.
- If GST is not explicitly printed, set gst_btn to 0 and add warning "gst_not_printed_review_required".
- If multiple receipts appear, return one object per receipt.
- Use BTN for Bhutan Ngultrum unless another currency is clearly printed.
"""


def parse(input_path: str, context: dict[str, Any]) -> list[dict[str, Any]]:
    api_key = context.get("gemini_api_key") or os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY is required for receipt extraction")

    model = (
        context.get("gemini_model")
        or os.environ.get("GEMINI_MODEL")
        or DEFAULT_MODEL
    )

    path = Path(input_path)
    mime, _ = mimetypes.guess_type(str(path))
    if not mime:
        suffix = path.suffix.lower()
        if suffix == ".pdf":
            mime = "application/pdf"
        elif suffix in {".jpg", ".jpeg"}:
            mime = "image/jpeg"
        elif suffix == ".png":
            mime = "image/png"
        elif suffix == ".webp":
            mime = "image/webp"
        else:
            mime = "application/octet-stream"

    raw_bytes = path.read_bytes()
    response_text = _call_gemini(api_key, model, mime, raw_bytes, path.name)
    parsed = _parse_json_array(response_text)

    rows: list[dict[str, Any]] = []
    for item in parsed:
        if not isinstance(item, dict):
            continue
        normalized = normalize_receipt_row(item)
        if normalized.get("gst_btn", 0) == 0:
            warnings = normalized.get("warnings") or []
            if "gst_not_printed_review_required" not in warnings:
                normalized["warnings"] = [*warnings, "gst_not_printed_review_required"]
        if not normalized.get("expense_date"):
            normalized.setdefault("warnings", []).append("missing_expense_date")
        if normalized.get("amount_btn", 0) <= 0:
            normalized.setdefault("warnings", []).append("missing_or_zero_amount")
        rows.append(normalized)

    return rows


def _call_gemini(
    api_key: str,
    model: str,
    mime: str,
    data: bytes,
    filename: str,
) -> str:
    try:
        from google import genai
        from google.genai import types

        client = genai.Client(api_key=api_key)
        part = types.Part.from_bytes(data=data, mime_type=mime)
        response = client.models.generate_content(
            model=model,
            contents=[
                types.Content(
                    role="user",
                    parts=[
                        types.Part.from_text(text=RECEIPT_SCHEMA_PROMPT),
                        part,
                    ],
                )
            ],
            config=types.GenerateContentConfig(
                temperature=0.1,
                response_mime_type="application/json",
            ),
        )
        return response.text or "[]"
    except ImportError:
        pass

    import google.generativeai as genai_legacy

    genai_legacy.configure(api_key=api_key)
    legacy_model = genai_legacy.GenerativeModel(model)
    response = legacy_model.generate_content(
        [
            RECEIPT_SCHEMA_PROMPT,
            {"mime_type": mime, "data": data},
        ],
        generation_config={"temperature": 0.1, "response_mime_type": "application/json"},
    )
    return response.text or "[]"


def _parse_json_array(text: str) -> list[Any]:
    text = text.strip()
    if not text:
        return []

    fence = re.search(r"```(?:json)?\s*([\s\S]*?)```", text)
    if fence:
        text = fence.group(1).strip()

    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        start = text.find("[")
        end = text.rfind("]")
        if start >= 0 and end > start:
            data = json.loads(text[start : end + 1])
        else:
            raise ValueError(f"Gemini did not return valid JSON: {text[:200]}")

    if isinstance(data, dict):
        for key in ("receipts", "rows", "items", "data"):
            if key in data and isinstance(data[key], list):
                return data[key]
        return [data]
    if isinstance(data, list):
        return data
    return []
