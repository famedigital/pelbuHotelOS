"""Scrape certified tour operators from services.bhutan.travel into CSV.

On Windows without Python, use:
  node scripts/scrape-bhutan-tour-ops.mjs --dzongkhag=Thimphu
"""

from __future__ import annotations

import argparse
import csv
import html as html_lib
import json
import re
import time
import urllib.parse
import urllib.request
from pathlib import Path

BASE = "https://services.bhutan.travel/search/tour-operator"
OUT_DIR = Path(__file__).resolve().parent.parent / "docs" / "exports"
MAILCHIMP_DIR = Path(__file__).resolve().parent.parent / "marketing" / "mailchimp"
UA = "PelbuSuites-research/1.0 (+hotel partner research; respectful crawl)"

LOCATION_IDS = {
    "thimphu": 1,
    "paro": 2,
    "punakha": 3,
    "chhukha": 4,
    "haa": 5,
    "samtse": 6,
    "dagana": 7,
    "gasa": 8,
    "tsirang": 9,
    "wangdue phodrang": 10,
    "bumthang": 11,
    "sarpang": 12,
    "trongsa": 13,
    "zhemgang": 14,
    "lhuntse": 15,
    "mongar": 16,
    "pema gatshel": 17,
    "samdrup jongkhar": 18,
    "trashigang": 19,
    "trashi yangtse": 20,
}


def fetch_page(url: str) -> dict:
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "text/html"})
    with urllib.request.urlopen(req, timeout=60) as resp:
        raw = resp.read().decode("utf-8", "replace")
    m = re.search(r'data-page="([^"]+)"', raw)
    if not m:
        raise RuntimeError(f"No Inertia data-page on {url}")
    return json.loads(html_lib.unescape(m.group(1)))


def normalize_row(item: dict, dzongkhag: str = "") -> dict:
    slug = str(item.get("slug") or "").strip()
    phone_raw = item.get("contact") or item.get("phone") or item.get("mobile") or ""
    phone = str(phone_raw).strip()
    if phone and not phone.startswith("+"):
        phone = f"+975 {phone}"
    return {
        "id": str(item.get("id") or "").strip(),
        "name": str(item.get("name") or item.get("company_name") or "").strip(),
        "phone": phone,
        "email": str(item.get("email") or "").strip(),
        "website": str(item.get("website") or "").strip(),
        "slug": slug,
        "dzongkhag": dzongkhag,
        "source_url": f"{BASE}/{slug}" if slug else "",
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--locations", type=int, default=None, help="TCB locations[] id (Thimphu=1)")
    parser.add_argument("--dzongkhag", type=str, default=None, help="Dzongkhag name, e.g. Thimphu")
    args = parser.parse_args()

    location_id = args.locations
    location_name = ""
    if args.dzongkhag:
        key = args.dzongkhag.strip().lower()
        location_id = LOCATION_IDS.get(key)
        if not location_id:
            raise SystemExit(f"Unknown dzongkhag {args.dzongkhag!r}")
        location_name = args.dzongkhag.strip().title()
    elif location_id:
        for name, lid in LOCATION_IDS.items():
            if lid == location_id:
                location_name = name.title()
                break
        location_name = location_name or f"Id-{location_id}"

    qs = {}
    if location_id:
        qs["locations[]"] = str(location_id)
        print(f"Filtering by office dzongkhag: {location_name} (locations[]={location_id})")

    first_url = f"{BASE}?{urllib.parse.urlencode(qs)}" if qs else BASE
    first = fetch_page(first_url)
    paginator = first["props"]["results"]
    last_page = int(paginator.get("last_page") or 1)
    print(
        "Pagination:",
        {
            k: paginator.get(k)
            for k in ("total", "last_page", "current_page", "per_page")
        },
    )

    rows: list[dict] = []
    seen: set[tuple[str, str, str]] = set()

    for page in range(1, last_page + 1):
        if page > 1:
            time.sleep(0.6)
            page_qs = dict(qs)
            page_qs["page"] = str(page)
            data = fetch_page(f"{BASE}?{urllib.parse.urlencode(page_qs)}")
            paginator = data["props"]["results"]
        items = paginator.get("data") or []
        print(f"Page {page}/{last_page}: {len(items)} items")
        for item in items:
            row = normalize_row(item if isinstance(item, dict) else {}, location_name)
            key = (row["name"].lower(), row["email"].lower(), row["phone"])
            if key in seen:
                continue
            seen.add(key)
            if row["name"] or row["email"] or row["phone"]:
                rows.append(row)

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    fieldnames = ["id", "name", "phone", "email", "website", "slug", "dzongkhag", "source_url"]
    suffix = f"-{location_name.lower().replace(' ', '-')}" if location_name else ""
    csv_path = OUT_DIR / f"bhutan-tour-operators{suffix}.csv"
    with csv_path.open("w", newline="", encoding="utf-8-sig") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames)
        w.writeheader()
        w.writerows(rows)

    slim_path = OUT_DIR / f"bhutan-tour-operators{suffix}-contacts.csv"
    with slim_path.open("w", newline="", encoding="utf-8-sig") as f:
        w = csv.DictWriter(f, fieldnames=["name", "phone", "email", "dzongkhag"])
        w.writeheader()
        for r in rows:
            w.writerow({k: r[k] for k in ["name", "phone", "email", "dzongkhag"]})

    if not location_name:
        # Compat path used by import-tcb-tour-operators.mjs
        with (OUT_DIR / "bhutan-tour-operators.csv").open("w", newline="", encoding="utf-8-sig") as f:
            w = csv.DictWriter(f, fieldnames=fieldnames)
            w.writeheader()
            w.writerows(rows)

    if location_name:
        MAILCHIMP_DIR.mkdir(parents=True, exist_ok=True)
        mail_path = MAILCHIMP_DIR / f"{location_name.lower().replace(' ', '-')}-travel-agents-seed.csv"
        mail_fields = [
            "Email Address",
            "First Name",
            "Last Name",
            "Company",
            "Phone",
            "City",
            "State",
            "Address",
            "Website",
            "Tags",
            "Source",
            "Notes",
        ]
        with mail_path.open("w", newline="", encoding="utf-8-sig") as f:
            w = csv.DictWriter(f, fieldnames=mail_fields)
            w.writeheader()
            for r in rows:
                w.writerow(
                    {
                        "Email Address": r["email"],
                        "First Name": "",
                        "Last Name": "",
                        "Company": r["name"],
                        "Phone": r["phone"],
                        "City": r["dzongkhag"],
                        "State": "",
                        "Address": "",
                        "Website": r["website"],
                        "Tags": f"bhutan-agent;tcb-directory;{r['dzongkhag'].lower()}-agent",
                        "Source": "tcb-portal",
                        "Notes": f"TCB {r['source_url']}" if r["source_url"] else "TCB directory",
                    }
                )
        print(f"Mailchimp seed: {mail_path}")

    print(f"\nWrote {len(rows)} operators")
    print(f"  {csv_path}")
    print(f"  {slim_path}")
    missing_email = sum(1 for r in rows if not r["email"])
    missing_phone = sum(1 for r in rows if not r["phone"])
    print(f"Missing email: {missing_email}, missing phone: {missing_phone}")


if __name__ == "__main__":
    main()
