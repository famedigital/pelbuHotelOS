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
/** Matches Hobby hard cap; stream rotates before this via attachSseLifecycle. */
export const maxDuration = SSE_FUNCTION_MAX_SEC;

/**
 * Desk-auth SSE bridge to Supabase Realtime on `orders`.
 * Browser never gets the service role key; KDS / POS refresh only after a push.
 *
 * Vercel cannot hold SSE forever — connection rotates ~50s (client reconnects).
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
          // Browser closed first.
        }
      };

      const pushKot = (payload: {
        eventType?: string;
        orderId?: string | null;
      }) => {
        try {
          controller.enqueue(
            encodeSse("kot", {
              eventType: payload.eventType ?? "*",
              orderId: payload.orderId ?? null,
              occurredAt: new Date().toISOString(),
            }),
          );
        } catch {
          void close();
        }
      };

      controller.enqueue(encodeSse("ready", { propertyId }));
      disposeLifecycle = attachSseLifecycle({ controller, close });

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
