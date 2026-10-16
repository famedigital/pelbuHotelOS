import { redirect } from "next/navigation";

export const metadata = {
  title: "StayView",
  robots: { index: false, follow: false },
};

/** Legacy Today → StayView desk home. */
export default function FoTodayRedirectPage() {
  redirect("/erp/stayview");
}
