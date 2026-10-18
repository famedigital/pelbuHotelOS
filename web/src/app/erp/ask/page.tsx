import { AskPanel } from "@/components/erp/AskPanel";
import { DeskListShell } from "@/components/erp/DeskListShell";
import { isDeskAuthenticated } from "@/lib/desk-auth";
import { redirect } from "next/navigation";

export const metadata = {
  title: "Ask",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{ q?: string }>;
};

/** FO Ask — free / held / sheet rate in ≤5s. */
export default async function AskPage({ searchParams }: Props) {
  if (!(await isDeskAuthenticated())) redirect("/erp/login");
  const sp = await searchParams;

  return (
    <DeskListShell
      heading="Ask"
      subtitle="Phone answer: free · held · in · sheet rate. Enter → Reserve."
      wide
    >
      <AskPanel initialQuery={sp.q?.trim() ?? ""} />
    </DeskListShell>
  );
}
