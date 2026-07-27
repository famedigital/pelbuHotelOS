# Image server — Cloudinary (+ MCP)

**Chosen image server:** [Cloudinary](https://cloudinary.com)

## Why Cloudinary

- Official **Cursor MCP** (upload, transform, folders, tags) — not available for most CDNs
- CDN delivery + on-the-fly transforms (room/food thumbs, hero crops)
- Fits hotel CMS: menus, rooms, spa, SDF doc images, receipts
- Free tier is enough to start Pelbu flagship

## MCP in this project

1. Copy [`.cursor/mcp.json.example`](../.cursor/mcp.json.example) → `.cursor/mcp.json`
2. Replace `API_KEY`, `API_SECRET`, `CLOUD_NAME` with your Cloudinary credentials (from `web/.env.local`)
3. **Reload Cursor MCP** (Settings → MCP → refresh, or restart Cursor)
4. Servers: `cloudinary-assets`, `cloudinary-env`

`.cursor/mcp.json` is gitignored (contains secrets). Only the example is committed.
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
