import { StaffLoginForm } from "@/components/erp/StaffAuthForms";
import { BRAND_ICONS } from "@/lib/brand";
import { LOGIN_HOTEL_CODE_COOKIE } from "@/lib/hotel-codes";
import { safeStaffNextPath } from "@/lib/safe-staff-next";
import { SITE_NAME } from "@/lib/site";
import { getStaffSession } from "@/lib/staff-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Staff login",
  robots: { index: false, follow: false },
  manifest: "/staff.webmanifest",
};

export default async function StaffLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const params = await searchParams;
  const nextPath = safeStaffNextPath(params.next);
  const session = await getStaffSession();
  if (session) {
    redirect(nextPath ?? (session.canAccessDesk ? "/erp" : "/staff"));
  }

  const jar = await cookies();
  const savedCode = jar.get(LOGIN_HOTEL_CODE_COOKIE)?.value?.trim() || null;
  let savedName: string | null = null;
  if (savedCode) {
    try {
      const admin = createSupabaseAdminClient();
      const { data } = await admin
        .from("properties")
        .select("name")
        .eq("hotel_code", savedCode)
        .maybeSingle();
      savedName = (data?.name as string | undefined) ?? null;
    } catch {
      savedName = null;
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 py-16">
      <div className="w-full max-w-md space-y-6">
        <div className="space-y-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={BRAND_ICONS.mark}
            alt={SITE_NAME}
            className="h-12 w-12 object-contain"
            width={48}
            height={48}
          />
          <div>
            <p className="text-xs font-semibold tracking-[0.2em] text-accent uppercase">
              {SITE_NAME} · Staff
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">
              Sign in
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {nextPath?.startsWith("/staff/laundry/bags/")
                ? "Enter hotel code, then your employee code and PIN to open this laundry bag."
                : "Enter hotel code first, then user ID and PIN for shifts, leave, and clock."}
            </p>
          </div>
        </div>
        <StaffLoginForm
          nextPath={nextPath}
          initialHotelCode={savedCode}
          initialPropertyName={savedName}
        />
        <Link
          href="/login"
          className="block text-center text-sm text-muted-foreground underline-offset-4 hover:underline"
        >
          Use a different workspace
        </Link>
      </div>
    </main>
  );
}
