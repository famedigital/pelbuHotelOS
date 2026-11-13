import {
  PERSONAL_CHECKOUT_GATE_BTN,
  maskPartnerCalendar,
  type MaskedPartnerCell,
  type PartnerCalendarCell,
} from "@hos-v2/domain";
import {
  BedDouble,
  BookOpen,
  Building2,
  CalendarRange,
  ClipboardList,
  Download,
  FileStack,
  Inbox,
  LayoutGrid,
  Printer,
  Sparkles,
  Upload,
  Wallet,
  Zap,
} from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Badge,
  Button,
  EmptyState,
  GlassPanel,
  MorphTabs,
  ModuleFrame,
  StatusLegend,
  Odometer,
} from "@hos-v2/ui";
import { InvoiceModal } from "./InvoiceModal";
import { AgentPrintPackOverlay } from "./AgentPrintPackOverlay";
import { FieldPortalGate } from "./field/FieldPortalGate";
import { MarketplaceDeskPanel } from "./field/MarketplaceDeskPanel";
import { useFieldPortalAuth } from "../lib/field-portal-auth";
import {
  addDays,
  datesBetween,
  formatNu,
  nightsBetween,
  stayOnDate,
  useFrontOfficeStore,
  ymd,
  type MealPlan,
  type RoomTypeCode,
} from "../lib/front-office-store";
import {
  TYPES,
  cellBandNet,
  cellsForCard,
  quoteFromCard,
  rateCardById,
  useCommercialStore,
} from "../lib/commercial-store";
import { useExtrasStore } from "../lib/extras-store";
import { useMealBoardStore } from "../lib/meal-board-store";
import { DEMO_MOU_PROPERTY_ID, useMouStore } from "../lib/mou-store";
import {
  adviseSmartBook,
  buildInventoryHeat,
  buildPartnerInsights,
  buildPartnerInvoices,
  exportPartnerBookingsCsv,
  exportPartnerInvoicesExcel,
  filterPartnerInvoices,
  type PartnerInsightTone,
  type PartnerInvoiceRow,
  type PartnerPayFilter,
} from "../lib/partner-intelligence";
import {
  partnerAgencyName,
  usePartnerPortalStore,
  type PartnerChangeRequest,
} from "../lib/partner-portal-store";
import { useEcosystemStore } from "../lib/ecosystem-store";
import {
  buildAgencyOffers,
  buildConnectedHotels,
  buildFoPulse,
} from "../lib/b2b-portfolio";
import { PartnerAgencyDashboard } from "./partner/PartnerAgencyDashboard";
import { isOpsDbUnavailable, runCommand } from "../lib/api";

type Tab =
  | "dashboard"
  | "calendar"
  | "inventory"
  | "rates"
  | "menus"
  | "fleet"
  | "book"
  | "bookings"
  | "rooming"
  | "changes"
  | "money";

const CELL = 72;
/** Thin room gutter — more days visible; sticky left freeze pane. */
const LABEL = 48;

function slaTone(req: PartnerChangeRequest): "danger" | "vip" | "success" | "muted" {
  if (req.status !== "pending") return req.status === "approved" ? "success" : "muted";
  const ageH = (Date.now() - new Date(req.submittedAt).getTime()) / 3_600_000;
  if (ageH > 24) return "danger";
  if (ageH > 8) return "vip";
  return "success";
}

function slaLabel(req: PartnerChangeRequest): string {
  if (req.status !== "pending") return req.status;
  const ageH = Math.round((Date.now() - new Date(req.submittedAt).getTime()) / 3_600_000);
  if (ageH >= 24) return `SLA breach · ${ageH}h pending`;
  if (ageH >= 8) return `Desk queue · ${ageH}h`;
  return `Fresh · ${Math.max(1, ageH)}h`;
}

function insightBorder(tone: PartnerInsightTone): string {
  if (tone === "ruby") return "border-[rgba(239,68,68,0.35)]";
  if (tone === "brass") return "border-[rgba(245,158,11,0.4)]";
  if (tone === "emerald") return "border-[rgba(16,185,129,0.35)]";
  return "border-[rgba(59,130,246,0.35)]";
}

function insightDot(tone: PartnerInsightTone): string {
  if (tone === "ruby") return "bg-[var(--hos-ruby)]";
  if (tone === "brass") return "bg-[var(--hos-brass)]";
  if (tone === "emerald") return "bg-[var(--hos-emerald)]";
  return "bg-[var(--hos-primary)]";
}

export function PartnerPortalPage() {
  return (
    <FieldPortalGate
      role="partner"
      title="Partner Portal"
      blurb="Agency central — connected hotels, MoU rates, offers, FO pulse, and invoices. Unlock with your agent code."
    >
      <PartnerPortalBody />
    </FieldPortalGate>
  );
}

