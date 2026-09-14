import { requireMoneyDesk } from "@/lib/desk-auth";
import { executeNightAudit } from "@/lib/night-audit/run";
import type {
  NightAuditPipelineStep,
  NightAuditStepEvent,
} from "@/lib/night-audit/steps";
import { todayInTimezone } from "@/lib/erp-lists";
import { loadProperty, resolveActivePropertyId } from "@/lib/property-context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

const encoder = new TextEncoder();
const sse = (event: string, data: unknown) =>
  encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);

/**
 * Desk night audit with live step progress (SSE).
 * Body: { business_date?: string, notes?: string }
 */
export async function POST(request: Request): Promise<Response> {
  try {
    await requireMoneyDesk();
  } catch {
    return new Response("Unauthorized", { status: 401 });
  }

  let body: { business_date?: string; notes?: string } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    body = {};
  }

  const admin = createSupabaseAdminClient();
  const propertyId = await resolveActivePropertyId(admin);
  const property = await loadProperty(admin, propertyId);
  const businessDate = (
    body.business_date?.trim() ||
    todayInTimezone(property?.timezone)
  ).slice(0, 10);
  const notes = body.notes?.trim() || null;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      const push = (event: string, data: unknown) => {
        if (closed) return;
        try {
          controller.enqueue(sse(event, data));
        } catch {
          closed = true;
        }
      };

      push("ready", { businessDate, propertyId });

      try {
        const result = await executeNightAudit(admin, propertyId, businessDate, {
          runBy: "desk",
          notes,
          onStep: async (event: NightAuditStepEvent) => {
            push("step", event);
          },
        });

        push("complete", {
          auditId: result.auditId,
          businessDate: result.businessDate,
          posted: result.posted,
          skipped: result.skipped,
          roomsOccupied: result.roomsOccupied,
          roomsComp: result.roomsComp,
          openFolios: result.openFolios,
          folioChargesBtn: result.folioChargesBtn,
          folioPaymentsBtn: result.folioPaymentsBtn,
          blockers: result.blockers,
          forceClose: result.forceClose,
          pipeline: result.pipeline as NightAuditPipelineStep[],
          hotelBackup: result.hotelBackup ?? null,
          message: [
            `Occupancy ${result.roomsOccupied} sellable + ${result.roomsComp} comp`,
            result.posted > 0
              ? `${result.posted} room-night(s) posted`
              : result.skipped > 0
                ? `${result.skipped} room-night(s) already posted (skipped)`
                : "0 room-nights posted",
            `Open folios ${result.openFolios}`,
            `Day charges ${result.folioChargesBtn} Nu · payments ${result.folioPaymentsBtn} Nu`,
          ].join(" · "),
        });
        revalidatePath("/erp/night-audit");
        revalidatePath("/erp");
      } catch (err) {
        push("error", {
          message:
            err instanceof Error ? err.message : "Night audit failed.",
        });
      } finally {
        if (!closed) {
          try {
            controller.close();
          } catch {
            // client gone
          }
          closed = true;
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
