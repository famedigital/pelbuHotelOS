import { createContext, useContext, type Dispatch, type SetStateAction } from "react";
import type { HermesOverview } from "../../lib/hermes-remote";

type Ctx = {
  overview: HermesOverview | null;
  setOverview: Dispatch<SetStateAction<HermesOverview | null>>;
  refresh: () => Promise<void>;
};

export const TelegramOverviewContext = createContext<Ctx | null>(null);

export function useTelegramOverview() {
  const ctx = useContext(TelegramOverviewContext);
  if (!ctx) {
    throw new Error("useTelegramOverview must be used under TelegramLayout");
  }
  return ctx;
}
