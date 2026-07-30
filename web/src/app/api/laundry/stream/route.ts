import { isDeskAuthenticated } from "@/lib/desk-auth";
import { resolveActivePropertyId } from "@/lib/property-context";
import { getStaffSession } from "@/lib/staff-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const encoder = new TextEncoder();
const sse = (event: string, data: unknown) =>
  encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);

export async function GET(request: Request): Promise<Response> {
  const admin = createSupabaseAdminClient();
  const staff = await getStaffSession();
  const propertyId = staff
    ? staff.propertyId
    : (await isDeskAuthenticated())
      ? await resolveActivePropertyId(admin)
      : null;
  if (!propertyId) return new Response("Unauthorized", { status: 401 });

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
          // Browser disconnected first.
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
        .channel(`laundry-${propertyId}-${crypto.randomUUID()}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "laundry_orders",
            filter: `property_id=eq.${propertyId}`,
          },
          (payload) => {
            try {
              controller.enqueue(
                sse("laundry", {
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
