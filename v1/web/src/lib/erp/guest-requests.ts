/** Guest requests live on the stay notes, between these markers. */

const OPEN = "«requests»";
const CLOSE = "«/requests»";

export type GuestRequestLine = {
  text: string;
  done: boolean;
};

export function parseGuestRequests(notes: string | null | undefined): GuestRequestLine[] {
  const raw = notes ?? "";
  const start = raw.indexOf(OPEN);
  const end = raw.indexOf(CLOSE);
  if (start < 0 || end < start) return [];
  return raw
    .slice(start + OPEN.length, end)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const done = line.startsWith("[done] ");
      return { text: done ? line.slice(7) : line, done };
    });
}

export function writeGuestRequests(
  notes: string | null | undefined,
  lines: GuestRequestLine[],
): string {
  const raw = notes ?? "";
  const start = raw.indexOf(OPEN);
  const end = raw.indexOf(CLOSE);
  const block =
    lines.length === 0
      ? ""
      : `${OPEN}\n${lines
          .map((line) => (line.done ? `[done] ${line.text}` : line.text))
          .join("\n")}\n${CLOSE}`;
  if (start >= 0 && end > start) {
    const next = `${raw.slice(0, start)}${block}${raw.slice(end + CLOSE.length)}`;
    return next.replace(/\n{3,}/g, "\n\n").trim();
  }
  if (!block) return raw.trim();
  return `${raw.trim()}${raw.trim() ? "\n\n" : ""}${block}`.trim();
}
