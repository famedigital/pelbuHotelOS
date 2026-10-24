"use server";

import { confirmCheckOut } from "@/app/actions/erp-checkin";
import { postFolioRoomNight } from "@/app/actions/erp-folio-ops";
import { writeAuditEvent } from "@/lib/audit";
import {
  GEMINI_CONSENT_SYSTEM,
  generateGeminiJsonFast,
  loadGeminiByok,
} from "@/lib/ai/gemini-byok";
import { isDeskAuthenticated } from "@/lib/desk-auth";
import { assertDeskProperty } from "@/lib/desk/property-guard";
import {
  INNORA_PAGES,
  isInnoraPage,
  likeNeedle,
  matchStay,
  parseInnoraIntent,
  type InnoraIntent,
  type InnoraStayStep,
} from "@/lib/ai/innora-fast-route";
import { ensureOpenFolio } from "@/lib/folio/open-folio";
import { resolveActivePropertyId } from "@/lib/property-context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type InnoraChatTurn = {
  role: "user" | "innora";
  text: string;
};

export type InnoraActionKind =
  | "checkout"
  | "open_folio"
  | "post_room_night"
  | "show_folio";

export type InnoraPendingAction = {
  kind: InnoraActionKind;
  bookingId: string;
  label: string;
};

export type InnoraOpenStay = {
  bookingId: string;
  step: InnoraStayStep | null;
};

export type InnoraChatResult =
  | {
      ok: true;
      reply: string;
      action: InnoraPendingAction | null;
      href?: string;
      lines?: string[];
      openStay?: InnoraOpenStay | null;
    }
  | { ok: false; error: string };

export type InnoraRunResult = {
  ok: boolean;
  message: string;
  href?: string;
};

type StaySnap = {
  id: string;
  name: string;
  code: string;
  status: string;
  checkIn: string;
  checkOut: string;
  rooms: string;
  folioId: string | null;
};

const KINDS = new Set<InnoraActionKind>([
  "checkout",
  "open_folio",
  "post_room_night",
  "show_folio",
]);

async function requireDeskProperty() {
  if (!(await isDeskAuthenticated())) {
    throw new Error("Desk session expired. Sign in again.");
  }
  const admin = createSupabaseAdminClient();
  const propertyId = await resolveActivePropertyId(admin);
  return { admin, propertyId };
}

function roomLabel(row: Record<string, unknown>): string {
  const assigns = row.room_assignments;
  if (!Array.isArray(assigns)) return "";
  const labels: string[] = [];
  for (const item of assigns) {
    if (!item || typeof item !== "object") continue;
    const unit = (item as { room_units?: { label?: string } | { label?: string }[] })
      .room_units;
    const one = Array.isArray(unit) ? unit[0] : unit;
    const label = one?.label?.trim();
    if (label) labels.push(label);
  }
  return labels.join(", ");
}

async function loadStaySnaps(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  propertyId: string,
): Promise<StaySnap[]> {
  const { data } = await admin
    .from("bookings")
    .select(
      "id, confirmation_code, contact_name, status, check_in, check_out, room_assignments(room_units(label)), folios(id, status)",
    )
    .eq("property_id", propertyId)
    .in("status", ["checked_in", "confirmed", "pending"])
    .order("check_in", { ascending: true })
    .limit(80);

  return (data ?? []).map((row) => {
    const folios = (row.folios as { id?: string; status?: string }[] | null) ?? [];
    const open = folios.find((folio) => folio.status === "open") ?? folios[0];
    return {
      id: row.id as string,
      name: String(row.contact_name ?? "Guest"),
      code: String(row.confirmation_code ?? ""),
      status: String(row.status ?? ""),
      checkIn: String(row.check_in ?? "").slice(0, 10),
      checkOut: String(row.check_out ?? "").slice(0, 10),
      rooms: roomLabel(row as Record<string, unknown>),
      folioId: (open?.id as string | undefined) ?? null,
    };
  });
}

function billLine(row: {
  contact_name?: string | null;
  status?: string | null;
  check_in?: string | null;
  check_out?: string | null;
  folios?: {
    fiscal_documents?: { doc_no?: string; doc_kind?: string; status?: string }[] | null;
  }[] | null;
}): string {
  const folios = row.folios ?? [];
  const docs = folios.flatMap((folio) => folio.fiscal_documents ?? []);
  const invoice = docs.find(
    (doc) => doc.doc_kind === "invoice" && doc.status === "issued",
  );
  const who = String(row.contact_name ?? "Guest");
  const when = [row.check_in, row.check_out]
    .map((day) => String(day ?? "").slice(5, 10))
    .filter(Boolean)
    .join("–");
  const head = invoice?.doc_no || "No bill number yet";
  return [head, who, when, row.status].filter(Boolean).join(" · ");
}

