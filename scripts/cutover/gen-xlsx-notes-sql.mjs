import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const json = JSON.parse(
  fs.readFileSync(path.join(__dirname, "_xlsx-notes-enrich.json"), "utf8"),
);
const rows = json.rows;

function sqlStr(s) {
  return `'${String(s ?? "").replace(/'/g, "''")}'`;
}

const values = rows
  .map(
    (r) =>
      `(${sqlStr(r.room)}, ${sqlStr(r.agent)}, ${sqlStr(r.checkIn)}::date, ${sqlStr(r.checkOut)}::date, ${sqlStr(r.guest)}, ${sqlStr(r.nationality)}, ${sqlStr(r.meal)}, ${sqlStr(r.notes)})`,
  )
  .join(",\n");

const sql = `-- Enrich xlsx_grid bookings with Drive-sheet cell comments
BEGIN;
CREATE TEMP TABLE xlsx_note_src (
  room_number text, agent_code text, check_in date, check_out date,
  guest_name text, nationality text, meal_plan text, notes text
) ON COMMIT DROP;
INSERT INTO xlsx_note_src VALUES
${values};

CREATE TEMP TABLE xlsx_note_matched ON COMMIT DROP AS
SELECT DISTINCT ON (b.id)
  b.id AS booking_id,
  b.guest_id,
  bl.id AS line_id,
  src.guest_name,
  src.nationality,
  src.meal_plan,
  src.notes
FROM xlsx_note_src src
JOIN v2.properties p ON p.slug = 'pelbu-olakha'
JOIN v2.rooms r ON r.property_id = p.id AND r.number = src.room_number
JOIN v2.bookings b
  ON b.property_id = p.id
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
ORDER BY b.id;

UPDATE v2.guests g
SET full_name = m.guest_name,
    nationality = COALESCE(NULLIF(m.nationality, ''), g.nationality),
    version = g.version + 1
FROM xlsx_note_matched m
WHERE g.id = m.guest_id;

UPDATE v2.bookings b
SET notes = m.notes,
    version = b.version + 1
FROM xlsx_note_matched m
WHERE b.id = m.booking_id;

UPDATE v2.booking_lines bl
SET meal_plan = m.meal_plan,
    version = bl.version + 1
FROM xlsx_note_matched m
WHERE bl.id = m.line_id;

DO $$
DECLARE n int; with_notes int; matched int;
BEGIN
  SELECT count(*) INTO matched FROM xlsx_note_matched;
  SELECT count(*) INTO n FROM v2.bookings
  WHERE property_id = (SELECT id FROM v2.properties WHERE slug = 'pelbu-olakha')
    AND source = 'xlsx_grid';
  SELECT count(*) INTO with_notes FROM v2.bookings
  WHERE property_id = (SELECT id FROM v2.properties WHERE slug = 'pelbu-olakha')
    AND source = 'xlsx_grid'
    AND notes IS NOT NULL AND length(notes) > 80;
  RAISE NOTICE 'matched=% xlsx_grid=% rich_notes=%', matched, n, with_notes;
END $$;
COMMIT;
`;

const sqlPath = path.join(__dirname, "_xlsx-notes-enrich.sql");
fs.writeFileSync(sqlPath, sql);
console.log({ rows: rows.length, sqlPath, bytes: sql.length });
