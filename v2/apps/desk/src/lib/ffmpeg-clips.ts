/**
 * Desk bridge to ffmpeg WASM worker — typed runners for Social Clips.
 * SOURCE-MAP: REINVENT (AutoClipr free-tools parity, property marketing only).
 */
import type {
  ClipToolId,
  ClipToolOptions,
} from "../workers/ffmpeg.worker";

export type {
  ClipAspect,
  ClipContainer,
  AudioFormat,
  CompressPreset,
  ClipToolId,
  ClipToolOptions,
} from "../workers/ffmpeg.worker";

export type ClipRunResult =
  | {
      ok: true;
      blob: Blob;
      outName: string;
      mime: string;
      text?: string;
      objectUrl: string;
    }
  | { ok: false; error: string };

type Pending = {
  resolve: (v: ClipRunResult) => void;
  onProgress?: (ratio: number) => void;
};

let worker: Worker | null = null;
const pending = new Map<string, Pending>();

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(
      new URL("../workers/ffmpeg.worker.ts", import.meta.url),
      { type: "module" },
    );
    worker.onmessage = (ev: MessageEvent) => {
      const msg = ev.data as {
        id: string;
        type: string;
        ratio?: number;
        mime?: string;
        outName?: string;
        data?: ArrayBuffer;
        text?: string;
        error?: string;
      };
      const slot = pending.get(msg.id);
      if (!slot) return;
      if (msg.type === "progress" && typeof msg.ratio === "number") {
        slot.onProgress?.(msg.ratio);
        return;
      }
      if (msg.type === "ready") {
        slot.resolve({
          ok: true,
          blob: new Blob(),
          outName: "ready",
          mime: "application/octet-stream",
          objectUrl: "",
        });
        pending.delete(msg.id);
        return;
      }
      if (msg.type === "error") {
        slot.resolve({ ok: false, error: msg.error ?? "FFMPEG_ERROR" });
        pending.delete(msg.id);
        return;
      }
      if (msg.type === "done" && msg.data && msg.outName && msg.mime) {
        const blob = new Blob([msg.data], { type: msg.mime });
        const objectUrl = URL.createObjectURL(blob);
        slot.resolve({
          ok: true,
          blob,
          outName: msg.outName,
          mime: msg.mime,
          text: msg.text,
          objectUrl,
        });
        pending.delete(msg.id);
      }
    };
    worker.onerror = (err) => {
      console.error("[ffmpeg-clips] worker error", err);
      for (const [id, slot] of pending) {
        slot.resolve({ ok: false, error: "FFMPEG_WORKER_CRASH" });
        pending.delete(id);
      }
    };
  }
  return worker;
}

function nextId(): string {
  return crypto.randomUUID();
}

export function preloadFfmpeg(
  onProgress?: (ratio: number) => void,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const id = nextId();
  const w = getWorker();
  return new Promise((resolve) => {
    pending.set(id, {
      onProgress,
      resolve: (v) => {
        if (!v.ok) {
          resolve({ ok: false, error: v.error });
          return;
        }
        resolve({ ok: true });
      },
    });
    w.postMessage({ id, type: "load" });
  });
}

export async function runClipTool(
  tool: ClipToolId,
  file: File,
  options: ClipToolOptions = {},
  onProgress?: (ratio: number) => void,
): Promise<ClipRunResult> {
  const id = nextId();
  const w = getWorker();
  const fileData = await file.arrayBuffer();
  return new Promise((resolve) => {
    pending.set(id, { resolve, onProgress });
    w.postMessage(
      {
        id,
        type: "run",
        tool,
        fileName: file.name,
        fileData,
        options,
      },
      [fileData],
    );
  });
}

export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

export const CLIP_TOOLS: Array<{
  id: ClipToolId;
  label: string;
  blurb: string;
}> = [
  { id: "slice", label: "Slicer", blurb: "Trim to exact seconds" },
  { id: "convert", label: "Convert", blurb: "MP4 · WebM · MOV" },
  { id: "aspect", label: "Aspect", blurb: "9:16 Reels · 16:9 · 1:1" },
  { id: "audio", label: "Audio", blurb: "Extract MP3 / WAV" },
  { id: "captions", label: "Captions", blurb: "SRT sidecar or burn-in" },
  { id: "compress", label: "Compress", blurb: "H.264 CRF presets" },
  { id: "thumbnail", label: "Thumbnail", blurb: "Grab a still frame" },
  { id: "metadata", label: "Metadata", blurb: "Inspect codecs & size" },
  { id: "gif", label: "GIF", blurb: "Looping clip GIF" },
];
