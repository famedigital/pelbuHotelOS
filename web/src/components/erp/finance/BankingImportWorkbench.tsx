"use client";

import { ImportStatementForm, AutoMatchButton } from "@/components/erp/FinanceForms";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useCallback, useEffect, useState } from "react";
import type { FinanceExpenseOption, FinancePaymentOption } from "@/components/erp/FinanceForms";

type ParserOption = {
  id: string;
  name: string;
  bank_code: string | null;
  kind: string;
  latest_version: { id: string; status: string; version_label: string } | null;
};

type Batch = {
  id: string;
  status: string;
  source_filename: string;
  row_count: number;
  error_message: string | null;
  parser_label: string | null;
  bank_code: string | null;
};

type StagedRow = {
  id: string;
  row_no: number;
  selected: boolean;
  txn_date: string | null;
  value_date: string | null;
  description: string | null;
  debit_btn: number;
  credit_btn: number;
  balance_btn: number | null;
  reference: string | null;
  category: string | null;
  merchant: string | null;
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

type Props = {
  payments: FinancePaymentOption[];
  expenses: FinanceExpenseOption[];
};

export function BankingImportWorkbench({ payments: _payments, expenses: _expenses }: Props) {
  const [bankCode, setBankCode] = useState("bob");
  const [accountLabel, setAccountLabel] = useState("");
  const [parsers, setParsers] = useState<ParserOption[]>([]);
  const [parserVersionId, setParserVersionId] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeBatch, setActiveBatch] = useState<Batch | null>(null);
  const [rows, setRows] = useState<StagedRow[]>([]);

  const loadParsers = useCallback(async () => {
    const res = await fetch("/api/erp/finance/parsers");
    if (!res.ok) return;
    const data = (await res.json()) as { scripts: ParserOption[] };
    const bank = (data.scripts ?? []).filter((s) => s.kind === "bank");
    setParsers(bank);
  }, []);

  useEffect(() => {
    void loadParsers();
  }, [loadParsers]);

  useEffect(() => {
    const match = parsers.find(
      (p) =>
        p.bank_code === bankCode && p.latest_version?.status === "approved",
    );
    setParserVersionId(match?.latest_version?.id ?? "");
  }, [bankCode, parsers]);

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
  }, []);

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
          kind: "statement",
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
          kind: "bank",
          bankCode,
          accountLabel: accountLabel || null,
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
      setMessage(`Queued ${file.name} for ${bankCode.toUpperCase()} parsing.`);
      await refreshBatch(batchJson.batch.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed.");
    } finally {
      setBusy(false);
    }
  }

  async function commit() {
    if (!activeBatch) return;
    setBusy(true);
    setError(null);
    try {
      await fetch(`/api/erp/finance/batches/${activeBatch.id}/rows`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          rows: rows.map((r) => ({
            id: r.id,
            selected: r.selected,
            txn_date: r.txn_date,
            value_date: r.value_date,
            description: r.description,
            debit_btn: r.debit_btn,
            credit_btn: r.credit_btn,
            balance_btn: r.balance_btn,
            reference: r.reference,
            category: r.category,
            merchant: r.merchant,
          })),
        }),
      });
      const res = await fetch(`/api/erp/finance/batches/${activeBatch.id}/commit`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      });
      const j = (await res.json()) as {
        error?: string;
        result?: { committed_count?: number };
      };
      if (!res.ok) throw new Error(j.error ?? "Commit failed.");
      setMessage(`Imported ${j.result?.committed_count ?? 0} bank transactions.`);
      await refreshBatch(activeBatch.id);
      window.location.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Commit failed.");
    } finally {
      setBusy(false);
    }
  }

  const bankParsers = parsers.filter((p) => p.bank_code === bankCode);

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-card p-3 space-y-3">
        <div>
          <p className="text-sm font-medium">Import bank PDF</p>
          <p className="text-xs text-muted-foreground">
            Upload the statement privately, choose an approved parser from Settings,
            review the staged table, then commit into bank transactions.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <select
            className="h-9 rounded-md border border-input bg-transparent px-2 text-sm"
            value={bankCode}
            onChange={(e) => setBankCode(e.target.value)}
          >
            <option value="bob">BoB</option>
            <option value="bnb">BNB</option>
            <option value="tbank">T Bank</option>
            <option value="drukpnb">Druk PNB</option>
          </select>
          <Input
            className="h-9 max-w-xs"
            placeholder="Account label (optional)"
            value={accountLabel}
            onChange={(e) => setAccountLabel(e.target.value)}
          />
          <select
            className="h-9 min-w-[14rem] rounded-md border border-input bg-transparent px-2 text-sm"
            value={parserVersionId}
            onChange={(e) => setParserVersionId(e.target.value)}
          >
            <option value="">Built-in {bankCode.toUpperCase()} parser</option>
            {bankParsers.map((p) =>
              p.latest_version?.status === "approved" ? (
                <option key={p.id} value={p.latest_version.id}>
                  {p.name} · {p.latest_version.version_label}
                </option>
              ) : null,
            )}
          </select>
          <label className="inline-flex h-9 cursor-pointer items-center rounded-md border border-input px-3 text-sm hover:bg-muted">
            Choose PDF
            <input
              type="file"
              accept="application/pdf"
              className="hidden"
              disabled={busy}
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (f) void startImport(f);
              }}
            />
          </label>
        </div>
        {message ? <p className="text-sm text-emerald-700">{message}</p> : null}
        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        {activeBatch ? (
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2 text-sm">
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
                {activeBatch.parser_label} · {activeBatch.row_count} rows
              </span>
            </div>
            {activeBatch.error_message ? (
              <p className="text-sm text-destructive">{activeBatch.error_message}</p>
            ) : null}

            {activeBatch.status === "review" && rows.length > 0 ? (
              <>
                <div className="overflow-auto rounded-md border">
                  <table className="min-w-[1000px] w-full text-sm">
                    <thead className="bg-muted/80 text-xs uppercase text-muted-foreground">
                      <tr>
                        <th className="p-2">Use</th>
                        <th className="p-2">Date</th>
                        <th className="p-2">Particulars</th>
                        <th className="p-2 text-right">Debit</th>
                        <th className="p-2 text-right">Credit</th>
                        <th className="p-2 text-right">Balance</th>
                        <th className="p-2">Ref</th>
                        <th className="p-2">Flags</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r, idx) => (
                        <tr key={r.id} className="border-t">
                          <td className="p-2">
                            <Checkbox
                              checked={r.selected}
                              onCheckedChange={(v) =>
                                setRows((prev) =>
                                  prev.map((x, i) =>
                                    i === idx ? { ...x, selected: Boolean(v) } : x,
                                  ),
                                )
                              }
                            />
                          </td>
                          <td className="p-1">
                            <Input
                              type="date"
                              className="h-8"
                              value={r.txn_date ?? ""}
                              onChange={(e) =>
                                setRows((prev) =>
                                  prev.map((x, i) =>
                                    i === idx ? { ...x, txn_date: e.target.value } : x,
                                  ),
                                )
                              }
                            />
                          </td>
                          <td className="p-1">
                            <Input
                              className="h-8 min-w-[14rem]"
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
                              value={String(r.debit_btn ?? "")}
                              onChange={(e) =>
                                setRows((prev) =>
                                  prev.map((x, i) =>
                                    i === idx
                                      ? {
                                          ...x,
                                          debit_btn:
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
                              className="h-8 w-24 text-right"
                              value={String(r.credit_btn ?? "")}
                              onChange={(e) =>
                                setRows((prev) =>
                                  prev.map((x, i) =>
                                    i === idx
                                      ? {
                                          ...x,
                                          credit_btn:
                                            Number(e.target.value.replace(/,/g, "")) ||
                                            0,
                                        }
                                      : x,
                                  ),
                                )
                              }
                            />
                          </td>
                          <td className="p-1 text-right tabular-nums text-muted-foreground">
                            {r.balance_btn == null ? "—" : Number(r.balance_btn).toFixed(2)}
                          </td>
                          <td className="p-1">
                            <Input
                              className="h-8 w-28"
                              value={r.reference ?? ""}
                              onChange={(e) =>
                                setRows((prev) =>
                                  prev.map((x, i) =>
                                    i === idx ? { ...x, reference: e.target.value } : x,
                                  ),
                                )
                              }
                            />
                          </td>
                          <td className="p-2 text-xs text-muted-foreground">
                            {[
                              r.is_duplicate ? "dup" : null,
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
                <Button type="button" size="sm" disabled={busy} onClick={() => void commit()}>
                  Commit statement
                </Button>
              </>
            ) : null}
          </div>
        ) : null}
      </div>

      <details className="rounded-lg border border-border p-3">
        <summary className="cursor-pointer text-sm font-medium">
          Fallback: paste offline parser JSON
        </summary>
        <div className="mt-3">
          <ImportStatementForm />
        </div>
      </details>

      <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
        <span>
          After commit, unmatched bank lines appear in the queue below for payment /
          expense matching.
        </span>
        <AutoMatchButton />
      </div>
    </div>
  );
}
