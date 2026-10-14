/**
 * Canonical Pelbu Suites Olakha doors.
 * Twin 502 on the August rack is an empty alias of the suite, not a second door.
 * October calls 207/307 King and 506 Twin; those stay Queen and King.
 */

export const PROPERTY_SLUG = "pelbu-olakha";
export const PROPERTY_NAME = "Pelbu Suites Olakha";
export const PRACTICE_SLUG = "pelbu-suites-olakha";
export const TENANT_SLUG = "pelbu-olakha";

const TWIN = [
  ..."201,202,203,204,205,206,301,302,303,304,305,306,401,402,403,404,405,406,501,503,504,505".split(
    ",",
  ),
];
const QUEEN = ["207", "307"];
const KING = ["407", "506"];
const SUITE = ["502"];

function categoryOf(door) {
  if (SUITE.includes(door)) return "suite";
  if (QUEEN.includes(door)) return "deluxe_queen";
  if (KING.includes(door)) return "deluxe_king";
  if (TWIN.includes(door)) return "deluxe_twin";
  return null;
}

const ALIASES = {
  207: ["Deluxe Queen 207", "Deluxe King 207"],
  307: ["Deluxe Queen 307", "Deluxe King 307"],
  407: ["Deluxe King 407"],
  502: ["Pelbu Suite 502", "Suite 502", "Deluxe Twin 502"],
  506: ["Deluxe King 506", "Deluxe Twin 506"],
};

function aliasesFor(door, category) {
  if (ALIASES[door]) return ALIASES[door];
  const label =
    category === "deluxe_twin"
      ? `Deluxe Twin ${door}`
      : category === "deluxe_queen"
        ? `Deluxe Queen ${door}`
        : category === "deluxe_king"
          ? `Deluxe King ${door}`
          : `Suite ${door}`;
  return [label];
}

export const ROOM_TYPE_META = {
  deluxe_twin: {
    name: "Deluxe Twin",
    inventory_kind: "sellable_guest",
  },
  deluxe_queen: {
    name: "Deluxe Queen",
    inventory_kind: "sellable_guest",
  },
  deluxe_king: {
    name: "Deluxe King",
    inventory_kind: "sellable_guest",
  },
  suite: {
    name: "Pelbu Suite",
    inventory_kind: "sellable_guest",
  },
  guide: {
    name: "Guide bed (complimentary)",
    inventory_kind: "guide_comp",
  },
  driver: {
    name: "Driver bed (complimentary)",
    inventory_kind: "driver_comp",
  },
};

/** 27 sellable doors. The plan's "28" counted the duplicate Twin 502 row. */
export function canonicalRooms() {
  const doors = [...TWIN, ...QUEEN, ...KING, ...SUITE].sort(
    (a, b) => Number(a) - Number(b),
  );
  return doors.map((door) => {
    const category = categoryOf(door);
    return {
      door,
      category,
      floor: door.slice(0, 1),
      aliases: aliasesFor(door, category),
    };
  });
}

const DOOR_BY_LABEL = new Map();
for (const room of canonicalRooms()) {
  DOOR_BY_LABEL.set(room.door, room.door);
  for (const alias of room.aliases) {
    DOOR_BY_LABEL.set(normalizeLabel(alias), room.door);
  }
}

export function normalizeLabel(value) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function doorFromLabel(label) {
  const text = String(label ?? "").trim();
  if (!text) return null;
  const direct = DOOR_BY_LABEL.get(normalizeLabel(text));
  if (direct) return direct;
  const nums = text.match(/\b(\d{3})\b/g) ?? [];
  if (nums.length === 1 && categoryOf(nums[0])) return nums[0];
  return null;
}

export function isFooterLabel(label) {
  return /^(occ\b|occ%|empty room|total\b|s7\+)/i.test(
    String(label ?? "").trim(),
  );
}

export function roomSheetRows() {
  return [
    ["door", "category", "floor", "aliases"],
    ...canonicalRooms().map((room) => [
      room.door,
      room.category,
      room.floor,
      room.aliases.join("; "),
    ]),
  ];
}

export function roomsFromSheetRows(rows) {
  const header = (rows[0] ?? []).map((h) => String(h).trim().toLowerCase());
  const doorIdx = header.indexOf("door");
  const catIdx = header.indexOf("category");
  const floorIdx = header.indexOf("floor");
  const aliasIdx = header.indexOf("aliases");
  if (doorIdx < 0 || catIdx < 0) {
    throw new Error("Rooms sheet needs door and category columns.");
  }
  const rooms = [];
  for (const row of rows.slice(1)) {
    const door = String(row[doorIdx] ?? "").trim();
    const category = String(row[catIdx] ?? "").trim();
    if (!door || !category) continue;
    if (!ROOM_TYPE_META[category] || ROOM_TYPE_META[category].inventory_kind !== "sellable_guest") {
      throw new Error(`Unknown sellable category ${category} for door ${door}`);
    }
    const aliases = String(row[aliasIdx] ?? "")
      .split(";")
      .map((s) => s.trim())
      .filter(Boolean);
    rooms.push({
      door,
      category,
      floor: String(row[floorIdx] ?? door.slice(0, 1)).trim() || door.slice(0, 1),
      aliases: aliases.length ? aliases : aliasesFor(door, category),
    });
  }
  if (rooms.length < 20) {
    throw new Error(`Rooms sheet has ${rooms.length} doors; expected the Olakha rack.`);
  }
  return rooms;
}
