import { Metadata } from "next";
import { FrontDeskCockpit } from "@/components/desk/FrontDeskCockpit";

export const metadata: Metadata = {
  title: "Front Desk Cockpit · Hotel OS v2",
  description: "0ms In-Memory RAM Operations Cockpit, StayView Rack, and StayHub.",
  robots: { index: false, follow: false },
};

export default function V2DeskPage() {
  return <FrontDeskCockpit variant="api" />;
}
