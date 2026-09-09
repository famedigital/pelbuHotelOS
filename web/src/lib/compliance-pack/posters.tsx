import { PELBU_PROPERTY } from "@/lib/compliance-pack/catalog";
import type { ReactElement } from "react";

export function PosterWasteBins() {
  const bins = [
    { label: "WET / FOOD", color: "bg-emerald-700", tip: "Kitchen scraps, leftover food" },
    { label: "DRY", color: "bg-neutral-700", tip: "Tissue, soiled paper, general dry" },
    { label: "RECYCLABLE", color: "bg-sky-700", tip: "Clean bottles, cans, cardboard" },
    { label: "HAZARDOUS", color: "bg-amber-600", tip: "Chemicals, batteries, bulbs — staff only" },
  ];
  return (
    <div className="space-y-6 text-center">
      <p className="text-lg font-semibold tracking-tight">
        Segregate waste — every bin, every shift
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        {bins.map((b) => (
          <div
            key={b.label}
            className={`${b.color} flex min-h-40 flex-col items-center justify-center rounded-2xl p-6 text-white`}
          >
            <p className="text-xl font-bold tracking-wide">{b.label}</p>
            <p className="mt-2 text-sm text-white/90">{b.tip}</p>
          </div>
        ))}
      </div>
      <p className="text-sm text-neutral-600">
        Lids closed · No mixing · Report full bins to HK / kitchen lead
      </p>
      <p className="text-xs text-neutral-500">{PEL_FOOTER}</p>
    </div>
  );
}

export function PosterRecycling() {
  return (
    <div className="space-y-5 text-center">
      <p className="text-2xl font-semibold tracking-tight">Recycle & re-use</p>
      <ul className="mx-auto max-w-md space-y-3 text-left text-base">
        <li className="rounded-xl border border-neutral-300 px-4 py-3">
          <span className="font-semibold">Plastic bottles & cans</span> — rinse,
          crush, blue / recyclable bin
        </li>
        <li className="rounded-xl border border-neutral-300 px-4 py-3">
          <span className="font-semibold">Cardboard</span> — flatten; keep dry
        </li>
        <li className="rounded-xl border border-neutral-300 px-4 py-3">
          <span className="font-semibold">Glass</span> — staff collection only;
          no guest room bins
        </li>
        <li className="rounded-xl border border-neutral-300 px-4 py-3">
          <span className="font-semibold">Food waste</span> — wet bin → food-waste
          program log
        </li>
      </ul>
      <p className="text-sm text-neutral-600">
        Guests: ask reception. Staff: log collections on Waste segregation form.
      </p>
      <p className="text-xs text-neutral-500">{SIDE_FOOTER}</p>
    </div>
  );
}

export function PosterHandwash() {
  const steps = [
    "Wet hands",
    "Soap 20 seconds",
    "Scrub nails & between fingers",
    "Rinse",
    "Dry with clean towel / air",
    "Before food contact",
  ];
  return (
    <div className="space-y-5">
      <p className="text-center text-2xl font-semibold tracking-tight">
        Wash your hands — food safety
      </p>
      <ol className="grid gap-3 sm:grid-cols-2">
        {steps.map((s, i) => (
          <li
            key={s}
            className="flex items-start gap-3 rounded-xl border-2 border-sky-700/40 bg-sky-50 px-4 py-3"
          >
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-sky-700 text-sm font-bold text-white">
              {i + 1}
            </span>
            <span className="pt-1 text-base font-medium">{s}</span>
          </li>
        ))}
      </ol>
      <p className="text-center text-sm font-medium text-neutral-700">
        After toilet · After waste · After raw food · Before plating
      </p>
      <p className="text-center text-xs text-neutral-500">{SIDE_FOOTER}</p>
    </div>
  );
}

export function PosterFoodSafety() {
  return (
    <div className="space-y-5">
      <p className="text-center text-2xl font-semibold tracking-tight">
        Kitchen food safety rules
      </p>
      <div className="grid gap-3 md:grid-cols-2">
        {[
          {
            t: "Temperature",
            d: "Keep chillers 0–5°C · freezers ≤ −18°C · log twice daily",
          },
          {
            t: "Danger zone",
            d: "Do not leave cooked food in 5–60°C zone — cool / hot-hold correctly",
          },
          {
            t: "Cross-contamination",
            d: "Separate raw / cooked boards · clean knives · colour code where used",
          },
          {
            t: "Uniform",
            d: "Clean uniform + head cover on duty · no jewellery on prep hands",
          },
          {
            t: "Illness",
            d: "Report vomiting / diarrhoea / jaundice to chef — do not handle food",
          },
          {
            t: "Licence",
            d: "BAFRA / BFDA Food Safety Licence & staff medicals on file",
          },
        ].map((x) => (
          <div
            key={x.t}
            className="rounded-xl border border-amber-700/30 bg-amber-50 px-4 py-3 text-left"
          >
            <p className="font-semibold text-amber-950">{x.t}</p>
            <p className="mt-1 text-sm text-amber-950/80">{x.d}</p>
          </div>
        ))}
      </div>
      <p className="text-center text-xs text-neutral-500">{SIDE_FOOTER}</p>
    </div>
  );
}

const SIDE_FOOTER = `${PELBU_PROPERTY.name} · ${PELBU_PROPERTY.address} · BAFRA / BFDA prep poster — laminate & display`;

export const POSTER_RENDERERS: Record<string, () => ReactElement> = {
  "waste-bins": PosterWasteBins,
  recycling: PosterRecycling,
  handwash: PosterHandwash,
  "food-safety": PosterFoodSafety,
};
