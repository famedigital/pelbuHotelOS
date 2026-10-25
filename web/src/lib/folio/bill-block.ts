import { classifyBillLine } from "@/lib/folio/bill-kinds";

export type BillBlockCode = "RATE" | "DOOR" | "FOLIO" | "FOOD";

export type BillBlock = {
  code: BillBlockCode;
  message: string;
  next: string;
};

const BLOCKS: Record<BillBlockCode, BillBlock> = {
  RATE: {
    code: "RATE",
    message: "No room rate on this stay.",
    next: "Enter the nightly rate, then print.",
  },
  DOOR: {
    code: "DOOR",
    message: "Sheet room and desk room differ.",
    next: "Confirm the door, then print.",
  },
  FOLIO: {
    code: "FOLIO",
    message: "No open folio.",
    next: "Open the stay folio, then print.",
  },
  FOOD: {
    code: "FOOD",
    message: "Food is on the order but not on the bill.",
    next: "Post it, then print the food bill.",
  },
};

export function billBlock(code: BillBlockCode): BillBlock {
  return BLOCKS[code];
}

export function billBlockText(code: BillBlockCode): string {
  const block = BLOCKS[code];
  return `${block.code} — ${block.message} ${block.next}`;
}

export function billStreams(
  lines: Array<{
    source_type: string;
    description?: string | null;
    total_btn: number;
    status?: string | null;
    reverses_line_id?: string | null;
  }>,
): { room: number; food: number; services: number; master: number } {
  let room = 0;
  let food = 0;
  let services = 0;
  for (const line of lines) {
    if ((line.status ?? "posted") !== "posted") continue;
    if (line.reverses_line_id) continue;
    const group = classifyBillLine(line);
    const total = Number(line.total_btn) || 0;
    if (group === "room") room += total;
    if (group === "fnb") food += total;
    if (group === "services") services += total;
  }
  const round = (n: number) => Math.round(n * 100) / 100;
  room = round(room);
  food = round(food);
  services = round(services);
  return { room, food, services, master: round(room + food + services) };
}

export function departureBillBlocks(input: {
  folioId: string | null;
  status: string;
  hasDoor: boolean;
  roomTotal: number;
  foodTotal: number;
  openFoodOrders: number;
}): BillBlock[] {
  const blocks: BillBlock[] = [];
  if (!input.folioId) blocks.push(BLOCKS.FOLIO);
  const inHouse =
    input.status === "checked_in" || input.status === "checked_out";
  if (inHouse && input.roomTotal < 0.5) blocks.push(BLOCKS.RATE);
  if (inHouse && !input.hasDoor) blocks.push(BLOCKS.DOOR);
  if (input.openFoodOrders > 0 && input.foodTotal < 0.5) blocks.push(BLOCKS.FOOD);
  return blocks;
}

/** Plain desk copy. Raw database text and "Failed." stay off the toast. */
export function deskErrorText(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error ?? "");
  if (/folio is not open/i.test(raw)) return billBlockText("FOLIO");
  if (raw === "Failed." || raw === "Could not open the bill.") {
    return "That did not save. Try again.";
  }
  return raw;
}
