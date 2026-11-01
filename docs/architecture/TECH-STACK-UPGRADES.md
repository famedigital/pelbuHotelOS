# Technical Stack Upgrades & Architectural Hardening Specification

> **Target:** Cursor Composer / Implementer  
> **Scope:** Frontend, Backend, Database, Middleware, and Background Job Infrastructure.  
> **Objective:** Transition Hotel OS from prototype to a bulletproof 9.5+ Enterprise Grade PMS/ERP.

---

## 1. Summary of Upgrades

| Subsystem | Target Files | Upgrade Description |
| :--- | :--- | :--- |
| **1. Middleware** | `web/src/middleware.ts` | Zero-latency LRU in-memory cache for hostname $\rightarrow$ `property_id` resolution. |
| **2. Frontend Compiler** | `web/next.config.ts` | Package import modularization (`optimizePackageImports`) and production dead-code elimination. |
| **3. UI Containment** | `web/src/app/globals.css`, `/erp/calendar` | CSS layout containment (`contain: layout style paint`) to eliminate calendar rack repaints. |
| **4. Database Indexing** | `supabase/migrations/` | Composite performance indexes on high-frequency tables (`stays`, `folio_charges`). |
| **5. Background Jobs** | `web/src/lib/jobs/`, `pg-boss` | Durable, retryable background job runner replacing fragile shell scripts for Night Audit & Channex sync. |

---

## 2. Enterprise-Grade Latency SLA & Budget Table (Strict Targets)

To achieve a 9.5+ Enterprise rating, all responses must satisfy these strict latency ceilings:

```
                               LATENCY SLA BENCHMARKS
┌───────────────────────────────────────┬────────────┬─────────────┬─────────────┐
│ Subsystem / Operation                 │ Prototype  │ P95 Target  │ P99 Ceiling │
├───────────────────────────────────────┼────────────┼─────────────┼─────────────┤
│ Middleware Tenant Resolution          │ 40–120 ms  │ < 2 ms      │ < 5 ms      │
│ Dynamic ERP Page TTFB (warm)          │ 600–900 ms │ < 220 ms    │ < 350 ms    │
│ Single Stay / Guest Primary Key Query │ 35–80 ms   │ < 5 ms      │ < 12 ms     │
│ Folio Balance Aggregation Query       │ 120–250 ms │ < 15 ms     │ < 30 ms     │
│ 30-Day Room Rack Matrix (100 rooms)   │ 350–700 ms │ < 45 ms     │ < 80 ms     │
│ Frontend Interaction to Next Paint    │ 120–250 ms │ < 50 ms     │ < 80 ms     │
│ Calendar Grid Scroll Frame Time       │ 24–45 ms   │ 16.6 ms     │ 16.6 ms     │
│ Omnibar (Ctrl+K) Guest Autocomplete   │ 280–500 ms │ < 60 ms     │ < 100 ms    │
│ StayHub Modal Open & Render           │ 400–800 ms │ < 120 ms    │ < 200 ms    │
│ Realtime Push (Desk A -> Desk B)      │ 500–1200 ms│ < 180 ms    │ < 300 ms    │
│ Public Booking LCP (Mobile)           │ 2.4–3.8 s  │ < 1.2 s     │ < 1.8 s     │
│ Night Audit End-of-Day Roll           │ Manual     │ < 15 s      │ < 30 s      │
└───────────────────────────────────────┴────────────┴─────────────┴─────────────┘
```

### Critical Rules to Guarantee These Latencies:
1. **Zero N+1 Queries:** Never fetch folio line items inside an array map over stays. Always use a single join query or Postgres JSON aggregation.
2. **Strict DB Query Timeouts:** Set `statement_timeout = '3000ms'` in Postgres configuration for standard API/Server actions. Long-running analytical reports must run asynchronously via background workers.
3. **Optimistic UI Transitions:** Front desk action buttons (check-in, mark clean, void line) must reflect in local UI state within **16ms** using React `useOptimistic`, rolling back only on server error.
4. **CSS Containment:** Keep `.contain-calendar-grid` applied to avoid repainting 3,000 table cells on mouse scroll.

---

## 3. Upgrade Specifications & Implementation Code

### Upgrade 1: Middleware In-Memory LRU Tenant Cache (`web/src/middleware.ts`)

#### Objective
Currently, middleware evaluates hostname patterns, cookies, and async lookups on every request, adding 40–120ms to TTFB. This upgrade implements an in-memory LRU cache with a 15-minute TTL.

#### Implementation
```ts
// In web/src/middleware.ts (Add LRU cache at file scope)
import { LRUCache } from "lru-cache";

interface CachedTenant {
  propertyId: string;
  slug: string;
  isFlagship: boolean;
}

// In-memory cache surviving across requests in the Node/Edge runtime
const tenantResolutionCache = new LRUCache<string, CachedTenant>({
  max: 500, // Up to 500 hostnames/tenants
  ttl: 1000 * 60 * 15, // 15 minutes TTL
});

export function resolveTenantWithCache(hostname: string): CachedTenant | null {
  const cached = tenantResolutionCache.get(hostname);
  if (cached) return cached;
  return null;
}

export function setCachedTenant(hostname: string, data: CachedTenant): void {
  tenantResolutionCache.set(hostname, data);
}
```

---

### Upgrade 2: Next.js Compiler & Bundle Optimization (`web/next.config.ts`)

#### Objective
Prevent tree-shaking failures and reduce initial bundle size by modularizing heavy packages (`lucide-react`, `date-fns`, `recharts`, `@radix-ui`).

