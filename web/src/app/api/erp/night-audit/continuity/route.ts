import { requireMoneyDesk } from "@/lib/desk-auth";
import {
  buildHotelBackupPack,
  HOTEL_BACKUP_BUCKET,
  hotelBackupStoragePath,
} from "@/lib/night-audit/hotel-backup-pack";
import { resolveActivePropertyId } from "@/lib/property-context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { NextResponse, type NextRequest } from "next/server";

export const dynamic = "force-dynamic";

function validDate(value: string | null): string | null {
  if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  return null;
}

/**
 * Download hotel backup pack for a business date.
 * Streams Storage object when present; otherwise builds live.
 */
export async function GET(request: NextRequest) {
  try {
    await requireMoneyDesk();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const date = validDate(request.nextUrl.searchParams.get("date"));
  if (!date) {
    return NextResponse.json(
      { error: "Query `date=YYYY-MM-DD` required." },
      { status: 400 },
    );
  }

  const admin = createSupabaseAdminClient();
  const propertyId = await resolveActivePropertyId(admin);
  const storagePath = hotelBackupStoragePath(propertyId, date);

  const { data: blob, error: downloadError } = await admin.storage
    .from(HOTEL_BACKUP_BUCKET)
    .download(storagePath);

  let buffer: Buffer;
  let filename: string;

  if (blob && !downloadError) {
    buffer = Buffer.from(await blob.arrayBuffer());
    const { data: property } = await admin
      .from("properties")
      .select("slug")
      .eq("id", propertyId)
      .maybeSingle();
    const slug = (property?.slug as string | undefined) ?? "property";
    filename = `pelbu-hotel-backup-${slug}-${date}.xlsx`;
  } else {
    const built = await buildHotelBackupPack(admin, propertyId, date, null);
    buffer = built.buffer;
    filename = built.filename;
  }

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
