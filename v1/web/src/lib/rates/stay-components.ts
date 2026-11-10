import { roundBtn } from "@/lib/pricing";

/**
 * Component-wise stay quote — room / breakfast / dinner / mattress / extra person.
 * Used by StayHub preview, Reserve, folio meal posts, and INV presentation.
 */

export type StayComponentPlan = "EP" | "BB" | "CP" | "MAP" | "AP" | string;

export type StayComponentQuoteInput = {
  roomNightlyBtn: number;
  /** Adult meal add-on per night (from meal_plans). */
  mealPerAdultNightBtn: number;
  mealPerChildNightBtn: number;
  mealPlanCode: StayComponentPlan;
  adults: number;
  children: number;
  nights: number;
  extraBeds: number;
  extraBedPerNightBtn: number;
  /** When true, meal is already bundled into room (agent CP tier). */
  mealBundledInRoom?: boolean;
};

export type StayComponentQuote = {
  roomNightlyBtn: number;
  roomStayBtn: number;
  breakfastStayBtn: number;
  dinnerStayBtn: number;
  lunchStayBtn: number;
  mattressStayBtn: number;
  extraPersonMealStayBtn: number;
  mealStayBtn: number;
  stayTotalBtn: number;
  mealPlanCode: string;
  nights: number;
  components: {
    id: string;
    label: string;
    amountBtn: number;
  }[];
};

/** Split a plan's adult meal night rate into BF / lunch / dinner shares. */
export function splitMealNightShares(
  plan: string,
  mealPerAdultNight: number,
): { breakfast: number; lunch: number; dinner: number } {
  const code = plan.trim().toUpperCase() || "EP";
  const m = Math.max(0, mealPerAdultNight);
  if (!(m > 0) || code === "EP") {
    return { breakfast: 0, lunch: 0, dinner: 0 };
  }
  if (code === "BB" || code === "CP") {
    return { breakfast: m, lunch: 0, dinner: 0 };
  }
  if (code === "MAP") {
    const half = roundBtn(m / 2);
    return { breakfast: half, lunch: 0, dinner: roundBtn(m - half) };
  }
  if (code === "AP") {
    const third = roundBtn(m / 3);
    return {
      breakfast: third,
      lunch: third,
      dinner: roundBtn(m - third * 2),
    };
  }
  return { breakfast: m, lunch: 0, dinner: 0 };
}

export function quoteStayComponents(
  input: StayComponentQuoteInput,
): StayComponentQuote {
  const nights = Math.max(1, Math.floor(input.nights) || 1);
  const adults = Math.max(1, Math.floor(input.adults) || 1);
  const children = Math.max(0, Math.floor(input.children) || 0);
  const roomNightly = Math.max(0, input.roomNightlyBtn);
  const roomStayBtn = roundBtn(roomNightly * nights);

  const bundled = Boolean(input.mealBundledInRoom);
  const adultMealNight = bundled ? 0 : Math.max(0, input.mealPerAdultNightBtn);
  const childMealNight = bundled ? 0 : Math.max(0, input.mealPerChildNightBtn);

  const shares = splitMealNightShares(input.mealPlanCode, adultMealNight);
  const breakfastStayBtn = roundBtn(shares.breakfast * adults * nights);
  const lunchStayBtn = roundBtn(shares.lunch * adults * nights);
  const dinnerStayBtn = roundBtn(shares.dinner * adults * nights);
  const extraPersonMealStayBtn = roundBtn(childMealNight * children * nights);
  const mealStayBtn = roundBtn(
    breakfastStayBtn + lunchStayBtn + dinnerStayBtn + extraPersonMealStayBtn,
  );

  const beds = Math.max(0, Math.floor(input.extraBeds) || 0);
  const mattressStayBtn = roundBtn(
    Math.max(0, input.extraBedPerNightBtn) * beds * nights,
  );

  const stayTotalBtn = roundBtn(roomStayBtn + mealStayBtn + mattressStayBtn);

  const components = [
    { id: "room", label: "Room", amountBtn: roomStayBtn },
    { id: "breakfast", label: "Breakfast", amountBtn: breakfastStayBtn },
    { id: "lunch", label: "Lunch", amountBtn: lunchStayBtn },
    { id: "dinner", label: "Dinner", amountBtn: dinnerStayBtn },
    {
      id: "extra_person_meal",
      label: "Extra person meal",
      amountBtn: extraPersonMealStayBtn,
    },
    { id: "mattress", label: "Extra mattress", amountBtn: mattressStayBtn },
  ].filter((c) => c.amountBtn > 0 || c.id === "room");

  return {
    roomNightlyBtn: roomNightly,
    roomStayBtn,
    breakfastStayBtn,
    dinnerStayBtn,
    lunchStayBtn,
    mattressStayBtn,
    extraPersonMealStayBtn,
    mealStayBtn,
    stayTotalBtn,
    mealPlanCode: (input.mealPlanCode || "EP").toUpperCase(),
    nights,
    components,
  };
}
