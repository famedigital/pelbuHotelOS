"use client";

import {
  createComplianceCategory,
  deleteComplianceDocument,
  registerComplianceDocument,
} from "@/app/actions/erp-compliance";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useActionState, useState } from "react";

export type ComplianceCategoryRow = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  documentCount: number;
};

export type ComplianceDocumentRow = {
  id: string;
  categoryId: string;
  categoryName: string;
  categoryCode: string;
  title: string;
  fileName: string;
  storagePath: string;
  uploadedAt: string;
  validUntil: string | null;
  leaseAgreementRef: string | null;
  depositSlipRef: string | null;
  handoverInventoryRef: string | null;
};

type Props = {
  categories: ComplianceCategoryRow[];
  documents: ComplianceDocumentRow[];
};

const initial = { ok: false } as const;

export function SettingsCompliancePanel({ categories, documents }: Props) {
  const [catState, addCategory] = useActionState(createComplianceCategory, initial);
  const [uploadState, registerDoc] = useActionState(registerComplianceDocument, initial);
  const [, deleteDoc] = useActionState(deleteComplianceDocument, initial);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<{
    path: string;
    name: string;
    mime: string;
    size: number;
  } | null>(null);

  async function handleFilePick(file: File) {
    setUploadError(null);
    setUploading(true);
    try {
      const signRes = await fetch("/api/erp/finance/upload", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          kind: "compliance",
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
        throw new Error(signed.error ?? "Upload sign failed.");
      }
      const put = await fetch(signed.signedUrl, {
        method: "PUT",
        headers: { "content-type": file.type || "application/pdf" },
        body: file,
      });
      if (!put.ok) throw new Error("Upload to storage failed.");
      setPendingFile({
        path: signed.path,
        name: file.name,
        mime: file.type || "application/pdf",
        size: file.size,
      });
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-8">
      <section className="rounded-xl border bg-card p-5 md:p-6">
        <div className="mb-5 space-y-1">
          <p className="text-[11px] font-semibold tracking-[0.2em] text-accent uppercase">
            Compliance vault
          </p>
          <h2 className="text-xl font-semibold tracking-tight">
            Licenses, GST filings &amp; lease package
          </h2>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Upload PDFs and scans to the private finance vault. Lease category
            accepts agreement, deposit slip, and handover inventory references.
          </p>
        </div>

        <form action={addCategory} className="mb-6 flex flex-wrap items-end gap-3">
          <div className="min-w-[12rem] flex-1 space-y-1">
            <Label htmlFor="compliance_cat_name">Custom category</Label>
            <Input id="compliance_cat_name" name="name" placeholder="e.g. Health permit" required />
          </div>
          <Button type="submit" variant="outline">
            Add category
          </Button>
          {catState.message ? (
            <p className="w-full text-xs text-emerald-600">{catState.message}</p>
          ) : null}
          {catState.error ? (
            <p className="w-full text-xs text-destructive">{catState.error}</p>
          ) : null}
        </form>

        <form action={registerDoc} className="space-y-4 rounded-lg border bg-muted/20 p-4">
          <p className="text-sm font-medium">Upload document</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="compliance_category">Category</Label>
              <select
                id="compliance_category"
                name="category_id"
                required
                className="h-10 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                defaultValue={categories[0]?.id ?? ""}
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="compliance_title">Title</Label>
              <Input id="compliance_title" name="title" required placeholder="e.g. 2026 BITS filed" />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Input
              type="file"
              accept=".pdf,image/jpeg,image/png,image/webp"
              disabled={uploading}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleFilePick(f);
              }}
            />
            {pendingFile ? (
              <span className="text-xs text-muted-foreground">
                Ready: {pendingFile.name}
              </span>
            ) : null}
          </div>
          {uploadError ? (
            <p className="text-xs text-destructive">{uploadError}</p>
          ) : null}

          <input type="hidden" name="storage_path" value={pendingFile?.path ?? ""} />
          <input type="hidden" name="file_name" value={pendingFile?.name ?? ""} />
          <input type="hidden" name="mime_type" value={pendingFile?.mime ?? ""} />
          <input type="hidden" name="byte_size" value={pendingFile?.size ?? 0} />

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1">
              <Label htmlFor="lease_agreement_ref">Lease agreement ref</Label>
              <Input id="lease_agreement_ref" name="lease_agreement_ref" placeholder="Agreement no." />
            </div>
            <div className="space-y-1">
              <Label htmlFor="deposit_slip_ref">Deposit slip ref</Label>
              <Input id="deposit_slip_ref" name="deposit_slip_ref" placeholder="Receipt / voucher" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="handover_inventory_ref">Handover inventory</Label>
              <Input
                id="handover_inventory_ref"
                name="handover_inventory_ref"
                placeholder="Snapshot ref"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="valid_until">Valid until</Label>
              <Input id="valid_until" name="valid_until" type="date" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="compliance_notes">Notes</Label>
              <Textarea id="compliance_notes" name="notes" rows={2} />
            </div>
          </div>

          <Button type="submit" disabled={!pendingFile || uploading}>
            Save to vault
          </Button>
          {uploadState.message ? (
            <p className="text-xs text-emerald-600">{uploadState.message}</p>
          ) : null}
          {uploadState.error ? (
            <p className="text-xs text-destructive">{uploadState.error}</p>
          ) : null}
        </form>
      </section>

      <section className="rounded-xl border bg-card p-5 md:p-6">
        <h3 className="text-lg font-semibold">Categories</h3>
        <ul className="mt-3 divide-y text-sm">
          {categories.map((c) => (
            <li key={c.id} className="flex justify-between py-2">
              <span>
                {c.name}
                {c.description ? (
                  <span className="ml-2 text-muted-foreground">· {c.description}</span>
                ) : null}
              </span>
              <span className="tabular-nums text-muted-foreground">
                {c.documentCount} doc{c.documentCount === 1 ? "" : "s"}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-xl border bg-card p-5 md:p-6">
        <h3 className="text-lg font-semibold">Document library</h3>
        {documents.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">No documents uploaded yet.</p>
        ) : (
          <ul className="mt-3 divide-y">
            {documents.map((doc) => (
              <li key={doc.id} className="flex flex-wrap items-start justify-between gap-2 py-3">
                <div>
                  <p className="font-medium">{doc.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {doc.categoryName} · {doc.fileName} ·{" "}
                    {doc.uploadedAt.slice(0, 10)}
                    {doc.validUntil ? ` · valid until ${doc.validUntil}` : ""}
                  </p>
                  {doc.categoryCode === "lease" &&
                  (doc.leaseAgreementRef ||
                    doc.depositSlipRef ||
                    doc.handoverInventoryRef) ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {doc.leaseAgreementRef ? `Agreement: ${doc.leaseAgreementRef}` : ""}
                      {doc.depositSlipRef ? ` · Deposit: ${doc.depositSlipRef}` : ""}
                      {doc.handoverInventoryRef
                        ? ` · Handover: ${doc.handoverInventoryRef}`
                        : ""}
                    </p>
                  ) : null}
                </div>
                <div className="flex items-center gap-2">
                  <a
                    href={`/api/erp/finance/preview?path=${encodeURIComponent(doc.storagePath)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-medium text-accent underline-offset-4 hover:underline"
                  >
                    View
                  </a>
                  <form action={deleteDoc}>
                    <input type="hidden" name="document_id" value={doc.id} />
                    <Button type="submit" variant="ghost" size="sm" className="text-destructive">
                      Remove
                    </Button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
