import { Metadata } from "next";
import { V2StayViewPage } from "@/components/v2/V2StayViewPage";

export const metadata: Metadata = {
  title: "StayView · Hotel OS v2",
  description: "Room × date tape from GET /v1/calendar/stayview.",
  robots: { index: false, follow: false },
};

export default function V2StayViewRoute() {
  return <V2StayViewPage />;
}
