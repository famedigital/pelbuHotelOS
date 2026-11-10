/**
 * Natural-language action dispatcher (⌘J) — maps desk phrases to FO ops.
 * Deterministic pattern match only (no LLM) for sub-20ms desk latency.
 */

import {
  useFrontOfficeStore,
  ymd,
  type FolioLineKind,
  type MealPlan,
  type Stay,
} from "./front-office-store";
import { useFiscalStore } from "./fiscal-store";

export type DispatchIntent =
  | { kind: "navigate"; path: string; label: string }
  | { kind: "fast_book"; label: string }
  | { kind: "smart_assign"; label: string }
  | { kind: "check_in"; stayId: string; label: string }
  | { kind: "check_out"; stayId: string; label: string }
  | { kind: "open_stay"; stayId: string; label: string }
  | {
      kind: "extend_stay";
      stayId: string;
      nights: number;
      mealPlan?: MealPlan;
      label: string;
    }
  | {
      kind: "post_charge";
      stayId: string;
      amount: number;
      chargeKind: FolioLineKind;
      description: string;
      label: string;
    }
  | {
      kind: "assign_group_floor";
      groupToken: string;
      floor: number;
      label: string;
    }
  | { kind: "night_audit"; label: string }
  | { kind: "export_manifest"; label: string }
  | { kind: "export_bst3"; label: string }
  | { kind: "unknown"; label: string; hint: string };

export type DispatchResult = {
  intent: DispatchIntent;
  confidence: number;
  preview: string;
};

function normalize(q: string): string {
  return q.trim().toLowerCase().replace(/\s+/g, " ");
}

