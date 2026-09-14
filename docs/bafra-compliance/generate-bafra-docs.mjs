/**
 * BAFRA Hotel Compliance — department-wise Word manuals for Pelbu Suites.
 * Run: node generate-bafra-docs.mjs
 */
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  BorderStyle,
  Table,
  TableRow,
  TableCell,
  WidthType,
  Header,
  Footer,
  PageNumber,
  LevelFormat,
} from "docx";
import { writeFileSync, mkdirSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = __dirname;

const HOTEL = "Pelbu Suites";
const AUTHORITY = "Bhutan Agriculture and Food Regulatory Authority (BAFRA)";
const MANUAL = "BAFRA Hotel Compliance and SOP Manual";

const colors = {
  maroon: "6B2D3C",
  espresso: "2C1810",
  muted: "555555",
  border: "CCCCCC",
  lightBg: "F8F5F2",
};

function h1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 240, after: 160 },
    children: [new TextRun({ text, bold: true, color: colors.maroon })],
  });
}

function h2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 200, after: 120 },
    children: [new TextRun({ text, bold: true, color: colors.espresso })],
  });
}

function h3(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 160, after: 80 },
    children: [new TextRun({ text, bold: true, color: colors.espresso })],
  });
}

function p(text, opts = {}) {
  return new Paragraph({
    spacing: { after: 120 },
    ...opts,
    children: [
      new TextRun({
        text,
        size: 22,
        color: colors.espresso,
        ...(opts.run || {}),
      }),
    ],
  });
}

function boldLine(label, value) {
  return new Paragraph({
    spacing: { after: 80 },
    children: [
      new TextRun({ text: `${label}: `, bold: true, size: 22, color: colors.espresso }),
      new TextRun({ text: value, size: 22, color: colors.espresso }),
    ],
  });
}

function bullet(text) {
  return new Paragraph({
    numbering: { reference: "bullets", level: 0 },
    spacing: { after: 60 },
    children: [new TextRun({ text, size: 22, color: colors.espresso })],
  });
}

function numbered(text) {
  return new Paragraph({
    numbering: { reference: "steps", level: 0 },
    spacing: { after: 60 },
    children: [new TextRun({ text, size: 22, color: colors.espresso })],
  });
}

function checkItem(text) {
  return new Paragraph({
    spacing: { after: 80 },
    children: [
      new TextRun({ text: "☐  ", size: 22, color: colors.espresso }),
      new TextRun({ text, size: 22, color: colors.espresso }),
    ],
  });
}

function metaBlock(dept) {
  return [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 80 },
      children: [
        new TextRun({ text: HOTEL, bold: true, size: 36, color: colors.maroon }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 40 },
      children: [
        new TextRun({ text: MANUAL, bold: true, size: 26, color: colors.espresso }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
      children: [
        new TextRun({
          text: `Department Manual — ${dept}`,
          size: 24,
          italics: true,
          color: colors.muted,
        }),
      ],
    }),
    boldLine("Regulatory authority", AUTHORITY),
    boldLine("Property", HOTEL),
    boldLine("Department", dept),
    boldLine("Document type", "Department SOP, logbooks & compliance pack"),
    boldLine("Review cycle", "Annual, or after any BAFRA inspection finding"),
    new Paragraph({ spacing: { after: 200 }, children: [] }),
  ];
}

function sectionIntro(text) {
  return p(text);
}

function logTableHeaders(cols) {
  return new TableRow({
    tableHeader: true,
    children: cols.map(
      (c) =>
        new TableCell({
          width: { size: Math.floor(9000 / cols.length), type: WidthType.DXA },
          shading: { fill: colors.lightBg },
          borders: cellBorders(),
          children: [
            new Paragraph({
              children: [
                new TextRun({ text: c, bold: true, size: 18, color: colors.espresso }),
              ],
            }),
          ],
        })
    ),
  });
}

