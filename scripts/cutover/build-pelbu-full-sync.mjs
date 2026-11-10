/**
 * Build Pelbu Suites Olakha full sync payload + apply SQL.
 * Sources: Reservation 2026 xlsx, rate-public/agent HTML, salary-sheet-print.html.
 */
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { createRequire } from "module";
import { fileURLToPath } from "url";

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "../..");
const cutover = __dirname;

const XLSX_PATH =
  process.argv[2] || "C:/Users/rajiv/Downloads/Reservation 2026 (8).xlsx";

// Ensure extract exists
const extractPath = path.join(cutover, "_reservation-grid-extract.json");
{
  const { spawnSync } = await import("child_process");
  const r = spawnSync(
    process.execPath,
    [path.join(cutover, "extract-reservation-grid.mjs"), XLSX_PATH, extractPath],
    { encoding: "utf8" },
  );
  if (r.status !== 0) {
    console.error(r.stdout, r.stderr);
    process.exit(1);
  }
  console.log(r.stdout.trim());
}

const extract = JSON.parse(fs.readFileSync(extractPath, "utf8"));

function uuidFrom(seed) {
  const h = crypto.createHash("sha256").update(seed).digest();
  const b = Buffer.from(h.subarray(0, 16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const hex = b.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function datesBetween(checkIn, checkOut) {
  const out = [];
  let cur = checkIn;
  while (cur < checkOut) {
    out.push(cur);
    const [y, m, d] = cur.split("-").map(Number);
    cur = new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
  }
  return out;
}

function isPeak(ymd) {
  const m = Number(ymd.slice(5, 7));
  return (m >= 3 && m <= 5) || (m >= 9 && m <= 11);
}

const PROPERTY_SLUG = "pelbu-olakha";
const TYPE_MAP = {
  DTWIN: "deluxe_twin",
  DQUEEN: "deluxe_queen",
  DKING: "deluxe_king",
  SUITE: "suite",
  DELUXE: "deluxe_twin",
};

const hotel = {
  name: "Pelbu Suites Olakha",
  legalName: "Pelbu Suites Olakha",
  tagline: "Boutique stay · Olakha · Thimphu",
  formerly: "Formerly Seven Suites",
  addressLines: [
    "Next to Number 7 Building / Asha Bakery",
    "Olakha, Thimphu",
    "Kingdom of Bhutan",
  ],
  phone: "+975 1619 3410",
  email: "pelbusuites@gmail.com",
  website: "https://www.pelbusuites.bt",
  logoUrl:
    "https://res.cloudinary.com/hkkchsfy/image/upload/w_140,h_140,c_fit,f_png,q_auto/pelbu/brand/h2q193tfpc5qrgchfjj1",
  locality: "Thimphu",
  dzongkhag: "Thimphu",
  gstEnabled: false,
  scRate: 0.1,
};

/** Public EPAI all-in (incl 10% SC) from docs/rate-public.html */
const PUBLIC_EPAI = {
  deluxe: { peak: { double: 6500, single: 6100 }, off: { double: 5700, single: 5300 } },
  suite: { peak: { double: 15800, single: 14900 }, off: { double: 13800, single: 12900 } },
};

/** Agent CP package (incl 10% SC) from docs/rate-agent.html */
const AGENT_CP = {
  deluxe: { double: 3450, single: 3200 },
  suite: { double: 9300, single: 8400 },
};

const MEAL_ADDON = {
  EP: 0,
  CP: 500,
  MAP: 1200,
  AP: 1900,
};

const rooms = extract.rooms.map((r) => ({
  number: r.label,
  typeCode: TYPE_MAP[r.roomTypeCode] || "deluxe_twin",
  typeName: r.roomTypeName,
  floor: String(r.label)[0] || null,
}));

const agents = extract.agentCodes.map((a) => ({
  id: uuidFrom(`agent:${PROPERTY_SLUG}:${a.code}`),
  code: a.code,
  name: a.code,
}));

const bookings = extract.segments.map((seg, idx) => {
  const seed = `${PROPERTY_SLUG}|${seg.roomLabel}|${seg.checkIn}|${seg.checkOut}|${seg.agentCode}|${idx}`;
  const conf = `XLS-${uuidFrom(seed).replace(/-/g, "").slice(0, 20)}`;
  return {
    confirmationNo: conf,
    bookingId: uuidFrom(`bk:${seed}`),
    guestId: uuidFrom(`g:${seed}`),
    lineId: uuidFrom(`ln:${seed}`),
    folioId: uuidFrom(`fo:${seed}`),
    agencyFolioId: uuidFrom(`af:${seed}`),
    agentId: uuidFrom(`agent:${PROPERTY_SLUG}:${seg.agentCode}`),
    roomNumber: seg.roomLabel,
    agentCode: seg.agentCode,
    guestName: `${seg.agentCode} · Rm ${seg.roomLabel}`,
    checkIn: seg.checkIn,
    checkOut: seg.checkOut,
    status: seg.status,
    nights: datesBetween(seg.checkIn, seg.checkOut),
  };
});

/** Staff from scripts/generate-salary-sheet.mjs / docs/salary-sheet-print.html */
const staffRows = [
  { name: "Dawa Yonzon", dept: "Management", role: "Owner / GM", deskRole: "owner", basic: 40000, canLogin: false, emp: "MGMT-01", cid: "10304001752" },
  { name: "Tshering Lhamo", dept: "Management", role: "Management", deskRole: "gm", basic: 25000, canLogin: false, emp: "MGMT-02" },
  { name: "Rajiv Pradhan", dept: "Management", role: "Management", deskRole: "owner", basic: 25000, canLogin: false, emp: "MGMT-03" },
  { name: "Choki Wangmo", dept: "Sales", role: "Reservation, Sales & Marketing Manager", deskRole: "fo", basic: 20000, canLogin: true, emp: "SAL-01", bank: "BoB 201380437" },
  { name: "Meg Raj", dept: "Front office", role: "Front Office Agent", deskRole: "gm", basic: 12000, canLogin: true, emp: "MGR-01", bank: "BNB 651619841" },
  { name: "Rigzang", dept: "Front office", role: "Front Office Agent", deskRole: "fo", basic: 12000, canLogin: true, emp: "FO-02", bank: "BNB 652395097" },
  { name: "Mohan", dept: "Front office", role: "Front Office Agent", deskRole: "gm", basic: 12000, canLogin: true, emp: "MGR-02", bank: "BoB 205710917" },
  { name: "Dorji Wangmo", dept: "Housekeeping", role: "House Keeping Attendant", deskRole: "hk", basic: 13500, canLogin: false, emp: "HK-01", cid: "11506003323", bank: "BoB 202267830" },
  { name: "Renuka Gurung", dept: "Housekeeping", role: "House Keeping Attendant", deskRole: "hk", basic: 13500, canLogin: false, emp: "HK-02", cid: "11201005790", bank: "BNB 652238188" },
  { name: "Sherab Chezom", dept: "Housekeeping", role: "House Keeping Attendant", deskRole: "hk", basic: 13000, canLogin: false, emp: "HK-03", cid: "11514003118", bank: "BoB 209606390" },
  { name: "Lobzang Dema", dept: "Housekeeping", role: "House Keeping Attendant", deskRole: "hk", basic: 13000, canLogin: false, emp: "HK-04", cid: "11607003029", bank: "BNB 650295381" },
  { name: "Geeta", dept: "Housekeeping", role: "House Keeping Attendant", deskRole: "hk", basic: 12000, canLogin: false, emp: "HK-05", bank: "BoB 205764758" },
  { name: "Rinchen", dept: "Housekeeping", role: "House Keeping Attendant", deskRole: "hk", basic: 12000, canLogin: false, emp: "HK-06", bank: "BoB 202831935" },
  { name: "Damber Kumari Ghalley", dept: "F&B", role: "F&B Attendant", deskRole: "fnb", basic: 12000, canLogin: false, emp: "FB-01", bank: "BoB 209061637" },
  { name: "Sushma Rai", dept: "F&B", role: "F&B Attendant", deskRole: "fnb", basic: 12000, canLogin: false, emp: "FB-02", bank: "BoB 207353394" },
  { name: "Krishna", dept: "F&B", role: "F&B Attendant", deskRole: "fnb", basic: 12000, canLogin: false, emp: "FB-03", bank: "BoB 203488951" },
  { name: "Bhanu", dept: "F&B", role: "F&B Attendant", deskRole: "fnb", basic: 12000, canLogin: false, emp: "FB-04", bank: "BoB 17306833" },
  { name: "Khem", dept: "Kitchen", role: "Kitchen Assistant", deskRole: "kitchen", basic: 15000, canLogin: false, emp: "KIT-01", bank: "BoB 130035256" },
  { name: "Gedhan", dept: "Kitchen", role: "Cook", deskRole: "kitchen", basic: 12000, canLogin: false, emp: "KIT-02", bank: "BoB 212079720" },
].map((s) => ({
  ...s,
  id: uuidFrom(`staff:${PROPERTY_SLUG}:${s.emp}`),
  tipPoints: s.dept === "Management" ? 3 : s.dept === "Front office" ? 2 : 1.5,
}));

const salarySlips = staffRows.map((s) => {
  const basic = s.basic;
  const nppfEmp = Math.round(basic * 0.05);
  const gis = Math.round(basic * 0.01);
  const advance = s.name === "Meg Raj" ? 1000 : 0;
  const net = basic - nppfEmp - gis - advance;
  return {
    id: uuidFrom(`sal:${PROPERTY_SLUG}:2026-10:${s.emp}`),
    staffId: s.id,
    periodYm: "2026-10",
    basicBtn: basic,
    allowancesBtn: 0,
    tipShareBtn: 0,
    nppfEmployeeBtn: nppfEmp,
    gisBtn: gis,
    citBtn: advance,
    netPayBtn: net,
    status: "final",
  };
});

/** Rate plans + nightly cells for 2026 (double occupancy EPAI public / CP agent). */
const ratePlans = [
  { id: uuidFrom(`rp:${PROPERTY_SLUG}:PUB-EP`), code: "PUB-EP", name: "Public EPAI", mealPlan: "EP" },
  { id: uuidFrom(`rp:${PROPERTY_SLUG}:PUB-CP`), code: "PUB-CP", name: "Public CPAI", mealPlan: "CP" },
  { id: uuidFrom(`rp:${PROPERTY_SLUG}:PUB-MAP`), code: "PUB-MAP", name: "Public MAPAI", mealPlan: "MAP" },
  { id: uuidFrom(`rp:${PROPERTY_SLUG}:PUB-AP`), code: "PUB-AP", name: "Public APAI", mealPlan: "AP" },
  { id: uuidFrom(`rp:${PROPERTY_SLUG}:AGT-CP`), code: "AGT-CP", name: "Agent CP", mealPlan: "CP" },
  { id: uuidFrom(`rp:${PROPERTY_SLUG}:AGT-MAP`), code: "AGT-MAP", name: "Agent MAP", mealPlan: "MAP" },
];

const typeCodes = ["deluxe_twin", "deluxe_queen", "deluxe_king", "suite"];
const rateRows = [];
for (let day = 0; day < 365; day++) {
  const ymd = new Date(Date.UTC(2026, 0, 1 + day)).toISOString().slice(0, 10);
  const peak = isPeak(ymd);
  for (const tc of typeCodes) {
    const card = tc === "suite" ? "suite" : "deluxe";
    const pub = PUBLIC_EPAI[card][peak ? "peak" : "off"].double;
    const ag = AGENT_CP[card].double;
    const occ = 2;
    for (const plan of ["EP", "CP", "MAP", "AP"]) {
      const rp = ratePlans.find((p) => p.code === `PUB-${plan}`);
      rateRows.push({
        id: uuidFrom(`rate:${PROPERTY_SLUG}:${rp.code}:${tc}:${ymd}`),
        ratePlanCode: rp.code,
        roomTypeCode: tc,
        stayDate: ymd,
        netAmount: pub + MEAL_ADDON[plan] * occ,
      });
    }
    rateRows.push({
      id: uuidFrom(`rate:${PROPERTY_SLUG}:AGT-CP:${tc}:${ymd}`),
      ratePlanCode: "AGT-CP",
      roomTypeCode: tc,
      stayDate: ymd,
      netAmount: ag,
    });
    // Agent MAP from HTML: deluxe double 5600, suite 10600
    rateRows.push({
      id: uuidFrom(`rate:${PROPERTY_SLUG}:AGT-MAP:${tc}:${ymd}`),
      ratePlanCode: "AGT-MAP",
      roomTypeCode: tc,
      stayDate: ymd,
      netAmount: tc === "suite" ? 10600 : 5600,
    });
  }
}

const payload = {
  propertySlug: PROPERTY_SLUG,
  hotel,
  rooms,
  agents,
  bookings,
  staff: staffRows,
  salarySlips,
  ratePlans,
  rates: rateRows,
};

const payloadPath = path.join(cutover, "_pelbu-full-payload.json");
fs.writeFileSync(payloadPath, JSON.stringify(payload));

const sqlPath = path.join(cutover, "_pelbu-full-apply.sql");
const sql = `-- Pelbu Suites Olakha full sync (wipe dummy + real data)
-- payload: /var/lib/postgresql/data/pelbu_full_payload.json
BEGIN;

DO $$
DECLARE
  pid uuid;
  doc jsonb;
  r jsonb;
  a jsonb;
  b jsonb;
  s jsonb;
  sal jsonb;
  rp jsonb;
  rt jsonb;
  d text;
  rt_id uuid;
  room_id uuid;
  plan_id uuid;
  asg_id uuid;
  rooms_n int;
  bk_n int;
  inhouse int;
  staff_n int;
  rate_n int;
BEGIN
  SELECT id INTO pid FROM v2.properties WHERE slug = '${PROPERTY_SLUG}';
  IF pid IS NULL THEN RAISE EXCEPTION 'missing ${PROPERTY_SLUG}'; END IF;

  SELECT p.doc INTO doc FROM v2._sync_payload p LIMIT 1;
  IF doc IS NULL THEN RAISE EXCEPTION 'missing v2._sync_payload row'; END IF;

  -- Hotel fiscal flags from rate sheet (GST not charged yet)
  UPDATE v2.properties
  SET name = doc->'hotel'->>'name',
      gst_enabled = false,
      sc_rate = 0.10,
      gst_rate = 0,
      version = version + 1
  WHERE id = pid;

  ------------------------------------------------------------------
  -- WIPE dummy FO / seed data for this property only
  ------------------------------------------------------------------
  DELETE FROM v2.room_assignments WHERE property_id = pid;
  DELETE FROM v2.room_blocks WHERE property_id = pid;
  DELETE FROM v2.folio_lines WHERE property_id = pid;
  DELETE FROM v2.payments WHERE property_id = pid;
  DELETE FROM v2.folios WHERE property_id = pid;
  DELETE FROM v2.booking_lines WHERE property_id = pid;
  DELETE FROM v2.bookings WHERE property_id = pid;
  DELETE FROM v2.rates WHERE property_id = pid;
  DELETE FROM v2.rate_plans WHERE property_id = pid;
  DELETE FROM v2.salary_slips WHERE property_id = pid;
  DELETE FROM v2.sc_tip_pool_lines WHERE property_id = pid;
  DELETE FROM v2.sc_tip_pool_runs WHERE property_id = pid;
  DELETE FROM v2.hk_tasks WHERE property_id = pid;
  DELETE FROM v2.groups WHERE property_id = pid;
  DELETE FROM v2.guests WHERE property_id = pid;
  DELETE FROM v2.agents WHERE property_id = pid;
  -- keep rooms/types until we rebuild; remove non-Excel rooms
  DELETE FROM v2.rooms
  WHERE property_id = pid
    AND number NOT IN (
      SELECT jsonb_array_elements(doc->'rooms')->>'number'
    );

  ------------------------------------------------------------------
  -- Rooms (27 guest)
  ------------------------------------------------------------------
  FOR r IN SELECT * FROM jsonb_array_elements(doc->'rooms')
  LOOP
    INSERT INTO v2.room_types (id, property_id, code, name, base_occupancy, version)
    SELECT gen_random_uuid(), pid, r->>'typeCode', r->>'typeName', 2, 1
    WHERE NOT EXISTS (
      SELECT 1 FROM v2.room_types t WHERE t.property_id = pid AND t.code = r->>'typeCode'
    );

    SELECT id INTO rt_id FROM v2.room_types
    WHERE property_id = pid AND code = r->>'typeCode' LIMIT 1;

    INSERT INTO v2.rooms (id, property_id, room_type_id, number, floor, hk_status, version)
    SELECT gen_random_uuid(), pid, rt_id, r->>'number', r->>'floor', 'clean', 1
    WHERE NOT EXISTS (
      SELECT 1 FROM v2.rooms x WHERE x.property_id = pid AND x.number = r->>'number'
    );

    UPDATE v2.rooms x
    SET room_type_id = rt_id,
        floor = COALESCE(r->>'floor', x.floor),
        version = x.version + 1
    WHERE x.property_id = pid AND x.number = r->>'number';
  END LOOP;

  -- drop leftover guide/driver/types without rooms
  DELETE FROM v2.room_types t
  WHERE t.property_id = pid
    AND NOT EXISTS (SELECT 1 FROM v2.rooms r WHERE r.room_type_id = t.id);

  ------------------------------------------------------------------
  -- Agents (Excel codes as-is)
  ------------------------------------------------------------------
  FOR a IN SELECT * FROM jsonb_array_elements(doc->'agents')
  LOOP
    INSERT INTO v2.agents (id, property_id, name, code, credit_limit, credit_hold, version)
    VALUES ((a->>'id')::uuid, pid, a->>'name', a->>'code', 0, false, 1)
    ON CONFLICT (property_id, code) DO UPDATE
      SET name = EXCLUDED.name, version = v2.agents.version + 1;
  END LOOP;

  ------------------------------------------------------------------
  -- Staff + October salary slips
  ------------------------------------------------------------------
  DELETE FROM v2.staff WHERE property_id = pid;
  FOR s IN SELECT * FROM jsonb_array_elements(doc->'staff')
  LOOP
    INSERT INTO v2.staff (
      id, property_id, display_name, role, employee_code, tip_points,
      active, can_login, desk_role, home_route, pin_reset_required, version
    ) VALUES (
      (s->>'id')::uuid,
      pid,
      s->>'name',
      COALESCE(s->>'role', s->>'dept'),
      s->>'emp',
      COALESCE((s->>'tipPoints')::numeric, 1.5),
      true,
      COALESCE((s->>'canLogin')::boolean, false),
      s->>'deskRole',
      CASE WHEN (s->>'deskRole') IN ('owner','gm') THEN '/owner' ELSE '/desk' END,
      true,
      1
    );
  END LOOP;

  FOR sal IN SELECT * FROM jsonb_array_elements(doc->'salarySlips')
  LOOP
    INSERT INTO v2.salary_slips (
      id, property_id, staff_id, period_ym, basic_btn, allowances_btn, tip_share_btn,
      nppf_employee_btn, gis_btn, cit_btn, net_pay_btn, status, created_at
    ) VALUES (
      (sal->>'id')::uuid,
      pid,
      (sal->>'staffId')::uuid,
      sal->>'periodYm',
      (sal->>'basicBtn')::numeric,
      (sal->>'allowancesBtn')::numeric,
      (sal->>'tipShareBtn')::numeric,
      (sal->>'nppfEmployeeBtn')::numeric,
      (sal->>'gisBtn')::numeric,
      (sal->>'citBtn')::numeric,
      (sal->>'netPayBtn')::numeric,
      sal->>'status',
      now()
    );
  END LOOP;

  ------------------------------------------------------------------
  -- Rate plans + 2026 nightly rates
  ------------------------------------------------------------------
  FOR rp IN SELECT * FROM jsonb_array_elements(doc->'ratePlans')
  LOOP
    INSERT INTO v2.rate_plans (id, property_id, code, name, currency, meal_plan, version)
    VALUES (
      (rp->>'id')::uuid, pid, rp->>'code', rp->>'name', 'BTN', rp->>'mealPlan', 1
    );
  END LOOP;

  FOR rt IN SELECT * FROM jsonb_array_elements(doc->'rates')
  LOOP
    SELECT id INTO plan_id FROM v2.rate_plans
    WHERE property_id = pid AND code = rt->>'ratePlanCode' LIMIT 1;
    SELECT id INTO rt_id FROM v2.room_types
    WHERE property_id = pid AND code = rt->>'roomTypeCode' LIMIT 1;
    IF plan_id IS NULL OR rt_id IS NULL THEN CONTINUE; END IF;

    INSERT INTO v2.rates (
      id, property_id, rate_plan_id, room_type_id, stay_date, net_amount, version
    ) VALUES (
      (rt->>'id')::uuid, pid, plan_id, rt_id, (rt->>'stayDate')::date,
      (rt->>'netAmount')::numeric, 1
    )
    ON CONFLICT DO NOTHING;
  END LOOP;

  ------------------------------------------------------------------
  -- Bookings from Excel grid
  ------------------------------------------------------------------
  FOR b IN SELECT * FROM jsonb_array_elements(doc->'bookings')
  LOOP
    SELECT id, room_type_id INTO room_id, rt_id FROM v2.rooms
    WHERE property_id = pid AND number = b->>'roomNumber' LIMIT 1;
    IF room_id IS NULL THEN RAISE EXCEPTION 'missing room %', b->>'roomNumber'; END IF;

    INSERT INTO v2.guests (id, property_id, full_name, version)
    VALUES ((b->>'guestId')::uuid, pid, b->>'guestName', 1)
    ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name;

    INSERT INTO v2.bookings (
      id, property_id, confirmation_no, status, guest_id, agent_id,
      check_in, check_out, source, notes, version, created_at
    ) VALUES (
      (b->>'bookingId')::uuid, pid, b->>'confirmationNo', b->>'status',
      (b->>'guestId')::uuid, (b->>'agentId')::uuid,
      (b->>'checkIn')::date, (b->>'checkOut')::date,
      'xlsx_grid',
      'Imported from Reservation 2026 xlsx · agent ' || (b->>'agentCode'),
      1, now()
    );

    INSERT INTO v2.booking_lines (id, property_id, booking_id, room_type_id, meal_plan, version)
    VALUES ((b->>'lineId')::uuid, pid, (b->>'bookingId')::uuid, rt_id, 'EP', 1);

    INSERT INTO v2.folios (id, property_id, booking_id, payer_type, guest_id, status, version)
    VALUES ((b->>'folioId')::uuid, pid, (b->>'bookingId')::uuid, 'guest', (b->>'guestId')::uuid, 'open', 1);

    INSERT INTO v2.folios (id, property_id, booking_id, payer_type, agent_id, status, version)
    VALUES ((b->>'agencyFolioId')::uuid, pid, (b->>'bookingId')::uuid, 'agent', (b->>'agentId')::uuid, 'open', 1);

    FOR d IN SELECT jsonb_array_elements_text(b->'nights')
    LOOP
      asg_id := (
        substr(md5(pid::text || (b->>'lineId') || d), 1, 8) || '-' ||
        substr(md5(pid::text || (b->>'lineId') || d), 9, 4) || '-' ||
        '4' || substr(md5(pid::text || (b->>'lineId') || d), 13, 3) || '-' ||
        'a' || substr(md5(pid::text || (b->>'lineId') || d), 17, 3) || '-' ||
        substr(md5(pid::text || (b->>'lineId') || d), 21, 12)
      )::uuid;
      INSERT INTO v2.room_assignments (
        id, property_id, booking_line_id, room_id, stay_date, active, version
      ) VALUES (asg_id, pid, (b->>'lineId')::uuid, room_id, d::date, true, 1);
    END LOOP;
  END LOOP;

  SELECT count(*) INTO rooms_n FROM v2.rooms WHERE property_id = pid;
  SELECT count(*) INTO bk_n FROM v2.bookings WHERE property_id = pid;
  SELECT count(*) INTO inhouse FROM v2.bookings WHERE property_id = pid AND status = 'checked_in';
  SELECT count(*) INTO staff_n FROM v2.staff WHERE property_id = pid;
  SELECT count(*) INTO rate_n FROM v2.rates WHERE property_id = pid;

  RAISE NOTICE 'SYNC OK rooms=% bookings=% inhouse=% staff=% rates=%', rooms_n, bk_n, inhouse, staff_n, rate_n;
  IF rooms_n <> 27 THEN RAISE EXCEPTION 'expected 27 rooms, got %', rooms_n; END IF;
END $$;

COMMIT;
`;

fs.writeFileSync(sqlPath, sql);

// Update desk brand + settings defaults (no Pelbu dummy placeholders)
const brandPath = path.join(root, "v2/apps/desk/src/lib/property-brand.ts");
let brand = fs.readFileSync(brandPath, "utf8");
brand = brand.replace(
  /export const DEFAULT_PROPERTY_BRAND: PropertyBrand = \{[\s\S]*?\};/,
  `export const DEFAULT_PROPERTY_BRAND: PropertyBrand = {
  propertyId: "pelbu-olakha",
  name: "Pelbu Suites",
  legalName: "Pelbu Suites Olakha",
  tagline: "Boutique stay · Olakha · Thimphu",
  addressLines: [
    "Next to Number 7 Building / Asha Bakery",
    "Olakha, Thimphu",
    "Kingdom of Bhutan",
  ],
  phone: "+975 1619 3410",
  email: "pelbusuites@gmail.com",
  website: "https://www.pelbusuites.bt",
  logoUrl:
    "https://res.cloudinary.com/hkkchsfy/image/upload/w_140,h_140,c_fit,f_png,q_auto/pelbu/brand/h2q193tfpc5qrgchfjj1",
  locality: "Thimphu",
};`,
);
fs.writeFileSync(brandPath, brand);

const settingsPath = path.join(root, "v2/apps/desk/src/lib/settings-store.ts");
let settings = fs.readFileSync(settingsPath, "utf8");
settings = settings
  .replace(/hotelName: "Demo Hotel"/, 'hotelName: "Pelbu Suites Olakha"')
  .replace(/dzongkhag: "Paro"/, 'dzongkhag: "Thimphu"')
  .replace(/tpn: "BTN-TPN-104829"/, 'tpn: ""')
  .replace(/tradeLicense: "TL-PARO-2218"/, 'tradeLicense: ""')
  .replace(/hotelInitial: "DH"/, 'hotelInitial: "PS"')
  .replace(/psbnPrefix: "DHPSBN"/, 'psbnPrefix: "PSPSBN"')
  .replace(/invPrefix: "DHINV"/, 'invPrefix: "PSINV"')
  .replace(/mbobMerchantId: "mBoB-DEMO-8821"/, 'mbobMerchantId: ""')
  .replace(/mbobQrNote: "RMA QR uploaded · demo merchant"/, 'mbobQrNote: ""')
  .replace(/bnbAccountName: "Demo Hotel Pvt Ltd"/, 'bnbAccountName: "Pelbu Suites Olakha"')
  .replace(/bnbAccountNo: "1009123456"/, 'bnbAccountNo: ""')
  .replace(/bstEnabled: true/, "bstEnabled: false");
fs.writeFileSync(settingsPath, settings);

console.log(
  JSON.stringify(
    {
      payloadPath,
      sqlPath,
      rooms: rooms.length,
      agents: agents.length,
      bookings: bookings.length,
      staff: staffRows.length,
      salarySlips: salarySlips.length,
      ratePlans: ratePlans.length,
      rates: rateRows.length,
      payloadMB: +(fs.statSync(payloadPath).size / 1024 / 1024).toFixed(2),
    },
    null,
    2,
  ),
);
