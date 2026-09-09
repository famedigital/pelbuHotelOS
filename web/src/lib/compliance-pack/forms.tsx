import {
  BlankRows,
  SignOff,
} from "@/components/erp/compliance/CompliancePrintShell";
import type { ReactElement } from "react";

export function FormFireDrill() {
  return (
    <div className="space-y-4 text-sm">
      <dl className="grid gap-2 sm:grid-cols-2">
        {[
          "Drill date",
          "Start / end time",
          "Drill type (announced / surprise)",
          "Assembly point",
          "Drill lead",
          "Weather / notes",
        ].map((l) => (
          <div key={l} className="border-b border-neutral-200 py-1">
            <dt className="text-[10px] text-neutral-500 uppercase">{l}</dt>
            <dd className="min-h-6">&nbsp;</dd>
          </div>
        ))}
      </dl>
      <p className="text-xs text-neutral-600">
        Scenario practiced: _______________________________________________
      </p>
      <BlankRows
        cols={["#", "Staff name", "Dept / role", "Present", "Signature"]}
        rows={16}
      />
      <p className="text-xs">
        Issues found / follow-up: __________________________________________
      </p>
      <SignOff labels={["Drill lead", "Duty manager", "GM / Owner"]} />
    </div>
  );
}

export function FormIncidentSop() {
  return (
    <div className="space-y-3 text-sm leading-relaxed">
      <p className="font-semibold">Purpose</p>
      <p>
        Ensure every guest injury, staff injury, security event, food-borne
        illness complaint, fire, flood, or major equipment failure is reported,
        escalated, documented, and closed.
      </p>
      <p className="font-semibold">Immediate actions (first 15 minutes)</p>
      <ol className="list-decimal space-y-1 pl-5">
        <li>Secure people — first aid / evacuate if needed.</li>
        <li>Notify Duty Manager (phone / radio).</li>
        <li>Preserve scene for serious incidents; do not argue with guests.</li>
        <li>Open Incident Log entry (Form: Incident log book).</li>
      </ol>
      <p className="font-semibold">Communication flow</p>
      <ol className="list-decimal space-y-1 pl-5">
        <li>Staff on scene → Duty Manager</li>
        <li>Duty Manager → GM / Owner (same shift for serious events)</li>
        <li>
          Food illness / kitchen hygiene → Kitchen lead + retain samples if
          advised; notify BAFRA/BFDA if required
        </li>
        <li>Fire / life safety → Fire Service / Police as required</li>
        <li>Guest follow-up call or visit within 24 hours (record in log)</li>
      </ol>
      <p className="font-semibold">Records</p>
      <p>
        Keep completed incident forms, photos, witness names, and medical notes
        in Settings → Compliance (category: Incidents) and cross-link to DOT
        evidence where relevant.
      </p>
      <SignOff />
    </div>
  );
}

export function FormIncidentLog() {
  return (
    <div className="space-y-3 text-sm">
      <BlankRows
        cols={[
          "Date/time",
          "Type",
          "Location",
          "Brief description",
          "Action taken",
          "Closed by",
        ]}
        rows={14}
      />
      <SignOff labels={["Log keeper", "Duty manager"]} />
    </div>
  );
}

export function FormTrainingPlan() {
  return (
    <div className="space-y-3 text-sm">
      <p>
        Year: ________ &nbsp; Property: Pelbu Suites, Olakha &nbsp; Owner of
        plan: ________
      </p>
      <BlankRows
        cols={[
          "Topic",
          "Frequency",
          "Target roles",
          "Trainer",
          "Due month",
          "Done ✓",
        ]}
        rows={14}
      />
      <p className="text-xs text-neutral-600">
        Suggested topics: fire drill & evacuation · food hygiene / BAFRA ·
        chemical safety · guest service · ISR / handbook · environmental /
        waste segregation · first aid.
      </p>
      <SignOff />
    </div>
  );
}

export function FormTrainingAttendance() {
  return (
    <div className="space-y-3 text-sm">
      <dl className="grid gap-2 sm:grid-cols-2">
        {["Session title", "Date", "Trainer", "Duration", "Venue", "Materials"].map(
          (l) => (
            <div key={l} className="border-b border-neutral-200 py-1">
              <dt className="text-[10px] text-neutral-500 uppercase">{l}</dt>
              <dd className="min-h-6">&nbsp;</dd>
            </div>
          ),
        )}
      </dl>
      <BlankRows
        cols={["#", "Staff name", "Employee code", "Dept", "Signature"]}
        rows={18}
      />
      <SignOff labels={["Trainer", "HR / Manager"]} />
    </div>
  );
}

