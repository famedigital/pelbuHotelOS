import { CompliancePrintShell } from "@/components/erp/compliance/CompliancePrintShell";
import { PELBU_PROPERTY } from "@/lib/compliance-pack/catalog";
import {
  PELBU_ISR_BLOCKS,
  PELBU_ISR_VERSION,
} from "@/lib/compliance-pack/isr-pelbu";
import { isDeskAuthenticated } from "@/lib/desk-auth";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Pelbu Suites ISR — MoLHR draft",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function ComplianceIsrPrintPage() {
  if (!(await isDeskAuthenticated())) redirect("/erp/login");

  return (
    <CompliancePrintShell
      title="Internal Service Rules"
      subtitle={PELBU_ISR_VERSION}
      wide
    >
      {/* MoLHR cover */}
      <section className="space-y-4 break-after-page border border-neutral-300 p-6 print:break-after-page">
        <p className="text-xs font-semibold tracking-[0.2em] text-neutral-500 uppercase">
          Cover · for Chief Labour Administrator
        </p>
        <p className="text-sm">
          To,
          <br />
          The Chief Labour Administrator
          <br />
          Ministry of Labour and Human Resources
          <br />
          Royal Government of Bhutan
          <br />
          Thimphu
        </p>
        <p className="text-sm">
          <span className="font-semibold">Subject:</span> Submission of Internal
          Service Rules for approval — {PELBU_PROPERTY.legalName}
        </p>
        <p className="text-sm leading-relaxed">
          Sir / Madam,
          <br />
          <br />
          We hereby submit the Internal Service Rules of{" "}
          <strong>{PELBU_PROPERTY.legalName}</strong>, situated at{" "}
          {PELBU_PROPERTY.addressDetail}, for kind review and approval under the
          Labour and Employment Act of Bhutan, 2007 and applicable regulations.
          These Rules shall apply to all employees of the establishment and shall
          come into effect from the date of approval by the Chief Labour
          Administrator.
        </p>
        <p className="text-sm leading-relaxed">
          We undertake to disseminate the approved Rules to all employees and to
          keep a signed Staff Handbook acknowledgement on file for each employee.
        </p>
        <div className="grid gap-6 pt-4 text-sm sm:grid-cols-2">
          <div className="space-y-2">
            <p className="font-semibold">Employer</p>
            <p>{PELBU_PROPERTY.legalName}</p>
            <p>{PELBU_PROPERTY.address}</p>
            <p>{PELBU_PROPERTY.phone}</p>
            <p>{PELBU_PROPERTY.email}</p>
            <p className="border-b border-neutral-400 pt-10 text-xs text-neutral-500">
              Authorized signatory / seal
            </p>
            <p className="border-b border-neutral-400 pt-8 text-xs text-neutral-500">
              Name / designation / date
            </p>
          </div>
          <div className="space-y-2">
            <p className="font-semibold">For office use (MoLHR)</p>
            <p className="border-b border-neutral-300 pt-6 text-xs">
              Received on
            </p>
            <p className="border-b border-neutral-300 pt-6 text-xs">
              Reference no.
            </p>
            <p className="border-b border-neutral-300 pt-6 text-xs">
              Approved / returned
            </p>
            <p className="border-b border-neutral-300 pt-6 text-xs">
              Officer / seal
            </p>
          </div>
        </div>
      </section>

      <section className="space-y-1 py-4 text-center">
        <p className="text-xs tracking-[0.2em] text-neutral-500 uppercase">
          Internal Service Rules
        </p>
        <h2 className="text-2xl font-semibold tracking-tight">
          {PELBU_PROPERTY.name}
        </h2>
        <p className="text-sm text-neutral-600">{PELBU_PROPERTY.addressDetail}</p>
      </section>

      <article className="space-y-3 text-sm leading-relaxed">
        {PELBU_ISR_BLOCKS.map((b, i) => {
          if (b.type === "h2") {
            return (
              <h2
                key={i}
                className="mt-6 border-b border-neutral-200 pb-1 text-base font-semibold"
              >
                {b.text}
              </h2>
            );
          }
          if (b.type === "h3") {
            return (
              <h3 key={i} className="mt-3 text-sm font-semibold">
                {b.text}
              </h3>
            );
          }
          if (b.type === "li") {
            return (
              <p key={i} className="pl-4 before:mr-2 before:content-['•']">
                {b.text}
              </p>
            );
          }
          if (b.type === "note") {
            return (
              <p
                key={i}
                className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950"
              >
                {b.text}
              </p>
            );
          }
          return <p key={i}>{b.text}</p>;
        })}
      </article>

      <section className="mt-8 space-y-4 break-before-page print:break-before-page">
        <h2 className="text-base font-semibold">Signature block</h2>
        <div className="grid gap-8 sm:grid-cols-2 text-sm">
          <div className="space-y-6">
            <p className="font-semibold">For the Employer</p>
            <p className="border-b border-neutral-400 pt-10">Signature / seal</p>
            <p className="border-b border-neutral-400 pt-8">Name</p>
            <p className="border-b border-neutral-400 pt-8">Designation</p>
            <p className="border-b border-neutral-400 pt-8">Date</p>
          </div>
          <div className="space-y-6">
            <p className="font-semibold">Employee acknowledgement (handbook)</p>
            <p className="text-xs text-neutral-600">
              I have received and read the Internal Service Rules of{" "}
              {PELBU_PROPERTY.name} and agree to abide by them.
            </p>
            <p className="border-b border-neutral-400 pt-10">Employee signature</p>
            <p className="border-b border-neutral-400 pt-8">Name / CID</p>
            <p className="border-b border-neutral-400 pt-8">Date</p>
          </div>
        </div>
      </section>

      <section className="mt-8 space-y-3 break-before-page print:break-before-page text-sm">
        <h2 className="text-base font-semibold">
          Annexure II — Occupational Health and Safety Policy Statement
        </h2>
        <p className="font-semibold">DECLARATION</p>
        <p className="leading-relaxed">
          The management of {PELBU_PROPERTY.name} is firmly committed to a policy
          enabling all work activities to be carried out safely, and with all
          possible measures taken to remove, or at least reduce, risks to the
          health, safety, and welfare of workers, contractors, visitors, and
          anyone else who may be affected by our operations. We are committed to
          fully comply with the Labour and Employment Act of Bhutan 2007, and
          relevant Occupational Health and Safety legislations.
        </p>
        <p className="border-b border-neutral-400 pt-12 text-xs text-neutral-500">
          Policy statement endorsed by (name, signature, seal, date)
        </p>
      </section>
    </CompliancePrintShell>
  );
}
