"""PDF / text extraction helpers."""

from __future__ import annotations

from pathlib import Path


def extract_text(path: str | Path) -> str:
    """Extract text from a PDF or return contents of a .txt fixture."""
    p = Path(path)
    if not p.exists():
        raise FileNotFoundError(p)

    suffix = p.suffix.lower()
    if suffix in {".txt", ".csv"}:
        return p.read_text(encoding="utf-8", errors="replace")

    if suffix != ".pdf":
        raise ValueError(f"Unsupported file type: {suffix} (use .pdf or .txt)")

    # Prefer pdfplumber (layout-aware); fall back to pypdf.
    try:
        import pdfplumber

        chunks: list[str] = []
        with pdfplumber.open(p) as pdf:
            for page in pdf.pages:
                chunks.append(page.extract_text() or "")
        text = "\n".join(chunks).strip()
        if text:
            return text
    except Exception:
        pass

    from pypdf import PdfReader

    reader = PdfReader(str(p))
    return "\n".join((page.extract_text() or "") for page in reader.pages).strip()
