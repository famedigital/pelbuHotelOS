# Zero-Superficial Code Specification — Code 0 Standards

> **Audience:** AI Coding Agents (Cursor, Claude, GLM, Composer) & Human Engineers.  
> **Mandate:** Never write placeholder code, stub logic, or superficial UI. Every single line of code written to this repository must be production-ready, fully wired from Database $\rightarrow$ API $\rightarrow$ State $\rightarrow$ UI from Ground Zero ("Code 0").

---

## 1. The 7 Banned Superficial Anti-Patterns

If Cursor generates ANY of the following, the implementation is considered **failed and rejected**:

| # | Anti-Pattern | Why it Breaks the Project | Required "Code 0" Standard |
|---|---|---|---|
| 1 | **Placeholder Stubs** (`// TODO: implement later`, `// add your logic here`) | Leaves broken user flows; requires human rewrites. | Implement the complete, working logic immediately. If blocked by missing credentials/APIs, return an explicit typed domain error (`{ success: false, error: "DRC_GATEWAY_NOT_CONFIGURED" }`). |
| 2 | **Faked Mock Data in Production Views** (`const dummyStays = [...]`) | Disconnects the UI from Postgres, giving a false sense of completion while DB money/folio drift occurs. | Bind directly to the live Supabase query/action. Create a proper empty state component (`<EmptyState icon={Bed} title="No active stays" ... />`) when data is empty. |
| 3 | **Silent Catch Blocks** (`catch (e) {}` or `catch (e) { console.log(e) }`) | Swallows money, booking, and network errors silently, causing ghost bugs that are impossible to trace. | Catch specific errors, log structured context (`console.error('[StayCheckoutError]', { stayId, error })`), and return typed user-actionable error messages. |
| 4 | **Phantom Columns / Hallucinated Schemas** | Writing `supabase.from('stays').insert({ guest_wifi_password })` when the column does not exist in `supabase/migrations/`. | Always inspect the migration files or database types before writing queries. Never invent DB columns. |
| 5 | **Loose Multi-Step Server Actions** (Fake Transactions) | Doing 3 sequential `await supabase.from(...).update(...)` calls without an atomic DB transaction. If step 2 fails, data is corrupted. | Wrap multi-table state mutations in an atomic PostgreSQL stored procedure (`plpgsql`) or transactional RPC with row-level locks. |
| 6 | **Unbounded Optimistic UI** | Updating the client state without a rollback mechanism when the backend server action fails. | Always wrap mutations in `useTransition` or `useOptimistic` with an explicit `try/catch` that reverts state and toasts the user via `sonner`. |
| 7 | **`any` Type Escapes** | Casting variables with `as any` or `any[]` to silence TypeScript errors. | Write strict TypeScript interfaces and Zod schemas for every payload, param, and database record. |

---

## 2. The "Code 0" Full-Stack Pipeline (Ground Zero to Complete)

Whenever Cursor creates or edits a feature, it must implement **all 4 tiers** in the same pass:

```
┌────────────────────────────────────────────────────────┐
│ 1. POSTGRES TIER (supabase/migrations/)                │
│    - Table with RLS enabled                            │
│    - Composite indexes on query paths                  │
│    - Atomic PL/pgSQL function with row lock (if money) │
├────────────────────────────────────────────────────────┤
│ 2. SCHEMA & VALIDATION TIER (web/src/lib/schemas/)     │
│    - Strict Zod schema for input validation            │
│    - Idempotency key requirement (if mutation)         │
├────────────────────────────────────────────────────────┤
│ 3. SERVER ACTION TIER (web/src/app/actions/)           │
│    - Authenticated session verification                │
│    - Strict tenant assertion (property_id check)       │
│    - Safe execution + structured error returns         │
├────────────────────────────────────────────────────────┤
│ 4. PRESENTATIONAL & UI TIER (web/src/components/)      │
│    - Loading / pending state (Skeleton UI)             │
│    - Error boundary / toast notification (Sonner)      │
│    - Accessible empty state                            │
│    - Zero framerate drop (GPU-composited CSS)          │
└────────────────────────────────────────────────────────┘
```

---

## 3. Reference Implementation: The Zero-Superficial Pattern

When creating or modifying a business flow (e.g. posting a folio charge), follow this exact structure:

