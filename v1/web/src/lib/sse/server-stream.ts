/**
 * SSE lifecycle. Vercel kills a function around 60s, so those hosts rotate.
 * A droplet Node process keeps the stream open and reconnects only on error.
 */

export const SSE_FUNCTION_MAX_SEC = 60;
export const SSE_ROTATE_MS = 50_000;
export const SSE_HEARTBEAT_MS = 25_000;

function sseRotates(): boolean {
  return process.env.VERCEL === "1";
}

const encoder = new TextEncoder();

export function encodeSse(event: string, data: unknown): Uint8Array {
  return encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

export function encodeSseComment(line: string): Uint8Array {
  return encoder.encode(`: ${line}\n\n`);
}

export function attachSseLifecycle(args: {
  controller: ReadableStreamDefaultController<Uint8Array>;
  close: () => void | Promise<void>;
}): () => void {
  const { controller, close } = args;
  let disposed = false;

  const heartbeat = setInterval(() => {
    try {
      controller.enqueue(encodeSseComment("keep-alive"));
    } catch {
      void close();
    }
  }, SSE_HEARTBEAT_MS);

  const rotate = sseRotates()
    ? setTimeout(() => {
        try {
          controller.enqueue(
            encodeSse("reconnect", {
              reason: "function_budget",
              afterMs: SSE_ROTATE_MS,
            }),
          );
        } catch {
          // closed
        }
        void close();
      }, SSE_ROTATE_MS)
    : null;

  return () => {
    if (disposed) return;
    disposed = true;
    clearInterval(heartbeat);
    if (rotate) clearTimeout(rotate);
  };
}