function emptyLogRows(cols, rows = 8) {
  const w = Math.floor(9000 / cols.length);
  return Array.from({ length: rows }, () =>
    new TableRow({
      children: cols.map(
        () =>
          new TableCell({
            width: { size: w, type: WidthType.DXA },
            borders: cellBorders(),
            children: [new Paragraph({ children: [new TextRun({ text: " ", size: 18 })] })],
          })
      ),
    })
  );
}

function cellBorders() {
  const b = { style: BorderStyle.SINGLE, size: 4, color: colors.border };
  return { top: b, bottom: b, left: b, right: b };
}

function makeLogTable(cols) {
  return new Table({
    width: { size: 9000, type: WidthType.DXA },
    rows: [logTableHeaders(cols), ...emptyLogRows(cols)],
  });
}

function docShell(dept, children) {
  return new Document({
    styles: {
      default: {
        document: {
          styles: [
            {
              id: "Normal",
              name: "Normal",
              run: { font: "Calibri", size: 22 },
            },
          ],
        },
      },
    },
    numbering: {
      config: [
        {
          reference: "bullets",
          levels: [
            {
              level: 0,
              format: LevelFormat.BULLET,
              text: "•",
              alignment: AlignmentType.LEFT,
              style: { paragraph: { indent: { left: 420, hanging: 220 } } },
            },
          ],
        },
        {
          reference: "steps",
          levels: [
            {
              level: 0,
              format: LevelFormat.DECIMAL,
              text: "%1.",
              alignment: AlignmentType.LEFT,
              style: { paragraph: { indent: { left: 420, hanging: 220 } } },
            },
          ],
        },
      ],
    },
    sections: [
      {
        properties: {
          page: {
            margin: { top: 720, right: 720, bottom: 720, left: 720 },
          },
        },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: `${HOTEL}  |  BAFRA Compliance  |  ${dept}`,
                    size: 16,
                    color: colors.muted,
                  }),
                ],
                border: {
                  bottom: { style: BorderStyle.SINGLE, size: 6, color: colors.maroon, space: 8 },
                },
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    text: "Confidential — for internal use and BAFRA inspection  |  Page ",
                    size: 16,
                    color: colors.muted,
                  }),
                  new TextRun({
                    children: [PageNumber.CURRENT],
                    size: 16,
                    color: colors.muted,
                  }),
                ],
              }),
            ],
          }),
        },
        children: [...metaBlock(dept), ...children],
      },
    ],
  });
}

async function save(filename, doc) {
  const buffer = await Packer.toBuffer(doc);
  const path = join(OUT, filename);
  writeFileSync(path, buffer);
  console.log("Wrote", filename);
}

// ─── Shared content fragments ───────────────────────────────────────────────

const receivingCols = [
  "Date",
  "Item",
  "Supplier",
  "Vehicle OK?",
  "Temp °C",
  "Expiry",
  "Accept/Reject",
  "Initials",
];

const coldStoreCols = [
  "Unit ID",
  "Date",
  "Time",
  "AM °C",
  "PM °C",
  "In range?",
  "Corrective action",
  "Signature",
];

const cleaningCols = [
  "Area / Equipment",
  "Agent used",
  "Frequency",
  "Date",
  "Time",
  "Cleaner sign",
  "Supervisor",
];

const pestCols = [
  "Date",
  "Areas inspected",
  "Findings",
  "Corrective action",
  "Tech. signature",
  "Hotel sign",
];

// ─── Department documents ───────────────────────────────────────────────────

