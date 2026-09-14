import {
  BlankRows,
  SignOff,
} from "@/components/erp/compliance/CompliancePrintShell";
import type { ReactElement } from "react";

function SopHeader({
  code,
  title,
  objective,
  dept,
}: {
  code: string;
  title: string;
  objective: string;
  dept: string;
}) {
  return (
    <div className="space-y-2 text-sm">
      <p className="text-xs text-neutral-600">
        {code} · Owner department: <strong>{dept}</strong> · Review annually /
        after BAFRA finding
      </p>
      <p className="font-semibold">{title}</p>
      <p>
        <span className="font-semibold">Objective: </span>
        {objective}
      </p>
    </div>
  );
}

export function FormBafraLicenses() {
  return (
    <div className="space-y-4 text-sm">
      <p className="text-xs text-neutral-600">
        Management / GM — keep originals or certified copies on premises for
        inspection. Tick when current; note expiry and file location.
      </p>
      <BlankRows
        cols={[
          "Document",
          "Issuer",
          "Valid from",
          "Expiry",
          "File location",
          "OK ✓",
        ]}
        rows={8}
      />
      <ul className="list-disc space-y-1 pl-5 text-xs text-neutral-700">
        <li>BAFRA Food Business Licence (annual)</li>
        <li>Staff Health / Medical Fitness Certificates (HR register)</li>
        <li>Pest Control Service Agreement + visit records</li>
        <li>Water Quality Testing Report (accredited lab)</li>
        <li>Waste Management Clearance / disposal records (thromde/dzongkhag)</li>
      </ul>
      <SignOff labels={["Document controller", "GM"]} />
    </div>
  );
}

export function FormReceivingLog() {
  return (
    <div className="space-y-3 text-sm">
      <p className="text-xs text-neutral-600">
        Stores & Receiving · Clause 8.13(b)(i) Incoming material checks. Chilled
        &lt; 4°C · Frozen &lt; −18°C. Also log digitally at Kitchen compliance
        when available.
      </p>
      <BlankRows
        cols={[
          "Date",
          "Item",
          "Supplier",
          "Vehicle OK?",
          "Temp °C",
          "Expiry",
          "Accept/Reject",
          "Initials",
        ]}
        rows={16}
      />
      <SignOff labels={["Receiver", "Stores / Chef"]} />
    </div>
  );
}

export function FormSopPersonalHygiene() {
  return (
    <div className="space-y-3 text-sm leading-relaxed">
      <SopHeader
        code="SOP 01"
        title="Personal Hygiene and Health of Food Handlers"
        objective="Prevent food contamination from personnel."
        dept="Kitchen + F&B Service (HR enforces medical certificates)"
      />
      <p className="font-semibold">Procedure</p>
      <ol className="list-decimal space-y-1 pl-5">
        <li>
          Wear clean, light-coloured aprons, hairnets/caps, and closed-toe
          non-slip shoes.
        </li>
        <li>
          Wash hands thoroughly with soap and warm water for at least 20 seconds
          before starting work, after handling raw meat, after using the
          restroom, and after touching waste.
        </li>
        <li>Jewellery, watches, and artificial nails are prohibited in the kitchen.</li>
        <li>
          Staff with cuts, open wounds, fever, diarrhoea, or respiratory
          infections must report immediately and be reassigned away from food
          handling until medically cleared.
        </li>
      </ol>
      <SignOff labels={["Kitchen lead", "F&B lead", "HR / GM"]} />
    </div>
  );
}

export function FormSopFoodStorage() {
  return (
    <div className="space-y-3 text-sm leading-relaxed">
      <SopHeader
        code="SOP 02"
        title="Safe Food Storage and Inventory Management"
        objective="Prevent spoilage, cross-contamination, and pest infestation in storage areas."
        dept="Stores & Receiving + Kitchen"
      />
      <p className="font-semibold">Procedure</p>
      <ol className="list-decimal space-y-1 pl-5">
        <li>Apply FIFO (First-In, First-Out) to all dry and cold stores.</li>
        <li>
          Store raw meats, poultry, and seafood on bottom shelves below cooked
          or ready-to-eat foods to prevent drip contamination.
        </li>
        <li>
          Keep dry goods off the floor on pallets or shelves in a
          well-ventilated, dry, pest-free environment.
        </li>
        <li>Check and record refrigerator temperatures twice daily.</li>
      </ol>
      <SignOff labels={["Stores", "Kitchen lead"]} />
    </div>
  );
}

