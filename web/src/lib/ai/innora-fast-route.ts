export type InnoraStayStep = "reserve" | "check_in" | "stay_money" | "check_out";

export type InnoraIntent =
  | { type: "close_through_today" }
  | { type: "find_bills"; query: string }
  | { type: "open_master"; query: string }
  | { type: "checkout"; query: string }
  | { type: "open_folio"; query: string }
  | { type: "post_room_night"; query: string }
  | {
      type: "post_bill_addon";
      addon: "mattress" | "laundry" | "service";
      qty: number;
      item: string;
      speed: "same_day" | "overnight" | "express";
      query: string;
    }
  | { type: "open_stay"; query: string; step: InnoraStayStep | null; cancel: boolean }
  | { type: "check_in_guest"; query: string }
  | { type: "cancel_stay"; query: string }
  | { type: "move_room"; query: string; room: string }
  | { type: "take_payment"; query: string; amount: number; method: "cash" | "bank" | "card" | "bank_qr" }
  | { type: "issue_invoice"; query: string }
  | { type: "night_audit" }
  | { type: "reserve_stay"; name: string; checkIn: string; checkOut: string; room: string }
  | { type: "open_page"; href: string; label: string };

/** Existing desk screens. Chat may open these. It may not invent a new one. */
export const INNORA_PAGES: Array<{ test: RegExp; href: string; label: string }> = [
  { test: /\barrivals?\b/, href: "/erp/arrivals", label: "Arrivals" },
  { test: /\bdepartures?\b/, href: "/erp/departures", label: "Departures" },
  { test: /\bin\s*house\b/, href: "/erp/in-house", label: "In house" },
  { test: /\b(stay\s*view|dashboard)\b/, href: "/erp/stayview", label: "Stay view" },
  { test: /\b(room\s*rack|calendar)\b/, href: "/erp/calendar", label: "Room rack" },
  { test: /\btoday\b/, href: "/erp/today", label: "Today" },
  { test: /\bbills?\b/, href: "/erp/bills", label: "Bills" },
  { test: /\bpayments?\b/, href: "/erp/bills?tab=payments", label: "Payments" },
  { test: /\brates?\b/, href: "/erp/rates", label: "Rates" },
  { test: /\bsettings?\b/, href: "/erp/settings", label: "Settings" },
  { test: /\breservations?\b/, href: "/erp/reservations", label: "Reservations" },
  { test: /\bguests?\b/, href: "/erp/guests", label: "Guests" },
  { test: /\b(house\s*keeping|hk)\b/, href: "/erp/housekeeping", label: "Housekeeping" },
  { test: /\bkitchen\b/, href: "/erp/kitchen", label: "Kitchen" },
  { test: /\b(pos|restaurant)\b/, href: "/erp/pos", label: "POS" },
  { test: /\bnight\s*audit\b/, href: "/erp/night-audit", label: "Night audit" },
  { test: /\bagents?\b/, href: "/erp/agents", label: "Agents" },
  { test: /\b(fast\s*book|new\s*booking)\b/, href: "/erp/reserve", label: "Reserve" },
];

const PAGE_HREFS = new Set(INNORA_PAGES.map((page) => page.href));

export function isInnoraPage(href: string): boolean {
  return PAGE_HREFS.has(href);
}

function trimLead(query: string): string {
  return query.replace(/^(?:of|for|the|a|an)\s+/, "").trim();
}

