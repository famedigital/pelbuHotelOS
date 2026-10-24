export type InnoraStayStep = "reserve" | "check_in" | "stay_money" | "check_out";

export type InnoraIntent =
  | { type: "find_bills"; query: string }
  | { type: "checkout"; query: string }
  | { type: "open_folio"; query: string }
  | { type: "post_room_night"; query: string }
  | { type: "open_stay"; query: string; step: InnoraStayStep | null; cancel: boolean }
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

/** Desk sentence → an existing page or job. No model, no new screens. */
export function parseInnoraIntent(raw: string): InnoraIntent | null {
  const text = clean(raw);
  if (!text) return null;

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

  const night = text.match(
    /\b(?:post|add|charge)\b.*\broom\s+night\b(?:\s+(?:for|of|on))?\s*(.*)$/,
  );
  if (night) {
    const query = (night[1] ?? "").trim();
    if (query) return { type: "post_room_night", query: trimLead(query) };
  }

  const folio = text.match(
    /\b(?:open|show|edit|change|save)\b.*\b(?:folio|bill)\b(?:\s+(?:of|for))?\s+(.+)$/,
  );
  if (folio?.[1]) return { type: "open_folio", query: trimLead(folio[1]) };

  const checkIn = text.match(/\bcheck\s*in\b(?:\s+(?:for|of))?\s+(.+)$/);
  if (checkIn?.[1]) {
    return { type: "open_stay", query: trimLead(checkIn[1]), step: "check_in", cancel: false };
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