export function FormSopFoodPrep() {
  return (
    <div className="space-y-3 text-sm leading-relaxed">
      <SopHeader
        code="SOP 03"
        title="Food Preparation and Cooking (Cross-Contamination Prevention)"
        objective="Ensure meals are safe from biological, chemical, and physical hazards."
        dept="Kitchen (F&B Service owns holding temps at outlet)"
      />
      <p className="font-semibold">Procedure</p>
      <ol className="list-decimal space-y-1 pl-5">
        <li>
          Use designated colour-coded cutting boards and knives (e.g. Red = raw
          meat, Green = vegetables, Blue = raw fish, Yellow = cooked meat, White
          = bakery/dairy).
        </li>
        <li>
          Thaw frozen foods safely inside a refrigerator at &lt; 4°C or using
          microwave defrost — never at room temperature.
        </li>
        <li>
          Ensure high-risk cooked foods reach a minimum core temperature of
          75°C.
        </li>
        <li>
          Hot holding must be maintained above 60°C; cold holding at or below
          4°C.
        </li>
      </ol>
      <SignOff labels={["Chef", "F&B lead"]} />
    </div>
  );
}

export function FormSopKitchenCleaning() {
  return (
    <div className="space-y-3 text-sm leading-relaxed">
      <SopHeader
        code="SOP 04"
        title="Kitchen Cleaning, Sanitization, and Waste Management"
        objective="Maintain a clean, sanitized environment free from vector attraction."
        dept="Kitchen + Housekeeping + Engineering (grease traps)"
      />
      <p className="font-semibold">Procedure</p>
      <ol className="list-decimal space-y-1 pl-5">
        <li>Adopt a clean-as-you-go policy for work stations.</li>
        <li>
          Wash utensils using a 3-sink method: Wash (hot water + detergent) →
          Rinse (clean water) → Sanitize (approved food-grade sanitizer).
        </li>
        <li>
          Empty kitchen waste bins regularly into covered, leak-proof outdoor
          bins. Wash and sanitize waste bins daily.
        </li>
        <li>
          Ensure grease traps are cleaned and maintained weekly to prevent
          blockages and foul odours (Engineering).
        </li>
        <li>
          Cleaning chemicals and hazardous substances: restricted access for
          authorised personnel only (BAFRA 8.12(d)).
        </li>
      </ol>
      <SignOff labels={["Kitchen lead", "HK", "Engineering"]} />
    </div>
  );
}

export function FormBafraSelfAudit() {
  return (
    <div className="space-y-4 text-sm">
      <p className="text-xs text-neutral-600">
        Management / Duty Manager — weekly internal audit before BAFRA
        inspections. Retain completed sheets ≥ 1 year beyond product shelf life
        (Clause 8.13(a)).
      </p>
      <p>
        Week of: ________ &nbsp; Auditor: ________ &nbsp; Date: ________
      </p>
      <ul className="space-y-2">
        {[
          "Are all BAFRA licences and medical certificates displayed or readily available?",
          "Are food temperature logs updated consistently twice a day?",
          "Are chemicals stored securely away from food preparation and storage zones?",
          "Are handwashing stations equipped with liquid soap, running water, and single-use towels?",
          "Are expired or damaged food items discarded properly and recorded?",
          "Is pest control agreement current and last service within schedule?",
          "Is latest water quality report on file and within validity?",
          "Are department logbooks signed (Kitchen, Stores, HK, Engineering)?",
          "Incoming material / receiving checks completed for deliveries this week?",
          "Staff medical certificates within expiry (HR register)?",
        ].map((q) => (
          <li
            key={q}
            className="flex gap-3 border-b border-neutral-200 py-2 text-sm"
          >
            <span className="shrink-0 font-mono text-xs">☐ Yes ☐ No ☐ NA</span>
            <span>{q}</span>
          </li>
        ))}
      </ul>
      <p className="text-xs">
        Findings / CAPA ref: _______________________________________________
      </p>
      <SignOff labels={["Auditor", "GM"]} />
    </div>
  );
}

export function FormCookTempTime() {
  return (
    <div className="space-y-3 text-sm">
      <p className="text-xs text-neutral-600">
        Kitchen · Clause 8.13(b)(iii) Temperature and time. Core cook ≥ 75°C ·
        Hot hold &gt; 60°C · Cold hold ≤ 4°C.
      </p>
      <BlankRows
        cols={[
          "Date",
          "Dish / batch",
          "Cook core °C",
          "Time reached",
          "Hot hold °C",
          "Cold hold °C",
          "Sign",
        ]}
        rows={14}
      />
      <SignOff labels={["Cook", "Kitchen lead"]} />
    </div>
  );
}