function clean(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Bulk desk close: checkout through today, then arrivals and in-house. */
export function isDayCloseRequest(text: string): boolean {
  const hasClose =
    /\bcheck\s*outs?\b/.test(text) &&
    /\b(all|everyone|every|till|until|through)\b/.test(text);
  const tillDate = /\btill date\b/.test(text) || /\bthrough today\b/.test(text);
  const lists = /\bin\s*house\b/.test(text) && /\barrivals?\b/.test(text);
  return hasClose || tillDate || lists;
}

/** Desk sentence → an existing page or job. No model, no new screens. */
export function parseInnoraIntent(raw: string): InnoraIntent | null {
  const text = clean(raw);
  if (!text) return null;

  if (isDayCloseRequest(text)) return { type: "close_through_today" };

  if (/\bmaster\b/.test(text) && /\b(?:bill|folio)s?\b/.test(text)) {
    const query = trimLead(
      text
        .replace(/^(?:please\s+)?(?:can\s+you\s+|can\s+u\s+)?/, "")
        .replace(
          /\b(?:open|show|find|get|list|see|the|a|an|me|master|folio|bill|of|for)\b/g,
          " ",
        )
        .replace(/\s+/g, " ")
        .trim(),
    );
    if (query) return { type: "open_master", query };
  }

  if (/\b(?:issue|make|create)\b/.test(text) && /\binvoices?\b/.test(text)) {
    return { type: "issue_invoice", query: stayQuery(text, "issue") || likeNeedle(text) };
  }

  const billsOf = text.match(/(?:bill|invoice|due)s?\s+(?:of|for)\s+(.+)$/);
  if (billsOf?.[1]) return { type: "find_bills", query: trimLead(billsOf[1]) };

  const namedBill = text.match(
    /\b(?:find|show|get|list|see)\b.*\b(?:bill|invoice|due)s?\b/,
  );
  if (namedBill) {
    const query = trimLead(
      text
        .replace(/^(?:please\s+)?(?:can\s+you\s+|can\s+u\s+)?/, "")
        .replace(/^(?:find|show|get|list|see)\s+(?:me\s+)?(?:all\s+)?(?:the\s+)?/, "")
        .replace(/\b(?:bill|invoice|due)s?\b/g, " ")
        .replace(/\s+/g, " ")
        .trim(),
    );
    if (query && !/^(?:room\s+)?\d{2,4}$/.test(query)) {
      return { type: "find_bills", query };
    }
  }

  const foliosOf = text.match(/\bfolios?\s+(?:of|for)\s+(.+)$/);
  if (
    foliosOf?.[1] &&
    /\b(?:find|show|list|get|all)\b/.test(text) &&
    !/^room\b/.test(foliosOf[1])
  ) {
    return { type: "find_bills", query: trimLead(foliosOf[1]) };
  }

  const checkout = text.match(/\bcheck\s*out\b\s+(.+)$/);
  if (checkout?.[1]) return { type: "checkout", query: trimLead(checkout[1]) };

  if (/\b(?:run|start|do|close)\b/.test(text) && /\bnight\s*audit\b/.test(text)) {
    return { type: "night_audit" };
  }

  const reserved = parseReserveStay(text);
  if (reserved) return reserved;

  const payment = parsePayment(text);
  if (payment) return payment;

  const move = text.match(/\b(?:move|shift)\b.*\broom\s+([a-z0-9]+)\b/);
  if (move?.[1]) {
    const query = trimLead(
      text
        .replace(/\b(?:move|shift|to|into|room)\b/g, " ")
        .replace(new RegExp(`\\b${move[1]}\\b`, "g"), " ")
        .replace(/\s+/g, " ")
        .trim(),
    );
    if (query) return { type: "move_room", query, room: move[1] };
  }

  const night = text.match(
    /\b(?:post|add|charge)\b.*\broom\s+night\b(?:\s+(?:for|of|on))?\s*(.*)$/,
  );
  if (night) {
    const query = (night[1] ?? "").trim();
    if (query) return { type: "post_room_night", query: trimLead(query) };
  }

  const addon = parseBillAddon(text);
  if (addon) return addon;

  const folio = text.match(
    /\b(?:open|show|edit|change|save)\b.*\b(?:folio|bill)\b(?:\s+(?:of|for))?\s+(.+)$/,
  );
  if (folio?.[1]) return { type: "open_folio", query: trimLead(folio[1]) };

  const checkIn = text.match(/\bcheck\s*in\b(?:\s+(?:for|of))?\s+(.+)$/);
  if (checkIn?.[1]) {
    return { type: "check_in_guest", query: trimLead(checkIn[1]) };
  }

  if (
    /\b(?:create|add|make)\b/.test(text) &&
    /\b(?:booking|reservation|stay|reserve)\b/.test(text)
  ) {
    return { type: "open_page", href: "/erp/reserve", label: "Reserve" };
  }

  const verb = text.match(/\b(edit|change|update|save|delete|cancel|remove)\b/);
  if (verb) {
    const page = pageOnly(text.replace(verb[0], " "));
    const cancel = verb[1] === "delete" || verb[1] === "cancel" || verb[1] === "remove";
    if (page && !cancel) return { type: "open_page", href: page.href, label: page.label };
    const query = stayQuery(text, verb[0]);
    if (cancel && query) return { type: "cancel_stay", query };
    if (!query) {
      if (page) return { type: "open_page", href: page.href, label: page.label };
    } else {
      const money = /\b(?:rate|rates|folio|bill|payment|charge)\b/.test(text);
      const step: InnoraStayStep | null = money
        ? "stay_money"
        : /\bdepart/.test(text)
          ? "check_out"
          : "reserve";
      return { type: "open_stay", query, step, cancel };
    }
  }

  const page = pageOnly(text);
  if (page) return { type: "open_page", href: page.href, label: page.label };

  return null;
}

function chargeSpeed(text: string): "same_day" | "overnight" | "express" {
  if (/\bexpress\b/.test(text)) return "express";
  if (/\bovernight\b/.test(text)) return "overnight";
  return "same_day";
}

function clampQty(raw: string | undefined): number {
  const qty = Math.floor(Number(raw) || 1);
  if (qty < 1) return 1;
  if (qty > 20) return 20;
  return qty;
}

function splitItemStay(tail: string): { item: string; query: string } | null {
  const marked = tail.match(/^(.*?)\s+(?:for|to|on)\s+(.+)$/);
  if (marked?.[2] && marked[1]?.trim()) {
    return { item: trimLead(marked[1].trim()), query: trimLead(marked[2].trim()) };
  }
  const room = tail.match(/^(.*?)\s+room\s+(\d{2,4})$/);
  if (room?.[2] && room[1]?.trim()) {
    return { item: trimLead(room[1].trim()), query: `room ${room[2]}` };
  }
  return null;
}

/** Extra mattress, laundry, or minibar/amenity onto an in-house bill. */
function parseBillAddon(text: string): InnoraIntent | null {
  if (/\bservice\s+charge\b/.test(text)) return null;
  const speed = chargeSpeed(text);
  const said = text.replace(/\b(?:express|overnight|same\s*day)\b/g, " ").replace(/\s+/g, " ").trim();

  const mattress = said.match(
    /^(?:please\s+)?(?:add|post|charge|put)\s+(?:an?\s+)?(?:(\d{1,2})\s+)?(?:extra\s+)?(?:mattress(?:es)?|beds?)\b(?:\s+(?:for|to|on|in))?\s*(.*)$/,
  );
  if (mattress) {
    return {
      type: "post_bill_addon",
      addon: "mattress",
      qty: clampQty(mattress[1]),
      item: "",
      speed,
      query: trimLead(mattress[2] ?? ""),
    };
  }

  const laundry = said.match(
    /^(?:please\s+)?(?:add|post|charge|put)\s+(?:(\d{1,2})\s+)?laundry\s+(?:(\d{1,2})\s+)?(.+)$/,
  );
  if (laundry) {
    const split = splitItemStay(laundry[3] ?? "");
    return {
      type: "post_bill_addon",
      addon: "laundry",
      qty: clampQty(laundry[2] ?? laundry[1]),
      item: split?.item ?? "",
      speed,
      query: split?.query ?? "",
    };
  }

  const service = said.match(
    /^(?:please\s+)?(?:add|post|charge|put)\s+(?:(\d{1,2})\s+)?(?:minibar|amenity|service)\s+(?:(\d{1,2})\s+)?(.+)$/,
  );
  if (service) {
    const split = splitItemStay(service[3] ?? "");
    return {
      type: "post_bill_addon",
      addon: "service",
      qty: clampQty(service[2] ?? service[1]),
      item: split?.item ?? "",
      speed,
      query: split?.query ?? "",
    };
  }

  return null;
}

function pageOnly(text: string): { href: string; label: string } | null {
  const rest = text
    .replace(/^(?:please\s+)?(?:can\s+you\s+|can\s+u\s+)?/, "")
    .replace(/\b(?:open|go to|show|take me to|me|the|a|an|page|please|to)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  for (const page of INNORA_PAGES) {
    if (!page.test.test(text)) continue;
    const after = rest.replace(page.test, " ").replace(/\s+/g, " ").trim();
    if (!after) return { href: page.href, label: page.label };
  }
  return null;
}

function stayQuery(text: string, verb: string): string {
  return trimLead(
    text
      .replace(verb, " ")
      .replace(
        /\b(?:the|a|an|this|that|please|for|of|me|rate|rates|folio|bill|booking|reservation|stay|guest|room|date|dates|payment|charge)\b/g,
        " ",
      )
      .replace(/\s+/g, " ")
      .trim(),
  );
}

const MONTHS: Record<string, number> = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3,
  apr: 4, april: 4, may: 5, jun: 6, june: 6, jul: 7, july: 7,
  aug: 8, august: 8, sep: 9, sept: 9, september: 9,
  oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12,
};

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function parseLooseDay(token: string): string | null {
  if (/^\d{4}-\d{2}-\d{2}$/.test(token)) return token;
  const year = new Date().getFullYear();
  let match = /^(\d{1,2})\s+([a-z]+)$/.exec(token);
  if (match && MONTHS[match[2]]) {
    return `${year}-${pad2(MONTHS[match[2]])}-${pad2(Number(match[1]))}`;
  }
  match = /^([a-z]+)\s+(\d{1,2})$/.exec(token);
  if (match && MONTHS[match[1]]) {
    return `${year}-${pad2(MONTHS[match[1]])}-${pad2(Number(match[2]))}`;
  }
  return null;
}

function parseReserveStay(text: string): InnoraIntent | null {
  if (!/\b(?:book|reserve|booking|reservation)\b/.test(text)) return null;
  const room = /\broom\s+([a-z0-9]+)\b/.exec(text);
  if (!room?.[1]) return null;
  const iso = [...text.matchAll(/\b(20\d{2})[\s-](\d{1,2})[\s-](\d{1,2})\b/g)].map(
    (match) => `${match[1]}-${pad2(Number(match[2]))}-${pad2(Number(match[3]))}`,
  );
  let checkIn = "";
  let checkOut = "";
  if (iso.length >= 2) {
    checkIn = iso[0]!;
    checkOut = iso[1]!;
  } else {
    const days = [...text.matchAll(/\b(\d{1,2}\s+[a-z]+|[a-z]+\s+\d{1,2})\b/g)].map((m) => m[0]);
    const parsed = days.map(parseLooseDay).filter((day): day is string => Boolean(day));
    if (parsed.length < 2) return null;
    checkIn = parsed[0]!;
    checkOut = parsed[1]!;
  }
  if (!(checkOut > checkIn)) return null;
  const name = trimLead(
    text
      .replace(/\b(?:please|book|reserve|create|add|make|a|an|the|booking|reservation|stay|for|from|to|room|in|on|can|you|u)\b/g, " ")
      .replace(/\b20\d{2}\s+\d{1,2}\s+\d{1,2}\b/g, " ")
      .replace(/\d{4}-\d{2}-\d{2}/g, " ")
      .replace(/\b\d{1,2}\s+[a-z]+\b/g, " ")
      .replace(/\b[a-z]+\s+\d{1,2}\b/g, " ")
      .replace(new RegExp(`\\b${room[1]}\\b`, "g"), " ")
      .replace(/\s+/g, " ")
      .trim(),
  );
  if (name.length < 2) return null;
  return { type: "reserve_stay", name, checkIn, checkOut, room: room[1] };
}

function parsePayment(text: string): InnoraIntent | null {
  if (!/\b(?:collect|receive)\b/.test(text) && !/\btake payment\b/.test(text)) return null;
  const amountRaw = text.match(/\b(\d{2,7})(?:\.\d{1,2})?\b/);
  const methodRaw = text.match(/\b(cash|bank|card|qr)\b/);
  if (!amountRaw?.[1] || !methodRaw?.[1]) return null;
  const amount = Number(amountRaw[1]);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  const method = methodRaw[1] === "qr" ? "bank_qr" : (methodRaw[1] as "cash" | "bank" | "card");
  const query = trimLead(
    text
      .replace(/\b(?:collect|receive|take|payment|cash|bank|card|qr|nu|btn|from|for)\b/g, " ")
      .replace(/\b\d+(?:\.\d+)?\b/g, " ")
      .replace(/\s+/g, " ")
      .trim(),
  );
  if (!query) return null;
  return { type: "take_payment", query, amount, method };
}

export function likeNeedle(query: string): string {
  const parts = query
    .toLowerCase()
    .split(/\s+/)
    .map((part) => part.replace(/[%_]/g, ""))
    .filter(Boolean);
  return `%${parts.join("%")}%`;
}

export function matchStay<T extends { name: string; rooms: string }>(
  stays: T[],
  query: string,
): T[] {
  const q = query.toLowerCase().replace(/^room\s+/, "").trim();
  if (!q) return [];
  const byRoom = stays.filter((stay) =>
    stay.rooms
      .split(",")
      .some((room) => room.trim().toLowerCase() === q),
  );
  if (byRoom.length) return byRoom;
  return stays.filter((stay) => {
    const name = stay.name.toLowerCase();
    return name.includes(q) || (name.length > 2 && q.includes(name));
  });
}
