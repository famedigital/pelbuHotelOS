import { getServerDefaultV2PropertySlug } from "@/lib/v2/default-property-slug.server";
import { V2HomeClient } from "./v2-home-client";

export default function V2HomePage() {
  const defaultPropertySlug = getServerDefaultV2PropertySlug();
  return <V2HomeClient defaultPropertySlug={defaultPropertySlug} />;
}
