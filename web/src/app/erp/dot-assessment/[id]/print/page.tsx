import { getDotAssessmentBundle } from "@/app/actions/erp-dot-assessment";
import { PrintButton } from "@/components/erp/PrintButton";
import { getCatalog } from "@/lib/dot-assessment/catalog";
import { computeScoreboard } from "@/lib/dot-assessment/score";
import { isDeskAuthenticated } from "@/lib/desk-auth";
import { createFinanceSignedPreview } from "@/lib/finance-import/storage";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { DotCriterion, DotEvidence, DotResponse } from "@/lib/dot-assessment/types";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "DOT Assessment print pack | Pelbu OS",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/** Signed URLs must outlive a long print session. */
const PRINT_URL_TTL_SEC = 60 * 60 * 2;

function resultLabel(c: DotCriterion, r: DotResponse | undefined): string {
  if (c.kind === "X") return "N/A (star)";
  if (!r || r.status === "pending") return "";
  if (r.status === "na") return "N/A";
  if (r.status === "yes" || r.scoreM === 1) return "Yes";
  if (r.status === "no" || r.scoreM === 0) return "No";
  if (r.scoreQ != null) return String(r.scoreQ);
  if (r.scoreP != null) return String(r.scoreP);
  return r.status;
}

function isImageMime(mime: string | null, fileName: string): boolean {
  if (mime?.startsWith("image/")) return true;
  return /\.(jpe?g|png|gif|webp|heic|bmp)$/i.test(fileName);
}

function criterionMeta(
  catalog: ReturnType<typeof getCatalog>,
  code: string,
): { sectionOrder: number; sectionTitle: string; text: string; kind: string } {
  if (code.startsWith("gate.")) {
    const g = catalog.entryGate.find((x) => x.code === code);
    return {
      sectionOrder: 0,
      sectionTitle: "Entry gate",
      text: g?.text ?? code,
      kind: "M",
    };
  }
  for (const s of catalog.sections) {
    const c = s.criteria.find((x) => x.code === code);
    if (c) {
      return {
        sectionOrder: s.order,
        sectionTitle: s.title,
        text: c.text,
        kind: c.kind,
      };
    }
  }
  return {
    sectionOrder: 99,
    sectionTitle: "Other",
    text: code,
    kind: "?",
  };
}

