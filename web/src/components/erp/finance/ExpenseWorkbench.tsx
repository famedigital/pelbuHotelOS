"use client";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  EXPENSE_CATEGORIES,
  PAY_METHODS,
  type ExpenseGridRow,
} from "@/lib/finance-import/types";
import { cn } from "@/lib/utils";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ReceiptImportPanel } from "@/components/erp/finance/ReceiptImportPanel";

type Props = {
  initialRows: ExpenseGridRow[];
  propertyId: string;
};

function emptyRow(): ExpenseGridRow {
  return {
    id: "",
    clientId: crypto.randomUUID(),
    isNew: true,
    dirty: true,
    expense_date: new Date().toISOString().slice(0, 10),
    bill_no: "",
    vendor: "",
    tpn: "",
    description: "",
    category: "other",
    payment_method: "bank",
    amount_btn: 0,
    gst_btn: 0,
    net_btn: 0,
    status: "draft",
    journal_id: null,
    notes: "",
    reference: "",
    receipt_path: null,
  };
}

async function sha256File(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function ExpenseWorkbench({ initialRows }: Props) {
  const [rows, setRows] = useState<ExpenseGridRow[]>(() =>
    initialRows.map((r) => ({
      ...r,
      clientId: r.id,
      net_btn: r.net_btn || Math.max(0, Number(r.amount_btn) - Number(r.gst_btn)),
    })),
  );
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<{
    path: string;
    url: string;
    rowKey: string;
  } | null>(null);
  const [undoStack, setUndoStack] = useState<ExpenseGridRow[][]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const attachTargetRef = useRef<string | null>(null);

  const pushUndo = useCallback((snapshot: ExpenseGridRow[]) => {
    setUndoStack((s) => [...s.slice(-19), snapshot.map((r) => ({ ...r }))]);
  }, []);

  const visible = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      [r.vendor, r.description, r.bill_no, r.tpn, r.category, r.notes]
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [rows, filter]);

  const totals = useMemo(() => {
    const listed = visible.filter((r) => !r.id || r.status !== "void");
    return {
      count: listed.length,
      amount: listed.reduce((s, r) => s + Number(r.amount_btn || 0), 0),
      gst: listed.reduce((s, r) => s + Number(r.gst_btn || 0), 0),
      dirty: rows.filter((r) => r.dirty).length,
    };
  }, [visible, rows]);

  function rowKey(r: ExpenseGridRow) {
    return r.id || r.clientId || "";
  }

  function updateRow(key: string, patch: Partial<ExpenseGridRow>) {
    setRows((prev) =>
      prev.map((r) => {
        if (rowKey(r) !== key) return r;
        const next = { ...r, ...patch, dirty: true };
        if ("amount_btn" in patch || "gst_btn" in patch) {
          next.net_btn = Math.max(
            0,
            Number(next.amount_btn || 0) - Number(next.gst_btn || 0),
          );
        }
        return next;
      }),
    );
  }

  function addRow() {
    pushUndo(rows);
    setRows((prev) => [emptyRow(), ...prev]);
  }

  function duplicateSelected() {
    pushUndo(rows);
    setRows((prev) => {
      const clones: ExpenseGridRow[] = [];
      for (const r of prev) {
        if (selected.has(rowKey(r))) {
          clones.push({
            ...r,
            id: "",
            clientId: crypto.randomUUID(),
            isNew: true,
            dirty: true,
            journal_id: null,
            status: "draft",
          });
        }
      }
      return [...clones, ...prev];
    });
  }

  function undo() {
    setUndoStack((stack) => {
      const prev = stack[stack.length - 1];
      if (prev) setRows(prev);
      return stack.slice(0, -1);
    });
  }

  async function save(post: boolean) {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const dirty = rows.filter((r) => r.dirty || r.isNew);
      if (!dirty.length) {
        setMessage("Nothing to save.");
        return;
      }
      const res = await fetch("/api/erp/finance/expenses/bulk", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          post,
          rows: dirty.map((r) => ({
            id: r.id || undefined,
            clientId: r.clientId,
            expense_date: r.expense_date,
            bill_no: r.bill_no,
            vendor: r.vendor,
            tpn: r.tpn,
            description: r.description,
            category: r.category,
            payment_method: r.payment_method,
            amount_btn: r.amount_btn,
            gst_btn: r.gst_btn,
            notes: r.notes,
            reference: r.reference || r.bill_no,
            status: post ? "posted" : "draft",
            receipt_path: r.receipt_path,
          })),
        }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        saved?: Array<{ clientId?: string; id: string }>;
        errors?: Array<{ clientId?: string; error: string }>;
        error?: string;
      };
      if (!res.ok) throw new Error(data.error ?? "Save failed.");
      if (data.errors?.length) {
        setError(data.errors.map((e) => e.error).join("; "));
      }
      const byClient = new Map(
        (data.saved ?? []).map((s) => [s.clientId ?? s.id, s.id]),
      );
      setRows((prev) =>
        prev.map((r) => {
          const id = byClient.get(r.clientId ?? "") ?? byClient.get(r.id);
          if (!id) return r;
          return {
            ...r,
            id,
            clientId: id,
            isNew: false,
            dirty: false,
            status: post ? "posted" : r.status === "posted" ? "posted" : "draft",
          };
        }),
      );
      setMessage(
        post
          ? `Posted ${data.saved?.length ?? 0} expense(s).`
          : `Saved ${data.saved?.length ?? 0} draft expense(s).`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  async function uploadReceipt(file: File, targetKey: string | null) {
    setError(null);
    try {
      const sha = await sha256File(file);
      const signRes = await fetch("/api/erp/finance/upload", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          kind: "attachment",
          fileName: file.name,
          mimeType: file.type || "image/jpeg",
          byteSize: file.size,
        }),
      });
      const signed = (await signRes.json()) as {
        signedUrl?: string;
        path?: string;
        token?: string;
        error?: string;
      };
      if (!signRes.ok || !signed.signedUrl || !signed.path) {
        throw new Error(signed.error ?? "Could not start upload.");
      }

      const put = await fetch(signed.signedUrl, {
        method: "PUT",
        headers: {
          "content-type": file.type || "image/jpeg",
          ...(signed.token ? { "x-upsert": "false" } : {}),
        },
        body: file,
      });
      if (!put.ok) throw new Error("Upload to storage failed.");

      const previewRes = await fetch(
        `/api/erp/finance/preview?path=${encodeURIComponent(signed.path)}`,
      );
      const previewJson = (await previewRes.json()) as { url?: string };
      const key = targetKey;
      if (key) {
        pushUndo(rows);
        updateRow(key, {
          receipt_path: signed.path,
          receipt_preview_url: previewJson.url ?? null,
          dirty: true,
        });
      } else {
        pushUndo(rows);
        const row = emptyRow();
        row.receipt_path = signed.path;
        row.receipt_preview_url = previewJson.url ?? null;
        row.description = file.name.replace(/\.[^.]+$/, "");
        setRows((prev) => [row, ...prev]);
      }
      setMessage(`Receipt attached (${sha.slice(0, 8)}…).`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed.");
    }
  }

  async function openPreview(row: ExpenseGridRow) {
    if (!row.receipt_path) return;
    if (row.receipt_preview_url) {
      setPreview({
        path: row.receipt_path,
        url: row.receipt_preview_url,
        rowKey: rowKey(row),
      });
      return;
    }
    const res = await fetch(
      `/api/erp/finance/preview?path=${encodeURIComponent(row.receipt_path)}`,
    );
    const data = (await res.json()) as { url?: string; error?: string };
    if (!res.ok || !data.url) {
      setError(data.error ?? "Preview failed.");
      return;
    }
    setPreview({ path: row.receipt_path, url: data.url, rowKey: rowKey(row) });
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void save(false);
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        undo();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  function onPaste(e: React.ClipboardEvent<HTMLDivElement>) {
    const text = e.clipboardData.getData("text/plain");
    if (!text.includes("\t") && !text.includes("\n")) return;
    e.preventDefault();
    pushUndo(rows);
    const lines = text
      .trim()
      .split(/\r?\n/)
      .map((l) => l.split("\t"));
    const pasted = lines.map((cols) => {
      const row = emptyRow();
      row.expense_date = cols[0] || row.expense_date;
      row.bill_no = cols[1] || "";
      row.vendor = cols[2] || "";
      row.tpn = cols[3] || "";
      row.description = cols[4] || cols[2] || "Pasted expense";
      row.category = (cols[5] || "other").toLowerCase();
      row.payment_method = (cols[6] || "bank").toLowerCase();
      row.amount_btn = Number(String(cols[7] ?? "0").replace(/,/g, "")) || 0;
      row.gst_btn = Number(String(cols[8] ?? "0").replace(/,/g, "")) || 0;
      row.net_btn = Math.max(0, row.amount_btn - row.gst_btn);
      row.notes = cols[9] || "";
      return row;
    });
    setRows((prev) => [...pasted, ...prev]);
    setMessage(`Pasted ${pasted.length} row(s) from clipboard.`);
  }

  return (
    <div className="space-y-3" onPaste={onPaste}>
      <ReceiptImportPanel
        onReviewReady={() => {
          /* batch review opens inline below via panel state */
        }}
      />

      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Search vendor, bill, TPN…"
          className="h-9 max-w-xs"
        />
        <Button type="button" size="sm" variant="outline" onClick={addRow}>
          Add row
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={duplicateSelected}
          disabled={!selected.size}
        >
          Duplicate
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => {
            attachTargetRef.current = null;
            cameraInputRef.current?.click();
          }}
        >
          Camera
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => {
            attachTargetRef.current = null;
            fileInputRef.current?.click();
          }}
        >
          Upload receipt
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={undo}
          disabled={!undoStack.length}
        >
          Undo
        </Button>
        <div className="ml-auto flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={saving || !totals.dirty}
            onClick={() => void save(false)}
          >
            Save drafts
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={saving || !totals.dirty}
            onClick={() => void save(true)}
          >
            Save & post
          </Button>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        {totals.count} rows · Nu {totals.amount.toFixed(2)} · GST Nu{" "}
        {totals.gst.toFixed(2)}
        {totals.dirty ? ` · ${totals.dirty} unsaved` : ""} · Paste from Excel
        supported · Ctrl+S save
      </p>
      {message ? <p className="text-sm text-emerald-700">{message}</p> : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,application/pdf"
        multiple
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = "";
          for (const f of files) void uploadReceipt(f, attachTargetRef.current);
        }}
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void uploadReceipt(file, attachTargetRef.current);
        }}
      />

      <div className="overflow-auto rounded-md border border-border bg-card">
        <table className="min-w-[1400px] w-full border-collapse text-sm">
          <thead className="sticky top-0 z-10 bg-muted/95 backdrop-blur">
            <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="w-8 p-2" />
              <th className="sticky left-0 z-20 bg-muted/95 p-2">Receipt</th>
              <th className="sticky left-[4.5rem] z-20 bg-muted/95 p-2">Date</th>
              <th className="p-2">Bill #</th>
              <th className="p-2">Vendor</th>
              <th className="p-2">TPN</th>
              <th className="p-2">Description</th>
              <th className="p-2">Category</th>
              <th className="p-2">Pay</th>
              <th className="p-2 text-right">Gross</th>
              <th className="p-2 text-right">GST in</th>
              <th className="p-2 text-right">Net</th>
              <th className="p-2">Status</th>
              <th className="p-2">Notes</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((r) => {
              const key = rowKey(r);
              const checked = selected.has(key);
              return (
                <tr
                  key={key}
                  className={cn(
                    "border-b border-border/60 hover:bg-muted/40",
                    r.dirty && "bg-amber-50/40 dark:bg-amber-950/20",
                  )}
                >
                  <td className="p-1.5">
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(v) => {
                        setSelected((prev) => {
                          const next = new Set(prev);
                          if (v) next.add(key);
                          else next.delete(key);
                          return next;
                        });
                      }}
                      aria-label="Select row"
                    />
                  </td>
                  <td className="sticky left-0 z-[1] bg-card p-1.5">
                    <div className="flex gap-1">
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 text-xs"
                        onClick={() => {
                          attachTargetRef.current = key;
                          fileInputRef.current?.click();
                        }}
                      >
                        {r.receipt_path ? "Replace" : "Add"}
                      </Button>
                      {r.receipt_path ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-xs"
                          onClick={() => void openPreview(r)}
                        >
                          View
                        </Button>
                      ) : null}
                    </div>
                  </td>
                  <td className="sticky left-[4.5rem] z-[1] bg-card p-1">
                    <Input
                      type="date"
                      className="h-8 w-[9.5rem]"
                      value={r.expense_date}
                      onChange={(e) =>
                        updateRow(key, { expense_date: e.target.value })
                      }
                    />
                  </td>
                  <td className="p-1">
                    <Input
                      className="h-8 w-28"
                      value={r.bill_no}
                      onChange={(e) => updateRow(key, { bill_no: e.target.value })}
                    />
                  </td>
                  <td className="p-1">
                    <Input
                      className="h-8 w-36"
                      value={r.vendor}
                      onChange={(e) => updateRow(key, { vendor: e.target.value })}
                    />
                  </td>
                  <td className="p-1">
                    <Input
                      className="h-8 w-28"
                      value={r.tpn}
                      onChange={(e) => updateRow(key, { tpn: e.target.value })}
                    />
                  </td>
                  <td className="p-1">
                    <Input
                      className="h-8 min-w-[12rem]"
                      value={r.description}
                      onChange={(e) =>
                        updateRow(key, { description: e.target.value })
                      }
                    />
                  </td>
                  <td className="p-1">
                    <select
                      className="h-8 rounded-md border border-input bg-transparent px-2 text-sm"
                      value={r.category}
                      onChange={(e) => updateRow(key, { category: e.target.value })}
                    >
                      {EXPENSE_CATEGORIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="p-1">
                    <select
                      className="h-8 rounded-md border border-input bg-transparent px-2 text-sm"
                      value={r.payment_method}
                      onChange={(e) =>
                        updateRow(key, { payment_method: e.target.value })
                      }
                    >
                      {PAY_METHODS.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="p-1">
                    <Input
                      className="h-8 w-24 text-right"
                      inputMode="decimal"
                      value={String(r.amount_btn || "")}
                      onChange={(e) =>
                        updateRow(key, {
                          amount_btn: Number(e.target.value.replace(/,/g, "")) || 0,
                        })
                      }
                    />
                  </td>
                  <td className="p-1">
                    <Input
                      className="h-8 w-20 text-right"
                      inputMode="decimal"
                      value={String(r.gst_btn || "")}
                      onChange={(e) =>
                        updateRow(key, {
                          gst_btn: Number(e.target.value.replace(/,/g, "")) || 0,
                        })
                      }
                    />
                  </td>
                  <td className="p-1 text-right tabular-nums text-muted-foreground">
                    {Number(r.net_btn || 0).toFixed(2)}
                  </td>
                  <td className="p-1 text-xs uppercase text-muted-foreground">
                    {r.status}
                    {r.journal_id ? " · J" : ""}
                  </td>
                  <td className="p-1">
                    <Input
                      className="h-8 w-40"
                      value={r.notes}
                      onChange={(e) => updateRow(key, { notes: e.target.value })}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Sheet open={Boolean(preview)} onOpenChange={(o) => !o && setPreview(null)}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Receipt preview</SheetTitle>
            <SheetDescription>
              Private signed URL — expires in about 10 minutes.
            </SheetDescription>
          </SheetHeader>
          {preview ? (
            <div className="mt-4 space-y-3">
              {preview.path.toLowerCase().endsWith(".pdf") ? (
                <iframe
                  title="Receipt PDF"
                  src={preview.url}
                  className="h-[70vh] w-full rounded-md border"
                />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={preview.url}
                  alt="Receipt"
                  className="max-h-[70vh] w-full rounded-md object-contain"
                />
              )}
              <p className="break-all text-xs text-muted-foreground">{preview.path}</p>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}
