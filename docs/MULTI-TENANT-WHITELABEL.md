# Multi-tenant white-label — Pelbu OS as a SaaS PMS

**Goal:** Sell Pelbu OS like eZee / Mews: a marketing site for the product, tenant logins into their own ERP, and each hotel’s **own public website** on their domain — while you keep hosting the platform.

**Date:** 2026-07-31.

---

## 1. What you already have

| Building block | Status |
|----------------|--------|
| `property_id` on ops tables | Yes |
| Desk property switcher | Yes |
| CMS pages / media per property | Partially (front-public) |
| `template_id` (flagship = 1) | Yes |
| Host → property routing | **No** |
| Tenant org / billing / seats | **No** |
| Custom domain certificate automation | **No** |
| Isolated tenant admin users | **Partial** (staff per property; shared DESK_PIN is not SaaS-grade) |

White-label is mostly a **routing + tenancy + billing** problem on top of the current schema — not a rewrite.

---

## 2. Three products, one codebase

```text
┌──────────────────────────────────────────────────────────┐
│  Platform marketing site  (e.g. app.pelbu.bt / os.pelbu)  │
│  Features, pricing, “Book a demo”, Login                 │
└───────────────┬───────────────────────────┬──────────────┘
                │                           │
                ▼                           ▼
     ┌──────────────────┐        ┌──────────────────────┐
     │ Tenant ERP       │        │ Tenant public site   │
     │ desk.acme.bt     │        │ www.acmehotel.bt     │
     │ /erp/*           │        │ /, /rooms, /book …   │
     └──────────────────┘        └──────────────────────┘
                │                           │
                └───────────┬───────────────┘
                            ▼
                   Same Next.js deploy
                   Host header → property_id
                   Supabase row filter
```

DNS **forwarding alone is not enough**. The browser must hit **your** Vercel (or AWS) origin with a `Host` header you recognise. Then your middleware loads that property’s CMS + rates + branding.

---

## 3. DNS patterns that work

### 3.1 Subdomain on your zone (easiest)

| Record | Example | Points to |
|--------|---------|-----------|
| CNAME | `acme.os.pelbu.bt` | `cname.vercel-dns.com` (or your ALB) |
| CNAME | `desk.acme.os.pelbu.bt` | same |

You control the zone; certificates are automatic on Vercel once the domain is added.

### 3.2 Customer brings their domain (true white-label)

Customer creates:

| Record | Example | Points to |
|--------|---------|-----------|
| CNAME | `www.btclhotel.bt` | `cname.vercel-dns.com` |
| CNAME | `desk.btclhotel.bt` | `cname.vercel-dns.com` |
| TXT | `_vercel.…` or ACME | domain verification |

You **must**:

1. Add the domain in Vercel (API or dashboard) after verification.  
2. Store `hostname → property_id` (and optional `app_role`: `public` | `desk`) in Supabase.  
3. Resolve in Next.js middleware on every request.

Apex (`btclhotel.bt`) needs ALIAS/ANAME or a redirect to `www` — plain A records to Vercel’s IPs are fragile; prefer CNAME flattening at the DNS provider.

### 3.2 What “DNS forward” usually means (and why it fails)

Many Bhutan registrars offer “URL forward” (HTTP 302 to another URL). That **changes the address bar** to your marketing domain and breaks cookies / SEO / brand. For white-label you need **DNS CNAME to your host**, not URL forwarding.

---

## 4. Application design

### 4.1 Tables (add)

```text
tenants                -- org / chain (BTCL is one tenant)
  id, name, billing_status, plan, …

tenant_members         -- who can admin the tenant
  tenant_id, user_id, role

properties             -- already exists; add tenant_id
property_hostnames     -- NEW
  hostname text primary key
  property_id uuid not null
  kind text check (kind in ('public','desk','marketing'))
  verified_at timestamptz
```

### 4.2 Middleware (sketch)

```ts
// middleware.ts
const host = request.headers.get("host")?.split(":")[0]?.toLowerCase();
const mapping = await resolveHostname(host); // cache in edge KV / cookie
if (!mapping) return NextResponse.rewrite("/site-not-configured");
const headers = new Headers(request.headers);
headers.set("x-property-id", mapping.property_id);
headers.set("x-site-kind", mapping.kind);
if (mapping.kind === "desk" && !pathname.startsWith("/erp")) {
  return NextResponse.redirect(new URL("/erp", request.url));
}
if (mapping.kind === "public" && pathname.startsWith("/erp")) {
  return NextResponse.redirect(new URL("/login", request.url)); // tenant login
}
return NextResponse.next({ request: { headers } });
```

