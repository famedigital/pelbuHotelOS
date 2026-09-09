# Pelbu Suites — in-room sticker pack

Print-ready sticker masters. **Layered PSD @ 600 dpi** so the print-house designer can move, resize, and recolor freely.

## Quick open

| Surface | Trim | HTML | PSD |
|---------|------|------|-----|
| Folder black (4.5 cm H) | **70 × 45 mm** | [sticker-folder-black-45.html](sticker-folder-black-45.html) | [sticker-folder-black-45.psd](sticker-folder-black-45.psd) |
| Folder black (3 cm H) | **60 × 30 mm** | [sticker-folder-black-30.html](sticker-folder-black-30.html) | [sticker-folder-black-30.psd](sticker-folder-black-30.psd) |
| Tissue box | **65 × 65 mm** | [sticker-tissue-box.html](sticker-tissue-box.html) | [sticker-tissue-box.psd](sticker-tissue-box.psd) |
| Bathroom ply (5 cm H) | **120 × 50 mm** landscape | [sticker-plyboard-save-water.html](sticker-plyboard-save-water.html) | [sticker-plyboard-save-water.psd](sticker-plyboard-save-water.psd) |

Also: `sticker-folder-black.psd` = copy of the 45 mm folder.

Open any HTML in Chrome → **Print / Save PDF** (background graphics ON).

## Brand copy (locked)

- **Company:** Pelbu Suites
- **Website:** www.pelbusuites.bt
- **WhatsApp QR:** [https://wa.me/97516193410](https://wa.me/97516193410) (+975 1619 3410)
- **QR caption:** Scan · WhatsApp us (30 mm folder uses short “WhatsApp”)
- **Plyboard:** Save water / Every drop counts

## Trim + resolution

| Variant | Trim (mm) | Artboard + 3 mm bleed | DPI |
|---------|-----------|------------------------|-----|
| Folder 4.5 cm H | 70 × 45 | 76 × 51 | **600** |
| Folder 3 cm H | 60 × 30 | 66 × 36 | **600** |
| Tissue | 65 × 65 | 71 × 71 | **600** |
| Plyboard 5 cm H | 120 × 50 | 126 × 56 | **600** |

Widths for folder/ply are starting masters — designer can crop/extend in PSD. Heights match physical paste surfaces.

## Artwork element sizes (starting layout — maxed for distinction)

| Variant | Logo | QR | Notes |
|---------|------|-----|-------|
| Folder 45 | **20 mm** | **20 mm** | Wordmark ~7.2 mm |
| Folder 30 | **18 mm** | **18 mm** | Stacked Pelbu / Suites |
| Tissue | **24 mm** | **22 mm** | Stacked, tight gaps |
| Plyboard | **32 mm** | **32 mm** | Stacked Save / water |

Background is secondary — logo, QR, and type dominate. Designer can still nudge layers in PSD.

## Color / ink

### Folder (black)

- Structural white logo ([assets/logo-mark-white.png](assets/logo-mark-white.png)) — frame + knot with transparent panes
- Type + QR caption: **#FFFFFF**
- Background layer black (hide for white vinyl on black folder)

### Tissue (cream/white)

- Espresso text **#1a0f0a**, full-colour logo, copper rule **#c45c26**

### Plyboard (brown ~#8a6a4a)

- Cream **#fffdf8** logo/type/QR · copper headline **#c45c26** · gold rule
- Landscape three-zone layout: message | brand | QR

## PSD layer map

| Layer | Contents |
|-------|----------|
| `00_guides` | Trim + bleed — hide before print |
| `01_background` | Surface fill |
| `02_logo_mark` | Logo |
| `03_wordmark` | Pelbu Suites |
| `04_website` | www.pelbusuites.bt |
| `05_qr_whatsapp` | WhatsApp QR |
| `06_headline` | Save water (ply only) |
| `07_subline` | Every drop counts (ply only) |
| `08_qr_caption` | Caption |
| `09_accent_rule` | Accent rule (tissue + ply) |

## Exports

Per-variant TIFF slices + composite under `exports/folder-45/`, `exports/folder-30/`, `exports/tissue/`, `exports/plyboard/`.

## Regenerate

```bash
cd scripts/print && npm install   # once
node scripts/print/prepare-sticker-assets.mjs
node scripts/print/build-sticker-psd.mjs
```

## Print-house notes

- 600 dpi RGB masters — convert CMYK / spot white at RIP.
- Matte PP / vinyl; kiss-cut on liner.
- Designer: hide `00_guides`, then nudge logo/QR/type as needed for final die size.