export function FormCalibration() {
  return (
    <div className="space-y-3 text-sm">
      <p className="text-xs text-neutral-600">
        Engineering · Clause 8.13(b)(x) Calibration of equipment (thermometers,
        probes, scales as applicable).
      </p>
      <BlankRows
        cols={[
          "Date",
          "Equipment",
          "ID",
          "Standard used",
          "Reading",
          "Pass/Fail",
          "Next due",
          "Sign",
        ]}
        rows={12}
      />
      <SignOff labels={["Engineer", "Kitchen lead"]} />
    </div>
  );
}

export function FormRecallTraceability() {
  return (
    <div className="space-y-3 text-sm">
      <p className="text-xs text-neutral-600">
        Management + Stores + Kitchen · Clause 8.13(b)(iv) Product recall and
        traceability.
      </p>
      <BlankRows
        cols={[
          "Date",
          "Product",
          "Batch / lot",
          "Supplier",
          "Qty",
          "Distributed to",
          "Recall action",
          "Sign",
        ]}
        rows={10}
      />
      <SignOff labels={["Stores", "Chef", "GM"]} />
    </div>
  );
}

export function FormCapa() {
  return (
    <div className="space-y-3 text-sm">
      <p className="text-xs text-neutral-600">
        Management · Clause 8.13(b)(xii) Corrective and preventive action.
      </p>
      <BlankRows
        cols={[
          "Date",
          "Finding",
          "Root cause",
          "Corrective",
          "Preventive",
          "Owner",
          "Due",
          "Closed",
        ]}
        rows={10}
      />
      <SignOff labels={["Owner", "GM"]} />
    </div>
  );
}

/** Checkbox-style cleaning schedule rows for BAFRA kitchen hygiene. */
function CleaningScheduleLog({
  frequency,
  periodLabel,
  items,
  shiftCols,
}: {
  frequency: string;
  periodLabel: string;
  items: string[];
  shiftCols: string[];
}) {
  return (
    <div className="space-y-4 text-sm">
      <p className="text-xs text-neutral-600">
        Kitchen · BAFRA cleaning & sanitization ({frequency}) · Clause 8.13(b)(vi)
        · SOP 04. Mark ✓ when done; initial in last column. Agent / chemical used
        must be food-grade and stored away from food (8.12(d)).
      </p>
      <p>
        {periodLabel}: ________ &nbsp; Outlet / kitchen: ________ &nbsp; Sanitizer
        used: ________
      </p>
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr className="border-b-2 border-neutral-400 text-left">
            <th className="px-1 py-1.5 font-semibold">Area / task</th>
            {shiftCols.map((c) => (
              <th key={c} className="px-1 py-1.5 font-semibold">
                {c}
              </th>
            ))}
            <th className="px-1 py-1.5 font-semibold">Initials</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item} className="border-b border-neutral-200">
              <td className="px-1 py-2 align-top">{item}</td>
              {shiftCols.map((c) => (
                <td key={c} className="h-8 px-1 py-1 text-center">
                  ☐
                </td>
              ))}
              <td className="h-8 px-1 py-1">&nbsp;</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-xs">
        Corrective action / notes: _____________________________________________
      </p>
      <SignOff labels={["Cleaner", "Kitchen lead", "Duty manager"]} />
    </div>
  );
}

export function FormCleaningDaily() {
  return (
    <CleaningScheduleLog
      frequency="daily"
      periodLabel="Business date"
      shiftCols={["AM", "PM", "Close"]}
      items={[
        "Prep tables & food-contact surfaces (wash → rinse → sanitize)",
        "Cutting boards & knives (colour-coded sets)",
        "Cooking range / griddle exterior wipe-down",
        "Sinks, taps & splashbacks",
        "Handwash station (soap, towels, running water check)",
        "Floors — sweep & mop (incl. under prep tables)",
        "Floor drains — flush / clear debris",
        "Waste bins emptied; liners replaced; bins washed",
        "Fridge / freezer door handles & seals wiped",
        "Dishwash / 3-sink area cleaned & sanitized",
        "Service pass / plating area",
        "Staff toilet / changing area (if kitchen-assigned)",
        "Chemicals returned to locked store (no open chemicals on counters)",
      ]}
    />
  );
}

