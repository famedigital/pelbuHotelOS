import { create } from "zustand";
import { useCommercialStore } from "./commercial-store";
import { useExtrasStore } from "./extras-store";
import {
  addDays,
  stayOnDate,
  ymd,
  type MealPlan,
  useFrontOfficeStore,
} from "./front-office-store";
import { DEMO_MOU_PROPERTY_ID, useMouStore } from "./mou-store";

export type ChangeRequestKind =
  | "guest_name"
  | "rooms"
  | "dates"
  | "meal_plan"
  | "cancel"
  | "postpone"
  | "prepone"
  | "add_room"
  | "reduce_room"
  | "extras"
  | "guide"
  | "driver";
export type ChangeRequestStatus = "pending" | "approved" | "rejected";

export type PortalUserRole = "owner" | "reservations" | "accountant";

export type PortalFacility =
  | "book"
  | "rooming"
  | "changes"
  | "guide_driver"
  | "money"
  | "mou"
  | "calendar"
  | "menu";

export type PortalUser = {
  id: string;
  agentId: string;
  name: string;
  role: PortalUserRole;
  facilities: PortalFacility[];
};

export type PartnerLuggage = {
  count: number;
  color: string;
  description: string;
};

export type PartnerRoomer = {
  id: string;
  leadGuest: string;
  passportOrCid: string;
  nationality: string;
  mealPlan: MealPlan;
  dietary: string;
  companionName?: string;
  luggage?: PartnerLuggage;
  suggestedRoom?: string;
  /** Linked FO stay after group book / rooming submit. */
  linkedStayId?: string;
};

export type RoomingValidationIssue = {
  roomerId: string;
  field: "passportOrCid";
  message: string;
};

export type DepositMatchHint = {
  fiscalDocId: string;
  docNo: string;
  amount: number;
  delta: number;
  bucket: "current" | "d30" | "d60" | "d90";
};

export type MaskedRoomSuggestion = {
  roomerId: string;
  roomNumber: string;
  typeName: string;
};

export type ChangePayload = {
  stayId?: string;
  groupId?: string | null;
  guestFrom?: string;
  guestTo?: string;
  newCheckOut?: string;
  newCheckIn?: string;
  mealPlan?: MealPlan;
  roomsDelta?: number;
  typeCode?: import("./front-office-store").RoomTypeCode;
  extrasNote?: string;
  guideName?: string;
  guidePhone?: string;
  guideLicense?: string;
  driverName?: string;
  driverDormBed?: string;
  vehicleNo?: string;
};

export type PartnerChangeRequest = {
  id: string;
  agentId: string;
  kind: ChangeRequestKind;
  summary: string;
  detail: string;
  status: ChangeRequestStatus;
  submittedAt: string;
  reviewedAt: string | null;
  submittedBy: string;
  submittedByUserId: string | null;
  reviewedBy: string | null;
  stayId: string | null;
  groupId: string | null;
  payload: ChangePayload;
};

export type PartnerDepositSlip = {
  id: string;
  agentId: string;
  amount: number;
  method: "wire" | "mbob";
  ref: string;
  note: string;
  status: "awaiting_desk" | "verified" | "rejected";
  at: string;
  uploadedBy: string;
};

const FACILITY_BY_ROLE: Record<PortalUserRole, PortalFacility[]> = {
  owner: ["book", "rooming", "changes", "guide_driver", "money", "mou", "calendar", "menu"],
  reservations: ["book", "rooming", "changes", "guide_driver", "calendar", "menu", "mou"],
  accountant: ["money", "calendar", "mou"],
};

