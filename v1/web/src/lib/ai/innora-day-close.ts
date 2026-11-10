/** Plan the confirmed desk close. No database, no invoices. */

const SIGNED = new Set(["photo", "signed", "waived"]);

export type DayCloseStay = {
  id: string;
  name: string;
  code: string;
  status: string;
  checkIn: string;
  checkOut: string;
  agentId: string | null;
  guideSign: string | null;
  hasFolio: boolean;
};

export type DayCloseChange = {
  id: string;
  name: string;
  code: string;
  checkIn: string;
  checkOut: string;
  action: "checkout" | "arrival" | "in_house" | "folio";
  waiveGuide: boolean;
  wasInHouse: boolean;
  needsFolio: boolean;
};

export function planDayClose(stays: DayCloseStay[], today: string): DayCloseChange[] {
  const day = today.slice(0, 10);
  const changes: DayCloseChange[] = [];
  for (const stay of stays) {
    const status = stay.status;
    if (status === "cancelled" || status === "no_show") continue;
    const checkIn = stay.checkIn.slice(0, 10);
    const checkOut = stay.checkOut.slice(0, 10);
    if (!checkIn || !checkOut || !day) continue;

    const base = {
      id: stay.id,
      name: stay.name,
      code: stay.code,
      checkIn,
      checkOut,
      waiveGuide: false,
      wasInHouse: false,
      needsFolio: false,
    };

    if (checkOut <= day && (status === "checked_in" || status === "confirmed" || status === "pending" || status === "held")) {
      changes.push({
        ...base,
        action: "checkout",
        waiveGuide: Boolean(stay.agentId) && !SIGNED.has((stay.guideSign ?? "").toLowerCase()),
        wasInHouse: status === "checked_in",
        needsFolio: !stay.hasFolio,
      });
      continue;
    }

    if (checkOut <= day && status === "checked_out" && !stay.hasFolio) {
      changes.push({ ...base, action: "folio", needsFolio: true });
      continue;
    }

    if (checkIn === day && checkOut > day && (status === "checked_in" || status === "held")) {
      changes.push({ ...base, action: "arrival" });
      continue;
    }

    if (checkIn < day && checkOut > day && (status === "confirmed" || status === "pending" || status === "held")) {
      changes.push({ ...base, action: "in_house" });
    }
  }
  return changes;
}

export function dayClosePreview(changes: DayCloseChange[], today: string): {
  reply: string;
  lines: string[];
} {
  const checkout = changes.filter((row) => row.action === "checkout");
  const arrivals = changes.filter((row) => row.action === "arrival");
  const house = changes.filter((row) => row.action === "in_house");
  const missingFolio = changes.filter((row) => row.needsFolio).length;
  if (!changes.length) {
    return {
      reply: `Through ${today} the desk already matches. Nothing to check out, and no folio is missing. No invoice was created.`,
      lines: [],
    };
  }
  const lines = [
    ...checkout.slice(0, 8).map((row) => `Check out · ${row.name} · ${row.code}`),
    ...arrivals.slice(0, 6).map((row) => `Arrival · ${row.name} · ${row.code}`),
    ...house.slice(0, 6).map((row) => `In house · ${row.name} · ${row.code}`),
  ];
  const reply = [
    `Through ${today} I will check out ${checkout.length}, move ${arrivals.length} onto arrivals, and move ${house.length} into in house.`,
    missingFolio
      ? `${missingFolio} departed stay${missingFolio === 1 ? "" : "s"} still need a folio and master bill number.`
      : "Each checkout keeps its folio. A missing folio gets a number. The master bill uses that same number with BN.",
    "Guide number is not required. I will not create any invoice.",
    "Press Confirm to do this.",
  ].join(" ");
  return { reply, lines };
}