async function findBills(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  propertyId: string,
  query: string,
): Promise<InnoraChatResult> {
  const needle = likeNeedle(query);
  const { data: agents } = await admin
    .from("agents")
    .select("id, company_name")
    .ilike("company_name", needle)
    .order("company_name")
    .limit(6);

  const named = agents ?? [];
  let chosen = named;
  if (named.length > 1) {
    const ids = named.map((agent) => agent.id as string);
    const { data: stayRows } = await admin
      .from("bookings")
      .select("agent_id")
      .eq("property_id", propertyId)
      .in("agent_id", ids)
      .limit(300);
    const withStays = new Set(
      (stayRows ?? []).map((row) => row.agent_id as string),
    );
    const onHotel = named.filter((agent) => withStays.has(agent.id as string));
    if (onHotel.length) chosen = onHotel;
  }

  const wanted = query.toLowerCase().replace(/[^a-z0-9]/g, "");
  const exact = chosen.filter(
    (agent) =>
      String(agent.company_name).toLowerCase().replace(/[^a-z0-9]/g, "") ===
      wanted,
  );
  if (exact.length) chosen = exact;

  if (chosen.length > 1) {
    const sameName =
      new Set(
        chosen.map((agent) =>
          String(agent.company_name).toLowerCase().replace(/[^a-z0-9]/g, ""),
        ),
      ).size === 1;
    if (!sameName) {
      return {
        ok: true,
        reply: "More than one partner matches. Say the full name.",
        action: null,
        lines: chosen.map((agent) => String(agent.company_name)),
      };
    }
  }

  const agent = chosen[0];
  if (agent) {
    const ids = chosen.map((row) => row.id as string);
    const { data: bookings } = await admin
      .from("bookings")
      .select(
        "agent_id, contact_name, status, check_in, check_out, folios(fiscal_documents(doc_no, doc_kind, status))",
      )
      .eq("property_id", propertyId)
      .in("agent_id", ids)
      .order("check_out", { ascending: false })
      .limit(30);
    const lines = (bookings ?? []).map((row) => billLine(row));
    const tally = new Map<string, number>();
    for (const row of bookings ?? []) {
      const id = row.agent_id as string;
      tally.set(id, (tally.get(id) ?? 0) + 1);
    }
    const bestId =
      [...tally.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ??
      (agent.id as string);
    return {
      ok: true,
      reply: lines.length
        ? `${agent.company_name}: ${lines.length} stay${lines.length === 1 ? "" : "s"} on the money page.`
        : `${agent.company_name} has no stays on this hotel.`,
      action: null,
      href: `/erp/agents/${bestId}?tab=money`,
      lines,
    };
  }

  const { data: guests } = await admin
    .from("bookings")
    .select(
      "id, contact_name, status, check_in, check_out, folios(id, fiscal_documents(doc_no, doc_kind, status))",
    )
    .eq("property_id", propertyId)
    .ilike("contact_name", needle)
    .order("check_out", { ascending: false })
    .limit(8);
  if (!guests?.length) {
    return {
      ok: true,
      reply: `No partner or guest named “${query}” on this hotel.`,
      action: null,
    };
  }
  const lines = guests.map((row) => billLine(row));
  const folioId = (
    guests[0]?.folios as { id?: string }[] | null | undefined
  )?.[0]?.id;
  return {
    ok: true,
    reply: lines.length === 1 ? lines[0]! : `${lines.length} stays match.`,
    action: null,
    href: folioId ? `/erp/folios/${folioId}` : "/erp/bills?tab=stay",
    lines: lines.length === 1 ? undefined : lines,
  };
}

function boardFor(stay: StaySnap, step: InnoraStayStep | null): string {
  if (step === "check_out") return "/erp/departures";
  if (step === "check_in") return "/erp/arrivals";
  if (stay.status === "checked_in") return "/erp/in-house";
  return "/erp/reservations";
}

function presentStay(
  stay: StaySnap,
  step: InnoraStayStep | null,
  cancel: boolean,
): InnoraChatResult {
  const who = stay.rooms ? `${stay.name} · room ${stay.rooms}` : stay.name;
  const when = [stay.checkIn, stay.checkOut].filter(Boolean).join(" → ");
  const head = [who, when, stay.status].filter(Boolean).join(" · ");
  const reply = cancel
    ? `${head}. The stay card is open. Cancel it there. Chat will not delete a stay.`
    : step === "check_in"
      ? `${head}. Check-in is open on the stay card.`
      : step === "stay_money"
        ? `${head}. The bill is open on the stay card. Save the change there.`
        : step === "check_out"
          ? `${head}. Check-out is open on the stay card.`
          : `${head}. The stay card is open.`;
  return {
    ok: true,
    reply,
    action: null,
    href: boardFor(stay, step),
    openStay: { bookingId: stay.id, step },
  };
}

async function stayJob(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  propertyId: string,
  kind: InnoraActionKind,
  query: string,
  present?: { step: InnoraStayStep | null; cancel: boolean },
): Promise<InnoraChatResult> {
  const stays = await loadStaySnaps(admin, propertyId);
  const hits = matchStay(stays, query);
  if (hits.length !== 1) {
    return {
      ok: true,
      reply:
        hits.length === 0
          ? `No in-house or arriving stay matches “${query}”.`
          : "More than one stay matches. Say the room.",
      action: null,
      lines: hits.map((stay) =>
        [stay.rooms && `Room ${stay.rooms}`, stay.name, stay.status]
          .filter(Boolean)
          .join(" · "),
      ),
    };
  }
  const stay = hits[0]!;
  if (present) return presentStay(stay, present.step, present.cancel);
  const step: InnoraStayStep = kind === "checkout" ? "check_out" : "stay_money";
  return {
    ok: true,
    reply: actionLabel(kind, stay),
    action: { kind, bookingId: stay.id, label: actionLabel(kind, stay) },
    href: boardFor(stay, step),
    openStay: { bookingId: stay.id, step },
  };
}

async function runFastDesk(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  propertyId: string,
  intent: InnoraIntent,
): Promise<InnoraChatResult> {
  if (intent.type === "open_page") {
    return {
      ok: true,
      reply: `Opening ${intent.label}.`,
      action: null,
      href: intent.href,
    };
  }
  if (intent.type === "find_bills") {
    return findBills(admin, propertyId, intent.query);
  }
  if (intent.type === "open_stay") {
    return stayJob(admin, propertyId, "show_folio", intent.query, {
      step: intent.step,
      cancel: intent.cancel,
    });
  }
  if (intent.type === "open_folio") {
    return stayJob(admin, propertyId, "show_folio", intent.query, {
      step: "stay_money",
      cancel: false,
    });
  }
  const kind: InnoraActionKind =
    intent.type === "checkout" ? "checkout" : "post_room_night";
  return stayJob(admin, propertyId, kind, intent.query);
}

function actionLabel(kind: InnoraActionKind, stay: StaySnap): string {
  const who = stay.rooms ? `${stay.name} · room ${stay.rooms}` : stay.name;
  if (kind === "checkout") return `Check out ${who}`;
  if (kind === "open_folio") return `Open a folio for ${who}`;
  if (kind === "post_room_night") return `Post the room night for ${who}`;
  return `Open the folio for ${who}`;
}

export async function askInnoraDesk(input: {
  messages: InnoraChatTurn[];
}): Promise<InnoraChatResult> {
  try {
    const { admin, propertyId } = await requireDeskProperty();
    const turns = input.messages
      .slice(-8)
      .map((turn) => ({
        role: turn.role,
        text: turn.text.slice(0, 1500),
      }))
      .filter((turn) => turn.text.trim());
    if (!turns.length || turns[turns.length - 1]?.role !== "user") {
      return { ok: false, error: "Type what you want done." };
    }

    const latest = turns[turns.length - 1]?.text ?? "";
    const followUp = /^(do that|do it|yes|yes do that|go ahead|ok|okay)$/.test(
      latest.toLowerCase().replace(/[^a-z\s]/g, "").replace(/\s+/g, " ").trim(),
    );
    const said = followUp
      ? ([...turns]
          .reverse()
          .find(
            (turn) =>
              turn.role === "user" &&
              turn.text.trim().toLowerCase() !== latest.trim().toLowerCase(),
          )?.text ?? latest)
      : latest;
    const intent = parseInnoraIntent(said);
    if (intent) return runFastDesk(admin, propertyId, intent);

    const byok = await loadGeminiByok(admin, propertyId);
    if (!byok.apiKey) {
      return {
        ok: true,
        reply:
          "Say the desk job in plain words: find bills of Soul Trips, check out room 305, or open arrivals.",
        action: null,
      };
    }

    const stays = await loadStaySnaps(admin, propertyId);
    const pages = INNORA_PAGES.map((page) => ({ href: page.href, label: page.label }));
    const roster = stays.slice(0, 40).map((stay) => ({
      id: stay.id,
      name: stay.name,
      room: stay.rooms,
      status: stay.status,
    }));
    const result = await generateGeminiJsonFast({
      apiKey: byok.apiKey,
      system: `${GEMINI_CONSENT_SYSTEM}
You walk the existing desk. You do not write code, SQL, or new screens.
Return ONLY JSON:
{"reply": string, "href": string|null, "bookingId": string|null, "step": "reserve"|"check_in"|"stay_money"|"check_out"|null}
href must be copied from pages. bookingId must be copied from stays.
Open the stay card for create, edit, save, or change on a guest. Do not delete, void, or post money.
If two guests match, leave bookingId null and ask for the room.`,
      user: JSON.stringify({ pages, stays: roster, messages: turns }),
    });
    if (!result.ok) {
      return {
        ok: true,
        reply:
          "I can open the desk page and do the job. Try: find bills of Soul Trips, check out room 305, or open the folio for the guest.",
        action: null,
      };
    }

    const data = result.data as {
      reply?: unknown;
      href?: unknown;
      bookingId?: unknown;
      step?: unknown;
    };
    const reply =
      typeof data.reply === "string" && data.reply.trim()
        ? data.reply.trim().slice(0, 400)
        : "Tell me the guest or the room.";
    const bookingId =
      typeof data.bookingId === "string" ? data.bookingId.trim() : "";
    const stay = stays.find((row) => row.id === bookingId);
    const step =
      typeof data.step === "string" &&
      (data.step === "reserve" ||
        data.step === "check_in" ||
        data.step === "stay_money" ||
        data.step === "check_out")
        ? data.step
        : null;
    const href =
      typeof data.href === "string" && isInnoraPage(data.href) ? data.href : undefined;
    if (!stay) return { ok: true, reply, action: null, href };

    return {
      ok: true,
      reply,
      action:
        step === "check_out"
          ? {
              kind: "checkout",
              bookingId: stay.id,
              label: actionLabel("checkout", stay),
            }
          : null,
      href: boardFor(stay, step),
      openStay: { bookingId: stay.id, step },
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Innora could not answer.",
    };
  }
}

export async function runInnoraDeskAction(input: {
  kind: InnoraActionKind;
  bookingId: string;
}): Promise<InnoraRunResult> {
  try {
    const { admin, propertyId } = await requireDeskProperty();
    if (!KINDS.has(input.kind)) {
      return { ok: false, message: "That action is not available." };
    }

    const { data: booking } = await admin
      .from("bookings")
      .select("id, property_id, contact_name, status")
      .eq("id", input.bookingId)
      .maybeSingle();
    if (!booking) return { ok: false, message: "That stay is not on this hotel." };
    assertDeskProperty(propertyId, booking.property_id as string, "Booking");
    const name = String(booking.contact_name ?? "Guest");

    if (input.kind === "show_folio" || input.kind === "open_folio") {
      const folioId = await ensureOpenFolio(
        admin,
        propertyId,
        booking.id as string,
        name,
      );
      await writeAuditEvent(admin, {
        propertyId,
        action: "ai.desk_action",
        entityType: "folios",
        entityId: folioId,
        summary:
          input.kind === "open_folio"
            ? `Innora opened a folio for ${name}`
            : `Innora opened the folio for ${name}`,
        meta: { kind: input.kind, bookingId: booking.id },
      });
      return {
        ok: true,
        message:
          input.kind === "open_folio"
            ? `Folio is open for ${name}.`
            : `Opening the folio for ${name}.`,
        href: `/erp/folios/${folioId}`,
      };
    }

    if (input.kind === "checkout") {
      const formData = new FormData();
      formData.set("booking_id", booking.id as string);
      const result = await confirmCheckOut({ ok: false }, formData);
      if (!result.ok) {
        return { ok: false, message: result.error ?? "Checkout did not finish." };
      }
      await writeAuditEvent(admin, {
        propertyId,
        action: "ai.desk_action",
        entityType: "bookings",
        entityId: booking.id as string,
        summary: `Innora checked out ${name}`,
        meta: { kind: "checkout" },
      });
      return { ok: true, message: `${name} is checked out.` };
    }

    const { data: folio } = await admin
      .from("folios")
      .select("id, status")
      .eq("booking_id", booking.id as string)
      .eq("status", "open")
      .order("created_at")
      .limit(1)
      .maybeSingle();
    if (!folio?.id) {
      return { ok: false, message: `Open a folio for ${name} first.` };
    }
    const formData = new FormData();
    formData.set("folio_id", folio.id as string);
    const posted = await postFolioRoomNight({ ok: false }, formData);
    if (!posted.ok) {
      return { ok: false, message: posted.error ?? "Room night did not post." };
    }
    await writeAuditEvent(admin, {
      propertyId,
      action: "ai.desk_action",
      entityType: "folios",
      entityId: folio.id as string,
      summary: `Innora posted a room night for ${name}`,
      meta: { kind: "post_room_night" },
    });
    return {
      ok: true,
      message: posted.message ?? `Room night posted for ${name}.`,
      href: `/erp/folios/${folio.id as string}`,
    };
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "That did not finish.",
    };
  }
}