export function FormPestControl() {
  return (
    <div className="space-y-3 text-sm">
      <p>
        Contractor: ________________ &nbsp; Contract # ________ &nbsp; Next
        scheduled visit: ________
      </p>
      <BlankRows
        cols={[
          "Visit date",
          "Areas treated",
          "Pest type",
          "Chemical / method",
          "Tech. name",
          "Sign",
        ]}
        rows={12}
      />
      <SignOff labels={["Kitchen lead", "GM"]} />
    </div>
  );
}

export function FormFoodWaste() {
  return (
    <div className="space-y-3 text-sm">
      <p className="text-xs text-neutral-600">
        Also log digitally at /erp/kitchen/compliance when possible. This sheet
        is the paper evidence book for inspectors.
      </p>
      <BlankRows
        cols={[
          "Date",
          "Meal / area",
          "Waste type",
          "Qty",
          "Unit",
          "Disposal route",
          "Initials",
        ]}
        rows={16}
      />
      <SignOff labels={["Chef / kitchen lead", "Duty manager"]} />
    </div>
  );
}

export function FormTempLog() {
  return (
    <div className="space-y-3 text-sm">
      <p>
        Week of: ________ &nbsp; Targets: Chiller 0–5°C · Freezer ≤ −18°C
        (adjust to your SOPs)
      </p>
      <BlankRows
        cols={[
          "Date",
          "Unit / location",
          "AM °C",
          "In range?",
          "PM °C",
          "In range?",
          "Corrective action",
          "Initials",
        ]}
        rows={16}
      />
      <SignOff labels={["Kitchen lead"]} />
    </div>
  );
}

export function FormCleaning() {
  return (
    <div className="space-y-3 text-sm">
      <p>Business date: ________ &nbsp; Shift: Breakfast / Lunch / Dinner / Close</p>
      <BlankRows
        cols={[
          "Area / task",
          "Morning",
          "Afternoon",
          "Night",
          "Checked by",
        ]}
        rows={14}
      />
      <p className="text-xs text-neutral-600">
        Example areas: prep tables · floors · sinks · fridge handles · waste
        bins · grease trap check · staff toilets · dishwasher.
      </p>
      <SignOff />
    </div>
  );
}

export function FormMedicalCert() {
  return (
    <div className="space-y-3 text-sm">
      <BlankRows
        cols={[
          "Staff name",
          "Role",
          "Medical exam date",
          "BAFRA / food handler cert #",
          "Expiry",
          "File ref",
        ]}
        rows={16}
      />
      <p className="text-xs text-neutral-600">
        Keep scanned certificates under Settings → Compliance (BAFRA / HR).
      </p>
      <SignOff labels={["HR", "GM"]} />
    </div>
  );
}

export function FormWasteSegregation() {
  return (
    <div className="space-y-3 text-sm">
      <BlankRows
        cols={[
          "Date",
          "Wet / food",
          "Dry",
          "Recyclable",
          "Hazardous",
          "Collected by",
          "Notes",
        ]}
        rows={14}
      />
      <SignOff labels={["HK / kitchen", "Duty manager"]} />
    </div>
  );
}

export function FormSecurityPatrol() {
  return (
    <div className="space-y-3 text-sm">
      <BlankRows
        cols={[
          "Date",
          "Round #",
          "Time out",
          "Time in",
          "Areas checked",
          "Observation",
          "Sign",
        ]}
        rows={16}
      />
      <SignOff labels={["Security / night auditor", "Duty manager"]} />
    </div>
  );
}

export const FORM_RENDERERS: Record<string, () => ReactElement> = {
  "fire-drill": FormFireDrill,
  "incident-sop": FormIncidentSop,
  "incident-log": FormIncidentLog,
  "training-plan": FormTrainingPlan,
  "training-attendance": FormTrainingAttendance,
  "pest-control": FormPestControl,
  "food-waste": FormFoodWaste,
  "temp-log": FormTempLog,
  cleaning: FormCleaning,
  "medical-cert": FormMedicalCert,
  "waste-segregation": FormWasteSegregation,
  "security-patrol": FormSecurityPatrol,
};
