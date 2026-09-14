import { createHash } from "crypto";

type FolioLineLike = {
  status: string;
  total_btn: number;
  created_at?: string;
};

/** Shared folio fingerprint for dual-desk stale detection. */
export function folioVersionFingerprint(input: {
  status: string;
  lines: FolioLineLike[];
}): string {
  const rows = input.lines;
  const maxCreated = rows.reduce((max, row) => {
    const ts = String(row.created_at ?? "");
    return ts > max ? ts : max;
  }, "");
  const postedTotal = rows
    .filter((row) => row.status === "posted")
    .reduce((sum, row) => sum + Number(row.total_btn ?? 0), 0);

  return createHash("sha256")
    .update(
      JSON.stringify({
        status: input.status,
        lineCount: rows.length,
        maxCreated,
        postedTotal: Math.round(postedTotal * 100) / 100,
      }),
    )
    .digest("hex")
    .slice(0, 16);
}
