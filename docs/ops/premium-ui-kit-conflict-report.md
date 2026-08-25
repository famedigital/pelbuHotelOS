# Premium UI kit merge — conflict report (Pelbu)

Source: `C:\GitHub\touritinerary creation\premium-ui-export\`  
Target: `web/`  
Date: 2026-08-26

## Tier classification

### A — Import new (FO-relevant subset)

Copied for desk premium chrome (Pelbu-native; cross-repo kit copy blocked):

- `empty-state.tsx`
- `expandable-text.tsx`
- `message-loading.tsx`
- `scroll-area.tsx`
- `avatar.tsx`

Deferred (not needed for FO speed/premium this pass):

- `ai-chat-input`, `ai-chat-landing`, `chat-bubble`, `dot-pattern`, `footer`, `animated-menu-bar`, `be-ui-create-menu`, `circular-command-menu`, `reui-autocomplete`, `tabs-in-cell-for-navigation`, `user-dropdown`, `breadcrumb`, demos

### B — Overlap — keep Pelbu API

Do **not** overwrite. Port visuals only if needed later:

- `button.tsx` — **keep `citrus` / `gold`**
- `dialog` (kit may lack; Pelbu has richer API)
- `badge`, `input`, `dropdown-menu`, `tabs`, `skeleton`, `alert`, `card`, `checkbox`, `label`, `select`, `separator`, `table`, `textarea`
- `sidebar.tsx` — **never replace** desk sidebar

### C — Never overwrite

- `web/src/components/erp/**`
- DeskShell / app-sidebar / StayHub / POS / RoomRack

### D — Never wholesale replace

- Full `globals.css`
- Kit `AppShell.tsx` as ERP root
- Public layout / PWA

## Resolutions

| File | Action |
|---|---|
| A-tier FO files | Copy if missing |
| B-tier | Keep Pelbu |
| Kit AppShell / sidebar | Skip |
| globals | Additive `.erp` / `.desk-premium-*` utilities only |
