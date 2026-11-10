/**
 * Resync Pelbu FO from Reservation 2026 rack:
 * - all stays from Aug 2026 onward
 * - multi-room parties → shared v2.groups
 * - meal plan / guest / agent / notes from cell comments
 * - agency folio room charges from quoted totals or rate card
 */
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";
import { parseRack } from "../../v1/web/scripts/lib/pelbu-olakha-rack.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const XLSX_PATH =
  process.argv[2] || "C:/Users/rajiv/Downloads/Reservation 2026 (8).xlsx";
const PROPERTY_SLUG = "pelbu-olakha";
const TODAY = new Date().toISOString().slice(0, 10);
const FROM = "2026-08-01";

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

function addDays(ymd, n) {
  const [Y, M, D] = ymd.split("-").map(Number);
  return new Date(Date.UTC(Y, M - 1, D + n)).toISOString().slice(0, 10);
}

/** Desk meal codes: EP | CP | MAP | AP (BB/CPAI → CP). */
function mealFromNotes(raw, fallback = "EP") {
  const text = String(raw || "");
  const labeled =
    text.match(/meal\s*plans?\s*[:：]\s*([^\n]+)/i)?.[1] ||
    text.match(/\bmeal\s*[:：]\s*([^\n]+)/i)?.[1] ||
    "";
  const blob = `${labeled}\n${text}`;
  const written = (
    blob.match(/\b(EPAI|MAPAI|CPAI|APAI|MAP|CP|EP|BB|AP)\b/i)?.[1] || ""
  ).toUpperCase();
  if (written === "EPAI" || written === "EP") return "EP";
  if (written === "MAPAI" || written === "MAP") return "MAP";
  if (written === "CPAI" || written === "CP" || written === "BB") return "CP";
  if (written === "APAI" || written === "AP") return "AP";
  const fb = String(fallback || "EP").toUpperCase();
  if (fb === "BB") return "CP";
  if (["EP", "CP", "MAP", "AP"].includes(fb)) return fb;
  return "EP";
}

function guestLabel(stay) {
  let g = String(stay.guest_name || "").trim();
  const raw = stay.raw_comment || "";
  if (!g || /^guest\b/i.test(g) || /^c\/?in\b/i.test(g) || /^check\s*in\b/i.test(g)) {
    g =
      raw.match(/group\s*names?\s*[:：]\s*([^\n]+)/i)?.[1]?.trim() ||
      raw.match(/guest\s*names?\s*[:：]\s*([^\n]+)/i)?.[1]?.trim() ||
      raw.match(/(?:^|\n)\s*((?:mr|ms|mrs|miss)\.?\s+[^\n]+)/i)?.[1]?.trim() ||
      stay.agent_name ||
      stay.agent_code ||
      "Guest";
  }
  g = g.replace(/\s*x\s*\d+\s*pax\b/i, "").trim();
  return g.slice(0, 200);
}

function groupName(stay, doors) {
  const raw = stay.raw_comment || "";
  const named =
    raw.match(/group\s*names?\s*[:：]\s*([^\n]+)/i)?.[1]?.trim() ||
    (stay.guest_name && !/^guest\b/i.test(stay.guest_name) && !/^c\/?in\b/i.test(stay.guest_name)
      ? stay.guest_name
      : "");
  const agent = stay.agent_name || stay.agent_code;
  if (named) return `${named} · ${agent}`.slice(0, 180);
  if (doors.length > 1) return `${agent} · ${doors.length} rooms · ${stay.check_in}`.slice(0, 180);
  return null;
}

function mapStatus(stay) {
  const s = String(stay.status || "").toLowerCase();
  if (s === "cancelled" || s === "cancel") return "cancelled";
  if (s === "held" || s === "hold") return "held";
  if (s === "checked_in" || s === "in_house") return "checked_in";
  if (s === "checked_out" || s === "departed") return "checked_out";
  if (s === "no_show") return "no_show";
  const ci = stay.check_in;
  const co = stay.check_out;
  if (co <= TODAY) return "checked_out";
  if (ci <= TODAY && co > TODAY) return "checked_in";
  return "confirmed";
}

function notesFor(stay) {
  const bits = [];
  if (stay.raw_comment?.trim()) bits.push(stay.raw_comment.trim());
  else bits.push(`Agent ${stay.agent_code}`);
  if (stay.guide_name)
    bits.push(
      `Guide: ${stay.guide_name}${stay.guide_phone ? ` · ${stay.guide_phone}` : ""}`,
    );
  if (stay.diet) bits.push(`Diet: ${stay.diet}`);
  if (stay.eta) bits.push(`ETA: ${stay.eta}`);
  if (stay.payment_note) bits.push(stay.payment_note);
  if (stay.quoted_total_btn) bits.push(`Quoted total Nu ${stay.quoted_total_btn}`);
  bits.push(`Imported from Reservation 2026 xlsx · agent ${stay.agent_code}`);
  return bits.join("\n\n").slice(0, 4000);
}

