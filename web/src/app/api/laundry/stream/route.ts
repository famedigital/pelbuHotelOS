import { isDeskAuthenticated } from "@/lib/desk-auth";
import { getLaundryGuestSession } from "@/lib/laundry-session";
import { resolveActivePropertyId } from "@/lib/property-context";
import { getStaffSession } from "@/lib/staff-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const encoder = new TextEncoder();
const sse = (event: string, data: unknown) =>
  encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);

type StreamScope =
  | { kind: "property"; propertyId: string }
  | { kind: "guest"; propertyId: string; bookingId: string };

async function resolveStreamScope(): Promise<StreamScope | null> {
  const staff = await getStaffSession();
  if (staff) {
    return { kind: "property", propertyId: staff.propertyId };
  }
  if (await isDeskAuthenticated()) {
    const admin = createSupabaseAdminClient();
    const propertyId = await resolveActivePropertyId(admin);
    return { kind: "property", propertyId };
  }
  const guest = await getLaundryGuestSession();
  if (guest) {
    return {
      kind: "guest",
      propertyId: guest.propertyId,
      bookingId: guest.bookingId,
    };
  }
  return null;
}

export async function GET(request: Request): Promise<Response> {
  const scope = await resolveStreamScope();
  if (!scope) return new Response("Unauthorized", { status: 401 });

  const admin = createSupabaseAdminClient();
  let channel: ReturnType<typeof admin.channel> | null = null;
  let heartbeat: ReturnType<typeof setInterval> | null = null;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      const push = (source: string) => {
        try {
          controller.enqueue(
            sse("laundry", {
              source,
              occurredAt: new Date().toISOString(),
            }),
          );
        } catch {
          void close();
        }
      };
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

      controller.enqueue(
        sse("ready", {
          propertyId: scope.propertyId,
          scope: scope.kind,
        }),
      );

      heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": keep-alive\n\n"));
        } catch {
          void close();
        }
      }, 15_000);

      channel = admin.channel(`laundry-${scope.propertyId}-${crypto.randomUUID()}`);

      if (scope.kind === "guest") {
        channel.on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "laundry_orders",
            filter: `booking_id=eq.${scope.bookingId}`,
          },
          () => push("order"),
        );
      } else {
        channel
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "laundry_orders",
              filter: `property_id=eq.${scope.propertyId}`,
            },
            () => push("order"),
          )
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "laundry_order_bags",
              filter: `property_id=eq.${scope.propertyId}`,
            },
            () => push("bag"),
          );
      }

      channel.subscribe();
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