async function buildManagement() {
  const doc = docShell("Management / General Manager", [
    h1("1. Department role in BAFRA compliance"),
    sectionIntro(
      "Management owns licences, contracts, inspection readiness, and weekly self-audits. Department heads execute daily SOPs; GM ensures documents are valid and available on premises."
    ),
    h1("2. Regulatory documents & licences (keep on premises)"),
    h2("BAFRA Food Business Licence"),
    bullet("Valid annual registration/licence issued by BAFRA for food and accommodation service establishments."),
    bullet("Display or file for immediate inspector access; diary renewal date 60 days ahead."),
    h2("Health certificates / medical fitness certificates"),
    bullet("Mandatory for all food handlers, kitchen staff, and service personnel."),
    bullet("Renewed semi-annually or annually as per local health authorities."),
    bullet("HR maintains register; copies available for inspection."),
    h2("Pest control service agreement"),
    bullet("Valid contract with a certified pest control operator."),
    bullet("Retain service visit records with this file."),
    h2("Water quality testing report"),
    bullet("Periodic microbial and chemical analysis of water source (borewell, municipal, etc.)."),
    bullet("Use an accredited laboratory; file latest report with Engineering."),
    h2("Waste management clearance / disposal records"),
    bullet("Proof of compliance with local thromde/dzongkhag waste disposal regulations."),
    h1("3. Weekly self-inspection checklist (GM / Duty Manager)"),
    p("Conduct weekly. File completed checklists for at least 12 months."),
    checkItem("Are all BAFRA licences and medical certificates displayed or readily available?"),
    checkItem("Are food temperature logs updated consistently twice a day?"),
    checkItem("Are chemicals stored securely away from food preparation and storage zones?"),
    checkItem("Are handwashing stations equipped with liquid soap, running water, and single-use towels?"),
    checkItem("Are expired or damaged food items discarded properly and recorded?"),
    checkItem("Is pest control agreement current and last service within scheduled interval?"),
    checkItem("Is latest water quality report on file and within validity period?"),
    checkItem("Are department logbooks signed by supervisors (Kitchen, Stores, HK, Engineering)?"),
    h1("4. Escalation"),
    bullet("Any BAFRA non-conformance → assign owner, corrective action, and close-out date within 24 hours."),
    bullet("Guest illness linked to food → isolate product, notify GM, retain samples if advised, document incident."),
  ]);
  await save("01-Management-GM-BAFRA-Compliance.docx", doc);
}

async function buildHR() {
  const doc = docShell("Human Resources", [
    h1("1. Department role"),
    sectionIntro(
      "HR ensures every food handler and F&B service staff member holds a valid medical fitness certificate before starting work and on renewal."
    ),
    h1("2. Mandatory documents owned by HR"),
    h2("Health / medical fitness certificates"),
    bullet("Required for: kitchen, pastry, stores handlers, restaurant/café/bar service, and any staff who handle food or food contact surfaces."),
    bullet("Renewal: semi-annually or annually as directed by local health authorities."),
    bullet("No certificate / expired certificate → staff must not handle food until cleared."),
    h1("3. Staff medical register (maintain)"),
    makeLogTable([
      "Staff name",
      "Department",
      "Role",
      "Certificate no.",
      "Issue date",
      "Expiry",
      "Status",
      "HR sign",
    ]),
    h1("4. SOP link — personal hygiene (enforce with Kitchen & F&B)"),
    bullet("Staff with cuts, open wounds, fever, diarrhoea, or respiratory infection must report immediately."),
    bullet("HR / HOD reassigns away from food handling until medically cleared."),
    bullet("Jewellery, watches, and artificial nails prohibited in kitchen — include in induction."),
    h1("5. HR weekly check"),
    checkItem("All active food handlers have certificates within validity."),
    checkItem("New joiners inducted on personal hygiene before kitchen/outlet duty."),
    checkItem("Sick-leave returns include fitness-to-handle-food clearance when required."),
  ]);
  await save("02-Human-Resources-BAFRA-Compliance.docx", doc);
}

