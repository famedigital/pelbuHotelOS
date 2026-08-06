/**
 * Vercel serverless SSE lifecycle.
 * Hobby (and default maxDuration) kill after 60s — open connections must
 * rotate *before* that, or logs fill with "Task timed out after 60 seconds".
 * Clients reconnect via EventSource onerror / `reconnect` event.
 */

export const SSE_FUNCTION_MAX_SEC = 60;
/** Leave headroom for cleanup before platform kill. */
export const SSE_ROTATE_MS = 50_000;
export const SSE_HEARTBEAT_MS = 15_000;

const encoder = new TextEncoder();

export function encodeSse(event: string, data: unknown): Uint8Array {
  return encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

export function encodeSseComment(line: string): Uint8Array {
  return encoder.encode(`: ${line}\n\n`);
}

/**
 * Heartbeat + soft close before maxDuration.
 * Call returned disposer from stream close/cancel.
 */
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

  const rotate = setTimeout(() => {
    try {
      controller.enqueue(
        encodeSse("reconnect", {
          reason: "function_budget",
          afterMs: SSE_ROTATE_MS,
        }),
      );
    } catch {
      // Already closed.
    }
    void close();
  }, SSE_ROTATE_MS);

  return () => {
    if (disposed) return;
    disposed = true;
    clearInterval(heartbeat);
    clearTimeout(rotate);
  };
}
