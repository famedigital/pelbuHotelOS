"use client";

import { updateDotAssessmentMeta } from "@/app/actions/erp-dot-assessment";
import { CriterionRow } from "@/components/erp/dot-assessment/CriterionRow";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  OVERVIEW_GUIDANCE,
  SCORING_GUIDANCE,
  WALK_ORDER_GUIDANCE,
  sectionGuidance,
} from "@/lib/dot-assessment/guidance";
import { computeScoreboard, type Scoreboard } from "@/lib/dot-assessment/score";
import type {
  DotAssessmentRow,
  DotCatalog,
  DotCriterion,
  DotEvidence,
  DotResponse,
} from "@/lib/dot-assessment/types";
import { cn } from "@/lib/utils";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CheckCircle2Icon,
  CircleIcon,
  FilterIcon,
  PrinterIcon,
} from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  useActionState,
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from "react";

export type DotStep =
  | "guide"
  | "property"
  | "gate"
  | "score"
  | `s:${string}`;

type FilterMode = "open" | "all" | "done" | "fail";

function parseStep(raw: string | null, catalog: DotCatalog): DotStep {
  if (!raw || raw === "guide") return "guide";
  if (raw === "property") return "property";
  if (raw === "gate") return "gate";
  if (raw === "score") return "score";
  if (raw.startsWith("s:")) {
    const key = raw.slice(2);
    if (catalog.sections.some((s) => s.key === key)) return `s:${key}`;
  }
  if (/^s\d+$/.test(raw)) {
    const order = Number(raw.slice(1));
    const sec = catalog.sections.find((s) => s.order === order);
    if (sec) return `s:${sec.key}`;
  }
  return "guide";
}

function isAnswered(r?: DotResponse): boolean {
  if (!r || r.status === "pending") return false;
  return true;
}

function isFail(r?: DotResponse): boolean {
  if (!r) return false;
  return r.status === "no" || r.scoreM === 0;
}

function filterCriterion(
  c: DotCriterion,
  response: DotResponse | undefined,
  mode: FilterMode,
): boolean {
  if (c.kind === "X") return mode === "all";
  if (mode === "all") return true;
  if (mode === "open") return !isAnswered(response);
  if (mode === "done") return isAnswered(response);
  if (mode === "fail") return isFail(response);
  return true;
}

