/**
 * Emit JSON payload + apply SQL for Pelbu xlsx grid import.
 */
import fs from "fs";
import crypto from "crypto";
import path from "path";

const extractPath =
  process.argv[2] ||
  path.resolve("c:/GitHub/Hotel OS Bhutan/scripts/cutover/_reservation-grid-extract.json");
const outDir = path.dirname(extractPath);
const jsonPath = path.join(outDir, "_xlsx-import-payload.json");
const sqlPath = path.join(outDir, "_xlsx-import-apply.sql");

const data = JSON.parse(fs.readFileSync(extractPath, "utf8"));
const PROPERTY_SLUG = "pelbu-olakha";

const TYPE_MAP = {
  DTWIN: "deluxe_twin",
  DQUEEN: "deluxe_queen",
  DKING: "deluxe_king",
  SUITE: "suite",
  DELUXE: "deluxe_twin",
};

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

const rooms = data.rooms.map((r) => ({
  number: r.label,
  typeCode: TYPE_MAP[r.roomTypeCode] || "deluxe_twin",
  typeName: r.roomTypeName,
  floor: Number(String(r.label)[0]) || null,
}));

const agents = data.agentCodes.map((a) => ({
  id: uuidFrom(`agent:${PROPERTY_SLUG}:${a.code}`),
  code: a.code,
  name: a.code,
}));