#### Implementation
Update `web/next.config.ts` to include:
```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    optimizePackageImports: [
      "lucide-react",
      "@radix-ui/react-icons",
      "date-fns",
      "recharts",
      "@tanstack/react-table",
      "framer-motion",
    ],
  },
  compiler: {
    removeConsole: process.env.NODE_ENV === "production" ? { exclude: ["error", "warn"] } : false,
  },
  images: {
    loader: "custom",
    loaderFile: "./src/lib/cloudinary-loader.ts",
    deviceSizes: [640, 750, 828, 1080, 1200, 1440, 1920, 2048],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    qualities: [75, 85, 90],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
      },
    ],
  },
  // Keep existing redirects and rewrites...
};

export default nextConfig;
```

---

### Upgrade 3: Calendar Rack CSS Containment & 60 FPS Acrylic (`web/src/app/globals.css`)

#### Objective
When front-desk agents scroll through 100+ rooms across 30 days, browser recalculates styles for the entire page. Containment isolates layout calculations to the calendar container.

#### Implementation
Add to `web/src/app/globals.css`:
```css
/* =========================================================================
   Enterprise Performance: Layout Containment & Hardware Compositing
   ========================================================================= */

/* Isolates the heavy calendar room grid from full DOM reflows */
.contain-calendar-grid {
  contain: layout style paint;
  content-visibility: auto;
  contain-intrinsic-size: 1000px 600px;
}

/* GPU-accelerated Cold Glass for ERP Dialogs and Floating Sheets */
.erp-cold-glass {
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: inset 0 1px 1px 0 rgba(255, 255, 255, 0.12), 0 12px 36px 0 rgba(0, 0, 0, 0.3);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  transform: translateZ(0);
  will-change: transform;
}

/* Hard disable blur when user enables battery-saver or reduced transparency */
@media (prefers-reduced-transparency: reduce) {
  .erp-cold-glass {
    backdrop-filter: none !important;
    -webkit-backdrop-filter: none !important;
    background: var(--paper-0) !important;
  }
}
```

---

### Upgrade 4: High-Performance Database Indexes (`supabase/migrations/`)

#### Objective
Front-desk calendar lookups and folio calculations currently perform sequential scans when properties accumulate thousands of stays.

#### Implementation
Create a new migration file: `supabase/migrations/20261102_enterprise_perf_indexes.sql`:
```sql
-- 1. Accelerates Front Desk Calendar Rack (stays by property and date window)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_stays_perf_timeline
ON stays (property_id, check_in_date, check_out_date, status);

-- 2. Accelerates Folio calculation and StayHub Balance lookups
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_folio_charges_perf_stay
ON folio_charges (stay_id, is_voided, created_at DESC);

-- 3. Accelerates Room Rack category lookups
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_rooms_property_category
ON rooms (property_id, category_id, is_active);

-- 4. Accelerates Guest search by phone and passport (Ctrl+K omnibar)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_guests_search_composite
ON guests (property_id, phone, passport_number);
```

---

### Upgrade 5: Durable Background Job Queue (`pg-boss`)

#### Objective
Replace raw shell cron executions (`supabase/scripts/droplet-desk-cron.sh`) with a durable, Postgres-backed queue that handles automatic retries, backoff, and failure alerts.

#### Implementation
1. **Install dependency**:
   ```bash
   pnpm --dir web add pg-boss
   ```
2. **Boss Client Singleton (`web/src/lib/jobs/boss-client.ts`)**:
   ```ts
   import PgBoss from "pg-boss";

   let bossInstance: PgBoss | null = null;

   export async function getJobQueue(): Promise<PgBoss> {
     if (bossInstance) return bossInstance;

     const connectionString = process.env.DATABASE_URL || process.env.SUPABASE_INTERNAL_URL;
     if (!connectionString) {
       throw new Error("Missing DATABASE_URL for pg-boss job queue");
     }

     bossInstance = new PgBoss({
       connectionString,
       schema: "pgboss",
       max: 10,
     });

     bossInstance.on("error", (error) => console.error("[PgBoss Error]", error));
     await bossInstance.start();
     return bossInstance;
   }
   ```
3. **Night Audit Worker (`web/src/lib/jobs/workers/night-audit-worker.ts`)**:
   ```ts
   import { getJobQueue } from "../boss-client";
   import { runNightAuditForProperty } from "@/lib/night-audit/roll";

   export async function registerNightAuditWorker() {
     const boss = await getJobQueue();

     await boss.work("run-night-audit", { teamSize: 2 }, async ([job]) => {
       const { propertyId, businessDate } = job.data as { propertyId: string; businessDate: string };
       console.log(`[NightAuditWorker] Executing night audit for ${propertyId} on ${businessDate}`);

       const result = await runNightAuditForProperty(propertyId, businessDate);
       if (!result.success) {
         throw new Error(`Night audit failed: ${result.error}`);
       }
       return result;
     });
   }
   ```

---

## 3. Cursor Execution Instructions

When running this upgrade in Cursor:
1. First, update `web/next.config.ts` and `web/src/app/globals.css`.
2. Generate the Postgres index migration under `supabase/migrations/`.
3. Implement `lru-cache` in `web/src/middleware.ts`.
4. Run `pnpm --dir web run typecheck` to verify zero type diagnostics.
5. Run `pnpm --dir web run test:e2e:smoke` to ensure no regression on money or booking routes.
