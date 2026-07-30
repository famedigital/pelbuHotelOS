import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { loadLaundryBagDetail } from "@/app/actions/laundry-bags";
import { StaffAppShell } from "@/components/erp/StaffAppShell";
import { LaundryBagScanView } from "@/components/laundry/LaundryBagScanView";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { canWorkLaundry } from "@/lib/laundry";
import { getStaffSession } from "@/lib/staff-auth";

export const metadata: Metadata = {
  title: "Laundry bag | Pelbu Staff",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function StaffLaundryBagPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ t?: string }>;
}) {
  const session = await getStaffSession();
  if (!session) redirect("/staff/login");
  const { id } = await params;
  const { t: rawToken } = await searchParams;

  if (!canWorkLaundry(session)) {
    return (
      <StaffAppShell session={session}>
        <Alert variant="destructive">
          <AlertTitle>Laundry access required</AlertTitle>
          <AlertDescription>
            Only laundry, housekeeping, or supervisors can open bag labels.
          </AlertDescription>
        </Alert>
      </StaffAppShell>
    );
  }

  if (!rawToken) {
    return (
      <StaffAppShell session={session}>
        <Alert variant="destructive">
          <AlertTitle>Missing scan code</AlertTitle>
          <AlertDescription>
            Scan the full QR from the bag sticker, or reprint labels from the
            desk.
          </AlertDescription>
        </Alert>
        <Button asChild variant="outline" className="mt-4">
          <Link href="/staff/laundry">Back to laundry</Link>
        </Button>
      </StaffAppShell>
    );
  }

  const detail = await loadLaundryBagDetail(session, id, rawToken);
  if ("error" in detail) {
    return (
      <StaffAppShell session={session}>
        <Alert variant="destructive">
          <AlertTitle>Cannot open bag</AlertTitle>
          <AlertDescription>{detail.error}</AlertDescription>
        </Alert>
        <Button asChild variant="outline" className="mt-4">
          <Link href="/staff/laundry">Back to laundry</Link>
        </Button>
      </StaffAppShell>
    );
  }

  return (
    <StaffAppShell session={session}>
      <LaundryBagScanView
        bag={detail.bag}
        siblings={detail.siblings}
        order={detail.order}
        events={detail.events}
        rawToken={rawToken}
      />
    </StaffAppShell>
  );
}
