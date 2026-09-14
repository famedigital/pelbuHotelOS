"use client";

import {
  activateIsr,
  createIsrVersion,
  markIsrApproved,
  markIsrSubmitted,
  updateIsrDetails,
  uploadIsrSignedPdf,
  type IsrActionState,
} from "@/app/actions/erp-isr";
import {
  CloudinaryPicker,
} from "@/components/erp/CloudinaryPicker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useActionToast } from "@/hooks/use-action-toast";
import { cloudinaryOriginalUrl } from "@/lib/cloudinary";
import {
  BHUTAN_ISR_CHECKLIST,
  ISR_LABOUR_FILING_STEPS,
  ISR_STATUS_LABEL,
  type IsrStatus,
} from "@/lib/hr/isr-bhutan";
import { cn } from "@/lib/utils";
import {
  CheckCircle2Icon,
  FileTextIcon,
  ScaleIcon,
  UploadCloudIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";

export type IsrRow = {
  id: string;
  versionLabel: string;
  title: string;
  status: IsrStatus;
  notes: string | null;
  scopeSummary: string | null;
  submittedOn: string | null;
  labourOffice: string | null;
  labourReference: string | null;
  approvedOn: string | null;
  approvalReference: string | null;
  signedOn: string | null;
  signedByName: string | null;
  pdfPublicId: string | null;
  pdfResourceType: string;
  pdfFileName: string | null;
  pdfUploadedAt: string | null;
  effectiveFrom: string | null;
  effectiveTo: string | null;
  isCurrent: boolean;
  createdAt: string;
};

const initial: IsrActionState = { ok: false };

function statusBadgeVariant(
  status: IsrStatus,
): "default" | "secondary" | "outline" | "destructive" {
  if (status === "active") return "default";
  if (status === "superseded") return "outline";
  if (status === "approved") return "secondary";
  return "outline";
}

function pdfUrl(row: IsrRow): string | null {
  if (!row.pdfPublicId) return null;
  const cloud =
    process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME?.trim() ||
    process.env.CLOUDINARY_CLOUD_NAME?.trim() ||
    "";
  if (!cloud) return cloudinaryOriginalUrl(row.pdfPublicId, "pdf");
  const clean = row.pdfPublicId.replace(/^\/+/, "").replace(/\.pdf$/i, "");
  if (row.pdfResourceType === "raw") {
    return `https://res.cloudinary.com/${cloud}/raw/upload/${clean}`;
  }
  return cloudinaryOriginalUrl(row.pdfPublicId, "pdf");
}

export function IsrWorkbench({ rows }: { rows: IsrRow[] }) {
  const current = rows.find((r) => r.isCurrent) ?? null;
  const [selectedId, setSelectedId] = useState<string | null>(
    current?.id ?? rows[0]?.id ?? null,
  );
  const selected =
    rows.find((r) => r.id === selectedId) ?? rows[0] ?? null;

  return (
    <div className="space-y-8">
      <FilingPathway current={current} />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,18rem)_1fr]">
        <aside className="space-y-4">
          <CreateIsrCard />
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Versions</CardTitle>
              <CardDescription>
                One active signed copy is the in-force ISR.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {rows.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No ISR yet. Create a version (e.g. 2026.1).
                </p>
              ) : (
                rows.map((row) => (
                  <button
                    key={row.id}
                    type="button"
                    onClick={() => setSelectedId(row.id)}
                    className={cn(
                      "flex w-full flex-col gap-1 rounded-xl border px-3 py-2.5 text-left transition-colors",
                      selected?.id === row.id
                        ? "border-accent bg-accent/5 ring-1 ring-accent/30"
                        : "hover:bg-muted/40",
                    )}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="font-medium tabular-nums">
                        {row.versionLabel}
                      </span>
                      {row.isCurrent ? (
                        <Badge className="text-[10px]">Current</Badge>
                      ) : null}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {ISR_STATUS_LABEL[row.status]}
                    </span>
                  </button>
                ))
              )}
            </CardContent>
          </Card>
        </aside>

        <div className="min-w-0 space-y-6">
          {selected ? (
            <IsrDetail row={selected} />
          ) : (
            <Card>
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                Create an ISR version to start the Labour filing path.
              </CardContent>
            </Card>
          )}

          <BhutanChecklist />
        </div>
      </div>
    </div>
  );
}

