/**
 * Property daily BF / dinner board — FO or F&B posts; agents + StayHub read.
 * Communication only (not folio charges). MAP/AP package rates stay on master.
 */
import { create } from "zustand";

export type DailyMealBoard = {
  date: string;
  breakfast: string;
  lunch?: string;
  dinner: string;
  postedBy: string;
  postedAt: string;
  notes?: string;
};

type MealBoardState = {
  boards: Record<string, DailyMealBoard>;
  upsertBoard: (
    input: {
      date: string;
      breakfast: string;
      lunch?: string;
      dinner: string;
      notes?: string;
      postedBy?: string;
    },
  ) => { ok: true; board: DailyMealBoard } | { ok: false; error: string };
  copyForward: (
    fromDate: string,
    toDate: string,
    postedBy?: string,
  ) => { ok: true; board: DailyMealBoard } | { ok: false; error: string };
  boardForDate: (date: string) => DailyMealBoard | null;
  boardsForRange: (checkIn: string, checkOut: string) => DailyMealBoard[];
};

function ymdDays(checkIn: string, checkOut: string): string[] {
  const out: string[] = [];
  const start = new Date(`${checkIn}T12:00:00Z`);
  const end = new Date(`${checkOut}T12:00:00Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
    return out;
  }
  for (let t = start.getTime(); t < end.getTime(); t += 86_400_000) {
    out.push(new Date(t).toISOString().slice(0, 10));
  }
  return out;
}

function seedDemoBoards(): Record<string, DailyMealBoard> {
  const today = new Date().toISOString().slice(0, 10);
  const out: Record<string, DailyMealBoard> = {};
  for (let i = 0; i < 7; i += 1) {
    const d = new Date(`${today}T12:00:00`);
    d.setDate(d.getDate() + i);
    const date = d.toISOString().slice(0, 10);
    out[date] = {
      date,
      breakfast: "Suja · porridge · eggs · toast",
      lunch: "Thukpa · seasonal salad",
      dinner: "Ema datshi · red rice · seasonal veg",
      postedBy: "F&B · Demo",
      postedAt: new Date().toISOString(),
      notes: "MAP package board",
    };
  }
  return out;
}

export const useMealBoardStore = create<MealBoardState>((set, get) => ({
  boards: seedDemoBoards(),

  upsertBoard: (input) => {
    const date = input.date.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return { ok: false, error: "Invalid menu date" };
    }
    const breakfast = input.breakfast.trim();
    const dinner = input.dinner.trim();
    if (!breakfast || !dinner) {
      return { ok: false, error: "Breakfast and dinner are required" };
    }
    const board: DailyMealBoard = {
      date,
      breakfast: breakfast.slice(0, 400),
      dinner: dinner.slice(0, 400),
      lunch: input.lunch?.trim().slice(0, 400) || undefined,
      notes: input.notes?.trim().slice(0, 240) || undefined,
      postedBy: input.postedBy?.trim() || "Desk",
      postedAt: new Date().toISOString(),
    };
    set((s) => ({ boards: { ...s.boards, [date]: board } }));
    return { ok: true, board };
  },

  copyForward: (fromDate, toDate, postedBy = "Desk") => {
    const src = get().boards[fromDate];
    if (!src) return { ok: false, error: `No menu posted for ${fromDate}` };
    return get().upsertBoard({
      date: toDate,
      breakfast: src.breakfast,
      lunch: src.lunch,
      dinner: src.dinner,
      notes: src.notes,
      postedBy,
    });
  },

  boardForDate: (date) => get().boards[date] ?? null,

  boardsForRange: (checkIn, checkOut) => {
    const { boards } = get();
    return ymdDays(checkIn, checkOut)
      .map((d) => boards[d])
      .filter((b): b is DailyMealBoard => Boolean(b));
  },
}));