type PartnerPortalState = {
  sessionAgentId: string;
  sessionPortalUserId: string;
  portalUsers: PortalUser[];
  roomingDraft: PartnerRoomer[];
  changeRequests: PartnerChangeRequest[];
  depositSlips: PartnerDepositSlip[];
  setSessionAgent: (agentId: string) => void;
  setSessionPortalUser: (userId: string) => void;
  currentPortalUser: () => PortalUser | null;
  canPortal: (facility: PortalFacility) => boolean;
  addRoomer: (row: Omit<PartnerRoomer, "id">) => void;
  importRoamingPaste: (text: string) => { ok: true; count: number } | { ok: false; error: string };
  clearRoamingDraft: () => void;
  submitGuestNameChange: (
    guestFrom: string,
    guestTo: string,
    stayId?: string,
  ) => { ok: true; req: PartnerChangeRequest } | { ok: false; error: string };
  submitOpsChange: (
    kind: Exclude<ChangeRequestKind, "guest_name" | "guide" | "driver">,
    summary: string,
    detail: string,
    payload?: ChangePayload,
  ) => { ok: true; req: PartnerChangeRequest } | { ok: false; error: string };
  submitStructuredChange: (input: {
    kind: ChangeRequestKind;
    summary: string;
    detail: string;
    payload: ChangePayload;
  }) => { ok: true; req: PartnerChangeRequest } | { ok: false; error: string };
  updateGuideDriver: (input: {
    groupId: string;
    guideName?: string;
    guidePhone?: string;
    guideLicense?: string;
    driverName?: string;
    driverDormBed?: string;
    vehicleNo?: string;
  }) => { ok: true } | { ok: false; error: string };
  deskReviewChange: (
    id: string,
    decision: "approved" | "rejected",
    reviewer?: string,
  ) => Promise<{ ok: true } | { ok: false; error: string }>;
  uploadDeposit: (input: {
    amount: number;
    method: "wire" | "mbob";
    ref: string;
    note: string;
  }) => { ok: true; slip: PartnerDepositSlip } | { ok: false; error: string };
  verifyDeposit: (
    id: string,
    decision: "verified" | "rejected",
    /** When set (desk Operator 360), credit this agent instead of portal session */
    agentId?: string,
  ) => Promise<{ ok: true } | { ok: false; error: string }>;
  validateRoomingDraft: () => RoomingValidationIssue[];
  suggestRoomsFromMask: () => MaskedRoomSuggestion[];
  suggestDepositMatches: (amount: number) => DepositMatchHint[];
  submitRoomingToDesk: (groupId?: string | null) => Promise<
    | { ok: true; count: number; linked: number }
    | { ok: false; error: string }
  >;
  /** Patch luggage / companion on a draft row. */
  updateRoomer: (
    id: string,
    patch: Partial<
      Pick<
        PartnerRoomer,
        | "leadGuest"
        | "passportOrCid"
        | "nationality"
        | "companionName"
        | "mealPlan"
        | "dietary"
        | "luggage"
      >
    >,
  ) => void;
  bookPartnerGroup: (input: {
    guestName: string;
    typeCode: import("./front-office-store").RoomTypeCode;
    checkIn: string;
    checkOut: string;
    mealPlan: MealPlan;
    roomsCount: number;
    adults?: number;
    nightlyNet?: number;
  }) => Promise<
    | {
        ok: true;
        groupId: string | null;
        stayIds: string[];
        confirmationNo: string;
      }
    | { ok: false; error: string }
  >;
  roomingSubmittedAt: string | null;
  lastBookedGroupId: string | null;
};

function seedPortalUsers(): PortalUser[] {
  return [
    {
      id: "pu-yap-owner",
      agentId: "ag-yap",
      name: "Yangphel Owner",
      role: "owner",
      facilities: FACILITY_BY_ROLE.owner,
    },
    {
      id: "pu-yap-res",
      agentId: "ag-yap",
      name: "Yangphel Reservations",
      role: "reservations",
      facilities: FACILITY_BY_ROLE.reservations,
    },
    {
      id: "pu-yap-acc",
      agentId: "ag-yap",
      name: "Yangphel Accountant",
      role: "accountant",
      facilities: FACILITY_BY_ROLE.accountant,
    },
    {
      id: "pu-da-owner",
      agentId: "ag-da",
      name: "Druk Asia Owner",
      role: "owner",
      facilities: FACILITY_BY_ROLE.owner,
    },
  ];
}

