import { AgentApplyForm } from "@/components/agents/AgentApplyForm";
import { ConversionShell } from "@/components/site/ConversionShell";

export const metadata = {
  title: "Travel Agent Partners | Pelbu Suites",
  description:
    "Apply as a Bhutan, Jaigaon, or India travel trade partner — agent rates, MoU credit terms, complimentary guide and driver beds, and a fast booking desk.",
};

export default function AgentsPage() {
  return (
    <ConversionShell
      eyebrow="Travel Agent Partners"
      title="Built for the Bhutan travel trade."
      body="If you bring guests to Bhutan — from Thimphu and Paro agents to Jaigaon consolidators and India operators — apply once. We review your license, set your rate tier, and open a fast, account-based booking desk."
      aside={
        <div className="space-y-8 text-sm text-muted">
          <div className="space-y-3">
            <p className="text-xs tracking-[0.2em] text-gold uppercase">
              What approved partners get
            </p>
            <ul className="space-y-2.5 text-espresso/80">
              <li className="flex gap-2.5">
                <span aria-hidden="true" className="mt-2 h-1 w-3 flex-none bg-gold/70" />
                <span>Agent and MoU rate tiers per room category</span>
              </li>
              <li className="flex gap-2.5">
                <span aria-hidden="true" className="mt-2 h-1 w-3 flex-none bg-gold/70" />
                <span>Complimentary guide and driver beds on qualifying bookings</span>
              </li>
              <li className="flex gap-2.5">
                <span aria-hidden="true" className="mt-2 h-1 w-3 flex-none bg-gold/70" />
                <span>Credit ledger with monthly settlement history</span>
              </li>
              <li className="flex gap-2.5">
                <span aria-hidden="true" className="mt-2 h-1 w-3 flex-none bg-gold/70" />
                <span>A dedicated booking desk (ERP + PWA coming next)</span>
              </li>
            </ul>
          </div>

          <div className="space-y-3">
            <p className="text-xs tracking-[0.2em] text-gold uppercase">
              What we review
            </p>
            <ul className="space-y-2.5 text-espresso/80">
              <li className="flex gap-2.5">
                <span aria-hidden="true" className="mt-2 h-1 w-3 flex-none bg-espresso/30" />
                <span>Valid Bhutan / Jaigaon / India trade license</span>
              </li>
              <li className="flex gap-2.5">
                <span aria-hidden="true" className="mt-2 h-1 w-3 flex-none bg-espresso/30" />
                <span>Market and booking volume for your rate tier</span>
              </li>
              <li className="flex gap-2.5">
                <span aria-hidden="true" className="mt-2 h-1 w-3 flex-none bg-espresso/30" />
                <span>MoU terms where you want credit</span>
              </li>
            </ul>
          </div>

          <p className="border-t border-espresso/10 pt-4 leading-relaxed">
            Need to move a guest today? Book direct on{" "}
            <a
              href="/book"
              className="text-gold underline-offset-4 hover:underline font-medium"
            >
              /book
            </a>{" "}
            while your application is reviewed. Once approved, we will connect future
            bookings to your partner account.
          </p>
        </div>
      }
    >
      <AgentApplyForm />
    </ConversionShell>
  );
}
