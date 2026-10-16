import { getAgentSession } from "@/lib/agent-auth";
import { isSafeCloudinaryFolder } from "@/lib/cloudinary-admin";
import { cloudinaryConfigured, createUploadTicket } from "@/lib/cloudinary-upload";
import { NextResponse, type NextRequest } from "next/server";

export const dynamic = "force-dynamic";

/** Partner uploads only under this prefix. */
const ALLOWED_PREFIX = "pelbu/agent-payment-proofs";

export async function POST(request: NextRequest) {
  const session = await getAgentSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!cloudinaryConfigured()) {
    return NextResponse.json(
      { error: "Uploads are not configured. Paste a link or ask the desk." },
      { status: 503 },
    );
  }

  let folder = ALLOWED_PREFIX;
  try {
    const body = (await request.json()) as { folder?: string };
    folder = (body.folder ?? "").trim() || ALLOWED_PREFIX;
  } catch {
    /* default */
  }

  const ok =
    folder === ALLOWED_PREFIX || folder.startsWith(`${ALLOWED_PREFIX}/`);
  if (!ok || !isSafeCloudinaryFolder(folder)) {
    return NextResponse.json(
      { error: `Uploads must target ${ALLOWED_PREFIX}/.` },
      { status: 400 },
    );
  }

  return NextResponse.json(createUploadTicket(folder));
}
