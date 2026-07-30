"""Run uploaded parser scripts in a restricted subprocess sandbox."""

from __future__ import annotations

import importlib.util
import json
import os
import subprocess
import sys
import tempfile
import textwrap
import traceback
from pathlib import Path
from typing import Any

from app.contract import Kind, validate_parse_output

SANDBOX_TIMEOUT_SEC = 120
MAX_OUTPUT_BYTES = 2 * 1024 * 1024  # 2 MB
MAX_SCRIPT_BYTES = 512 * 1024


def run_uploaded_script(
    script_source: str,
    input_path: str,
    context: dict[str, Any],
    *,
    kind: Kind,
    requires_gemini: bool = False,
) -> tuple[list[dict[str, Any]], str, list[str]]:
    """
    Execute an uploaded Python parser script exposing parse(input_path, context).

    Returns (rows, logs, errors).
    """
    if len(script_source.encode("utf-8")) > MAX_SCRIPT_BYTES:
        return [], "", [f"Script exceeds {MAX_SCRIPT_BYTES} bytes"]

    input_file = Path(input_path)
    if not input_file.exists():
        return [], "", [f"Input file not found: {input_path}"]

    logs: list[str] = []
    errors: list[str] = []

    with tempfile.TemporaryDirectory(prefix="finance-parser-") as tmp:
        tmp_path = Path(tmp)
        script_path = tmp_path / "plugin.py"
        script_path.write_text(script_source, encoding="utf-8")

        runner_path = tmp_path / "_runner.py"
        context_path = tmp_path / "_context.json"
        context_path.write_text(json.dumps(context), encoding="utf-8")
        runner_path.write_text(
            _RUNNER_TEMPLATE.format(
                script_path=str(script_path).replace("\\", "\\\\"),
                input_path=str(input_file.resolve()).replace("\\", "\\\\"),
                context_path=str(context_path).replace("\\", "\\\\"),
            ),
            encoding="utf-8",
        )

        env = _build_sandbox_env(context, requires_gemini=requires_gemini)
        cmd = [sys.executable, str(runner_path)]

        try:
            proc = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=SANDBOX_TIMEOUT_SEC,
                env=env,
                cwd=str(tmp_path),
            )
        except subprocess.TimeoutExpired:
            return [], "", [f"Parser timed out after {SANDBOX_TIMEOUT_SEC}s"]

        stdout = _truncate(proc.stdout or "")
        stderr = _truncate(proc.stderr or "")
        if stdout:
            logs.append(stdout)
        if stderr:
            logs.append(stderr)

        if proc.returncode != 0:
            errors.append(f"Parser exited with code {proc.returncode}")
            if stderr:
                errors.append(stderr.strip().splitlines()[-1])
            return [], "\n".join(logs), errors

        rows_raw = _extract_rows_from_logs(stdout, logs, errors)
        if errors:
            return [], "\n".join(logs), errors

        rows, validation_errors = validate_parse_output(rows_raw, kind)
        errors.extend(validation_errors)
        return rows, "\n".join(logs), errors


def run_uploaded_script_inprocess(
    script_source: str,
    input_path: str,
    context: dict[str, Any],
    *,
    kind: Kind,
) -> tuple[list[dict[str, Any]], str, list[str]]:
    """Fallback in-process loader (used in tests). Production uses subprocess."""
    logs: list[str] = []
    errors: list[str] = []

    with tempfile.TemporaryDirectory(prefix="finance-parser-") as tmp:
        script_path = Path(tmp) / "plugin.py"
        script_path.write_text(script_source, encoding="utf-8")

        spec = importlib.util.spec_from_file_location("finance_plugin", script_path)
        if spec is None or spec.loader is None:
            return [], "", ["Could not load plugin module"]

        module = importlib.util.module_from_spec(spec)
        try:
            spec.loader.exec_module(module)
        except Exception as exc:
            logs.append(traceback.format_exc())
            return [], "\n".join(logs), [f"Plugin load failed: {exc}"]

        parse_fn = getattr(module, "parse", None)
        if not callable(parse_fn):
            return [], "", ["Plugin must define parse(input_path, context)"]

        try:
            result = parse_fn(input_path, context)
        except Exception as exc:
            logs.append(traceback.format_exc())
            return [], "\n".join(logs), [f"parse() raised: {exc}"]

        rows, validation_errors = validate_parse_output(result, kind)
        errors.extend(validation_errors)
        return rows, "\n".join(logs), errors


def _build_sandbox_env(context: dict[str, Any], *, requires_gemini: bool) -> dict[str, str]:
    env = {
        k: v
        for k, v in os.environ.items()
        if k in {"PATH", "SYSTEMROOT", "HOME", "LANG", "LC_ALL", "PYTHONPATH", "TEMP", "TMP"}
    }
    env["PYTHONUNBUFFERED"] = "1"
    env["PYTHONDONTWRITEBYTECODE"] = "1"

    # Best-effort network isolation for non-Gemini scripts
    if not requires_gemini:
        for key in (
            "HTTP_PROXY",
            "HTTPS_PROXY",
            "http_proxy",
            "https_proxy",
            "ALL_PROXY",
            "GEMINI_API_KEY",
            "GOOGLE_API_KEY",
        ):
            env.pop(key, None)
    elif requires_gemini:
        gemini_key = context.get("gemini_api_key") or os.environ.get("GEMINI_API_KEY")
        if gemini_key:
            env["GEMINI_API_KEY"] = gemini_key
        gemini_model = context.get("gemini_model") or os.environ.get("GEMINI_MODEL")
        if gemini_model:
            env["GEMINI_MODEL"] = gemini_model

    return env


def _truncate(text: str) -> str:
    encoded = text.encode("utf-8", errors="replace")
    if len(encoded) <= MAX_OUTPUT_BYTES:
        return text
    return encoded[:MAX_OUTPUT_BYTES].decode("utf-8", errors="replace") + "\n...[truncated]"


def _extract_rows_from_logs(
    stdout: str,
    logs: list[str],
    errors: list[str],
) -> Any:
    marker = "__FINANCE_PARSER_RESULT__"
    for line in reversed(stdout.splitlines()):
        if line.startswith(marker):
            payload = line[len(marker) :].strip()
            try:
                return json.loads(payload)
            except json.JSONDecodeError as exc:
                errors.append(f"Invalid JSON result: {exc}")
                return []
    errors.append("Runner did not emit parse result")
    return []


_RUNNER_TEMPLATE = textwrap.dedent(
    """
    import importlib.util
    import json
    import sys
    import traceback

    SCRIPT_PATH = r"{script_path}"
    INPUT_PATH = r"{input_path}"
    CONTEXT_PATH = r"{context_path}"

    with open(CONTEXT_PATH, encoding="utf-8") as fh:
        CONTEXT = json.load(fh)

    spec = importlib.util.spec_from_file_location("finance_plugin", SCRIPT_PATH)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)

    if not callable(getattr(mod, "parse", None)):
        print("Plugin must define parse(input_path, context)", file=sys.stderr)
        sys.exit(2)

    try:
        rows = mod.parse(INPUT_PATH, CONTEXT)
    except Exception:
        traceback.print_exc()
        sys.exit(1)

    print("__FINANCE_PARSER_RESULT__" + json.dumps(rows, default=str))
    """
)
