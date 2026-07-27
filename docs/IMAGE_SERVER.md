# Image server — Cloudinary (+ MCP)

**Chosen image server:** [Cloudinary](https://cloudinary.com)

## Why Cloudinary

- Official **Cursor MCP** (upload, transform, folders, tags) — not available for most CDNs
- CDN delivery + on-the-fly transforms (room/food thumbs, hero crops)
- Fits hotel CMS: menus, rooms, spa, SDF doc images, receipts
- Free tier is enough to start Pelbu flagship

## MCP in this project

Configured in [`.cursor/mcp.json`](../.cursor/mcp.json):

| Server | URL |
|--------|-----|
| `cloudinary-assets` | `https://asset-management.mcp.cloudinary.com/mcp` |
| `cloudinary-env` | `https://environment-config.mcp.cloudinary.com/mcp` |

### Enable in Cursor

1. Create a free Cloudinary account → Console → copy **Cloud name**, **API Key**, **API Secret**
2. Cursor → **Settings → MCP** → ensure project MCPs load (or Add server if needed)
3. Authenticate (OAuth prompt) **or** set headers/`CLOUDINARY_URL` for API key auth
4. Put app secrets in `web/.env.local` (never commit):

```env
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=
```

## Folder convention (Cloudinary)

```
pelbu/
  brand/
  rooms/
  cafe/
  pastry/
  restaurant/
  bar/
  spa/
  meeting/
  guests/sdf/     # private / signed if needed
  receipts/       # private
```

## Not using

- Raw Supabase Storage as primary CDN (we still may store private SDF docs there later)
- Imgix / Uploadcare — no first-party MCP as strong as Cloudinary for our stack