function findStayByToken(token: string): Stay | undefined {
  const fo = useFrontOfficeStore.getState();
  const q = token.toLowerCase();
  if (!q) return undefined;
  const scored = fo.stays
    .map((s) => {
      let score = 0;
      if (s.guestName.toLowerCase().includes(q)) score += 3;
      if (s.confirmationNo.toLowerCase().includes(q)) score += 4;
      if ((s.roomNumber ?? "").toLowerCase() === q) score += 5;
      if ((s.roomNumber ?? "").toLowerCase().includes(q)) score += 2;
      return { s, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);
  return scored[0]?.s;
}

/** Parse a natural-language desk phrase into a single actionable intent. */
export function parseDeskAction(raw: string): DispatchResult {
  const q = normalize(raw);
  if (!q) {
    return {
      intent: {
        kind: "unknown",
        label: "Empty",
        hint: "Try: check in 301 · assign rooms · night audit · export police",
      },
      confidence: 0,
      preview: "Type an action…",
    };
  }

  if (
    /^(fast\s*book|new\s*booking|walk[\s-]?in|book\s)/.test(q) ||
    q === "book"
  ) {
    return {
      intent: { kind: "fast_book", label: "Open Fast Book" },
      confidence: 0.95,
      preview: "Open Fast Book wizard",
    };
  }

  if (
    /(smart\s*)?(auto[-\s]?assign|assign\s+rooms?|tetris)/.test(q)
  ) {
    return {
      intent: { kind: "smart_assign", label: "Smart Auto-Assign" },
      confidence: 0.92,
      preview: "Tetris-assign unassigned arrivals (VIP floor 3 · group cluster)",
    };
  }

  if (/(night\s*audit|run\s*audit|close\s*(the\s*)?day|rollover)/.test(q)) {
    return {
      intent: { kind: "night_audit", label: "Night Audit" },
      confidence: 0.9,
      preview: "Open autonomous night audit cockpit",
    };
  }

  if (/(export\s*)?(police|tourist)\s*manifest|immigration\s*csv/.test(q)) {
    return {
      intent: { kind: "export_manifest", label: "Police Manifest" },
      confidence: 0.9,
      preview: "Download tourist police / immigration CSV",
    };
  }

  if (/(export\s*)?bst[\s-]?3|drc\s*return/.test(q)) {
    return {
      intent: { kind: "export_bst3", label: "BST-3 Return" },
      confidence: 0.9,
      preview: "Download DRC Form BST-3 CSV pack",
    };
  }

  /* Extend Karma in 204 by 2 nights MAP */
  const extendMatch = q.match(
    /extend\s+(.+?)\s+by\s+(\d+)\s*nights?(?:\s+(ep|cp|map|ap))?/,
  );
  if (extendMatch) {
    const token = extendMatch[1]!.trim();
    const nights = Number(extendMatch[2]);
    const mealRaw = extendMatch[3]?.toUpperCase() as MealPlan | undefined;
    const stay = findStayByToken(token);
    if (stay && nights > 0 && nights <= 30) {
      return {
        intent: {
          kind: "extend_stay",
          stayId: stay.id,
          nights,
          mealPlan: mealRaw,
          label: `Extend ${stay.guestName} +${nights}N${mealRaw ? ` ${mealRaw}` : ""}`,
        },
        confidence: 0.9,
        preview: `${stay.guestName} · Rm ${stay.roomNumber ?? "—"} · +${nights} night(s)`,
      };
    }
    return {
      intent: {
        kind: "unknown",
        label: "Extend failed",
        hint: stay
          ? "Nights must be 1–30"
          : `No stay matched “${token}”`,
      },
      confidence: 0.35,
      preview: "Could not build extend intent",
    };
  }

  /* Post laundry 450 to rm 102 */
  const postMatch = q.match(
    /post\s+(laundry|minibar|fb|room)?\s*(\d+(?:\.\d+)?)\s+to\s+(?:rm\s*|room\s*)?(.+)/,
  );
  if (postMatch) {
    const kindRaw = (postMatch[1] ?? "laundry").toLowerCase();
    const amount = Number(postMatch[2]);
    const token = postMatch[3]!.trim();
    const stay = findStayByToken(token);
    const chargeKind: FolioLineKind =
      kindRaw === "fb"
        ? "fb"
        : kindRaw === "minibar"
          ? "minibar"
          : kindRaw === "room"
            ? "room"
            : "laundry";
    if (stay && amount > 0) {
      const desc =
        chargeKind === "laundry"
          ? "Laundry"
          : chargeKind === "minibar"
            ? "Minibar"
            : chargeKind === "fb"
              ? "F&B"
              : "Room charge";
      return {
        intent: {
          kind: "post_charge",
          stayId: stay.id,
          amount,
          chargeKind,
          description: desc,
          label: `Post ${desc} Nu. ${amount} → ${stay.guestName}`,
        },
        confidence: 0.88,
        preview: `${stay.guestName} · Rm ${stay.roomNumber ?? "—"} · ${desc} ${amount}`,
      };
    }
  }

  /* Assign Yangphel to Floor 2 */
  const floorAssign = q.match(
    /assign\s+(.+?)\s+to\s+floor\s+(\d+)/,
  );
  if (floorAssign) {
    const groupToken = floorAssign[1]!.trim();
    const floor = Number(floorAssign[2]);
    if (floor >= 1 && floor <= 8) {
      return {
        intent: {
          kind: "assign_group_floor",
          groupToken,
          floor,
          label: `Assign ${groupToken} → Floor ${floor}`,
        },
        confidence: 0.87,
        preview: `Cluster “${groupToken}” onto vacant rooms on floor ${floor}`,
      };
    }
  }

  const navMap: Array<{ re: RegExp; path: string; label: string }> = [
    { re: /\b(desk|today|mission)\b/, path: "/desk", label: "Desk" },
    { re: /\bstay\s*view|rack\b/, path: "/stayview", label: "StayView" },
    { re: /\bpos\b|till\b/, path: "/pos", label: "POS" },
    { re: /\bkds\b|kitchen\b/, path: "/kds", label: "KDS" },
    { re: /\bhk\b|house\s*keep/, path: "/housekeeping", label: "Housekeeping" },
    { re: /\bcompliance\b/, path: "/compliance", label: "Compliance" },
    { re: /\breports?\b/, path: "/reports", label: "Reports" },
    { re: /\bagents?\b|b2b\b/, path: "/agents", label: "Agents" },
  ];
  /* Prefer navigation for “open stayview” etc. before guest stay lookup. */
  for (const n of navMap) {
    if (
      n.re.test(q) &&
      (/^(go\s+to|open|show|jump)\b/.test(q) ||
        q === n.label.toLowerCase() ||
        q === n.path.slice(1))
    ) {
      return {
        intent: { kind: "navigate", path: n.path, label: `Go to ${n.label}` },
        confidence: 0.92,
        preview: `Navigate → ${n.label}`,
      };
    }
  }

  const checkInMatch = q.match(
    /(?:check[\s-]?in|ci)\s+(?:guest\s+)?(.+)|(?:check[\s-]?in)\s+#?(\d{2,4})/,
  );
  if (checkInMatch) {
    const token = (checkInMatch[1] ?? checkInMatch[2] ?? "").trim();
    const stay = findStayByToken(token);
    if (stay) {
      return {
        intent: {
          kind: "check_in",
          stayId: stay.id,
          label: `Check in ${stay.guestName}`,
        },
        confidence: 0.85,
        preview: `${stay.guestName} · ${stay.roomNumber ?? "no room"} · ${stay.confirmationNo}`,
      };
    }
    return {
      intent: {
        kind: "unknown",
        label: "Guest not found",
        hint: `No stay matched “${token}”`,
      },
      confidence: 0.4,
      preview: `Could not resolve check-in target “${token}”`,
    };
  }

  const checkOutMatch = q.match(
    /(?:check[\s-]?out|co)\s+(?:guest\s+)?(.+)|(?:check[\s-]?out)\s+#?(\d{2,4})/,
  );
  if (checkOutMatch) {
    const token = (checkOutMatch[1] ?? checkOutMatch[2] ?? "").trim();
    const stay = findStayByToken(token);
    if (stay) {
      return {
        intent: {
          kind: "check_out",
          stayId: stay.id,
          label: `Check out ${stay.guestName}`,
        },
        confidence: 0.85,
        preview: `${stay.guestName} · ${stay.roomNumber ?? "—"} · folio open`,
      };
    }
  }

  const openMatch = q.match(
    /(?:open|folio|stay|hub)\s+(?:for\s+)?(.+)/,
  );
  if (openMatch) {
    const stay = findStayByToken(openMatch[1]!.trim());
    if (stay) {
      return {
        intent: {
          kind: "open_stay",
          stayId: stay.id,
          label: `Open ${stay.guestName}`,
        },
        confidence: 0.8,
        preview: `StayHub · ${stay.confirmationNo}`,
      };
    }
  }

  /* Bare room / guest → open stay */
  const bare = findStayByToken(q);
  if (bare && q.length >= 2) {
    return {
      intent: {
        kind: "open_stay",
        stayId: bare.id,
        label: `Open ${bare.guestName}`,
      },
      confidence: 0.7,
      preview: `${bare.guestName} · Rm ${bare.roomNumber ?? "—"}`,
    };
  }

  for (const n of navMap) {
    if (n.re.test(q)) {
      return {
        intent: { kind: "navigate", path: n.path, label: `Go to ${n.label}` },
        confidence: 0.65,
        preview: `Navigate → ${n.label}`,
      };
    }
  }

  return {
    intent: {
      kind: "unknown",
      label: "Unrecognized",
        hint: "Examples: check in 301 · extend Karma by 2 nights MAP · post laundry 450 to 102 · assign Yangphel to Floor 2",
    },
    confidence: 0.1,
    preview: `No action for “${raw.trim()}”`,
  };
}

export type ExecuteContext = {
  navigate: (path: string) => void;
  openFastBook: () => void;
  exportPoliceManifest: () => void;
  exportBst3: () => void;
};

export async function executeDeskAction(
  intent: DispatchIntent,
  ctx: ExecuteContext,
): Promise<{ ok: true; message: string } | { ok: false; error: string }> {
  const fo = useFrontOfficeStore.getState();

  switch (intent.kind) {
    case "navigate":
      ctx.navigate(intent.path);
      return { ok: true, message: intent.label };
    case "fast_book":
      ctx.openFastBook();
      return { ok: true, message: "Fast Book opened" };
    case "smart_assign": {
      const res = await fo.smartAutoAssign();
      if (res.assigned === 0 && res.conflicts.length) {
        return {
          ok: false,
          error: res.conflicts.slice(0, 2).join(" · "),
        };
      }
      return {
        ok: true,
        message: `Assigned ${res.assigned}${res.conflicts.length ? ` · ${res.conflicts.length} left` : ""}`,
      };
    }
    case "check_in": {
      const res = await fo.checkIn(intent.stayId);
      return res.ok
        ? { ok: true, message: intent.label }
        : { ok: false, error: res.error };
    }
    case "check_out": {
      const res = await fo.checkOut(intent.stayId);
      return res.ok
        ? { ok: true, message: intent.label }
        : { ok: false, error: res.error };
    }
    case "open_stay":
      fo.openStay(intent.stayId);
      return { ok: true, message: intent.label };
    case "extend_stay": {
      const stay = fo.stays.find((s) => s.id === intent.stayId);
      if (!stay) return { ok: false, error: "Stay not found" };
      const base = new Date(`${stay.checkOut}T12:00:00`);
      base.setDate(base.getDate() + intent.nights);
      const newCheckOut = ymd(base);
      const res = await fo.extendStay({
        stayId: intent.stayId,
        newCheckOut,
        actor: "Action Dispatcher",
      });
      if (!res.ok) return { ok: false, error: res.error };
      if (intent.mealPlan) {
        const rate = await fo.updateStayRate(
          intent.stayId,
          { mealPlan: intent.mealPlan },
          "Action Dispatcher",
        );
        if (!rate.ok) return { ok: false, error: rate.error };
      }
      return { ok: true, message: intent.label };
    }
    case "post_charge": {
      const res = await fo.postCharge(
        intent.stayId,
        intent.description,
        intent.amount,
        intent.chargeKind,
        "Action Dispatcher",
      );
      return res.ok
        ? { ok: true, message: intent.label }
        : { ok: false, error: res.error };
    }
    case "assign_group_floor": {
      const token = intent.groupToken.toLowerCase();
      const targets = fo.stays.filter(
        (s) =>
          ["confirmed", "held"].includes(s.status) &&
          !s.roomId &&
          ((s.groupName ?? "").toLowerCase().includes(token) ||
            (s.agencyName ?? "").toLowerCase().includes(token) ||
            s.guestName.toLowerCase().includes(token)),
      );
      if (targets.length === 0) {
        return {
          ok: false,
          error: `No unassigned stays matched “${intent.groupToken}”`,
        };
      }
      const vacant = fo.rooms
        .filter(
          (r) =>
            r.floor === intent.floor &&
            r.hkStatus !== "ooo" &&
            !fo.stays.some(
              (s) =>
                s.roomId === r.id &&
                !["cancelled", "no_show", "checked_out"].includes(s.status),
            ),
        )
        .sort((a, b) => a.number.localeCompare(b.number));
      let assigned = 0;
      const conflicts: string[] = [];
      for (const stay of targets) {
        const room = vacant.shift();
        if (!room) {
          conflicts.push(`${stay.guestName}: no vacant room on F${intent.floor}`);
          continue;
        }
        const res = await fo.assignRoom(stay.id, room.id, "Action Dispatcher");
        if (res.ok) assigned += 1;
        else conflicts.push(`${stay.guestName}: ${res.error}`);
      }
      if (assigned === 0) {
        return {
          ok: false,
          error: conflicts.slice(0, 2).join(" · ") || "No rooms assigned",
        };
      }
      return {
        ok: true,
        message: `Assigned ${assigned} on floor ${intent.floor}${
          conflicts.length ? ` · ${conflicts.length} left` : ""
        }`,
      };
    }
    case "night_audit":
      ctx.navigate("/night-audit");
      return { ok: true, message: "Night audit cockpit" };
    case "export_manifest":
      ctx.exportPoliceManifest();
      return { ok: true, message: "Police manifest downloaded" };
    case "export_bst3":
      ctx.exportBst3();
      return { ok: true, message: "BST-3 CSV downloaded" };
    case "unknown":
      return { ok: false, error: intent.hint };
    default: {
      const _exhaustive: never = intent;
      return { ok: false, error: `Unhandled intent ${String(_exhaustive)}` };
    }
  }
}

/** Soft readiness score for night-audit header chip (0–100). */
export function nightAuditReadiness(): {
  score: number;
  blockers: number;
  label: string;
} {
  const checklist = useFiscalStore.getState().buildChecklist();
  const hard = checklist.filter(
    (c) => c.status === "blocked" && c.id !== "arrivals",
  );
  const total = checklist.length;
  const ok = checklist.filter((c) => c.status === "ok").length;
  const score = total ? Math.round((ok / total) * 100) : 100;
  return {
    score,
    blockers: hard.length,
    label:
      hard.length === 0
        ? "Ready to close"
        : `${hard.length} gate${hard.length === 1 ? "" : "s"}`,
  };
}
