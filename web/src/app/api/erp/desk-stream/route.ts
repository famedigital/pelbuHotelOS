import { isDeskAuthenticated } from "@/lib/desk-auth";
import { resolveActivePropertyId } from "@/lib/property-context";
import { attachSseLifecycle, encodeSse } from "@/lib/sse/server-stream";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Row = {
  id?: string;
  booking_id?: string | null;
  folio_id?: string | null;
  property_id?: string | null;
};

/**
 * Desk-auth SSE bridge. The browser never holds the service-role key.
 * Bookings, room assignments, folios, and folio lines push one `desk` event.
 */
export async function GET(): Promise<Response> {
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

      const push = (table: string, eventType: string, row: Row | null) => {
        if (row?.property_id && row.property_id !== propertyId) return;
        try {
          controller.enqueue(
            encodeSse("desk", {
              table,
              eventType,
              bookingId: row?.booking_id ?? (table === "bookings" ? row?.id ?? null : null),
              folioId: row?.folio_id ?? (table === "folios" ? row?.id ?? null : null),
              id: row?.id ?? null,
            }),
          );
        } catch {
          void close();
        }
      };

      controller.enqueue(encodeSse("ready", { propertyId }));
      disposeLifecycle = attachSseLifecycle({ controller, close });

      const tables = ["bookings", "room_assignments", "folios", "folio_lines"] as const;
      let next = admin.channel(`desk-${propertyId}-${crypto.randomUUID()}`);
      for (const table of tables) {
        const filter =
          table === "folio_lines" ? undefined : `property_id=eq.${propertyId}`;
        next = next.on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table,
            ...(filter ? { filter } : {}),
          },
          (payload) => {
            const row = (payload.new ?? payload.old) as Row | null;
            push(table, payload.eventType, row);
          },
        );
      }
      channel = next.subscribe((status) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          try {
            controller.enqueue(
              encodeSse("reconnect", { reason: status }),
            );
          } catch {
            // closed
          }
          void close();
        }
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
    },
  });
}
