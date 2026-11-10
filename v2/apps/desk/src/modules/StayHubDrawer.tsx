import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Badge, Button, StaySheet, STAY_SHEET_MODAL_ROOT_ID } from "@hos-v2/ui";
import {
  BILLING_MODE_LABEL,
  datesBetween,
  EXTRA_BED_NIGHTLY_NET,
  formatNu,
  folioBalance,
  folioTotals,
  groupMasterBalance,
  groupMembers,
  groupPersonalBalance,
  isDeferredPartyId,
  mealPlanNightlyNet,
  rankRoomsForStay,
  stayBillingMode,
  taxBreakdown,
  useFrontOfficeStore,
  type DailyStayPlan,
  type FolioLineKind,
  type FolioStream,
  type MealPlan,
  type Stay,
  type StayBillingMode,
  type TenderMethod,
} from "../lib/front-office-store";
import { useExtrasStore } from "../lib/extras-store";
import {
  quoteFromCard,
  rateCardById,
  resolveRateCardId,
  useCommercialStore,
} from "../lib/commercial-store";
import { useMealBoardStore } from "../lib/meal-board-store";
import { InvoiceModal } from "./InvoiceModal";
import { GroupInvoiceModal } from "./GroupInvoiceModal";
import {
  GuestDocsPanel,
  docsStatusForStay,
  docsStatusLabel,
  type GuestDocsRowDraft,
} from "./GuestDocsPanel";
import { Sparkles } from "lucide-react";
import {
  assertGuestIdDocument,
  PERSONAL_CHECKOUT_GATE_BTN,
} from "@hos-v2/domain";
import { verifyDeskManagerPin } from "../lib/desk-pin";

const LUGGAGE_COLORS = ["black", "blue", "red", "grey", "mixed"] as const;

function luggageHint(stay: Stay): string | null {
  const bag = stay.luggage;
  if (!bag || bag.count <= 0) return null;
  const parts = [`${bag.count}`, bag.color || null, bag.description || null].filter(
    Boolean,
  );
  return parts.join(" · ");
}

const BILLING_MODES: StayBillingMode[] = [
  "standard",
  "complementary",
  "no_bill",
];

type TabId = "streams" | "group" | "guests" | "controls" | "notes" | "audit";

const FIT_TABS: { id: TabId; label: string }[] = [
  { id: "guests", label: "Guests & Docs" },
  { id: "streams", label: "Folio" },
  { id: "controls", label: "Room" },
  { id: "notes", label: "Notes" },
  { id: "audit", label: "Audit" },
];

/** Group StayHub — rooms party first, then this room’s folio / controls. */
const GROUP_TABS: { id: TabId; label: string }[] = [
  { id: "group", label: "Rooms" },
  { id: "guests", label: "Guests & Docs" },
  { id: "streams", label: "Folio" },
  { id: "controls", label: "This room" },
  { id: "notes", label: "Notes" },
  { id: "audit", label: "Audit" },
];

const MEALS: MealPlan[] = ["EP", "CP", "MAP", "AP"];

const MOVE_REASONS = [
  { id: "upgrade" as const, label: "Upgrade" },
  { id: "maintenance" as const, label: "Maintenance" },
  { id: "guest_request" as const, label: "Noise / Guest" },
];

/** Fixed-price guest extras only — laundry / POS / service use the amount form. */
const ADDONS = [
  { id: "shuttle", label: "Airport Shuttle", net: 1500, kind: "adjustment" as const },
  { id: "bath", label: "Hot Stone Bath", net: 2000, kind: "fb" as const },
];

const GUEST_BILL_KINDS: { id: FolioLineKind; label: string; hint: string }[] = [
  { id: "fb", label: "POS / F&B", hint: "Restaurant, bar, room service" },
  { id: "laundry", label: "Laundry", hint: "Enter actual slip total" },
  { id: "minibar", label: "Minibar", hint: "In-room consumption" },
  { id: "adjustment", label: "Service / other", hint: "Misc guest charge" },
];

