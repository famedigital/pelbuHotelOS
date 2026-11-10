import { Metadata } from "next";
import { V2RegistryWorkspace } from "@/components/v2/V2RegistryWorkspace";

export const metadata: Metadata = {
  title: "Registry · Hotel OS v2",
  robots: { index: false, follow: false },
};

export default function V2RegistryPage() {
  return <V2RegistryWorkspace />;
}