async function buildStores() {
  const doc = docShell("Stores & Receiving", [
    h1("1. Department role"),
    sectionIntro(
      "Stores & Receiving control inbound food safety: supplier acceptance, temperatures on arrival, labelling, FIFO, and segregation of raw vs ready-to-eat goods."
    ),
    h1("2. Documents & records"),
    bullet("Receiving & Temperature Control Log (daily on deliveries)."),
    bullet("Supplier contact list and delivery notes retained with receiving log."),
    bullet("Rejected goods record (reason, return/destruction)."),
    h1("3. Logbook A — Receiving & Temperature Control"),
    h2("Purpose"),
    p("Monitor safety and freshness of raw materials entering the kitchen/stores."),
    h2("Parameters to record"),
    bullet("Date, item description, supplier name."),
    bullet("Delivery vehicle condition."),
    bullet("Temperature upon arrival: chilled < 4°C, frozen < −18°C."),
    bullet("Expiry dates and staff initials."),
    h3("Blank log sheets"),
    makeLogTable(receivingCols),
    new Paragraph({ spacing: { before: 200, after: 120 }, children: [] }),
    makeLogTable(receivingCols),
    h1("4. SOP 02 excerpt — storage & inventory (Stores)"),
    h2("Objective"),
    p("Prevent spoilage, cross-contamination, and pest infestation in storage areas."),
    h2("Procedure"),
    numbered("Apply FIFO (First-In, First-Out) to all dry and cold stores."),
    numbered(
      "Store raw meats, poultry, and seafood on bottom shelves below cooked or ready-to-eat foods to prevent drip contamination."
    ),
    numbered(
      "Keep dry goods off the floor on pallets or shelves in a well-ventilated, dry, pest-free environment."
    ),
    numbered("Check and record refrigerator/freezer temperatures twice daily (coordinate with Kitchen/Engineering)."),
    numbered("Reject deliveries that fail temperature, packaging integrity, or expiry checks; record rejection."),
    h1("5. Department checklist"),
    checkItem("Receiving log completed for every food delivery today."),
    checkItem("Chilled arrivals recorded < 4°C; frozen < −18°C."),
    checkItem("FIFO labels visible; no stock on floor."),
    checkItem("Chemicals never stored with food."),
  ]);
  await save("03-Stores-Receiving-BAFRA-Compliance.docx", doc);
}

async function buildKitchen() {
  const doc = docShell("Kitchen / Food Production", [
    h1("1. Department role"),
    sectionIntro(
      "Kitchen owns food preparation, cooking temperatures, personal hygiene of cooks, cold storage temperature checks for kitchen units, cleaning of production areas, and cross-contamination controls."
    ),
    h1("2. Mandatory logbooks"),
    h2("B. Cold Storage (Refrigerator/Freezer) Temperature Log"),
    p("Purpose: Prevent bacterial growth by ensuring proper storage temperatures."),
    bullet("Target: Chiller ≤ 4°C, Freezer ≤ −18°C."),
    bullet("Record unit ID, date, time, morning and evening temperatures, corrective actions, checker signature."),
    makeLogTable(coldStoreCols),
    new Paragraph({ spacing: { before: 160 }, children: [] }),
    makeLogTable(coldStoreCols),
    h2("C. Cleaning and Sanitization Log (kitchen zones)"),
    p("Purpose: Verify routine deep cleaning of kitchen surfaces, equipment, and prep areas."),
    makeLogTable(cleaningCols),
    h1("3. SOP 01 — Personal Hygiene and Health of Food Handlers"),
    h2("Objective"),
    p("Prevent food contamination from personnel."),
    h2("Procedure"),
    numbered(
      "Wear clean, light-coloured aprons, hairnets/caps, and closed-toe non-slip shoes."
    ),
    numbered(
      "Wash hands thoroughly with soap and warm water for at least 20 seconds before starting work, after handling raw meat, after using the restroom, and after touching waste."
    ),
    numbered("Jewellery, watches, and artificial nails are prohibited in the kitchen."),
    numbered(
      "Staff with cuts, open wounds, fever, diarrhoea, or respiratory infections must report immediately and be reassigned away from food handling until medically cleared."
    ),
    h1("4. SOP 02 — Safe Food Storage (Kitchen cold & dry)"),
    numbered("Apply FIFO to all dry and cold stores under kitchen control."),
    numbered("Raw meats/poultry/seafood on bottom shelves below cooked/RTE foods."),
    numbered("Dry goods off the floor; ventilated, dry, pest-free."),
    numbered("Record refrigerator temperatures twice daily."),
    h1("5. SOP 03 — Food Preparation and Cooking (Cross-Contamination Prevention)"),
    h2("Objective"),
    p("Ensure meals are safe from biological, chemical, and physical hazards."),
    h2("Procedure"),
    numbered(
      "Use designated colour-coded cutting boards and knives (e.g. Red = raw meat, Green = vegetables, Blue = raw fish, Yellow = cooked meat, White = bakery/dairy)."
    ),
    numbered(
      "Thaw frozen foods safely inside a refrigerator at < 4°C or using microwave defrost — never at room temperature."
    ),
    numbered("Ensure high-risk cooked foods reach a minimum core temperature of 75°C."),
    numbered("Hot holding above 60°C; cold holding at or below 4°C."),
    h1("6. SOP 04 — Kitchen Cleaning, Sanitization, and Waste (production)"),
    numbered("Adopt a clean-as-you-go policy for work stations."),
    numbered(
      "Wash utensils using 3-sink method: Wash (hot water + detergent) → Rinse (clean water) → Sanitize (approved food-grade sanitizer)."
    ),
    numbered(
      "Empty kitchen waste bins regularly into covered, leak-proof outdoor bins. Wash and sanitize waste bins daily."
    ),
    numbered("Ensure grease traps are cleaned weekly (coordinate with Engineering)."),
    h1("7. Kitchen self-check"),
    checkItem("Temp logs AM/PM complete for all kitchen chillers/freezers."),
    checkItem("Colour-coded boards in use; no cross-use observed."),
    checkItem("Handwash station has soap, water, single-use towels."),
    checkItem("No expired/damaged food in fridges or dry store."),
    checkItem("Chemicals stored away from food prep."),
  ]);
  await save("04-Kitchen-Food-Production-BAFRA-Compliance.docx", doc);
}

