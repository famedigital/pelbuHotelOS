"use client";

import { AgentRateAssist } from "@/components/erp/AgentRateAssist";
import { RatePackagesWorkspace } from "@/components/erp/RatePackagesWorkspace";
import { RoomRatesSheet } from "@/components/erp/RoomRatesSheet";
import {
  SeasonsDateEditor,
  type SeasonEditorRow,
} from "@/components/erp/SeasonsDateEditor";
import type { MealPlanSummaryRow } from "@/components/erp/MealPlansRatesSummary";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { PlusIcon } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import type { RateMatrixRow, RoomTypeLite, SeasonWindow } from "@/components/erp/RoomRatesSheet";

import { marketLabel, RATE_MARKETS } from "./markets";
import { NamedRatesTable, type NamedOfferRow } from "./NamedRatesTable";
import { NewRateWizard } from "./NewRateWizard";
import { RateLedgerTable } from "./RateLedgerTable";

type SectionId = "book" | "packages" | "offers" | "seasons" | "meals" | "guide";

const SECTIONS: Array<{ id: SectionId; label: string; hint: string }> = [
  { id: "book", label: "Rate book", hint: "Edit and browse" },
  { id: "packages", label: "Packages", hint: "Public card" },
  { id: "offers", label: "Named rates", hint: "Contract and fill-up" },
  { id: "seasons", label: "Seasons", hint: "Date windows" },
  { id: "meals", label: "Meals", hint: "Per adult night" },
  { id: "guide", label: "How quotes work", hint: "Desk rules" },
];