function FilingPathway({ current }: { current: IsrRow | null }) {
  return (
    <Card className="overflow-hidden border-accent/20 bg-gradient-to-br from-muted/30 via-background to-background">
      <CardHeader>
        <div className="flex flex-wrap items-start gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-accent/10 text-accent">
            <ScaleIcon className="size-5" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <CardTitle>Internal Service Rules → Labour</CardTitle>
            <CardDescription className="mt-1 max-w-2xl">
              Prepare ISR for Bhutan Labour filing. Track submission and
              approval, then upload the signed PDF. This archive is the hotel
              record — not a substitute for the paper file at Labour.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {ISR_LABOUR_FILING_STEPS.map((s) => (
            <li
              key={s.step}
              className="rounded-xl border bg-card px-3 py-3 text-sm"
            >
              <p className="text-[11px] font-semibold tracking-wide text-accent uppercase">
                Step {s.step}
              </p>
              <p className="mt-1 font-medium">{s.title}</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                {s.body}
              </p>
            </li>
          ))}
        </ol>
        {current?.pdfPublicId ? (
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-citrus/30 bg-citrus/5 px-4 py-3 text-sm">
            <CheckCircle2Icon className="size-4 shrink-0 text-citrus" />
            <span>
              Current in-force:{" "}
              <span className="font-semibold tabular-nums">
                {current.versionLabel}
              </span>
              {current.signedOn ? ` · signed ${current.signedOn}` : ""}
            </span>
            {pdfUrl(current) ? (
              <Button asChild size="sm" variant="outline" className="ml-auto h-9">
                <a href={pdfUrl(current)!} target="_blank" rel="noreferrer">
                  Open signed PDF
                </a>
              </Button>
            ) : null}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            No active signed PDF yet. Complete the steps below for a version.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function CreateIsrCard() {
  const router = useRouter();
  const [state, action, pending] = useActionState(createIsrVersion, initial);
  useActionToast(state, { successMessage: "ISR draft created" });
  useEffect(() => {
    if (state.ok) router.refresh();
  }, [state.ok, router]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">New version</CardTitle>
        <CardDescription>e.g. 2026.1 or 2026-labour-v1</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={action} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="isr_ver">Version label</Label>
            <Input
              id="isr_ver"
              name="version_label"
              required
              className="h-11"
              placeholder="2026.1"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="isr_title">Title</Label>
            <Input
              id="isr_title"
              name="title"
              className="h-11"
              defaultValue="Internal Service Rules"
            />
          </div>
          {state.error ? (
            <p className="text-sm text-destructive" role="status">
              {state.error}
            </p>
          ) : null}
          <Button
            type="submit"
            variant="citrus"
            className="h-11 w-full"
            disabled={pending}
          >
            {pending ? "Creating…" : "Create draft"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function IsrDetail({ row }: { row: IsrRow }) {
  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold tracking-[0.18em] text-accent uppercase">
            Version {row.versionLabel}
          </p>
          <h2 className="mt-1 text-xl font-semibold tracking-tight">
            {row.title}
          </h2>
          <div className="mt-2 flex flex-wrap gap-2">
            <Badge variant={statusBadgeVariant(row.status)}>
              {ISR_STATUS_LABEL[row.status]}
            </Badge>
            {row.isCurrent ? <Badge>In force</Badge> : null}
          </div>
        </div>
        {row.pdfPublicId && pdfUrl(row) ? (
          <Button asChild variant="outline" className="h-10 gap-2">
            <a href={pdfUrl(row)!} target="_blank" rel="noreferrer">
              <FileTextIcon className="size-4" />
              View PDF
            </a>
          </Button>
        ) : null}
      </header>

      <DetailsForm row={row} />
      <SubmitForm row={row} />
      <ApproveForm row={row} />
      <PdfForm row={row} />
    </div>
  );
}

function DetailsForm({ row }: { row: IsrRow }) {
  const router = useRouter();
  const [state, action, pending] = useActionState(updateIsrDetails, initial);
  useActionToast(state, { successMessage: "Details saved" });
  useEffect(() => {
    if (state.ok) router.refresh();
  }, [state.ok, router]);

  if (row.status === "superseded") {
    return (
      <Card>
        <CardContent className="py-4 text-sm text-muted-foreground">
          This version is superseded and is read-only.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Details</CardTitle>
        <CardDescription>Who the rules cover and filing notes.</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={action} className="space-y-3">
          <input type="hidden" name="isr_id" value={row.id} />
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="d_title">Title</Label>
              <Input
                id="d_title"
                name="title"
                defaultValue={row.title}
                className="h-11"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="d_sig">Employer signatory (name)</Label>
              <Input
                id="d_sig"
                name="signed_by_name"
                defaultValue={row.signedByName ?? ""}
                className="h-11"
                placeholder="Owner / GM name"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="d_scope">Scope summary</Label>
            <Textarea
              id="d_scope"
              name="scope_summary"
              defaultValue={row.scopeSummary ?? ""}
              rows={2}
              placeholder="Applies to all staff of … except …"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="d_from">Effective from</Label>
              <Input
                id="d_from"
                name="effective_from"
                type="date"
                defaultValue={row.effectiveFrom ?? ""}
                className="h-11"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="d_to">Effective to</Label>
              <Input
                id="d_to"
                name="effective_to"
                type="date"
                defaultValue={row.effectiveTo ?? ""}
                className="h-11"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="d_notes">Internal notes</Label>
            <Textarea
              id="d_notes"
              name="notes"
              defaultValue={row.notes ?? ""}
              rows={2}
              placeholder="Lawyer review, translator, filing appointments…"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="d_office">Default Labour office</Label>
            <Input
              id="d_office"
              name="labour_office"
              defaultValue={row.labourOffice ?? ""}
              className="h-11"
              placeholder="e.g. Labour office, Thimphu"
            />
          </div>
          {state.error ? (
            <p className="text-sm text-destructive">{state.error}</p>
          ) : null}
          <Button type="submit" variant="outline" className="h-11" disabled={pending}>
            {pending ? "Saving…" : "Save details"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function SubmitForm({ row }: { row: IsrRow }) {
  const router = useRouter();
  const [state, action, pending] = useActionState(markIsrSubmitted, initial);
  useActionToast(state, { successMessage: "Marked submitted" });
  useEffect(() => {
    if (state.ok) router.refresh();
  }, [state.ok, router]);

  if (row.status !== "draft" && row.status !== "submitted") return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">2 · Submit to Labour</CardTitle>
        <CardDescription>
          Record when the ISR was filed with the Labour office.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={action} className="space-y-3">
          <input type="hidden" name="isr_id" value={row.id} />
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="s_date">Submitted on</Label>
              <Input
                id="s_date"
                name="submitted_on"
                type="date"
                className="h-11"
                defaultValue={
                  row.submittedOn ?? new Date().toISOString().slice(0, 10)
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="s_ref">Labour file / reference no.</Label>
              <Input
                id="s_ref"
                name="labour_reference"
                className="h-11"
                defaultValue={row.labourReference ?? ""}
                placeholder="If issued on filing"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="s_office">Labour office</Label>
            <Input
              id="s_office"
              name="labour_office"
              required
              className="h-11"
              defaultValue={row.labourOffice ?? ""}
              placeholder="Office name / location"
            />
          </div>
          {state.error ? (
            <p className="text-sm text-destructive">{state.error}</p>
          ) : null}
          <Button type="submit" variant="citrus" className="h-11" disabled={pending}>
            {pending ? "Saving…" : "Mark submitted"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function ApproveForm({ row }: { row: IsrRow }) {
  const router = useRouter();
  const [state, action, pending] = useActionState(markIsrApproved, initial);
  useActionToast(state, { successMessage: "Approval recorded" });
  useEffect(() => {
    if (state.ok) router.refresh();
  }, [state.ok, router]);

  if (row.status !== "submitted" && row.status !== "approved") return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">3 · Labour approved</CardTitle>
        <CardDescription>
          Enter approval date and stamp / approval reference from the returned
          document.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={action} className="space-y-3">
          <input type="hidden" name="isr_id" value={row.id} />
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="a_date">Approved on</Label>
              <Input
                id="a_date"
                name="approved_on"
                type="date"
                className="h-11"
                defaultValue={
                  row.approvedOn ?? new Date().toISOString().slice(0, 10)
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="a_ref">Approval reference</Label>
              <Input
                id="a_ref"
                name="approval_reference"
                className="h-11"
                defaultValue={row.approvalReference ?? ""}
              />
            </div>
          </div>
          {state.error ? (
            <p className="text-sm text-destructive">{state.error}</p>
          ) : null}
          <Button type="submit" variant="citrus" className="h-11" disabled={pending}>
            {pending ? "Saving…" : "Record approval"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function PdfForm({ row }: { row: IsrRow }) {
  const router = useRouter();
  const [state, action, pending] = useActionState(uploadIsrSignedPdf, initial);
  const [actState, actAction, actPending] = useActionState(activateIsr, initial);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [publicId, setPublicId] = useState(row.pdfPublicId ?? "");
  const [resourceType, setResourceType] = useState(row.pdfResourceType || "raw");
  const [fileName, setFileName] = useState(row.pdfFileName ?? "");

  useActionToast(state, { successMessage: "PDF saved" });
  useActionToast(actState, { successMessage: "ISR activated" });
  useEffect(() => {
    if (state.ok || actState.ok) router.refresh();
  }, [state.ok, actState.ok, router]);

  if (row.status === "superseded") return null;

  const canActivate =
    Boolean(row.pdfPublicId || publicId) &&
    (row.status === "approved" || row.status === "active");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">4 · Signed PDF</CardTitle>
        <CardDescription>
          Upload the wet-signed / stamp-approved ISR as PDF. Tick “Set as
          current” after Labour approval to make it the in-force copy (also
          archives under Settings → Compliance).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form action={action} className="space-y-3">
          <input type="hidden" name="isr_id" value={row.id} />
          <input type="hidden" name="cloudinary_public_id" value={publicId} />
          <input type="hidden" name="resource_type" value={resourceType} />
          <input type="hidden" name="pdf_file_name" value={fileName} />

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-11 gap-2"
              onClick={() => setPickerOpen(true)}
            >
              <UploadCloudIcon className="size-4" />
              {publicId ? "Replace PDF" : "Upload signed PDF"}
            </Button>
            {publicId ? (
              <span className="truncate text-xs text-muted-foreground">
                {fileName || publicId.split("/").pop()}
              </span>
            ) : (
              <span className="text-xs text-muted-foreground">
                PDF only · full signed document
              </span>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="p_signed">Signed on</Label>
              <Input
                id="p_signed"
                name="signed_on"
                type="date"
                className="h-11"
                defaultValue={
                  row.signedOn ?? new Date().toISOString().slice(0, 10)
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p_by">Signed by</Label>
              <Input
                id="p_by"
                name="signed_by_name"
                className="h-11"
                defaultValue={row.signedByName ?? ""}
              />
            </div>
          </div>

          <label className="flex min-h-11 items-start gap-3 rounded-xl border bg-background px-3 py-3 text-sm">
            <input
              type="checkbox"
              name="make_active"
              className="mt-1 size-4 rounded border"
              defaultChecked={row.status === "approved"}
              disabled={row.status === "draft" || row.status === "submitted"}
            />
            <span>
              <span className="font-medium">Set as current in-force ISR</span>
              <span className="mt-1 block text-xs text-muted-foreground">
                Requires Labour approval status. Supersedes the previous current
                version.
              </span>
            </span>
          </label>

          {state.error ? (
            <p className="text-sm text-destructive">{state.error}</p>
          ) : null}
          <Button
            type="submit"
            variant="citrus"
            className="h-11"
            disabled={pending || !publicId}
          >
            {pending ? "Saving…" : "Save signed PDF"}
          </Button>
        </form>

        {canActivate && row.status === "approved" && row.pdfPublicId ? (
          <form action={actAction} className="border-t pt-3">
            <input type="hidden" name="isr_id" value={row.id} />
            {actState.error ? (
              <p className="mb-2 text-sm text-destructive">{actState.error}</p>
            ) : null}
            <Button
              type="submit"
              variant="outline"
              className="h-11"
              disabled={actPending}
            >
              {actPending ? "Activating…" : "Activate without re-upload"}
            </Button>
          </form>
        ) : null}

        <CloudinaryPicker
          open={pickerOpen}
          onOpenChange={setPickerOpen}
          uploadFolder="pelbu/hr/isr"
          title="Signed ISR PDF"
          description="Upload the Labour-approved, employer-signed Internal Service Rules as PDF."
          acceptVideo={false}
          acceptPdf
          initialTab="upload"
          onSelect={(id, meta) => {
            setPublicId(id);
            setResourceType(meta?.resourceType ?? "raw");
            setFileName(
              `${id.split("/").pop() ?? "isr"}.${meta?.format || "pdf"}`,
            );
            setPickerOpen(false);
          }}
        />
      </CardContent>
    </Card>
  );
}

function BhutanChecklist() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          Bhutan ISR preparation checklist
        </CardTitle>
        <CardDescription>
          Use when drafting the Word/PDF for Labour. Based on the Labour and
          Employment Act frame, Regulation on Working Conditions 2022, NPPF,
          and hotel practice. Confirm final wording with your counsel or Labour
          officer — not legal advice.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {BHUTAN_ISR_CHECKLIST.map((section) => (
          <div key={section.id} className="rounded-xl border px-4 py-3">
            <p className="font-medium">{section.title}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {section.blurb}
            </p>
            <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-muted-foreground">
              {section.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