async function buildFnB() {
  const doc = docShell("F&B Service (Restaurant / Café / Bar)", [
    h1("1. Department role"),
    sectionIntro(
      "F&B Service ensures safe holding and service of food and beverages, personal hygiene of service staff, cleanliness of dining areas, and correct handling of leftovers and guest-facing stations (buffets, bars, pastry counters)."
    ),
    h1("2. Documents linked to this department"),
    bullet("Medical fitness certificates for all service staff (via HR)."),
    bullet("Cleaning & Sanitization Log for dining room, service stations, and bar."),
    bullet("Hot/cold holding spot checks during service (record on service sheet or attach to Kitchen cold/hot log)."),
    h1("3. SOP 01 — Personal Hygiene (Service staff)"),
    numbered("Clean uniform, hair restrained, closed-toe shoes."),
    numbered("Handwash before service, after clearing soiled plates, after restroom, after handling waste."),
    numbered("No jewellery that contacts food; report illness immediately."),
    h1("4. SOP 03 — Holding & service temperatures"),
    bullet("Hot holding maintained above 60°C."),
    bullet("Cold holding at or below 4°C (salad bars, dairy, chilled desserts)."),
    bullet("Do not mix raw and ready-to-eat on the same service utensil or board."),
    bullet("Discard food past safe holding time; never reheat repeatedly for service."),
    h1("5. Cleaning log — dining & service areas"),
    makeLogTable(cleaningCols),
    new Paragraph({ spacing: { before: 160 }, children: [] }),
    makeLogTable(cleaningCols),
    h1("6. Outlet checklist (per shift)"),
    checkItem("Handwash / sanitizer available at service points as required."),
    checkItem("Buffet/hot wells within temperature; logged if used."),
    checkItem("Serviceware clean; cracked crockery removed."),
    checkItem("Chemicals and cleaning cloths not stored with food."),
    checkItem("Waste cleared; no pest attractants in outlet."),
  ]);
  await save("05-FB-Service-Restaurant-Cafe-Bar-BAFRA-Compliance.docx", doc);
}

