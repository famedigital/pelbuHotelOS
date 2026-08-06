"use client";

import { HeroBookingSearch } from "@/components/home/HeroBookingSearch";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type StaySearchContextValue = {
  open: boolean;
  setOpen: (open: boolean) => void;
  openStaySearch: (opts?: {
    fromPriceBtn?: number | null;
    taxInclusive?: boolean;
  }) => void;
  fromPriceBtn: number | null;
  taxInclusive: boolean;
};

const StaySearchContext = createContext<StaySearchContextValue | null>(null);

export function useStaySearch() {
  const ctx = useContext(StaySearchContext);
  if (!ctx) {
    throw new Error("useStaySearch must be used within PublicStaySearchProvider");
  }
  return ctx;
}

/** Safe for components that may render outside the provider (noop open). */
export function useStaySearchOptional() {
  return useContext(StaySearchContext);
}

/**
 * Global mobile stay search sheet — used by PublicMobileNav Book and
 * homepage hero dock. Submits GET /book with dates.
 */
export function PublicStaySearchProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [fromPriceBtn, setFromPriceBtn] = useState<number | null>(null);
  const [taxInclusive, setTaxInclusive] = useState(false);

  const openStaySearch = useCallback(
    (opts?: { fromPriceBtn?: number | null; taxInclusive?: boolean }) => {
      if (opts?.fromPriceBtn != null) setFromPriceBtn(opts.fromPriceBtn);
      if (opts?.taxInclusive != null) setTaxInclusive(opts.taxInclusive);
      setOpen(true);
    },
    [],
  );

  const value = useMemo(
    () => ({
      open,
      setOpen,
      openStaySearch,
      fromPriceBtn,
      taxInclusive,
    }),
    [open, openStaySearch, fromPriceBtn, taxInclusive],
  );

  return (
    <StaySearchContext.Provider value={value}>
      {children}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="bottom"
          className="z-[60] max-h-[min(90dvh,calc(100dvh_-_env(safe-area-inset-bottom,0px)))] rounded-t-2xl border-border px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2 md:hidden"
        >
          <SheetHeader className="pb-1 text-left">
            <SheetTitle className="font-display text-xl">
              When are you staying?
            </SheetTitle>
          </SheetHeader>
          <HeroBookingSearch
            variant="sheet"
            idPrefix="public-stay"
            fromPriceBtn={fromPriceBtn}
            taxInclusive={taxInclusive}
          />
        </SheetContent>
      </Sheet>
    </StaySearchContext.Provider>
  );
}