export function RatesDesk({
  propertyId,
  rows,
  roomTypes,
  seasons,
  seasonRows,
  mealPlans,
  defaultMealPlanCode,
  ratesInclusiveOfGstSc,
  gstCharged,
  serviceChargeRate,
  gstRate,
  taxBasis,
  namedOffers,
  agents,
}: {
  propertyId: string;
  rows: RateMatrixRow[];
  roomTypes: RoomTypeLite[];
  seasons: SeasonWindow[];
  seasonRows: SeasonEditorRow[];
  mealPlans: MealPlanSummaryRow[];
  defaultMealPlanCode: string;
  ratesInclusiveOfGstSc: boolean;
  gstCharged: boolean;
  serviceChargeRate: number;
  gstRate: number;
  taxBasis: string;
  namedOffers: NamedOfferRow[];
  agents: Array<{ id: string; company_name: string }>;
}) {
  const [section, setSection] = useState<SectionId>("book");
  const [market, setMarket] = useState("public");
  const [sheetMarket, setSheetMarket] = useState("public");
  const [bookView, setBookView] = useState("sheet");
  const [wizardOpen, setWizardOpen] = useState(false);

  const guestRooms = roomTypes.filter(
    (room) => room.inventory_kind === "sellable_guest",
  );
  const ledgerRows = useMemo(
    () =>
      market === "all" ? rows : rows.filter((row) => row.rate_tier === market),
    [market, rows],
  );
  const active = SECTIONS.find((item) => item.id === section) ?? SECTIONS[0];

  function chooseMarket(code: string) {
    setMarket(code);
    if (code === "all") {
      setBookView("ledger");
      return;
    }
    setSheetMarket(code);
  }

  return (
    <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-start">
      <div className="lg:hidden">
        <Tabs value={section} onValueChange={(value) => setSection(value as SectionId)}>
          <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1">
            {SECTIONS.map((item) => (
              <TabsTrigger key={item.id} value={item.id}>
                {item.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      <aside className="hidden w-52 shrink-0 lg:block">
        <nav
          aria-label="Rate sections"
          className="sticky top-3 space-y-0.5 rounded-lg border bg-card p-1.5"
        >
          {SECTIONS.map((item) => {
            const count =
              item.id === "offers"
                ? namedOffers.length
                : item.id === "seasons"
                  ? seasonRows.length
                  : null;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setSection(item.id)}
                className={cn(
                  "flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-2 text-left",
                  section === item.id
                    ? "bg-accent/10 text-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
                aria-current={section === item.id ? "page" : undefined}
              >
                <span>
                  <span className="block text-sm font-medium">{item.label}</span>
                  <span className="block text-[11px]">{item.hint}</span>
                </span>
                {count != null ? (
                  <span className="tabular-nums text-xs">{count}</span>
                ) : null}
              </button>
            );
          })}
        </nav>
        <ul className="mt-3 space-y-1 px-1 text-xs text-muted-foreground">
          <li>
            <Link href="/erp/rate-plans" className="hover:text-foreground hover:underline">
              Channel rate plans
            </Link>
          </li>
          <li>
            <Link href="/erp/agents" className="hover:text-foreground hover:underline">
              Agent partners
            </Link>
          </li>
          <li>
            <a
              href="/rates"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground hover:underline"
            >
              Public rate card
            </a>
          </li>
          <li>
            <Link
              href="/erp/settings?tab=commercial"
              className="hover:text-foreground hover:underline"
            >
              Tax basis in settings
            </Link>
          </li>
        </ul>
      </aside>

      <div className="min-w-0 flex-1 space-y-4">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">{active.label}</h2>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              {section === "book"
                ? `Standard Nu by room and season. ${taxBasis}.`
                : section === "packages"
                  ? "Website and desk package card from the public double rate plus meals."
                  : section === "offers"
                    ? "A second price for one agent or guest. Contract is usual. Fill-up is the lower price for an empty room."
                    : section === "seasons"
                      ? "Peak, lean, and off windows choose which column the quote uses."
                      : section === "meals"
                        ? "Meal Nu is per adult per night. Packages multiply the adult meal by two."
                        : "StayHub, Reserve, the folio, and the invoice share this quote."}
            </p>
          </div>
          <Button type="button" onClick={() => setWizardOpen(true)}>
            <PlusIcon />
            New rate
          </Button>
        </header>

        <div
          className={
            section === "book"
              ? "flex min-w-0 flex-col gap-4 xl:flex-row"
              : "hidden"
          }
        >
            <nav
              aria-label="Markets"
              className="flex gap-1 overflow-x-auto xl:w-44 xl:shrink-0 xl:flex-col"
            >
              {RATE_MARKETS.map((item) => (
                <button
                  key={item.code}
                  type="button"
                  onClick={() => chooseMarket(item.code)}
                  className={cn(
                    "shrink-0 rounded-md border px-3 py-2 text-left text-sm",
                    market === item.code
                      ? "border-accent bg-accent/10 font-medium text-foreground"
                      : "border-transparent text-muted-foreground hover:bg-muted",
                  )}
                >
                  {item.label}
                </button>
              ))}
              <button
                type="button"
                onClick={() => chooseMarket("all")}
                className={cn(
                  "shrink-0 rounded-md border px-3 py-2 text-left text-sm",
                  market === "all"
                    ? "border-accent bg-accent/10 font-medium text-foreground"
                    : "border-transparent text-muted-foreground hover:bg-muted",
                )}
              >
                All markets
              </button>
            </nav>

            <div className="min-w-0 flex-1 space-y-4">
              <Tabs value={bookView} onValueChange={setBookView}>
                <TabsList>
                  <TabsTrigger value="sheet" disabled={market === "all"}>
                    Edit sheet
                  </TabsTrigger>
                  <TabsTrigger value="ledger">Ledger</TabsTrigger>
                </TabsList>
              </Tabs>
              <div className={bookView === "sheet" && market !== "all" ? "mt-3" : "hidden"}>
                <RoomRatesSheet
                  rows={rows}
                  roomTypes={roomTypes}
                  seasons={seasons}
                  ratesInclusiveOfGstSc={ratesInclusiveOfGstSc}
                  gstCharged={gstCharged}
                  serviceChargeRate={serviceChargeRate}
                  gstRate={gstRate}
                  tier={sheetMarket}
                  hideTierSwitcher
                />
              </div>
              <div className={bookView === "ledger" || market === "all" ? "mt-3" : "hidden"}>
                <p className="mb-3 text-sm text-muted-foreground">
                  {market === "all"
                    ? "Every standard cell in the book."
                    : `${marketLabel(market)} only. Amounts are changed on Edit sheet, and Save is there too.`}
                </p>
                <RateLedgerTable rows={ledgerRows} />
              </div>

              <details className="rounded-lg border bg-card px-4 py-3">
                <summary className="cursor-pointer text-sm font-medium">
                  Propose agent percentages
                </summary>
                <div className="mt-3">
                  <AgentRateAssist propertyId={propertyId} />
                </div>
              </details>
            </div>
          </div>

        {section === "packages" ? (
          <RatePackagesWorkspace
            only="packages"
            rows={rows}
            roomTypes={roomTypes}
            seasons={seasons}
            mealPlans={mealPlans}
            defaultMealPlanCode={defaultMealPlanCode}
            ratesInclusiveOfGstSc={ratesInclusiveOfGstSc}
            gstCharged={gstCharged}
          />
        ) : null}

        {section === "offers" ? <NamedRatesTable rows={namedOffers} /> : null}

        {section === "seasons" ? (
          <section className="rounded-lg border bg-card p-5">
            <SeasonsDateEditor seasons={seasonRows} />
          </section>
        ) : null}

        {section === "meals" ? (
          <RatePackagesWorkspace
            only="meals"
            rows={rows}
            roomTypes={roomTypes}
            seasons={seasons}
            mealPlans={mealPlans}
            defaultMealPlanCode={defaultMealPlanCode}
            ratesInclusiveOfGstSc={ratesInclusiveOfGstSc}
            gstCharged={gstCharged}
          />
        ) : null}

        {section === "guide" ? (
          <section className="rounded-lg border bg-card px-4 py-4 text-sm text-muted-foreground">
            <ul className="list-inside list-disc space-y-2">
              <li>
                <span className="font-medium text-foreground">Packages.</span>{" "}
                Public room night plus adult meal Nu × 2. EP stays room only.
              </li>
              <li>
                <span className="font-medium text-foreground">Tax.</span> {taxBasis}.
              </li>
              <li>
                <span className="font-medium text-foreground">Public site.</span>{" "}
                Public market and the season that contains check-in.
              </li>
              <li>
                <span className="font-medium text-foreground">Agent book.</span>{" "}
                The agent&apos;s market for the room. Meals still add on.
              </li>
              <li>
                <span className="font-medium text-foreground">Children.</span>{" "}
                Ages 0–6 free. Ages 6–12 are half the adult meal, and half the
                adult room when the room is charged per child.
              </li>
              <li>
                <span className="font-medium text-foreground">Extra beds.</span>{" "}
                Property sell rate × quantity × nights, when enabled in settings.
              </li>
            </ul>
          </section>
        ) : null}
      </div>

      <NewRateWizard
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        roomTypes={guestRooms.map((room) => ({ id: room.id, name: room.name }))}
        agents={agents}
        defaultTier={sheetMarket}
        serviceChargeRate={serviceChargeRate}
        gstRate={gstRate}
        gstCharged={gstCharged}
        ratesInclusiveOfGstSc={ratesInclusiveOfGstSc}
      />
    </div>
  );
}
