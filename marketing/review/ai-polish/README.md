# Pelbu photo polish — review pack

Generated **2026-08-05** for review only. Nothing here replaces live CMS assets until you choose winners.

## Folder

`marketing/review/ai-polish/`

## Labels

| Suffix | Meaning |
|--------|---------|
| **`…-AI.jpg`** | Cloudinary generative AI (nano-banana-2-edit) guided by the real photo — high-res marketing polish. |
| **`…-FX.jpg`** | Non-AI Cloudinary pipeline: improve / contrast / vibrance / sharpen (+ gen_restore when available). Same geometry as source; lighter touch. |

## Files

### Exterior (building)
| File | Source public ID | Notes |
|------|------------------|--------|
| `01-exterior-hero-AI.jpg` | `pelbu/hotel/exterior` | Primary AI hero exterior |
| `01b-exterior-hero-FX.jpg` | same | FX pass on original |
| `02-exterior-alt-AI.jpg` | `pelbu/gallery/ext11` | Alt exterior AI |
| `02b-exterior-alt-FX.jpg` | same | FX pass |
| `10-exterior-side-FX.jpg` | `pelbu/gallery/ext3` | Side / secondary angle |

### Rooms
| File | Source public ID | Category hint |
|------|------------------|---------------|
| `03-room-double-FX.jpg` | `pelbu/rooms/deluxe-suite` | Double / queen |
| `04-room-superior-FX.jpg` | `pelbu/rooms/superior` | Superior |
| `05-room-twin-AI.jpg` | `pelbu/rooms/twin` | Twin (AI) |
| `05b-room-twin-FX.jpg` | same | Twin FX |
| `06-room-suite-view-FX.jpg` | `pelbu/rooms/suite-view` | Suite view |
| `07-room-suite-alt-FX.jpg` | `pelbu/rooms/suite-alt` | Suite / twin-style interior |
| `08-room-superior-living-FX.jpg` | `pelbu/rooms/superior-living` | Living / sitting |
| `09-room-deluxe-FX.jpg` | `pelbu/rooms/deluxe` | Deluxe |

## Cloudinary copies (AI only)

Also stored under:

- `pelbu/review/ai-polish/exterior-hero`
- `pelbu/review/ai-polish/exterior-alt`
- `pelbu/review/ai-polish/room-twin`

## Quota note

Cloudinary **image generation quota hit the plan limit** mid-run (50/cycle used).  
Only exterior ×2 + twin room got the full AI edit. Room double / suite AI re-runs need quota reset or a plan top-up.

When quota returns, re-run AI for:

1. `pelbu/rooms/deluxe-suite` → double  
2. `pelbu/rooms/suite-view` or suite jacuzzi asset → suite  
3. `pelbu/rooms/superior` → superior  

## How to pick

1. Open this folder in Explorer / Finder.
2. Prefer **`AI`** files for social / mail / rate sheet when look matches the real property.
3. Prefer **`FX`** when you want minimum risk of AI changing furniture/layout.
4. Tell Cursor which filenames to promote into `pelbu/rooms/*` / hero CMS (or Mailchimp / rate.html).

## Source originals (raw)

If you need the unedited Cloudinary originals for comparison:

```
https://res.cloudinary.com/hkkchsfy/image/upload/pelbu/hotel/exterior.jpg
https://res.cloudinary.com/hkkchsfy/image/upload/pelbu/rooms/deluxe-suite.jpg
https://res.cloudinary.com/hkkchsfy/image/upload/pelbu/rooms/twin.jpg
https://res.cloudinary.com/hkkchsfy/image/upload/pelbu/rooms/suite-view.jpg
```