`resolveActivePropertyId` should prefer `x-property-id` over the desk cookie when on a hostname-bound site.

### 4.3 Public site

- CMS already has `cms_pages` / `cms_site_settings` — scope every read by `property_id` from the host.  
- Templates: keep `template_id = 1` as Pelbu flagship; tenants clone template → their own CMS rows.  
- Branding: logo, colours, domain already partly in settings — make them host-driven.

### 4.4 Login

| Audience | Entry | Session |
|----------|-------|---------|
| Platform marketing | `os.pelbu.bt/login` | Chooses tenant → desk host |
| Hotel desk | `desk.hotel.bt/erp/login` | Staff Auth **required**; retire shared DESK_PIN for SaaS tenants |
| Guest | `www.hotel.bt` | No desk auth |
| Agent | `www.hotel.bt/agents` or `agents.hotel.bt` | Agent Auth scoped to property |

Shared `DESK_PIN` is fine for **single-hotel Pelbu** ops. It is **not** acceptable for paying tenants.

### 4.5 Data isolation

1. Every query filters `property_id` (already the pattern).  
2. RLS policies for `authenticated` staff must include `property_id IN (staff_properties)`.  
3. Shrink service-role usage (ERP-AUDIT SEC-01).  
4. Never put two tenants’ secrets in one env var — per-tenant WhatsApp / Resend / payment keys in a secrets table or Vault.

---

## 5. SaaS commercial layers (minimal)

| Capability | Why |
|------------|-----|
| Plans (rooms / outlets / staff seats) | Stops one tenant from unbounded load |
| Stripe / bank invoice billing | Recurring revenue |
| Feature flags per plan | Laundry / channel / payroll as add-ons |
| Usage meters (bookings, messages) | WhatsApp & SMS cost control |
| Soft delete / export | Offboarding without leaking data |

Ship Host routing + staff Auth **before** fancy billing. Billing without isolation is theatre.

---

## 6. Stay on Vercel+Supabase vs move to AWS VM

| Concern | Stay (recommended until P0 money is solid) | AWS VM later |
|---------|--------------------------------------------|--------------|
| Custom domains | Vercel domains API | ALB + ACM + nginx/Caddy |
| DB | Supabase Postgres | Self-managed Postgres / RDS |
| Mail | Resend | SES / Postfix |
| WhatsApp | CallMeBot → upgrade to Cloud API | Same Cloud API or BSP on your IP |
| Ops burden | Low | High (backups, patches, HA) |
| “International ERP” perception | Process quality matters more than the VM | Useful for data residency / enterprise RFPs |

**Order:** fix ERP-AUDIT Phase A → white-label Host MVP → then decide AWS.

---

## 7. Implementation checklist

### MVP (one pilot hotel, not Pelbu)

1. Migration: `tenants`, `property_hostnames`, `properties.tenant_id`.  
2. Middleware host resolve + `x-property-id`.  
3. Public pages read CMS by header property.  
4. Desk host forces `/erp`; staff Auth only (no DESK_PIN).  
5. Vercel domain attach runbook (manual is OK for pilot).  
6. Seed clone-from-template-1 script.

### v1 SaaS

1. Self-serve domain verification (TXT).  
2. Tenant admin UI (users, properties, plan).  
3. Billing.  
4. Per-tenant messaging credentials.  
5. Status page + backup policy.

---

## 8. How this answers the BTCL / “ezee” ask

- **Front website showcasing PMS features** → platform marketing site (your brand, not the hotel’s).  
- **Login into their ERP** → `desk.<hotel>` or `app.<tenant>` with staff Auth.  
- **Their own public website** → `www.<hotel>` CNAME to you; Host maps to their `property_id`; CMS content is theirs.  
- **DNS** → CNAME to Vercel (or later ALB), **not** URL forward.

For a **chain** (many hotels under one tenant), see [BTCL-ADAPTATION.md](BTCL-ADAPTATION.md).