async function buildHousekeeping() {
  const doc = docShell("Housekeeping", [
    h1("1. Department role"),
    sectionIntro(
      "Housekeeping supports BAFRA hygiene outcomes through guest-area and back-of-house sanitation, waste handling coordination, and reporting of pest signs. Food production cleaning remains Kitchen-owned; HK owns assigned public and staff areas per hotel matrix."
    ),
    h1("2. Mandatory records"),
    bullet("Cleaning and Sanitization Log for HK-assigned areas (public washrooms near F&B, staff changing if assigned, corridor/back-of-house as defined)."),
    bullet("Pest sighting reports escalated to Engineering / Management same day."),
    bullet("Waste segregation and transfer records where HK handles collection to outdoor bins."),
    h1("3. Cleaning & Sanitization Log"),
    h2("Purpose"),
    p("Verify routine cleaning and sanitization of assigned surfaces and areas."),
    h2("Parameters"),
    bullet("Area/equipment cleaned, cleaning agent used, frequency, date, time, cleaner signature."),
    makeLogTable(cleaningCols),
    new Paragraph({ spacing: { before: 160 }, children: [] }),
    makeLogTable(cleaningCols),
    h1("4. SOP 04 — Waste & hygiene support"),
    numbered("Empty waste regularly into covered, leak-proof outdoor bins."),
    numbered("Wash and sanitize waste bins on the agreed schedule (daily for kitchen-adjacent bins if assigned)."),
    numbered("Never store cleaning chemicals in food rooms or on food shelves."),
    numbered("Report signs of rodents/insects immediately (date, location, photo if available)."),
    h1("5. HK checklist"),
    checkItem("Assigned F&B-adjacent toilets stocked with soap and single-use towels/dryer."),
    checkItem("Cleaning logs signed for the day."),
    checkItem("No open waste or spills attracting pests."),
    checkItem("Chemical store locked and labelled; SDS available."),
  ]);
  await save("06-Housekeeping-BAFRA-Compliance.docx", doc);
}

async function buildEngineering() {
  const doc = docShell("Engineering / Maintenance", [
    h1("1. Department role"),
    sectionIntro(
      "Engineering maintains water safety evidence, cold-storage equipment reliability, grease traps, pest-control access for contractors, and facility conditions that prevent hygiene failures."
    ),
    h1("2. Regulatory documents owned / co-owned"),
    h2("Water quality testing report"),
    bullet("Periodic microbial and chemical analysis of water source by an accredited laboratory."),
    bullet("File latest report; diary next test date."),
    h2("Pest control service agreement & visit records"),
    bullet("Support Management contract; escort technician; unlock plant rooms and external areas."),
    h2("Waste / drainage related clearances"),
    bullet("Coordinate grease trap maintenance evidence with Kitchen schedule."),
    h1("3. Logbook B — Cold storage equipment support"),
    p(
      "Kitchen records daily temps; Engineering investigates out-of-range units and records corrective work."
    ),
    makeLogTable([
      "Date",
      "Unit ID",
      "Reported °C",
      "Fault found",
      "Action taken",
      "Back in range?",
      "Engineer sign",
      "Chef sign",
    ]),
    h1("4. Logbook D — Pest Control Monitoring"),
    h2("Purpose"),
    p("Track pest sighting, preventative measures, and professional visits."),
    h2("Parameters"),
    bullet("Date of inspection, areas inspected, findings, corrective actions, technician signature."),
    makeLogTable(pestCols),
    new Paragraph({ spacing: { before: 160 }, children: [] }),
    makeLogTable(pestCols),
    h1("5. SOP 04 — Grease traps & facilities"),
    numbered("Grease traps cleaned and maintained weekly (or per manufacturer / municipal rule)."),
    numbered("Ensure handwash stations have running water; report failures immediately."),
    numbered("Repair fridge/freezer faults same day when out of BAFRA range; quarantine product with Kitchen."),
    h1("6. Engineering checklist"),
    checkItem("Latest water quality report on file and valid."),
    checkItem("Pest control visit completed per contract; log signed."),
    checkItem("Grease trap service recorded this week."),
    checkItem("No unresolved critical fridge/freezer faults."),
  ]);
  await save("07-Engineering-Maintenance-BAFRA-Compliance.docx", doc);
}

