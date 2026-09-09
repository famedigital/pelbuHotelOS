import {
  copyDotAssessmentToStar,
  createDotAssessment,
  listDotAssessments,
} from "@/app/actions/erp-dot-assessment";
import {
  ClearEmptyDotDraftsButton,
  DotAssessmentDeleteButton,
} from "@/components/erp/dot-assessment/DotAssessmentDeleteButton";
import { Button } from "@/components/ui/button";
import { getDeskRole, isDeskAuthenticated } from "@/lib/desk-auth";
import { getCatalog } from "@/lib/dot-assessment/catalog";
import { computeScoreboard } from "@/lib/dot-assessment/score";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { cn } from "@/lib/utils";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "DOT Assessment | Pelbu OS",
  description:
    "Digital Hotel Classification System 2024 self-assessment (DOT, Trade, BFDA).",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function DotAssessmentListPage() {
  if (!(await isDeskAuthenticated())) redirect("/erp/login");
  const role = await getDeskRole();
  const canWrite =
    role === "owner" || role === "gm" || role === "front_desk";

  let assessments: Awaited<ReturnType<typeof listDotAssessments>> = [];
  let loadError: string | null = null;
  try {
    assessments = await listDotAssessments();
  } catch (e) {
    loadError = e instanceof Error ? e.message : "Could not load assessments.";
  }

  const admin = createSupabaseAdminClient();
  const withProgress = await Promise.all(
    assessments.map(async (a) => {
      const { data: resp } = await admin
        .from("dot_assessment_responses")
        .select(
          "criterion_code, section_key, status, score_m, score_q, score_p, remarks",
        )
        .eq("assessment_id", a.id);
      const catalog = getCatalog(a.starLevel);
      const board = computeScoreboard(
        catalog,
        (resp ?? []).map((r) => ({
          criterionCode: r.criterion_code as string,
          sectionKey: r.section_key as string,
          status: r.status as "pending" | "yes" | "no" | "na" | "scored",
          scoreM: r.score_m as number | null,
          scoreQ: r.score_q as number | null,
          scoreP: r.score_p != null ? Number(r.score_p) : null,
          remarks: (r.remarks as string | null) ?? null,
        })),
        a.naSections,
      );
      return {
        a,
        pct: board.totals.progressPct,
        gate: board.entryGatePass,
        ready: board.readyForInspection,
      };
    }),
  );

  return (
    <div className="erp mx-auto w-full max-w-3xl space-y-6 p-4 md:p-6">
      <header className="space-y-1">
        <p className="text-[11px] font-semibold tracking-[0.18em] text-sky-600 uppercase">
          Compliance
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">DOT assessment</h1>
        <p className="max-w-xl text-sm text-muted-foreground">
          Prep Trade license, BFDA, and DOT star classification before the
          inspector visits — tick, note, photo, score.
        </p>
      </header>

      <section className="rounded-2xl border bg-gradient-to-br from-sky-500/[0.07] via-card to-card p-5 md:p-6">
        <h2 className="text-base font-semibold">New walk-through</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Hotel Classification System for Bhutan 2024 · HCS checklists
        </p>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <form action={createDotAssessment}>
            <input type="hidden" name="star_level" value="3" />
            <Button type="submit" className="h-12 w-full text-base">
              Start 3★ mid-scale
            </Button>
          </form>
          <form action={createDotAssessment}>
            <input type="hidden" name="star_level" value="4" />
            <Button
              type="submit"
              variant="outline"
              className="h-12 w-full text-base"
            >
              Start 4★ premium
            </Button>
          </form>
        </div>
      </section>

      {loadError && (
        <p className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {loadError} Apply migration{" "}
          <code className="text-xs">20260808000000_dot_assessment.sql</code> if
          tables are missing.
        </p>
      )}

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
            Continue
          </h2>
          {canWrite ? (
            <ClearEmptyDotDraftsButton
              count={
                withProgress.filter(
                  ({ a, pct }) => a.status === "draft" && pct === 0,
                ).length
              }
            />
          ) : null}
        </div>
        {withProgress.length === 0 && !loadError ? (
          <p className="rounded-xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
            No assessments yet — start a 3★ or 4★ walk-through above.
          </p>
        ) : (
          <ul className="space-y-2">
            {withProgress.map(({ a, pct, gate, ready }) => (
              <li
                key={a.id}
                className="rounded-xl border bg-card p-4 transition-all hover:border-sky-400/60 hover:shadow-sm"
              >
                <div className="flex items-start gap-1">
                  <Link
                    href={`/erp/dot-assessment/${a.id}?step=${pct > 0 ? "gate" : "guide"}`}
                    className="min-w-0 flex-1"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium">
                          {a.starLevel}★ checklist
                          <span className="ml-2 text-xs font-normal capitalize text-muted-foreground">
                            {a.status}
                          </span>
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {new Date(a.updatedAt).toLocaleString(undefined, {
                            dateStyle: "medium",
                            timeStyle: "short",
                          })}
                          {a.leadAssessor ? ` · ${a.leadAssessor}` : ""}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-semibold tabular-nums">
                          {pct}%
                        </p>
                        <p
                          className={cn(
                            "text-[11px] font-medium",
                            ready
                              ? "text-emerald-600"
                              : gate
                                ? "text-sky-600"
                                : "text-amber-700",
                          )}
                        >
                          {ready
                            ? "Ready"
                            : gate
                              ? "Gate OK"
                              : "Gate open"}
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-sky-500 to-emerald-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </Link>
                  {canWrite ? (
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      {a.starLevel === 4 ? (
                        <form action={copyDotAssessmentToStar}>
                          <input type="hidden" name="assessment_id" value={a.id} />
                          <input type="hidden" name="star_level" value="3" />
                          <Button
                            type="submit"
                            variant="ghost"
                            size="sm"
                            className="h-8 px-2 text-xs text-sky-700"
                            title="Duplicate onto 3★ checklist with mapped scores"
                          >
                            Copy → 3★
                          </Button>
                        </form>
                      ) : a.starLevel === 3 ? (
                        <form action={copyDotAssessmentToStar}>
                          <input type="hidden" name="assessment_id" value={a.id} />
                          <input type="hidden" name="star_level" value="4" />
                          <Button
                            type="submit"
                            variant="ghost"
                            size="sm"
                            className="h-8 px-2 text-xs text-sky-700"
                            title="Duplicate onto 4★ checklist with mapped scores"
                          >
                            Copy → 4★
                          </Button>
                        </form>
                      ) : null}
                      <DotAssessmentDeleteButton
                        assessmentId={a.id}
                        starLevel={a.starLevel}
                        status={a.status}
                        progressPct={pct}
                      />
                    </div>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