export function StayHubDrawer() {
  const reduce = useReducedMotion();
  const navigate = useNavigate();
  const selectedStayId = useFrontOfficeStore((s) => s.selectedStayId);
  const openStay = useFrontOfficeStore((s) => s.openStay);
  const stays = useFrontOfficeStore((s) => s.stays);
  const rooms = useFrontOfficeStore((s) => s.rooms);
  const groupMeta = useFrontOfficeStore((s) => s.groupMeta);
  const checkIn = useFrontOfficeStore((s) => s.checkIn);
  const checkOut = useFrontOfficeStore((s) => s.checkOut);
  const cancelStay = useFrontOfficeStore((s) => s.cancelStay);
  const cancelGroup = useFrontOfficeStore((s) => s.cancelGroup);
  const confirmHold = useFrontOfficeStore((s) => s.confirmHold);
  const updateGuestIdentity = useFrontOfficeStore((s) => s.updateGuestIdentity);
  const assignRoom = useFrontOfficeStore((s) => s.assignRoom);
  const moveRoom = useFrontOfficeStore((s) => s.moveRoom);
  const settleFolio = useFrontOfficeStore((s) => s.settleFolio);
  const postCharge = useFrontOfficeStore((s) => s.postCharge);
  const voidFolioLine = useFrontOfficeStore((s) => s.voidFolioLine);
  const updateStayRate = useFrontOfficeStore((s) => s.updateStayRate);
  const setStayNotes = useFrontOfficeStore((s) => s.setStayNotes);
  const setBillingMode = useFrontOfficeStore((s) => s.setBillingMode);
  const applyGroupMealPlan = useFrontOfficeStore((s) => s.applyGroupMealPlan);
  const applyGroupNightlyNet = useFrontOfficeStore((s) => s.applyGroupNightlyNet);
  const applyGroupDailyPlans = useFrontOfficeStore((s) => s.applyGroupDailyPlans);
  const checkInGroup = useFrontOfficeStore((s) => s.checkInGroup);
  const ensurePackageChargesPosted = useFrontOfficeStore(
    (s) => s.ensurePackageChargesPosted,
  );
  const settleGroupMaster = useFrontOfficeStore((s) => s.settleGroupMaster);
  const updateStayGuestRoster = useFrontOfficeStore((s) => s.updateStayGuestRoster);
  const issueStayTaxInvoice = useExtrasStore((s) => s.issueStayTaxInvoice);
  const mealBoards = useMealBoardStore((s) => s.boards);
  const agents = useCommercialStore((s) => s.agents);
  const rateCards = useCommercialStore((s) => s.rateCards);
  const cells = useCommercialStore((s) => s.cells);
  const season = useCommercialStore((s) => s.season);
  const selectedRateCardId = useCommercialStore((s) => s.selectedRateCardId);

  const [tab, setTab] = useState<TabId>("streams");
  const [streamFocus, setStreamFocus] = useState<FolioStream>("personal");
  const [roomPick, setRoomPick] = useState("");
  const [moveReason, setMoveReason] = useState<(typeof MOVE_REASONS)[number]["id"]>("upgrade");
  const [tender, setTender] = useState<TenderMethod>("cash");
  const [cashGiven, setCashGiven] = useState<number | null>(null);
  const [pin, setPin] = useState("");
  const [voidPin, setVoidPin] = useState("");
  const [voidTarget, setVoidTarget] = useState<string | null>(null);
  const [dirtyAssignPrompt, setDirtyAssignPrompt] = useState<{
    stayId: string;
    roomId: string;
    roomNumber: string;
    allowUpgrade: boolean;
    moveReason?: "maintenance" | "upgrade" | "guest_request" | "operations";
  } | null>(null);
  const [dirtyAssignPin, setDirtyAssignPin] = useState("");
  const [partyDirtyPrompt, setPartyDirtyPrompt] = useState<{
    groupId: string;
    leadStayId: string;
    dirtyRooms: string[];
  } | null>(null);
  const [partyDirtyPin, setPartyDirtyPin] = useState("");
  const [partyDirtyError, setPartyDirtyError] = useState<string | null>(null);
  const [partyCiBusy, setPartyCiBusy] = useState(false);
  const partyDirtyPinRef = useRef<HTMLInputElement | null>(null);
  const dirtyAssignPinRef = useRef<HTMLInputElement | null>(null);
  const [rmaOpen, setRmaOpen] = useState(false);
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [dailyDraft, setDailyDraft] = useState<DailyStayPlan[]>([]);
  const [notesDraft, setNotesDraft] = useState("");
  const [notesDirty, setNotesDirty] = useState(false);
  const [showVoided, setShowVoided] = useState(false);
  const [docCaptureOpen, setDocCaptureOpen] = useState(false);
  const [idDraft, setIdDraft] = useState("");
  const [natDraft, setNatDraft] = useState("");
  const [peerExpandId, setPeerExpandId] = useState<string | null>(null);
  const [peerRoomPick, setPeerRoomPick] = useState<Record<string, string>>({});
  /** Per-peer: include other types as upgrades in the assign list. */
  const [peerShowUpgrades, setPeerShowUpgrades] = useState<Record<string, boolean>>(
    {},
  );
  const [bagCount, setBagCount] = useState(0);
  const [bagColor, setBagColor] = useState("black");
  const [bagDesc, setBagDesc] = useState("");
  const [groupSettlePin, setGroupSettlePin] = useState("");
  const [groupInvoiceOpen, setGroupInvoiceOpen] = useState(false);
  const [partyNetDraft, setPartyNetDraft] = useState("");
  const [guestBillKind, setGuestBillKind] = useState<FolioLineKind>("fb");
  const [guestBillDesc, setGuestBillDesc] = useState("");
  const [guestBillNet, setGuestBillNet] = useState("");
  const [guestBillBusy, setGuestBillBusy] = useState(false);
  const [guestDocsDrafts, setGuestDocsDrafts] = useState<GuestDocsRowDraft[]>([]);
  const [guestDocsBusyId, setGuestDocsBusyId] = useState<string | null>(null);
  const [guestDocsSaveAllBusy, setGuestDocsSaveAllBusy] = useState(false);
  const [, start] = useTransition();

  const stay =
    stays.find((s) => s.id === selectedStayId) ??
    stays.find((s) => s.apiBookingId === selectedStayId) ??
    null;
  const peers = useMemo(
    () => (stay?.groupId ? groupMembers(stays, stay.groupId) : []),
    [stay?.groupId, stays],
  );
  /** Multi-room party → Group StayHub shell; else single-room StayHub. */
  const isGroupHub = Boolean(
    stay?.groupId && (peers.length >= 2 || stay.source === "agent"),
  );
  const tabs = useMemo(
    () => (isGroupHub ? GROUP_TABS : FIT_TABS),
    [isGroupHub],
  );
  const groupRollup = useMemo(() => {
    if (!stay?.groupId) return null;
    return {
      meta: groupMeta[stay.groupId],
      master: groupMasterBalance(stays, stay.groupId),
      personal: groupPersonalBalance(stays, stay.groupId),
      peers,
    };
  }, [stay?.groupId, groupMeta, stays, peers]);

  const resolvedCardId = useMemo(() => {
    if (!stay) return "";
    return resolveRateCardId({
      agents,
      rateCards,
      agencyName: stay.agencyName,
      explicitCardId:
        stay.source === "agent" || stay.agencyName
          ? null
          : selectedRateCardId,
      profile:
        stay.source === "agent"
          ? "agent"
          : stay.source === "direct"
            ? "corporate"
            : "walk_in",
    });
  }, [stay, agents, rateCards, selectedRateCardId]);

  const resolvedCard = rateCardById(rateCards, resolvedCardId);

  const applyCardRate = () => {
    if (!stay || !resolvedCardId) {
      toast.error("No rate card resolved for this stay");
      return;
    }
    const roomNet = quoteFromCard({
      cells,
      rateCardId: resolvedCardId,
      typeCode: stay.typeCode,
      season,
      mealPlan: "EP",
      adults: 2,
      fallbackNet: stay.nightlyNet,
    });
    const nextPlans = dailyDraft.map((d) => ({
      ...d,
      nightlyNet: roomNet,
      mealPlan: d.mealPlan || stay.mealPlan,
    }));
    setDailyDraft(nextPlans);
    void (async () => {
      const res = await updateStayRate(stay.id, {
        dailyPlans: nextPlans,
        nightlyNet: roomNet,
        mealPlan: nextPlans[0]?.mealPlan ?? stay.mealPlan,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`Applied ${resolvedCard?.code ?? "card"} room rate`, {
        description: `${formatNu(roomNet)}/n EP room · meals still from nightly meal plan`,
      });
    })();
  };

  /* Reset focus only when opening a different stay — never stomp Folio after hydrate. */
  useEffect(() => {
    if (!selectedStayId) return;
    setInvoiceOpen(false);
    setRmaOpen(false);
    setShowVoided(false);
    const s =
      useFrontOfficeStore.getState().stays.find((x) => x.id === selectedStayId) ??
      useFrontOfficeStore
        .getState()
        .stays.find((x) => x.apiBookingId === selectedStayId) ??
      null;
    const party = s?.groupId
      ? groupMembers(useFrontOfficeStore.getState().stays, s.groupId)
      : [];
    const groupHub = Boolean(
      s?.groupId && (party.length >= 2 || s.source === "agent"),
    );
    const agency =
      Boolean(s?.groupId || s?.source === "agent" || s?.agencyName);
    setStreamFocus(agency ? "master" : "personal");
    if (groupHub) {
      const needsDocs = (party.length ? party : s ? [s] : []).some(
        (p) =>
          docsStatusForStay({
            ...p,
            isDeferredPartyId: (id) => isDeferredPartyId(id),
          }) !== "ok",
      );
      setTab(needsDocs ? "guests" : "group");
    } else {
      setTab("guests");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: selectedStayId only
  }, [selectedStayId]);

  /* Clear empty StayHub shell only when selection is orphaned (not mid-hydrate remap). */
  useEffect(() => {
    if (!selectedStayId || stay) return;
    const wanted = selectedStayId;
    const t = window.setTimeout(() => {
      const state = useFrontOfficeStore.getState();
      if (state.selectedStayId !== wanted) return;
      const stillMissing =
        !state.stays.find((x) => x.id === wanted) &&
        !state.stays.find((x) => x.apiBookingId === wanted);
      /* Only clear cancelled/missing stays — never interrupt check-in hydrate. */
      if (stillMissing && state.liveRevision > 0) openStay(null);
    }, 5_000);
    return () => window.clearTimeout(t);
  }, [selectedStayId, stay, openStay]);

  const guestDocsRosterKey = useMemo(() => {
    if (!stay) return "";
    const rows = isGroupHub && peers.length > 0 ? peers : [stay];
    return rows
      .map(
        (p) =>
          `${p.id}:${p.guestName}:${p.passportOrCid}:${p.nationality}:${p.companions?.[0]?.name ?? ""}:${p.companions?.[0]?.passportOrCid ?? ""}`,
      )
      .join("|");
  }, [stay, isGroupHub, peers]);

  useEffect(() => {
    if (!stay || !guestDocsRosterKey) {
      setGuestDocsDrafts([]);
      return;
    }
    /* Don't clobber in-progress typing while a row save is in flight. */
    if (guestDocsBusyId || guestDocsSaveAllBusy) return;
    const rows = isGroupHub && peers.length > 0 ? peers : [stay];
    setGuestDocsDrafts(
      rows.map((p) => ({
        stayId: p.id,
        guestName: p.guestName,
        passportOrCid: isDeferredPartyId(p.passportOrCid)
          ? ""
          : (p.passportOrCid ?? ""),
        nationality: p.nationality ?? "",
        companionName: p.companions?.[0]?.name ?? "",
        companionPassportOrCid: p.companions?.[0]?.passportOrCid ?? "",
        companionNationality: p.companions?.[0]?.nationality ?? "",
      })),
    );
  }, [
    stay,
    isGroupHub,
    peers,
    guestDocsRosterKey,
    guestDocsBusyId,
    guestDocsSaveAllBusy,
  ]);

  useEffect(() => {
    if (!tabs.some((t) => t.id === tab)) {
      setTab(tabs[0]?.id ?? "streams");
    }
  }, [tabs, tab]);

  /* Heal selection when hydrate remapped stay id to API booking id. */
  useEffect(() => {
    if (stay && selectedStayId && stay.id !== selectedStayId) {
      openStay(stay.id);
    }
  }, [stay, selectedStayId, openStay]);

  useEffect(() => {
    setNotesDraft(stay?.notes ?? "");
    setNotesDirty(false);
  }, [selectedStayId, stay?.notes]);

  useEffect(() => {
    if (!stay?.groupId) {
      setPartyNetDraft("");
      return;
    }
    const meta = groupMeta[stay.groupId];
    const seed =
      meta?.rateMode === "uniform" && meta.uniformNightlyNet != null
        ? meta.uniformNightlyNet
        : stay.nightlyNet;
    setPartyNetDraft(String(seed));
  }, [stay?.groupId, stay?.id, stay?.nightlyNet, groupMeta]);

  useEffect(() => {
    if (tab === "group" && !stay?.groupId) setTab("streams");
  }, [tab, stay?.groupId]);

  useEffect(() => {
    if (!partyDirtyPrompt) return;
    const id = window.setTimeout(() => partyDirtyPinRef.current?.focus(), 20);
    return () => window.clearTimeout(id);
  }, [partyDirtyPrompt]);

  useEffect(() => {
    if (!dirtyAssignPrompt) return;
    const id = window.setTimeout(() => dirtyAssignPinRef.current?.focus(), 20);
    return () => window.clearTimeout(id);
  }, [dirtyAssignPrompt]);

  const packageRepairKey = useMemo(() => {
    if (!stay) return "";
    const targets =
      stay.groupId && peers.length > 0
        ? peers.filter((p) => p.status === "checked_in")
        : stay.status === "checked_in"
          ? [stay]
          : [];
    return targets
      .map((p) => {
        const masterCount = p.folioLines.filter(
          (l) => !l.voided && l.stream === "master" && l.totalAmount > 0,
        ).length;
        return `${p.id}:${masterCount}`;
      })
      .join("|");
  }, [stay, peers]);

  /* Repair empty agency master after CI (local meal sync used to skip API post). */
  useEffect(() => {
    if (!selectedStayId || !stay || !packageRepairKey) return;
    const needs = packageRepairKey
      .split("|")
      .map((part) => {
        const [id, count] = part.split(":");
        return { id, count: Number(count) };
      })
      .filter((p) => p.id && p.count === 0);
    if (needs.length === 0) return;
    let cancelled = false;
    void (async () => {
      let fixed = 0;
      for (const p of needs) {
        if (cancelled || !p.id) return;
        const res = await ensurePackageChargesPosted(p.id);
        if (res.ok && res.posted > 0) fixed += 1;
        else if (!res.ok) {
          console.error("[StayHub] package repair failed", p.id, res.error);
        }
      }
      if (!cancelled && fixed > 0) {
        toast.success(
          fixed === 1
            ? "Agency package posted to master bill"
            : `Agency package posted · ${fixed} rooms`,
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedStayId, stay, packageRepairKey, ensurePackageChargesPosted]);

  useEffect(() => {
    if (!stay) return;
    const dates = datesBetween(stay.checkIn, stay.checkOut);
    const existingMap = new Map(stay.dailyPlans?.map((p) => [p.date, p]));
    setDailyDraft(
      dates.map((d) => {
        const ex = existingMap.get(d);
        return {
          date: d,
          nightlyNet: ex?.nightlyNet ?? stay.nightlyNet,
          mealPlan: ex?.mealPlan ?? stay.mealPlan,
          extraBed: Boolean(ex?.extraBed),
        };
      }),
    );
  }, [stay?.id, stay?.checkIn, stay?.checkOut, stay?.nightlyNet, stay?.mealPlan, stay?.dailyPlans]);
  const master = useMemo(() => (stay ? folioTotals(stay, "master") : null), [stay]);
  const personal = useMemo(() => (stay ? folioTotals(stay, "personal") : null), [stay]);
  const activeTotals = streamFocus === "master" ? master : personal;

  const folioRows = useMemo(() => {
    if (!stay) return [];
    return stay.folioLines
      .filter((l) => l.stream === streamFocus)
      .filter((l) => showVoided || !l.voided);
  }, [stay, streamFocus, showVoided]);

  const otherStreamHasLines = useMemo(() => {
    if (!stay) return false;
    const other: FolioStream = streamFocus === "master" ? "personal" : "master";
    return stay.folioLines.some((l) => l.stream === other && !l.voided);
  }, [stay, streamFocus]);

  const folioEditable =
    stay != null && !["cancelled", "no_show"].includes(stay.status);

  const commitDailyPlans = (plans: DailyStayPlan[], label?: string) => {
    if (!stay) return;
    if (!folioEditable) {
      toast.error("Cannot edit rates on cancelled / no-show stays");
      return;
    }
    setDailyDraft(plans);
    const toastId = toast.loading(
      stay.status === "checked_out"
        ? "Rebuilding departed folio…"
        : "Updating agency folio…",
    );
    void (async () => {
      try {
        const res = await updateStayRate(stay.id, {
          dailyPlans: plans,
          nightlyNet: plans[0]?.nightlyNet ?? stay.nightlyNet,
          mealPlan: plans[0]?.mealPlan ?? stay.mealPlan,
        });
        if (!res.ok) {
          toast.error(res.error, { id: toastId });
          return;
        }
        setTab("streams");
        setStreamFocus("master");
        setShowVoided(false);
        toast.success(
          stay.status === "checked_out"
            ? "Departed folio corrected"
            : "Agency folio updated",
          {
            id: toastId,
            description:
              label ??
              `${plans[0]?.mealPlan ?? stay.mealPlan} · ${formatNu(plans[0]?.nightlyNet ?? stay.nightlyNet)}/night`,
          },
        );
      } catch (err) {
        console.error("[stayhub] commitDailyPlans", err);
        toast.error(err instanceof Error ? err.message : "Rate update failed", {
          id: toastId,
        });
      }
    })();
  };

  const candidates = rooms.filter(
    (r) =>
      stay &&
      r.hkStatus !== "ooo" &&
      (r.id === stay.roomId || r.hkStatus !== "occupied") &&
      (r.typeCode === stay.typeCode || moveReason === "upgrade"),
  );

  const smartSuggestions = useMemo(() => {
    if (!stay || stay.roomId) return [];
    return rankRoomsForStay(stays, rooms, stay, {
      allowUpgrade: moveReason === "upgrade",
      limit: 5,
    });
  }, [stay, stays, rooms, moveReason]);

  /** Guest extras on this room — checkout gate. */
  const due = personal?.balance ?? 0;
  /** Balance for the active folio stream (agency master vs guest personal). */
  const streamDue =
    (streamFocus === "master" ? master?.balance : personal?.balance) ?? 0;
  const cashTender = cashGiven ?? streamDue;
  const changeDue =
    tender === "cash" ? Math.max(0, cashTender - streamDue) : 0;

  const runSettle = (method: TenderMethod = tender) => {
    if (!stay || !activeTotals) return;
    const amount =
      method === "cash" ? Math.min(cashTender, streamDue) : streamDue;
    if (amount <= 0) {
      toast.error(
        streamFocus === "master"
          ? "Nothing due on this room’s agency folio"
          : "Nothing to settle on guest folio",
      );
      return;
    }
    start(async () => {
      const res = await settleFolio({
        stayId: stay.id,
        method,
        amount: method === "cash" ? streamDue : amount,
        stream: streamFocus,
        pinConfirmed:
          method === "city_ledger" ? verifyDeskManagerPin(pin).ok : true,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(
        `Settled ${formatNu(method === "cash" ? streamDue : amount)}`,
        {
          description:
            method === "cash" && changeDue > 0
              ? `${res.receiptNo} · Change ${formatNu(changeDue)}`
              : streamFocus === "master" && stay.groupId
                ? `${res.receiptNo} · this room only · ${method}`
                : `${res.receiptNo} · ${method}`,
        },
      );
      setCashGiven(null);
      setPin("");
      setRmaOpen(false);
    });
  };

  const tryCheckout = () => {
    if (!stay) return;
    start(async () => {
      const res = await checkOut(stay.id);
      if (!res.ok) {
        setStreamFocus("personal");
        toast.error("Checkout blocked", { description: res.error });
      } else toast.success("Checked out — personal folio clear");
    });
  };

  const runCheckIn = () => {
    if (!stay) return;
    const idOk = assertGuestIdDocument(stay.passportOrCid);
    if (!idOk.ok) {
      setIdDraft(
        stay.passportOrCid && !/^pending$/i.test(stay.passportOrCid)
          ? stay.passportOrCid
          : "",
      );
      setNatDraft(stay.nationality || "");
      setDocCaptureOpen(true);
      return;
    }
    /* Do not wrap lifecycle ACK in startTransition — remount/hydrate can cancel it. */
    void checkIn(stay.id).then((res) => {
      if (!res.ok) toast.error(res.error);
      else toast.success(`Checked in · Room ${stay.roomNumber}`);
    });
  };

  /** Group / Room tab assign — upgrade + dirty PIN so picks actually stick. */
  const assignPeerRoom = async (
    stayId: string,
    roomId: string,
    opts?: { moveReason?: "maintenance" | "upgrade" | "guest_request" | "operations" },
  ) => {
    const target = stays.find((s) => s.id === stayId);
    const room = rooms.find((r) => r.id === roomId);
    if (!target || !room) {
      return { ok: false as const, error: "Stay or room not found" };
    }
    const allowUpgrade = room.typeCode !== target.typeCode;
    let res = await assignRoom(stayId, roomId, "StayHub", {
      allowUpgrade,
      moveReason: opts?.moveReason,
    });
    if (!res.ok && res.code === "DIRTY_PIN_REQUIRED") {
      setDirtyAssignPin("");
      setDirtyAssignPrompt({
        stayId,
        roomId,
        roomNumber: room.number,
        allowUpgrade,
        moveReason: opts?.moveReason,
      });
      return res;
    }
    if (!res.ok && res.code === "TYPE_MISMATCH") {
      res = await assignRoom(stayId, roomId, "StayHub", {
        allowUpgrade: true,
        moveReason: opts?.moveReason ?? "upgrade",
      });
    }
    return res;
  };

  const confirmDirtyAssign = () => {
    const prompt = dirtyAssignPrompt;
    if (!prompt) return;
    const pinValue = dirtyAssignPin.trim();
    if (!pinValue) {
      toast.error("Enter manager PIN");
      return;
    }
    void assignRoom(prompt.stayId, prompt.roomId, "StayHub", {
      allowUpgrade: prompt.allowUpgrade,
      moveReason: prompt.moveReason,
      dirtyOverridePin: pinValue,
    }).then((res) => {
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`Assigned · Rm ${prompt.roomNumber}`, {
        description: "Dirty override",
      });
      setDirtyAssignPrompt(null);
      setDirtyAssignPin("");
    });
  };

  const confirmDocAndCheckIn = () => {
    if (!stay) return;
    const stayId = stay.id;
    const roomLabel = stay.roomNumber;
    void updateGuestIdentity(stayId, {
      passportOrCid: idDraft,
      nationality: natDraft || undefined,
    }).then((saved) => {
      if (!saved.ok) {
        toast.error(saved.error);
        return;
      }
      setDocCaptureOpen(false);
      const fresh =
        useFrontOfficeStore.getState().stays.find((s) => s.id === stayId) ??
        useFrontOfficeStore
          .getState()
          .stays.find((s) => s.apiBookingId === stayId) ??
        null;
      const checkInId = fresh?.id ?? stayId;
      void checkIn(checkInId).then((res) => {
        if (!res.ok) {
          if (res.code === "DIRTY_PIN_REQUIRED") {
            toast.error(res.error);
            return;
          }
          toast.error(res.error);
          return;
        }
        toast.success(`Checked in · Room ${fresh?.roomNumber ?? roomLabel}`);
      });
    });
  };

  const runPartyCheckIn = (dirtyOverridePin?: string) => {
    if (!stay?.groupId) return;
    if (partyCiBusy) return;
    const needRooms = peers.filter(
      (p) => ["confirmed", "held"].includes(p.status) && !p.roomId,
    );
    if (needRooms.length > 0) {
      toast.error(`Assign ${needRooms.length} room(s) first`, {
        description: needRooms
          .map((p) => p.guestName)
          .slice(0, 3)
          .join(" · "),
      });
      setTab("group");
      return;
    }
    const leadIdOk = assertGuestIdDocument(stay.passportOrCid);
    if (!leadIdOk.ok) {
      setIdDraft("");
      setNatDraft(stay.nationality || "International");
      setDocCaptureOpen(true);
      toast.message("Capture lead passport / CID", {
        description: "Then tap Check in party again",
      });
      return;
    }
    setPartyCiBusy(true);
    setPartyDirtyError(null);
    void checkInGroup(stay.groupId, undefined, {
      leadStayId: stay.id,
      dirtyOverridePin,
    })
      .then((res) => {
        if (!res.ok) {
          if (res.code === "LEAD_ID_REQUIRED") {
            setPartyDirtyPrompt(null);
            setDocCaptureOpen(true);
            toast.error(res.error);
            return;
          }
          if (res.code === "DIRTY_PIN_REQUIRED") {
            setPartyDirtyPrompt({
              groupId: stay.groupId!,
              leadStayId: stay.id,
              dirtyRooms: res.dirtyRooms ?? [],
            });
            setPartyDirtyError(
              dirtyOverridePin
                ? res.error
                : `Rm ${(res.dirtyRooms ?? []).join(", ") || "—"} dirty — enter desk PIN`,
            );
            if (dirtyOverridePin) setPartyDirtyPin("");
            return;
          }
          setPartyDirtyPrompt(null);
          toast.error(res.error);
          return;
        }
        setPartyDirtyPrompt(null);
        setPartyDirtyPin("");
        setPartyDirtyError(null);
        toast.success(`Party checked in · ${res.checkedIn}`, {
          description:
            res.blocked.length > 0
              ? res.blocked.slice(0, 2).join(" · ")
              : "All rooms in-house · package posted",
        });
        /* Keep StayHub open — closing it while the PIN portal unmounts crashed the desk. */
        setTab("group");
      })
      .catch((err: unknown) => {
        const message =
          err instanceof Error ? err.message : "Party check-in failed";
        console.error("[StayHub] party check-in", err);
        setPartyDirtyError(message);
        toast.error(message);
      })
      .finally(() => setPartyCiBusy(false));
  };

  return (
    <>
      <StaySheet
        open={Boolean(selectedStayId)}
        onOpenChange={(open) => {
          if (!open) {
            // Nested overlays sit above StayHub — first Close dismisses them.
            // Do NOT toggle Vaul modal/dismissible props (remount → white screen).
            if (partyDirtyPrompt) {
              setPartyDirtyPrompt(null);
              setPartyDirtyPin("");
              setPartyDirtyError(null);
              return;
            }
            if (dirtyAssignPrompt) {
              setDirtyAssignPrompt(null);
              setDirtyAssignPin("");
              return;
            }
            if (invoiceOpen) {
              setInvoiceOpen(false);
              return;
            }
            if (groupInvoiceOpen) {
              setGroupInvoiceOpen(false);
              return;
            }
            if (rmaOpen) {
              setRmaOpen(false);
              return;
            }
            /* Fast Book already sets fastBookOpen=false before openStay — so guard
             * on the time window openStay stamps, not on fastBookOpen. */
            const fo = useFrontOfficeStore.getState();
            if (fo.fastBookOpen) return;
            if (Date.now() < fo.stayHubDismissGuardUntil) return;
            openStay(null);
          }
        }}
        overlay={
          dirtyAssignPrompt || partyDirtyPrompt ? (
            <div className="absolute inset-0 z-[90] flex items-center justify-center bg-[rgba(9,13,22,0.55)] p-4">
              {dirtyAssignPrompt ? (
                <div
                  className="w-full max-w-sm rounded-2xl border border-[var(--hos-line)] bg-[var(--hos-cell)] p-4 shadow-[0_24px_64px_-20px_rgba(15,23,42,0.55)]"
                  role="dialog"
                  aria-modal
                  aria-label="Dirty room manager PIN"
                  onPointerDown={(e) => e.stopPropagation()}
                >
                  <h3 className="m-0 text-[15px] font-bold text-[var(--hos-ink)]">
                    Dirty room · Rm {dirtyAssignPrompt.roomNumber}
                  </h3>
                  <p className="m-0 mt-1 text-[12px] text-[var(--hos-ink-3)]">
                    Manager PIN required to assign before housekeeping clears.
                  </p>
                  <input
                    ref={dirtyAssignPinRef}
                    type="password"
                    inputMode="numeric"
                    autoComplete="off"
                    value={dirtyAssignPin}
                    onChange={(e) => setDirtyAssignPin(e.target.value)}
                    onKeyDown={(e) => {
                      e.stopPropagation();
                      if (e.key === "Enter") confirmDirtyAssign();
                    }}
                    data-testid="stayhub-dirty-pin"
                    className="mt-3 w-full rounded-xl border border-[var(--hos-line)] bg-[var(--hos-cell)] px-3 py-2.5 font-mono text-[14px] text-[var(--hos-ink)]"
                    placeholder="Manager PIN"
                  />
                  <div className="mt-3 flex gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      className="flex-1 !rounded-full"
                      onClick={() => {
                        setDirtyAssignPrompt(null);
                        setDirtyAssignPin("");
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      className="hos-btn-ink flex-1 !rounded-full"
                      onClick={confirmDirtyAssign}
                    >
                      Override
                    </Button>
                  </div>
                </div>
              ) : partyDirtyPrompt ? (
                <div
                  className="w-full max-w-sm rounded-2xl border border-[var(--hos-line)] bg-[var(--hos-cell)] p-4 shadow-[0_24px_64px_-20px_rgba(15,23,42,0.55)]"
                  role="dialog"
                  aria-modal
                  aria-label="Party dirty room manager PIN"
                  onPointerDown={(e) => e.stopPropagation()}
                >
                  <h3 className="m-0 text-[15px] font-bold text-[var(--hos-ink)]">
                    Dirty room(s) · party check-in
                  </h3>
                  <p className="m-0 mt-1 text-[12px] text-[var(--hos-ink-3)]">
                    Rm {partyDirtyPrompt.dirtyRooms.join(", ") || "—"} still dirty.
                    Enter desk unlock PIN (Karma{" "}
                    <span className="font-mono">1234</span>).
                  </p>
                  {partyDirtyError ? (
                    <p className="m-0 mt-2 rounded-lg border border-[color-mix(in_srgb,var(--hos-ruby)_35%,transparent)] bg-[color-mix(in_srgb,var(--hos-ruby)_10%,transparent)] px-2.5 py-1.5 text-[12px] text-[var(--hos-ruby)]">
                      {partyDirtyError}
                    </p>
                  ) : null}
                  <input
                    ref={partyDirtyPinRef}
                    type="password"
                    inputMode="numeric"
                    autoComplete="off"
                    value={partyDirtyPin}
                    onChange={(e) => {
                      setPartyDirtyPin(e.target.value);
                      setPartyDirtyError(null);
                    }}
                    onKeyDown={(e) => {
                      e.stopPropagation();
                      if (e.key === "Enter") {
                        const pin = partyDirtyPin.trim();
                        if (!pin) {
                          setPartyDirtyError("Enter your desk unlock PIN");
                          return;
                        }
                        runPartyCheckIn(pin);
                      }
                    }}
                    data-testid="stayhub-party-dirty-pin"
                    className="mt-3 w-full rounded-xl border border-[var(--hos-line)] bg-[var(--hos-cell)] px-3 py-2.5 font-mono text-[14px] text-[var(--hos-ink)]"
                    placeholder="Desk PIN · 1234"
                    disabled={partyCiBusy}
                  />
                  <div className="mt-3 flex gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      className="flex-1 !rounded-full"
                      disabled={partyCiBusy}
                      onClick={() => {
                        setPartyDirtyPrompt(null);
                        setPartyDirtyPin("");
                        setPartyDirtyError(null);
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      className="hos-btn-ink flex-1 !rounded-full"
                      disabled={partyCiBusy}
                      onClick={() => {
                        const pin = partyDirtyPin.trim();
                        if (!pin) {
                          setPartyDirtyError("Enter your desk unlock PIN");
                          return;
                        }
                        runPartyCheckIn(pin);
                      }}
                    >
                      {partyCiBusy ? "Checking in…" : "Override & check in"}
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null
        }
        title={isGroupHub ? "Group StayHub" : "StayHub"}
        compactTitle
        subtitle={
          stay
            ? isGroupHub
              ? `${stay.groupName ?? "Tour party"} · ${peers.length} rooms · ${
                  stay.agencyName ?? "Agency"
                }`
              : `${stay.confirmationNo} · ${stay.roomNumber ? `Rm ${stay.roomNumber}` : "No room"}`
            : "Select a stay"
        }
        header={
          stay ? (
            <div className="min-w-0 pr-1">
              {isGroupHub ? (
                <>
                  <div className="flex min-w-0 items-baseline gap-x-2 gap-y-0">
                    <strong className="truncate text-[14px] font-semibold tracking-tight text-[var(--hos-ink)]">
                      {stay.groupName ?? stay.agencyName ?? "Tour party"}
                    </strong>
                    <span className="shrink-0 rounded-full border border-[var(--hos-line)] px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-[var(--hos-brass-ink)]">
                      {peers.length} rooms
                    </span>
                  </div>
                  <p className="m-0 mt-0.5 truncate text-[11px] text-[var(--hos-ink-3)]">
                    Focus{" "}
                    <span className="font-medium text-[var(--hos-ink)]">
                      {stay.guestName}
                    </span>
                    {stay.roomNumber ? (
                      <>
                        <span className="mx-1 opacity-40">·</span>
                        Rm {stay.roomNumber}
                      </>
                    ) : (
                      <>
                        <span className="mx-1 opacity-40">·</span>
                        Unassigned
                      </>
                    )}
                    <span className="mx-1 opacity-40">·</span>
                    <span className="capitalize">
                      {stay.status.replace("_", " ")}
                    </span>
                  </p>
                </>
              ) : (
                <>
                  <div className="flex min-w-0 items-baseline gap-x-2 gap-y-0">
                    <strong className="truncate text-[14px] font-semibold tracking-tight text-[var(--hos-ink)]">
                      {stay.guestName}
                    </strong>
                    {stay.vip ? (
                      <span className="shrink-0 text-[10px] font-semibold text-[var(--hos-brass-ink)]">
                        VIP
                      </span>
                    ) : null}
                    <span className="truncate font-mono text-[10px] tabular-nums text-[var(--hos-ink-3)]">
                      {stay.confirmationNo}
                      {stay.roomNumber ? ` · Rm ${stay.roomNumber}` : ""}
                    </span>
                  </div>
                  <p className="m-0 mt-0.5 truncate text-[11px] text-[var(--hos-ink-3)]">
                    <span className="capitalize">
                      {stay.status.replace("_", " ")}
                    </span>
                    <span className="mx-1 opacity-40">·</span>
                    {BILLING_MODE_LABEL[stayBillingMode(stay)]}
                  </p>
                </>
              )}
            </div>
          ) : null
        }
        footer={
          stay ? (
            <div className="flex items-center gap-2">
              {isGroupHub ? (
                <>
                  {peers.some(
                    (p) =>
                      ["confirmed", "held"].includes(p.status) && !p.roomId,
                  ) ? (
                    <Button
                      size="sm"
                      className="hos-btn-ink !h-9 flex-1 !rounded-xl text-[13px] font-semibold"
                      onClick={() => setTab("group")}
                    >
                      Assign rooms
                    </Button>
                  ) : null}
                  {peers.some((p) =>
                    ["confirmed", "held"].includes(p.status),
                  ) ? (
                    <Button
                      size="sm"
                      className="hos-btn-ink !h-9 flex-1 !rounded-xl text-[13px] font-semibold"
                      data-testid="stayhub-footer-party-check-in"
                      onClick={() => {
                        setTab("group");
                        runPartyCheckIn();
                      }}
                    >
                      Party check-in
                    </Button>
                  ) : null}
                  <Button
                    size="sm"
                    variant="secondary"
                    className="!h-9 !rounded-xl !px-2.5 text-[12px]"
                    onClick={() => {
                      setTab("group");
                      setGroupInvoiceOpen(true);
                    }}
                  >
                    Agency bill
                  </Button>
                </>
              ) : (
                <>
                  {!stay.roomId && ["confirmed", "held"].includes(stay.status) ? (
                    <Button
                      size="sm"
                      className="hos-btn-ink !h-9 flex-1 !rounded-xl text-[13px] font-semibold"
                      onClick={() => setTab("controls")}
                    >
                      Assign room
                    </Button>
                  ) : null}
                  {stay.status === "held" && stay.roomId ? (
                    <Button
                      size="sm"
                      className="hos-btn-ink !h-9 flex-1 !rounded-xl text-[13px] font-semibold"
                      onClick={() => {
                        void confirmHold(stay.id).then((res) => {
                          if (!res.ok) toast.error(res.error);
                          else toast.success("Hold confirmed");
                        });
                      }}
                    >
                      Confirm hold
                    </Button>
                  ) : null}
                  {["confirmed", "held"].includes(stay.status) && stay.roomId ? (
                    <Button
                      size="sm"
                      data-testid="stayhub-check-in"
                      className="hos-btn-ink !h-9 flex-1 !rounded-xl text-[13px] font-semibold"
                      onClick={runCheckIn}
                    >
                      Check in
                    </Button>
                  ) : null}
                  {stay.status === "checked_in" && due > PERSONAL_CHECKOUT_GATE_BTN ? (
                    <Button
                      size="sm"
                      className="hos-btn-ink !h-9 flex-1 !rounded-xl text-[13px] font-semibold"
                      onClick={() => {
                        setStreamFocus("personal");
                        setTab("streams");
                        setCashGiven(due);
                      }}
                    >
                      Collect {formatNu(due)}
                    </Button>
                  ) : null}
                  {stay.status === "checked_in" && due <= PERSONAL_CHECKOUT_GATE_BTN ? (
                    <Button
                      size="sm"
                      data-testid="stayhub-check-out"
                      className="hos-btn-ink !h-9 flex-1 !rounded-xl text-[13px] font-semibold"
                      onClick={tryCheckout}
                    >
                      Check out
                    </Button>
                  ) : null}
                  {["confirmed", "held"].includes(stay.status) ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      data-testid="stayhub-cancel-room"
                      className="!h-9 !rounded-xl !px-2.5 text-[12px] text-[var(--hos-ruby)]"
                      onClick={() => {
                        if (
                          !window.confirm(
                            `Cancel this room for ${stay.guestName}? Folio stays for audit — status becomes cancelled.`,
                          )
                        ) {
                          return;
                        }
                        void cancelStay(stay.id).then((res) => {
                          if (!res.ok) toast.error(res.error);
                          else {
                            toast.success("Room cancelled");
                            openStay(null);
                          }
                        });
                      }}
                    >
                      Cancel room
                    </Button>
                  ) : null}
                </>
              )}
              <Button
                size="sm"
                variant="ghost"
                className="!h-9 !min-w-9 !rounded-xl !px-2 text-[12px]"
                onClick={() => {
                  // Guest / personal folio paper.
                  setStreamFocus("personal");
                  if (isGroupHub) setTab("streams");
                  setInvoiceOpen(true);
                }}
                aria-label="Guest bill"
                data-testid="stayhub-guest-bill"
              >
                Guest bill
              </Button>
              {!isGroupHub ? (
                <Button
                  size="sm"
                  variant="secondary"
                  className="!h-9 !rounded-xl !px-2.5 text-[12px]"
                  onClick={() => {
                    // Agency / city-ledger paper — room+meal from rack land here.
                    setStreamFocus("master");
                    setTab("streams");
                    setInvoiceOpen(true);
                  }}
                  aria-label="Agency bill"
                  data-testid="stayhub-agency-bill"
                >
                  Agency bill
                </Button>
              ) : null}
              {!isGroupHub ? (
                <Button
                  size="sm"
                  variant="ghost"
                  className="!h-9 !min-w-9 !rounded-xl !px-2 text-[12px]"
                  onClick={() =>
                    navigate(`/print/fo?stay=${encodeURIComponent(stay.id)}`)
                  }
                  aria-label="Registration card"
                >
                  Reg
                </Button>
              ) : null}
            </div>
          ) : null
        }
      >
        {!stay ? (
          <div className="animate-pulse rounded-lg border border-[var(--hos-line)] bg-[var(--hos-cell)] p-6 text-sm text-[var(--hos-ink-3)]">
            Loading stay…
          </div>
        ) : (
          <div className="flex flex-col gap-1.5 pb-1">
            {docCaptureOpen ? (
              <div
                className="rounded-lg border border-[var(--hos-line)] bg-[var(--hos-canvas-2)] p-2.5"
                data-testid="stayhub-doc-capture"
              >
                <strong className="block text-[12px] font-semibold text-[var(--hos-ink)]">
                  Document scan
                </strong>
                <p className="m-0 mt-0.5 text-[11px] text-[var(--hos-ink-3)]">
                  Capture passport / CID before check-in
                </p>
                <label className="mt-2 grid gap-1 text-[11px] font-medium text-[var(--hos-ink-2)]">
                  Passport or CID
                  <input
                    data-testid="stayhub-doc-id"
                    value={idDraft}
                    onChange={(e) => setIdDraft(e.target.value)}
                    placeholder="P-BT-… / CID-…"
                    className="rounded-lg border border-[var(--hos-line)] bg-[var(--hos-cell)] px-2.5 py-2 text-sm"
                    autoFocus
                  />
                </label>
                <label className="mt-1.5 grid gap-1 text-[11px] font-medium text-[var(--hos-ink-2)]">
                  Nationality
                  <input
                    data-testid="stayhub-doc-nat"
                    value={natDraft}
                    onChange={(e) => setNatDraft(e.target.value)}
                    placeholder="e.g. Bhutanese"
                    className="rounded-lg border border-[var(--hos-line)] bg-[var(--hos-cell)] px-2.5 py-2 text-sm"
                  />
                </label>
                <div className="mt-2 flex gap-1.5">
                  <Button
                    size="sm"
                    data-testid="stayhub-doc-confirm"
                    className="hos-btn-ink flex-1"
                    onClick={confirmDocAndCheckIn}
                  >
                    Save & check in
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setDocCaptureOpen(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : null}

            {/* Dual stream skim — group stays show agency TOTAL (all rooms) + this-room share */}
            <div className="grid grid-cols-2 gap-px overflow-hidden rounded-md border border-[var(--hos-line)] bg-[var(--hos-line)]">
              <button
                type="button"
                onClick={() => {
                  setTab("streams");
                  setStreamFocus("master");
                }}
                className={`px-2.5 py-1.5 text-left ${
                  streamFocus === "master" && tab === "streams"
                    ? "bg-[color-mix(in_srgb,var(--hos-primary)_10%,var(--hos-cell))]"
                    : "bg-[var(--hos-cell)] hover:bg-[color-mix(in_srgb,var(--hos-primary)_5%,var(--hos-cell))]"
                }`}
              >
                <div className="text-[9px] font-medium uppercase tracking-[0.06em] text-[var(--hos-ink-3)]">
                  {stay.groupId
                    ? `Agency · ${peers.length || 1} rooms`
                    : "Agency · this room"}
                </div>
                <div className="font-mono text-[13px] font-semibold tabular-nums tracking-tight text-[var(--hos-ink)]">
                  {formatNu(
                    stay.groupId && groupRollup
                      ? groupRollup.master
                      : (master?.balance ?? 0),
                  )}
                </div>
                {stay.groupId && groupRollup ? (
                  <div className="mt-0.5 font-mono text-[9px] tabular-nums text-[var(--hos-ink-3)]">
                    This room {formatNu(master?.balance ?? 0)}
                  </div>
                ) : null}
              </button>
              <button
                type="button"
                onClick={() => {
                  setTab("streams");
                  setStreamFocus("personal");
                }}
                className={`px-2.5 py-1.5 text-left ${
                  streamFocus === "personal" && tab === "streams"
                    ? "bg-[color-mix(in_srgb,var(--hos-primary)_10%,var(--hos-cell))]"
                    : "bg-[var(--hos-cell)] hover:bg-[color-mix(in_srgb,var(--hos-primary)_5%,var(--hos-cell))]"
                }`}
              >
                <div className="text-[9px] font-medium uppercase tracking-[0.06em] text-[var(--hos-ink-3)]">
                  {stay.groupId ? "Guest extras · room" : "Guest due"}
                </div>
                <div
                  className={`font-mono text-[13px] font-semibold tabular-nums tracking-tight ${
                    due > PERSONAL_CHECKOUT_GATE_BTN ? "text-[var(--hos-ruby)]" : "text-[var(--hos-ink)]"
                  }`}
                >
                  {formatNu(due)}
                </div>
                {stay.groupId && groupRollup && groupRollup.personal > PERSONAL_CHECKOUT_GATE_BTN ? (
                  <div className="mt-0.5 font-mono text-[9px] tabular-nums text-[var(--hos-ink-3)]">
                    All rooms {formatNu(groupRollup.personal)}
                  </div>
                ) : null}
              </button>
            </div>

            <div className="relative flex gap-0.5 overflow-x-auto border-b border-[var(--hos-line)]">
              {tabs.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id)}
                  className={[
                    "relative whitespace-nowrap px-2 py-1 text-[12px] font-medium transition-colors",
                    tab === t.id
                      ? "text-[var(--hos-primary)]"
                      : "text-[var(--hos-ink-3)] hover:text-[var(--hos-ink-2)]",
                  ].join(" ")}
                >
                  {t.label}
                  {t.id === "notes" && stay.notes ? (
                    <span className="ml-1 inline-block size-1 rounded-full bg-[var(--hos-primary)]" />
                  ) : null}
                  {t.id === "group" && peers.length > 0 ? (
                    <span className="ml-1 font-mono text-[10px] text-[var(--hos-ink-3)]">
                      {peers.length}
                    </span>
                  ) : null}
                  {tab === t.id ? (
                    <motion.span
                      layoutId="stayHubTabPill"
                      className="absolute inset-x-1 -bottom-px h-0.5 rounded-full bg-[var(--hos-primary)]"
                      transition={{ type: "spring", stiffness: 480, damping: 34 }}
                    />
                  ) : null}
                </button>
              ))}
            </div>

            <AnimatePresence mode="wait">
              <motion.div
                key={tab}
                initial={false}
                animate={{ opacity: 1 }}
                className="grid gap-2"
              >
                {tab === "group" && stay.groupId && groupRollup ? (
                  <>
                    <div className="glass-card relative overflow-hidden rounded-2xl border border-white/12 p-3 shadow-[inset_0_1px_1px_rgba(255,255,255,0.12)]">
                      <div
                        className="pointer-events-none absolute inset-0 opacity-40"
                        style={{
                          background:
                            "radial-gradient(120% 80% at 100% 0%, color-mix(in srgb, var(--hos-brass) 28%, transparent), transparent 55%)",
                        }}
                      />
                      <div className="relative flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="m-0 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--hos-brass-ink)]">
                            One agency bill
                          </p>
                          <strong className="mt-0.5 block truncate text-[15px] font-semibold tracking-tight text-[var(--hos-ink)]">
                            {stay.agencyName ??
                              groupRollup.meta?.agencyName ??
                              stay.groupName ??
                              "Tour party"}
                          </strong>
                          <p className="m-0 mt-1 text-[11px] leading-snug text-[var(--hos-ink-2)]">
                            All rooms’ <strong>room + meals</strong> on this master. Food,
                            laundry, minibar stay on each <strong>guest</strong> folio.
                          </p>
                          <p className="m-0 mt-1 text-[10px] text-[var(--hos-ink-3)]">
                            {peers.length} rooms ·{" "}
                            {peers.reduce((n, p) => n + (p.luggage?.count ?? 0), 0)} luggage ·{" "}
                            {groupRollup.meta?.mealPlan ?? stay.mealPlan}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="relative !h-8 shrink-0 !rounded-full !px-2.5 text-[11px]"
                          onClick={() => {
                            openStay(null);
                            navigate(`/groups?id=${stay.groupId}`);
                          }}
                        >
                          Groups
                        </Button>
                      </div>
                      <div className="relative mt-3 grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setGroupInvoiceOpen(true)}
                          className="rounded-xl border border-[var(--hos-line)] bg-[var(--hos-cell)] px-2.5 py-2 text-left transition hover:border-[var(--hos-brass)]"
                        >
                          <div className="text-[9px] font-semibold uppercase tracking-wide text-[var(--hos-ink-3)]">
                            Agency master · all rooms
                          </div>
                          <div className="font-mono text-[16px] font-semibold tabular-nums text-[var(--hos-ink)]">
                            {formatNu(groupRollup.master)}
                          </div>
                          <div className="mt-0.5 text-[10px] text-[var(--hos-ink-3)]">
                            {peers.length} × room+meals · this room{" "}
                            <span className="font-mono font-semibold text-[var(--hos-ink)]">
                              {formatNu(master?.balance ?? 0)}
                            </span>
                          </div>
                          <div className="mt-0.5 text-[10px] font-medium text-[var(--hos-primary)]">
                            Open group bill →
                          </div>
                        </button>
                        <div className="rounded-xl border border-[var(--hos-line)] bg-[var(--hos-cell)] px-2.5 py-2">
                          <div className="text-[9px] font-semibold uppercase tracking-wide text-[var(--hos-ink-3)]">
                            Guest extras · all rooms
                          </div>
                          <div
                            className={`font-mono text-[16px] font-semibold tabular-nums ${
                              groupRollup.personal > PERSONAL_CHECKOUT_GATE_BTN
                                ? "text-[var(--hos-ruby)]"
                                : "text-[var(--hos-emerald)]"
                            }`}
                          >
                            {formatNu(groupRollup.personal)}
                          </div>
                          <div className="mt-0.5 text-[10px] text-[var(--hos-ink-3)]">
                            This room {formatNu(due)} · collect per room
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-xl border border-[var(--hos-line)] bg-[var(--hos-cell)] p-2.5">
                      <p className="hos-section-label !mb-1 !mt-0">Menus served (read-only)</p>
                      <p className="m-0 mb-1.5 text-[10px] text-[var(--hos-ink-3)]">
                        Posted on Desk mission control by FO / F&amp;B — also shown to the agent
                      </p>
                      <ul className="m-0 grid list-none gap-1.5 p-0">
                        {datesBetween(stay.checkIn, stay.checkOut).map((d) => {
                          const board = mealBoards[d];
                          return (
                            <li
                              key={d}
                              className="rounded-lg border border-[var(--hos-line)] px-2 py-1.5 text-[11px]"
                            >
                              <strong className="font-mono text-[var(--hos-ink)]">{d}</strong>
                              {board ? (
                                <p className="m-0 mt-0.5 text-[var(--hos-ink-2)]">
                                  BF {board.breakfast}
                                  {board.lunch ? ` · Lunch ${board.lunch}` : ""} · Dinner{" "}
                                  {board.dinner}
                                </p>
                              ) : (
                                <p className="m-0 mt-0.5 text-[var(--hos-ink-3)]">
                                  Not posted yet on Desk
                                </p>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    </div>

                    <div>
                      <p className="hos-section-label !mb-1.5 !mt-0">Apply meal to all rooms</p>
                      <div className="flex rounded-full border border-[var(--hos-line)] bg-[var(--hos-cell)] p-0.5">
                        {MEALS.map((m) => (
                          <button
                            key={m}
                            type="button"
                            onClick={() => {
                              void applyGroupMealPlan(stay.groupId!, m).then((res) => {
                                if (!res.ok) toast.error(res.error);
                                else {
                                  setStreamFocus("master");
                                  toast.success(`${m} on ${res.updated} rooms · Agency folios`, {
                                    description: stay.groupName ?? undefined,
                                  });
                                }
                              });
                            }}
                            className={`flex-1 rounded-full py-1.5 text-[11px] font-medium ${
                              stay.mealPlan === m
                                ? "bg-[var(--hos-primary)] text-white"
                                : "text-[var(--hos-ink-2)]"
                            }`}
                          >
                            {m}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-xl border border-[rgba(245,158,11,0.35)] bg-[rgba(245,158,11,0.06)] p-2.5">
                      <div className="mb-1.5 flex flex-wrap items-center justify-between gap-1.5">
                        <p className="hos-section-label !m-0">
                          Uniform party rate · despite category
                        </p>
                        {groupRollup?.meta?.rateMode === "uniform" &&
                        groupRollup.meta.uniformNightlyNet != null ? (
                          <Badge tone="vip">
                            Uniform · {formatNu(groupRollup.meta.uniformNightlyNet)}/n ·
                            all types
                          </Badge>
                        ) : (
                          <span className="text-[10px] text-[var(--hos-ink-3)]">
                            Agent / walk-in contract
                          </span>
                        )}
                      </div>
                      <p className="m-0 mb-2 text-[10px] text-[var(--hos-ink-3)]">
                        One EP room net on every peer (EXE, DLX, …). Meals stay on the
                        meal control above.
                      </p>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <input
                          type="number"
                          min={0}
                          step={50}
                          value={partyNetDraft}
                          onChange={(e) => setPartyNetDraft(e.target.value)}
                          className="hos-input min-w-[7rem] flex-1 !min-h-8 !font-mono !text-[12px] !tabular-nums"
                          placeholder="Nu / night EP"
                          data-testid="stayhub-party-net"
                          aria-label="Party room net EP"
                        />
                        <Button
                          size="sm"
                          variant="secondary"
                          className="!h-8 !rounded-xl text-[11px] font-semibold"
                          data-testid="stayhub-apply-party-net"
                          onClick={() => {
                            const net = Math.max(0, Number(partyNetDraft) || 0);
                            void applyGroupNightlyNet(stay.groupId!, net).then((res) => {
                              if (!res.ok) {
                                toast.error(res.error);
                                return;
                              }
                              setStreamFocus("master");
                              toast.success(
                                `Uniform ${formatNu(net)}/n on ${res.updated} rooms`,
                                {
                                  description:
                                    "Same EP net despite room type · agency master package updated",
                                },
                              );
                            });
                          }}
                        >
                          Apply to all rooms
                        </Button>
                      </div>
                    </div>

                    <div className="flex flex-col gap-1.5 sm:flex-row sm:flex-wrap">
                      {peers.some((p) =>
                        ["confirmed", "held"].includes(p.status),
                      ) ? (
                        <Button
                          size="sm"
                          data-testid="stayhub-party-check-in"
                          className="hos-btn-ink !h-9 flex-1 !rounded-xl text-[12px] font-semibold"
                          onClick={() => runPartyCheckIn()}
                        >
                          Check in party
                        </Button>
                      ) : null}
                      {peers.some((p) =>
                        ["confirmed", "held"].includes(p.status),
                      ) ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          data-testid="stayhub-cancel-group"
                          className="!h-9 flex-1 !rounded-xl text-[12px] font-semibold text-[var(--hos-ruby)]"
                          onClick={() => {
                            if (
                              !window.confirm(
                                `Cancel all held/confirmed rooms in “${stay.groupName ?? "this group"}”? In-house rooms are skipped.`,
                              )
                            ) {
                              return;
                            }
                            void cancelGroup(stay.groupId!).then((res) => {
                              if (!res.ok) {
                                toast.error(res.error);
                                return;
                              }
                              toast.success(`Cancelled ${res.cancelled} room(s)`, {
                                description:
                                  res.blocked.length > 0
                                    ? res.blocked.slice(0, 2).join(" · ")
                                    : undefined,
                              });
                              if (res.cancelled > 0) openStay(null);
                            });
                          }}
                        >
                          Cancel all rooms
                        </Button>
                      ) : null}
                      {peers.length > 0 &&
                      peers.every((p) => p.status === "checked_in") &&
                      peers.every(
                        (p) => folioBalance(p, "personal") <= PERSONAL_CHECKOUT_GATE_BTN,
                      ) ? (
                        <Button
                          size="sm"
                          data-testid="stayhub-party-check-out"
                          className="hos-btn-ink !h-9 flex-1 !rounded-xl text-[12px] font-semibold"
                          onClick={() => {
                            start(() => {
                              void (async () => {
                                let ok = 0;
                                const blocked: string[] = [];
                                for (const p of peers) {
                                  const res = await checkOut(p.id);
                                  if (res.ok) ok += 1;
                                  else
                                    blocked.push(
                                      `${p.roomNumber ?? "—"}: ${res.error}`,
                                    );
                                }
                                if (ok > 0)
                                  toast.success(`Checked out ${ok} room(s)`);
                                if (blocked.length)
                                  toast.error("Some rooms blocked", {
                                    description: blocked.slice(0, 2).join(" · "),
                                  });
                                if (ok === peers.length) openStay(null);
                              })();
                            });
                          }}
                        >
                          Check out party
                        </Button>
                      ) : null}
                      <Button
                        size="sm"
                        variant="secondary"
                        className="!h-9 flex-1 !rounded-xl text-[12px] font-semibold"
                        onClick={() => setGroupInvoiceOpen(true)}
                      >
                        Print agency bill
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        data-testid="stayhub-settle-group"
                        className="!h-9 flex-1 !rounded-xl text-[12px] font-semibold"
                        onClick={() => {
                          start(() => {
                            void (async () => {
                              const pinOk =
                                tender === "city_ledger"
                                  ? verifyDeskManagerPin(groupSettlePin).ok
                                  : true;
                              const res = await settleGroupMaster(stay.groupId!, {
                                method: tender === "rma_qr" ? "rma_qr" : tender,
                                pinConfirmed: pinOk,
                              });
                              if (!res.ok) toast.error(res.error);
                              else
                                toast.success(
                                  `Agency master settled · ${formatNu(res.totalAmount)}`,
                                  {
                                    description:
                                      res.blocked.length > 0
                                        ? res.blocked.slice(0, 2).join(" · ")
                                        : `${res.settled} room(s) · city / cash on master`,
                                  },
                                );
                              setGroupSettlePin("");
                            })();
                          });
                        }}
                      >
                        Settle agency
                      </Button>
                    </div>
                    {tender === "city_ledger" ? (
                      <input
                        value={groupSettlePin}
                        onChange={(e) => setGroupSettlePin(e.target.value)}
                        type="password"
                        inputMode="numeric"
                        placeholder="Manager PIN for city ledger"
                        className="hos-input !min-h-8 !text-[12px]"
                      />
                    ) : null}

                    <div className="overflow-hidden rounded-xl border border-[var(--hos-line)] bg-[var(--hos-cell)]">
                      <div className="border-b border-[var(--hos-line)] px-2.5 py-1.5 text-[10px] font-medium uppercase tracking-wide text-[var(--hos-ink-3)]">
                        Peers · {peers.length} · assign here
                      </div>
                      <ul className="m-0 max-h-[min(55vh,480px)] list-none overflow-y-auto p-0">
                        {peers.map((p) => {
                          const expanded = peerExpandId === p.id;
                          const allowUpgrade = Boolean(peerShowUpgrades[p.id]);
                          const peerCandidates = rooms
                            .filter(
                              (r) =>
                                r.hkStatus !== "ooo" &&
                                r.hkStatus !== "occupied" &&
                                (r.id === p.roomId ||
                                  allowUpgrade ||
                                  r.typeCode === p.typeCode) &&
                                (r.id === p.roomId ||
                                  !stays.some(
                                    (s) =>
                                      s.roomId === r.id &&
                                      s.id !== p.id &&
                                      ["confirmed", "held", "checked_in"].includes(
                                        s.status,
                                      ),
                                  )),
                            )
                            .sort((a, b) => {
                              const aMatch = a.typeCode === p.typeCode ? 0 : 1;
                              const bMatch = b.typeCode === p.typeCode ? 0 : 1;
                              return aMatch - bMatch || a.number.localeCompare(b.number);
                            });
                          const pick = peerRoomPick[p.id] ?? p.roomId ?? "";
                          const docsStatus = docsStatusForStay({
                            ...p,
                            isDeferredPartyId: (id) => isDeferredPartyId(id),
                          });
                          const bags = luggageHint(p);
                          const canAssignRoom = ["confirmed", "held"].includes(
                            p.status,
                          );
                          return (
                            <li
                              key={p.id}
                              className="border-b border-[var(--hos-line)] last:border-b-0"
                            >
                              <div className="flex flex-wrap items-center gap-1.5 px-2.5 py-1.5">
                                <button
                                  type="button"
                                  onClick={() => openStay(p.id)}
                                  className={`min-w-0 flex-1 truncate text-left text-[12px] font-medium ${
                                    p.id === stay.id
                                      ? "text-[var(--hos-primary)]"
                                      : "text-[var(--hos-ink)]"
                                  }`}
                                >
                                  <span className="font-mono text-[11px]">
                                    {p.roomNumber ?? "—"}
                                  </span>{" "}
                                  {p.guestName}
                                  <span className="ml-1 font-mono text-[10px] font-normal text-[var(--hos-ink-3)]">
                                    · {p.typeCode}
                                  </span>
                                </button>
                                {docsStatus !== "ok" ? (
                                  <Badge tone="vip">
                                    {docsStatusLabel(docsStatus)}
                                  </Badge>
                                ) : (
                                  <Badge tone="muted">{p.status.replace("_", " ")}</Badge>
                                )}
                                {bags ? (
                                  <span className="truncate text-[10px] text-[var(--hos-ink-3)]">
                                    {bags}
                                  </span>
                                ) : null}
                                <span
                                  className={`shrink-0 font-mono text-[11px] ${
                                    folioBalance(p, "personal") > PERSONAL_CHECKOUT_GATE_BTN
                                      ? "text-[var(--hos-ruby)]"
                                      : "text-[var(--hos-ink-3)]"
                                  }`}
                                >
                                  {formatNu(folioBalance(p, "personal"))}
                                </span>
                                {["confirmed", "held"].includes(p.status) ? (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="!h-6 !rounded-full !px-2 text-[10px] text-[var(--hos-ruby)]"
                                    onClick={() => {
                                      if (
                                        !window.confirm(
                                          `Cancel ${p.guestName} (${p.roomNumber ?? "unassigned"})?`,
                                        )
                                      ) {
                                        return;
                                      }
                                      void cancelStay(p.id).then((res) => {
                                        if (!res.ok) toast.error(res.error);
                                        else toast.success(`Cancelled · ${p.guestName}`);
                                      });
                                    }}
                                  >
                                    Cancel
                                  </Button>
                                ) : null}
                              </div>
                              <div className="flex flex-wrap items-center gap-1.5 px-2.5 pb-1.5">
                                {canAssignRoom ? (
                                  <>
                                    <select
                                      value={pick}
                                      onChange={(e) =>
                                        setPeerRoomPick((prev) => ({
                                          ...prev,
                                          [p.id]: e.target.value,
                                        }))
                                      }
                                      className="min-w-[7rem] flex-1 rounded-lg border border-[var(--hos-line)] bg-[var(--hos-bg)] px-2 py-1 text-[11px]"
                                    >
                                      <option value="">
                                        Select {p.typeCode}…
                                        {peerCandidates.length === 0
                                          ? " (none free)"
                                          : ""}
                                      </option>
                                      {peerCandidates.map((r) => (
                                        <option key={r.id} value={r.id}>
                                          {r.number} · {r.typeName}
                                          {r.typeCode !== p.typeCode
                                            ? " · upgrade"
                                            : ""}
                                          {" · "}
                                          {r.hkStatus}
                                        </option>
                                      ))}
                                    </select>
                                    <button
                                      type="button"
                                      className={`!h-7 shrink-0 rounded-full px-2 text-[10px] font-semibold ${
                                        allowUpgrade
                                          ? "bg-[rgba(37,99,235,0.12)] text-[var(--hos-primary)]"
                                          : "text-[var(--hos-ink-3)] hover:text-[var(--hos-ink)]"
                                      }`}
                                      onClick={() =>
                                        setPeerShowUpgrades((prev) => ({
                                          ...prev,
                                          [p.id]: !prev[p.id],
                                        }))
                                      }
                                    >
                                      {allowUpgrade ? "Type only" : "Upgrades"}
                                    </button>
                                    <Button
                                      size="sm"
                                      variant="secondary"
                                      className="!h-7 !rounded-full !px-2.5 text-[10px]"
                                      disabled={!pick}
                                      onClick={() => {
                                        void (async () => {
                                          if (!pick) return;
                                          const room = rooms.find(
                                            (r) => r.id === pick,
                                          );
                                          const res = await assignPeerRoom(
                                            p.id,
                                            pick,
                                            {
                                              moveReason:
                                                p.roomId && p.roomId !== pick
                                                  ? "operations"
                                                  : undefined,
                                            },
                                          );
                                          if (!res.ok) {
                                            toast.error(res.error, {
                                              description:
                                                "Pick a free clean/inspected room, then Assign",
                                            });
                                            return;
                                          }
                                          toast.success(
                                            `Assigned · Rm ${room?.number ?? pick}`,
                                            { description: p.guestName },
                                          );
                                          setPeerRoomPick((prev) => ({
                                            ...prev,
                                            [p.id]: pick,
                                          }));
                                        })();
                                      }}
                                    >
                                      Assign
                                    </Button>
                                  </>
                                ) : null}
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="!h-7 !rounded-full !px-2 text-[10px]"
                                  onClick={() => {
                                    if (expanded) {
                                      setPeerExpandId(null);
                                      return;
                                    }
                                    setPeerExpandId(p.id);
                                    setBagCount(p.luggage?.count ?? 0);
                                    setBagColor(p.luggage?.color || "black");
                                    setBagDesc(p.luggage?.description ?? "");
                                  }}
                                >
                                  {expanded ? "Close" : "Luggage"}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="!h-7 !rounded-full !px-2 text-[10px]"
                                  data-testid={`stayhub-goto-guests-${p.id}`}
                                  onClick={() => {
                                    openStay(p.id);
                                    setTab("guests");
                                  }}
                                >
                                  Guests &amp; Docs
                                </Button>
                              </div>
                              {expanded ? (
                                <div className="grid gap-1.5 bg-[color-mix(in_srgb,var(--hos-primary)_4%,var(--hos-cell))] px-2.5 py-2">
                                  <p className="m-0 text-[11px] text-[var(--hos-ink-3)]">
                                    Names &amp; passports →{" "}
                                    <button
                                      type="button"
                                      className="font-semibold text-[var(--hos-primary)] underline-offset-2 hover:underline"
                                      onClick={() => {
                                        openStay(p.id);
                                        setTab("guests");
                                      }}
                                    >
                                      Guests &amp; Docs
                                    </button>
                                    . Luggage tags stay here for HK / Paro —
                                    laundry bags are on Laundry.
                                  </p>
                                  <div className="grid grid-cols-3 gap-1.5">
                                    <label className="grid gap-0.5 text-[10px] font-medium text-[var(--hos-ink-2)]">
                                      Pieces
                                      <input
                                        type="number"
                                        min={0}
                                        max={20}
                                        value={bagCount}
                                        onChange={(e) =>
                                          setBagCount(Number(e.target.value) || 0)
                                        }
                                        className="hos-input !min-h-8 !font-mono !text-[12px]"
                                      />
                                    </label>
                                    <label className="grid gap-0.5 text-[10px] font-medium text-[var(--hos-ink-2)]">
                                      Colour
                                      <select
                                        value={bagColor}
                                        onChange={(e) => setBagColor(e.target.value)}
                                        className="hos-input !min-h-8 !text-[12px]"
                                      >
                                        {LUGGAGE_COLORS.map((c) => (
                                          <option key={c} value={c}>
                                            {c}
                                          </option>
                                        ))}
                                      </select>
                                    </label>
                                    <label className="col-span-3 grid gap-0.5 text-[10px] font-medium text-[var(--hos-ink-2)] sm:col-span-1">
                                      Description
                                      <input
                                        value={bagDesc}
                                        onChange={(e) => setBagDesc(e.target.value)}
                                        className="hos-input !min-h-8 !text-[12px]"
                                        placeholder="Hard case + soft duffel"
                                      />
                                    </label>
                                  </div>
                                  <Button
                                    size="sm"
                                    className="!h-8 !rounded-full text-[11px]"
                                    onClick={() => {
                                      void (async () => {
                                        const res = await updateStayGuestRoster(p.id, {
                                          luggage: {
                                            count: bagCount,
                                            color: bagColor,
                                            description: bagDesc,
                                          },
                                        });
                                        if (!res.ok) toast.error(res.error);
                                        else toast.success("Luggage saved");
                                      })();
                                    }}
                                  >
                                    Save luggage
                                  </Button>
                                </div>
                              ) : null}
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  </>
                ) : null}

                {tab === "guests" ? (
                  <GuestDocsPanel
                    drafts={guestDocsDrafts}
                    onDraftsChange={setGuestDocsDrafts}
                    stays={stays}
                    focusStay={stay}
                    isGroupHub={isGroupHub}
                    busyId={guestDocsBusyId}
                    saveAllBusy={guestDocsSaveAllBusy}
                    setBusyId={setGuestDocsBusyId}
                    isDeferredPartyId={isDeferredPartyId}
                    onSaveRow={async (row) => {
                      return updateStayGuestRoster(row.stayId, {
                        guestName: row.guestName,
                        passportOrCid: row.passportOrCid || undefined,
                        nationality: row.nationality || undefined,
                        companions: row.companionName.trim()
                          ? [
                              {
                                name: row.companionName.trim(),
                                passportOrCid:
                                  row.companionPassportOrCid.trim() || undefined,
                                nationality:
                                  row.companionNationality.trim() || undefined,
                              },
                            ]
                          : [],
                      });
                    }}
                    onSaveAll={async () => {
                      setGuestDocsSaveAllBusy(true);
                      let okCount = 0;
                      let lastErr = "";
                      for (const row of guestDocsDrafts) {
                        const res = await updateStayGuestRoster(row.stayId, {
                          guestName: row.guestName,
                          passportOrCid: row.passportOrCid || undefined,
                          nationality: row.nationality || undefined,
                          companions: row.companionName.trim()
                            ? [
                                {
                                  name: row.companionName.trim(),
                                  passportOrCid:
                                    row.companionPassportOrCid.trim() ||
                                    undefined,
                                  nationality:
                                    row.companionNationality.trim() || undefined,
                                },
                              ]
                            : [],
                        });
                        if (!res.ok) {
                          lastErr = res.error;
                          break;
                        }
                        okCount += 1;
                      }
                      setGuestDocsSaveAllBusy(false);
                      if (lastErr) {
                        toast.error(lastErr, {
                          description: `Saved ${okCount}/${guestDocsDrafts.length} rooms`,
                        });
                      } else {
                        toast.success(
                          `Guest roster saved · ${okCount} room${okCount === 1 ? "" : "s"}`,
                        );
                      }
                    }}
                  />
                ) : null}

                {tab === "streams" ? (
                  <>
                    {stay.groupId && streamFocus === "master" && groupRollup ? (
                      <div className="rounded-xl border border-[color-mix(in_srgb,var(--hos-brass)_35%,transparent)] bg-[color-mix(in_srgb,var(--hos-brass)_10%,var(--hos-cell))] px-2.5 py-2 text-[11px] leading-snug text-[var(--hos-ink-2)]">
                        <strong className="text-[var(--hos-ink)]">
                          Folio = this room only
                        </strong>
                        {" · "}
                        Agency share{" "}
                        <span className="font-mono font-semibold text-[var(--hos-ink)]">
                          {formatNu(master?.balance ?? 0)}
                        </span>
                        {" · "}
                        All {peers.length} rooms{" "}
                        <span className="font-mono font-semibold text-[var(--hos-ink)]">
                          {formatNu(groupRollup.master)}
                        </span>
                        <button
                          type="button"
                          className="ml-1 font-semibold text-[var(--hos-primary)] underline-offset-2 hover:underline"
                          onClick={() => setTab("group")}
                        >
                          Group bill →
                        </button>
                      </div>
                    ) : null}
                    <div className="flex items-center justify-between gap-2">
                      <p className="m-0 text-[10px] font-medium uppercase tracking-wide text-[var(--hos-ink-3)]">
                        {streamFocus === "master"
                          ? stay.groupId
                            ? "Agency lines · this room"
                            : "Agency lines"
                          : "Guest lines · this room"}
                      </p>
                      <button
                        type="button"
                        onClick={() => setShowVoided((v) => !v)}
                        className="text-[10px] font-medium text-[var(--hos-primary)]"
                      >
                        {showVoided ? "Hide voided" : "Show voided"}
                      </button>
                    </div>

                    <div className="hos-scrollbar-slim max-h-[min(52vh,420px)] overflow-auto rounded-lg border border-[var(--hos-line)] bg-[var(--hos-cell)]">
                      <table className="w-full border-collapse text-left text-[12px]">
                        <thead className="sticky top-0 z-[1] bg-[var(--hos-cell)]">
                          <tr className="border-b border-[var(--hos-line)] text-[10px] font-medium uppercase tracking-[0.06em] text-[var(--hos-ink-3)]">
                            <th className="px-3 py-2 font-medium">Description</th>
                            <th className="px-2 py-2 text-right font-medium">Net</th>
                            <th className="hidden px-2 py-2 text-right font-medium sm:table-cell">
                              SC
                            </th>
                            <th className="hidden px-2 py-2 text-right font-medium sm:table-cell">
                              BST
                            </th>
                            <th className="px-2 py-2 text-right font-medium">Amt</th>
                            <th className="px-1 py-2" />
                          </tr>
                        </thead>
                        <tbody>
                          {folioRows.map((l) => (
                              <tr
                                key={l.id}
                                className={`border-b border-[var(--hos-line)] align-top last:border-b-0 ${
                                  l.voided ? "opacity-40 line-through" : ""
                                }`}
                              >
                                <td className="px-3 py-2">
                                  <div className="font-medium text-[var(--hos-ink)]">
                                    {l.description}
                                  </div>
                                  <div className="mt-0.5 font-mono text-[10px] tabular-nums text-[var(--hos-ink-3)]">
                                    {l.kind}
                                    <span className="mx-1 opacity-40">·</span>
                                    {new Date(l.postedAt).toLocaleString("en-GB", {
                                      day: "2-digit",
                                      month: "short",
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    })}
                                  </div>
                                </td>
                                <td className="px-2 py-2 text-right font-mono tabular-nums text-[var(--hos-ink-2)]">
                                  {l.kind === "payment" ? "—" : formatNu(l.netAmount)}
                                </td>
                                <td className="hidden px-2 py-2 text-right font-mono tabular-nums text-[var(--hos-ink-3)] sm:table-cell">
                                  {l.kind === "payment" ? "—" : formatNu(l.scAmount)}
                                </td>
                                <td className="hidden px-2 py-2 text-right font-mono tabular-nums text-[var(--hos-ink-3)] sm:table-cell">
                                  {l.kind === "payment" ? "—" : formatNu(l.bstAmount)}
                                </td>
                                <td
                                  className={`px-2 py-2 text-right font-mono font-semibold tabular-nums ${
                                    l.totalAmount < 0
                                      ? "text-[var(--hos-emerald)]"
                                      : "text-[var(--hos-ink)]"
                                  }`}
                                >
                                  {formatNu(l.totalAmount)}
                                </td>
                                <td className="px-1 py-1.5">
                                  {!l.voided && l.kind !== "payment" ? (
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="!h-7 !min-h-7 !px-1.5 text-[11px]"
                                      onClick={() => {
                                        setVoidTarget(l.id);
                                        setVoidPin("");
                                      }}
                                    >
                                      Void
                                    </Button>
                                  ) : null}
                                </td>
                              </tr>
                            ))}
                          {folioRows.length === 0 ? (
                            <tr>
                              <td
                                colSpan={6}
                                className="px-3 py-10 text-center text-[12px] text-[var(--hos-ink-3)]"
                              >
                                {otherStreamHasLines ? (
                                  <button
                                    type="button"
                                    className="text-[var(--hos-primary)] underline-offset-2 hover:underline"
                                    onClick={() =>
                                      setStreamFocus(
                                        streamFocus === "master" ? "personal" : "master",
                                      )
                                    }
                                  >
                                    No lines here — room & meal list on{" "}
                                    {streamFocus === "master" ? "Guest" : "Agency"} folio
                                  </button>
                                ) : (
                                  `No lines on ${streamFocus === "master" ? "Agency" : "Guest"} folio`
                                )}
                              </td>
                            </tr>
                          ) : null}
                        </tbody>
                        {streamFocus && (master || personal) ? (
                          <tfoot>
                            {(() => {
                              const t = streamFocus === "master" ? master : personal;
                              if (!t) return null;
                              return (
                                <>
                                  <tr className="border-t border-[var(--hos-line)] bg-[color-mix(in_srgb,var(--hos-ink)_3%,var(--hos-cell))]">
                                    <td
                                      colSpan={4}
                                      className="px-3 py-2 text-right text-[11px] font-medium text-[var(--hos-ink-3)]"
                                    >
                                      Charged
                                    </td>
                                    <td className="px-2 py-2 text-right font-mono text-[12px] font-semibold tabular-nums text-[var(--hos-ink)]">
                                      {formatNu(t.charged)}
                                    </td>
                                    <td />
                                  </tr>
                                  <tr className="bg-[color-mix(in_srgb,var(--hos-ink)_3%,var(--hos-cell))]">
                                    <td
                                      colSpan={4}
                                      className="px-3 py-2 text-right text-[11px] font-medium text-[var(--hos-ink-3)]"
                                    >
                                      Balance
                                    </td>
                                    <td
                                      className={`px-2 py-2 text-right font-mono text-[13px] font-semibold tabular-nums ${
                                        t.balance > PERSONAL_CHECKOUT_GATE_BTN
                                          ? "text-[var(--hos-ruby)]"
                                          : "text-[var(--hos-ink)]"
                                      }`}
                                    >
                                      {formatNu(t.balance)}
                                    </td>
                                    <td />
                                  </tr>
                                </>
                              );
                            })()}
                          </tfoot>
                        ) : null}
                      </table>
                    </div>

                    {voidTarget ? (
                      <div className="grid gap-2 rounded-lg border border-[var(--hos-line)] bg-[var(--hos-cell)] p-3">
                        <strong className="text-[12px] font-semibold text-[var(--hos-ink)]">
                          Manager PIN to void
                        </strong>
                        <input
                          type="password"
                          inputMode="numeric"
                          maxLength={4}
                          value={voidPin}
                          onChange={(e) => setVoidPin(e.target.value)}
                          placeholder="····"
                          className="rounded-lg border border-[var(--hos-line)] bg-[var(--hos-cell)] px-3 py-2 text-sm tracking-[0.35em]"
                        />
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => {
                              void (async () => {
                                const res = await voidFolioLine(
                                  stay.id,
                                  voidTarget,
                                  verifyDeskManagerPin(voidPin).ok,
                                );
                                if (!res.ok) toast.error(res.error);
                                else {
                                  toast.success("Line reversed · PIN audit logged");
                                  setVoidTarget(null);
                                  setVoidPin("");
                                }
                              })();
                            }}
                          >
                            Confirm void
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setVoidTarget(null)}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : null}

                    <div className="grid gap-2 rounded-lg border border-[var(--hos-line)] bg-[var(--hos-cell)] p-2.5">
                      <strong className="text-[12px] font-semibold text-[var(--hos-ink)]">
                        Settle{" "}
                        {streamFocus === "master"
                          ? stay.groupId
                            ? "this room’s agency share"
                            : "agency"
                          : "guest"}{" "}
                        <span className="font-mono text-[var(--hos-primary)]">
                          {formatNu(streamDue)}
                        </span>
                      </strong>
                      {stay.groupId && streamFocus === "master" ? (
                        <p className="m-0 text-[10px] text-[var(--hos-ink-3)]">
                          Does not clear the other room. Use Group → Settle agency for
                          all {peers.length} rooms (
                          {formatNu(groupRollup?.master ?? 0)}).
                        </p>
                      ) : null}
                      {tender === "cash" ? (
                        <label className="grid gap-1 text-[11px] font-medium text-[var(--hos-ink-2)]">
                          Cash tendered
                          <input
                            type="number"
                            min={0}
                            value={cashGiven ?? streamDue}
                            onChange={(e) => setCashGiven(Number(e.target.value) || 0)}
                            className="rounded-lg border border-[var(--hos-line)] bg-[var(--hos-cell)] px-3 py-2 text-sm tabular-nums"
                          />
                          <span className="text-[var(--hos-ink-3)]">
                            Change due {formatNu(changeDue)}
                          </span>
                        </label>
                      ) : null}
                      {tender === "city_ledger" || streamFocus === "master" ? (
                        <label className="grid gap-1 text-[11px] font-medium text-[var(--hos-ink-2)]">
                          Manager PIN (city ledger)
                          <input
                            type="password"
                            inputMode="numeric"
                            maxLength={4}
                            value={pin}
                            onChange={(e) => setPin(e.target.value)}
                            className="rounded-lg border border-[var(--hos-line)] bg-[var(--hos-cell)] px-3 py-2 text-sm tracking-[0.3em]"
                          />
                        </label>
                      ) : null}
                      <div className="flex flex-wrap gap-1.5">
                        <Button
                          size="sm"
                          onClick={() => {
                            setTender("cash");
                            setCashGiven(streamDue);
                            runSettle("cash");
                          }}
                        >
                          Cash
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => {
                            setTender("card");
                            runSettle("card");
                          }}
                        >
                          Card
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          data-testid="stayhub-rma-qr"
                          onClick={() => {
                            setTender("rma_qr");
                            setRmaOpen(true);
                          }}
                        >
                          RMA QR
                        </Button>
                        {streamFocus === "master" ? (
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => {
                              setTender("city_ledger");
                              runSettle("city_ledger");
                            }}
                          >
                            City ledger
                          </Button>
                        ) : null}
                        {stayBillingMode(stay) === "standard" &&
                        !stay.taxInvoiceNo ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              const res = issueStayTaxInvoice(stay.id);
                              if (!res.ok) {
                                toast.error(res.error);
                                return;
                              }
                              toast.success(`Tax invoice · ${res.doc.docNo}`);
                              setInvoiceOpen(true);
                            }}
                          >
                            Tax INV
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  </>
                ) : null}

                {tab === "controls" ? (
                  <>
                    <section>
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <p className="hos-section-label !m-0">Billing</p>
                        <span className="text-[11px] text-[var(--hos-ink-3)]">
                          {stay.taxInvoiceNo
                            ? `INV ${stay.taxInvoiceNo}`
                            : "No tax invoice"}
                        </span>
                      </div>
                      <div className="flex rounded-md border border-[var(--hos-line)] bg-[var(--hos-cell)] p-0.5">
                        {BILLING_MODES.map((mode) => {
                          const active = stayBillingMode(stay) === mode;
                          return (
                            <button
                              key={mode}
                              type="button"
                              disabled={Boolean(stay.taxInvoiceId) && mode !== "standard"}
                              onClick={() => {
                                const res = setBillingMode(stay.id, mode);
                                if (!res.ok) toast.error(res.error);
                                else
                                  toast.message(
                                    `Billing → ${BILLING_MODE_LABEL[mode]}`,
                                  );
                              }}
                              className={`relative flex-1 rounded-[5px] px-2 py-1.5 text-[11px] font-medium transition disabled:cursor-not-allowed disabled:opacity-40 ${
                                active
                                  ? "bg-[var(--hos-primary)] text-white"
                                  : "text-[var(--hos-ink-2)] hover:text-[var(--hos-ink)]"
                              }`}
                            >
                              {BILLING_MODE_LABEL[mode]}
                            </button>
                          );
                        })}
                      </div>
                    </section>

                    <div className="hos-cell rounded-xl p-3">
                      <div className="text-[10px] uppercase text-[var(--hos-ink-3)]">
                        Current assignment
                      </div>
                      <strong className="mt-1 block text-[var(--hos-ink)]">
                        {stay.roomNumber
                          ? `Room ${stay.roomNumber} · ${stay.typeCode}`
                          : `Unassigned · needs ${stay.typeCode}`}
                      </strong>
                    </div>

                    {!stay.roomId && smartSuggestions.length > 0 ? (
                      <div className="grid gap-2">
                        <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-[var(--hos-ink-3)]">
                          <Sparkles className="size-3 text-[var(--hos-gold)]" strokeWidth={2} />
                          Smart picks
                        </div>
                        {smartSuggestions.map((s, i) => (
                          <button
                            key={s.room.id}
                            type="button"
                            onClick={() => {
                              void (async () => {
                                const res = await assignPeerRoom(stay.id, s.room.id);
                                if (!res.ok) toast.error(res.error);
                                else
                                  toast.success(`Assigned · Rm ${s.room.number}`, {
                                    description: s.reasons.slice(0, 2).join(" · "),
                                  });
                              })();
                            }}
                            className={[
                              "hos-btn-tactile flex w-full items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left",
                              i === 0
                                ? "border-[#111] bg-[#111] text-white"
                                : "border-[var(--hos-line)] bg-[var(--hos-cell)] text-[var(--hos-ink)]",
                            ].join(" ")}
                          >
                            <span
                              className={[
                                "flex size-10 flex-col items-center justify-center rounded-lg font-mono text-[13px] font-black",
                                i === 0 ? "bg-white/12" : "bg-[rgba(17,17,17,0.06)]",
                              ].join(" ")}
                            >
                              {s.room.number}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block text-[13px] font-bold">
                                {s.room.typeName}
                                {i === 0 ? " · Best" : ""}
                              </span>
                              <span
                                className={[
                                  "mt-0.5 block truncate text-[10px]",
                                  i === 0 ? "text-white/65" : "text-[var(--hos-ink-3)]",
                                ].join(" ")}
                              >
                                {s.reasons.slice(0, 3).join(" · ")}
                              </span>
                            </span>
                          </button>
                        ))}
                      </div>
                    ) : null}

                    <label className="grid gap-1 text-xs font-medium text-[var(--hos-ink-2)]">
                      {stay.roomId ? "1-tap room move target" : "All rooms · manual pick"}
                      <select
                        value={roomPick || stay.roomId || ""}
                        onChange={(e) => setRoomPick(e.target.value)}
                        className="rounded-[10px] border border-[var(--hos-line)] bg-[var(--hos-cell)] px-3 py-2 text-sm"
                      >
                        <option value="">Select room…</option>
                        {candidates.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.number} · {r.typeName} · {r.hkStatus}
                          </option>
                        ))}
                      </select>
                    </label>

                    <div className="flex flex-wrap gap-1.5">
                      {MOVE_REASONS.map((r) => (
                        <button
                          key={r.id}
                          type="button"
                          onClick={() => setMoveReason(r.id)}
                          className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
                            moveReason === r.id
                              ? "border-[var(--hos-primary)] bg-[rgba(37,99,235,0.12)] text-[var(--hos-primary)]"
                              : "border-[var(--hos-line)] text-[var(--hos-ink-2)]"
                          }`}
                        >
                          {r.label}
                        </button>
                      ))}
                    </div>

                    <Button
                      size="sm"
                      disabled={!roomPick}
                      onClick={() => {
                        if (!roomPick) return;
                        void (async () => {
                          const room = rooms.find((r) => r.id === roomPick);
                          const res = await assignPeerRoom(stay.id, roomPick, {
                            moveReason:
                              stay.roomId && stay.roomId !== roomPick
                                ? moveReason
                                : undefined,
                          });
                          if (!res.ok) {
                            toast.error(res.error);
                            return;
                          }
                          toast.success(
                            stay.roomId && stay.roomId !== roomPick
                              ? `Moved · Rm ${room?.number ?? roomPick}`
                              : `Assigned · Rm ${room?.number ?? roomPick}`,
                          );
                        })();
                      }}
                    >
                      {stay.roomId ? "Apply room move" : "Assign room"}
                    </Button>

                    {/* Night-by-Night Daily Meal Plan & Rate Schedule Matrix */}
                    <div className="hos-cell grid gap-3 rounded-xl p-3 border border-[var(--hos-line)] bg-[var(--hos-cell)]">
                      {stay.status === "checked_out" ? (
                        <p className="m-0 rounded-lg border border-[color-mix(in_srgb,var(--hos-brass)_35%,var(--hos-line))] bg-[color-mix(in_srgb,var(--hos-brass)_10%,var(--hos-cell))] px-2.5 py-2 text-[11px] font-medium text-[var(--hos-ink)]">
                          Checked out — rates, meals & folio stay editable. Saves
                          void old package lines and post corrections (audit kept).
                        </p>
                      ) : null}
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <strong className="text-xs uppercase tracking-wider text-[var(--hos-primary)] font-bold block">
                            Daily Rates & Meal Plan Schedule
                          </strong>
                          <span className="text-[10px] text-[var(--hos-ink-3)]">
                            {dailyDraft.length} night(s)
                            {resolvedCard
                              ? ` · card ${resolvedCard.code}`
                              : ""}{" "}
                            · night-by-night overrides
                            {stay.status === "checked_out" ? " · billing edit" : ""}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          <button
                            type="button"
                            onClick={applyCardRate}
                            className="rounded-lg border border-[var(--hos-primary)] bg-[color-mix(in_srgb,var(--hos-primary)_10%,var(--hos-cell))] px-2 py-1 text-[10px] font-semibold text-[var(--hos-primary)]"
                          >
                            Apply {resolvedCard?.code ?? "card"} rate
                          </button>
                          {dailyDraft.length > 1 ? (
                            <button
                              type="button"
                              onClick={() => {
                                if (dailyDraft.length === 0) return;
                                const first = dailyDraft[0];
                                setDailyDraft(
                                  dailyDraft.map((d) => ({
                                    ...d,
                                    nightlyNet: first.nightlyNet,
                                    mealPlan: first.mealPlan,
                                    extraBed: first.extraBed,
                                  })),
                                );
                                toast.info("Copied Night 1 to all remaining nights");
                              }}
                              className="rounded-lg border border-[var(--hos-line)] bg-[var(--hos-cell)] px-2 py-1 text-[10px] font-semibold text-[var(--hos-primary)] hover:border-[var(--hos-primary)] transition-all"
                            >
                              Copy N1 to all ↷
                            </button>
                          ) : null}
                        </div>
                      </div>

                      {/* Nightly Matrix Rows */}
                      <div className="max-h-[280px] overflow-y-auto space-y-2 pr-1">
                        {dailyDraft.map((plan, idx) => {
                          const mealAdd = mealPlanNightlyNet(plan.mealPlan);
                          const bedAdd = plan.extraBed ? EXTRA_BED_NIGHTLY_NET : 0;
                          const nightNet = plan.nightlyNet + mealAdd + bedAdd;
                          const tax = taxBreakdown(nightNet);

                          return (
                            <div
                              key={plan.date}
                              className="rounded-lg border border-[var(--hos-line)] bg-[var(--hos-cell)] p-2.5 space-y-2 text-xs"
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-bold text-[var(--hos-ink)] text-[11px]">
                                  N{idx + 1} · {plan.date}
                                </span>
                                <span className="font-mono text-[11px] font-bold text-[var(--hos-ink)]">
                                  {formatNu(tax.totalAmount)}{" "}
                                  <span className="text-[9px] text-[var(--hos-ink-3)] font-normal">all-in</span>
                                </span>
                              </div>

                              <div className="grid grid-cols-2 gap-2 items-center">
                                <div>
                                  <label className="text-[10px] text-[var(--hos-ink-3)] block mb-0.5">Base Net (Nu.)</label>
                                  <input
                                    type="number"
                                    min={0}
                                    step={100}
                                    value={plan.nightlyNet}
                                    onChange={(e) => {
                                      const raw = e.target.value;
                                      const val = Math.max(0, Number(raw) || 0);
                                      setDailyDraft(
                                        dailyDraft.map((d, i) =>
                                          i === idx ? { ...d, nightlyNet: val } : d,
                                        ),
                                      );
                                    }}
                                    onBlur={() => {
                                      commitDailyPlans(
                                        dailyDraft.map((d, i) =>
                                          i === idx
                                            ? {
                                                ...d,
                                                nightlyNet: Math.max(0, d.nightlyNet),
                                              }
                                            : d,
                                        ),
                                        `Room net · N${idx + 1}`,
                                      );
                                    }}
                                    className="w-full rounded-md border border-[var(--hos-line)] bg-[var(--hos-cell)] px-2 py-1 text-xs tabular-nums text-[var(--hos-ink)] outline-none focus:border-[var(--hos-primary)]"
                                  />
                                </div>

                                <div>
                                  <label className="text-[10px] text-[var(--hos-ink-3)] block mb-0.5">Meal Plan</label>
                                  <div className="grid grid-cols-4 gap-0.5">
                                    {MEALS.map((m) => (
                                      <button
                                        key={m}
                                        type="button"
                                        onClick={() => {
                                          commitDailyPlans(
                                            dailyDraft.map((d, i) =>
                                              i === idx ? { ...d, mealPlan: m } : d,
                                            ),
                                            `${m} meal · N${idx + 1}`,
                                          );
                                        }}
                                        className={`rounded py-1 text-[10px] font-bold text-center transition-all ${
                                          plan.mealPlan === m
                                            ? "bg-[var(--hos-primary)] text-white shadow-xs"
                                            : "border border-[var(--hos-line)] bg-[var(--hos-cell)] text-[var(--hos-ink-3)] hover:text-[var(--hos-ink)]"
                                        }`}
                                      >
                                        {m}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center justify-between pt-1 border-t border-[var(--hos-line)]/50 text-[10px]">
                                <label className="flex items-center gap-1.5 cursor-pointer text-[var(--hos-ink-2)]">
                                  <input
                                    type="checkbox"
                                    checked={Boolean(plan.extraBed)}
                                    onChange={(e) => {
                                      commitDailyPlans(
                                        dailyDraft.map((d, i) =>
                                          i === idx
                                            ? { ...d, extraBed: e.target.checked }
                                            : d,
                                        ),
                                        e.target.checked
                                          ? `Extra bed · N${idx + 1}`
                                          : `Extra bed off · N${idx + 1}`,
                                      );
                                    }}
                                    className="rounded border-[var(--hos-line)]"
                                  />
                                  <span>Extra Bed (+{formatNu(EXTRA_BED_NIGHTLY_NET)})</span>
                                </label>
                                <span className="text-[var(--hos-ink-3)]">
                                  SC {formatNu(tax.scAmount)} · BST {formatNu(tax.bstAmount)}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      <div className="flex flex-col gap-1.5 sm:flex-row">
                        <Button
                          size="sm"
                          onClick={() => commitDailyPlans(dailyDraft, "Full schedule saved")}
                          className="flex-1 !rounded-full text-[12px] font-medium"
                        >
                          Save this room
                        </Button>
                        {stay.groupId ? (
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => {
                              if (
                                !window.confirm(
                                  `Apply this schedule to all ${peers.length} rooms in ${stay.groupName ?? "the group"}?`,
                                )
                              ) {
                                return;
                              }
                              void applyGroupDailyPlans(stay.groupId!, dailyDraft).then(
                                (res) => {
                                  if (!res.ok) toast.error(res.error);
                                  else {
                                    setTab("streams");
                                    setStreamFocus("master");
                                    setShowVoided(false);
                                    toast.success(
                                      `Schedule on ${res.updated} rooms · Agency folios`,
                                    );
                                  }
                                },
                              );
                            }}
                            className="flex-1 !rounded-full text-[12px] font-medium"
                          >
                            Apply to group
                          </Button>
                        ) : null}
                      </div>
                    </div>

                    <div className="grid gap-2 rounded-xl border border-[var(--hos-line)] bg-[var(--hos-cell)] p-3">
                      <div>
                        <strong className="text-xs text-[var(--hos-ink)]">
                          Guest bill · personal
                        </strong>
                        <p className="m-0 mt-0.5 text-[11px] text-[var(--hos-ink-3)]">
                          POS, laundry, minibar, service — posts to this room’s guest
                          folio (not agency master).
                        </p>
                      </div>
                      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                        {GUEST_BILL_KINDS.map((k) => (
                          <button
                            key={k.id}
                            type="button"
                            disabled={!folioEditable}
                            title={k.hint}
                            onClick={() => {
                              setGuestBillKind(k.id);
                              if (!guestBillDesc.trim()) {
                                setGuestBillDesc(
                                  k.id === "fb"
                                    ? "POS / F&B"
                                    : k.id === "laundry"
                                      ? "Laundry"
                                      : k.id === "minibar"
                                        ? "Minibar"
                                        : "Service charge",
                                );
                              }
                            }}
                            className={`rounded-lg border px-2 py-1.5 text-[11px] font-semibold transition-colors ${
                              guestBillKind === k.id
                                ? "border-[var(--hos-primary)] bg-[var(--hos-primary)] text-white"
                                : "border-[var(--hos-line)] bg-[var(--hos-bg)] text-[var(--hos-ink-2)] hover:text-[var(--hos-ink)]"
                            }`}
                          >
                            {k.label}
                          </button>
                        ))}
                      </div>
                      <div className="grid gap-2 sm:grid-cols-[1fr_7rem_auto]">
                        <input
                          type="text"
                          value={guestBillDesc}
                          disabled={!folioEditable || guestBillBusy}
                          onChange={(e) => setGuestBillDesc(e.target.value)}
                          placeholder="Description"
                          data-testid="stayhub-guest-bill-desc"
                          className="w-full rounded-xl border border-[var(--hos-line)] bg-[var(--hos-bg)] px-3 py-2 text-[13px] text-[var(--hos-ink)] outline-none focus:border-[var(--hos-primary)]"
                        />
                        <input
                          type="number"
                          inputMode="decimal"
                          min={0}
                          step={1}
                          value={guestBillNet}
                          disabled={!folioEditable || guestBillBusy}
                          onChange={(e) => setGuestBillNet(e.target.value)}
                          placeholder="Net Nu"
                          data-testid="stayhub-guest-bill-net"
                          className="w-full rounded-xl border border-[var(--hos-line)] bg-[var(--hos-bg)] px-3 py-2 font-mono text-[13px] tabular-nums text-[var(--hos-ink)] outline-none focus:border-[var(--hos-primary)]"
                        />
                        <Button
                          size="sm"
                          className="hos-btn-ink !rounded-full !px-4"
                          data-testid="stayhub-guest-bill-post"
                          disabled={!folioEditable || guestBillBusy}
                          onClick={() => {
                            const net = Number(guestBillNet);
                            const desc = guestBillDesc.trim();
                            if (!desc) {
                              toast.error("Enter a description");
                              return;
                            }
                            if (!Number.isFinite(net) || net <= 0) {
                              toast.error("Enter a net amount (Nu)");
                              return;
                            }
                            setGuestBillBusy(true);
                            void postCharge(
                              stay.id,
                              desc,
                              Math.round(net),
                              guestBillKind,
                              undefined,
                              "personal",
                            )
                              .then((res) => {
                                if (!res.ok) {
                                  toast.error(res.error);
                                  return;
                                }
                                toast.success(`${desc} · Nu. ${Math.round(net)} · personal`);
                                setGuestBillNet("");
                                setTab("streams");
                                setStreamFocus("personal");
                              })
                              .finally(() => setGuestBillBusy(false));
                          }}
                        >
                          {guestBillBusy ? "Posting…" : "Post"}
                        </Button>
                      </div>
                      {!folioEditable ? (
                        <p className="m-0 text-[11px] text-[var(--hos-ruby)]">
                          Cancelled / no-show — folio locked.
                        </p>
                      ) : stay.status === "checked_out" ? (
                        <p className="m-0 text-[11px] text-[var(--hos-ink-3)]">
                          Departed stay — late guest charges still post to personal folio.
                        </p>
                      ) : null}
                    </div>

                    <div className="grid gap-2">
                      <strong className="text-xs text-[var(--hos-ink)]">
                        Quick add-ons · fixed price
                      </strong>
                      <div className="grid gap-2">
                        {ADDONS.map((a) => (
                          <motion.div key={a.id} whileTap={reduce ? undefined : { scale: 0.98 }}>
                            <Button
                              className="w-full justify-between"
                              variant="secondary"
                              size="sm"
                              data-testid={`stayhub-addon-${a.id}`}
                              disabled={!folioEditable}
                              onClick={() => {
                                void (async () => {
                                  const res = await postCharge(
                                    stay.id,
                                    a.label,
                                    a.net,
                                    a.kind,
                                    undefined,
                                    "personal",
                                  );
                                  if (!res.ok) toast.error(res.error);
                                  else toast.success(`${a.label} posted · personal`);
                                })();
                              }}
                            >
                              <span>{a.label}</span>
                              <span className="tabular-nums">{formatNu(a.net)}</span>
                            </Button>
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  </>
                ) : null}

                {tab === "notes" ? (
                  <div className="flex flex-col gap-3">
                    <div className="rounded-xl border border-[var(--hos-line)] bg-[var(--hos-cell)] p-3">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <div>
                          <strong className="block text-[11px] font-medium tracking-wide text-[var(--hos-primary)]">
                            Stay notes
                          </strong>
                          <p className="m-0 mt-0.5 text-[11px] text-[var(--hos-ink-3)]">
                            Desk / partner ops — shows on StayView ribbon &amp; hover
                          </p>
                        </div>
                        {notesDirty ? (
                          <Badge tone="vip">Unsaved</Badge>
                        ) : stay.notes ? (
                          <Badge tone="success">Saved</Badge>
                        ) : (
                          <Badge tone="muted">Empty</Badge>
                        )}
                      </div>
                      <textarea
                        value={notesDraft}
                        onChange={(e) => {
                          setNotesDraft(e.target.value);
                          setNotesDirty(
                            (e.target.value.trim() || "") !== (stay.notes ?? ""),
                          );
                        }}
                        onBlur={() => {
                          if (!notesDirty) return;
                          start(() => {
                            void setStayNotes(stay.id, notesDraft).then((res) => {
                              if (!res.ok) {
                                toast.error(res.error);
                                return;
                              }
                              setNotesDirty(false);
                              toast.success("Stay note saved");
                            });
                          });
                        }}
                        rows={8}
                        placeholder="Allergy, late arrival, VIP amenity, group ops, passport follow-up…"
                        className="hos-input min-h-[88px] w-full !rounded-xl !border-[var(--hos-line)] !bg-[var(--hos-cell)] !px-3 !py-2 !text-[13px] leading-relaxed text-[var(--hos-ink)] outline-none focus:!border-[var(--hos-primary)]"
                      />
                      <div className="mt-2.5 flex flex-wrap items-center gap-2">
                        <Button
                          size="sm"
                          className="hos-btn-ink hos-btn-spring !rounded-full"
                          disabled={!notesDirty}
                          onClick={() => {
                            start(() => {
                              void setStayNotes(stay.id, notesDraft).then((res) => {
                                if (!res.ok) {
                                  toast.error(res.error);
                                  return;
                                }
                                setNotesDirty(false);
                                toast.success("Stay note saved", {
                                  description: stay.confirmationNo,
                                });
                              });
                            });
                          }}
                        >
                          Save note
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="!rounded-full"
                          disabled={!notesDraft && !stay.notes}
                          onClick={() => {
                            setNotesDraft("");
                            start(() => {
                              void setStayNotes(stay.id, "").then((res) => {
                                if (!res.ok) {
                                  toast.error(res.error);
                                  return;
                                }
                                setNotesDirty(false);
                                toast.message("Note cleared");
                              });
                            });
                          }}
                        >
                          Clear
                        </Button>
                        <span className="ml-auto font-mono text-[10px] tabular-nums text-[var(--hos-ink-3)]">
                          {notesDraft.trim().length} chars
                        </span>
                      </div>
                    </div>
                    <p className="m-0 text-[10px] text-[var(--hos-ink-3)]">
                      Saves on blur or Save · appends an audit line · visible on StayView
                      ribbon.
                    </p>
                  </div>
                ) : null}

                {tab === "audit" ? (
                  <div className="hos-cell max-h-[420px] overflow-auto rounded-xl p-0">
                    <ul className="m-0 list-none divide-y divide-[var(--hos-line)] p-0">
                      {stay.audit.map((a) => (
                        <li key={a.id} className="px-3 py-2.5">
                          <div className="text-xs font-medium text-[var(--hos-ink)]">
                            {a.message}
                          </div>
                          <div className="mt-0.5 text-[10px] text-[var(--hos-ink-3)]">
                            {a.actor} · {new Date(a.at).toLocaleString()}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </motion.div>
            </AnimatePresence>
          </div>
        )}
      </StaySheet>

      {typeof document !== "undefined"
        ? createPortal(
            <AnimatePresence>
              {rmaOpen && stay ? (
                <motion.div
                  className="pointer-events-auto fixed inset-0 z-[110] flex items-end justify-center bg-[rgba(15,23,42,0.72)] p-4 sm:items-center"
                  initial={reduce ? false : { opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={reduce ? undefined : { opacity: 0 }}
                  onClick={() => setRmaOpen(false)}
                >
                  <motion.div
                    initial={reduce ? false : { y: 24, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={reduce ? undefined : { y: 12, opacity: 0 }}
                    transition={{ type: "spring", stiffness: 420, damping: 30 }}
                    onClick={(e) => e.stopPropagation()}
                    className="w-full max-w-sm rounded-2xl border border-[var(--hos-line)] bg-[var(--hos-cell)] p-4 shadow-[0_24px_64px_-20px_rgba(15,23,42,0.55)]"
                  >
                    <strong className="text-sm text-[var(--hos-ink)]">RMA mBoB QR</strong>
                    <p className="m-0 mt-1 text-xs text-[var(--hos-ink-3)]">
                      Dynamic merchant QR · {formatNu(streamDue)}
                    </p>
                    <div className="mx-auto my-4 flex size-40 items-center justify-center rounded-xl border border-dashed border-[var(--hos-line)] bg-[var(--hos-cell)]">
                      <div className="grid grid-cols-5 gap-1 p-3 opacity-80">
                        {Array.from({ length: 25 }).map((_, i) => (
                          <span
                            key={i}
                            className={`size-2 rounded-[2px] ${
                              (i * 7 + due) % 3 === 0
                                ? "bg-[var(--hos-ink)]"
                                : "bg-transparent"
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                    <Button
                      className="w-full"
                      data-testid="stayhub-confirm-qr-paid"
                      onClick={() => runSettle("rma_qr")}
                    >
                      Confirm QR paid
                    </Button>
                  </motion.div>
                </motion.div>
              ) : null}
            </AnimatePresence>,
            document.getElementById(STAY_SHEET_MODAL_ROOT_ID) ?? document.body,
          )
        : null}

      <InvoiceModal
        open={invoiceOpen && Boolean(stay)}
        onClose={() => setInvoiceOpen(false)}
        stay={stay}
        stream={streamFocus}
      />
      <GroupInvoiceModal
        open={groupInvoiceOpen && Boolean(stay?.groupId)}
        onClose={() => setGroupInvoiceOpen(false)}
        stays={peers}
        groupName={stay?.groupName ?? null}
        agencyName={stay?.agencyName ?? groupRollup?.meta?.agencyName ?? null}
      />
    </>
  );
}
