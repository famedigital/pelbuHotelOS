"use client";

import {
  deletePositionTemplate,
  upsertJobPosition,
  upsertPositionTemplate,
  type VacancyActionState,
} from "@/app/actions/erp-vacancies";
import {
  CloudinaryPicker,
  type CloudinaryPickerSelection,
} from "@/components/erp/CloudinaryPicker";
import { DepartmentSelect } from "@/components/erp/DepartmentSelect";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useActionToast } from "@/hooks/use-action-toast";
import { cloudinaryOriginalUrl, cloudinaryUrl } from "@/lib/cloudinary";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";

const selectClass =
  "flex h-11 w-full min-h-11 rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]";

const initial: VacancyActionState = { ok: false };

export type PositionRow = {
  id: string;
  title: string;
  department: string;
  employmentTypeDefault: string;
  torSummary: string | null;
  torBody: string | null;
  publishTorPublic: boolean;
  isActive: boolean;
  templateCount: number;
};

export type TemplateRow = {
  id: string;
  positionId: string;
  templateKind: string;
  title: string;
  cloudinaryPublicId: string;
  resourceType: string;
  isPublic: boolean;
};

function ActionResult({ state }: { state: VacancyActionState }) {
  if (!state.error && !state.message) return null;
  return (
    <p
      className={`text-sm ${state.ok ? "text-citrus" : "text-destructive"}`}
      role="status"
    >
      {state.error ?? state.message}
    </p>
  );
}

function templateOpenUrl(t: TemplateRow): string | null {
  if (
    t.resourceType === "raw" ||
    t.cloudinaryPublicId.toLowerCase().includes(".pdf") ||
    t.templateKind === "tor"
  ) {
    return cloudinaryOriginalUrl(t.cloudinaryPublicId, "pdf");
  }
  if (t.resourceType === "image") {
    return cloudinaryUrl(t.cloudinaryPublicId, { width: 1600, crop: "limit" });
  }
  return (
    cloudinaryOriginalUrl(t.cloudinaryPublicId) ??
    cloudinaryUrl(t.cloudinaryPublicId)
  );
}

export function PositionCreateForm({
  departments = [],
}: {
  departments?: string[];
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState(upsertJobPosition, initial);
  useActionToast(state, { successMessage: "Position saved" });
  useEffect(() => {
    if (state.ok) router.refresh();
  }, [state.ok, router]);

  return (
    <form action={action} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="pos_title">Position title</Label>
          <Input
            id="pos_title"
            name="title"
            required
            placeholder="Waiter / Night auditor"
            className="min-h-11"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pos_dept">Department</Label>
          <DepartmentSelect
            id="pos_dept"
            name="department"
            departments={departments}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pos_type">Default employment type</Label>
          <select
            id="pos_type"
            name="employment_type_default"
            className={selectClass}
            defaultValue="full_time"
          >
            <option value="full_time">Full time</option>
            <option value="part_time">Part time</option>
            <option value="casual">Casual</option>
            <option value="contract">Contract</option>
            <option value="intern">Intern</option>
          </select>
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="pos_sum">TOR summary (public-safe)</Label>
          <Textarea
            id="pos_sum"
            name="tor_summary"
            rows={2}
            placeholder="One short paragraph for careers cards…"
          />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="pos_tor">Full TOR / duties</Label>
          <Textarea
            id="pos_tor"
            name="tor_body"
            rows={6}
            placeholder="Responsibilities, reporting line, hours, requirements…"
          />
        </div>
        <label className="flex min-h-11 items-start gap-3 rounded-md border bg-background px-3 py-3 text-sm sm:col-span-2">
          <input
            type="checkbox"
            name="publish_tor_public"
            className="mt-1 size-4 rounded border"
          />
          <span>
            <span className="font-medium">Publish TOR on careers</span>
            <span className="mt-1 block text-muted-foreground">
              Requires summary or full TOR text. File templates use their own
              public flag.
            </span>
          </span>
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending} className="min-h-11">
          {pending ? "Saving…" : "Create position"}
        </Button>
        <ActionResult state={state} />
      </div>
    </form>
  );
}

export function PositionEditForm({
  position,
  departments = [],
}: {
  position: PositionRow;
  departments?: string[];
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState(upsertJobPosition, initial);
  useActionToast(state, { successMessage: "Position updated" });
  useEffect(() => {
    if (state.ok) router.refresh();
  }, [state.ok, router]);

  return (
    <form action={action} className="space-y-3 rounded-lg border bg-muted/20 p-3">
      <input type="hidden" name="id" value={position.id} />
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={`edit_title_${position.id}`}>Title</Label>
          <Input
            id={`edit_title_${position.id}`}
            name="title"
            required
            defaultValue={position.title}
            className="min-h-11"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`edit_dept_${position.id}`}>Department</Label>
          <DepartmentSelect
            id={`edit_dept_${position.id}`}
            name="department"
            departments={departments}
            defaultValue={position.department}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`edit_type_${position.id}`}>Employment type</Label>
          <select
            id={`edit_type_${position.id}`}
            name="employment_type_default"
            className={selectClass}
            defaultValue={position.employmentTypeDefault}
          >
            <option value="full_time">Full time</option>
            <option value="part_time">Part time</option>
            <option value="casual">Casual</option>
            <option value="contract">Contract</option>
            <option value="intern">Intern</option>
          </select>
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor={`edit_sum_${position.id}`}>TOR summary</Label>
          <Textarea
            id={`edit_sum_${position.id}`}
            name="tor_summary"
            rows={2}
            defaultValue={position.torSummary ?? ""}
          />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor={`edit_tor_${position.id}`}>Full TOR</Label>
          <Textarea
            id={`edit_tor_${position.id}`}
            name="tor_body"
            rows={5}
            defaultValue={position.torBody ?? ""}
          />
        </div>
        <label className="flex min-h-11 items-start gap-3 rounded-md border bg-background px-3 py-3 text-sm">
          <input
            type="checkbox"
            name="publish_tor_public"
            defaultChecked={position.publishTorPublic}
            className="mt-1 size-4 rounded border"
          />
          <span className="font-medium">Publish TOR on careers</span>
        </label>
        <label className="flex min-h-11 items-start gap-3 rounded-md border bg-background px-3 py-3 text-sm">
          <input
            type="checkbox"
            name="is_active"
            value="on"
            defaultChecked={position.isActive}
            className="mt-1 size-4 rounded border"
          />
          <span className="font-medium">Active (available for new vacancies)</span>
        </label>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={pending} className="min-h-11">
          {pending ? "Saving…" : "Save position"}
        </Button>
        <ActionResult state={state} />
      </div>
    </form>
  );
}

