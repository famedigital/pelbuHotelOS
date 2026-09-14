import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  AGENT_RATE_PDF_COOKIE,
  parseAgentRatePdfToken,
} from "@/lib/agent-rate-pdf";
import { resolvePublicPropertyId } from "@/lib/tenant/resolve-public-property";
import { cookies } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Serves the agent rate card only after a successful form gate (signed cookie).
 * Download is counted in the server action — this route does not double-count.
 */
export async function GET(request: NextRequest) {
  try {
    const propertyId = await resolvePublicPropertyId();
    if (!propertyId) {
      return NextResponse.json(
        { error: "Property not configured." },
        { status: 503 },
      );
    }

    const jar = await cookies();
    const session = parseAgentRatePdfToken(
      jar.get(AGENT_RATE_PDF_COOKIE)?.value,
    );
    if (!session || session.propertyId !== propertyId) {
      return NextResponse.redirect(new URL("/agents", request.url), 302);
    }

    const filePath = path.join(
      process.cwd(),
      "content",
      "rates",
      "agent-rate-card.html",
    );
    let html: string;
    try {
      html = await readFile(filePath, "utf8");
    } catch {
      // Monorepo root as cwd (local) — try web/content
      const alt = path.join(
        process.cwd(),
        "web",
        "content",
        "rates",
        "agent-rate-card.html",
      );
      html = await readFile(alt, "utf8");
    }

    const filename = "Pelbu-Suites-Agent-Rate-Card.html";

    return new NextResponse(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store, private",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (err) {
    console.error("agent rate card download failed", err);
    return NextResponse.json(
      { error: "Download failed. Please try again from the Agents page." },
      { status: 500 },
    );
  }
}
