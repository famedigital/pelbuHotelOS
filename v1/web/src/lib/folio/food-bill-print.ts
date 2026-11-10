/** Labels for the A4 food bill. Pure so the print page only loads rows. */

const PAYMENT_LABELS: Record<string, string> = {
  room_charge: "Charged to room",
  cash: "Cash",
  bank: "Bank transfer",
  bank_qr: "Bank QR",
  pay_bt: "Pay.bt",
  card: "Card",
  deposit: "Deposit",
  agent_credit: "Agent on credit",
  nc: "No charge",
};

export function foodOutletLabel(code: string | null | undefined): string {
  const raw = (code ?? "").trim();
  if (!raw) return "Outlet";
  return raw
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function foodPlaceLabel(input: {
  outlet: string | null | undefined;
  tableName: string | null | undefined;
  tableArea: string | null | undefined;
}): string {
  const parts = [foodOutletLabel(input.outlet)];
  const table = input.tableName?.trim();
  if (table) parts.push(table);
  const area = input.tableArea?.trim();
  if (area && area.toLowerCase() !== "main") parts.push(area);
  return parts.join(" · ");
}

export function foodPaymentLabel(
  methods: string[],
  postedToRoom: boolean,
): string {
  const labels = [...new Set(methods.map((method) => method.trim().toLowerCase()))]
    .filter(Boolean)
    .map((method) => PAYMENT_LABELS[method] ?? method.replace(/_/g, " "));
  if (labels.length > 0) return labels.join(" · ");
  return postedToRoom ? "Charged to room" : "Not recorded";
}

export function foodAcknowledgedLabel(input: {
  confirmedAt: string | null | undefined;
  confirmedBy: string | null | undefined;
  confirmedWhen: string | null | undefined;
  kotStatus: string | null | undefined;
  postedToRoom: boolean;
}): string {
  if (input.confirmedAt) {
    const who = input.confirmedBy?.trim() || "Desk";
    const when = input.confirmedWhen?.trim();
    return when ? `Yes · ${who} · ${when}` : `Yes · ${who}`;
  }
  const kot = (input.kotStatus ?? "").toLowerCase();
  if (kot === "served") return "Yes · served";
  if (kot === "ready") return "Yes · ready";
  if (kot === "preparing") return "In the kitchen";
  if (kot === "cancelled") return "Cancelled";
  if (input.postedToRoom) return "Posted to the room · kitchen not acknowledged";
  return "Not acknowledged";
}
