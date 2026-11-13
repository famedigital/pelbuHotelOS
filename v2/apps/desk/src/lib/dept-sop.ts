/**
 * Property department SOP — flexible shift times + Simple rail.
 * Defaults seeded from pelbu-suites-a4-department-guidelines.html (editable).
 */
import { z } from "zod";

const timeSchema = z.string().regex(/^\d{2}:\d{2}$/);

export const FoShiftSchema = z.object({
  id: z.enum(["night", "morning", "evening"]),
  label: z.string(),
  start: timeSchema,
  end: timeSchema,
});

export const DeptSopSchema = z.object({
  bufferMinutes: z.number().int().min(0).max(180).default(60),
  foShifts: z.array(FoShiftSchema).min(1),
  opsLeadRhythm: z.array(
    z.object({
      id: z.string(),
      time: timeSchema,
      label: z.string(),
      protocol: z.string(),
    }),
  ),
  kitchenWindows: z.array(
    z.object({
      id: z.string(),
      start: timeSchema,
      end: timeSchema,
      label: z.string(),
      duties: z.string(),
    }),
  ),
  reservationsHours: z.object({ start: timeSchema, end: timeSchema }),
  checklists: z.record(z.string(), z.array(z.string())),
});

export type DeptSop = z.infer<typeof DeptSopSchema>;

/** Charter defaults — property Settings can override clocks. */
export const DEFAULT_DEPT_SOP: DeptSop = {
  bufferMinutes: 60,
  foShifts: [
    { id: "night", label: "Night Shift", start: "21:00", end: "08:00" },
    { id: "morning", label: "Morning Shift", start: "07:00", end: "16:00" },
    { id: "evening", label: "Evening Shift", start: "15:00", end: "22:00" },
  ],
  opsLeadRhythm: [
    {
      id: "walkthrough",
      time: "08:30",
      label: "Morning Walkthrough",
      protocol: "Breakfast pass, lobby, morning departures",
    },
    {
      id: "owner_brief",
      time: "09:30",
      label: "Owner Briefing",
      protocol: "Yesterday revenue · today's arrivals · staff issues",
    },
    {
      id: "lunch_check",
      time: "11:30",
      label: "Lunch Handover Check",
      protocol: "Kitchen staffed and lunch cooking",
    },
    {
      id: "sobriety",
      time: "17:30",
      label: "Pre-Dinner Check",
      protocol: "Kitchen and dining readiness",
    },
    {
      id: "night_handover",
      time: "21:00",
      label: "Night Taking-Over",
      protocol: "Buffer + cash count with night desk",
    },
  ],
  kitchenWindows: [
    {
      id: "shift_a",
      start: "06:00",
      end: "14:30",
      label: "Morning + Lunch",
      duties: "Breakfast boxes, buffet, active lunch",
    },
    {
      id: "shift_b",
      start: "11:30",
      end: "20:30",
      label: "Lunch + Dinner",
      duties: "Lunch handover, dinner mise, dinner service",
    },
  ],
  reservationsHours: { start: "09:00", end: "18:00" },
  checklists: {
    fo: [
      "Count cashier till with incoming staff",
      "Review pending arrivals and room assignments",
      "Verify breakfast / packed-box counts for kitchen",
      "Hand over open guest requests and VIP notes",
      "Sign handover register before departing",
    ],
    reservations: [
      "Pending agent emails and change requests",
      "Holds expiring today",
      "Unassigned room lines for tomorrow",
      "Agent dues / statement follow-ups",
    ],
    hk: [
      "Dirty / clean / OOO room counts",
      "Priority turnovers for next arrivals",
      "Linen and public-area status",
      "Rollaway / bunk sheet needs",
    ],
    fnb: [
      "Open checks and pending KOTs",
      "86 list communicated",
      "Shift sales and float",
      "Post room charges within policy window",
    ],
    kitchen: [
      "Next meal window staffed",
      "Pass ready / hygiene check",
      "Market requisitions submitted if needed",
      "Dietary notes from FO received",
    ],
    stores: [
      "Open AP / pending GRNs",
      "Par breaches",
      "Today receipts filed",
    ],
    owner: [
      "Till / cash position",
      "Income vs dues glance",
      "Open bank recon lines",
      "Dept briefings filed for the day",
    ],
  },
};

const SOP_STORAGE_KEY = "hos.v2.deptSop";

export function loadDeptSop(): DeptSop {
  if (typeof localStorage === "undefined") return DEFAULT_DEPT_SOP;
  try {
    const raw = localStorage.getItem(SOP_STORAGE_KEY);
    if (!raw) return DEFAULT_DEPT_SOP;
    const parsed = DeptSopSchema.safeParse({
      ...DEFAULT_DEPT_SOP,
      ...JSON.parse(raw),
    });
    return parsed.success ? parsed.data : DEFAULT_DEPT_SOP;
  } catch {
    return DEFAULT_DEPT_SOP;
  }
}

export function saveDeptSop(patch: Partial<DeptSop>): DeptSop {
  const next = DeptSopSchema.parse({ ...loadDeptSop(), ...patch });
  localStorage.setItem(SOP_STORAGE_KEY, JSON.stringify(next));
  return next;
}

export {
  homeRouteForDeskRole,
  simpleRailItems,
} from "@hos-v2/domain";

const NAV_PRO_KEY = "hos_nav_pro";

export function readNavPro(): boolean {
  if (typeof localStorage === "undefined") return false;
  return localStorage.getItem(NAV_PRO_KEY) === "1";
}

export function writeNavPro(on: boolean): void {
  localStorage.setItem(NAV_PRO_KEY, on ? "1" : "0");
}

export type BriefingDept =
  | "fo"
  | "reservations"
  | "hk"
  | "fnb"
  | "kitchen"
  | "stores"
  | "owner";

export function briefingDeptForRole(deskRole: string | null | undefined): BriefingDept {
  const role = String(deskRole ?? "").toLowerCase();
  if (role.includes("kitchen") || role.includes("chef") || role.includes("cook"))
    return "kitchen";
  if (role.includes("waiter") || role.includes("fnb") || role.includes("cashier"))
    return "fnb";
  if (role.includes("hk") || role.includes("house")) return "hk";
  if (role.includes("store") || role.includes("purchase")) return "stores";
  if (role.includes("sales") || role.includes("reserv")) return "reservations";
  if (role.includes("owner") || role.includes("gm") || role.includes("account"))
    return "owner";
  return "fo";
}
