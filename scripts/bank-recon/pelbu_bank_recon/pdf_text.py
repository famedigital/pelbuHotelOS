"""PDF / text extraction helpers."""

from __future__ import annotations

from pathlib import Path


class PdfPasswordError(Exception):
    """The PDF is locked, or the password did not open it."""


def extract_text(path: str | Path, password: str | None = None) -> str:
    """Extract text from a PDF or return contents of a .txt fixture."""
    p = Path(path)
    if not p.exists():
        raise FileNotFoundError(p)

    suffix = p.suffix.lower()
    if suffix in {".txt", ".csv"}:
        return p.read_text(encoding="utf-8", errors="replace")

    if suffix != ".pdf":
        raise ValueError(f"Unsupported file type: {suffix} (use .pdf or .txt)")

    _require_open_password(p, password)

    # Prefer pdfplumber (layout-aware); fall back to pypdf.
    try:
        import pdfplumber

        chunks: list[str] = []
        with pdfplumber.open(p, password=password or "") as pdf:
            for page in pdf.pages:
                chunks.append(page.extract_text() or "")
        text = "\n".join(chunks).strip()
        if text:
            return text
    except PdfPasswordError:
        raise
    except Exception:
        pass

    from pypdf import PdfReader

    reader = PdfReader(str(p))
    if reader.is_encrypted and password:
        reader.decrypt(password)
    return "\n".join((page.extract_text() or "") for page in reader.pages).strip()


def _require_open_password(path: Path, password: str | None) -> None:
    from pypdf import PdfReader

    reader = PdfReader(str(path))
    if not reader.is_encrypted:
        return
    if not password:
        raise PdfPasswordError("This PDF is locked. Enter the password.")
    if reader.decrypt(password) == 0:
        raise PdfPasswordError("That password did not open the PDF.")