type AppendixPhoto = {
  ref: string;
  evidence: DotEvidence;
  url: string | null;
  sectionOrder: number;
  sectionTitle: string;
  criterionText: string;
  kind: string;
};

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

  const admin = createSupabaseAdminClient();
  const sortedEvidence = [...bundle.evidence].sort((a, b) => {
    const ma = criterionMeta(catalog, a.criterionCode);
    const mb = criterionMeta(catalog, b.criterionCode);
    if (ma.sectionOrder !== mb.sectionOrder) {
      return ma.sectionOrder - mb.sectionOrder;
    }
    const codeCmp = a.criterionCode.localeCompare(b.criterionCode, undefined, {
      numeric: true,
    });
    if (codeCmp !== 0) return codeCmp;
    return a.uploadedAt.localeCompare(b.uploadedAt);
  });

  const appendix: AppendixPhoto[] = await Promise.all(
    sortedEvidence.map(async (ev, i) => {
      const meta = criterionMeta(catalog, ev.criterionCode);
      let url: string | null = null;
      if (isImageMime(ev.mimeType, ev.fileName)) {
        try {
          url = await createFinanceSignedPreview(
            admin,
            ev.storagePath,
            PRINT_URL_TTL_SEC,
          );
        } catch {
          url = null;
        }
      }
      return {
        ref: `A-${i + 1}`,
        evidence: ev,
        url,
        sectionOrder: meta.sectionOrder,
        sectionTitle: meta.sectionTitle,
        criterionText: meta.text,
        kind: meta.kind,
      };
    }),
  );

  const refsByCode = new Map<string, string[]>();
  for (const p of appendix) {
    const list = refsByCode.get(p.evidence.criterionCode) ?? [];
    list.push(p.ref);
    refsByCode.set(p.evidence.criterionCode, list);
  }

  const gaps = board.mandatoryGaps;

  function photoCell(code: string) {
    const refs = refsByCode.get(code);
    if (!refs?.length) return null;
    return (
      <span className="tabular-nums">
        {refs.length}
        <span className="ml-1 text-[10px] font-normal text-neutral-500">
          {refs.join(", ")}
        </span>
      </span>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8 bg-white p-6 text-black print:max-w-none print:space-y-6 print:p-0">
      <div className="flex flex-wrap items-start justify-between gap-3 print:hidden">
        <Link
          href={`/erp/dot-assessment/${id}?step=score`}
          className="text-sm text-sky-700 underline"
        >
          ← Back to assessment
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          {appendix.length > 0 ? (
            <a
              href="#photo-appendix"
              className="text-sm text-sky-700 underline"
            >
              Jump to photo appendix ({appendix.length})
            </a>
          ) : null}
          <PrintButton label="Print full checklist" />
        </div>
      </div>

      <header className="space-y-2 border-b border-neutral-300 pb-4">
        <p className="text-xs font-semibold tracking-[0.2em] text-neutral-500 uppercase">
          Pelbu OS · HCS 2024 self-assessment pack
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">
          {catalog.title}
        </h1>
        <p className="text-sm text-neutral-600">
          Criteria sheet + photo appendix · Source {catalog.sourceFile} · Not an
          official DOT filing
        </p>
        <dl className="grid gap-1 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-neutral-500">Property</dt>
            <dd className="font-medium">
              {bundle.assessment.propertyInfo.name_of_accommodation ?? "—"}
            </dd>
          </div>
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
            <dt className="text-neutral-500">Mandatory (leaf)</dt>
            <dd className="font-medium tabular-nums">
              {board.totals.mLeafAchieved}/{board.totals.mLeafRequired}
              {board.mandatoryPass ? " · pass" : " · gaps"}
            </dd>
          </div>
          <div>
            <dt className="text-neutral-500">Photo appendix</dt>
            <dd className="font-medium tabular-nums">
              {appendix.length} file{appendix.length === 1 ? "" : "s"}
            </dd>
          </div>
        </dl>
      </header>

      <section className="space-y-2 break-inside-avoid">
        <h2 className="text-lg font-semibold">Property information</h2>
        <table className="w-full border-collapse text-sm">
          <tbody>
            {catalog.propertyFields.map((f) => (
              <tr key={f.key} className="border-b border-neutral-200">
                <th className="w-[40%] py-1.5 pr-3 text-left font-normal text-neutral-500">
                  {f.label}
                  {f.subLabel ? (
                    <span className="block text-xs">{f.subLabel}</span>
                  ) : null}
                </th>
                <td className="py-1.5">
                  {bundle.assessment.propertyInfo[f.key] || "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="space-y-2 break-inside-avoid">
        <h2 className="text-lg font-semibold">Score summary</h2>
        <ul className="text-sm">
          <li>
            Entry gate: {board.entryGate.yes}/{board.entryGate.required}{" "}
            {board.entryGatePass ? "(pass)" : "(not ready)"}
          </li>
          <li>
            Mandatory leaf M: {board.totals.mLeafAchieved}/
            {board.totals.mLeafRequired}
            {board.mandatoryPass
              ? " (pass)"
              : ` (−${board.totals.mLeafShortfall})`}
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
            <tr className="border-b-2 border-neutral-400 text-left">
              <th className="py-1 pr-2">Area</th>
              <th className="py-1 pr-2 text-right">M leaf</th>
              <th className="py-1 pr-2 text-right">Sheet M</th>
              <th className="py-1 pr-2 text-right">Q</th>
              <th className="py-1 text-right">P</th>
            </tr>
          </thead>
          <tbody>
            {board.sections.map((s) => (
              <tr key={s.sectionKey} className="border-b border-neutral-200">
                <td className="py-1 pr-2">
                  {s.order}. {s.title}
                  {s.na ? " (N/A)" : ""}
                  {s.failedMCodes.length + s.incompleteMCodes.length > 0
                    ? " *"
                    : ""}
                </td>
                <td className="py-1 pr-2 text-right tabular-nums">
                  {s.na ? "—" : `${s.mAchieved}/${s.mLeafRequired}`}
                </td>
                <td className="py-1 pr-2 text-right tabular-nums">
                  {s.na ? "—" : s.mRequired}
                </td>
                <td className="py-1 pr-2 text-right tabular-nums">
                  {s.na ? "—" : s.qAchieved}
                </td>
                <td className="py-1 text-right tabular-nums">
                  {s.na ? "—" : s.pAchieved}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="text-xs text-neutral-500">
          Photos column = count + appendix refs (A-n). Images print in the Photo
          appendix after the checklist.
        </p>
      </section>

      {gaps.length > 0 && (
        <section className="space-y-2 break-inside-avoid">
          <h2 className="text-lg font-semibold">
            Mandatory gaps to fix ({gaps.length})
          </h2>
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b-2 border-neutral-400 text-left">
                <th className="py-1 pr-2">Code</th>
                <th className="py-1 pr-2">Criterion</th>
                <th className="py-1">Issue</th>
              </tr>
            </thead>
            <tbody>
              {gaps.map((g) => {
                const meta = criterionMeta(catalog, g.code);
                return (
                  <tr
                    key={`${g.sectionKey}:${g.code}`}
                    className="border-b border-neutral-200 align-top"
                  >
                    <td className="py-1 pr-2 font-mono text-xs">{g.code}</td>
                    <td className="py-1 pr-2">{meta.text}</td>
                    <td className="py-1 whitespace-nowrap">
                      {g.reason === "no" ? "No" : "Pending"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      )}

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">1. Entry gate (all items)</h2>
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b-2 border-neutral-400 text-left">
              <th className="py-1 pr-2">#</th>
              <th className="py-1 pr-2">Criterion</th>
              <th className="py-1 pr-2">Type</th>
              <th className="py-1 pr-2">Result</th>
              <th className="py-1 pr-2">Photos</th>
              <th className="py-1">Remarks</th>
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
                    : "";
              return (
                <tr
                  key={g.code}
                  className="border-b border-neutral-200 align-top"
                >
                  <td className="py-1 pr-2 font-mono text-xs">{g.no}</td>
                  <td className="py-1 pr-2">{g.text}</td>
                  <td className="py-1 pr-2">M</td>
                  <td className="py-1 pr-2 font-medium">{label}</td>
                  <td className="py-1 pr-2">{photoCell(g.code)}</td>
                  <td className="py-1 text-neutral-600">{r?.remarks ?? ""}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      {catalog.sections.map((section) => {
        const na = bundle.assessment.naSections.includes(section.key);
        return (
          <section
            key={section.key}
            className="space-y-2 break-before-page print:break-before-page"
          >
            <h2 className="text-lg font-semibold">
              {section.order}. {section.title}
              {na ? " — N/A (no facility)" : ""}
            </h2>
            <p className="text-xs text-neutral-500">
              Sheet M {section.caps.M ?? "—"} · Q {section.caps.Q ?? "—"} · P{" "}
              {section.caps.P ?? "—"}
              {section.sheetName ? ` · Sheet: ${section.sheetName}` : ""}
            </p>
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b-2 border-neutral-400 text-left">
                  <th className="w-[4.5rem] py-1 pr-2">Code</th>
                  <th className="py-1 pr-2">Criterion</th>
                  <th className="w-12 py-1 pr-2">Type</th>
                  <th className="w-14 py-1 pr-2">Max</th>
                  <th className="w-16 py-1 pr-2">Result</th>
                  <th className="w-24 py-1 pr-2">Photos</th>
                  <th className="py-1">Remarks</th>
                </tr>
              </thead>
              <tbody>
                {section.criteria.map((c) => {
                  const r = responseMap.get(c.code);
                  const result =
                    na && c.kind !== "X" ? "N/A" : resultLabel(c, r);
                  return (
                    <tr
                      key={c.code}
                      className="border-b border-neutral-200 align-top"
                    >
                      <td className="py-1 pr-2 font-mono text-xs">{c.code}</td>
                      <td className="py-1 pr-2">
                        {c.text}
                        {c.notes ? (
                          <span className="mt-0.5 block text-xs text-neutral-500">
                            {c.notes}
                          </span>
                        ) : null}
                      </td>
                      <td className="py-1 pr-2">{c.kind}</td>
                      <td className="py-1 pr-2 tabular-nums text-neutral-600">
                        {c.maxPoints ?? ""}
                      </td>
                      <td className="py-1 pr-2 font-medium">{result}</td>
                      <td className="py-1 pr-2">{photoCell(c.code)}</td>
                      <td className="py-1 text-neutral-600">
                        {r?.remarks ?? ""}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>
        );
      })}

      <section
        id="photo-appendix"
        className="space-y-4 break-before-page print:break-before-page"
      >
        <header className="space-y-1 border-b border-neutral-300 pb-3">
          <p className="text-xs font-semibold tracking-[0.2em] text-neutral-500 uppercase">
            Appendix
          </p>
          <h2 className="text-xl font-semibold tracking-tight">
            Photo evidence ({appendix.length})
          </h2>
          <p className="text-sm text-neutral-600">
            Separate from the checklist. Cross-reference A-n from the Photos
            column above.
          </p>
        </header>

        {appendix.length === 0 ? (
          <p className="text-sm text-neutral-500">
            No photos attached to this assessment.
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 print:grid-cols-2">
            {appendix.map((p) => (
              <figure
                key={p.evidence.id}
                className="break-inside-avoid rounded border border-neutral-300 p-2"
              >
                <figcaption className="mb-2 space-y-0.5 text-xs">
                  <p className="font-semibold tabular-nums">
                    {p.ref}{" "}
                    <span className="font-mono font-normal text-neutral-600">
                      {p.evidence.criterionCode}
                    </span>{" "}
                    <span className="font-normal text-neutral-500">
                      [{p.kind}]
                    </span>
                  </p>
                  <p className="text-neutral-500">
                    {p.sectionOrder === 0
                      ? "Entry gate"
                      : `${p.sectionOrder}. ${p.sectionTitle}`}
                  </p>
                  <p className="line-clamp-3 text-neutral-800">
                    {p.criterionText}
                  </p>
                  {p.evidence.caption ? (
                    <p className="italic text-neutral-600">
                      {p.evidence.caption}
                    </p>
                  ) : null}
                </figcaption>
                {p.url ? (
                  // eslint-disable-next-line @next/next/no-img-element -- signed private storage URL for print
                  <img
                    src={p.url}
                    alt={`${p.ref} ${p.evidence.criterionCode}`}
                    className="max-h-64 w-full object-contain bg-neutral-50 print:max-h-52"
                    loading="eager"
                  />
                ) : (
                  <div className="flex min-h-24 items-center justify-center bg-neutral-50 px-2 text-center text-xs text-neutral-500">
                    {isImageMime(p.evidence.mimeType, p.evidence.fileName)
                      ? "Image unavailable"
                      : `File: ${p.evidence.fileName}`}
                  </div>
                )}
                <p className="mt-1 truncate text-[10px] text-neutral-400">
                  {p.evidence.fileName}
                </p>
              </figure>
            ))}
          </div>
        )}
      </section>

      <footer className="border-t border-neutral-300 pt-4 text-xs text-neutral-500">
        Generated by Pelbu OS for internal hotelier preparation only. Official
        classification is performed by authorised DOT assessors using the Hotel
        Classification System for Bhutan 2024.
      </footer>
    </div>
  );
}
