/**
 * Pull Drive-sheet threaded comments onto xlsx_grid bookings (guest + notes + meal).
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { parseRack } from "../../v1/web/scripts/lib/pelbu-olakha-rack.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const file =
  process.argv[2] || "C:/Users/rajiv/Downloads/Reservation 2026 (8).xlsx";
const PROPERTY_SLUG = "pelbu-olakha";
const TODAY = new Date().toISOString().slice(0, 10);

function addDays(ymd, n) {
  const [Y, M, D] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(Y, M - 1, D + n));
  return dt.toISOString().slice(0, 10);
}

function sqlStr(s) {
  return `'${String(s ?? "").replace(/'/g, "''")}'`;
}

function mealForDb(code) {
  const c = String(code || "EP").toUpperCase();
  if (c === "BB") return "CP";
  if (c === "CP" || c === "EP" || c === "MAP" || c === "AP") return c;
  return "EP";
}

function notesFor(stay) {
  const bits = [];
  if (stay.raw_comment?.trim()) bits.push(stay.raw_comment.trim());
  else bits.push(`Agent ${stay.agent_code}`);
  if (stay.guide_name) bits.push(`Guide: ${stay.guide_name}${stay.guide_phone ? ` · ${stay.guide_phone}` : ""}`);
  if (stay.diet) bits.push(`Diet: ${stay.diet}`);
  if (stay.eta) bits.push(`ETA: ${stay.eta}`);
  if (stay.payment_note) bits.push(stay.payment_note);
  if (stay.quoted_total_btn) bits.push(`Quoted total Nu ${stay.quoted_total_btn}`);
  bits.push(`Imported from Reservation 2026 xlsx · agent ${stay.agent_code}`);
  return bits.join("\n\n").slice(0, 4000);
}

const parsed = parseRack(file, TODAY);
const rows = [];

function guestLabel(stay) {
  let g = String(stay.guest_name || "").trim();
  if (!g || /^guest\b/i.test(g) || /^c\/?in\b/i.test(g) || /^check\s*in\b/i.test(g)) {
    const fromNotes =
      stay.raw_comment?.match(/group\s*names?\s*[:：]\s*([^\n]+)/i)?.[1]?.trim() ||
      stay.raw_comment?.match(/(?:^|\n)\s*((?:mr|ms|mrs|miss)\.?\s+[^\n]+)/i)?.[1]?.trim() ||
      "";
    g = fromNotes || stay.agent_name || stay.agent_code || "Guest";
  }
  return g.slice(0, 200);
}

for (const stay of parsed.stays) {
  const doors = stay.doors?.length ? stay.doors : stay.doorHint ? [stay.doorHint] : [];
  for (const door of doors) {
    const nightSet =
      stay.doorNights instanceof Map && stay.doorNights.get(door)
        ? stay.doorNights.get(door)
        : new Set(stay.nights || []);
    const nights = [...nightSet].sort();
    if (!nights.length) continue;
    const checkIn = nights[0];
    const checkOut = addDays(nights[nights.length - 1], 1);
    rows.push({
      room: String(door),
      agent: String(stay.agent_code || "").toUpperCase(),
      checkIn,
      checkOut,
      guest: guestLabel(stay),
      nationality: (stay.nationality || "").slice(0, 80),
      meal: mealForDb(stay.meal_plan_code),
      notes: notesFor(stay),
      hasComment: Boolean(stay.raw_comment?.trim()),
    });
  }
}

const payloadPath = path.join(__dirname, "_xlsx-notes-enrich.json");
fs.writeFileSync(payloadPath, JSON.stringify({ generatedAt: new Date().toISOString(), rows }, null, 2));

const sqlPath = path.join(__dirname, "_xlsx-notes-enrich.sql");
const values = rows
  .map(
    (r) =>
      `(${sqlStr(r.room)}, ${sqlStr(r.agent)}, ${sqlStr(r.checkIn)}::date, ${sqlStr(r.checkOut)}::date, ${sqlStr(r.guest)}, ${sqlStr(r.nationality)}, ${sqlStr(r.meal)}, ${sqlStr(r.notes)})`,
  )
  .join(",\n");

const sql = `-- Enrich xlsx_grid bookings with Drive-sheet cell comments
BEGIN;

WITH src(room_number, agent_code, check_in, check_out, guest_name, nationality, meal_plan, notes) AS (
  VALUES
${values}
),
pid AS (
  SELECT id FROM v2.properties WHERE slug = '${PROPERTY_SLUG}' LIMIT 1
),
matched AS (
  SELECT DISTINCT ON (b.id)
    b.id AS booking_id,
    b.guest_id,
    bl.id AS line_id,
    src.guest_name,
    src.nationality,
    src.meal_plan,
    src.notes
  FROM src
  CROSS JOIN pid
  JOIN v2.rooms r
    ON r.property_id = pid.id AND r.number = src.room_number
  JOIN v2.bookings b
    ON b.property_id = pid.id
   AND b.source = 'xlsx_grid'
   AND b.check_in = src.check_in
   AND b.check_out = src.check_out
   AND (
     b.notes ILIKE '%agent ' || src.agent_code || '%'
     OR b.notes ILIKE '%' || src.agent_code || '%'
   )
  JOIN v2.booking_lines bl ON bl.booking_id = b.id
  JOIN v2.room_assignments ra
    ON ra.booking_line_id = bl.id AND ra.room_id = r.id AND ra.active
  ORDER BY b.id
)
UPDATE v2.guests g
SET full_name = m.guest_name,
    nationality = NULLIF(m.nationality, ''),
    version = g.version + 1
FROM matched m
WHERE g.id = m.guest_id;

UPDATE v2.bookings b
SET notes = m.notes,
    version = b.version + 1
FROM matched m
WHERE b.id = m.booking_id;

UPDATE v2.booking_lines bl
SET meal_plan = m.meal_plan,
    version = bl.version + 1
FROM matched m
WHERE bl.id = m.line_id;

DO $$
DECLARE
  n int;
  with_notes int;
BEGIN
  SELECT count(*) INTO n FROM v2.bookings
  WHERE property_id = (SELECT id FROM v2.properties WHERE slug = '${PROPERTY_SLUG}')
    AND source = 'xlsx_grid';
  SELECT count(*) INTO with_notes FROM v2.bookings
  WHERE property_id = (SELECT id FROM v2.properties WHERE slug = '${PROPERTY_SLUG}')
    AND source = 'xlsx_grid'
    AND notes IS NOT NULL
    AND length(notes) > 80;
  RAISE NOTICE 'xlsx_grid bookings=% with_rich_notes=% enrich_rows=${rows.length} commented=${rows.filter((r) => r.hasComment).length}';
END $$;

COMMIT;
`;

fs.writeFileSync(sqlPath, sql);
console.log(
  JSON.stringify(
    {
      stays: parsed.stays.length,
      enrichRows: rows.length,
      withComment: rows.filter((r) => r.hasComment).length,
      sample: rows.filter((r) => r.hasComment).slice(0, 3).map((r) => ({
        room: r.room,
        agent: r.agent,
        guest: r.guest,
        checkIn: r.checkIn,
        notesLen: r.notes.length,
      })),
      sqlPath,
      payloadPath,
    },
    null,
    2,
  ),
);