function GuidanceBlock({
  title,
  paragraphs,
  bullets,
  compact,
}: {
  title: string;
  paragraphs: string[];
  bullets?: string[];
  compact?: boolean;
}) {
  return (
    <section
      className={cn(
        "rounded-xl border bg-card",
        compact ? "space-y-2 p-4" : "space-y-3 p-5 md:p-6",
      )}
    >
      <h2 className="text-base font-semibold tracking-tight md:text-lg">
        {title}
      </h2>
      {paragraphs.map((p) => (
        <p
          key={p.slice(0, 48)}
          className="text-sm leading-relaxed text-muted-foreground"
        >
          {p}
        </p>
      ))}
      {bullets && bullets.length > 0 && (
        <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          {bullets.map((b) => (
            <li key={b}>{b}</li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ScoreboardPanel({
  board,
  assessmentId,
  naSections,
  onGoSection,
}: {
  board: Scoreboard;
  assessmentId: string;
  naSections: string[];
  onGoSection: (key: string) => void;
}) {
  const [state, action] = useActionState(updateDotAssessmentMeta, { ok: false });
  return (
    <div className="space-y-4 pb-24">
      <section className="rounded-xl border bg-card p-4 md:p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Scoreboard</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Live roll-up from your answers
            </p>
          </div>
          <div
            className={cn(
              "rounded-full px-3 py-1 text-xs font-semibold",
              board.readyForInspection
                ? "bg-emerald-500/15 text-emerald-800"
                : "bg-amber-500/15 text-amber-900",
            )}
          >
            {board.readyForInspection ? "Ready" : "In progress"}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            {
              label: "Gate",
              value: `${board.entryGate.yes}/${board.entryGate.required}`,
              sub: board.entryGatePass ? "Pass" : "Open",
              ok: board.entryGatePass,
            },
            {
              label: "Mandatory",
              value: `${board.totals.mAchieved}/${board.totals.mRequired}`,
              sub: `−${board.totals.mShortfall}`,
              ok: board.totals.mShortfall === 0,
            },
            {
              label: "Quality",
              value: String(board.totals.qAchieved),
              sub: board.qualityBand?.label ?? "—",
              ok: true,
            },
            {
              label: "Optional",
              value: String(board.totals.pAchieved),
              sub: board.pBand?.label ?? "—",
              ok: true,
            },
          ].map((card) => (
            <div
              key={card.label}
              className="rounded-xl border bg-background/60 p-3"
            >
              <p className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
                {card.label}
              </p>
              <p className="mt-1 text-xl font-semibold tabular-nums tracking-tight">
                {card.value}
              </p>
              <p
                className={cn(
                  "text-xs",
                  card.ok ? "text-muted-foreground" : "text-amber-700",
                )}
              >
                {card.sub}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-4">
          <div className="mb-1.5 flex justify-between text-xs text-muted-foreground">
            <span>Overall</span>
            <span className="font-medium tabular-nums">
              {board.totals.progressPct}%
            </span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-gradient-to-r from-sky-500 to-emerald-500 transition-[width] duration-300 ease-out"
              style={{ width: `${board.totals.progressPct}%` }}
            />
          </div>
        </div>
      </section>

      <section className="divide-y overflow-hidden rounded-xl border bg-card">
        {board.sections.map((s) => {
          const pct =
            s.totalScorable > 0
              ? Math.round((s.answered / s.totalScorable) * 100)
              : s.na
                ? 100
                : 0;
          return (
            <button
              key={s.sectionKey}
              type="button"
              onClick={() => onGoSection(s.sectionKey)}
              className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-medium">{s.title}</p>
                  {s.na && (
                    <span className="text-[10px] text-muted-foreground">N/A</span>
                  )}
                </div>
                <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn(
                      "h-full rounded-full transition-[width]",
                      pct === 100 ? "bg-emerald-500" : "bg-sky-500",
                    )}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
              <div className="shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                <p>
                  M {s.na ? "—" : `${s.mAchieved}/${s.mRequired}`}
                </p>
                <p>{s.na ? "—" : `${s.answered}/${s.totalScorable}`}</p>
              </div>
              <ArrowRightIcon className="size-4 shrink-0 text-muted-foreground" />
            </button>
          );
        })}
      </section>

      <form action={action} className="space-y-3 rounded-xl border bg-card p-4">
        <input type="hidden" name="assessment_id" value={assessmentId} />
        <h3 className="text-sm font-semibold">Optional facilities</h3>
        <p className="text-xs text-muted-foreground">
          Only if the hotel has no recreation / MICE spaces.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row sm:gap-6">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="na_section"
              value="recreation"
              defaultChecked={naSections.includes("recreation")}
              className="size-4 rounded border"
            />
            No recreation
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="na_section"
              value="mice"
              defaultChecked={naSections.includes("mice")}
              className="size-4 rounded border"
            />
            No MICE / events
          </label>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" size="sm">
            Save flags
          </Button>
          {board.readyForInspection && (
            <Button type="submit" name="status" value="ready" size="sm">
              Mark ready
            </Button>
          )}
        </div>
        {state.error && (
          <p className="text-sm text-destructive">{state.error}</p>
        )}
        {state.message && (
          <p className="text-sm text-emerald-700">{state.message}</p>
        )}
      </form>
    </div>
  );
}

export function DotAssessmentShell({
  assessment,
  catalog,
  responses: initialResponses,
  evidence: initialEvidence,
  readOnly,
}: {
  assessment: DotAssessmentRow;
  catalog: DotCatalog;
  responses: DotResponse[];
  evidence: DotEvidence[];
  board?: Scoreboard;
  readOnly?: boolean;
}) {
  const search = useSearchParams();
  const [step, setStep] = useState<DotStep>(() =>
    parseStep(search.get("step"), catalog),
  );
  const [filter, setFilter] = useState<FilterMode>("open");
  const [guideOpen, setGuideOpen] = useState(false);
  const [responses, setResponses] = useState(initialResponses);
  const [evidence, setEvidence] = useState(initialEvidence);
  const naSections = assessment.naSections;
  const [, startNav] = useTransition();

  // Sync URL without full navigation re-render cost
  const go = useCallback(
    (id: DotStep) => {
      setStep(id);
      const url = new URL(window.location.href);
      url.searchParams.set("step", id);
      window.history.replaceState(null, "", url.toString());
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
    [],
  );

  useEffect(() => {
    const onPop = () => {
      const sp = new URLSearchParams(window.location.search);
      setStep(parseStep(sp.get("step"), catalog));
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [catalog]);

  const board = useMemo(
    () => computeScoreboard(catalog, responses, naSections),
    [catalog, responses, naSections],
  );

  const responseMap = useMemo(() => {
    const m = new Map<string, DotResponse>();
    for (const r of responses) m.set(r.criterionCode, r);
    return m;
  }, [responses]);

  const evidenceMap = useMemo(() => {
    const m = new Map<string, DotEvidence[]>();
    for (const e of evidence) {
      const list = m.get(e.criterionCode) ?? [];
      list.push(e);
      m.set(e.criterionCode, list);
    }
    return m;
  }, [evidence]);

  const onResponseChange = useCallback((r: DotResponse) => {
    setResponses((prev) => {
      const i = prev.findIndex((x) => x.criterionCode === r.criterionCode);
      if (i < 0) return [...prev, r];
      const next = prev.slice();
      next[i] = r;
      return next;
    });
  }, []);

  const onEvidenceAdd = useCallback((e: DotEvidence) => {
    setEvidence((prev) => [e, ...prev]);
  }, []);

  const onEvidenceRemove = useCallback((id: string) => {
    setEvidence((prev) => prev.filter((x) => x.id !== id));
  }, []);

  const steps = useMemo(() => {
    const base: { id: DotStep; label: string; short: string; kind: string }[] = [
      { id: "guide", label: "Guide", short: "i", kind: "meta" },
      { id: "property", label: "Property", short: "P", kind: "meta" },
      { id: "gate", label: "Entry gate", short: "G", kind: "meta" },
    ];
    for (const s of catalog.sections) {
      base.push({
        id: `s:${s.key}`,
        label: s.title,
        short: String(s.order),
        kind: "section",
      });
    }
    base.push({ id: "score", label: "Score", short: "Σ", kind: "meta" });
    return base;
  }, [catalog.sections]);

  const stepIndex = steps.findIndex((s) => s.id === step);
  const prevStep = stepIndex > 0 ? steps[stepIndex - 1] : null;
  const nextStep =
    stepIndex >= 0 && stepIndex < steps.length - 1 ? steps[stepIndex + 1] : null;

  const currentSection =
    typeof step === "string" && step.startsWith("s:")
      ? catalog.sections.find((s) => s.key === step.slice(2))
      : null;

  const [metaState, metaAction] = useActionState(updateDotAssessmentMeta, {
    ok: false,
  });

  const secGuide = currentSection
    ? sectionGuidance(currentSection.key)
    : step === "gate"
      ? sectionGuidance("gate")
      : null;

  const sectionDoneMap = useMemo(() => {
    const m = new Map<string, { done: number; total: number }>();
    for (const sec of board.sections) {
      m.set(sec.sectionKey, {
        done: sec.answered,
        total: sec.totalScorable,
      });
    }
    m.set("gate", {
      done: board.entryGate.yes + board.entryGate.no,
      total: board.entryGate.required,
    });
    return m;
  }, [board]);

  function sectionItems(sectionKey: string, criteria: DotCriterion[]) {
    return criteria.filter((c) =>
      filterCriterion(c, responseMap.get(c.code), filter),
    );
  }

  const gateItems = useMemo(() => {
    return catalog.entryGate.filter((g) => {
      const r = responseMap.get(g.code);
      if (filter === "all") return true;
      if (filter === "open") return !isAnswered(r);
      if (filter === "done") return isAnswered(r);
      if (filter === "fail") return isFail(r);
      return true;
    });
  }, [catalog.entryGate, filter, responseMap]);

  const openInSection = currentSection
    ? currentSection.criteria.filter(
        (c) => c.kind !== "X" && !isAnswered(responseMap.get(c.code)),
      ).length
    : step === "gate"
      ? board.entryGate.pending
      : 0;

  return (
    <div className="relative space-y-4">
      {/* Sticky chrome */}
      <div className="sticky top-0 z-30 -mx-4 border-b border-border/80 bg-background/90 px-4 py-2.5 shadow-sm backdrop-blur-md md:-mx-6 md:px-6">
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-semibold tracking-[0.14em] text-sky-600 uppercase">
                {assessment.starLevel}★
              </span>
              <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium capitalize text-muted-foreground">
                {assessment.status}
              </span>
            </div>
            <div className="mt-1.5 flex items-center gap-2">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-sky-500 to-emerald-500 transition-[width] duration-300"
                  style={{ width: `${board.totals.progressPct}%` }}
                />
              </div>
              <span className="shrink-0 text-xs font-semibold tabular-nums text-foreground">
                {board.totals.progressPct}%
              </span>
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground tabular-nums">
              Gate {board.entryGate.yes}/{board.entryGate.required}
              {" · "}M {board.totals.mAchieved}/{board.totals.mRequired}
              {" · "}
              {board.totals.answered}/{board.totals.totalScorable} answered
            </p>
          </div>
          <Button asChild variant="outline" size="sm" className="shrink-0 gap-1">
            <Link href={`/erp/dot-assessment/${assessment.id}/print`}>
              <PrinterIcon className="size-3.5" />
              <span className="hidden sm:inline">Print</span>
            </Link>
          </Button>
        </div>

        <nav
          className="mt-2.5 flex gap-1 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          aria-label="Assessment steps"
        >
          {steps.map((s) => {
            const active = s.id === step;
            let doneHint = false;
            if (s.id === "gate") {
              doneHint = board.entryGatePass;
            } else if (s.id.startsWith("s:")) {
              const key = s.id.slice(2);
              const stats = sectionDoneMap.get(key);
              doneHint = Boolean(
                stats &&
                  stats.total > 0 &&
                  stats.done >= stats.total,
              );
            } else if (s.id === "score") {
              doneHint = board.readyForInspection;
            }
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => startNav(() => go(s.id))}
                className={cn(
                  "relative flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1.5 text-[11px] font-medium transition-all",
                  active
                    ? "bg-sky-500 text-white shadow-sm"
                    : doneHint
                      ? "bg-emerald-500/12 text-emerald-800 hover:bg-emerald-500/20"
                      : "bg-muted/80 text-muted-foreground hover:bg-muted",
                )}
                title={s.label}
              >
                {doneHint && !active ? (
                  <CheckCircle2Icon className="size-3" />
                ) : null}
                <span className="sm:hidden">{s.short}</span>
                <span className="hidden max-w-[7.5rem] truncate sm:inline">
                  {s.label}
                </span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Guide */}
      {step === "guide" && (
        <div className="space-y-3 pb-24">
          <GuidanceBlock {...OVERVIEW_GUIDANCE} compact />
          <details className="group rounded-xl border bg-card p-4">
            <summary className="cursor-pointer text-sm font-semibold">
              Scoring rules (M / Q / P)
            </summary>
            <div className="mt-3 space-y-2">
              {SCORING_GUIDANCE.paragraphs.map((p) => (
                <p key={p.slice(0, 40)} className="text-sm text-muted-foreground">
                  {p}
                </p>
              ))}
            </div>
          </details>
          <details className="group rounded-xl border bg-card p-4">
            <summary className="cursor-pointer text-sm font-semibold">
              Recommended walk order
            </summary>
            <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              {WALK_ORDER_GUIDANCE.bullets?.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
          </details>
          <Button type="button" className="w-full sm:w-auto" onClick={() => go("property")}>
            Begin assessment
            <ArrowRightIcon className="ml-1 size-4" />
          </Button>
        </div>
      )}

      {step === "property" && (
        <form
          action={metaAction}
          className="space-y-4 rounded-xl border bg-card p-4 pb-24 md:p-5"
        >
          <input type="hidden" name="assessment_id" value={assessment.id} />
          <div>
            <h2 className="text-lg font-semibold">Property information</h2>
            <p className="text-sm text-muted-foreground">
              Trade license, TPN, rooms, and assessor names
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {catalog.propertyFields.map((f) => (
              <div key={f.key} className="space-y-1">
                <Label htmlFor={f.key} className="text-xs">
                  {f.label}
                </Label>
                <Input
                  id={f.key}
                  name={`prop_${f.key}`}
                  className="h-10"
                  defaultValue={assessment.propertyInfo[f.key] ?? ""}
                  disabled={readOnly}
                />
              </div>
            ))}
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1">
              <Label htmlFor="lead_assessor" className="text-xs">
                Lead assessor
              </Label>
              <Input
                id="lead_assessor"
                name="lead_assessor"
                className="h-10"
                defaultValue={assessment.leadAssessor ?? ""}
                disabled={readOnly}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="assessor_2" className="text-xs">
                Assessor 2
              </Label>
              <Input
                id="assessor_2"
                name="assessor_2"
                className="h-10"
                defaultValue={assessment.assessor2 ?? ""}
                disabled={readOnly}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="assessor_3" className="text-xs">
                Assessor 3
              </Label>
              <Input
                id="assessor_3"
                name="assessor_3"
                className="h-10"
                defaultValue={assessment.assessor3 ?? ""}
                disabled={readOnly}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="assessed_on" className="text-xs">
                Date
              </Label>
              <Input
                id="assessed_on"
                name="assessed_on"
                type="date"
                className="h-10"
                defaultValue={assessment.assessedOn ?? ""}
                disabled={readOnly}
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="notes" className="text-xs">
              Notes
            </Label>
            <Textarea
              id="notes"
              name="notes"
              rows={2}
              defaultValue={assessment.notes ?? ""}
              disabled={readOnly}
            />
          </div>
          {!readOnly && (
            <Button type="submit" size="sm">
              Save
            </Button>
          )}
          {metaState.error && (
            <p className="text-sm text-destructive">{metaState.error}</p>
          )}
          {metaState.message && (
            <p className="text-sm text-emerald-700">{metaState.message}</p>
          )}
        </form>
      )}

      {(step === "gate" || currentSection) && (
        <div className="space-y-3 pb-24">
          {/* Section tips + filters */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-lg font-semibold tracking-tight">
                {step === "gate"
                  ? "Entry gate"
                  : currentSection?.title}
              </h2>
              <p className="text-xs text-muted-foreground">
                {openInSection > 0
                  ? `${openInSection} open`
                  : "Section complete"}
                {step === "gate" && !board.entryGatePass
                  ? " · blocks Ready status"
                  : ""}
              </p>
            </div>
            <div
              className="inline-flex rounded-lg border bg-card p-0.5"
              role="group"
              aria-label="Filter criteria"
            >
              {(
                [
                  ["open", "Open"],
                  ["all", "All"],
                  ["fail", "Fail"],
                  ["done", "Done"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setFilter(id)}
                  className={cn(
                    "flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
                    filter === id
                      ? "bg-sky-500 text-white"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {id === "open" && <FilterIcon className="size-3" />}
                  {label}
                </button>
              ))}
            </div>
          </div>

          {secGuide && (
            <div className="rounded-xl border border-sky-500/20 bg-sky-500/[0.06]">
              <button
                type="button"
                className="flex w-full items-center justify-between px-3 py-2.5 text-left text-sm font-medium text-sky-950 dark:text-sky-100"
                onClick={() => setGuideOpen((v) => !v)}
              >
                How to pass this section
                <span className="text-xs text-sky-700/80">
                  {guideOpen ? "Hide" : "Show"}
                </span>
              </button>
              {guideOpen && (
                <ul className="space-y-1 border-t border-sky-500/10 px-3 py-2.5 text-xs text-sky-950/90 dark:text-sky-100/90">
                  {secGuide.tips.map((t) => (
                    <li key={t} className="flex gap-2">
                      <CircleIcon className="mt-1 size-1.5 shrink-0 fill-current" />
                      <span>{t}</span>
                    </li>
                  ))}
                  {step === "gate" && (
                    <li className="pt-1">
                      Masters in{" "}
                      <Link
                        href="/erp/settings?tab=compliance"
                        className="underline"
                      >
                        Settings → Compliance
                      </Link>
                    </li>
                  )}
                </ul>
              )}
            </div>
          )}

          {currentSection && naSections.includes(currentSection.key) && (
            <p className="rounded-lg border bg-muted/60 px-3 py-2 text-sm">
              Marked N/A. Change flags on the Score step if the facility exists.
            </p>
          )}

          {step === "gate" && (
            <div className="space-y-2">
              {gateItems.length === 0 ? (
                <EmptyFilter
                  filter={filter}
                  onShowAll={() => setFilter("all")}
                />
              ) : (
                gateItems.map((g) => (
                  <CriterionRow
                    key={g.code}
                    assessmentId={assessment.id}
                    code={g.code}
                    text={g.text}
                    kind="M"
                    sectionKey="gate"
                    response={responseMap.get(g.code)}
                    evidence={evidenceMap.get(g.code) ?? []}
                    readOnly={readOnly}
                    onResponseChange={onResponseChange}
                    onEvidenceAdd={onEvidenceAdd}
                    onEvidenceRemove={onEvidenceRemove}
                    dense
                  />
                ))
              )}
            </div>
          )}

          {currentSection && (
            <div className="space-y-4">
              {currentSection.groups.map((grp) => {
                const items = sectionItems(
                  currentSection.key,
                  currentSection.criteria.filter((c) => c.groupCode === grp.code),
                );
                if (!items.length) return null;
                return (
                  <div key={grp.code} className="space-y-2">
                    <h3 className="sticky top-[7.25rem] z-10 -mx-1 bg-background/90 px-1 py-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase backdrop-blur">
                      {grp.code} · {grp.title}
                    </h3>
                    <div className="space-y-2">
                      {items.map((c) => (
                        <CriterionRow
                          key={c.code}
                          assessmentId={assessment.id}
                          code={c.code}
                          text={c.text}
                          kind={c.kind}
                          maxPoints={c.maxPoints}
                          notes={c.notes}
                          sectionKey={currentSection.key}
                          response={responseMap.get(c.code)}
                          evidence={evidenceMap.get(c.code) ?? []}
                          readOnly={
                            readOnly ||
                            naSections.includes(currentSection.key)
                          }
                          onResponseChange={onResponseChange}
                          onEvidenceAdd={onEvidenceAdd}
                          onEvidenceRemove={onEvidenceRemove}
                          dense
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
              {(() => {
                const ungrouped = sectionItems(
                  currentSection.key,
                  currentSection.criteria.filter((c) => !c.groupCode),
                );
                if (!ungrouped.length) return null;
                return (
                  <div className="space-y-2">
                    {ungrouped.map((c) => (
                      <CriterionRow
                        key={c.code}
                        assessmentId={assessment.id}
                        code={c.code}
                        text={c.text}
                        kind={c.kind}
                        maxPoints={c.maxPoints}
                        notes={c.notes}
                        sectionKey={currentSection.key}
                        response={responseMap.get(c.code)}
                        evidence={evidenceMap.get(c.code) ?? []}
                        readOnly={
                          readOnly || naSections.includes(currentSection.key)
                        }
                        onResponseChange={onResponseChange}
                        onEvidenceAdd={onEvidenceAdd}
                        onEvidenceRemove={onEvidenceRemove}
                        dense
                      />
                    ))}
                  </div>
                );
              })()}
              {filter !== "all" &&
                sectionItems(currentSection.key, currentSection.criteria)
                  .length === 0 && (
                  <EmptyFilter
                    filter={filter}
                    onShowAll={() => setFilter("all")}
                  />
                )}
            </div>
          )}
        </div>
      )}

      {step === "score" && (
        <ScoreboardPanel
          board={board}
          assessmentId={assessment.id}
          naSections={naSections}
          onGoSection={(key) => go(`s:${key}`)}
        />
      )}

      {/* Bottom prev / next bar */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 px-3 py-2.5 backdrop-blur-md md:px-6">
        <div className="mx-auto flex max-w-4xl items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-10 flex-1 gap-1 sm:flex-none"
            disabled={!prevStep}
            onClick={() => prevStep && go(prevStep.id)}
          >
            <ArrowLeftIcon className="size-4" />
            <span className="truncate">
              {prevStep?.label ?? "—"}
            </span>
          </Button>
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="hidden h-10 sm:inline-flex"
          >
            <Link href="/erp/dot-assessment">All</Link>
          </Button>
          <Button
            type="button"
            size="sm"
            className="h-10 flex-1 gap-1 sm:flex-none"
            disabled={!nextStep}
            onClick={() => nextStep && go(nextStep.id)}
          >
            <span className="truncate">
              {nextStep?.label ?? "—"}
            </span>
            <ArrowRightIcon className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function EmptyFilter({
  filter,
  onShowAll,
}: {
  filter: FilterMode;
  onShowAll: () => void;
}) {
  return (
    <div className="rounded-xl border border-dashed bg-muted/30 px-4 py-8 text-center">
      <p className="text-sm text-muted-foreground">
        {filter === "open"
          ? "Nothing open here — nice work."
          : filter === "fail"
            ? "No failed items in this filter."
            : "No matching items."}
      </p>
      {filter !== "all" && (
        <Button
          type="button"
          variant="link"
          className="mt-1"
          onClick={onShowAll}
        >
          Show all
        </Button>
      )}
    </div>
  );
}
