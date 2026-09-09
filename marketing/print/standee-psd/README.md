# Café geometric standees — PSD handoff

Layered Photoshop masters from [`menu-standee-sketch-35x72.html`](../menu-standee-sketch-35x72.html).

## Roles

| Standee | Theme |
|---------|--------|
| 1 | **Café food favourites** — Korean chicken BBQ, fry, rolls, fries (hits first); other plates lower |
| 2 | **Coffee · tea · cold** — latte, chai, mojito, boba & related fast sellers |

## Files

| Standee | PSD | Composite preview |
|---------|-----|-------------------|
| 1 — Café food (radial) | [standee-1-barista-cafe.psd](standee-1-barista-cafe.psd) | [exports/standee-1-barista/composite.png](exports/standee-1-barista/composite.png) |
| 2 — Drinks (angled) | [standee-2-cafe-restaurant.psd](standee-2-cafe-restaurant.psd) | [exports/standee-2-cafe-resto/composite.png](exports/standee-2-cafe-resto/composite.png) |

## Spec

- **Trim:** 35.5 × 72 in
- **Render:** ~144 dpi CSS (5112 × 10368 px) — large-format drafting master
- **Base-safe:** bottom **3 in** (see `00_guides` layer)
- Print house can upsample / place in RIP; for final print often 100–150 dpi at full size is enough for roll-ups

## Layer map (Standee 1)

| Layer | Contents |
|-------|----------|
| `00_guides` | Trim edge + 3 in base-safe (hidden by default) |
| `01_composite_flat` | Full flat render (hide after editing parts) |
| `02_brand_block` | Wordmark, headline, hours chips |
| `03_radial_mosaic` | Full radial food window group |
| `04_cta_block` | Come inside + WhatsApp CTA |
| `05_contacts` | Address line |
| `06_logo` | Logo mark alone |
| `07_qr` | Menu QR |
| `08_seg_01` … `08_seg_06` | Individual radial food segments |

## Layer map (Standee 2)

| Layer | Contents |
|-------|----------|
| `00_guides` | Trim + base-safe |
| `01_composite_flat` | Full flat |
| `02_s2_top` | Headline + feature circle |
| `03_s2_mid` | Services + brand message |
| `04_s2_angled` | Angled drink panels |
| `05_s2_resto_label` | “Also cool…” |
| `06_s2_resto` | Secondary drinks strip |
| `07_s2_footer` | Contact + QR bar |
| `08_logo` | Logo |
| `09_feature_circle` | Featured drink circle |
| `10_qr` | Menu QR |

Per-layer TIFF slices also live under `exports/<id>/`.

## Regenerate

```bash
# once: chromium for Playwright (from web/)
cd web && npx playwright install chromium

# from repo root
node scripts/print/build-standee-psd.mjs
```

If browsers live outside the default path:

```powershell
$env:PLAYWRIGHT_BROWSERS_PATH = "<path-to-playwright-browsers>"
node scripts/print/build-standee-psd.mjs
```

Source of truth for layout/copy remains the HTML; re-run after HTML edits.