async function buildMasterIndex() {
  const doc = docShell("Master Index (All Departments)", [
    h1("Purpose of this manual set"),
    p(
      "This pack outlines SOPs, mandatory logbooks, and regulatory documents necessary for the hotel to comply with BAFRA standards for food safety, hygiene, and public health. Each department holds its own Word file for training, daily use, and inspection."
    ),
    h1("Department file map"),
    bullet("01 — Management / GM: licences, contracts, weekly audit checklist."),
    bullet("02 — Human Resources: medical fitness certificates and staff register."),
    bullet("03 — Stores & Receiving: receiving temperature log, FIFO, storage SOP."),
    bullet("04 — Kitchen / Food Production: SOPs 01–04, cold storage & cleaning logs."),
    bullet("05 — F&B Service (Restaurant / Café / Bar): hygiene, holding temps, outlet cleaning."),
    bullet("06 — Housekeeping: sanitation logs, waste, pest reporting."),
    bullet("07 — Engineering / Maintenance: water tests, pest visits, grease traps, equipment."),
    bullet("08 — Mandatory Records Pack (Clause 8.13): blank templates for all 13 minimum record types."),
    h1("Shared regulatory documents (where filed)"),
    boldLine("BAFRA Food Business Licence", "Management / GM office"),
    boldLine("Health / medical certificates", "HR register (+ copies for inspection)"),
    boldLine("Pest control agreement", "Management + Engineering"),
    boldLine("Water quality reports", "Engineering"),
    boldLine("Waste disposal clearance/records", "Management + Housekeeping"),
    h1("Mandatory logbooks — ownership"),
    boldLine("Receiving & Temperature Control", "Stores & Receiving"),
    boldLine("Cold Storage Temperature Log", "Kitchen (daily) / Engineering (faults)"),
    boldLine("Cleaning & Sanitization Log", "Kitchen, F&B Service, Housekeeping (by zone)"),
    boldLine("Pest Control Monitoring Log", "Engineering (+ contractor)"),
    h1("SOP ownership summary"),
    boldLine("SOP 01 Personal Hygiene", "Kitchen + F&B Service (HR enforces certificates)"),
    boldLine("SOP 02 Safe Storage & Inventory", "Stores + Kitchen"),
    boldLine("SOP 03 Preparation & Cooking", "Kitchen (+ F&B holding)"),
    boldLine("SOP 04 Cleaning, Sanitization & Waste", "Kitchen + HK + Engineering"),
    h1("BAFRA Clause 8.13 — Mandatory records (retain ≥ 1 year beyond shelf life)"),
    p(
      "Per BAFRA food business requirements, F&B must maintain processing, production and distribution records. Minimum record set and department owners:"
    ),
    boldLine("i) Incoming material checks", "03 Stores & Receiving"),
    boldLine("ii) Inspection and test", "04 Kitchen + 03 Stores"),
    boldLine("iii) Temperature and time", "04 Kitchen + 05 F&B Service + 03 Stores"),
    boldLine("iv) Product recall and traceability", "01 Management + 03 Stores + 04 Kitchen"),
    boldLine("v) Storage", "03 Stores + 04 Kitchen"),
    boldLine("vi) Cleaning and sanitation", "04 Kitchen + 05 F&B + 06 Housekeeping"),
    boldLine("vii) Pest control", "07 Engineering + 01 Management"),
    boldLine("viii) Medical and health status", "02 Human Resources"),
    boldLine("ix) Training", "02 HR + each HOD"),
    boldLine("x) Calibration of equipment", "07 Engineering"),
    boldLine("xi) Complaint and customer feedback", "01 Management / Front Office"),
    boldLine("xii) Corrective and preventive action", "01 Management (all departments)"),
    boldLine("xiii) Emergency preparedness plan", "01 Management"),
    h1("Clause 8.12(d) — Chemical control"),
    p(
      "Cleaning materials and hazardous chemicals must have restricted access for authorised personnel only. Owners: Housekeeping, Kitchen, Engineering — lock chemical stores; do not leave chemicals at open counters."
    ),
    h1("Inspection readiness"),
    p(
      "Before a BAFRA visit, GM runs the Management weekly checklist and confirms each department file and current month’s logbooks are complete and signed. Retain completed logs for at least one year beyond product shelf life."
    ),
  ]);
  await save("00-Master-Index-BAFRA-Department-Manuals.docx", doc);
}

