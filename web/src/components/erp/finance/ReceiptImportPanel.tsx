"use client";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useCallback, useEffect, useState } from "react";

type ParserOption = {
  id: string;
  name: string;
  latest_version: { id: string; status: string; version_label: string } | null;
};

type Batch = {
  id: string;
  status: string;
  source_filename: string;
  row_count: number;
  error_message: string | null;
  parser_label: string | null;
};

type StagedRow = {
  id: string;
  row_no: number;
  selected: boolean;
  bill_no: string | null;
  vendor: string | null;
  tpn: string | null;
  expense_date: string | null;
  category: string | null;
  description: string | null;
  amount_btn: number;
  gst_btn: number;
  net_btn: number;
  confidence: number | null;
  warnings: string[];
  is_duplicate: boolean;
  validation_errors: string[];
};

async function sha256File(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function ReceiptImportPanel({ onReviewReady }: { onReviewReady?: () => void }) {
  const [parsers, setParsers] = useState<ParserOption[]>([]);
  const [parserVersionId, setParserVersionId] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeBatch, setActiveBatch] = useState<Batch | null>(null);
  const [rows, setRows] = useState<StagedRow[]>([]);
  const [asDraft, setAsDraft] = useState(false);

  const loadParsers = useCallback(async () => {
    const res = await fetch("/api/erp/finance/parsers");
    if (!res.ok) return;
    const data = (await res.json()) as {
      scripts: ParserOption[];
    };
    const receipt = (data.scripts ?? []).filter((s) =>
      // kind not on this slim type — filter by name/builtin via latest approved
      Boolean(s.latest_version),
    );
    // Prefer approved
    const approved = (data.scripts as Array<ParserOption & { kind?: string }>).filter(
      (s) => (s as { kind?: string }).kind === "receipt",
    );
    setParsers(approved.length ? approved : receipt);
    const firstApproved = approved.find((p) => p.latest_version?.status === "approved");
    if (firstApproved?.latest_version?.id) {
      setParserVersionId(firstApproved.latest_version.id);
    }
  }, []);

  useEffect(() => {
    void loadParsers();
  }, [loadParsers]);

  const refreshBatch = useCallback(async (batchId: string) => {
    const res = await fetch(`/api/erp/finance/batches?id=${batchId}`);
    if (!res.ok) return;
    const data = (await res.json()) as { batch: Batch; rows: StagedRow[] };
    setActiveBatch(data.batch);
    setRows(
      (data.rows ?? []).map((r) => ({
        ...r,
        warnings: Array.isArray(r.warnings) ? r.warnings : [],
        validation_errors: Array.isArray(r.validation_errors)
          ? r.validation_errors
          : [],
      })),
    );
    if (data.batch.status === "review") onReviewReady?.();
  }, [onReviewReady]);

  useEffect(() => {
    if (!activeBatch) return;
    if (!["queued", "processing", "uploaded"].includes(activeBatch.status)) return;
    const t = setInterval(() => void refreshBatch(activeBatch.id), 2500);
    return () => clearInterval(t);
  }, [activeBatch, refreshBatch]);

  async function startImport(file: File) {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const sha = await sha256File(file);
      const signRes = await fetch("/api/erp/finance/upload", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          kind: "receipt",
          fileName: file.name,
          mimeType: file.type || "application/pdf",
          byteSize: file.size,
        }),
      });
      const signed = (await signRes.json()) as {
        signedUrl?: string;
        path?: string;
        error?: string;
      };
      if (!signRes.ok || !signed.signedUrl || !signed.path) {
        throw new Error(signed.error ?? "Signed upload failed.");
      }
      const put = await fetch(signed.signedUrl, {
        method: "PUT",
        headers: { "content-type": file.type || "application/pdf" },
        body: file,
      });
      if (!put.ok) throw new Error("Storage upload failed.");

      const batchRes = await fetch("/api/erp/finance/batches", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          kind: "receipt",
          storagePath: signed.path,
          fileName: file.name,
          mimeType: file.type || "application/pdf",
          sha256: sha,
          byteSize: file.size,
          parserVersionId: parserVersionId || null,
          queue: true,
        }),
      });
      const batchJson = (await batchRes.json()) as {
        batch?: Batch;
        error?: string;
      };
      if (!batchRes.ok || !batchJson.batch) {
        throw new Error(batchJson.error ?? "Could not queue batch.");
      }
      setActiveBatch(batchJson.batch);
      setMessage(`Queued ${file.name} for extraction.`);
      await refreshBatch(batchJson.batch.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed.");
    } finally {
      setBusy(false);
    }
  }

  async function saveRowEdits() {
    if (!activeBatch) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/erp/finance/batches/${activeBatch.id}/rows`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          rows: rows.map((r) => ({
            id: r.id,
            selected: r.selected,
            bill_no: r.bill_no,
            vendor: r.vendor,
            tpn: r.tpn,
            expense_date: r.expense_date,
            category: r.category,
            description: r.description,
            amount_btn: r.amount_btn,
            gst_btn: r.gst_btn,
            net_btn: r.net_btn,
          })),
        }),
      });
      if (!res.ok) {
        const j = (await res.json()) as { error?: string };
        throw new Error(j.error ?? "Row update failed.");
      }
      setMessage("Staged rows updated.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed.");
    } finally {
      setBusy(false);
    }
  }

  async function commit() {
    if (!activeBatch) return;
    setBusy(true);
    setError(null);
    try {
      await saveRowEdits();
      const res = await fetch(`/api/erp/finance/batches/${activeBatch.id}/commit`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ asDraft }),
      });
      const j = (await res.json()) as { error?: string; result?: { committed_count?: number } };
      if (!res.ok) throw new Error(j.error ?? "Commit failed.");
      setMessage(`Committed ${j.result?.committed_count ?? 0} expenses.`);
      await refreshBatch(activeBatch.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Commit failed.");
    } finally {
      setBusy(false);
    }
  }

  async function retry() {
    if (!activeBatch) return;
    const res = await fetch(`/api/erp/finance/batches/${activeBatch.id}/retry`, {
      method: "POST",
    });
    if (res.ok) {
      setMessage("Re-queued for processing.");
      await refreshBatch(activeBatch.id);
    }
  }

  const selectedTotal = rows
    .filter((r) => r.selected)
    .reduce((s, r) => s + Number(r.amount_btn || 0), 0);

  return (
    <div className="rounded-lg border border-border bg-card p-3 space-y-3">
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-[12rem] flex-1">
          <p className="text-sm font-medium">Import receipt PDF</p>
          <p className="text-xs text-muted-foreground">
            Uploads privately, extracts via approved parser / Gemini worker, then
            review before posting. GST is never invented from TPN alone.
          </p>
        </div>
        <select
          className="h-9 rounded-md border border-input bg-transparent px-2 text-sm"
          value={parserVersionId}
          onChange={(e) => setParserVersionId(e.target.value)}
        >
          <option value="">Default / built-in Gemini</option>
          {parsers.map((p) =>
            p.latest_version?.status === "approved" ? (
              <option key={p.id} value={p.latest_version.id}>
                {p.name} · {p.latest_version.version_label}
              </option>
            ) : null,
          )}
        </select>
        <label className="inline-flex">
          <span className="inline-flex h-9 cursor-pointer items-center rounded-md bg-primary px-3 text-sm text-primary-foreground hover:bg-primary/90">
            Choose PDF
            <input
              type="file"
              accept="application/pdf,image/*"
              className="hidden"
              disabled={busy}
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (f) void startImport(f);
              }}
            />
          </span>
        </label>
      </div>

      {message ? <p className="text-sm text-emerald-700">{message}</p> : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {activeBatch ? (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-medium">{activeBatch.source_filename}</span>
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-xs uppercase",
                activeBatch.status === "review" && "bg-emerald-100 text-emerald-800",
                activeBatch.status === "error" && "bg-red-100 text-red-800",
                ["queued", "processing"].includes(activeBatch.status) &&
                  "bg-amber-100 text-amber-900",
              )}
            >
              {activeBatch.status}
            </span>
            <span className="text-muted-foreground">
              {activeBatch.parser_label ?? "parser"} · {activeBatch.row_count} rows
            </span>
            {activeBatch.status === "error" ? (
              <Button type="button" size="sm" variant="outline" onClick={() => void retry()}>
                Retry
              </Button>
            ) : null}
          </div>
          {activeBatch.error_message ? (
            <p className="text-sm text-destructive">{activeBatch.error_message}</p>
          ) : null}

          {activeBatch.status === "review" && rows.length > 0 ? (
            <>
              <div className="overflow-auto rounded-md border">
                <table className="min-w-[1100px] w-full text-sm">
                  <thead className="bg-muted/80 text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="p-2">Use</th>
                      <th className="p-2">Date</th>
                      <th className="p-2">Bill</th>
                      <th className="p-2">Vendor</th>
                      <th className="p-2">TPN</th>
                      <th className="p-2">Description</th>
                      <th className="p-2 text-right">Gross</th>
                      <th className="p-2 text-right">GST</th>
                      <th className="p-2">Flags</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, idx) => (
                      <tr
                        key={r.id}
                        className={cn(
                          "border-t",
                          r.is_duplicate && "bg-amber-50/50",
                          r.validation_errors?.length && "bg-red-50/40",
                        )}
                      >
                        <td className="p-2">
                          <Checkbox
                            checked={r.selected}
                            onCheckedChange={(v) => {
                              setRows((prev) =>
                                prev.map((x, i) =>
                                  i === idx ? { ...x, selected: Boolean(v) } : x,
                                ),
                              );
                            }}
                          />
                        </td>
                        <td className="p-1">
                          <Input
                            type="date"
                            className="h-8"
                            value={r.expense_date ?? ""}
                            onChange={(e) =>
                              setRows((prev) =>
                                prev.map((x, i) =>
                                  i === idx
                                    ? { ...x, expense_date: e.target.value }
                                    : x,
                                ),
                              )
                            }
                          />
                        </td>
                        <td className="p-1">
                          <Input
                            className="h-8 w-24"
                            value={r.bill_no ?? ""}
                            onChange={(e) =>
                              setRows((prev) =>
                                prev.map((x, i) =>
                                  i === idx ? { ...x, bill_no: e.target.value } : x,
                                ),
                              )
                            }
                          />
                        </td>
                        <td className="p-1">
                          <Input
                            className="h-8 w-32"
                            value={r.vendor ?? ""}
                            onChange={(e) =>
                              setRows((prev) =>
                                prev.map((x, i) =>
                                  i === idx ? { ...x, vendor: e.target.value } : x,
                                ),
                              )
                            }
                          />
                        </td>
                        <td className="p-1">
                          <Input
                            className="h-8 w-28"
                            value={r.tpn ?? ""}
                            onChange={(e) =>
                              setRows((prev) =>
                                prev.map((x, i) =>
                                  i === idx ? { ...x, tpn: e.target.value } : x,
                                ),
                              )
                            }
                          />
                        </td>
                        <td className="p-1">
                          <Input
                            className="h-8 min-w-[10rem]"
                            value={r.description ?? ""}
                            onChange={(e) =>
                              setRows((prev) =>
                                prev.map((x, i) =>
                                  i === idx
                                    ? { ...x, description: e.target.value }
                                    : x,
                                ),
                              )
                            }
                          />
                        </td>
                        <td className="p-1">
                          <Input
                            className="h-8 w-24 text-right"
                            value={String(r.amount_btn ?? "")}
                            onChange={(e) =>
                              setRows((prev) =>
                                prev.map((x, i) =>
                                  i === idx
                                    ? {
                                        ...x,
                                        amount_btn:
                                          Number(e.target.value.replace(/,/g, "")) ||
                                          0,
                                      }
                                    : x,
                                ),
                              )
                            }
                          />
                        </td>
                        <td className="p-1">
                          <Input
                            className="h-8 w-20 text-right"
                            value={String(r.gst_btn ?? "")}
                            onChange={(e) =>
                              setRows((prev) =>
                                prev.map((x, i) =>
                                  i === idx
                                    ? {
                                        ...x,
                                        gst_btn:
                                          Number(e.target.value.replace(/,/g, "")) ||
                                          0,
                                      }
                                    : x,
                                ),
                              )
                            }
                          />
                        </td>
                        <td className="p-2 text-xs text-muted-foreground">
                          {[
                            r.is_duplicate ? "dup" : null,
                            ...(r.warnings ?? []).slice(0, 2),
                            ...(r.validation_errors ?? []),
                          ]
                            .filter(Boolean)
                            .join(", ")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <p className="text-sm">
                  Selected total Nu {selectedTotal.toFixed(2)} ·{" "}
                  {rows.filter((r) => r.selected).length} of {rows.length}
                </p>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={asDraft}
                    onCheckedChange={(v) => setAsDraft(Boolean(v))}
                  />
                  Commit as drafts (skip ledger)
                </label>
                <Button type="button" size="sm" variant="secondary" disabled={busy} onClick={() => void saveRowEdits()}>
                  Save review
                </Button>
                <Button type="button" size="sm" disabled={busy} onClick={() => void commit()}>
                  Commit selected
                </Button>
              </div>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
