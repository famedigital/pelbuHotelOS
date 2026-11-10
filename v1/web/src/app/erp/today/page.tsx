import { Metadata } from "next";
import { FrontDeskCockpit } from "@/components/desk/FrontDeskCockpit";

export const metadata: Metadata = {
  title: "Front Desk Cockpit · Hotel OS Bhutan v2",
  description: "0-Latency In-Memory RAM Operations Cockpit, StayView Rack, and StayHub.",
  robots: { index: false, follow: false },
};

export default function ErpTodayCockpitPage() {
  return <FrontDeskCockpit />;
}
