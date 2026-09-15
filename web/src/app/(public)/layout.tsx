import { PublicSiteHeader } from "@/components/site/PublicSiteHeader";
import { resolvePublicPropertyId } from "@/lib/tenant/resolve-public-property";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export default async function PublicSiteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let propertyName: string | null = null;
  try {
    const propertyId = await resolvePublicPropertyId();
    if (propertyId) {
      const admin = createSupabaseAdminClient();
      const { data } = await admin
        .from("properties")
        .select("name")
        .eq("id", propertyId)
        .maybeSingle();
      propertyName = (data?.name as string | null) ?? null;
    }
  } catch {
    // header still renders with SITE_NAME fallback
  }

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <PublicSiteHeader propertyName={propertyName} />
      <main className="flex-1">{children}</main>
    </div>
  );
}
