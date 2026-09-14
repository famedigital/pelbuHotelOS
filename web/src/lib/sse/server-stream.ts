/**
 * Vercel serverless SSE lifecycle (Hobby maxDuration 60s).
 * Rotate before kill; heartbeat less often on free to cut data.
 */

export const SSE_FUNCTION_MAX_SEC = 60;
export const SSE_ROTATE_MS = 50_000;
export const SSE_HEARTBEAT_MS = 25_000;

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

  const rotate = setTimeout(() => {
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
  }, SSE_ROTATE_MS);

  return () => {
    if (disposed) return;
    disposed = true;
    clearInterval(heartbeat);
    clearTimeout(rotate);
  };
}