### Tier 1 & 2: Server Action (`web/src/app/actions/folio-charge.ts`)
```ts
"use server";

import { z } from "zod";
import { getDeskSession } from "@/lib/auth/desk-session";
import { createClient } from "@/lib/supabase/server";

// 1. Strict Input Schema
const PostChargeSchema = z.object({
  propertyId: z.string().uuid(),
  stayId: z.string().uuid(),
  amount: z.number().positive("Amount must be greater than zero"),
  description: z.string().min(2, "Description required"),
  department: z.enum(["fnb", "laundry", "minibar", "misc"]),
  idempotencyKey: z.string().uuid("Valid idempotency key required"),
});

export type PostChargeInput = z.infer<typeof PostChargeSchema>;

export type PostChargeResult =
  | { success: true; chargeId: string; newFolioBalance: number }
  | { success: false; error: string; code: "UNAUTHORIZED" | "CONCURRENCY_LOCK" | "INVALID_INPUT" | "DB_ERROR" };

export async function postFolioChargeAction(input: PostChargeInput): Promise<PostChargeResult> {
  // 2. Validate input
  const parsed = PostChargeSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message, code: "INVALID_INPUT" };
  }

  // 3. Authenticate and enforce Tenant Isolation
  const session = await getDeskSession();
  if (!session || session.propertyId !== parsed.data.propertyId) {
    return { success: false, error: "Unauthorized access to property", code: "UNAUTHORIZED" };
  }

  const supabase = await createClient();

  // 4. Execute via Atomic Postgres RPC (Locks row, enforces idempotency, updates ledger)
  const { data, error } = await supabase.rpc("post_folio_charge_atomic", {
    p_property_id: parsed.data.propertyId,
    p_stay_id: parsed.data.stayId,
    p_amount: parsed.data.amount,
    p_description: parsed.data.description,
    p_department: parsed.data.department,
    p_idempotency_key: parsed.data.idempotencyKey,
  });

  if (error) {
    console.error("[postFolioChargeAction] Atomic mutation failed:", { error, input: parsed.data });
    return { success: false, error: error.message || "Failed to post charge to folio", code: "DB_ERROR" };
  }

  return {
    success: true,
    chargeId: data.charge_id,
    newFolioBalance: data.new_balance,
  };
}
```

### Tier 3: Client Component with Real Feedback & Rollback (`web/src/components/erp/PostChargeModal.tsx`)
```tsx
"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { postFolioChargeAction } from "@/app/actions/folio-charge";

interface PostChargeModalProps {
  propertyId: string;
  stayId: string;
  onChargeSuccess: (newBalance: number) => void;
  onClose: () => void;
}

export function PostChargeModal({ propertyId, stayId, onChargeSuccess, onClose }: PostChargeModalProps) {
  const [isPending, startTransition] = useTransition();
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [department, setDepartment] = useState<"fnb" | "laundry" | "minibar" | "misc">("fnb");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      toast.error("Please enter a valid positive amount");
      return;
    }

    // Client-side UUID for idempotency
    const idempotencyKey = crypto.randomUUID();

    startTransition(async () => {
      const res = await postFolioChargeAction({
        propertyId,
        stayId,
        amount: numAmount,
        description,
        department,
        idempotencyKey,
      });

      if (!res.success) {
        toast.error(`Error: ${res.error}`);
        return;
      }

      toast.success("Charge posted successfully to folio");
      onChargeSuccess(res.newFolioBalance);
      onClose();
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Real form fields, disabled while isPending, with instant feedback */}
      <input
        type="number"
        step="0.01"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        placeholder="Amount (BTN)"
        disabled={isPending}
        required
        className="w-full rounded-md border p-2 text-sm"
      />
      <input
        type="text"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Item description (e.g. Dinner for 2)"
        disabled={isPending}
        required
        className="w-full rounded-md border p-2 text-sm"
      />
      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-md bg-primary py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {isPending ? "Posting to Folio..." : "Confirm & Post"}
      </button>
    </form>
  );
}
```

---

## 4. Cursor's Pre-Completion Verification Checklist

Before reporting ANY code task as complete, Cursor must mentally or programmatically check:

1. [ ] **No Placeholders:** Are all functions fully implemented with zero `// TODO` stubs?
2. [ ] **Strict Typing:** Are there zero `any` types, zero unused imports, and zero TypeScript compiler warnings?
3. [ ] **Tenant Scoped:** Does every single database operation verify and isolate `property_id`?
4. [ ] **UI States Complete:** Does the UI handle all 4 states: **Loading**, **Empty**, **Active Data**, and **Error**?
5. [ ] **Performance Verified:** Does the component avoid heavy continuous un-cached re-renders and unnecessary CSS blur filters on large grids?
