/**
 * Standalone field / partner portal sessions — PIN gate outside desk chrome.
 * Demo PINs are intentional for desk simulation; production uses property ACLs.
 */
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { useCommercialStore } from "./commercial-store";

export type FieldPortalRole = "partner" | "guide" | "driver";

export type FieldPortalSession = {
  role: FieldPortalRole;
  displayName: string;
  code: string;
  /** Partner → commercial agent id; guide/driver → group id scope (or *). */
  subjectId: string;
  unlockedAt: string;
};

type Cred = {
  role: FieldPortalRole;
  code: string;
  pin: string;
  displayName: string;
  subjectId: string;
};

const STATIC_CREDS: Cred[] = [
  {
    role: "guide",
    code: "GUIDE",
    pin: "4455",
    displayName: "Tour Guide",
    subjectId: "*",
  },
  {
    role: "driver",
    code: "DRIVER",
    pin: "5566",
    displayName: "Fleet Driver",
    subjectId: "*",
  },
];

function partnerCreds(): Cred[] {
  return useCommercialStore.getState().agents.map((a) => ({
    role: "partner" as const,
    code: a.code.toUpperCase(),
    pin: a.code === "YAP" ? "1111" : a.code === "DA" ? "2222" : "3333",
    displayName: a.name,
    subjectId: a.id,
  }));
}

function allCreds(): Cred[] {
  return [...partnerCreds(), ...STATIC_CREDS];
}

type FieldAuthState = {
  sessions: Partial<Record<FieldPortalRole, FieldPortalSession>>;
  unlock: (
    role: FieldPortalRole,
    code: string,
    pin: string,
  ) => { ok: true; session: FieldPortalSession } | { ok: false; error: string };
  lock: (role: FieldPortalRole) => void;
  sessionFor: (role: FieldPortalRole) => FieldPortalSession | null;
};

export const useFieldPortalAuth = create<FieldAuthState>()(
  persist(
    (set, get) => ({
      sessions: {},

      unlock: (role, code, pin) => {
        const c = code.trim().toUpperCase();
        const p = pin.trim();
        if (!c || p.length < 4) {
          return { ok: false, error: "Enter portal code and 4–8 digit PIN" };
        }
        const hit = allCreds().find(
          (x) => x.role === role && x.code === c && x.pin === p,
        );
        if (!hit) {
          return { ok: false, error: "Incorrect code or PIN" };
        }
        const session: FieldPortalSession = {
          role,
          displayName: hit.displayName,
          code: hit.code,
          subjectId: hit.subjectId,
          unlockedAt: new Date().toISOString(),
        };
        set((s) => ({ sessions: { ...s.sessions, [role]: session } }));
        return { ok: true, session };
      },

      lock: (role) =>
        set((s) => {
          const next = { ...s.sessions };
          delete next[role];
          return { sessions: next };
        }),

      sessionFor: (role) => get().sessions[role] ?? null,
    }),
    { name: "hos-v2-field-portal-auth" },
  ),
);

export function isFieldPortalPath(pathname: string): boolean {
  return (
    pathname === "/partner" ||
    pathname === "/guide" ||
    pathname === "/driver" ||
    pathname === "/ecosystem/guide" ||
    pathname === "/ecosystem/driver"
  );
}

export function fieldRoleFromPath(pathname: string): FieldPortalRole | null {
  if (pathname === "/partner") return "partner";
  if (pathname === "/guide" || pathname === "/ecosystem/guide") return "guide";
  if (pathname === "/driver" || pathname === "/ecosystem/driver") return "driver";
  return null;
}

export const FIELD_DEMO_HINTS: Record<
  FieldPortalRole,
  { code: string; pin: string; label: string }
> = {
  partner: { code: "YAP", pin: "1111", label: "Yangphel owner" },
  guide: { code: "GUIDE", pin: "4455", label: "Tour guide" },
  driver: { code: "DRIVER", pin: "5566", label: "Fleet driver" },
};
