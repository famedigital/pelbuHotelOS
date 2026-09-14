import { AttendanceKioskForm } from "@/components/erp/AttendanceKioskForm";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { isDeskAuthenticated } from "@/lib/desk-auth";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Attendance kiosk | Hotel OS",
  robots: { index: false, follow: false },
};

export default async function AttendanceKioskPage() {
  if (!(await isDeskAuthenticated())) redirect("/erp/login");

  return (
    <main className="erp mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-lg items-center p-4 md:p-6">
      <Card className="w-full">
        <CardHeader>
          <p className="text-xs font-semibold tracking-[0.18em] text-accent uppercase">
            Pelbu Staff
          </p>
          <CardTitle className="text-2xl">Attendance kiosk</CardTitle>
          <CardDescription>
            Enter your employee code and PIN. This screen does not sign the desk
            out or retain the staff session.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <AttendanceKioskForm />
          <Link
            href="/erp/hr/attendance"
            className="block text-center text-sm text-muted-foreground hover:underline"
          >
            Return to live duty board
          </Link>
        </CardContent>
      </Card>
    </main>
  );
}
