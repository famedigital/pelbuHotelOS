import { answerAvailability } from "@/lib/ask/availability-answer";
import { parseAskQuery } from "@/lib/ask/parse-ask-query";
import { parseFoRateTier, defaultFoRateTier } from "@/lib/ask/fo-rate-sheet";
import { isDeskAuthenticated } from "@/lib/desk-auth";
import { requireDeskPropertyId } from "@/lib/desk-property";
import { isRateTier, type RateTier } from "@/lib/rates";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * FO Ask — parse free text + return free/held/in + sheet rate.
 * GET ?q=3+rooms+22+oct+3n&rate_tier=public
 * Or structured: ?check_in=&check_out=&rooms=&rate_tier=
 */
export async function GET(request: Request) {
  if (!(await isDeskAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sp = new URL(request.url).searchParams;
  const q = sp.get("q")?.trim() ?? "";
  const rateRaw = sp.get("rate_tier");
  const parsedTier = parseFoRateTier(rateRaw);
  const rateTier: RateTier =
    parsedTier && parsedTier !== "custom" && isRateTier(parsedTier)
      ? parsedTier
      : defaultFoRateTier(false);

  let checkIn = sp.get("check_in")?.trim() ?? "";
  let checkOut = sp.get("check_out")?.trim() ?? "";
  let rooms = Number(sp.get("rooms") ?? "1");

  let parsed = null as ReturnType<typeof parseAskQuery>;
  if (q) {
    parsed = parseAskQuery(q);
    if (parsed) {
      checkIn = checkIn || parsed.checkIn;
      checkOut = checkOut || parsed.checkOut;
      rooms = Number.isFinite(rooms) && rooms > 0 ? rooms : parsed.rooms;
      if (!sp.get("rooms")) rooms = parsed.rooms;
    }
  }

  if (!checkIn || !checkOut) {
    return NextResponse.json(
      {
        error: parsed
          ? null
          : q
            ? "Could not parse dates. Try: 3 rooms 22 oct 3n"
            : "Provide q= or check_in + check_out",
        parsed,
      },
      { status: 400 },
    );
  }

  if (!Number.isFinite(rooms) || rooms < 1) rooms = 1;
  rooms = Math.min(rooms, 20);

  const propertyId = await requireDeskPropertyId();
  const admin = createSupabaseAdminClient();
  const answer = await answerAvailability(admin, {
    propertyId,
    checkIn,
    checkOut,
    roomsRequested: rooms,
    rateTier,
  });

  return NextResponse.json({
    ok: true,
    parsed: parsed ?? {
      rooms,
      checkIn,
      checkOut,
      nights: answer.nights,
      raw: q,
    },
    answer,
  });
}