export function partnerAgencyName(agentId: string): string {
  return useCommercialStore.getState().agents.find((a) => a.id === agentId)?.name ?? "Partner";
}

export const usePartnerPortalStore = create<PartnerPortalState>((set, get) => ({
  sessionAgentId: "ag-yap",
  sessionPortalUserId: "pu-yap-owner",
  portalUsers: seedPortalUsers(),
  roomingSubmittedAt: null,
  lastBookedGroupId: null,
  roomingDraft: [
    {
      id: "pr-1",
      leadGuest: "Jean-Pierre Dubois",
      passportOrCid: "FR-8829104",
      nationality: "French",
      mealPlan: "MAP",
      dietary: "None",
      companionName: "Marie Dubois",
      luggage: { count: 2, color: "black", description: "2 hard cases" },
    },
    {
      id: "pr-2",
      leadGuest: "Marcus Weber",
      passportOrCid: "DE-7719230",
      nationality: "German",
      mealPlan: "MAP",
      dietary: "No pork / beef",
      luggage: { count: 1, color: "blue", description: "Soft duffel" },
    },
  ],
  changeRequests: [
    {
      id: "cr-1",
      agentId: "ag-yap",
      kind: "guest_name",
      summary: "Rename Sophie Laurent → Sophie M. Laurent",
      detail: "Passport update received from Yangphel ops",
      status: "approved",
      submittedAt: new Date(Date.now() - 2 * 86400000).toISOString(),
      reviewedAt: new Date(Date.now() - 86400000).toISOString(),
      submittedBy: "Yangphel Reservations",
      submittedByUserId: "pu-yap-res",
      reviewedBy: "Desk FO",
      stayId: null,
      groupId: null,
      payload: { guestFrom: "Sophie Laurent", guestTo: "Sophie M. Laurent" },
    },
    {
      id: "cr-2",
      agentId: "ag-yap",
      kind: "meal_plan",
      summary: "MAP → AP for Rm 201 Henri Martin",
      detail: "Guest upgraded dining package",
      status: "pending",
      submittedAt: new Date(Date.now() - 3 * 3600_000).toISOString(),
      reviewedAt: null,
      submittedBy: "Yangphel Reservations",
      submittedByUserId: "pu-yap-res",
      reviewedBy: null,
      stayId: null,
      groupId: "grp-001",
      payload: { mealPlan: "AP", groupId: "grp-001" },
    },
  ],
  depositSlips: [
    {
      id: "ds-1",
      agentId: "ag-yap",
      amount: 85000,
      method: "wire",
      ref: "BNB-TRF-992184",
      note: "Yangphel MoU advance · Oct block",
      status: "awaiting_desk",
      at: new Date(Date.now() - 5 * 3600_000).toISOString(),
      uploadedBy: "Yangphel Accountant",
    },
  ],

  setSessionAgent: (agentId) => {
    const users = get().portalUsers.filter((u) => u.agentId === agentId);
    set({
      sessionAgentId: agentId,
      sessionPortalUserId: users[0]?.id ?? get().sessionPortalUserId,
    });
  },

  setSessionPortalUser: (userId) => set({ sessionPortalUserId: userId }),

  currentPortalUser: () => {
    const { portalUsers, sessionPortalUserId, sessionAgentId } = get();
    return (
      portalUsers.find((u) => u.id === sessionPortalUserId && u.agentId === sessionAgentId) ??
      portalUsers.find((u) => u.agentId === sessionAgentId) ??
      null
    );
  },

  canPortal: (facility) => {
    const user = get().currentPortalUser();
    if (!user) return false;
    return user.facilities.includes(facility);
  },

  addRoomer: (row) =>
    set((s) => ({
      roomingDraft: [{ ...row, id: crypto.randomUUID() }, ...s.roomingDraft],
    })),

  importRoamingPaste: (text) => {
    const lines = text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length === 0) return { ok: false, error: "Paste is empty" };
    const rows: PartnerRoomer[] = [];
    for (const line of lines) {
      const parts = line.split(/[|\t,]/).map((p) => p.trim());
      if (parts.length < 3) {
        return {
          ok: false,
          error: `Bad line "${line}" — use Guest | Passport | Nationality [| Meal | Diet | Bags | Color | Desc]`,
        };
      }
      const meal = (parts[3] ?? "MAP").toUpperCase();
      const mealPlan: MealPlan =
        meal === "EP" || meal === "CP" || meal === "MAP" || meal === "AP" ? meal : "MAP";
      const bagCount = Number(parts[5] ?? 0);
      rows.push({
        id: crypto.randomUUID(),
        leadGuest: parts[0]!,
        passportOrCid: parts[1]!,
        nationality: parts[2]!,
        mealPlan,
        dietary: parts[4] ?? "None",
        luggage:
          bagCount > 0
            ? {
                count: Math.max(0, Math.min(20, Math.floor(bagCount))),
                color: parts[6] || "mixed",
                description: parts[7] || "",
              }
            : undefined,
      });
    }
    set((s) => ({ roomingDraft: [...rows, ...s.roomingDraft] }));
    return { ok: true, count: rows.length };
  },

  clearRoamingDraft: () => set({ roomingDraft: [] }),

  updateRoomer: (id, patch) =>
    set((s) => ({
      roomingDraft: s.roomingDraft.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    })),

  bookPartnerGroup: async (input) => {
    if (!get().canPortal("book")) {
      return { ok: false, error: "Your portal role cannot book" };
    }
    const agentId = get().sessionAgentId;
    if (!useMouStore.getState().hasActiveMou(agentId, DEMO_MOU_PROPERTY_ID)) {
      return { ok: false, error: "Active MoU required before booking" };
    }
    const agency = partnerAgencyName(agentId);
    const actor = get().currentPortalUser()?.name ?? "Partner Portal";
    const fo = useFrontOfficeStore.getState();
    const roomsCount = Math.max(1, Math.min(8, Math.floor(input.roomsCount)));
    const created = await fo.createBooking({
      guestName: input.guestName.trim(),
      typeCode: input.typeCode,
      checkIn: input.checkIn,
      checkOut: input.checkOut,
      mealPlan: input.mealPlan,
      source: "agent",
      asHold: true,
      agencyName: agency,
      groupName: `${agency} · ${roomsCount} rooms`,
      roomsCount,
      adults: input.adults,
    });
    if (!created.ok) return { ok: false, error: created.error };
    if (input.nightlyNet && input.nightlyNet > 0) {
      for (const peer of created.stays) {
        const rate = await fo.updateStayRate(
          peer.id,
          { nightlyNet: input.nightlyNet, mealPlan: input.mealPlan },
          actor,
        );
        if (!rate.ok) {
          return { ok: false, error: rate.error };
        }
      }
    }
    set({ lastBookedGroupId: created.groupId });
    return {
      ok: true,
      groupId: created.groupId,
      stayIds: created.stays.map((s) => s.id),
      confirmationNo: created.stay.confirmationNo,
    };
  },

  submitGuestNameChange: (guestFrom, guestTo, stayId) => {
    return get().submitStructuredChange({
      kind: "guest_name",
      summary: `Rename ${guestFrom} → ${guestTo}`,
      detail: "Agency self-service name correction — awaiting desk",
      payload: { guestFrom, guestTo, stayId },
    });
  },

  submitOpsChange: (kind, summary, detail, payload) => {
    return get().submitStructuredChange({
      kind,
      summary,
      detail,
      payload: payload ?? {},
    });
  },

  submitStructuredChange: ({ kind, summary, detail, payload }) => {
    if (!get().canPortal("changes") && kind !== "guide" && kind !== "driver") {
      return { ok: false, error: "Your portal role cannot submit changes" };
    }
    const user = get().currentPortalUser();
    const agentId = get().sessionAgentId;
    if (!useMouStore.getState().hasActiveMou(agentId, DEMO_MOU_PROPERTY_ID)) {
      return { ok: false, error: "Active MoU required" };
    }
    const req: PartnerChangeRequest = {
      id: crypto.randomUUID(),
      agentId,
      kind,
      summary,
      detail,
      status: "pending",
      submittedAt: new Date().toISOString(),
      reviewedAt: null,
      submittedBy: user?.name ?? "Partner Portal",
      submittedByUserId: user?.id ?? null,
      reviewedBy: null,
      stayId: payload.stayId ?? null,
      groupId: payload.groupId ?? null,
      payload,
    };
    set((s) => ({ changeRequests: [req, ...s.changeRequests] }));
    return { ok: true, req };
  },

  updateGuideDriver: (input) => {
    if (!get().canPortal("guide_driver")) {
      return { ok: false, error: "Your portal role cannot edit guide/driver" };
    }
    const fo = useFrontOfficeStore.getState();
    const prev = fo.groupMeta[input.groupId];
    if (!prev) return { ok: false, error: "Group logistics not found" };
    const actor = get().currentPortalUser()?.name ?? "Partner Portal";
    fo.upsertGroupMeta({
      ...prev,
      guideName: input.guideName?.trim() || prev.guideName,
      guidePhone: input.guidePhone?.trim() || prev.guidePhone,
      guideLicense: input.guideLicense?.trim() || prev.guideLicense,
      driverName: input.driverName?.trim() || prev.driverName,
      driverDormBed: input.driverDormBed?.trim() || prev.driverDormBed,
      vehicleNo: input.vehicleNo?.trim() || prev.vehicleNo,
    });
    const stay = fo.stays.find((s) => s.groupId === input.groupId);
    if (stay) {
      useFrontOfficeStore.setState({
        stays: fo.stays.map((s) =>
          s.groupId === input.groupId
            ? {
                ...s,
                audit: [
                  {
                    id: crypto.randomUUID(),
                    at: new Date().toISOString(),
                    actor,
                    message: "Guide / driver logistics updated from partner portal",
                  },
                  ...s.audit,
                ],
              }
            : s,
        ),
      });
    }
    return { ok: true };
  },

  deskReviewChange: async (id, decision, reviewer = "Desk FO") => {
    const req = get().changeRequests.find((c) => c.id === id);
    if (!req) return { ok: false, error: "Change request not found" };
    if (req.status !== "pending") return { ok: false, error: "Already reviewed" };

    if (decision === "rejected") {
      set((s) => ({
        changeRequests: s.changeRequests.map((c) =>
          c.id === id
            ? {
                ...c,
                status: "rejected",
                reviewedAt: new Date().toISOString(),
                reviewedBy: reviewer,
              }
            : c,
        ),
      }));
      return { ok: true };
    }

    const fo = useFrontOfficeStore.getState();
    const payload = req.payload;
    const stayId =
      payload.stayId ??
      req.stayId ??
      fo.stays.find(
        (s) =>
          payload.guestFrom &&
          s.guestName === payload.guestFrom &&
          s.agencyName &&
          partnerAgencyName(req.agentId)
            .toLowerCase()
            .includes((s.agencyName.split(" ")[0] ?? "").toLowerCase()),
      )?.id;

    try {
      if (req.kind === "cancel" && stayId) {
        const res = await fo.cancelStay(stayId, reviewer);
        if (!res.ok) return res;
      } else if (
        (req.kind === "postpone" || req.kind === "dates") &&
        stayId &&
        payload.newCheckOut
      ) {
        const stay = fo.stays.find((s) => s.id === stayId);
        if (!stay) return { ok: false, error: "Stay not found" };
        if (payload.newCheckOut > stay.checkOut) {
          const res = await fo.extendStay({
            stayId,
            newCheckOut: payload.newCheckOut,
            actor: reviewer,
          });
          if (!res.ok) return res;
        } else if (payload.newCheckOut < stay.checkOut) {
          const res = await fo.shortenStay({
            stayId,
            newCheckOut: payload.newCheckOut,
            actor: reviewer,
          });
          if (!res.ok) return res;
        }
      } else if (req.kind === "prepone" && stayId && payload.newCheckOut) {
        const res = await fo.shortenStay({
          stayId,
          newCheckOut: payload.newCheckOut,
          actor: reviewer,
        });
        if (!res.ok) return res;
      } else if (req.kind === "meal_plan" && payload.mealPlan) {
        if (payload.groupId || req.groupId) {
          const res = await fo.applyGroupMealPlan(
            payload.groupId ?? req.groupId!,
            payload.mealPlan,
            reviewer,
          );
          if (!res.ok) return res;
        } else if (stayId) {
          const res = await fo.updateStayRate(
            stayId,
            { mealPlan: payload.mealPlan },
            reviewer,
          );
          if (!res.ok) return res;
        }
      } else if (req.kind === "guest_name" && payload.guestTo && stayId) {
        const stay = fo.stays.find((s) => s.id === stayId);
        if (!stay) return { ok: false, error: "Stay not found" };
        const res = await fo.updateStayGuestRoster(
          stayId,
          {
            guestName: payload.guestTo,
            passportOrCid: stay.passportOrCid ?? "",
            nationality: stay.nationality ?? "",
          },
          reviewer,
        );
        if (!res.ok) return res;
      } else if (req.kind === "add_room" && payload.typeCode && payload.groupId) {
        const peers = fo.stays.filter((s) => s.groupId === payload.groupId);
        const seed = peers[0];
        if (!seed) return { ok: false, error: "Group has no stays" };
        const created = await fo.createBooking({
          guestName: `${seed.guestName} · +room`,
          typeCode: payload.typeCode,
          checkIn: seed.checkIn,
          checkOut: seed.checkOut,
          mealPlan: seed.mealPlan,
          source: "agent",
          asHold: true,
          agencyName: seed.agencyName,
          groupId: payload.groupId,
          roomsCount: Math.max(1, payload.roomsDelta ?? 1),
        });
        if (!created.ok) return { ok: false, error: created.error };
      } else if (req.kind === "reduce_room" && stayId) {
        const res = await fo.cancelStay(stayId, reviewer);
        if (!res.ok) return res;
      } else if (req.kind === "extras" || req.kind === "rooms") {
        /* Free-text ops acknowledged — FO applies manually if no structured payload. */
      } else if (req.kind === "guide" || req.kind === "driver") {
        if (payload.groupId) {
          const meta = fo.groupMeta[payload.groupId];
          if (meta) {
            fo.upsertGroupMeta({
              ...meta,
              guideName: payload.guideName ?? meta.guideName,
              guidePhone: payload.guidePhone ?? meta.guidePhone,
              guideLicense: payload.guideLicense ?? meta.guideLicense,
              driverName: payload.driverName ?? meta.driverName,
              driverDormBed: payload.driverDormBed ?? meta.driverDormBed,
              vehicleNo: payload.vehicleNo ?? meta.vehicleNo,
            });
          }
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[partner] deskReviewChange apply failed", { id, message });
      return { ok: false, error: message };
    }

    set((s) => ({
      changeRequests: s.changeRequests.map((c) =>
        c.id === id
          ? {
              ...c,
              status: "approved",
              reviewedAt: new Date().toISOString(),
              reviewedBy: reviewer,
            }
          : c,
      ),
    }));
    return { ok: true };
  },

  uploadDeposit: ({ amount, method, ref, note }) => {
    if (!get().canPortal("money")) {
      return { ok: false, error: "Your portal role cannot upload deposits" };
    }
    const trimmed = ref.trim();
    if (!trimmed) {
      return {
        ok: false,
        error: "Bank / mBoB reference is required before upload",
      };
    }
    if (amount <= 0) {
      return { ok: false, error: "Deposit amount must be positive" };
    }
    const user = get().currentPortalUser();
    const slip: PartnerDepositSlip = {
      id: crypto.randomUUID(),
      agentId: get().sessionAgentId,
      amount,
      method,
      ref: trimmed,
      note,
      status: "awaiting_desk",
      at: new Date().toISOString(),
      uploadedBy: user?.name ?? "Partner Portal",
    };
    set((s) => ({ depositSlips: [slip, ...s.depositSlips] }));
    return { ok: true, slip };
  },

  verifyDeposit: async (id, decision, agentId) => {
    const slip = get().depositSlips.find((d) => d.id === id);
    if (!slip) return { ok: false, error: "Deposit slip not found" };
    if (slip.status !== "awaiting_desk") return { ok: false, error: "Already processed" };
    if (decision === "rejected") {
      set((s) => ({
        depositSlips: s.depositSlips.map((d) =>
          d.id === id ? { ...d, status: "rejected" } : d,
        ),
      }));
      return { ok: true };
    }
    const payTo = agentId ?? get().sessionAgentId;
    const pay = await useCommercialStore.getState().recordPayment(payTo, slip.amount);
    if (!pay.ok) {
      console.error("[partner] AR payment failed", pay.error);
      return { ok: false, error: pay.error };
    }
    useExtrasStore.getState().matchDeposit(slip.amount, slip.ref, "shift-1");
    set((s) => ({
      depositSlips: s.depositSlips.map((d) =>
        d.id === id ? { ...d, status: "verified" } : d,
      ),
    }));
    return { ok: true };
  },

  validateRoomingDraft: () => {
    const draft = get().roomingDraft;
    const seen = new Map<string, string>();
    const issues: RoomingValidationIssue[] = [];
    for (const row of draft) {
      const key = row.passportOrCid.trim().toUpperCase();
      if (!key) {
        issues.push({
          roomerId: row.id,
          field: "passportOrCid",
          message: "Passport / CID missing",
        });
        continue;
      }
      const prior = seen.get(key);
      if (prior) {
        issues.push({
          roomerId: row.id,
          field: "passportOrCid",
          message: `Duplicate of row ${prior}`,
        });
      } else {
        seen.set(key, row.leadGuest);
      }
    }
    return issues;
  },

  suggestRoomsFromMask: () => {
    const today = ymd(new Date());
    const fo = useFrontOfficeStore.getState();
    const openOnDate = (roomId: string) =>
      fo.stays.some(
        (s) =>
          s.roomId === roomId &&
          !["cancelled", "no_show", "checked_out"].includes(s.status) &&
          (stayOnDate(s, today) || (s.checkIn <= today && today < s.checkOut)),
      );
    const pool = fo.rooms
      .filter((r) => r.hkStatus !== "ooo" && !openOnDate(r.id))
      .sort((a, b) => a.number.localeCompare(b.number));
    const draft = get().roomingDraft;
    const suggestions: MaskedRoomSuggestion[] = draft.map((row, i) => {
      const room = pool[i];
      return {
        roomerId: row.id,
        roomNumber: room?.number ?? "—",
        typeName: room?.typeName ?? "No masked availability",
      };
    });
    set((s) => ({
      roomingDraft: s.roomingDraft.map((row) => {
        const hit = suggestions.find((x) => x.roomerId === row.id);
        return hit && hit.roomNumber !== "—"
          ? { ...row, suggestedRoom: hit.roomNumber }
          : row;
      }),
    }));
    return suggestions;
  },

  suggestDepositMatches: (amount) => {
    const agentId = get().sessionAgentId;
    const agency = partnerAgencyName(agentId).split(" ")[0]!.toLowerCase();
    const agent = useCommercialStore.getState().agents.find((a) => a.id === agentId);
    const docs = useExtrasStore
      .getState()
      .fiscalDocs.filter(
        (d) =>
          d.partyType === "agent" &&
          d.status !== "paid" &&
          d.party.toLowerCase().includes(agency),
      );
    const buckets: { key: DepositMatchHint["bucket"]; amount: number }[] = agent
      ? [
          { key: "d90", amount: agent.aging.d90 },
          { key: "d60", amount: agent.aging.d60 },
          { key: "d30", amount: agent.aging.d30 },
          { key: "current", amount: agent.aging.current },
        ]
      : [];
    const hints: DepositMatchHint[] = [];
    for (const doc of docs) {
      const delta = Math.abs(doc.amount - amount);
      hints.push({
        fiscalDocId: doc.id,
        docNo: doc.docNo,
        amount: doc.amount,
        delta,
        bucket: "current",
      });
    }
    for (const b of buckets) {
      if (b.amount <= 0) continue;
      const delta = Math.abs(b.amount - amount);
      hints.push({
        fiscalDocId: `aging-${b.key}`,
        docNo: `AR-${b.key.toUpperCase()}`,
        amount: b.amount,
        delta,
        bucket: b.key,
      });
    }
    return hints.sort((a, b) => a.delta - b.delta).slice(0, 6);
  },

  submitRoomingToDesk: async (groupId) => {
    const issues = get().validateRoomingDraft();
    if (issues.length) {
      return { ok: false, error: `${issues.length} validation issue(s) — fix before submit` };
    }
    const draft = get().roomingDraft;
    if (!draft.length) return { ok: false, error: "Rooming draft is empty" };

    const fo = useFrontOfficeStore.getState();
    const gid = groupId ?? get().lastBookedGroupId;
    const agency = partnerAgencyName(get().sessionAgentId);
    let targets = gid
      ? fo.stays.filter(
          (s) =>
            s.groupId === gid && !["cancelled", "no_show", "checked_out"].includes(s.status),
        )
      : fo.stays.filter(
          (s) =>
            s.source === "agent" &&
            s.agencyName === agency &&
            ["held", "confirmed"].includes(s.status) &&
            !["cancelled", "no_show", "checked_out"].includes(s.status),
        );
    targets = [...targets].sort((a, b) => a.confirmationNo.localeCompare(b.confirmationNo));

    if (targets.length === 0) {
      return {
        ok: false,
        error: "No agent group stays to link — place a multi-room hold first",
      };
    }
    if (targets.length !== draft.length) {
      return {
        ok: false,
        error: `Rooming has ${draft.length} rows but group has ${targets.length} stays — match counts`,
      };
    }

    let linked = 0;
    const linkedIds: string[] = [];
    for (let i = 0; i < draft.length; i += 1) {
      const row = draft[i]!;
      const stay = targets[i]!;
      const res = await fo.updateStayGuestRoster(
        stay.id,
        {
          guestName: row.leadGuest,
          passportOrCid: row.passportOrCid,
          nationality: row.nationality,
          companions: row.companionName?.trim()
            ? [{ name: row.companionName.trim() }]
            : [],
          luggage: row.luggage ?? null,
        },
        get().currentPortalUser()?.name ?? "Partner Portal",
      );
      if (res.ok) {
        linked += 1;
        linkedIds.push(stay.id);
      }
    }
    set((s) => ({
      roomingSubmittedAt: new Date().toISOString(),
      roomingDraft: s.roomingDraft.map((row, i) => ({
        ...row,
        linkedStayId: linkedIds[i],
      })),
    }));
    return { ok: true, count: draft.length, linked };
  },
}));

export function partnerHorizonDates(days = 14): string[] {
  const start = ymd(new Date());
  return Array.from({ length: days }, (_, i) => addDays(start, i));
}
