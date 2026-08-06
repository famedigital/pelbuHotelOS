import { isDeskAuthenticated } from "@/lib/desk-auth";
import { resolveActivePropertyId } from "@/lib/property-context";
import {
  attachSseLifecycle,
  encodeSse,
  SSE_FUNCTION_MAX_SEC,
} from "@/lib/sse/server-stream";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
/** Stream rotates before this — see attachSseLifecycle. */
export const maxDuration = SSE_FUNCTION_MAX_SEC;

/**
 * Authenticated server-side bridge to Supabase Realtime.
 * The service key never reaches the browser; only the active property's
 * attendance change signal is streamed to the desk.
 *
 * Vercel function budget: soft-close ~50s; client EventSource reconnects.
 */
export async function GET(request: Request): Promise<Response> {
  if (!(await isDeskAuthenticated())) {
    return new Response("Unauthorized", { status: 401 });
  }

  const admin = createSupabaseAdminClient();
  const propertyId = await resolveActivePropertyId(admin);
  let channel: ReturnType<typeof admin.channel> | null = null;
  let disposeLifecycle: (() => void) | null = null;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      const close = async () => {
        if (closed) return;
        closed = true;
        disposeLifecycle?.();
        disposeLifecycle = null;
        if (channel) await admin.removeChannel(channel);
        channel = null;
        try {
          controller.close();
        } catch {
          // The browser may have already closed the stream.
        }
      };

      controller.enqueue(encodeSse("ready", { propertyId }));
      disposeLifecycle = attachSseLifecycle({ controller, close });

      channel = admin
        .channel(`desk-attendance-${propertyId}-${crypto.randomUUID()}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "staff_attendance_events",
            filter: `property_id=eq.${propertyId}`,
          },
          (payload) => {
            try {
              controller.enqueue(
                encodeSse("attendance", {
                  eventType: payload.eventType,
                  occurredAt: new Date().toISOString(),
                }),
              );
            } catch {
              void close();
            }
          },
        )
        .subscribe();

      request.signal.addEventListener("abort", () => void close(), {
        once: true,
      });
    },
    cancel() {
      disposeLifecycle?.();
      if (channel) void admin.removeChannel(channel);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