function PartnerPortalBody() {
  const reduce = useReducedMotion();
  const [tab, setTab] = useState<Tab>("dashboard");
  const [sessionPropertyId, setSessionPropertyId] = useState(DEMO_MOU_PROPERTY_ID);
  const partnerSession = useFieldPortalAuth((s) => s.sessions.partner);
  const agents = useCommercialStore((s) => s.agents);
  const rateCards = useCommercialStore((s) => s.rateCards);
  const cells = useCommercialStore((s) => s.cells);
  const season = useCommercialStore((s) => s.season);
  const mealPlan = useCommercialStore((s) => s.mealPlan);
  const quoteDisplay = useCommercialStore((s) => s.quoteDisplay);
  const sessionAgentId = usePartnerPortalStore((s) => s.sessionAgentId);
  const setSessionAgent = usePartnerPortalStore((s) => s.setSessionAgent);
  const sessionPortalUserId = usePartnerPortalStore((s) => s.sessionPortalUserId);
  const setSessionPortalUser = usePartnerPortalStore((s) => s.setSessionPortalUser);

  useEffect(() => {
    if (partnerSession?.subjectId && partnerSession.subjectId !== sessionAgentId) {
      setSessionAgent(partnerSession.subjectId);
    }
  }, [partnerSession?.subjectId, sessionAgentId, setSessionAgent]);
  const portalUsers = usePartnerPortalStore((s) => s.portalUsers);
  const canPortal = usePartnerPortalStore((s) => s.canPortal);
  const updateGuideDriver = usePartnerPortalStore((s) => s.updateGuideDriver);
  const mouLinks = useMouStore((s) => s.links);
  const proposeMou = useMouStore((s) => s.propose);
  const decideMou = useMouStore((s) => s.decide);
  const hasActiveMou = useMouStore((s) => s.hasActiveMou);
  const roomingDraft = usePartnerPortalStore((s) => s.roomingDraft);
  const roomingSubmittedAt = usePartnerPortalStore((s) => s.roomingSubmittedAt);
  const addRoomer = usePartnerPortalStore((s) => s.addRoomer);
  const importRoamingPaste = usePartnerPortalStore((s) => s.importRoamingPaste);
  const clearRoamingDraft = usePartnerPortalStore((s) => s.clearRoamingDraft);
  const validateRoomingDraft = usePartnerPortalStore((s) => s.validateRoomingDraft);
  const suggestRoomsFromMask = usePartnerPortalStore((s) => s.suggestRoomsFromMask);
  const submitRoomingToDesk = usePartnerPortalStore((s) => s.submitRoomingToDesk);
  const bookPartnerGroup = usePartnerPortalStore((s) => s.bookPartnerGroup);
  const updateRoomer = usePartnerPortalStore((s) => s.updateRoomer);
  const lastBookedGroupId = usePartnerPortalStore((s) => s.lastBookedGroupId);
  const changeRequests = usePartnerPortalStore((s) => s.changeRequests);
  const submitGuestNameChange = usePartnerPortalStore((s) => s.submitGuestNameChange);
  const submitOpsChange = usePartnerPortalStore((s) => s.submitOpsChange);
  const depositSlips = usePartnerPortalStore((s) => s.depositSlips);
  const uploadDeposit = usePartnerPortalStore((s) => s.uploadDeposit);
  const suggestDepositMatches = usePartnerPortalStore((s) => s.suggestDepositMatches);
  const fiscalDocs = useExtrasStore((s) => s.fiscalDocs);
  const rooms = useFrontOfficeStore((s) => s.rooms);
  const stays = useFrontOfficeStore((s) => s.stays);
  const businessDate = useFrontOfficeStore((s) => s.businessDate);

  const agent = agents.find((a) => a.id === sessionAgentId) ?? agents[0];
  const agencyLabel = agent ? partnerAgencyName(agent.id) : "Partner";
  const agencyToken = agencyLabel.split(" ")[0] ?? agencyLabel;
  const rateCard = agent ? rateCardById(rateCards, agent.rateCardId) : undefined;

  const today = ymd(new Date());
  const dates = useMemo(
    () => Array.from({ length: 14 }, (_, i) => addDays(today, i)),
    [today],
  );

  const ownStays = useMemo(() => {
    if (!agent) return [];
    return stays.filter((s) => {
      if (s.agencyName) {
        return (
          s.agencyName.includes(agencyToken) ||
          agencyLabel.includes(s.agencyName.split(" ")[0] ?? "") ||
          s.agencyName.toLowerCase().includes(agent.code.toLowerCase())
        );
      }
      /* Hydrate gap: API used to omit agencyName — still attribute agent-source stays. */
      if (s.source !== "agent") return false;
      const hay = `${s.guestName} ${s.groupName ?? ""}`.toLowerCase();
      return (
        hay.includes(agencyToken.toLowerCase()) ||
        hay.includes(agent.code.toLowerCase()) ||
        hay.includes((agent.name.split(" ")[0] ?? "").toLowerCase())
      );
    });
  }, [stays, agent, agencyToken, agencyLabel]);

  const calendarRawCells = useMemo(() => {
    if (!agent) return [] as PartnerCalendarCell[];
    const raw: PartnerCalendarCell[] = [];
    for (const room of rooms) {
      for (const d of dates) {
        const hit = stays.find(
          (s) =>
            s.roomId === room.id &&
            !["cancelled", "no_show", "checked_out"].includes(s.status) &&
            (stayOnDate(s, d) || (s.checkIn <= d && d < s.checkOut)),
        );
        if (!hit) {
          raw.push({
            stayDate: d,
            roomId: room.id,
            roomNumber: room.number,
            state: "free",
            ownerAgentId: null,
            guestName: null,
            bookingRef: null,
            netRateBtn: null,
          });
          continue;
        }
        const owner =
          agents.find(
            (a) =>
              hit.agencyName &&
              (hit.agencyName.includes(a.name.split(" ")[0] ?? "") ||
                a.name.includes(hit.agencyName.split(" ")[0] ?? "")),
          )?.id ?? "ag-other";
        raw.push({
          stayDate: d,
          roomId: room.id,
          roomNumber: room.number,
          state: hit.status === "held" ? "held" : "occupied",
          ownerAgentId: owner,
          guestName: hit.guestName,
          bookingRef: hit.confirmationNo,
          netRateBtn: hit.nightlyNet,
        });
      }
    }
    return raw;
  }, [rooms, dates, stays, agents, agent]);

  const localMaskedCells = useMemo(() => {
    if (!agent) return [] as MaskedPartnerCell[];
    return maskPartnerCalendar(calendarRawCells, agent.id);
  }, [calendarRawCells, agent]);

  const [apiMaskedCells, setApiMaskedCells] = useState<MaskedPartnerCell[] | null>(
    null,
  );

  useEffect(() => {
    if (!agent || calendarRawCells.length === 0) {
      setApiMaskedCells(null);
      return;
    }
    const handle = window.setTimeout(() => {
      void (async () => {
        const res = await runCommand<{ cells: MaskedPartnerCell[] }>(
          "partner.maskCalendar",
          { viewerAgentId: agent.id, cells: calendarRawCells },
        );
        if (res.ok) {
          setApiMaskedCells(res.data.cells);
          return;
        }
        const err = res.error.toLowerCase();
        const authBlocked =
          err.includes("forbidden") ||
          err.includes("unauthorized") ||
          err.includes("permission");
        if (authBlocked) {
          setApiMaskedCells(null);
          toast.error("Partner calendar unavailable", { description: res.error });
          return;
        }
        if (!isOpsDbUnavailable(res.error)) {
          console.error("[partner] maskCalendar failed", { err: res.error });
        }
        setApiMaskedCells(null);
      })();
    }, 400);
    return () => window.clearTimeout(handle);
  }, [agent, calendarRawCells]);

  const maskedCells = apiMaskedCells ?? localMaskedCells;

  const inventory = useMemo(() => {
    return TYPES.map((t) => {
      const typeRooms = rooms.filter((r) => r.typeCode === t.code && r.hkStatus !== "ooo");
      const byDate = dates.map((d) => {
        const occupied = typeRooms.filter((r) =>
          stays.some(
            (s) =>
              s.roomId === r.id &&
              !["cancelled", "no_show", "checked_out"].includes(s.status) &&
              s.checkIn <= d &&
              d < s.checkOut,
          ),
        ).length;
        return { date: d, sellable: Math.max(0, typeRooms.length - occupied) };
      });
      return { type: t, byDate };
    });
  }, [rooms, stays, dates]);

  const inventoryHeat = useMemo(() => buildInventoryHeat(inventory), [inventory]);

  const rateRows = useMemo(() => {
    if (!agent) return [];
    return cellsForCard(cells, agent.rateCardId, season, mealPlan);
  }, [agent, cells, season, mealPlan]);

  const [paste, setPaste] = useState("");
  const [guestFrom, setGuestFrom] = useState("");
  const [guestTo, setGuestTo] = useState("");
  const [opsSummary, setOpsSummary] = useState("Add 1 twin room · same dates");
  const [opsDetail, setOpsDetail] = useState("Late join — needs desk allotment");
  const [lead, setLead] = useState("");
  const [passport, setPassport] = useState("");
  const [nat, setNat] = useState("French");
  const [meal, setMeal] = useState<MealPlan>("MAP");
  const [diet, setDiet] = useState("None");
  const [depAmt, setDepAmt] = useState(25000);
  const [depRef, setDepRef] = useState("");
  const [depMethod, setDepMethod] = useState<"wire" | "mbob">("mbob");
  const [matchHints, setMatchHints] = useState<ReturnType<typeof suggestDepositMatches>>([]);
  const [bookGuest, setBookGuest] = useState("");
  const [bookType, setBookType] = useState<RoomTypeCode>("deluxe_twin");
  const [bookIn, setBookIn] = useState(() => addDays(ymd(new Date()), 3));
  const [bookOut, setBookOut] = useState(() => addDays(ymd(new Date()), 5));
  const [guideName, setGuideName] = useState("");
  const [driverName, setDriverName] = useState("");
  const [guideGroupId, setGuideGroupId] = useState("grp-001");
  const [bookMeal, setBookMeal] = useState<MealPlan>("MAP");
  const [bookAdults, setBookAdults] = useState(2);
  const [bookRooms, setBookRooms] = useState(1);
  const mealBoards = useMealBoardStore((s) => s.boards);
  const boardsForRange = useMealBoardStore((s) => s.boardsForRange);
  const [invoiceFilter, setInvoiceFilter] = useState<PartnerPayFilter>("all");
  const [invoiceQuery, setInvoiceQuery] = useState("");
  const [paperStayId, setPaperStayId] = useState<string | null>(null);
  const [paperAutoPrint, setPaperAutoPrint] = useState(false);
  const [printPackOpen, setPrintPackOpen] = useState(false);
  const [voucherFile, setVoucherFile] = useState("");
  const [voucherAmt, setVoucherAmt] = useState(25000);
  const allotments = useEcosystemStore((s) => s.allotments);
  const placeAllotmentBlock = useEcosystemStore((s) => s.placeAllotmentBlock);
  const isAllotmentBlocked = useEcosystemStore((s) => s.isAllotmentBlocked);
  const uploadVoucherPdf = useEcosystemStore((s) => s.uploadVoucherPdf);
  const vouchers = useEcosystemStore((s) => s.vouchers);
  const allotmentGate = isAllotmentBlocked(bookType, bookIn);

  const connectedHotels = useMemo(() => {
    if (!agent) return [];
    return buildConnectedHotels({
      agentId: agent.id,
      links: mouLinks,
      rateCards,
      cells,
      season,
      mealPlan,
      stays,
      fiscalDocs,
      allotments,
      agent,
      moneyPropertyId: DEMO_MOU_PROPERTY_ID,
    });
  }, [agent, mouLinks, rateCards, cells, season, mealPlan, stays, fiscalDocs, allotments]);

  const agencyOffers = useMemo(() => {
    if (!agent) return [];
    return buildAgencyOffers({
      allotments,
      links: mouLinks,
      agentId: agent.id,
    });
  }, [agent, allotments, mouLinks]);

  const foPulse = useMemo(
    () =>
      buildFoPulse({
        businessDate: businessDate || today,
        stays,
        agent: agent ?? null,
      }),
    [businessDate, today, stays, agent],
  );

  const roomingIssues = useMemo(
    () => validateRoomingDraft(),
    [roomingDraft, validateRoomingDraft],
  );
  const issueIds = new Set(roomingIssues.map((i) => i.roomerId));

  const allPartnerInvoices = useMemo(
    () =>
      buildPartnerInvoices({
        agencyToken,
        agencyLabel,
        fiscalDocs,
        stays: ownStays,
      }),
    [agencyToken, agencyLabel, fiscalDocs, ownStays],
  );

  const invoiceTotals = useMemo(() => {
    const open = allPartnerInvoices.filter((r) => r.status === "unpaid");
    const paid = allPartnerInvoices.filter((r) => r.status === "paid");
    return {
      unpaidCount: open.length,
      paidCount: paid.length,
      unpaidAmt: open.reduce((s, r) => s + r.balance, 0),
      paidAmt: paid.reduce((s, r) => s + r.amount, 0),
      allCount: allPartnerInvoices.filter((r) => r.status !== "void").length,
    };
  }, [allPartnerInvoices]);

  const filteredInvoices = useMemo(() => {
    const base = filterPartnerInvoices(allPartnerInvoices, invoiceFilter);
    const q = invoiceQuery.trim().toLowerCase();
    if (!q) return base;
    return base.filter(
      (r) =>
        r.docNo.toLowerCase().includes(q) ||
        r.guest.toLowerCase().includes(q) ||
        (r.stayRef ?? "").toLowerCase().includes(q),
    );
  }, [allPartnerInvoices, invoiceFilter, invoiceQuery]);

  const paperStay = useMemo(
    () => (paperStayId ? stays.find((s) => s.id === paperStayId) ?? null : null),
    [paperStayId, stays],
  );

  function openPartnerInvoice(row: PartnerInvoiceRow, print: boolean) {
    if (!row.stayId) {
      toast.error("No stay linked", {
        description: `${row.docNo} has no stay folio to open.`,
      });
      return;
    }
    setPaperAutoPrint(print);
    setPaperStayId(row.stayId);
  }

  const pendingChanges = changeRequests.filter((c) => c.status === "pending").length;
  const headroom = agent ? Math.max(0, agent.creditLimit - agent.usedCredit) : 0;
  const utilPct =
    agent && agent.creditLimit
      ? Math.round((agent.usedCredit / agent.creditLimit) * 100)
      : 0;

  const insights = useMemo(() => {
    if (!agent) return [];
    return buildPartnerInsights({
      agent,
      ownStays,
      pendingChanges: changeRequests,
      inventory,
      roomingCount: roomingDraft.length,
      today,
    });
  }, [agent, ownStays, changeRequests, inventory, roomingDraft.length, today]);

  const bookPackageNet = useMemo(() => {
    if (!agent) return 0;
    return quoteFromCard({
      cells,
      rateCardId: agent.rateCardId,
      typeCode: bookType,
      season,
      mealPlan: bookMeal,
      adults: bookAdults,
      fallbackNet: 0,
    });
  }, [agent, cells, bookType, season, bookMeal, bookAdults]);

  const bookRoomNet = useMemo(() => {
    if (!agent) return 0;
    return quoteFromCard({
      cells,
      rateCardId: agent.rateCardId,
      typeCode: bookType,
      season,
      mealPlan: "EP",
      adults: bookAdults,
      fallbackNet: 0,
    });
  }, [agent, cells, bookType, season, bookAdults]);

  const bookQuote = quoteDisplay(bookPackageNet);
  const smartAdvice = useMemo(() => {
    if (!agent) {
      return null;
    }
    return adviseSmartBook({
      agent,
      bookIn,
      bookOut,
      bookType,
      inventory,
      netPerNight: bookQuote.net,
      allInPerNight: bookQuote.total,
    });
  }, [agent, bookIn, bookOut, bookType, inventory, bookQuote.net, bookQuote.total]);

  const ownCellCount = maskedCells.filter((c) => c.displayState === "own").length;
  const freeTonight = inventory.reduce((n, row) => {
    const todayCell = row.byDate.find((c) => c.date === today);
    return n + (todayCell?.sellable ?? 0);
  }, 0);

  if (!agent) {
    return (
      <EmptyState
        title="No agency session"
        description="Commercial store has no operators — seed agents in Super Admin."
      />
    );
  }

  const placeHold = () => {
    if (!bookGuest.trim()) {
      toast.error("Guest name required");
      return;
    }
    const nights = nightsBetween(bookIn, bookOut);
    if (nights < 1) {
      toast.error("Check-out must be after check-in");
      return;
    }
    if (smartAdvice && smartAdvice.sellableTonight <= 0) {
      toast.error("No sellable inventory", {
        description: `Try ${smartAdvice.preferredType} or shift dates`,
      });
      return;
    }
    if (smartAdvice && !smartAdvice.creditOk) {
      toast.error("Credit headroom exceeded", {
        description: `Need ${formatNu(smartAdvice.allInStay)} · have ${formatNu(smartAdvice.creditHeadroom)}`,
      });
      setTab("money");
      return;
    }
    const gate = isAllotmentBlocked(bookType, bookIn);
    if (gate.blocked) {
      toast.error("48-hour allotment blocker", {
        description: gate.reason ?? "Place MoU allotment first",
      });
      return;
    }
    void (async () => {
      const created = await bookPartnerGroup({
        guestName: bookGuest.trim(),
        typeCode: bookType,
        checkIn: bookIn,
        checkOut: bookOut,
        mealPlan: bookMeal,
        roomsCount: bookRooms,
        adults: bookAdults,
        nightlyNet: bookRoomNet > 0 ? bookRoomNet : undefined,
      });
      if (!created.ok) {
        toast.error(created.error);
        return;
      }
      toast.success(
        bookRooms > 1 ? `Group hold · ${bookRooms} rooms` : "Hold created",
        {
          description: `${created.confirmationNo} · ${nights}n · ${formatNu(bookQuote.total * nights * bookRooms)} all-in · rooming next`,
        },
      );
      setBookGuest("");
      setTab("rooming");
    })();
  };

  const seedBookFromCell = (date: string, typeHint?: RoomTypeCode) => {
    const type = typeHint ?? bookType;
    setBookIn(date);
    setBookOut(addDays(date, 2));
    if (typeHint) setBookType(typeHint);
    setTab("book");
    const gate = isAllotmentBlocked(type, date);
    if (gate.blocked) {
      toast.message("48h allotment required", {
        description: gate.reason ?? "Place MoU allotment before hold",
      });
      return;
    }
    toast.message("Smart book primed", {
      description: `${date} → ${addDays(date, 2)} · MoU ${rateCard?.code ?? "—"}`,
    });
  };

  return (
    <ModuleFrame
      title="Partner Portal · Agency Central"
      description="Connected hotels · MoU rates · offers · FO pulse · invoices"
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <StatusLegend
            dense
            className="hidden md:flex"
            items={[
              { id: "avail", label: "Open", swatch: "var(--hos-emerald)" },
              { id: "hold", label: "Held", swatch: "var(--hos-brass)" },
              { id: "full", label: "Sold out", swatch: "var(--hos-ruby)" },
            ]}
          />
          <Badge tone="teal" className="border border-[var(--hos-line)]">
            {agent.code} · {rateCard?.code ?? "No card"}
          </Badge>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        {/* Premium agency hero */}
        <GlassPanel className="relative overflow-hidden p-4">
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[rgba(17,17,17,0.06)] via-transparent to-[rgba(245,158,11,0.08)]" />
          <div className="relative flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="flex size-11 items-center justify-center rounded-2xl bg-[#111] text-white shadow-[0_10px_28px_-12px_#111]">
                  <Building2 className="size-5" strokeWidth={2} />
                </span>
                <div className="min-w-0">
                  <h1 className="m-0 truncate text-[1.45rem] font-extrabold tracking-tight text-[var(--hos-ink)]">
                    {agent.name}
                  </h1>
                  <p className="m-0 text-[12px] text-[var(--hos-ink-3)]">
                    Sovereign B2B portal · masked calendar · live MoU quote ·{" "}
                    {season} / {mealPlan}
                  </p>
                </div>
                <Badge tone="vip">{agent.code}</Badge>
              </div>
            </div>
            <div className="flex flex-wrap items-end gap-2">
              <label className="grid gap-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--hos-ink-3)]">
                Agency session
                <select
                  value={agent.id}
                  onChange={(e) => setSessionAgent(e.target.value)}
                  className="hos-input min-w-[200px] !rounded-xl !text-[13px]"
                >
                  {agents.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({a.code})
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--hos-ink-3)]">
                Portal user
                <select
                  value={sessionPortalUserId}
                  onChange={(e) => setSessionPortalUser(e.target.value)}
                  className="hos-input min-w-[200px] !rounded-xl !text-[13px]"
                >
                  {portalUsers
                    .filter((u) => u.agentId === agent.id)
                    .map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.role})
                      </option>
                    ))}
                </select>
              </label>
              <label className="grid gap-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--hos-ink-3)]">
                Active hotel
                <select
                  value={sessionPropertyId}
                  onChange={(e) => setSessionPropertyId(e.target.value)}
                  className="hos-input min-w-[200px] !rounded-xl !text-[13px]"
                >
                  {connectedHotels.length === 0 ? (
                    <option value={DEMO_MOU_PROPERTY_ID}>No MoU hotels</option>
                  ) : (
                    connectedHotels.map((h) => (
                      <option key={h.propertyId} value={h.propertyId}>
                        {h.propertyName} ({h.mouStatus})
                      </option>
                    ))
                  )}
                </select>
              </label>
              <Button
                size="sm"
                className="hos-btn-ink hos-btn-spring !rounded-xl"
                disabled={!canPortal("book")}
                onClick={() => setTab("book")}
              >
                <Zap className="size-3.5" strokeWidth={2} />
                Smart hold
              </Button>
            </div>
          </div>

          <div className="relative mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              { label: "Own bookings", value: ownStays.length, meta: agencyToken },
              { label: "Credit used", value: utilPct, suffix: "%", meta: formatNu(agent.usedCredit) },
              { label: "Sellable tonight", value: freeTonight, meta: "all types" },
              { label: "Own rack cells", value: ownCellCount, meta: "14-night mask" },
            ].map((k) => (
              <motion.div
                key={k.label}
                className="hos-luxury-card flex min-h-[78px] flex-col justify-center px-3 py-2.5"
                whileTap={reduce ? undefined : { scale: 0.985 }}
              >
                <span className="text-[10px] font-black uppercase tracking-[0.12em] text-[var(--hos-ink-3)]">
                  {k.label}
                </span>
                <Odometer
                  value={k.value}
                  suffix={"suffix" in k ? k.suffix : undefined}
                  className="mt-1 font-mono text-[1.45rem] font-black tabular-nums tracking-tight text-[var(--hos-ink)]"
                />
                <span className="text-[11px] text-[var(--hos-ink-3)]">{k.meta}</span>
              </motion.div>
            ))}
          </div>

          <div className="relative mt-3">
            <div className="mb-1 flex items-center justify-between text-[11px]">
              <span className="font-semibold text-[var(--hos-ink-2)]">
                MoU credit headroom
              </span>
              <span className="font-mono tabular-nums text-[var(--hos-emerald)]">
                {formatNu(headroom)}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-[rgba(15,23,42,0.08)] dark:bg-[rgba(255,255,255,0.08)]">
              <div
                className={`hos-bar-grow h-full ${
                  utilPct > 85
                    ? "bg-[var(--hos-ruby)]"
                    : utilPct > 70
                      ? "bg-[var(--hos-brass)]"
                      : "bg-[var(--hos-primary)]"
                }`}
                style={{ width: `${Math.min(100, utilPct)}%` }}
              />
            </div>
          </div>
        </GlassPanel>

        {/* Intelligence rail */}
        <div className="-mx-1 flex gap-2.5 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {insights.map((ins) => (
            <button
              key={ins.id}
              type="button"
              onClick={() => {
                if (ins.action) setTab(ins.action.tab as Tab);
              }}
              className={`hos-luxury-card hos-interactive min-w-[min(100%,260px)] max-w-[300px] shrink-0 border px-3.5 py-3 text-left ${insightBorder(ins.tone)}`}
            >
              <div className="flex items-center gap-2">
                <span className={`size-2 rounded-full ${insightDot(ins.tone)}`} />
                <Sparkles className="size-3.5 text-[var(--hos-ink-3)]" strokeWidth={2} />
                <strong className="truncate text-[12px] font-bold text-[var(--hos-ink)]">
                  {ins.title}
                </strong>
              </div>
              <p className="m-0 mt-1.5 text-[11px] leading-snug text-[var(--hos-ink-3)]">
                {ins.detail}
              </p>
              {ins.action ? (
                <span className="mt-2 inline-block text-[10px] font-bold uppercase tracking-wider text-[var(--hos-primary)]">
                  Open {ins.action.label} →
                </span>
              ) : null}
            </button>
          ))}
        </div>

        <MorphTabs
          glowId="partnerPortalTab"
          value={tab}
          onChange={setTab}
          size="md"
          items={[
            { id: "dashboard", label: "Dashboard", count: connectedHotels.length || undefined },
            { id: "calendar", label: "Calendar" },
            { id: "inventory", label: "Inventory" },
            { id: "rates", label: "Rates" },
            { id: "menus", label: "Menus" },
            { id: "fleet", label: "Guides & cars" },
            { id: "book", label: "Book" },
            { id: "bookings", label: "My bookings", count: ownStays.length },
            { id: "rooming", label: "Rooming", count: roomingDraft.length },
            { id: "changes", label: "Changes", count: pendingChanges },
            {
              id: "money",
              label: "Invoices",
              count: invoiceTotals.unpaidCount || undefined,
            },
          ]}
        />

        {tab === "dashboard" ? (
          <PartnerAgencyDashboard
            hotels={connectedHotels}
            offers={agencyOffers}
            pulse={foPulse}
            onOpenHotel={(propertyId) => {
              setSessionPropertyId(propertyId);
              setTab("book");
              toast.message("Hotel selected", {
                description: connectedHotels.find((h) => h.propertyId === propertyId)
                  ?.propertyName,
              });
            }}
            onOpenTab={(t) => setTab(t)}
          />
        ) : null}

        {tab === "calendar" ? (
          <GlassPanel className="max-w-full overflow-x-auto p-3 [-webkit-overflow-scrolling:touch]">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <p className="m-0 text-[11px] text-[var(--hos-ink-3)]">
                <CalendarRange className="mr-1 inline size-3.5 text-[var(--hos-primary)]" />
                Masked rack (not FO StayView) — own names only. On phone, scroll horizontally
                or use Smart Hold. Tap a free cell to prime hold.
              </p>
              <div className="flex flex-wrap gap-2 text-[10px] font-semibold">
                <span className="inline-flex items-center gap-1">
                  <span className="size-2.5 rounded-sm bg-[rgba(37,99,235,0.85)]" /> Own
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="size-2.5 rounded-sm bg-[rgba(100,116,139,0.35)]" /> Masked
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="size-2.5 rounded-sm border border-[var(--hos-line)] bg-[var(--hos-cell)]" /> Free
                </span>
              </div>
            </div>
            <div className="mb-3 rounded-xl border border-[rgba(245,158,11,0.35)] bg-[rgba(245,158,11,0.08)] p-3">
              <strong className="text-[12px] text-[var(--hos-ink)]">
                48-hour allotment blocker · contracted MoU rates
              </strong>
              <p className="m-0 mt-1 text-[11px] text-[var(--hos-ink-3)]">
                Arrivals within 48 hours need an allotment block at MoU net before hold.
                Active blocks: {allotments.length || "none"}.
              </p>
              <Button
                size="sm"
                className="mt-2 !min-h-12 !rounded-xl"
                onClick={() => {
                  const res = placeAllotmentBlock({
                    typeCode: bookType,
                    from: bookIn,
                    to: bookOut,
                    netRateBtn: bookRoomNet || 6500,
                    mouCode: rateCard?.code ?? "MoU",
                  });
                  if (!res.ok) toast.error(res.error);
                  else
                    toast.success("Allotment placed", {
                      description: `${res.block.typeCode} · ${res.block.from}→${res.block.to} · ${formatNu(res.block.netRateBtn)}/n`,
                    });
                }}
              >
                Place MoU allotment for {bookType}
              </Button>
              {allotments.length > 0 ? (
                <ul className="m-0 mt-2 list-none space-y-1 p-0 text-[11px]">
                  {allotments.slice(0, 4).map((a) => (
                    <li
                      key={a.id}
                      className="flex justify-between gap-2 rounded-lg bg-[var(--hos-cell)] px-2 py-1.5"
                    >
                      <span>
                        {a.typeCode} · {a.from}→{a.to}
                      </span>
                      <span className="font-mono">{formatNu(a.netRateBtn)}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
            <div style={{ width: LABEL + dates.length * CELL, minWidth: "100%" }}>
              <div className="sticky top-0 z-[2] flex border-b border-[var(--hos-line)] bg-[var(--hos-cell)]">
                <div
                  className="sticky left-0 z-[3] border-r border-[var(--hos-line)] bg-[var(--hos-cell)] px-2 py-2 text-[10px] font-bold uppercase text-[var(--hos-ink-3)]"
                  style={{ width: LABEL }}
                >
                  Rm
                </div>
                {dates.map((d) => (
                  <div
                    key={d}
                    className={`border-r border-[var(--hos-line)] px-0.5 py-2 text-center text-[9px] font-semibold ${
                      d === today
                        ? "bg-[rgba(59,130,246,0.12)] text-[var(--hos-primary)]"
                        : "text-[var(--hos-ink-3)]"
                    }`}
                    style={{ width: CELL }}
                  >
                    {d.slice(5)}
                  </div>
                ))}
              </div>
              {rooms.slice(0, 16).map((room) => (
                <div
                  key={room.id}
                  className="relative flex border-b border-[var(--hos-line)]"
                  style={{ height: 36 }}
                >
                  <div
                    className="sticky left-0 z-[1] flex items-center justify-center border-r border-[var(--hos-line)] bg-[var(--hos-cell)] px-0.5 font-mono text-[11px] font-bold tabular-nums"
                    style={{ width: LABEL }}
                  >
                    {room.number}
                  </div>
                  <div className="relative flex flex-1">
                    {dates.map((d) => {
                      const cell = maskedCells.find(
                        (c) => c.roomId === room.id && c.stayDate === d,
                      );
                      const free = cell?.displayState === "free" || !cell;
                      const tone =
                        cell?.displayState === "own"
                          ? "bg-[rgba(37,99,235,0.85)] text-white"
                          : cell?.displayState === "masked_occupied"
                            ? "bg-[rgba(100,116,139,0.35)] text-[var(--hos-ink-3)]"
                            : "bg-[var(--hos-cell)] hover:bg-[rgba(16,185,129,0.12)]";
                      return (
                        <button
                          key={d}
                          type="button"
                          title={cell?.label ?? "Available — click to book"}
                          disabled={!free}
                          onClick={() => {
                            if (free) seedBookFromCell(d, room.typeCode);
                          }}
                          className={`flex items-center overflow-hidden border-r border-[var(--hos-line)] px-0.5 text-[9px] font-semibold ${tone} ${free ? "cursor-pointer" : "cursor-default"}`}
                          style={{ width: CELL }}
                        >
                          <span className="truncate">
                            {cell?.displayState === "free" || !cell
                              ? ""
                              : cell?.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </GlassPanel>
        ) : null}

        {tab === "inventory" ? (
          <GlassPanel className="overflow-x-auto p-3.5">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <LayoutGrid className="size-4 text-[var(--hos-primary)]" />
                Sellable heat · next 14 nights
              </div>
              <span className="text-[10px] text-[var(--hos-ink-3)]">
                Emerald open · brass ≤1 · ruby sold
              </span>
            </div>
            <table className="hos-data w-full min-w-[720px] text-left text-xs">
              <thead>
                <tr className="border-b border-[var(--hos-line)] text-[10px] uppercase text-[var(--hos-ink-3)]">
                  <th className="px-2 py-2">Type</th>
                  {dates.slice(0, 7).map((d) => (
                    <th key={d} className="px-2 py-2 text-center">
                      {d.slice(5)}
                    </th>
                  ))}
                  <th className="px-2 py-2 text-right">Tight</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--hos-line)]">
                {inventoryHeat.map((row) => (
                  <tr key={row.typeCode}>
                    <td className="px-2 py-2">
                      <strong>{row.typeCode}</strong>
                      <div className="text-[10px] text-[var(--hos-ink-3)]">
                        {row.typeName}
                      </div>
                    </td>
                    {row.byDate.slice(0, 7).map((c) => (
                      <td key={c.date} className="px-1 py-1.5 text-center">
                        <button
                          type="button"
                          disabled={c.heat === "sold"}
                          onClick={() => seedBookFromCell(c.date, row.typeCode as RoomTypeCode)}
                          className={`inline-flex min-w-[2rem] justify-center rounded-lg px-1.5 py-1 font-mono text-[11px] font-bold tabular-nums ${
                            c.heat === "sold"
                              ? "bg-[rgba(239,68,68,0.15)] text-[var(--hos-ruby)]"
                              : c.heat === "tight"
                                ? "bg-[rgba(245,158,11,0.18)] text-[var(--hos-brass-ink)]"
                                : "bg-[rgba(16,185,129,0.14)] text-[var(--hos-emerald)]"
                          }`}
                        >
                          {c.sellable}
                        </button>
                      </td>
                    ))}
                    <td className="px-2 py-2 text-right font-mono tabular-nums text-[var(--hos-ink-3)]">
                      {row.tightNights}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </GlassPanel>
        ) : null}

        {tab === "rates" ? (
          <GlassPanel className="p-3.5">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <BookOpen className="size-4 text-[var(--hos-primary)]" />
              <strong className="text-sm">{rateCard?.name ?? "No rate card"}</strong>
              <Badge tone="teal">{rateCard?.code ?? "—"}</Badge>
              <span className="text-[11px] text-[var(--hos-ink-3)]">
                {season} · {mealPlan} · compound SC+BST
              </span>
            </div>
            <table className="hos-data w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[var(--hos-line)] text-[10px] uppercase text-[var(--hos-ink-3)]">
                  <th className="px-2 py-2">Room</th>
                  <th className="px-2 py-2 text-right">Dbl</th>
                  <th className="px-2 py-2 text-right">Sgl</th>
                  <th className="px-2 py-2 text-right">Ext</th>
                  <th className="px-2 py-2 text-right">Chd</th>
                  <th className="px-2 py-2 text-right">Dbl sell</th>
                  <th className="px-2 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--hos-line)]">
                {TYPES.map((t) => {
                  const cell = rateRows.find((c) => c.typeCode === t.code);
                  const dbl = cell ? cellBandNet(cell, "double") : 0;
                  const q = quoteDisplay(dbl);
                  return (
                    <tr key={t.code}>
                      <td className="px-2 py-2">
                        {t.name}
                        <div className="text-[10px] text-[var(--hos-ink-3)]">{t.code}</div>
                      </td>
                      <td className="px-2 py-2 text-right font-mono tabular-nums">
                        {formatNu(dbl)}
                      </td>
                      <td className="px-2 py-2 text-right font-mono tabular-nums">
                        {formatNu(cell ? cellBandNet(cell, "single") : 0)}
                      </td>
                      <td className="px-2 py-2 text-right font-mono tabular-nums text-[var(--hos-ink-3)]">
                        {formatNu(cell ? cellBandNet(cell, "extra") : 0)}
                      </td>
                      <td className="px-2 py-2 text-right font-mono tabular-nums text-[var(--hos-ink-3)]">
                        {formatNu(cell ? cellBandNet(cell, "child") : 0)}
                      </td>
                      <td className="px-2 py-2 text-right font-mono tabular-nums font-semibold">
                        {formatNu(q.total)}
                      </td>
                      <td className="px-2 py-2 text-right">
                        <Button
                          size="sm"
                          className="hos-btn-tactile !h-7 !min-h-7 !rounded-full !px-2.5 text-[10px]"
                          onClick={() => {
                            setBookType(t.code);
                            setTab("book");
                          }}
                        >
                          Book
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </GlassPanel>
        ) : null}

        {tab === "menus" ? (
          <GlassPanel className="p-3.5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <strong className="flex items-center gap-1.5 text-sm">
                <BookOpen className="size-4 text-[var(--hos-primary)]" />
                Day &amp; night menus · group nights
              </strong>
              <span className="text-[10px] text-[var(--hos-ink-3)]">
                Posted by hotel F&amp;B · MAP/AP package board
              </span>
            </div>
            {(() => {
              const rangeStays = ownStays.filter(
                (s) => !["cancelled", "no_show"].includes(s.status),
              );
              const from =
                rangeStays.map((s) => s.checkIn).sort()[0] ?? today;
              const to =
                rangeStays
                  .map((s) => s.checkOut)
                  .sort()
                  .at(-1) ?? addDays(today, 5);
              const boards = boardsForRange(from, to);
              if (boards.length === 0) {
                return (
                  <EmptyState
                    title="No menus for your stay nights"
                    description="Hotel F&B posts breakfast / dinner by business date. They appear here for each night of your groups."
                  />
                );
              }
              return (
                <ul className="m-0 grid list-none gap-2 p-0 sm:grid-cols-2">
                  {boards.map((b) => (
                    <li
                      key={b.date}
                      className="hos-luxury-card flex flex-col gap-1.5 px-3 py-3"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <strong className="font-mono text-sm">{b.date}</strong>
                        <Badge tone="teal">{b.postedBy}</Badge>
                      </div>
                      <div className="text-[12px] text-[var(--hos-ink-2)]">
                        <span className="font-bold text-[var(--hos-ink)]">
                          Breakfast
                        </span>{" "}
                        {b.breakfast}
                      </div>
                      {b.lunch ? (
                        <div className="text-[12px] text-[var(--hos-ink-2)]">
                          <span className="font-bold text-[var(--hos-ink)]">
                            Lunch
                          </span>{" "}
                          {b.lunch}
                        </div>
                      ) : null}
                      <div className="text-[12px] text-[var(--hos-ink-2)]">
                        <span className="font-bold text-[var(--hos-ink)]">
                          Dinner
                        </span>{" "}
                        {b.dinner}
                      </div>
                      {b.notes ? (
                        <p className="m-0 text-[10px] text-[var(--hos-ink-3)]">
                          {b.notes}
                        </p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              );
            })()}
          </GlassPanel>
        ) : null}

        {tab === "fleet" ? (
          <MarketplaceDeskPanel
            postedBy="agent"
            posterLabel={agent?.name ?? "Tour agent"}
          />
        ) : null}

        {tab === "book" ? (
          <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
            <GlassPanel className="grid gap-2.5 p-3.5">
              <strong className="flex items-center gap-1.5 text-sm">
                <BedDouble className="size-4 text-[var(--hos-primary)]" />
                Smart hold · {agent.name}
              </strong>
              <input
                value={bookGuest}
                onChange={(e) => setBookGuest(e.target.value)}
                placeholder="Lead guest"
                className="hos-input !rounded-xl !text-[14px]"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="date"
                  value={bookIn}
                  onChange={(e) => setBookIn(e.target.value)}
                  className="hos-input !rounded-xl !text-[13px]"
                />
                <input
                  type="date"
                  value={bookOut}
                  onChange={(e) => setBookOut(e.target.value)}
                  className="hos-input !rounded-xl !text-[13px]"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={bookType}
                  onChange={(e) => setBookType(e.target.value as RoomTypeCode)}
                  className="hos-input !rounded-xl !text-[13px]"
                >
                  {TYPES.map((t) => (
                    <option key={t.code} value={t.code}>
                      {t.code} · {t.name}
                    </option>
                  ))}
                </select>
                <select
                  value={bookMeal}
                  onChange={(e) => setBookMeal(e.target.value as MealPlan)}
                  className="hos-input !rounded-xl !text-[13px]"
                >
                  {(["EP", "CP", "MAP", "AP"] as const).map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <label className="flex flex-col gap-1 text-[11px]">
                  <span className="uppercase text-[var(--hos-ink-3)]">Rooms</span>
                  <select
                    value={bookRooms}
                    onChange={(e) => setBookRooms(Number(e.target.value) || 1)}
                    className="hos-input !rounded-xl !text-[13px]"
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                      <option key={n} value={n}>
                        {n} room{n > 1 ? "s" : ""}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-[11px]">
                  <span className="uppercase text-[var(--hos-ink-3)]">Adults</span>
                  <select
                    value={bookAdults}
                    onChange={(e) => setBookAdults(Number(e.target.value) || 2)}
                    className="hos-input !rounded-xl !text-[13px]"
                  >
                    <option value={1}>1 · single rate</option>
                    <option value={2}>2 · double rate</option>
                  </select>
                </label>
              </div>
              <div className="rounded-xl border border-[var(--hos-line)] bg-[var(--hos-cell)] p-2.5">
                <strong className="text-[11px] text-[var(--hos-ink)]">Menus for your stay</strong>
                <ul className="m-0 mt-1.5 grid list-none gap-1 p-0">
                  {datesBetween(bookIn, bookOut).map((d) => {
                    const board = mealBoards[d];
                    return (
                      <li key={d} className="text-[11px] text-[var(--hos-ink-2)]">
                        <span className="font-mono text-[var(--hos-ink-3)]">{d}</span>
                        {board
                          ? ` · BF ${board.breakfast} · Dinner ${board.dinner}`
                          : " · Kitchen has not posted yet"}
                      </li>
                    );
                  })}
                </ul>
                <p className="m-0 mt-1 text-[10px] text-[var(--hos-ink-3)]">
                  Business date {businessDate} · posted by FO / F&amp;B
                </p>
              </div>
              {allotmentGate.blocked ? (
                <p className="m-0 rounded-xl border border-[rgba(239,68,68,0.35)] bg-[rgba(239,68,68,0.08)] px-3 py-2 text-[12px] text-[var(--hos-ruby)]">
                  {allotmentGate.reason}
                </p>
              ) : null}
              <Button
                className="hos-btn-ink hos-btn-spring !min-h-12 !rounded-2xl"
                disabled={allotmentGate.blocked}
                onClick={placeHold}
              >
                <Zap className="size-4" strokeWidth={2} />
                Place MoU hold
              </Button>
            </GlassPanel>

            <GlassPanel className="flex flex-col gap-3 p-3.5" data-glow="gold">
              <div className="flex items-center gap-2">
                <Sparkles className="size-4 text-[var(--hos-brass)]" strokeWidth={2} />
                <strong className="text-sm">Live MoU advisor</strong>
              </div>
              {smartAdvice ? (
                <>
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div className="rounded-xl border border-[var(--hos-line)] bg-[var(--hos-cell)] px-2.5 py-2">
                      <div className="text-[var(--hos-ink-3)]">Nights</div>
                      <strong className="font-mono text-[15px] tabular-nums">
                        {smartAdvice.nights}
                      </strong>
                    </div>
                    <div className="rounded-xl border border-[var(--hos-line)] bg-[var(--hos-cell)] px-2.5 py-2">
                      <div className="text-[var(--hos-ink-3)]">Sellable</div>
                      <strong
                        className={`font-mono text-[15px] tabular-nums ${
                          smartAdvice.sellableTonight <= 0
                            ? "text-[var(--hos-ruby)]"
                            : smartAdvice.sellableTonight <= 1
                              ? "text-[var(--hos-brass-ink)]"
                              : "text-[var(--hos-emerald)]"
                        }`}
                      >
                        {smartAdvice.sellableTonight}
                      </strong>
                    </div>
                    <div className="rounded-xl border border-[var(--hos-line)] bg-[var(--hos-cell)] px-2.5 py-2">
                      <div className="text-[var(--hos-ink-3)]">Net / night</div>
                      <strong className="font-mono text-[13px] tabular-nums">
                        {formatNu(smartAdvice.netPerNight)}
                      </strong>
                    </div>
                    <div className="rounded-xl border border-[var(--hos-line)] bg-[var(--hos-cell)] px-2.5 py-2">
                      <div className="text-[var(--hos-ink-3)]">All-in stay</div>
                      <strong className="font-mono text-[13px] tabular-nums">
                        {formatNu(smartAdvice.allInStay)}
                      </strong>
                    </div>
                  </div>
                  <p
                    className={`m-0 rounded-xl px-3 py-2.5 text-[12px] font-medium leading-snug ${
                      !smartAdvice.creditOk || smartAdvice.sellableTonight <= 0
                        ? "bg-[rgba(239,68,68,0.1)] text-[var(--hos-ruby)]"
                        : "bg-[rgba(16,185,129,0.1)] text-[var(--hos-emerald)]"
                    }`}
                  >
                    {smartAdvice.recommendation}
                  </p>
                  {smartAdvice.preferredType !== bookType &&
                  smartAdvice.sellableTonight <= 0 ? (
                    <Button
                      size="sm"
                      className="hos-btn-tactile !rounded-full"
                      onClick={() =>
                        setBookType(smartAdvice.preferredType as RoomTypeCode)
                      }
                    >
                      Switch to {smartAdvice.preferredType}
                    </Button>
                  ) : null}
                </>
              ) : null}
              <p className="m-0 text-[10px] text-[var(--hos-ink-3)]">
                Card {rateCard?.code ?? "—"} · SC {formatNu(bookQuote.sc)} · BST{" "}
                {formatNu(bookQuote.bst)} per night
              </p>
            </GlassPanel>
          </div>
        ) : null}

        {tab === "bookings" ? (
          <GlassPanel className="overflow-x-auto p-3.5">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <strong className="text-sm">My bookings</strong>
              <Button
                size="sm"
                className="hos-btn-ink !rounded-full"
                onClick={() => {
                  const r = exportPartnerBookingsCsv(agent.code, ownStays);
                  toast.success("Bookings exported", {
                    description: `${r.rows} rows · ${r.filename}`,
                  });
                }}
              >
                Export CSV
              </Button>
            </div>
            {!hasActiveMou(agent.id, sessionPropertyId) ? (
              <EmptyState
                title="No active MoU"
                description="Propose or accept a MoU with this hotel before bookings unlock."
              />
            ) : ownStays.length === 0 ? (
              <EmptyState
                title="No bookings"
                description="Place a hold from Smart Book or tap a free calendar cell."
                action={
                  <Button size="sm" className="hos-btn-ink" onClick={() => setTab("book")}>
                    Smart hold
                  </Button>
                }
              />
            ) : (
              <>
              <table className="hos-data w-full min-w-[640px] text-left text-xs">
                <thead>
                  <tr className="border-b border-[var(--hos-line)] text-[10px] uppercase text-[var(--hos-ink-3)]">
                    <th className="px-2 py-2">Conf</th>
                    <th className="px-2 py-2">Guest</th>
                    <th className="px-2 py-2">Dates</th>
                    <th className="px-2 py-2">Room</th>
                    <th className="px-2 py-2 text-right">Net</th>
                    <th className="px-2 py-2">Status</th>
                    <th className="px-2 py-2">Night menu</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--hos-line)]">
                  {ownStays.map((s) => {
                    const menus = mealBoards
                      ? Object.values(mealBoards).filter(
                          (b) => b.date >= s.checkIn && b.date < s.checkOut,
                        )
                      : [];
                    return (
                    <tr key={s.id}>
                      <td className="px-2 py-2 font-mono">{s.confirmationNo}</td>
                      <td className="px-2 py-2 font-semibold">{s.guestName}</td>
                      <td className="px-2 py-2">
                        {s.checkIn} → {s.checkOut}
                      </td>
                      <td className="px-2 py-2">{s.roomNumber ?? "TBA"}</td>
                      <td className="px-2 py-2 text-right font-mono tabular-nums">
                        {formatNu(s.nightlyNet)}
                      </td>
                      <td className="px-2 py-2">
                        <Badge tone={s.status === "held" ? "vip" : "success"}>
                          {s.status}
                        </Badge>
                      </td>
                      <td className="max-w-[220px] px-2 py-2 text-[10px] text-[var(--hos-ink-3)]">
                        {menus.length === 0
                          ? "No menu posted"
                          : menus
                              .slice(0, 3)
                              .map((m) => `${m.date}: BF ${m.breakfast.slice(0, 24)}…`)
                              .join(" · ")}
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
              <div className="mt-3 rounded-xl border border-[var(--hos-line)] bg-[var(--hos-cell)] p-3">
                <strong className="text-xs uppercase tracking-wide text-[var(--hos-ink-3)]">
                  MoU with Demo Hotel
                </strong>
                <ul className="m-0 mt-2 list-none space-y-1 p-0 text-[11px]">
                  {mouLinks
                    .filter((l) => l.agentId === agent.id)
                    .map((l) => (
                      <li key={l.id} className="flex flex-wrap items-center justify-between gap-2">
                        <span>
                          {l.status} · by {l.proposedByActor}
                          {l.decidedByActor ? ` · decided ${l.decidedByActor}` : ""}
                        </span>
                        {l.status === "pending_counterparty" && l.initiatedBy === "hotel" ? (
                          <Button
                            size="sm"
                            onClick={() => {
                              const res = decideMou(
                                l.id,
                                "active",
                                portalUsers.find((u) => u.id === sessionPortalUserId)?.name ??
                                  agent.name,
                              );
                              if (!res.ok) toast.error(res.error);
                              else toast.success("MoU accepted");
                            }}
                          >
                            Accept
                          </Button>
                        ) : null}
                      </li>
                    ))}
                </ul>
                {canPortal("mou") ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    className="mt-2 !rounded-full"
                    onClick={() => {
                      const res = proposeMou({
                        propertyId: DEMO_MOU_PROPERTY_ID,
                        propertyName: "Demo Hotel",
                        agentId: agent.id,
                        initiatedBy: "agent",
                        actor:
                          portalUsers.find((u) => u.id === sessionPortalUserId)?.name ??
                          agent.name,
                      });
                      if (!res.ok) toast.error(res.error);
                      else toast.success("MoU proposed to hotel");
                    }}
                  >
                    Propose MoU
                  </Button>
                ) : null}
              </div>
              </>
            )}
          </GlassPanel>
        ) : null}

        {tab === "rooming" ? (
          <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
            <GlassPanel className="flex flex-col gap-2 p-3.5">
              <strong className="flex items-center gap-1.5 text-sm">
                <ClipboardList className="size-4 text-[var(--hos-primary)]" aria-hidden />
                Rooming grid
              </strong>
              <input
                value={lead}
                onChange={(e) => setLead(e.target.value)}
                placeholder="Lead guest"
                className="hos-input !rounded-xl !text-[13px]"
              />
              <input
                value={passport}
                onChange={(e) => setPassport(e.target.value)}
                placeholder="Passport / CID"
                className="hos-input !rounded-xl !text-[13px]"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  value={nat}
                  onChange={(e) => setNat(e.target.value)}
                  placeholder="Nationality"
                  className="hos-input !rounded-xl !text-[13px]"
                />
                <select
                  value={meal}
                  onChange={(e) => setMeal(e.target.value as MealPlan)}
                  className="hos-input !rounded-xl !text-[13px]"
                >
                  {(["EP", "CP", "MAP", "AP"] as const).map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
              <input
                value={diet}
                onChange={(e) => setDiet(e.target.value)}
                placeholder="Dietary / meal flags"
                className="hos-input !rounded-xl !text-[13px]"
              />
              <Button
                size="sm"
                className="hos-btn-ink !rounded-xl"
                onClick={() => {
                  if (!lead || !passport) {
                    toast.error("Guest and passport required");
                    return;
                  }
                  addRoomer({
                    leadGuest: lead,
                    passportOrCid: passport,
                    nationality: nat,
                    mealPlan: meal,
                    dietary: diet,
                  });
                  setLead("");
                  setPassport("");
                  toast.success("Roomer added");
                }}
              >
                Add row
              </Button>
              <textarea
                value={paste}
                onChange={(e) => setPaste(e.target.value)}
                rows={4}
                placeholder="Guest | Passport | Nationality | Meal | Diet | Bags | Color | Desc"
                className="rounded-xl border border-[var(--hos-line)] bg-[var(--hos-cell)] px-3 py-2 font-mono text-[11px]"
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    const res = importRoamingPaste(paste);
                    if (!res.ok) toast.error(res.error);
                    else {
                      toast.success(`Imported ${res.count} rows`);
                      setPaste("");
                    }
                  }}
                >
                  Paste import
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    const suggestions = suggestRoomsFromMask();
                    toast.success("Rooms suggested from mask", {
                      description: `${suggestions.length} assignment(s)`,
                    });
                  }}
                >
                  Suggest rooms
                </Button>
                <Button size="sm" variant="ghost" onClick={() => clearRoamingDraft()}>
                  Clear
                </Button>
              </div>
              <Button
                className="hos-btn-ink !rounded-xl"
                onClick={() => {
                  void (async () => {
                    const res = await submitRoomingToDesk(lastBookedGroupId);
                    if (!res.ok) toast.error(res.error);
                    else
                      toast.success(`Linked ${res.linked}/${res.count} to desk StayHub`, {
                        description: "Guests, CID, luggage now on Guests & Docs",
                      });
                  })();
                }}
              >
                Submit to desk
              </Button>
              {roomingSubmittedAt ? (
                <p className="m-0 text-[11px] text-[var(--hos-emerald)]">
                  Last submitted {new Date(roomingSubmittedAt).toLocaleString()}
                </p>
              ) : null}
              {roomingIssues.length > 0 ? (
                <p className="m-0 text-[11px] font-medium text-[var(--hos-ruby)]">
                  {roomingIssues.length} validation issue(s) — fix passport rows before
                  submit.
                </p>
              ) : null}
            </GlassPanel>
            <GlassPanel className="overflow-x-auto p-3">
              <table className="hos-data w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[var(--hos-line)] text-[10px] uppercase text-[var(--hos-ink-3)]">
                    <th className="px-2 py-2">Guest</th>
                    <th className="px-2 py-2">+1</th>
                    <th className="px-2 py-2">Passport</th>
                    <th className="px-2 py-2">Bags</th>
                    <th className="px-2 py-2">Colour</th>
                    <th className="px-2 py-2">Desc</th>
                    <th className="px-2 py-2">Meal</th>
                    <th className="px-2 py-2">Room</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--hos-line)]">
                  {roomingDraft.map((r) => (
                    <tr
                      key={r.id}
                      className={
                        issueIds.has(r.id) ? "bg-[rgba(239,68,68,0.08)]" : undefined
                      }
                    >
                      <td className="px-2 py-2 font-semibold">{r.leadGuest}</td>
                      <td className="px-2 py-2">
                        <input
                          value={r.companionName ?? ""}
                          onChange={(e) =>
                            updateRoomer(r.id, { companionName: e.target.value })
                          }
                          className="hos-input !min-h-7 !px-1.5 !text-[11px]"
                          placeholder="—"
                        />
                      </td>
                      <td className="px-2 py-2 font-mono">{r.passportOrCid}</td>
                      <td className="px-2 py-2">
                        <input
                          type="number"
                          min={0}
                          max={20}
                          value={r.luggage?.count ?? 0}
                          onChange={(e) =>
                            updateRoomer(r.id, {
                              luggage: {
                                count: Number(e.target.value) || 0,
                                color: r.luggage?.color ?? "mixed",
                                description: r.luggage?.description ?? "",
                              },
                            })
                          }
                          className="hos-input !min-h-7 !w-14 !px-1.5 !font-mono !text-[11px]"
                        />
                      </td>
                      <td className="px-2 py-2">
                        <input
                          value={r.luggage?.color ?? ""}
                          onChange={(e) =>
                            updateRoomer(r.id, {
                              luggage: {
                                count: r.luggage?.count ?? 0,
                                color: e.target.value,
                                description: r.luggage?.description ?? "",
                              },
                            })
                          }
                          className="hos-input !min-h-7 !w-16 !px-1.5 !text-[11px]"
                          placeholder="black"
                        />
                      </td>
                      <td className="px-2 py-2">
                        <input
                          value={r.luggage?.description ?? ""}
                          onChange={(e) =>
                            updateRoomer(r.id, {
                              luggage: {
                                count: r.luggage?.count ?? 0,
                                color: r.luggage?.color ?? "mixed",
                                description: e.target.value,
                              },
                            })
                          }
                          className="hos-input !min-h-7 !min-w-[6rem] !px-1.5 !text-[11px]"
                          placeholder="hard + soft"
                        />
                      </td>
                      <td className="px-2 py-2">
                        <Badge tone="teal">{r.mealPlan}</Badge>
                      </td>
                      <td className="px-2 py-2">{r.suggestedRoom ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </GlassPanel>
          </div>
        ) : null}

        {tab === "changes" ? (
          <div className="grid gap-4 lg:grid-cols-2">
            <GlassPanel className="flex flex-col gap-2 p-3.5">
              <strong className="flex items-center gap-1.5 text-sm">
                <Inbox className="size-4 text-[var(--hos-primary)]" />
                Submit change
              </strong>
              <div className="grid grid-cols-2 gap-2">
                <input
                  value={guestFrom}
                  onChange={(e) => setGuestFrom(e.target.value)}
                  placeholder="Current guest name"
                  className="hos-input !rounded-xl !text-[13px]"
                />
                <input
                  value={guestTo}
                  onChange={(e) => setGuestTo(e.target.value)}
                  placeholder="Corrected name"
                  className="hos-input !rounded-xl !text-[13px]"
                />
              </div>
              <Button
                size="sm"
                className="hos-btn-ink !rounded-xl"
                onClick={() => {
                  if (!guestFrom || !guestTo) {
                    toast.error("Both names required");
                    return;
                  }
                  const res = submitGuestNameChange(guestFrom, guestTo);
                  if (!res.ok) toast.error(res.error);
                  else {
                    toast.success("Name change queued for desk");
                    setGuestFrom("");
                    setGuestTo("");
                  }
                }}
              >
                Submit guest rename
              </Button>
              <input
                value={opsSummary}
                onChange={(e) => setOpsSummary(e.target.value)}
                className="hos-input !rounded-xl !text-[13px]"
              />
              <textarea
                value={opsDetail}
                onChange={(e) => setOpsDetail(e.target.value)}
                rows={3}
                className="rounded-xl border border-[var(--hos-line)] bg-[var(--hos-cell)] px-3 py-2 text-xs"
              />
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    "cancel",
                    "postpone",
                    "prepone",
                    "add_room",
                    "reduce_room",
                    "rooms",
                    "dates",
                    "meal_plan",
                    "extras",
                  ] as const
                ).map((kind) => (
                  <Button
                    key={kind}
                    size="sm"
                    variant="secondary"
                    className="!rounded-full"
                    disabled={!canPortal("changes")}
                    onClick={() => {
                      const stay = ownStays[0];
                      const res = submitOpsChange(kind, opsSummary, opsDetail, {
                        stayId: stay?.id,
                        groupId: stay?.groupId ?? lastBookedGroupId,
                        newCheckOut:
                          kind === "postpone" && stay
                            ? addDays(stay.checkOut, 1)
                            : kind === "prepone" && stay
                              ? addDays(stay.checkOut, -1)
                              : undefined,
                        mealPlan: kind === "meal_plan" ? "AP" : undefined,
                        typeCode: kind === "add_room" ? bookType : undefined,
                        roomsDelta: kind === "add_room" ? 1 : kind === "reduce_room" ? -1 : undefined,
                      });
                      if (!res.ok) toast.error(res.error);
                      else toast.success("Queued for desk review", { description: kind });
                    }}
                  >
                    {kind}
                  </Button>
                ))}
              </div>
              <div className="mt-2 grid gap-2 rounded-xl border border-[var(--hos-line)] p-2">
                <strong className="text-[11px] uppercase text-[var(--hos-ink-3)]">
                  Guide / driver (direct save)
                </strong>
                <input
                  value={guideGroupId}
                  onChange={(e) => setGuideGroupId(e.target.value)}
                  placeholder="Group id"
                  className="hos-input !rounded-xl !text-[13px]"
                />
                <input
                  value={guideName}
                  onChange={(e) => setGuideName(e.target.value)}
                  placeholder="Guide name"
                  className="hos-input !rounded-xl !text-[13px]"
                />
                <input
                  value={driverName}
                  onChange={(e) => setDriverName(e.target.value)}
                  placeholder="Driver name"
                  className="hos-input !rounded-xl !text-[13px]"
                />
                <Button
                  size="sm"
                  className="hos-btn-ink !rounded-full"
                  disabled={!canPortal("guide_driver")}
                  onClick={() => {
                    const res = updateGuideDriver({
                      groupId: guideGroupId,
                      guideName: guideName || undefined,
                      driverName: driverName || undefined,
                    });
                    if (!res.ok) toast.error(res.error);
                    else toast.success("Guide/driver saved", {
                      description: portalUsers.find((u) => u.id === sessionPortalUserId)?.name,
                    });
                  }}
                >
                  Save logistics
                </Button>
              </div>
              <p className="m-0 text-[11px] text-[var(--hos-ink-3)]">
                Dates/rooms/cancel need desk approve (applies FO). Guide/driver saves directly.
              </p>
            </GlassPanel>
            <GlassPanel className="space-y-2 p-3.5">
              <strong className="text-sm">Change inbox · SLA radar</strong>
              {changeRequests
                .filter((c) => c.agentId === agent.id)
                .map((req) => (
                <div
                  key={req.id}
                  className="hos-luxury-card border border-[var(--hos-line)] p-3"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={slaTone(req)}>{slaLabel(req)}</Badge>
                    <span className="text-[10px] uppercase text-[var(--hos-ink-3)]">
                      {req.kind}
                    </span>
                  </div>
                  <div className="mt-1 text-sm font-semibold text-[var(--hos-ink)]">
                    {req.summary}
                  </div>
                  <p className="m-0 mt-0.5 text-[11px] text-[var(--hos-ink-3)]">
                    {req.detail}
                  </p>
                  <p className="m-0 mt-1 text-[10px] text-[var(--hos-ink-3)]">
                    Submitted by {req.submittedBy}
                    {req.reviewedBy ? ` · reviewed ${req.reviewedBy}` : ""}
                  </p>
                </div>
              ))}
            </GlassPanel>
          </div>
        ) : null}

        {tab === "money" ? (
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(280px,0.85fr)]">
            <GlassPanel className="overflow-hidden p-3.5">
              <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <strong className="flex items-center gap-1.5 text-sm">
                    <FileStack className="size-4 text-[var(--hos-primary)]" />
                    All invoices · city ledger
                  </strong>
                  <p className="m-0 mt-0.5 text-[11px] text-[var(--hos-ink-3)]">
                    Tax invoices, PSBN &amp; working folios for {agent.name}
                  </p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <Button
                    size="sm"
                    variant="secondary"
                    className="!min-h-9 !rounded-full !px-3"
                    onClick={() => setPrintPackOpen(true)}
                    data-testid="partner-print-pack"
                  >
                    <Printer className="size-3.5" strokeWidth={2} />
                    Print pack
                  </Button>
                  {(
                    [
                      {
                        id: "all" as const,
                        label: "All",
                        count: invoiceTotals.allCount,
                      },
                      {
                        id: "unpaid" as const,
                        label: "Unpaid",
                        count: invoiceTotals.unpaidCount,
                      },
                      {
                        id: "paid" as const,
                        label: "Paid",
                        count: invoiceTotals.paidCount,
                      },
                    ] as const
                  ).map((f) => {
                    const active = invoiceFilter === f.id;
                    return (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => setInvoiceFilter(f.id)}
                        className={[
                          "hos-btn-tactile inline-flex min-h-9 items-center gap-1.5 rounded-full px-3 text-[12px] font-bold transition",
                          active
                            ? f.id === "unpaid"
                              ? "bg-[var(--hos-ruby)] text-white"
                              : f.id === "paid"
                                ? "bg-[var(--hos-emerald)] text-white"
                                : "bg-[#111] text-white"
                            : "border border-[var(--hos-line)] bg-[var(--hos-cell)] text-[var(--hos-ink-2)]",
                        ].join(" ")}
                      >
                        {f.label}
                        <span
                          className={[
                            "rounded-full px-1.5 py-0.5 font-mono text-[10px] tabular-nums",
                            active ? "bg-white/20" : "bg-[rgba(17,17,17,0.06)]",
                          ].join(" ")}
                        >
                          {f.count}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                <div className="hos-luxury-card p-2.5 text-center text-[11px]">
                  <div className="text-[var(--hos-ink-3)]">Unpaid</div>
                  <strong className="font-mono tabular-nums text-[var(--hos-ruby)]">
                    {formatNu(invoiceTotals.unpaidAmt)}
                  </strong>
                </div>
                <div className="hos-luxury-card p-2.5 text-center text-[11px]">
                  <div className="text-[var(--hos-ink-3)]">Paid</div>
                  <strong className="font-mono tabular-nums text-[var(--hos-emerald)]">
                    {formatNu(invoiceTotals.paidAmt)}
                  </strong>
                </div>
                <div className="hos-luxury-card p-2.5 text-center text-[11px]">
                  <div className="text-[var(--hos-ink-3)]">30d AR</div>
                  <strong className="font-mono tabular-nums">
                    {formatNu(agent.aging.d30)}
                  </strong>
                </div>
                <div className="hos-luxury-card border-[rgba(239,68,68,0.3)] p-2.5 text-center text-[11px]">
                  <div className="text-[var(--hos-ink-3)]">90d+</div>
                  <strong className="font-mono tabular-nums text-[var(--hos-ruby)]">
                    {formatNu(agent.aging.d90)}
                  </strong>
                </div>
              </div>

              <div className="mb-3 flex flex-wrap items-center gap-2">
                <input
                  value={invoiceQuery}
                  onChange={(e) => setInvoiceQuery(e.target.value)}
                  placeholder="Search doc, guest, stay ref…"
                  className="hos-input min-w-[160px] flex-1 !min-h-10 !rounded-xl !text-[13px]"
                  inputMode="search"
                />
                <Button
                  size="sm"
                  variant="secondary"
                  className="hos-btn-tactile !min-h-10 gap-1.5 !rounded-xl text-[12px] font-bold"
                  disabled={filteredInvoices.length === 0}
                  onClick={() => {
                    if (!agent) return;
                    const res = exportPartnerInvoicesExcel(
                      agent.code,
                      filteredInvoices,
                    );
                    toast.success("Invoices exported for Excel", {
                      description: `${res.filename} · ${res.rows} row(s)`,
                    });
                  }}
                >
                  <Download className="size-3.5" strokeWidth={2} />
                  Export Excel
                </Button>
              </div>

              <div className="hos-scrollbar-slim max-h-[min(520px,60vh)] overflow-auto rounded-xl border border-[var(--hos-line)]">
                <table className="hos-data w-full min-w-[720px] text-left text-xs">
                  <thead className="sticky top-0 z-[1] bg-[var(--hos-cell)]">
                    <tr className="border-b border-[var(--hos-line)] text-[10px] uppercase tracking-wide text-[var(--hos-ink-3)]">
                      <th className="px-2.5 py-2.5">Doc</th>
                      <th className="px-2.5 py-2.5">Guest / group</th>
                      <th className="px-2.5 py-2.5">Date</th>
                      <th className="px-2.5 py-2.5 text-right">Amount</th>
                      <th className="px-2.5 py-2.5 text-right">Balance</th>
                      <th className="px-2.5 py-2.5">Status</th>
                      <th className="px-2.5 py-2.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--hos-line)] bg-white text-[var(--hos-ink)] dark:bg-[var(--hos-cell)]">
                    {filteredInvoices.map((d) => {
                      const when = new Date(d.at).toLocaleDateString("en-GB", {
                        day: "2-digit",
                        month: "short",
                        year: "2-digit",
                      });
                      const canOpen = Boolean(d.stayId);
                      return (
                        <tr
                          key={d.id}
                          className={[
                            "align-middle transition-colors",
                            canOpen
                              ? "cursor-pointer hover:bg-[color-mix(in_srgb,var(--hos-primary)_6%,transparent)]"
                              : "",
                          ].join(" ")}
                          onClick={() => {
                            if (canOpen) openPartnerInvoice(d, false);
                          }}
                        >
                          <td className="px-2.5 py-2.5">
                            <button
                              type="button"
                              className={[
                                "text-left font-mono text-[12px] font-semibold",
                                canOpen
                                  ? "text-[var(--hos-primary)] underline-offset-2 hover:underline"
                                  : "text-[var(--hos-ink)]",
                              ].join(" ")}
                              disabled={!canOpen}
                              onClick={(e) => {
                                e.stopPropagation();
                                openPartnerInvoice(d, false);
                              }}
                            >
                              {d.docNo}
                            </button>
                            <div className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--hos-ink-3)]">
                              {d.kind}
                              {d.source === "stay" ? " · working" : ""}
                            </div>
                          </td>
                          <td className="px-2.5 py-2.5">
                            <div className="font-semibold text-[var(--hos-ink)]">
                              {d.guest}
                            </div>
                            {d.stayRef ? (
                              <div className="mt-0.5 font-mono text-[10px] text-[var(--hos-ink-3)]">
                                {d.stayRef}
                              </div>
                            ) : null}
                          </td>
                          <td className="whitespace-nowrap px-2.5 py-2.5 font-mono tabular-nums text-[var(--hos-ink-2)]">
                            {when}
                          </td>
                          <td className="px-2.5 py-2.5 text-right font-mono tabular-nums">
                            {formatNu(d.amount)}
                          </td>
                          <td
                            className={[
                              "px-2.5 py-2.5 text-right font-mono font-bold tabular-nums",
                              d.balance > PERSONAL_CHECKOUT_GATE_BTN
                                ? "text-[var(--hos-ruby)]"
                                : "text-[var(--hos-emerald)]",
                            ].join(" ")}
                          >
                            {formatNu(d.balance)}
                          </td>
                          <td className="px-2.5 py-2.5">
                            <Badge
                              tone={
                                d.status === "paid"
                                  ? "success"
                                  : d.status === "void"
                                    ? "muted"
                                    : "danger"
                              }
                            >
                              {d.status}
                            </Badge>
                          </td>
                          <td className="px-2.5 py-2.5">
                            <div className="flex justify-end gap-1">
                              <Button
                                size="sm"
                                variant="secondary"
                                className="!min-h-8 !rounded-lg !px-2 text-[11px] font-bold"
                                disabled={!canOpen}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openPartnerInvoice(d, false);
                                }}
                              >
                                Open
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="!min-h-8 gap-1 !rounded-lg !px-2 text-[11px] font-bold"
                                disabled={!canOpen}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openPartnerInvoice(d, true);
                                }}
                              >
                                <Printer className="size-3" strokeWidth={2} />
                                Print
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {filteredInvoices.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-2 py-10">
                          <EmptyState
                            title={
                              invoiceFilter === "paid"
                                ? "No paid invoices"
                                : invoiceFilter === "unpaid"
                                  ? "No unpaid invoices"
                                  : "No invoices yet"
                            }
                            description="Fiscal docs and open stay folios for this MoU appear here."
                          />
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </GlassPanel>

            <GlassPanel className="flex flex-col gap-2 p-3.5">
              <strong className="flex items-center gap-1.5 text-sm">
                <Wallet className="size-4 text-[var(--hos-primary)]" />
                Deposit proof · smart match
              </strong>
              <p className="m-0 text-[11px] text-[var(--hos-ink-3)]">
                Match bank / mBoB proof against unpaid invoices above.
              </p>
              <input
                type="number"
                value={depAmt}
                onChange={(e) => setDepAmt(Number(e.target.value) || 0)}
                className="hos-input !rounded-xl !text-[13px]"
              />
              <input
                value={depRef}
                onChange={(e) => setDepRef(e.target.value)}
                placeholder="Bank / mBoB ref"
                className="hos-input !rounded-xl !text-[13px]"
              />
              <select
                value={depMethod}
                onChange={(e) => setDepMethod(e.target.value as "wire" | "mbob")}
                className="hos-input !rounded-xl !text-[13px]"
              >
                <option value="mbob">mBoB</option>
                <option value="wire">Wire</option>
              </select>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  className="!rounded-full"
                  onClick={() => setMatchHints(suggestDepositMatches(depAmt))}
                >
                  Suggest match
                </Button>
                <Button
                  size="sm"
                  className="hos-btn-ink !rounded-full"
                  onClick={() => {
                    const res = uploadDeposit({
                      amount: depAmt,
                      method: depMethod,
                      ref: depRef,
                      note: `${agent.code} portal upload`,
                    });
                    if (!res.ok) {
                      toast.error(res.error);
                      return;
                    }
                    toast.success("Uploaded for desk verify", {
                      description: res.slip.ref,
                    });
                    setDepRef("");
                  }}
                >
                  <Upload className="mr-1 size-3.5" />
                  Upload for desk
                </Button>
              </div>
              {matchHints.length ? (
                <ul className="m-0 list-none space-y-1 p-0 text-[11px]">
                  {matchHints.map((h) => (
                    <li
                      key={h.fiscalDocId}
                      className="hos-luxury-card flex justify-between px-2.5 py-2"
                    >
                      <span>
                        {h.docNo} · {formatNu(h.amount)}
                      </span>
                      <span className="font-mono text-[var(--hos-ink-3)]">
                        Δ {formatNu(h.delta)}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : null}
              <div className="mt-2 space-y-1.5">
                {depositSlips.map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center justify-between rounded-xl border border-[var(--hos-line)] px-2.5 py-2 text-[11px]"
                  >
                    <span>
                      {formatNu(s.amount)} · {s.ref}
                    </span>
                    <Badge
                      tone={
                        s.status === "verified"
                          ? "success"
                          : s.status === "rejected"
                            ? "danger"
                            : "vip"
                      }
                    >
                      {s.status}
                    </Badge>
                  </div>
                ))}
              </div>
              <p className="m-0 text-[11px] text-[var(--hos-ink-3)]">
                Desk verifies deposits on Agents · Operator 360.
              </p>
              <div className="mt-3 border-t border-[var(--hos-line)] pt-3">
                <strong className="text-xs uppercase tracking-wide text-[var(--hos-ink-3)]">
                  Voucher PDF → master folio
                </strong>
                <input
                  value={voucherFile}
                  onChange={(e) => setVoucherFile(e.target.value)}
                  placeholder="Yangphel-voucher-Oct.pdf"
                  className="hos-input mt-2 !rounded-xl !text-[13px]"
                />
                <input
                  type="number"
                  value={voucherAmt}
                  onChange={(e) => setVoucherAmt(Number(e.target.value) || 0)}
                  className="hos-input mt-2 !rounded-xl !text-[13px]"
                />
                <Button
                  size="sm"
                  className="mt-2 !min-h-12 w-full !rounded-xl"
                  onClick={() => {
                    void uploadVoucherPdf({
                      fileName: voucherFile || "voucher.pdf",
                      amountBtn: voucherAmt,
                    }).then((res) => {
                      if (!res.ok) toast.error(res.error);
                      else
                        toast.success("Voucher linked to master folio", {
                          description: res.voucher.fileName,
                        });
                    });
                  }}
                >
                  <FileStack className="mr-1 size-3.5" />
                  Upload voucher PDF
                </Button>
                {vouchers.length > 0 ? (
                  <ul className="m-0 mt-2 list-none space-y-1 p-0 text-[11px]">
                    {vouchers.slice(0, 5).map((v) => (
                      <li
                        key={v.id}
                        className="flex items-center justify-between gap-2 rounded-lg border border-[var(--hos-line)] px-2 py-1.5"
                      >
                        <span className="truncate">
                          {v.fileName} · {formatNu(v.amountBtn)}
                        </span>
                        <Badge
                          tone={
                            v.status === "linked"
                              ? "success"
                              : v.status === "failed"
                                ? "danger"
                                : "vip"
                          }
                        >
                          {v.status}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </GlassPanel>
          </div>
        ) : null}
      </div>

      <InvoiceModal
        open={Boolean(paperStay)}
        stay={paperStay}
        stream="master"
        autoPrint={paperAutoPrint}
        onClose={() => {
          setPaperStayId(null);
          setPaperAutoPrint(false);
        }}
      />

      <AgentPrintPackOverlay
        open={printPackOpen}
        agent={agent}
        stays={ownStays}
        fiscalDocs={fiscalDocs}
        onClose={() => setPrintPackOpen(false)}
      />
    </ModuleFrame>
  );
}