/** All-in (incl 10% SC) → net + sc. GST off. */
function splitInclusive(total) {
  const t = Math.round(Number(total) * 100) / 100;
  if (!Number.isFinite(t) || t <= 0) return null;
  const net = Math.round((t / 1.1) * 100) / 100;
  const sc = Math.round((t - net) * 100) / 100;
  return { net, sc, total: t };
}

/** Rate-card fallback nightly all-in (agent) when comment has no total. */
function cardNightlyAllIn(meal, isSuite) {
  const m = meal || "EP";
  if (isSuite) {
    if (m === "MAP" || m === "AP") return 10600;
    if (m === "CP") return 9300;
    return 8400;
  }
  if (m === "MAP") return 5600;
  if (m === "AP") return 6300;
  if (m === "CP") return 3450;
  return 3200;
}

function sqlStr(s) {
  return `'${String(s ?? "").replace(/'/g, "''")}'`;
}

const parsed = parseRack(XLSX_PATH, TODAY);
const stays = parsed.stays.filter(
  (s) => s.check_in && s.check_out && s.check_out > FROM && s.check_in >= "2026-08-01",
);

const agentBest = new Map();
for (const stay of stays) {
  const code = String(stay.agent_code || "").toUpperCase();
  if (!code) continue;
  const name = (stay.agent_name || "").trim();
  const prev = agentBest.get(code) || { code, name: code, hits: 0 };
  if (name && name !== code) {
    prev.name = name;
    prev.hits += 1;
  }
  agentBest.set(code, prev);
}

const agents = [...agentBest.values()].map((a) => ({
  id: uuidFrom(`agent:${PROPERTY_SLUG}:${a.code}`),
  code: a.code,
  name: a.name || a.code,
}));

const groups = [];
const bookings = [];
let multiRoomGroups = 0;

for (const stay of stays) {
  const doors = (stay.doors?.length ? stay.doors : stay.doorHint ? [stay.doorHint] : [])
    .map(String)
    .sort();
  if (!doors.length) continue;

  const agentCode = String(stay.agent_code || "").toUpperCase();
  const agentId = uuidFrom(`agent:${PROPERTY_SLUG}:${agentCode}`);
  const meal = mealFromNotes(stay.raw_comment, stay.meal_plan_code);
  const guest = guestLabel(stay);
  const nationality = (stay.nationality || "").slice(0, 80);
  const notes = notesFor(stay);
  const status = mapStatus(stay);
  const gName = groupName(stay, doors);

  let groupId = null;
  if (doors.length > 1 || gName) {
    const gSeed = `grp:${PROPERTY_SLUG}:${agentCode}:${stay.check_in}:${stay.check_out}:${doors.join(",")}`;
    groupId = uuidFrom(gSeed);
    groups.push({
      id: groupId,
      name: gName || `${stay.agent_name || agentCode} · ${doors.length} rm`,
      agentId,
    });
    if (doors.length > 1) multiRoomGroups += 1;
  }

  const quote = Number(stay.quoted_total_btn) || 0;
  const perRoomQuote = quote > 0 ? quote / doors.length : 0;

  for (const door of doors) {
    const nightSet =
      stay.doorNights instanceof Map && stay.doorNights.get(door)
        ? stay.doorNights.get(door)
        : new Set(stay.nights || []);
    let nights = [...nightSet].sort();
    if (!nights.length && stay.check_in && stay.check_out) {
      nights = datesBetween(stay.check_in, stay.check_out);
    }
    if (!nights.length) continue;
    const checkIn = nights[0];
    const checkOut = addDays(nights[nights.length - 1], 1);
    const seed = `${PROPERTY_SLUG}|rack|${door}|${checkIn}|${checkOut}|${agentCode}`;
    const isSuite = Number(door) >= 500;
    let roomTotal = perRoomQuote;
    if (!(roomTotal > 0)) {
      roomTotal = cardNightlyAllIn(meal, isSuite) * nights.length;
    }
    const money = splitInclusive(roomTotal);
    const nightlyNet = money
      ? Math.round((money.net / nights.length) * 100) / 100
      : null;

    bookings.push({
      confirmationNo: `XLS-${uuidFrom(seed).replace(/-/g, "").slice(0, 20)}`,
      bookingId: uuidFrom(`bk:${seed}`),
      guestId: uuidFrom(`g:${seed}`),
      lineId: uuidFrom(`ln:${seed}`),
      folioId: uuidFrom(`fo:${seed}`),
      agencyFolioId: uuidFrom(`af:${seed}`),
      chargeId: uuidFrom(`ch:${seed}`),
      agentId,
      agentCode,
      groupId,
      roomNumber: door,
      guestName: guest,
      nationality,
      checkIn,
      checkOut,
      status,
      mealPlan: meal,
      notes,
      nights,
      netAmount: nightlyNet,
      chargeNet: money?.net ?? null,
      chargeSc: money?.sc ?? null,
      chargeTotal: money?.total ?? null,
    });
  }
}

