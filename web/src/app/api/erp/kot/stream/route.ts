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
 * Desk-auth SSE bridge to Supabase Realtime on `orders`.
 * Browser never gets the service role key; KDS / POS refresh only after a push.
 *
 * Pattern matches laundry + HR attendance streams.
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
          // Browser closed first.
        }
      };

      const pushKot = (payload: {
        eventType?: string;
        orderId?: string | null;
      }) => {
        try {
          controller.enqueue(
            sse("kot", {
              eventType: payload.eventType ?? "*",
              orderId: payload.orderId ?? null,
              occurredAt: new Date().toISOString(),
            }),
          );
        } catch {
          void close();
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

      // `orders` is in supabase_realtime publication (202607290017).
      channel = admin
        .channel(`kot-${propertyId}-${crypto.randomUUID()}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "orders",
            filter: `property_id=eq.${propertyId}`,
          },
          (payload) => {
            const row = (payload.new ?? payload.old) as
              | { id?: string }
              | null
              | undefined;
            pushKot({
              eventType: payload.eventType,
              orderId: row?.id ?? null,
            });
          },
        )
        .subscribe();

      request.signal.addEventListener("abort", () => void close(), {
        once: true,
      });
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
