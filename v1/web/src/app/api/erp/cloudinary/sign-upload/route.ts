import { isSafeCloudinaryFolder } from "@/lib/cloudinary-admin";
import { cloudinaryConfigured, createUploadTicket } from "@/lib/cloudinary-upload";
import { isDeskAuthenticated } from "@/lib/desk-auth";
import { NextResponse, type NextRequest } from "next/server";

export const dynamic = "force-dynamic";

const ALLOWED_FOLDER_ROOT = "pelbu";

/**
 * Mints a signature so the browser can upload straight to Cloudinary.
 *
 * Only `folder` and `timestamp` are signed, and the folder must live under
 * `pelbu/`, so a leaked ticket cannot write anywhere else in the account.
 */
export async function POST(request: NextRequest) {
  if (!(await isDeskAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!cloudinaryConfigured()) {
    return NextResponse.json(
      { error: "Cloudinary is not configured on the server." },
      { status: 503 },
    );
  }

  let folder = ALLOWED_FOLDER_ROOT;
  try {
    const body = (await request.json()) as { folder?: string };
    folder = (body.folder ?? "").trim() || ALLOWED_FOLDER_ROOT;
  } catch {
    // No body — fall back to the account root folder.
  }

  const withinRoot =
    folder === ALLOWED_FOLDER_ROOT ||
    folder.startsWith(`${ALLOWED_FOLDER_ROOT}/`);
  if (!withinRoot || !isSafeCloudinaryFolder(folder)) {
    return NextResponse.json(
      { error: `Uploads must target a folder under ${ALLOWED_FOLDER_ROOT}/.` },
      { status: 400 },
    );
  }

  return NextResponse.json(createUploadTicket(folder));
}