async function buildRecordsPack() {
  const doc = docShell("Mandatory Records Pack (Clause 8.13)", [
    h1("1. Why this pack exists"),
    p(
      "BAFRA requires the food business to maintain appropriate records of processing, production and distribution and retain them for at least one year exceeding the shelf life of the product. This pack provides blank log templates mapped to each minimum process."
    ),
    h1("2. Record retention rule"),
    bullet("Retain each completed log for a minimum of 1 year beyond the shelf life of the related product/batch."),
    bullet("File by month; HOD signs weekly; GM samples monthly."),
    h1("3. i) Incoming material checks — Stores"),
    makeLogTable(receivingCols),
    h1("4. ii) Inspection and test — Kitchen / Stores"),
    makeLogTable([
      "Date",
      "Product / batch",
      "Check type",
      "Result",
      "Action",
      "Sign",
    ]),
    h1("5. iii) Temperature and time — Kitchen / F&B / Stores"),
    makeLogTable(coldStoreCols),
    new Paragraph({ spacing: { before: 120 }, children: [] }),
    makeLogTable([
      "Date",
      "Dish / batch",
      "Cook core °C",
      "Time reached",
      "Hot hold °C",
      "Cold hold °C",
      "Sign",
    ]),
    h1("6. iv) Product recall & traceability"),
    makeLogTable([
      "Date",
      "Product",
      "Batch / lot",
      "Supplier",
      "Qty",
      "Distributed to",
      "Recall action",
      "Sign",
    ]),
    h1("7. v) Storage checks"),
    makeLogTable([
      "Date",
      "Store area",
      "FIFO OK?",
      "Off floor?",
      "Segregation OK?",
      "Issues",
      "Sign",
    ]),
    h1("8. vi) Cleaning and sanitation"),
    makeLogTable(cleaningCols),
    h1("9. vii) Pest control"),
    makeLogTable(pestCols),
    h1("10. viii) Medical and health status — HR"),
    makeLogTable([
      "Staff name",
      "Dept",
      "Cert no.",
      "Issue",
      "Expiry",
      "Fit for food?",
      "HR sign",
    ]),
    h1("11. ix) Training record"),
    makeLogTable([
      "Date",
      "Topic (SOP/hygiene)",
      "Attendees",
      "Trainer",
      "Dept",
      "Sign-off",
    ]),
    h1("12. x) Calibration of equipment — Engineering"),
    makeLogTable([
      "Date",
      "Equipment",
      "ID",
      "Standard used",
      "Reading",
      "Pass/Fail",
      "Next due",
      "Sign",
    ]),
    h1("13. xi) Complaint & customer feedback"),
    makeLogTable([
      "Date",
      "Guest / source",
      "Complaint",
      "Product linked?",
      "Action",
      "Closed?",
      "Sign",
    ]),
    h1("14. xii) Corrective & preventive action (CAPA)"),
    makeLogTable([
      "Date",
      "Finding",
      "Root cause",
      "Corrective action",
      "Preventive",
      "Owner",
      "Due",
      "Closed",
    ]),
    h1("15. xiii) Emergency preparedness — plan reference"),
    bullet("Fire / evacuation — hotel emergency plan (Management)."),
    bullet("Foodborne illness incident — isolate product, notify GM, medical support, retain sample if advised."),
    bullet("Power failure affecting cold store — Engineering + Kitchen quarantine protocol."),
    bullet("Water contamination — stop food prep using unsafe water; use tested alternate supply."),
    makeLogTable([
      "Date of drill/incident",
      "Type",
      "Actions taken",
      "Lessons",
      "GM sign",
    ]),
  ]);
  await save("08-Mandatory-Records-Pack-Clause-8.13.docx", doc);
}

mkdirSync(OUT, { recursive: true });

await buildMasterIndex();
await buildManagement();
await buildHR();
await buildStores();
await buildKitchen();
await buildFnB();
await buildHousekeeping();
await buildEngineering();
await buildRecordsPack();

console.log("Done. Output folder:", OUT);