export function PositionTemplateUploadForm({
  positionId,
}: {
  positionId: string;
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState(upsertPositionTemplate, initial);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [publicId, setPublicId] = useState("");
  const [resourceType, setResourceType] = useState("raw");
  useActionToast(state, { successMessage: "Template uploaded" });
  useEffect(() => {
    if (state.ok) {
      setPublicId("");
      router.refresh();
    }
  }, [state.ok, router]);

  return (
    <div className="space-y-3">
      <form action={action} className="space-y-3 rounded-lg border p-3">
        <input type="hidden" name="position_id" value={positionId} />
        <input type="hidden" name="cloudinary_public_id" value={publicId} />
        <input type="hidden" name="resource_type" value={resourceType} />
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor={`tpl_kind_${positionId}`}>Kind</Label>
            <select
              id={`tpl_kind_${positionId}`}
              name="template_kind"
              className={selectClass}
              defaultValue="tor"
            >
              <option value="tor">TOR PDF</option>
              <option value="job_desc">Job description</option>
              <option value="application_form">Application form</option>
              <option value="offer_letter">Offer letter (private)</option>
              <option value="contract">Contract (private)</option>
              <option value="checklist">Checklist</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`tpl_title_${positionId}`}>Title</Label>
            <Input
              id={`tpl_title_${positionId}`}
              name="title"
              placeholder="Optional display name"
              className="min-h-11"
            />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            onClick={() => setPickerOpen(true)}
          >
            {publicId ? "Replace file" : "Upload PDF / file"}
          </Button>
          {publicId ? (
            <span className="truncate text-xs text-muted-foreground">
              Attached: {publicId.split("/").pop()}
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">
              PDF recommended for TOR and forms.
            </span>
          )}
        </div>
        <label className="flex min-h-11 items-start gap-3 rounded-md border bg-background px-3 py-3 text-sm">
          <input
            type="checkbox"
            name="is_public"
            className="mt-1 size-4 rounded border"
          />
          <span>
            <span className="font-medium">Show on careers</span>
            <span className="mt-1 block text-xs text-muted-foreground">
              Offer/contract kinds stay private even if checked.
            </span>
          </span>
        </label>
        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="submit"
            disabled={pending || !publicId}
            className="min-h-11"
          >
            {pending ? "Saving…" : "Save template"}
          </Button>
          <ActionResult state={state} />
        </div>
      </form>
      <CloudinaryPicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        uploadFolder="pelbu/hr/positions"
        title="Position template"
        description="Upload TOR PDF, checklist, or form for this role."
        acceptVideo={false}
        acceptPdf
        initialTab="upload"
        onSelect={(id, meta?: CloudinaryPickerSelection) => {
          setPublicId(id);
          setResourceType(meta?.resourceType ?? "raw");
          setPickerOpen(false);
        }}
      />
    </div>
  );
}

export function PositionTemplatesList({
  templates,
  positionId,
}: {
  templates: TemplateRow[];
  positionId: string;
}) {
  const router = useRouter();
  const [state, action] = useActionState(deletePositionTemplate, initial);
  useActionToast(state, { successMessage: "Template removed" });
  useEffect(() => {
    if (state.ok) router.refresh();
  }, [state.ok, router]);

  if (templates.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No templates yet — upload a TOR PDF or form above.
      </p>
    );
  }

  return (
    <ul className="divide-y rounded-lg border">
      {templates.map((t) => {
        const url = templateOpenUrl(t);
        return (
          <li
            key={t.id}
            className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 text-sm"
          >
            <div className="min-w-0">
              <p className="font-medium">{t.title}</p>
              <p className="text-xs text-muted-foreground">
                {t.templateKind.replace(/_/g, " ")}
                {t.isPublic ? " · public" : " · desk only"}
              </p>
            </div>
            <div className="flex flex-wrap gap-1">
              {url ? (
                <Button asChild variant="outline" size="sm" className="h-9">
                  <a href={url} target="_blank" rel="noreferrer">
                    Open
                  </a>
                </Button>
              ) : null}
              <form action={action}>
                <input type="hidden" name="id" value={t.id} />
                <input type="hidden" name="position_id" value={positionId} />
                <Button
                  type="submit"
                  variant="ghost"
                  size="sm"
                  className="h-9 text-destructive hover:text-destructive"
                >
                  Remove
                </Button>
              </form>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