export function FormCleaningWeekly() {
  return (
    <CleaningScheduleLog
      frequency="weekly"
      periodLabel="Week of"
      shiftCols={["Done ✓", "Date"]}
      items={[
        "Deep clean ovens, grills, fryers (incl. grease trays)",
        "Refrigerator interiors (shelves, drawers, seals)",
        "Freezer interiors (defrost if required; wipe shelves)",
        "Walls & tiles behind cook line / prep",
        "Exhaust hood filters removed, washed, refitted",
        "Grease trap cleaned / maintained (coord. Engineering)",
        "Dry store shelves wiped; FIFO check; floor under pallets",
        "Walk-in / cold room floors & walls",
        "Pull-out clean behind / under heavy equipment",
        "Ice machine exterior + scoop holder sanitized",
        "Pest monitoring points checked; sightings logged",
        "Sanitizer concentration verified (test strips if used)",
      ]}
    />
  );
}

export function FormCleaningMonthly() {
  return (
    <CleaningScheduleLog
      frequency="monthly"
      periodLabel="Month"
      shiftCols={["Done ✓", "Date"]}
      items={[
        "Ceiling, vents & light fittings dusted / washed (kitchen)",
        "Exhaust canopy / duct deep clean (or contractor visit recorded)",
        "Full walk-in cold room deep clean & stock rotation audit",
        "Dry store full clean + pest / damage inspection",
        "Ice machine internal clean / sanitize (per maker schedule)",
        "Thermometer / probe calibration check (Engineering)",
        "Chemical store audit — labels, SDS, restricted access",
        "Staff lockers / changing deep clean",
        "External bin area wash-down; lids & drains checked",
        "Review cleaning logs for gaps; CAPA opened if needed",
        "BAFRA self-audit items related to cleaning closed out",
      ]}
    />
  );
}

export function FormDeptMatrix() {
  return (
    <div className="space-y-4 text-sm leading-relaxed">
      <p className="font-semibold">BAFRA Clause 8.13 — record ownership by department</p>
      <p className="text-xs text-neutral-600">
        Retain records at least 1 year exceeding product shelf life.
      </p>
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr className="border-b-2 border-neutral-400 text-left">
            <th className="py-1.5 pr-2">Record</th>
            <th className="py-1.5">Owner department</th>
          </tr>
        </thead>
        <tbody>
          {[
            ["i) Incoming material checks", "Stores & Receiving"],
            ["ii) Inspection and test", "Kitchen + Stores"],
            ["iii) Temperature and time", "Kitchen + F&B Service + Stores"],
            ["iv) Product recall and traceability", "Management + Stores + Kitchen"],
            ["v) Storage", "Stores + Kitchen"],
            ["vi) Cleaning and sanitation", "Kitchen + F&B + Housekeeping"],
            ["vii) Pest control", "Engineering + Management"],
            ["viii) Medical and health status", "Human Resources"],
            ["ix) Training", "HR + each HOD"],
            ["x) Calibration of equipment", "Engineering"],
            ["xi) Complaint and customer feedback", "Management / Front Office"],
            ["xii) Corrective and preventive action", "Management"],
            ["xiii) Emergency preparedness plan", "Management"],
          ].map(([a, b]) => (
            <tr key={a} className="border-b border-neutral-200">
              <td className="py-2 pr-2">{a}</td>
              <td className="py-2">{b}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-xs text-neutral-600">
        Digital daily logs: /erp/kitchen/compliance · Licence uploads: Settings
        → Compliance · Print this pack for wall binders by department.
      </p>
      <SignOff labels={["GM"]} />
    </div>
  );
}

export const BAFRA_FORM_RENDERERS: Record<string, () => ReactElement> = {
  "bafra-licenses": FormBafraLicenses,
  "receiving-log": FormReceivingLog,
  "sop-personal-hygiene": FormSopPersonalHygiene,
  "sop-food-storage": FormSopFoodStorage,
  "sop-food-prep": FormSopFoodPrep,
  "sop-kitchen-cleaning": FormSopKitchenCleaning,
  "bafra-self-audit": FormBafraSelfAudit,
  "cook-temp-time": FormCookTempTime,
  calibration: FormCalibration,
  "recall-traceability": FormRecallTraceability,
  capa: FormCapa,
  "cleaning-daily": FormCleaningDaily,
  "cleaning-weekly": FormCleaningWeekly,
  "cleaning-monthly": FormCleaningMonthly,
  "bafra-dept-matrix": FormDeptMatrix,
};
