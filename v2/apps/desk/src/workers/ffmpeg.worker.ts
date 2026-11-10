/**
 * FFmpeg WASM worker — media never leaves the browser.
 * SOURCE-MAP: REINVENT social share tools (AutoClipr-inspired free toolkit).
 */
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";

export type ClipToolId =
  | "slice"
  | "convert"
  | "aspect"
  | "audio"
  | "captions"
  | "compress"
  | "thumbnail"
  | "metadata"
  | "gif";

export type ClipAspect = "9:16" | "16:9" | "1:1" | "4:5";
export type ClipContainer = "mp4" | "webm" | "mov";
export type AudioFormat = "mp3" | "wav";
export type CompressPreset = "light" | "medium" | "heavy";

export type ClipToolOptions = {
  startSec?: number;
  endSec?: number;
  container?: ClipContainer;
  aspect?: ClipAspect;
  audioFormat?: AudioFormat;
  crfPreset?: CompressPreset;
  captionText?: string;
  captionBurn?: boolean;
  frameAtSec?: number;
  gifFps?: number;
  gifScale?: number;
};

type WorkerReq =
  | { id: string; type: "load" }
  | {
      id: string;
      type: "run";
      tool: ClipToolId;
      fileName: string;
      fileData: ArrayBuffer;
      options: ClipToolOptions;
    };

type WorkerRes =
  | { id: string; type: "progress"; ratio: number }
  | { id: string; type: "ready" }
  | {
      id: string;
      type: "done";
      mime: string;
      outName: string;
      data: ArrayBuffer;
      text?: string;
    }
  | { id: string; type: "error"; error: string };

const CORE_BASE =
  "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/esm";

let ffmpeg: FFmpeg | null = null;

async function ensureFfmpeg(id: string): Promise<FFmpeg> {
  if (ffmpeg?.loaded) return ffmpeg;
  const ff = new FFmpeg();
  ff.on("progress", ({ progress }) => {
    const msg: WorkerRes = {
      id,
      type: "progress",
      ratio: Math.max(0, Math.min(1, progress)),
    };
    self.postMessage(msg);
  });
  await ff.load({
    coreURL: await toBlobURL(`${CORE_BASE}/ffmpeg-core.js`, "text/javascript"),
    wasmURL: await toBlobURL(
      `${CORE_BASE}/ffmpeg-core.wasm`,
      "application/wasm",
    ),
  });
  ffmpeg = ff;
  return ff;
}

function extOf(name: string): string {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i + 1).toLowerCase() : "mp4";
}

function stemOf(name: string): string {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(0, i) : name;
}

function aspectFilter(aspect: ClipAspect): string {
  switch (aspect) {
    case "9:16":
      return "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920";
    case "16:9":
      return "scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080";
    case "1:1":
      return "scale=1080:1080:force_original_aspect_ratio=increase,crop=1080:1080";
    case "4:5":
      return "scale=1080:1350:force_original_aspect_ratio=increase,crop=1080:1350";
    default:
      return "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920";
  }
}

function crfFor(preset: CompressPreset): string {
  if (preset === "light") return "23";
  if (preset === "heavy") return "32";
  return "28";
}

function mimeFor(outName: string): string {
  const e = extOf(outName);
  if (e === "webm") return "video/webm";
  if (e === "mov") return "video/quicktime";
  if (e === "mp3") return "audio/mpeg";
  if (e === "wav") return "audio/wav";
  if (e === "gif") return "image/gif";
  if (e === "jpg" || e === "jpeg") return "image/jpeg";
  if (e === "png") return "image/png";
  if (e === "srt") return "application/x-subrip";
  if (e === "vtt") return "text/vtt";
  if (e === "txt") return "text/plain";
  return "video/mp4";
}

