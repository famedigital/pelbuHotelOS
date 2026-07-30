import { isDeskAuthenticated } from "@/lib/desk-auth";
import { resolveActivePropertyId } from "@/lib/property-context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const encoder = new TextEncoder();

function sse(event: string, data: unknown): Uint8Array {
  return encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

/**
 * Authenticated server-side bridge to Supabase Realtime.
 * The service key never reaches the browser; only the active property's
 * attendance change signal is streamed to the desk.
 */
export async function GET(request: Request): Promise<Response> {
  if (!(await isDeskAuthenticated())) {
    return new Response("Unauthorized", { status: 401 });
  }

  const admin = createSupabaseAdminClient();
  const propertyId = await resolveActivePropertyId(admin);
  let channel: ReturnType<typeof admin.channel> | null = null;
  let heartbeat: ReturnType<typeof setInterval> | null = null;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      const close = async () => {
        if (closed) return;
        closed = true;
        if (heartbeat) clearInterval(heartbeat);
        if (channel) await admin.removeChannel(channel);
        try {
          controller.close();
        } catch {
          // The browser may have already closed the stream.
        }
      };

      controller.enqueue(sse("ready", { propertyId }));
      heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": keep-alive\n\n"));
        } catch {
          void close();
        }
      }, 15_000);

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
                sse("attendance", {
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

      request.signal.addEventListener("abort", () => void close(), { once: true });
    },
    cancel() {
      if (heartbeat) clearInterval(heartbeat);
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
