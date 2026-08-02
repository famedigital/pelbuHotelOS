import { getDotAssessmentBundle } from "@/app/actions/erp-dot-assessment";
import { PrintButton } from "@/components/erp/PrintButton";
import { getCatalog } from "@/lib/dot-assessment/catalog";
import { computeScoreboard } from "@/lib/dot-assessment/score";
import { isDeskAuthenticated } from "@/lib/desk-auth";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "DOT Assessment print pack | Pelbu OS",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function DotAssessmentPrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!(await isDeskAuthenticated())) redirect("/erp/login");
  const { id } = await params;

  let bundle: Awaited<ReturnType<typeof getDotAssessmentBundle>>;
  try {
    bundle = await getDotAssessmentBundle(id);
  } catch {
    notFound();
  }

  const catalog = getCatalog(bundle.assessment.starLevel);
  const board = computeScoreboard(
    catalog,
    bundle.responses,
    bundle.assessment.naSections,
  );
  const responseMap = new Map(
    bundle.responses.map((r) => [r.criterionCode, r]),
  );
  const evidByCode = new Map<string, number>();
  for (const e of bundle.evidence) {
    evidByCode.set(e.criterionCode, (evidByCode.get(e.criterionCode) ?? 0) + 1);
  }

  const fails = [
    ...board.entryGate.failedCodes,
    ...board.entryGate.pendingCodes,
    ...board.failedMCodes,
  ];

  return (
    <div className="mx-auto max-w-3xl space-y-8 bg-white p-6 text-black print:p-0">
      <div className="flex flex-wrap items-start justify-between gap-3 print:hidden">
        <Link
          href={`/erp/dot-assessment/${id}?step=score`}
          className="text-sm text-sky-700 underline"
        >
          ← Back to assessment
        </Link>
        <PrintButton label="Print pack" />
      </div>

      <header className="space-y-2 border-b border-neutral-300 pb-4">
        <p className="text-xs font-semibold tracking-[0.2em] text-neutral-500 uppercase">
          Pelbu OS · Internal prep pack
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">
          {catalog.title}
        </h1>
        <p className="text-sm text-neutral-600">
          Hotel Classification System for Bhutan 2024 · Self-assessment summary
          (not an official DOT filing) · Source {catalog.sourceFile}
        </p>
        <dl className="grid gap-1 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-neutral-500">Status</dt>
            <dd className="font-medium">{bundle.assessment.status}</dd>
          </div>
          <div>
            <dt className="text-neutral-500">Assessed on</dt>
            <dd className="font-medium">
              {bundle.assessment.assessedOn ?? "—"}
            </dd>
          </div>
          <div>
            <dt className="text-neutral-500">Lead assessor</dt>
            <dd className="font-medium">
              {bundle.assessment.leadAssessor ?? "—"}
            </dd>
          </div>
          <div>
            <dt className="text-neutral-500">Progress</dt>
            <dd className="font-medium">{board.totals.progressPct}%</dd>
          </div>
        </dl>
      </header>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Property information</h2>
        <dl className="grid gap-1 text-sm sm:grid-cols-2">
          {catalog.propertyFields.map((f) => {
            const v = bundle.assessment.propertyInfo[f.key];
            if (!v) return null;
            return (
              <div key={f.key} className="border-b border-neutral-100 py-1">
                <dt className="text-neutral-500">{f.label}</dt>
                <dd>{v}</dd>
              </div>
            );
          })}
        </dl>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Scoreboard</h2>
        <ul className="text-sm">
          <li>
            Entry gate: {board.entryGate.yes}/{board.entryGate.required}{" "}
            {board.entryGatePass ? "(pass)" : "(not ready)"}
          </li>
          <li>
            Mandatory M: {board.totals.mAchieved}/{board.totals.mRequired}{" "}
            (shortfall {board.totals.mShortfall})
          </li>
          <li>
            Quality Q: {board.totals.qAchieved}
            {board.qualityBand
              ? ` · ${board.qualityBand.rank} ${board.qualityBand.label}`
              : ""}
          </li>
          <li>
            Optional P: {board.totals.pAchieved}
            {board.pBand ? ` · ${board.pBand.rank} ${board.pBand.label}` : ""}
          </li>
        </ul>
        <table className="mt-3 w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-neutral-300 text-left">
              <th className="py-1 pr-2">Area</th>
              <th className="py-1 pr-2">M</th>
              <th className="py-1 pr-2">Q</th>
              <th className="py-1">P</th>
            </tr>
          </thead>
          <tbody>
            {board.sections.map((s) => (
              <tr key={s.sectionKey} className="border-b border-neutral-100">
                <td className="py-1 pr-2">
                  {s.title}
                  {s.na ? " (N/A)" : ""}
                </td>
                <td className="py-1 pr-2 tabular-nums">
                  {s.na ? "—" : `${s.mAchieved}/${s.mRequired}`}
                </td>
                <td className="py-1 pr-2 tabular-nums">
                  {s.na ? "—" : s.qAchieved}
                </td>
                <td className="py-1 tabular-nums">
                  {s.na ? "—" : s.pAchieved}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {fails.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">Gaps to fix before inspection</h2>
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {fails.map((code) => {
              const r = responseMap.get(code);
              let text = code;
              if (code.startsWith("gate.")) {
                text =
                  catalog.entryGate.find((g) => g.code === code)?.text ?? code;
              } else {
                for (const s of catalog.sections) {
                  const c = s.criteria.find((x) => x.code === code);
                  if (c) {
                    text = `${code} ${c.text}`;
                    break;
                  }
                }
              }
              return (
                <li key={code}>
                  <span className="font-mono text-xs">{code}</span> — {text}
                  {r?.remarks ? ` · Note: ${r.remarks}` : ""}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Entry gate responses</h2>
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-neutral-300 text-left">
              <th className="py-1 pr-2">#</th>
              <th className="py-1 pr-2">Criterion</th>
              <th className="py-1 pr-2">Result</th>
              <th className="py-1">Photos</th>
            </tr>
          </thead>
          <tbody>
            {catalog.entryGate.map((g) => {
              const r = responseMap.get(g.code);
              const label =
                r?.scoreM === 1 || r?.status === "yes"
                  ? "Yes"
                  : r?.scoreM === 0 || r?.status === "no"
                    ? "No"
                    : "Pending";
              return (
                <tr key={g.code} className="border-b border-neutral-100 align-top">
                  <td className="py-1 pr-2 font-mono text-xs">{g.no}</td>
                  <td className="py-1 pr-2">{g.text}</td>
                  <td className="py-1 pr-2">{label}</td>
                  <td className="py-1">{evidByCode.get(g.code) ?? 0}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Physical checklist answers</h2>
        {catalog.sections.map((section) => {
          if (bundle.assessment.naSections.includes(section.key)) {
            return (
              <div key={section.key}>
                <h3 className="font-medium">
                  {section.order}. {section.title} — N/A
                </h3>
              </div>
            );
          }
          const answered = section.criteria.filter((c) => {
            if (c.kind === "X") return false;
            return responseMap.has(c.code);
          });
          if (answered.length === 0) {
            return (
              <div key={section.key}>
                <h3 className="font-medium">
                  {section.order}. {section.title}
                </h3>
                <p className="text-sm text-neutral-500">No answers yet.</p>
              </div>
            );
          }
          return (
            <div key={section.key} className="space-y-1">
              <h3 className="font-medium">
                {section.order}. {section.title}
              </h3>
              <ul className="space-y-1 text-sm">
                {answered.map((c) => {
                  const r = responseMap.get(c.code)!;
                  const result =
                    r.status === "yes" || r.scoreM === 1
                      ? "Yes"
                      : r.status === "no" || r.scoreM === 0
                        ? "No"
                        : r.scoreQ != null
                          ? `Q=${r.scoreQ}`
                          : r.scoreP != null
                            ? `P=${r.scoreP}`
                            : r.status;
                  return (
                    <li key={c.code} className="border-b border-neutral-50 py-1">
                      <span className="font-mono text-xs text-neutral-500">
                        {c.code}
                      </span>{" "}
                      [{c.kind}] {result}
                      {r.remarks ? ` — ${r.remarks}` : ""}
                      {(evidByCode.get(c.code) ?? 0) > 0
                        ? ` · ${evidByCode.get(c.code)} file(s)`
                        : ""}
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </section>

      <footer className="border-t border-neutral-300 pt-4 text-xs text-neutral-500">
        Generated by Pelbu OS for internal hotelier preparation only. Official
        classification is performed by authorised DOT assessors using the Hotel
        Classification System for Bhutan 2024.
      </footer>

    </div>
  );
}
