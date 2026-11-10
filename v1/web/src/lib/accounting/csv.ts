export function csvEscape(value: unknown): string {
  const s = value == null ? "" : String(value);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function toCsv(header: string[], rows: unknown[][]): string {
  return (
    [header.join(","), ...rows.map((r) => r.map(csvEscape).join(","))].join(
      "\n",
    ) + "\n"
  );
}
