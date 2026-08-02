"use client";

import {
  getDotEvidencePreviewUrl,
  removeDotEvidence,
  saveDotEvidence,
  saveDotResponse,
} from "@/app/actions/erp-dot-assessment";
import { GATE_EVIDENCE_HINTS } from "@/lib/dot-assessment/guidance";
import type {
  CriterionKind,
  DotEvidence,
  DotResponse,
} from "@/lib/dot-assessment/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  CameraIcon,
  CheckIcon,
  ChevronDownIcon,
  ImageIcon,
  Loader2Icon,
  XIcon,
} from "lucide-react";
import {
  memo,
  useCallback,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";

export type CriterionRowProps = {
  assessmentId: string;
  code: string;
  text: string;
  kind: CriterionKind;
  maxPoints?: number | null;
  notes?: string | null;
  sectionKey: string;
  response?: DotResponse;
  evidence: DotEvidence[];
  readOnly?: boolean;
  onResponseChange: (response: DotResponse) => void;
  onEvidenceAdd: (evidence: DotEvidence) => void;
  onEvidenceRemove: (evidenceId: string) => void;
  /** Compact walk mode: auto-advance focus after Yes */
  dense?: boolean;
};

const kindStyles: Record<CriterionKind, string> = {
  M: "bg-amber-500/15 text-amber-800 dark:text-amber-200",
  Q: "bg-sky-500/15 text-sky-800 dark:text-sky-200",
  P: "bg-emerald-500/15 text-emerald-800 dark:text-emerald-200",
  X: "bg-muted text-muted-foreground",
  custom: "bg-violet-500/15 text-violet-800 dark:text-violet-200",
};

function answerState(response?: DotResponse): "yes" | "no" | "scored" | "open" | "na" {
  if (!response || response.status === "pending") return "open";
  if (response.status === "na") return "na";
  if (response.status === "yes" || response.scoreM === 1) return "yes";
  if (response.status === "no" || response.scoreM === 0) return "no";
  if (response.status === "scored" || response.scoreQ != null || response.scoreP != null)
    return "scored";
  return "open";
}

function CriterionRowInner({
  assessmentId,
  code,
  text,
  kind,
  maxPoints,
  notes,
  sectionKey,
  response,
  evidence,
  readOnly,
  onResponseChange,
  onEvidenceAdd,
  onEvidenceRemove,
  dense,
}: CriterionRowProps) {
  const [pending, startTransition] = useTransition();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flashOk, setFlashOk] = useState(false);
  const [remarks, setRemarks] = useState(response?.remarks ?? "");
  const [notesOpen, setNotesOpen] = useState(
    Boolean(response?.remarks || evidence.length),
  );
  const [localM, setLocalM] = useState<number | null>(
    response?.scoreM ??
      (response?.status === "yes" ? 1 : response?.status === "no" ? 0 : null),
  );
  const [localQ, setLocalQ] = useState<number | null>(response?.scoreQ ?? null);
  const [localP, setLocalP] = useState<string>(
    response?.scoreP != null ? String(response.scoreP) : "",
  );
  const remarksTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const answered = answerState(response);
  const hint = GATE_EVIDENCE_HINTS[code];

  useEffect(() => {
    setRemarks(response?.remarks ?? "");
    setLocalM(
      response?.scoreM ??
        (response?.status === "yes" ? 1 : response?.status === "no" ? 0 : null),
    );
    setLocalQ(response?.scoreQ ?? null);
    setLocalP(response?.scoreP != null ? String(response.scoreP) : "");
  }, [response]);

  const persist = useCallback(
    (patch: {
      status?: string;
      scoreM?: number | null;
      scoreQ?: number | null;
      scoreP?: number | null;
      remarks?: string | null;
    }) => {
      if (readOnly || kind === "X") return;

      const optimistic: DotResponse = {
        criterionCode: code,
        sectionKey,
        status:
          patch.status === "yes"
            ? "yes"
            : patch.status === "no"
              ? "no"
              : patch.status === "pending"
                ? "pending"
                : patch.status === "na"
                  ? "na"
                  : "scored",
        scoreM:
          patch.scoreM !== undefined
            ? patch.scoreM
            : patch.status === "yes"
              ? 1
              : patch.status === "no"
                ? 0
                : patch.status === "pending"
                  ? null
                  : (localM ?? null),
        scoreQ:
          patch.scoreQ !== undefined
            ? patch.scoreQ
            : (localQ ?? response?.scoreQ ?? null),
        scoreP:
          patch.scoreP !== undefined
            ? patch.scoreP
            : localP !== ""
              ? Number(localP)
              : (response?.scoreP ?? null),
        remarks:
          patch.remarks !== undefined
            ? patch.remarks
            : remarks || null,
      };
      onResponseChange(optimistic);
      setError(null);
      setFlashOk(false);

      startTransition(async () => {
        const res = await saveDotResponse({
          assessmentId,
          criterionCode: code,
          sectionKey,
          status: patch.status ?? optimistic.status,
          scoreM: optimistic.scoreM,
          scoreQ: optimistic.scoreQ,
          scoreP: optimistic.scoreP,
          remarks: optimistic.remarks,
        });
        if (!res.ok) {
          setError(res.error ?? "Save failed");
          if (response) onResponseChange(response);
          return;
        }
        if (res.response) onResponseChange(res.response);
        setFlashOk(true);
        window.setTimeout(() => setFlashOk(false), 1200);
      });
    },
    [
      assessmentId,
      code,
      kind,
      localM,
      localP,
      localQ,
      onResponseChange,
      readOnly,
      remarks,
      response,
      sectionKey,
    ],
  );

  function scheduleRemarks(value: string) {
    setRemarks(value);
    if (readOnly || kind === "X") return;
    if (remarksTimer.current) clearTimeout(remarksTimer.current);
    remarksTimer.current = setTimeout(() => {
      persist({ remarks: value });
    }, 500);
  }

  async function onFile(file: File | null) {
    if (!file || readOnly) return;
    setError(null);
    setUploading(true);
    try {
      const signRes = await fetch("/api/erp/finance/upload", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          kind: "dot_assessment",
          fileName: file.name,
          mimeType: file.type || "image/jpeg",
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
        headers: { "content-type": file.type || "image/jpeg" },
        body: file,
      });
      if (!put.ok) throw new Error("Upload to storage failed.");
      const res = await saveDotEvidence({
        assessmentId,
        criterionCode: code,
        storagePath: signed.path,
        fileName: file.name,
        mimeType: file.type || "image/jpeg",
        byteSize: file.size,
      });
      if (!res.ok || !res.evidence) throw new Error(res.error ?? "Register failed.");
      onEvidenceAdd(res.evidence);
      setNotesOpen(true);
      setFlashOk(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function openEvidence(path: string) {
    const res = await getDotEvidencePreviewUrl(path);
    if (res.url) window.open(res.url, "_blank", "noopener,noreferrer");
  }

  async function removeEvid(id: string) {
    onEvidenceRemove(id);
    const res = await removeDotEvidence({ assessmentId, evidenceId: id });
    if (!res.ok) setError(res.error ?? "Could not remove.");
  }

  if (kind === "X") {
    return (
      <div
        className="flex items-start gap-3 border-b border-border/60 px-1 py-2.5 opacity-50"
        data-code={code}
      >
        <span className="mt-0.5 shrink-0 font-mono text-[10px] text-muted-foreground">
          {code}
        </span>
        <p className="flex-1 text-sm text-muted-foreground line-through decoration-muted-foreground/40">
          {text}
        </p>
        <span className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase text-muted-foreground">
          N/A
        </span>
      </div>
    );
  }

  return (
    <article
      className={cn(
        "group rounded-xl border bg-card transition-colors",
        dense ? "p-3" : "p-3.5 sm:p-4",
        answered === "yes" || answered === "scored"
          ? "border-emerald-500/30 bg-emerald-500/[0.04]"
          : answered === "no"
            ? "border-destructive/30 bg-destructive/[0.04]"
            : "border-border",
      )}
      data-code={code}
    >
      <div className="flex items-start gap-2.5">
        <div
          className={cn(
            "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold",
            answered === "yes" || answered === "scored"
              ? "bg-emerald-500 text-white"
              : answered === "no"
                ? "bg-destructive text-white"
                : "bg-muted text-muted-foreground",
          )}
          aria-hidden
        >
          {answered === "yes" || answered === "scored" ? (
            <CheckIcon className="size-3.5" />
          ) : answered === "no" ? (
            <XIcon className="size-3.5" />
          ) : (
            "·"
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-mono text-[10px] text-muted-foreground">
              {code}
            </span>
            <span
              className={cn(
                "rounded px-1.5 py-0.5 text-[10px] font-semibold tracking-wide uppercase",
                kindStyles[kind],
              )}
            >
              {kind}
              {kind === "P" && maxPoints != null ? ` ≤${maxPoints}` : ""}
            </span>
            {(pending || uploading) && (
              <Loader2Icon className="size-3.5 animate-spin text-muted-foreground" />
            )}
            {flashOk && !pending && (
              <span className="text-[10px] font-medium text-emerald-600">
                Saved
              </span>
            )}
            {error && (
              <span className="text-[10px] text-destructive">{error}</span>
            )}
          </div>
          <p className="text-sm leading-snug text-foreground">{text}</p>
          {notes ? (
            <p className="text-[11px] text-muted-foreground">Note: {notes}</p>
          ) : null}
          {hint ? (
            <p className="text-[11px] text-sky-700 dark:text-sky-300">
              {hint.tip}
            </p>
          ) : null}

          {(kind === "M" || code.startsWith("gate.") || kind === "custom") &&
            maxPoints == null && (
              <div
                className="inline-flex overflow-hidden rounded-lg border bg-background p-0.5"
                role="group"
                aria-label="Pass or fail"
              >
                <button
                  type="button"
                  disabled={readOnly || pending}
                  onClick={() => {
                    setLocalM(1);
                    persist({ status: "yes", scoreM: 1 });
                  }}
                  className={cn(
                    "min-w-[4.5rem] px-3 py-2 text-sm font-medium transition-colors",
                    localM === 1
                      ? "rounded-md bg-emerald-500 text-white shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  Yes
                </button>
                <button
                  type="button"
                  disabled={readOnly || pending}
                  onClick={() => {
                    setLocalM(0);
                    persist({ status: "no", scoreM: 0 });
                  }}
                  className={cn(
                    "min-w-[4.5rem] px-3 py-2 text-sm font-medium transition-colors",
                    localM === 0
                      ? "rounded-md bg-destructive text-white shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  No
                </button>
              </div>
            )}

          {kind === "Q" && (
            <div
              className="inline-flex overflow-hidden rounded-lg border bg-background p-0.5"
              role="group"
              aria-label="Quality 1 to 5"
            >
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  disabled={readOnly || pending}
                  onClick={() => {
                    setLocalQ(n);
                    persist({ status: "scored", scoreQ: n });
                  }}
                  className={cn(
                    "size-9 text-sm font-semibold transition-colors sm:size-10",
                    localQ === n
                      ? "rounded-md bg-sky-500 text-white shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {n}
                </button>
              ))}
            </div>
          )}

          {(kind === "P" || (kind === "custom" && maxPoints != null)) && (
            <div className="flex max-w-[12rem] items-center gap-2">
              <Input
                type="number"
                min={0}
                max={maxPoints ?? undefined}
                step={1}
                inputMode="numeric"
                className="h-10"
                value={localP}
                disabled={readOnly}
                placeholder={`0–${maxPoints ?? "?"}`}
                onChange={(e) => setLocalP(e.target.value)}
                onBlur={() => {
                  if (localP === "") return;
                  const n = Number(localP);
                  if (!Number.isFinite(n)) return;
                  persist({ status: "scored", scoreP: n });
                }}
              />
              <span className="text-xs text-muted-foreground">pts</span>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-1">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-8 gap-1 px-2 text-xs"
              onClick={() => setNotesOpen((v) => !v)}
            >
              Remarks
              {remarks || evidence.length ? (
                <span className="rounded-full bg-muted px-1.5 text-[10px]">
                  {(remarks ? 1 : 0) + evidence.length}
                </span>
              ) : null}
              <ChevronDownIcon
                className={cn(
                  "size-3.5 transition-transform",
                  notesOpen && "rotate-180",
                )}
              />
            </Button>
            {!readOnly && (
              <>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*,application/pdf"
                  capture="environment"
                  className="sr-only"
                  onChange={(e) => onFile(e.target.files?.[0] ?? null)}
                />
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-8 gap-1 px-2 text-xs"
                  disabled={uploading}
                  onClick={() => fileRef.current?.click()}
                >
                  {uploading ? (
                    <Loader2Icon className="size-3.5 animate-spin" />
                  ) : (
                    <CameraIcon className="size-3.5" />
                  )}
                  Photo
                </Button>
              </>
            )}
            {localM != null && !readOnly && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-8 px-2 text-xs text-muted-foreground"
                onClick={() => {
                  setLocalM(null);
                  setLocalQ(null);
                  setLocalP("");
                  persist({
                    status: "pending",
                    scoreM: null,
                    scoreQ: null,
                    scoreP: null,
                  });
                }}
              >
                Clear
              </Button>
            )}
          </div>

          {notesOpen && (
            <div className="space-y-2 border-t border-border/60 pt-2">
              <Textarea
                value={remarks}
                disabled={readOnly}
                rows={2}
                className="min-h-[4rem] text-sm"
                placeholder="Notes, measurements, staff names…"
                onChange={(e) => scheduleRemarks(e.target.value)}
              />
              {evidence.length > 0 && (
                <ul className="flex flex-wrap gap-2">
                  {evidence.map((ev) => (
                    <li
                      key={ev.id}
                      className="inline-flex items-center gap-1 rounded-lg border bg-muted/40 px-2 py-1 text-xs"
                    >
                      <ImageIcon className="size-3 text-muted-foreground" />
                      <button
                        type="button"
                        className="max-w-[10rem] truncate text-sky-700 hover:underline dark:text-sky-300"
                        onClick={() => openEvidence(ev.storagePath)}
                      >
                        {ev.fileName}
                      </button>
                      {!readOnly && (
                        <button
                          type="button"
                          className="text-muted-foreground hover:text-destructive"
                          aria-label="Remove evidence"
                          onClick={() => removeEvid(ev.id)}
                        >
                          <XIcon className="size-3" />
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

export const CriterionRow = memo(CriterionRowInner);