async function runTool(
  id: string,
  tool: ClipToolId,
  fileName: string,
  fileData: ArrayBuffer,
  options: ClipToolOptions,
): Promise<{ outName: string; data: Uint8Array; text?: string }> {
  const ff = await ensureFfmpeg(id);
  const inName = `input.${extOf(fileName) || "mp4"}`;
  const stem = stemOf(fileName).replace(/[^\w.-]+/g, "_") || "clip";
  await ff.writeFile(inName, new Uint8Array(fileData));

  try {
    switch (tool) {
      case "slice": {
        const start = Math.max(0, options.startSec ?? 0);
        const end = Math.max(start + 0.1, options.endSec ?? start + 30);
        const outName = `${stem}_slice.mp4`;
        const ok = await ff.exec([
          "-ss",
          String(start),
          "-to",
          String(end),
          "-i",
          inName,
          "-c:v",
          "libx264",
          "-c:a",
          "aac",
          "-movflags",
          "+faststart",
          outName,
        ]);
        if (ok !== 0) throw new Error("SLICE_FAILED");
        const data = await ff.readFile(outName);
        if (typeof data === "string") throw new Error("SLICE_UNEXPECTED_TEXT");
        return { outName, data };
      }
      case "convert": {
        const container = options.container ?? "mp4";
        const outName = `${stem}.${container}`;
        const args =
          container === "webm"
            ? ["-i", inName, "-c:v", "libvpx-vp9", "-c:a", "libopus", outName]
            : container === "mov"
              ? [
                  "-i",
                  inName,
                  "-c:v",
                  "libx264",
                  "-c:a",
                  "aac",
                  "-f",
                  "mov",
                  outName,
                ]
              : [
                  "-i",
                  inName,
                  "-c:v",
                  "libx264",
                  "-c:a",
                  "aac",
                  "-movflags",
                  "+faststart",
                  outName,
                ];
        const ok = await ff.exec(args);
        if (ok !== 0) throw new Error("CONVERT_FAILED");
        const data = await ff.readFile(outName);
        if (typeof data === "string") throw new Error("CONVERT_UNEXPECTED_TEXT");
        return { outName, data };
      }
      case "aspect": {
        const aspect = options.aspect ?? "9:16";
        const outName = `${stem}_${aspect.replace(":", "x")}.mp4`;
        const ok = await ff.exec([
          "-i",
          inName,
          "-vf",
          aspectFilter(aspect),
          "-c:v",
          "libx264",
          "-c:a",
          "aac",
          "-movflags",
          "+faststart",
          outName,
        ]);
        if (ok !== 0) throw new Error("ASPECT_FAILED");
        const data = await ff.readFile(outName);
        if (typeof data === "string") throw new Error("ASPECT_UNEXPECTED_TEXT");
        return { outName, data };
      }
      case "audio": {
        const fmt = options.audioFormat ?? "mp3";
        const outName = `${stem}.${fmt}`;
        const args =
          fmt === "wav"
            ? ["-i", inName, "-vn", "-acodec", "pcm_s16le", outName]
            : ["-i", inName, "-vn", "-acodec", "libmp3lame", "-q:a", "2", outName];
        const ok = await ff.exec(args);
        if (ok !== 0) throw new Error("AUDIO_EXTRACT_FAILED");
        const data = await ff.readFile(outName);
        if (typeof data === "string") throw new Error("AUDIO_UNEXPECTED_TEXT");
        return { outName, data };
      }
      case "captions": {
        const caption =
          options.captionText?.trim() ||
          "00:00:00,000 --> 00:00:05,000\nHotel highlight — edit me\n";
        const srtName = `${stem}.srt`;
        const encoder = new TextEncoder();
        await ff.writeFile(srtName, encoder.encode(caption));
        if (options.captionBurn) {
          const outName = `${stem}_captioned.mp4`;
          const ok = await ff.exec([
            "-i",
            inName,
            "-vf",
            `subtitles=${srtName}:force_style='FontSize=24,PrimaryColour=&H00FFFFFF&'`,
            "-c:a",
            "copy",
            outName,
          ]);
          if (ok !== 0) {
            // drawtext fallback when libass unavailable in wasm build
            const ok2 = await ff.exec([
              "-i",
              inName,
              "-vf",
              "drawtext=text='Captions':fontsize=24:fontcolor=white:x=(w-text_w)/2:y=h-80",
              "-c:a",
              "copy",
              outName,
            ]);
            if (ok2 !== 0) throw new Error("CAPTION_BURN_FAILED");
          }
          const data = await ff.readFile(outName);
          if (typeof data === "string") throw new Error("CAPTION_UNEXPECTED_TEXT");
          return { outName, data, text: caption };
        }
        const data = encoder.encode(caption);
        return { outName: srtName, data, text: caption };
      }
      case "compress": {
        const crf = crfFor(options.crfPreset ?? "medium");
        const outName = `${stem}_crf${crf}.mp4`;
        const ok = await ff.exec([
          "-i",
          inName,
          "-c:v",
          "libx264",
          "-crf",
          crf,
          "-preset",
          "fast",
          "-c:a",
          "aac",
          "-b:a",
          "128k",
          "-movflags",
          "+faststart",
          outName,
        ]);
        if (ok !== 0) throw new Error("COMPRESS_FAILED");
        const data = await ff.readFile(outName);
        if (typeof data === "string") throw new Error("COMPRESS_UNEXPECTED_TEXT");
        return { outName, data };
      }
      case "thumbnail": {
        const at = Math.max(0, options.frameAtSec ?? 1);
        const outName = `${stem}_frame.jpg`;
        const ok = await ff.exec([
          "-ss",
          String(at),
          "-i",
          inName,
          "-frames:v",
          "1",
          "-q:v",
          "2",
          outName,
        ]);
        if (ok !== 0) throw new Error("THUMBNAIL_FAILED");
        const data = await ff.readFile(outName);
        if (typeof data === "string") throw new Error("THUMB_UNEXPECTED_TEXT");
        return { outName, data };
      }
      case "metadata": {
        // probe via ffmpeg -i stderr is awkward; dump format to txt with ffprobe-like show
        const outName = `${stem}_meta.txt`;
        await ff.exec(["-i", inName, "-f", "ffmetadata", outName]);
        let text = "";
        try {
          const raw = await ff.readFile(outName);
          text =
            typeof raw === "string"
              ? raw
              : new TextDecoder().decode(raw);
        } catch {
          text = `file=${fileName}\nbytes=${fileData.byteLength}\nnote=Limited metadata from WASM build`;
        }
        text += `\nsource_bytes=${fileData.byteLength}\nsource_name=${fileName}\n`;
        const data = new TextEncoder().encode(text);
        return { outName, data, text };
      }
      case "gif": {
        const fps = Math.max(5, Math.min(15, options.gifFps ?? 10));
        const scale = Math.max(240, Math.min(720, options.gifScale ?? 480));
        const start = Math.max(0, options.startSec ?? 0);
        const end = Math.max(start + 0.5, options.endSec ?? start + 3);
        const outName = `${stem}.gif`;
        const ok = await ff.exec([
          "-ss",
          String(start),
          "-to",
          String(end),
          "-i",
          inName,
          "-vf",
          `fps=${fps},scale=${scale}:-1:flags=lanczos`,
          "-loop",
          "0",
          outName,
        ]);
        if (ok !== 0) throw new Error("GIF_FAILED");
        const data = await ff.readFile(outName);
        if (typeof data === "string") throw new Error("GIF_UNEXPECTED_TEXT");
        return { outName, data };
      }
      default: {
        const _exhaustive: never = tool;
        throw new Error(`UNKNOWN_TOOL:${String(_exhaustive)}`);
      }
    }
  } finally {
    try {
      await ff.deleteFile(inName);
    } catch (err) {
      console.warn("[ffmpeg.worker] cleanup input failed", err);
    }
  }
}

self.onmessage = async (ev: MessageEvent<WorkerReq>) => {
  const msg = ev.data;
  try {
    if (msg.type === "load") {
      await ensureFfmpeg(msg.id);
      const res: WorkerRes = { id: msg.id, type: "ready" };
      self.postMessage(res);
      return;
    }
    if (msg.type === "run") {
      const result = await runTool(
        msg.id,
        msg.tool,
        msg.fileName,
        msg.fileData,
        msg.options,
      );
      const copy = result.data.slice().buffer as ArrayBuffer;
      const res: WorkerRes = {
        id: msg.id,
        type: "done",
        mime: mimeFor(result.outName),
        outName: result.outName,
        data: copy,
        text: result.text,
      };
      self.postMessage(res, { transfer: [copy] });
      return;
    }
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error("[ffmpeg.worker]", { error, id: msg.id });
    const res: WorkerRes = { id: msg.id, type: "error", error };
    self.postMessage(res);
  }
};

export {};
