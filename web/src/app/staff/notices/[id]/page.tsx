import { StaffAppShell } from "@/components/erp/StaffAppShell";
import { NoticeAckPanel } from "@/components/erp/NoticeAckPanel";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getStaffSession } from "@/lib/staff-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Notice | Pelbu Staff",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function StaffNoticePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getStaffSession();
  if (!session) redirect("/staff/login");

  const admin = createSupabaseAdminClient();
  const { data: recipient } = await admin
    .from("hr_announcement_recipients")
    .select(
      "read_at, acknowledged_at, hr_announcements(id, title, category, priority, body, requires_acknowledgement, published_at, is_pinned)",
    )
    .eq("property_id", session.propertyId)
    .eq("staff_id", session.staffId)
    .eq("announcement_id", id)
    .maybeSingle();

  type NoticeRecord = {
    id: string;
    title: string;
    category: string;
    priority: string;
    body: string;
    requires_acknowledgement: boolean;
    published_at: string | null;
    is_pinned: boolean;
  };
  const related = recipient?.hr_announcements as
    | NoticeRecord
    | NoticeRecord[]
    | null
    | undefined;
  const notice = (Array.isArray(related) ? related[0] : related) ?? null;

  if (!recipient || !notice?.id) notFound();

  return (
    <StaffAppShell session={session}>
      <div className="space-y-4">
        <Link href="/staff" className="text-sm text-muted-foreground hover:underline">
          ← Back to home
        </Link>
        <Card>
          <CardHeader className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle>{notice.title}</CardTitle>
              {notice.is_pinned ? <Badge variant="outline">pinned</Badge> : null}
              {notice.priority !== "normal" ? (
                <Badge variant="destructive">{notice.priority}</Badge>
              ) : null}
            </div>
            <p className="text-xs text-muted-foreground">
              {notice.category}
              {notice.published_at
                ? ` · ${new Date(notice.published_at).toLocaleString()}`
                : ""}
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm whitespace-pre-wrap">{notice.body}</p>
            <NoticeAckPanel
              announcementId={notice.id}
              requiresAcknowledgement={notice.requires_acknowledgement}
              alreadyRead={Boolean(recipient.read_at)}
              acknowledgedAt={(recipient.acknowledged_at as string | null) ?? null}
            />
          </CardContent>
        </Card>
      </div>
    </StaffAppShell>
  );
}
