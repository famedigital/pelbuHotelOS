"""Scrape certified tour operators from services.bhutan.travel into CSV."""

from __future__ import annotations

import csv
import html as html_lib
import json
import re
import time
import urllib.error
import urllib.request
from pathlib import Path

BASE = "https://services.bhutan.travel/search/tour-operator"
OUT_DIR = Path(__file__).resolve().parent.parent / "docs" / "exports"
UA = "PelbuSuites-research/1.0 (+hotel partner research; respectful crawl)"


def fetch_page(url: str) -> dict:
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "text/html"})
    with urllib.request.urlopen(req, timeout=60) as resp:
        raw = resp.read().decode("utf-8", "replace")
    m = re.search(r'data-page="([^"]+)"', raw)
    if not m:
        raise RuntimeError(f"No Inertia data-page on {url}")
    return json.loads(html_lib.unescape(m.group(1)))


def pick_list(props: dict) -> dict:
    """Find Laravel paginator dict with tour operator records."""
    for key, val in props.items():
        if isinstance(val, dict) and isinstance(val.get("data"), list) and val["data"]:
            sample = val["data"][0]
            if isinstance(sample, dict) and (
                "company_name" in sample
                or "email" in sample
                or "phone" in sample
                or "slug" in sample
            ):
                return val
    # fallback: any paginator
    for key, val in props.items():
        if isinstance(val, dict) and isinstance(val.get("data"), list):
            return val
    raise RuntimeError(f"No list found in props keys: {list(props.keys())}")


def normalize_row(item: dict) -> dict:
    # Flatten common nested profile/user fields if present
    profile = item.get("profile") if isinstance(item.get("profile"), dict) else {}
    user = item.get("user") if isinstance(item.get("user"), dict) else {}

    name = (
        item.get("company_name")
        or item.get("name")
        or profile.get("company_name")
        or profile.get("name")
        or user.get("name")
        or ""
    )
    email = (
        item.get("email")
        or profile.get("email")
        or user.get("email")
        or item.get("contact_email")
        or ""
    )
    phone = (
        item.get("phone")
        or item.get("mobile")
        or item.get("contact_number")
        or profile.get("phone")
        or profile.get("mobile")
        or user.get("phone")
        or ""
    )
    website = (
        item.get("website")
        or item.get("url")
        or profile.get("website")
        or item.get("web_url")
        or ""
    )
    slug = item.get("slug") or ""
    license_no = item.get("license_no") or item.get("license_number") or profile.get("license_no") or ""

    return {
        "name": str(name).strip(),
        "phone": str(phone).strip(),
        "email": str(email).strip(),
        "website": str(website).strip(),
        "slug": str(slug).strip(),
        "license_no": str(license_no).strip(),
        "source_url": f"https://services.bhutan.travel/search/tour-operator/{slug}" if slug else "",
    }


def main() -> None:
    first = fetch_page(BASE)
    props = first["props"]
    paginator = pick_list(props)
    sample = paginator["data"][0]
    print("Sample keys:", sorted(sample.keys()))
    print("Sample JSON:", json.dumps(sample, indent=2)[:2500])
    print(
        "Pagination:",
        {
            k: paginator.get(k)
            for k in ("total", "last_page", "current_page", "per_page", "from", "to")
        },
    )

    last_page = int(paginator.get("last_page") or 1)
    rows: list[dict] = []
    seen: set[tuple[str, str, str]] = set()

    for page in range(1, last_page + 1):
        url = BASE if page == 1 else f"{BASE}?page={page}"
        if page > 1:
            time.sleep(0.6)  # polite delay
            data = fetch_page(url)
            paginator = pick_list(data["props"])
        items = paginator.get("data") or []
        print(f"Page {page}/{last_page}: {len(items)} items")
        for item in items:
            row = normalize_row(item if isinstance(item, dict) else {})
            key = (row["name"].lower(), row["email"].lower(), row["phone"])
            if key in seen:
                continue
            seen.add(key)
            if row["name"] or row["email"] or row["phone"]:
                rows.append(row)

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    csv_path = OUT_DIR / "bhutan-tour-operators.csv"
    fieldnames = ["name", "phone", "email", "website", "license_no", "slug", "source_url"]
    with csv_path.open("w", newline="", encoding="utf-8-sig") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames)
        w.writeheader()
        w.writerows(rows)

    # Minimal 3-col sheet too
    slim_path = OUT_DIR / "bhutan-tour-operators-contacts.csv"
    with slim_path.open("w", newline="", encoding="utf-8-sig") as f:
        w = csv.DictWriter(f, fieldnames=["name", "phone", "email"])
        w.writeheader()
        for r in rows:
            w.writerow({"name": r["name"], "phone": r["phone"], "email": r["email"]})

    print(f"\nWrote {len(rows)} operators")
    print(f"  {csv_path}")
    print(f"  {slim_path}")
    missing_email = sum(1 for r in rows if not r["email"])
    missing_phone = sum(1 for r in rows if not r["phone"])
    print(f"Missing email: {missing_email}, missing phone: {missing_phone}")


if __name__ == "__main__":
    main()
