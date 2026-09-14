import { isDeskAuthenticated } from "@/lib/desk-auth";
import { redirect } from "next/navigation";

export const metadata = {
  title: "Booking | Hotel OS",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

/** Legacy dossier — StayHub on Reservations is the FO path. */
export default async function BookingDetailPage({ params }: Props) {
  if (!(await isDeskAuthenticated())) redirect("/erp/login");
  const { id } = await params;
  redirect(`/erp/reservations?booking=${encodeURIComponent(id)}`);
}
