import { isDeskAuthenticated } from "@/lib/desk-auth";
import { redirect } from "next/navigation";

export const metadata = {
  title: "Check-in | Hotel OS",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{ q?: string; id?: string; booking?: string }>;
};

/** Legacy route — StayHub modal on Arrivals is the FO path. */
export default async function CheckInPage({ searchParams }: Props) {
  if (!(await isDeskAuthenticated())) redirect("/erp/login");
  const sp = await searchParams;
  const id = (sp.id ?? sp.booking ?? "").trim();
  if (id) {
    redirect(
      `/erp/arrivals?booking=${encodeURIComponent(id)}&step=check_in`,
    );
  }
  redirect("/erp/arrivals");
}