const bookings = data.segments.map((seg) => {
  const conf = `XLS-${seg.roomLabel}-${seg.checkIn.replace(/-/g, "")}-${seg.agentCode}`.slice(
    0,
    64,
  );
  return {
    confirmationNo: conf,
    bookingId: uuidFrom(`bk:${PROPERTY_SLUG}:${conf}`),
    guestId: uuidFrom(`g:${PROPERTY_SLUG}:${conf}`),
    lineId: uuidFrom(`ln:${PROPERTY_SLUG}:${conf}`),
    folioId: uuidFrom(`fo:${PROPERTY_SLUG}:${conf}`),
    agencyFolioId: uuidFrom(`af:${PROPERTY_SLUG}:${conf}`),
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

const payload = {
  propertySlug: PROPERTY_SLUG,
  rooms,
  agents,
  bookings,
};

fs.writeFileSync(jsonPath, JSON.stringify(payload));

const sql = `-- Apply Reservation 2026 xlsx import for ${PROPERTY_SLUG}
-- Requires payload JSON at /tmp/xlsx-import-payload.json inside supabase-db
BEGIN;

CREATE TEMP TABLE IF NOT EXISTS _xlsx_payload (doc jsonb);
TRUNCATE _xlsx_payload;
\\copy _xlsx_payload(doc) FROM PROGRAM 'cat /tmp/xlsx-import-payload.json'

DO $$
DECLARE
  pid uuid;
  doc jsonb;
  r jsonb;
  a jsonb;
  b jsonb;
  d text;
  rt_id uuid;
  room_id uuid;
  asg_id uuid;
  rooms_kept int;
  bk_count int;
  inhouse int;
BEGIN
  SELECT id INTO pid FROM v2.properties WHERE slug = '${PROPERTY_SLUG}';
  IF pid IS NULL THEN
    RAISE EXCEPTION 'missing property ${PROPERTY_SLUG}';
  END IF;

  SELECT doc INTO doc FROM _xlsx_payload LIMIT 1;

  -- 1) Remove non-Excel rooms (guide/driver beds) with no active assignments
  DELETE FROM v2.rooms rm
  WHERE rm.property_id = pid
    AND NOT (rm.number = ANY (ARRAY(SELECT jsonb_array_elements_text(
      (SELECT jsonb_agg(x->>'number') FROM jsonb_array_elements(doc->'rooms') x)
    ))))
    AND NOT EXISTS (
      SELECT 1 FROM v2.room_assignments ra WHERE ra.room_id = rm.id AND ra.active
    );

  -- 2) Ensure room types + 27 rooms
  FOR r IN SELECT * FROM jsonb_array_elements(doc->'rooms')
  LOOP
    INSERT INTO v2.room_types (id, property_id, code, name, base_occupancy, version)
    SELECT gen_random_uuid(), pid, r->>'typeCode', r->>'typeName', 2, 1
    WHERE NOT EXISTS (
      SELECT 1 FROM v2.room_types t WHERE t.property_id = pid AND t.code = r->>'typeCode'
    );

    SELECT t.id INTO rt_id FROM v2.room_types t
    WHERE t.property_id = pid AND t.code = r->>'typeCode' LIMIT 1;

    INSERT INTO v2.rooms (id, property_id, room_type_id, number, floor, hk_status, version)
    SELECT gen_random_uuid(), pid, rt_id, r->>'number', NULLIF(r->>'floor','')::int, 'clean', 1
    WHERE NOT EXISTS (
      SELECT 1 FROM v2.rooms x WHERE x.property_id = pid AND x.number = r->>'number'
    );

    UPDATE v2.rooms x
    SET room_type_id = rt_id,
        floor = COALESCE(NULLIF(r->>'floor','')::int, x.floor),
        version = x.version + 1
    WHERE x.property_id = pid AND x.number = r->>'number'
      AND x.room_type_id IS DISTINCT FROM rt_id;
  END LOOP;

  -- 3) Upsert agents by Excel code (names = code for later edit)
  FOR a IN SELECT * FROM jsonb_array_elements(doc->'agents')
  LOOP
    INSERT INTO v2.agents (id, property_id, name, code, credit_limit, credit_hold, version)
    VALUES ((a->>'id')::uuid, pid, a->>'name', a->>'code', 0, false, 1)
    ON CONFLICT (property_id, code) DO UPDATE
      SET id = EXCLUDED.id,
          name = EXCLUDED.name,
          version = v2.agents.version + 1;
  END LOOP;

  -- 4) Clear previous xlsx_grid import for this property
  DELETE FROM v2.room_assignments ra
  USING v2.booking_lines bl, v2.bookings bk
  WHERE ra.booking_line_id = bl.id
    AND bl.booking_id = bk.id
    AND bk.property_id = pid
    AND bk.source = 'xlsx_grid';

  DELETE FROM v2.folio_lines fl
  USING v2.folios f, v2.bookings bk
  WHERE fl.folio_id = f.id AND f.booking_id = bk.id
    AND bk.property_id = pid AND bk.source = 'xlsx_grid';

  DELETE FROM v2.folios f
  USING v2.bookings bk
  WHERE f.booking_id = bk.id AND bk.property_id = pid AND bk.source = 'xlsx_grid';

  DELETE FROM v2.booking_lines bl
  USING v2.bookings bk
  WHERE bl.booking_id = bk.id AND bk.property_id = pid AND bk.source = 'xlsx_grid';

  DELETE FROM v2.bookings bk
  WHERE bk.property_id = pid AND bk.source = 'xlsx_grid';

  -- 5) Insert bookings + lines + folios + assignments
  FOR b IN SELECT * FROM jsonb_array_elements(doc->'bookings')
  LOOP
    SELECT x.id INTO room_id FROM v2.rooms x
    WHERE x.property_id = pid AND x.number = b->>'roomNumber' LIMIT 1;
    IF room_id IS NULL THEN
      RAISE EXCEPTION 'missing room %', b->>'roomNumber';
    END IF;
    SELECT x.room_type_id INTO rt_id FROM v2.rooms x WHERE x.id = room_id;

    INSERT INTO v2.guests (id, property_id, full_name, version)
    VALUES ((b->>'guestId')::uuid, pid, b->>'guestName', 1)
    ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name;

    INSERT INTO v2.bookings (
      id, property_id, confirmation_no, status, guest_id, agent_id,
      check_in, check_out, source, notes, version, created_at
    ) VALUES (
      (b->>'bookingId')::uuid,
      pid,
      b->>'confirmationNo',
      b->>'status',
      (b->>'guestId')::uuid,
      (b->>'agentId')::uuid,
      (b->>'checkIn')::date,
      (b->>'checkOut')::date,
      'xlsx_grid',
      'Imported from Reservation 2026 xlsx · agent ' || (b->>'agentCode'),
      1,
      now()
    )
    ON CONFLICT (property_id, confirmation_no) DO UPDATE
      SET status = EXCLUDED.status,
          agent_id = EXCLUDED.agent_id,
          guest_id = EXCLUDED.guest_id,
          check_in = EXCLUDED.check_in,
          check_out = EXCLUDED.check_out,
          notes = EXCLUDED.notes,
          version = v2.bookings.version + 1;

    INSERT INTO v2.booking_lines (id, property_id, booking_id, room_type_id, meal_plan, version)
    VALUES ((b->>'lineId')::uuid, pid, (b->>'bookingId')::uuid, rt_id, 'EP', 1)
    ON CONFLICT (id) DO UPDATE SET room_type_id = EXCLUDED.room_type_id;

    INSERT INTO v2.folios (id, property_id, booking_id, payer_type, guest_id, status, version)
    VALUES ((b->>'folioId')::uuid, pid, (b->>'bookingId')::uuid, 'guest', (b->>'guestId')::uuid, 'open', 1)
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO v2.folios (id, property_id, booking_id, payer_type, agent_id, status, version)
    VALUES ((b->>'agencyFolioId')::uuid, pid, (b->>'bookingId')::uuid, 'agent', (b->>'agentId')::uuid, 'open', 1)
    ON CONFLICT (id) DO NOTHING;

    FOR d IN SELECT jsonb_array_elements_text(b->'nights')
    LOOP
      asg_id := md5(pid::text || (b->>'lineId') || d)::uuid;
      -- md5::uuid not valid; use gen from text via uuid_generate — fallback:
      asg_id := (
        substr(md5(pid::text || (b->>'lineId') || d), 1, 8) || '-' ||
        substr(md5(pid::text || (b->>'lineId') || d), 9, 4) || '-' ||
        '4' || substr(md5(pid::text || (b->>'lineId') || d), 13, 3) || '-' ||
        'a' || substr(md5(pid::text || (b->>'lineId') || d), 17, 3) || '-' ||
        substr(md5(pid::text || (b->>'lineId') || d), 21, 12)
      )::uuid;

      INSERT INTO v2.room_assignments (
        id, property_id, booking_line_id, room_id, stay_date, active, version
      ) VALUES (
        asg_id, pid, (b->>'lineId')::uuid, room_id, d::date, true, 1
      )
      ON CONFLICT (id) DO UPDATE
        SET active = true, room_id = EXCLUDED.room_id, stay_date = EXCLUDED.stay_date;
    END LOOP;
  END LOOP;

  SELECT count(*) INTO rooms_kept FROM v2.rooms WHERE property_id = pid;
  SELECT count(*) INTO bk_count FROM v2.bookings WHERE property_id = pid AND source = 'xlsx_grid';
  SELECT count(*) INTO inhouse FROM v2.bookings
  WHERE property_id = pid AND source = 'xlsx_grid' AND status = 'checked_in';

  RAISE NOTICE 'pelbu rooms=% xlsx_bookings=% inhouse=%', rooms_kept, bk_count, inhouse;
END $$;

COMMIT;
`;

fs.writeFileSync(sqlPath, sql);
console.log(
  JSON.stringify(
    {
      jsonPath,
      sqlPath,
      rooms: rooms.length,
      agents: agents.length,
      bookings: bookings.length,
      payloadBytes: fs.statSync(jsonPath).size,
    },
    null,
    2,
  ),
);
