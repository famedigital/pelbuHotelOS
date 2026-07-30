import { permanentRedirect } from "next/navigation";

export default async function OrderRedirect({
  searchParams,
}: {
  searchParams: Promise<{ outlet?: string; menu?: string }>;
}) {
  const params = await searchParams;
  const outlet = params.outlet ?? params.menu;
  permanentRedirect(outlet ? `/menu?outlet=${encodeURIComponent(outlet)}` : "/menu");
}
