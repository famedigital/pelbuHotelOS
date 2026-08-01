export type FolioLineForBalance = {
  id: string;
  status: string;
  total_btn: number;
  reverses_line_id?: string | null;
};

/** Net folio balance from posted lines; voided originals exclude their reversal credits. */
export function netFolioBalance(lines: FolioLineForBalance[]): number {
  const voidedIds = new Set(
    lines.filter((line) => line.status === "voided").map((line) => line.id),
  );
  return lines
    .filter((line) => {
      if (line.status !== "posted") return false;
      if (line.reverses_line_id && voidedIds.has(line.reverses_line_id)) {
        return false;
      }
      return true;
    })
    .reduce((sum, line) => sum + Number(line.total_btn), 0);
}
