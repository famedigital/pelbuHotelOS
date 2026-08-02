import { isDeskAuthenticated } from "@/lib/desk-auth";
import { redirect } from "next/navigation";

export const metadata = {
  title: "Fast book | Pelbu OS",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{
    check_in?: string;
    check_out?: string;
    room_unit_id?: string;
  }>;
};

/**
 * Thin deep-link: Fast Book lives as a modal on Reservations (?new=1).
 * Preserves calendar-style prefill query params.
 */
export default async function FastBookPage({ searchParams }: Props) {
  if (!(await isDeskAuthenticated())) {
    redirect("/erp/login");
  }

  const sp = await searchParams;
  const params = new URLSearchParams();
  params.set("new", "1");
  if (sp.check_in) params.set("check_in", sp.check_in);
  if (sp.check_out) params.set("check_out", sp.check_out);
  if (sp.room_unit_id) params.set("room_unit_id", sp.room_unit_id);

  redirect(`/erp/reservations?${params.toString()}`);
}