const payload = {
  generatedAt: new Date().toISOString(),
  propertySlug: PROPERTY_SLUG,
  from: FROM,
  today: TODAY,
  agents,
  groups,
  bookings,
  stats: {
    rackStays: stays.length,
    bookings: bookings.length,
    groups: groups.length,
    multiRoomGroups,
    withMeal: bookings.filter((b) => b.mealPlan !== "EP").length,
    withCharge: bookings.filter((b) => b.chargeTotal > 0).length,
    byStatus: bookings.reduce((a, b) => {
      a[b.status] = (a[b.status] || 0) + 1;
      return a;
    }, {}),
  },
};

const payloadPath = path.join(__dirname, "_pelbu-rack-resync-payload.json");
fs.writeFileSync(payloadPath, JSON.stringify(payload));

const agentsJson = JSON.stringify(agents).replace(/'/g, "''");
const groupsJson = JSON.stringify(groups).replace(/'/g, "''");
const bookingsJson = JSON.stringify(bookings).replace(/'/g, "''");

const sql = `-- Pelbu rack resync (groups + meals + notes + rates) from ${FROM}
BEGIN;

CREATE TEMP TABLE _rack_payload (
  agents jsonb, groups jsonb, bookings jsonb
) ON COMMIT DROP;

INSERT INTO _rack_payload VALUES (
  '${agentsJson}'::jsonb,
  '${groupsJson}'::jsonb,
  '${bookingsJson}'::jsonb
);

DO $$
DECLARE
  pid uuid;
  a jsonb;
  g jsonb;
  b jsonb;
  d text;
  room_id uuid;
  rt_id uuid;
  asg_id uuid;
  rooms_n int;
  bk_n int;
  grp_n int;
  inhouse int;
  meal_n int;
BEGIN
  SELECT id INTO pid FROM v2.properties WHERE slug = '${PROPERTY_SLUG}';
  IF pid IS NULL THEN RAISE EXCEPTION 'missing ${PROPERTY_SLUG}'; END IF;

  UPDATE v2.properties
  SET current_business_date = '${TODAY}'::date,
      gst_enabled = false,
      sc_rate = 0.10,
      gst_rate = 0,
      version = version + 1
  WHERE id = pid;

  ------------------------------------------------------------------
  -- Wipe FO only (keep rooms / staff / rate catalog)
  ------------------------------------------------------------------
  DELETE FROM v2.room_assignments WHERE property_id = pid;
  DELETE FROM v2.room_blocks WHERE property_id = pid;
  DELETE FROM v2.folio_lines WHERE property_id = pid;
  DELETE FROM v2.payments WHERE property_id = pid;
  DELETE FROM v2.folios WHERE property_id = pid;
  DELETE FROM v2.booking_lines WHERE property_id = pid;
  DELETE FROM v2.bookings WHERE property_id = pid;
  DELETE FROM v2.groups WHERE property_id = pid;
  DELETE FROM v2.guests WHERE property_id = pid;

  ------------------------------------------------------------------
  -- Agents (proper names from sheet comments)
  ------------------------------------------------------------------
  FOR a IN SELECT * FROM jsonb_array_elements((SELECT agents FROM _rack_payload))
  LOOP
    INSERT INTO v2.agents (id, property_id, name, code, credit_limit, credit_hold, version)
    VALUES ((a->>'id')::uuid, pid, a->>'name', a->>'code', 0, false, 1)
    ON CONFLICT (property_id, code) DO UPDATE
      SET name = EXCLUDED.name, version = v2.agents.version + 1;
  END LOOP;

  ------------------------------------------------------------------
  -- Groups (multi-room / named parties)
  ------------------------------------------------------------------
  FOR g IN SELECT * FROM jsonb_array_elements((SELECT groups FROM _rack_payload))
  LOOP
    INSERT INTO v2.groups (id, property_id, name, agent_id, version)
    VALUES ((g->>'id')::uuid, pid, g->>'name', (g->>'agentId')::uuid, 1);
  END LOOP;

  ------------------------------------------------------------------
  -- Bookings
  ------------------------------------------------------------------
  FOR b IN SELECT * FROM jsonb_array_elements((SELECT bookings FROM _rack_payload))
  LOOP
    SELECT id, room_type_id INTO room_id, rt_id FROM v2.rooms
    WHERE property_id = pid AND number = b->>'roomNumber' LIMIT 1;
    IF room_id IS NULL THEN
      RAISE NOTICE 'skip missing room %', b->>'roomNumber';
      CONTINUE;
    END IF;

    INSERT INTO v2.guests (id, property_id, full_name, nationality, version)
    VALUES (
      (b->>'guestId')::uuid, pid, b->>'guestName',
      NULLIF(b->>'nationality', ''), 1
    );

    INSERT INTO v2.bookings (
      id, property_id, confirmation_no, status, guest_id, agent_id, group_id,
      check_in, check_out, source, notes, version, created_at
    ) VALUES (
      (b->>'bookingId')::uuid, pid, b->>'confirmationNo', b->>'status',
      (b->>'guestId')::uuid, (b->>'agentId')::uuid,
      NULLIF(b->>'groupId', '')::uuid,
      (b->>'checkIn')::date, (b->>'checkOut')::date,
      'xlsx_grid', b->>'notes', 1, now()
    );

    INSERT INTO v2.booking_lines (
      id, property_id, booking_id, room_type_id, meal_plan, net_amount, version
    ) VALUES (
      (b->>'lineId')::uuid, pid, (b->>'bookingId')::uuid, rt_id,
      b->>'mealPlan',
      NULLIF(b->>'netAmount', '')::numeric,
      1
    );

    INSERT INTO v2.folios (id, property_id, booking_id, payer_type, guest_id, status, version)
    VALUES ((b->>'folioId')::uuid, pid, (b->>'bookingId')::uuid, 'guest', (b->>'guestId')::uuid, 'open', 1);

    INSERT INTO v2.folios (id, property_id, booking_id, payer_type, agent_id, status, version)
    VALUES ((b->>'agencyFolioId')::uuid, pid, (b->>'bookingId')::uuid, 'agent', (b->>'agentId')::uuid, 'open', 1);

    IF (b->>'chargeTotal') IS NOT NULL AND (b->>'chargeTotal')::numeric > 0 THEN
      INSERT INTO v2.folio_lines (
        id, property_id, folio_id, kind, description,
        net_amount, sc_amount, gst_amount, total_amount, idempotency_key
      ) VALUES (
        (b->>'chargeId')::uuid, pid, (b->>'agencyFolioId')::uuid, 'room',
        'Room · ' || (b->>'mealPlan') || ' · Rm ' || (b->>'roomNumber') || ' · sheet quote',
        (b->>'chargeNet')::numeric,
        (b->>'chargeSc')::numeric,
        0,
        (b->>'chargeTotal')::numeric,
        (b->>'chargeId')::uuid
      );
    END IF;

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
  SELECT count(*) INTO grp_n FROM v2.groups WHERE property_id = pid;
  SELECT count(*) INTO inhouse FROM v2.bookings WHERE property_id = pid AND status = 'checked_in';
  SELECT count(*) INTO meal_n FROM v2.booking_lines WHERE property_id = pid AND meal_plan <> 'EP';

  RAISE NOTICE 'RACK SYNC OK rooms=% bookings=% groups=% inhouse=% non_EP_meals=%',
    rooms_n, bk_n, grp_n, inhouse, meal_n;
  IF rooms_n <> 27 THEN RAISE EXCEPTION 'expected 27 rooms, got %', rooms_n; END IF;
  IF bk_n < 100 THEN RAISE EXCEPTION 'too few bookings %', bk_n; END IF;
END $$;

COMMIT;
`;

const sqlPath = path.join(__dirname, "_pelbu-rack-resync.sql");
fs.writeFileSync(sqlPath, sql);

console.log(
  JSON.stringify(
    {
      ...payload.stats,
      agents: agents.length,
      sample: bookings
        .filter((b) => b.groupId)
        .slice(0, 4)
        .map((b) => ({
          room: b.roomNumber,
          guest: b.guestName,
          meal: b.mealPlan,
          agent: b.agentCode,
          total: b.chargeTotal,
          status: b.status,
        })),
      mealMix: bookings.reduce((a, b) => {
        a[b.mealPlan] = (a[b.mealPlan] || 0) + 1;
        return a;
      }, {}),
      payloadPath,
      sqlPath,
      sqlBytes: sql.length,
    },
    null,
    2,
  ),
);
